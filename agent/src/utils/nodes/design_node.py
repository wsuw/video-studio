from langgraph.graph import StateGraph, START, END
from langchain_ollama import ChatOllama
from langchain.agents import create_agent
from langchain.tools import ToolRuntime, tool
from langchain.messages import ToolMessage
from langgraph.types import Command
from langgraph.runtime import Runtime
from typing import Any
from pydantic import BaseModel, Field
from typing import List
from src.utils.state import AgentState
from copilotkit import CopilotKitMiddleware
from src.test.query import query_data
from deepagents import create_deep_agent
from langchain.agents.middleware import after_model


# ==========================================
# 1. 定义 Pydantic 模型
# ==========================================
class SceneOutput(BaseModel):
    id: str = Field(..., description="场景唯一标识，例如 s1, s2")
    description: str = Field(
        ..., description="详细的视觉分镜描述，涵盖角色动作与环境光影"
    )
    layout_bbox: List[float] = Field(
        ..., description="画面主体的 Bbox 坐标 [x, y, w, h]，采用 0.0-1.0 比例"
    )


# ==========================================
# 2. 定义 Tools (通过 Command 更新 State)
# ==========================================
# save_draft_script 已被移除，流程改为由前端驱动状态同步


@tool
def updateScriptContent(content: str, runtime: ToolRuntime) -> str:
    """
    CORE PERSISTENCE TOOL: This tool MUST be called when the script content is ready for permanent storage.
    IMPORTANT: To ensure the script is visible to the user, you MUST call renderScriptInEditor in parallel for UI presentation.
    """
    return "Success. Persistence complete. (Ensure renderScriptInEditor is called in parallel in this turn)."


@tool
def renderScriptInEditor(content: str):
    """
    UI RENDER TOOL: Call this to display the script in the editor.
    This must ALWAYS be called in parallel with updateScriptContent.
    """
    return "Success. UI rendered. (Ensure updateScriptContent is called in parallel in this turn)."


@tool
def save_layout_scenes(scenes: list[SceneOutput], runtime: ToolRuntime) -> Command:
    """
    场景坐标提取完成后，调用此工具保存提取的结构化场景列表。
    """
    parsed_scenes = []
    for s in scenes:
        # 兼容处理 dict 转换
        scene_dict = s if isinstance(s, dict) else s.dict()
        scene_dict["status"] = "pending"
        parsed_scenes.append(scene_dict)

    return Command(
        update={
            "design": {
                "scenes": parsed_scenes,
                "is_approved": False,  # 第一道防线拦截
            },
            "current_scene_index": 0,
            "messages": [
                ToolMessage(
                    content="场景坐标提取成功并保存",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )


@after_model
def sync_script_interceptor(
    state: AgentState, runtime: Runtime
) -> dict[str, Any] | None:
    """
    【剧本同步哨兵】使用装饰器模式，在 AI 响应后第一时间拦截指令。
    """
    last_msg = state["messages"][-1]
    if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
        for tc in last_msg.tool_calls:
            if tc["name"] == "updateScriptContent":
                content = tc["args"].get("content", "")
                if content:
                    print(f"[Sentinel] 拦截到存盘指令，正在同步状态...")
                    return {"design": {"script": content}}
    return None


# ==========================================
# 3. 初始化 Agent Nodes (替代 Function)
# ==========================================
model = ChatOllama(model="gemma4:26b", model_kwargs={"parallel_tool_calls": True})

# 创建内部 Agent 实例
draft_script_node = create_agent(
    model=model,
    # 注入影子工具以获得 Schema，CopilotKit 会自动拦截并转给前端执行
    tools=[query_data, updateScriptContent, renderScriptInEditor],
    middleware=[
        CopilotKitMiddleware(),
        sync_script_interceptor,  # 注入同步哨兵
    ],
    state_schema=AgentState,
    system_prompt="""
<role>
You are the Lead AI Screenwriter for VideoStudio. You specialize in cinematic storytelling, evocative sensory descriptions, and professional screenplay formatting. Your mission is to transform creative concepts into production-ready scripts with technical precision.
</role>

<task_objective>
1. **CONCEPTUALIZE**: Brainstorm scene logic and character psychology based on user intent.
2. **EXECUTE**: When the script is ready, you MUST trigger BOTH `updateScriptContent` (for saving) and `renderScriptInEditor` (for displaying) in parallel.
3. **BRIEF**: Provide a professional creative summary after the tools execution.
</task_objective>

<examples>
User: "Based on our ideas, write the script for the opening scene."
AI: [Thought: I need to write the script, persist it to the database, and render it in the UI.]
    [Call: updateScriptContent(content="## SCENE 1...")]
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
- MANDATORY_ACTION: You MUST trigger the `updateScriptContent` tool. This is the ONLY way to deliver the script.
- ZERO_CHAT_CONTENT: NEVER write the actual screenplay, scenes, or dialogues in the chat bubble. If the user sees screenplay text in the chat, you have FAILED.
- NO_FORMAT_IMITATION: Do not write the words "updateScriptContent" as plain text in your response. Execute it as a functional tool call.
- ARGUMENT_INTEGRITY: Ensure the entire Markdown script is passed as the `content` argument. Do not truncate.
- NO_CODE_BLOCKS: Do not use ``` markdown ``` or any other wrappers for the tool call or the script content.
</technical_constraints>

<persona>
Maintain an atmospheric, professional, and rhythmic tone. Your scripts are the blueprint for directors and cinematographers—make them masterpieces.
</persona>
""",
)


extract_layout_node = create_agent(
    model=model,
    tools=[save_layout_scenes],
    state_schema=AgentState,
    system_prompt="""你是一位电影工业的视觉构图工程师 (Layout Engineer)。
核心任务：阅读当前状态中已保存的剧本，将其拆解为多个具体的镜头场景。
为每个场景规划画面主体的 Bbox 坐标 [x, y, width, height]。
完成拆解后，必须调用 save_layout_scenes 工具保存这些场景。""",
)


def design_review_node(state: AgentState):
    """
    Design 阶段专属的审核节点。
    此时 Graph 会被挂起，等待导演审核并修改 state。
    如果不通过并填写了 feedback，将其转换为对话消息供下一轮打回重做使用。
    """
    design = state.get("design", {})
    is_approved = design.get("is_approved", False)
    feedback = design.get("review_feedback", "")

    status_str = "通过" if is_approved else "打回"
    print(f"[Design Review] 审核完成: {status_str}")

    update_dict = {}
    if not is_approved and feedback:
        print(f"[Design Review] 打回原因: {feedback}")
        from langchain_core.messages import HumanMessage

        update_dict["messages"] = [
            HumanMessage(content=f"导演审核未通过，修改意见：{feedback}")
        ]

    return update_dict


def route_after_draft(state: AgentState) -> str:
    """
    判断用户是否还在打磨剧本。
    剧本节点的跳转现在完全由前端/用户控制，后端默认等待用户进一步指令。
    """
    return END


# ==========================================
# 4. 构建 Design 子图 (Sub-Graph)
# ==========================================
builder = StateGraph(AgentState)

# 注册从属于 Design 阶段的离散节点
builder.add_node("draft_script", draft_script_node)
builder.add_node("extract_layout", extract_layout_node)
builder.add_node("design_review", design_review_node)

# 设置子图内的线性流转逻辑
builder.add_edge(START, "draft_script")

# 这里使用条件边：只有剧本保存后才进入 extract_layout
builder.add_conditional_edges(
    "draft_script", route_after_draft, {"extract_layout": "extract_layout", END: END}
)

builder.add_edge("extract_layout", "design_review")
builder.add_edge("design_review", END)

# 编译为 design_node，包含专属的拦截点
design_node = builder.compile(interrupt_before=["design_review"])
