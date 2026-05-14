import { createOllama } from 'ai-sdk-ollama';
import { convertToModelMessages, JSONSchema7, jsonSchema, streamText, tool, ToolSet, UIMessage } from "ai";
import {
  DocumentState,
} from "@blocknote/xl-ai/server";


const systemPrompt = `You're manipulating a text document using JSON blocks. 
Make sure to follow the json schema provided. When referencing ids they MUST be EXACTLY the same (including the trailing $). 

If the user requests updates to the document, use the "applyDocumentOperations" tool to update the document.
---
IF there is no selection active in the latest state, first, determine what part of the document the user is talking about. You SHOULD probably take cursor info into account if needed.
  EXAMPLE: if user says "below" (without pointing to a specific part of the document) he / she probably indicates the block(s) after the cursor. 
  EXAMPLE: If you want to insert content AT the cursor position (UNLESS indicated otherwise by the user), then you need \`referenceId\` to point to the block before the cursor with position \`after\` (or block below and \`before\`
---
 `;


function injectDocumentStateMessages(
  messages: UIMessage[],
): UIMessage[] {
  return messages.flatMap((message) => {
    if (message.role === "user" && (message.metadata as any)?.documentState) {
      const documentState = (message.metadata as any)
        .documentState as DocumentState<any>;

      return [
        {
          role: "assistant",
          id: "assistant-document-state-" + message.id,
          parts: [
            ...(documentState.selection
              ? [
                {
                  type: "text" as const,
                  text: `This is the latest state of the selection (ignore previous selections, you MUST issue operations against this latest version of the selection):`,
                },
                {
                  type: "text" as const,
                  text: JSON.stringify(documentState.selectedBlocks),
                },
                {
                  type: "text" as const,
                  text: `This is the latest state of the entire document (INCLUDING the selected text), 
you can use this to find the selected text to understand the context (but you MUST NOT issue operations against this document, you MUST issue operations against the selection):`,
                },
                {
                  type: "text" as const,
                  text: JSON.stringify(documentState.blocks),
                },
              ]
              : [
                {
                  type: "text" as const,
                  text:
                    `There is no active selection. This is the latest state of the document (ignore previous documents, you MUST issue operations against this latest version of the document). 
The cursor is BETWEEN two blocks as indicated by cursor: true.
` +
                    (documentState.isEmptyDocument
                      ? `Because the document is empty, YOU MUST first update the empty block before adding new blocks.`
                      : "Prefer updating existing blocks over removing and adding (but this also depends on the user's question)."),
                },
                {
                  type: "text" as const,
                  text: JSON.stringify(documentState.blocks),
                },
              ]),
            // Alternatively, we could explore using dynamic tools to fake document state retrieval:
            // {
            //   type: "dynamic-tool",
            //   toolName: "getDocument",
            //   input: {},
            //   output: documentState.htmlBlocks,
            //   state: "output-available",
            //   toolCallId: "getDocument-" + message.id,
            // },
            // {
            //   type: "dynamic-tool",
            //   toolName: "getDocumentSelection",
            //   input: {},
            //   output: documentState.selection
            //     ? documentState.htmlSelectedBlocks
            //     : "no selection active",
            //   state: "output-available",
            //   toolCallId: "getDocument-" + message.id,
            // },
          ],
        },
        message,
      ];
    }
    return [message];
  });
}
/**
   * A serializable version of a Tool
   */
type ToolDefinition = { description?: string; inputSchema: JSONSchema7; outputSchema: JSONSchema7; };
type ToolDefinitions = Record<string, ToolDefinition>;


function toolDefinitionsToToolSet(
  toolDefinitions: ToolDefinitions,
): ToolSet {
  return Object.fromEntries(
    Object.entries(toolDefinitions).map(([name, definition]) => [
      name,
      tool({
        ...definition,
        inputSchema: jsonSchema(definition.inputSchema),
        outputSchema: jsonSchema(definition.outputSchema),
      }),
    ]),
  );
}


// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const ollama = createOllama({
  // optional settings, e.g.
  baseURL: 'http://localhost:11434',
});

export async function POST(req: Request) {
  const { messages, toolDefinitions } = await req.json();
  console.log("Messages received:", JSON.stringify(messages, null, 2));
  console.log("Tool definitions received:", JSON.stringify(toolDefinitions, null, 2));
  const modelMessages = await convertToModelMessages(
    injectDocumentStateMessages(messages),
  );
  console.log("Model messages:", JSON.stringify(modelMessages));

  const result = streamText({
    model: ollama("gemma4:26b"), // see https://ai-sdk.dev/docs/foundations/providers-and-models
    system: systemPrompt,
    messages: await convertToModelMessages(
      injectDocumentStateMessages(messages),
    ),
    tools: toolDefinitionsToToolSet(toolDefinitions),
    toolChoice: "required",
    onFinish: ({ text, toolCalls }) => {
      console.log("=== Model Response Start ===");
      if (text) console.log("Text:", text);
      if (toolCalls && toolCalls.length > 0) {
        console.log("Tool Calls:", JSON.stringify(toolCalls, null, 2));
      }
      console.log("=== Model Response End ===");
    },
  });

  return result.toUIMessageStreamResponse();
}