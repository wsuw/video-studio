import { createOllama } from 'ai-sdk-ollama';
import { createOpenAI } from '@ai-sdk/openai';
import { convertToModelMessages, JSONSchema7, jsonSchema, streamText, tool, ToolSet, UIMessage } from "ai";
import {
  DocumentState,
} from "@blocknote/xl-ai/server";


const systemPrompt = `You are a professional assistant manipulating a text document using HTML blocks.

CRITICAL INSTRUCTIONS:
1. You MUST ALWAYS call the "applyDocumentOperations" tool to make any modifications, edits, additions, deletions, or updates to the document. Do NOT simply write a text response explaining the changes; YOU MUST INVOKE THE TOOL.
2. When referencing block IDs, they MUST be EXACTLY the same as in the provided document state (including any trailing $).
3. If there is no selection active in the latest state, first determine what part of the document the user is talking about based on the context and focus.
4. Prefer updating existing blocks over removing and adding.
5. The "block" field in update operations MUST be a single valid HTML element (e.g., <p>Content</p>).
6. DO NOT output raw tool calling tags like "<tool_call_begin>", "<tool_sep>", or "<tool_call_end>" in your plain text response. You must use the native tool/function calling mechanism provided.
7. DO NOT wrap JSON operations in markdown blocks or text blocks. The tool call MUST be executed natively.

YOU MUST CALL THE "applyDocumentOperations" TOOL. NO EXCEPTIONS.`;


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
        combinedContent += `### CURSOR POSITION\nNo selection. Cursor is ${(documentState as any).cursor ? "AT" : "BETWEEN"} a block.\n\n`;
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
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
});

// Configure DeepSeek API client (OpenAI-compatible)
const deepseek = createOpenAI({
  baseURL: process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

// Configure OpenRouter API client (OpenAI-compatible)
const openrouter = createOpenAI({
  baseURL: process.env.OPENROUTER_API_BASE || 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Configure SiliconFlow API client (OpenAI-compatible)
const siliconflow = createOpenAI({
  baseURL: process.env.SILICONFLOW_API_BASE || 'https://api.siliconflow.cn/v1',
  apiKey: process.env.SILICONFLOW_API_KEY,
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

  // 3. Determine LLM provider & model dynamically based on LLM_PROVIDER
  let modelInstance;
  const provider = (process.env.LLM_PROVIDER || '').toLowerCase();

  if (provider === 'deepseek' && process.env.DEEPSEEK_API_KEY) {
    const deepseekModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    modelInstance = deepseek(deepseekModel);
    console.log(`>>> [Editor AI] Routing to Direct DeepSeek API: ${deepseekModel}`);
  } else if (provider === 'openrouter' && process.env.OPENROUTER_API_KEY) {
    // If using OpenRouter, route to a DeepSeek model (default: deepseek/deepseek-chat)
    const openrouterModel = process.env.DEEPSEEK_MODEL?.includes('/') 
      ? process.env.DEEPSEEK_MODEL 
      : 'deepseek/deepseek-chat';
    modelInstance = openrouter(openrouterModel);
    console.log(`>>> [Editor AI] Routing to DeepSeek via OpenRouter: ${openrouterModel}`);
  } else if (provider === 'siliconflow' && process.env.SILICONFLOW_API_KEY) {
    const siliconflowModel = process.env.DEEPSEEK_MODEL || 'deepseek-ai/DeepSeek-V3';
    modelInstance = siliconflow(siliconflowModel);
    console.log(`>>> [Editor AI] Routing to DeepSeek via SiliconFlow: ${siliconflowModel}`);
  } else {
    // Fallback order: Direct DeepSeek API -> DeepSeek via OpenRouter -> SiliconFlow -> Local Ollama
    if (process.env.DEEPSEEK_API_KEY) {
      const deepseekModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
      modelInstance = deepseek(deepseekModel);
      console.log(`>>> [Editor AI] Routing to Direct DeepSeek API (Fallback): ${deepseekModel}`);
    } else if (process.env.OPENROUTER_API_KEY) {
      const openrouterModel = 'deepseek/deepseek-chat';
      modelInstance = openrouter(openrouterModel);
      console.log(`>>> [Editor AI] Routing to DeepSeek via OpenRouter (Fallback): ${openrouterModel}`);
    } else if (process.env.SILICONFLOW_API_KEY) {
      const siliconflowModel = 'deepseek-ai/DeepSeek-V3';
      modelInstance = siliconflow(siliconflowModel);
      console.log(`>>> [Editor AI] Routing to DeepSeek via SiliconFlow (Fallback): ${siliconflowModel}`);
    } else {
      const ollamaModel = process.env.OLLAMA_MODEL || 'gemma4:26b';
      modelInstance = ollama(ollamaModel);
      console.log(`>>> [Editor AI] Routing to Local Ollama: ${ollamaModel}`);
    }
  }

  // For OpenRouter, 'required' toolChoice triggers buggy gateway simulation prompt injection
  // which leaks raw tags like <tool_call_begin>. Using 'auto' avoids this and uses native tool calling.
  // For other providers (like Ollama or Direct APIs), we keep 'required' to guarantee a tool call.
  const resolvedToolChoice = (provider === 'openrouter') ? 'auto' : 'required';

  const result = streamText({
    model: modelInstance,
    system: systemPrompt,
    messages: modelMessages,
    tools: toolDefinitionsToToolSet(toolDefinitions),
    toolChoice: resolvedToolChoice,
    onFinish: ({ text, toolCalls }) => {
      if (text) console.log(">>> [Model Final Text]", text);
      console.log(">>> [Model Tool Calls]", JSON.stringify(toolCalls, null, 2));
    }
  });

  return result.toUIMessageStreamResponse();
}