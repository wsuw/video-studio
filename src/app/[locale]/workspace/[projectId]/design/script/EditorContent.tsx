"use client";

import { BlockNoteEditor } from "@blocknote/core";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import "@blocknote/core/fonts/inter.css";
import { en } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
  FormattingToolbar,
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import {
  AIExtension,
  AIMenuController,
  AIToolbarButton,
  getAISlashMenuItems,
} from "@blocknote/xl-ai";
import { en as aiEn } from "@blocknote/xl-ai/locales";
import "@blocknote/xl-ai/style.css";

import { useEffect, useCallback } from "react";
import { z } from "zod";
import { DefaultChatTransport } from "ai";
import { useFrontendTool, useConfigureSuggestions } from "@copilotkit/react-core/v2";
import { useParams } from "next/navigation";
import { updateThreadState, getThreadState } from "@/lib/langgraph";

// Formatting toolbar with the `AIToolbarButton` added
const FormattingToolbarWithAI = () => (
  <FormattingToolbar>
    {...getFormattingToolbarItems()}
    {/* Add the AI button */}
    <AIToolbarButton />
  </FormattingToolbar>
);

// Slash menu items with the AI option added
const getSlashMenuItemsWithAI = (editor: BlockNoteEditor<any, any, any>) => [
  ...getDefaultReactSlashMenuItems(editor),
  // add the default AI slash menu items, or define your own
  ...getAISlashMenuItems(editor),
];

export default function EditorContent() {
  const { projectId } = useParams();

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Generate Detailed Screenplay",
        message: "Write a complete, detailed production-ready screenplay based on the current creative concept, style, ratio, and voice. Adhere strictly to industry-standard screenplay specifications: include standard scene headings (formatted as '## SCENE [Number]: [INT/EXT]. [LOCATION] - [TIME_OF_DAY]'), descriptive action lines mapping out lighting, sound design, and character blocking, and character dialogues with speaker names in bold. Finally, render it directly in the editor using the renderScriptInEditor tool.",
      }
    ],
    available: "always"
  });

  // 1. 初始化编辑器 (完整配置)
  const editor = useCreateBlockNote({
    dictionary: {
      ...en,
      ai: aiEn,
    },
    extensions: [
      AIExtension({
        transport: new DefaultChatTransport({
          api: `/api/editor/ai`,
        }),
      }),
    ],
    initialContent: [
      {
        type: "heading",
        props: {
          level: 2,
        },
        content: "🎬 VideoStudio Screenplay Editor Guide",
      },
      {
        type: "paragraph",
        content: "Welcome to your professional-grade screenplay editor. Collaborate with AI using the following methods:",
      },
      {
        type: "bulletListItem",
        content: "Send instructions in the chat (e.g., 'Write a sci-fi opening') and the AI will update the script here in real-time.",
      },
      {
        type: "bulletListItem",
        content: "Type '/' to open the quick insert menu for scene headings, action lines, and other standard formats.",
      },
      {
        type: "bulletListItem",
        content: "Utilize standard Markdown shortcuts for a faster and more efficient creative workflow.",
      },
    ],
  });

  // 2. 封装手动保存函数
  const handleManualSave = useCallback(async () => {
    if (!projectId) return;
    try {
      const markdown = await editor.blocksToMarkdownLossy();
      console.log("正在手动同步剧本到后端 (路径: design.script)...");
      await updateThreadState(projectId as string, { design: { script: markdown } });
      console.log("✅ 剧本保存成功！");
    } catch (error) {
      console.error("❌ 手动保存失败:", error);
    }
  }, [projectId, editor]);

  // 3. 自动恢复状态 (仅在挂载时)
  useEffect(() => {
    async function loadSavedScript() {
      if (!projectId) return;
      try {
        const state = await getThreadState(projectId as string);
        const savedMarkdown = state?.values?.design?.script;
        if (savedMarkdown) {
          console.log("从后端恢复剧本内容...");
          const blocks = await editor.tryParseMarkdownToBlocks(savedMarkdown);
          editor.replaceBlocks(editor.document, blocks);
        }
      } catch (error) {
        console.warn("未发现历史剧本或拉取失败:", error);
      }
    }
    loadSavedScript();
  }, [projectId, editor]);

  // 4. 监听全局保存按钮事件
  useEffect(() => {
    const handleSaveEvent = () => handleManualSave();
    window.addEventListener("save-script-event", handleSaveEvent);
    return () => window.removeEventListener("save-script-event", handleSaveEvent);
  }, [handleManualSave]);

  // 5. 注册全能同步工具 (与后端 MASTER SYNC TOOL 保持一致)
  useFrontendTool({
    name: "renderScriptInEditor",
    description: "[SYSTEM CALL] Sync screenplay content and render it in the editor UI.",
    parameters: z.object({
      content: z.string().describe("The Markdown text of the screenplay."),
    }),
    handler: async ({ content }) => {
      console.log("正在原子化渲染并保存剧本...");
      try {
        const blocks = await editor.tryParseMarkdownToBlocks(content);
        editor.replaceBlocks(editor.document, blocks);
      } catch (e) {
        console.error("渲染剧本失败:", e);
      }
      return "Success. UI rendered. (Ensure updateScriptContent is called in parallel in this turn).";
    },
  }, [editor]);

  return (
    <div className="p-4 min-h-screen">
      <BlockNoteView
        editor={editor}
        formattingToolbar={false}
        slashMenu={false}
        style={{ paddingBottom: "300px" }}
      >
        <AIMenuController />
        <FormattingToolbarController formattingToolbar={FormattingToolbarWithAI} />
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(getSlashMenuItemsWithAI(editor), query)
          }
        />
      </BlockNoteView>
    </div>
  );
}
