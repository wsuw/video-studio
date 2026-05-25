from src.models import get_model
from typing import Any

from langchain.agents import create_agent
from langchain.tools import tool
from langgraph.runtime import Runtime
from src.state import AgentState
from copilotkit import CopilotKitMiddleware
from langchain.agents.middleware import before_model, after_model
from langchain_core.messages import SystemMessage


# ==========================================
# 1. Define Tools
# ==========================================
@tool
def renderScriptInEditor(content: str):
    """
    UI RENDER & PERSISTENCE TOOL: Call this to display the script in the editor and permanently persist it.
    """
    return "Success. UI rendered and script successfully persisted."


# ==========================================
# 2. Sync Interceptor (Middleware)
# ==========================================
@after_model
def sync_script_interceptor(
    state: AgentState, runtime: Runtime
) -> dict[str, Any] | None:
    """
    [Script Sync Sentinel] Intercepts the renderScriptInEditor tool call immediately after the AI response,
    extracting the script content and saving it to the Graph State.
    """
    last_msg = state["messages"][-1]
    if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
        for tc in last_msg.tool_calls:
            if tc["name"] == "renderScriptInEditor":
                content = tc["args"].get("content", "")
                if content:
                    print(
                        f"[Script Sync Sentinel] 💾 Intercepted renderScriptInEditor. Persisting script ({len(content)} chars) to Graph State."
                    )
                    return {"design": {"script": content}}
    return None


# ==========================================
# 3. Dynamic Prompt Injection (Middleware)
# ==========================================
# 3. Dynamic Prompt Injection (Middleware)
# ==========================================
@before_model
def inject_dynamic_prompt(state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
    """
    [Dynamic Context Sentinel] Injects the complete combined system prompt (static + dynamic screenplay script)
    into the conversation messages history prior to calling the LLM.
    """
    design = state.get("design", {}) or {}
    script = design.get("script", "")
    existing_script_block = (
        script
        if script
        else "None (No screenplay script written yet — this is a fresh start)"
    )

    content = f"""<role>
You are the Lead AI Screenwriter for VideoStudio. You specialize in cinematic storytelling, evocative sensory descriptions, and professional screenplay formatting. Your mission is to transform creative concepts into production-ready scripts with technical precision.
</role>

<current_script>
{existing_script_block}
</current_script>

<task_objective>
1. **CONCEPTUALIZE**: Brainstorm scene logic and character psychology based on user intent. Always reference the `<current_script>` context above if it contains content — build upon and refine it rather than starting from scratch.
2. **EXECUTE**: When the script is ready, you MUST trigger the `renderScriptInEditor` tool to display and persist the script.
3. **BRIEF**: Provide a professional creative summary after the tool execution.
</task_objective>

<examples>
User: "Based on our ideas, write the script for the opening scene."
AI: [Thought: I need to write the script, render it in the UI and persist it to the database.]
    [Call: renderScriptInEditor(content="## SCENE 1...")]
    "I've drafted the opening scene. You can see it in the editor."
</examples>

<screenplay_guidelines>
- FORMAT: Use standard Markdown for the script.
- SCENE HEADINGS: Use H2 (e.g., ## SCENE 1: THE LABORATORY - NIGHT).
- ACTION LINES: Describe lighting, sound (SFX), and movement with sensory granularity. Show, don't tell.
- CHARACTER DIALOGUE: Bold the speaker's name (e.g., **LIN**: This is impossible.).
</screenplay_guidelines>

<technical_constraints>
- CONTEXT_FIRST: Always read the `<current_script>` block above before writing. If it contains content, use it as your foundation.
- MANDATORY_ACTION: You MUST trigger the `renderScriptInEditor` tool. This is the ONLY way to deliver the script.
- ZERO_CHAT_CONTENT: NEVER write the actual screenplay, scenes, or dialogues in the chat bubble. If the user sees screenplay text in the chat, you have FAILED.
- NO_FORMAT_IMITATION: Do not write the words "renderScriptInEditor" as plain text in your response. Execute it as a functional tool call.
- ARGUMENT_INTEGRITY: Ensure the entire Markdown script is passed as the `content` argument. Do not truncate.
- NO_CODE_BLOCKS: Do not use ``` markdown ``` or any other wrappers for the tool call or the script content.
</technical_constraints>

<persona>
Maintain an atmospheric, professional, and rhythmic tone. Your scripts are the blueprint for directors and cinematographers—make them masterpieces.
</persona>
"""
    # We use a stable ID "dynamic_prompt_context" to allow the add_messages reducer
    # to update this context in-place.
    context_msg = SystemMessage(content=content, id="dynamic_prompt_context")

    # 获取当前消息列表的副本
    current_messages = list(state.get("messages", []))

    # 构建新列表：先过滤旧的，再插入新的到最前面
    new_messages = [context_msg] + [
        m
        for m in current_messages
        if getattr(m, "id", None) != "dynamic_prompt_context"
    ]

    # 通过返回字典，让 LangGraph 框架负责将新消息合并回状态
    return {"messages": new_messages}


# ==========================================
# 4. Export Agent as Node
# ==========================================
model = get_model(parallel_tool_calls=False)

design_node = create_agent(
    model=model,
    # 注入影子工具以获得 Schema，CopilotKit 会自动拦截并转给前端执行并保存
    tools=[renderScriptInEditor],
    middleware=[
        CopilotKitMiddleware(),
        inject_dynamic_prompt,
        sync_script_interceptor,
    ],
    state_schema=AgentState,
    system_prompt="",
)
