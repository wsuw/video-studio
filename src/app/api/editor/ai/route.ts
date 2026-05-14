import { createOllama } from 'ai-sdk-ollama';
import { convertToModelMessages, JSONSchema7, jsonSchema, streamText, tool, ToolSet, UIMessage } from "ai";
import {
  DocumentState,
} from "@blocknote/xl-ai/server";


const systemPrompt = `You're manipulating a text document using HTML blocks. 
Make sure to follow the json schema provided. When referencing ids they MUST be EXACTLY the same (including the trailing $). 

If the user requests updates to the document, use the "applyDocumentOperations" tool to update the document.
---
IF there is no selection active in the latest state, first, determine what part of the document the user is talking about.
Prefer updating existing blocks over removing and adding.
The "block" field in update operations MUST be a single HTML element (e.g., <p>Content</p>).
---`;


function injectDocumentStateMessages(
  messages: UIMessage[],
): UIMessage[] {
  return messages.map((message) => {
    if (message.role === "user" && (message.metadata as any)?.documentState) {
      const documentState = (message.metadata as any).documentState as DocumentState<any>;

      // 获取用户原始文本
      const userText = message.parts
        .filter(p => p.type === 'text')
        .map(p => (p as any).text)
        .join('\n');

      let combinedContent = "";

      // 1. 全文背景
      combinedContent += `### BACKGROUND CONTEXT\nBelow is the current state of the document for your reference:\n\`\`\`json\n${JSON.stringify(documentState.blocks, null, 2)}\n\`\`\`\n\n`;

      // 2. 目标操作区
      if (documentState.selection) {
        combinedContent += `### TARGET SELECTION\nThe user has selected these specific blocks to replace or improve. You MUST focus your operations on these IDs:\n\`\`\`json\n${JSON.stringify(documentState.selectedBlocks, null, 2)}\n\`\`\`\n\n`;
      } else {
        combinedContent += `### CURSOR POSITION\nNo selection. Cursor is ${documentState.cursor ? "AT" : "BETWEEN"} a block.\n\n`;
      }

      // 3. 最终任务
      combinedContent += `### TASK\n${userText}\n\nIMPORTANT: Use 'applyDocumentOperations' tool. One HTML element per block. EXACT IDs.`;

      return {
        ...message,
        parts: [{ type: "text", text: combinedContent }],
      };
    }
    return message;
  });
}

/**
 * 递归清理 Schema，解决 Ollama 的兼容性问题
 */
function cleanSchema(schema: any): any {
  if (typeof schema !== 'object' || schema === null) return schema;
  const newSchema = { ...schema };
  delete newSchema.additionalProperties; // 很多模型不喜欢这个

  if (newSchema.properties) {
    for (const key in newSchema.properties) {
      newSchema.properties[key] = cleanSchema(newSchema.properties[key]);
    }
  }
  if (newSchema.items) {
    newSchema.items = cleanSchema(newSchema.items);
  }
  if (newSchema.anyOf) {
    // 简化 anyOf，只取第一个或展开（此处仅演示简单清理）
    newSchema.anyOf = newSchema.anyOf.map((s: any) => cleanSchema(s));
  }
  return newSchema;
}

function toolDefinitionsToToolSet(
  toolDefinitions: Record<string, any>,
): ToolSet {
  return Object.fromEntries(
    Object.entries(toolDefinitions).map(([name, definition]) => [
      name,
      tool({
        ...definition,
        inputSchema: jsonSchema(cleanSchema(definition.inputSchema)),
        outputSchema: jsonSchema(cleanSchema(definition.outputSchema)),
      }),
    ]),
  );
}


// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

const ollama = createOllama({
  baseURL: 'http://localhost:11434',
});

export async function POST(req: Request) {
  const { messages, toolDefinitions } = await req.json();
  // console.log(">>> [Raw Messages From Frontend]", JSON.stringify(messages, null, 2));

  // 1. 注入上下文（合并到单条 User 消息中）
  const injectedMessages = injectDocumentStateMessages(messages);

  // 2. 转换为模型消息并平铺
  const modelMessages = (await convertToModelMessages(injectedMessages)).map(m => ({
    role: m.role,
    content: Array.isArray(m.content)
      ? m.content.map(c => (c.type === 'text' ? (c as any).text : '')).join('')
      : m.content
  })) as any;

  // console.log(">>> [Model Messages Sent]", JSON.stringify(modelMessages, null, 2));

  const result = streamText({
    model: ollama("gemma4:26b"),
    system: systemPrompt,
    messages: modelMessages,
    tools: toolDefinitionsToToolSet(toolDefinitions),
    toolChoice: "required", // 重新开启
    // onFinish: ({ text, toolCalls }) => {
    //   if (text) console.log(">>> [Model Final Text]", text);
    //   console.log(">>> [Model Tool Calls]", JSON.stringify(toolCalls, null, 2));
    // }
  });

  return result.toUIMessageStreamResponse();
}