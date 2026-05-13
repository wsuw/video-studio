from langgraph.graph import StateGraph, START, END
from langchain_ollama import ChatOllama
from langchain.agents import create_agent
from langchain.tools import ToolRuntime, tool
from langchain.messages import ToolMessage
from langgraph.types import Command
from pydantic import BaseModel, Field
from typing import List
from src.utils.state import AgentState
from copilotkit import CopilotKitMiddleware, StateStreamingMiddleware, StateItem


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
@tool
def save_draft_script(script: str, runtime: ToolRuntime) -> Command:
    """
    当且仅当剧本文学演进完成，且用户确认无误时，调用此工具保存生成的剧本。
    """
    return Command(
        update={
            "design": {"script": script},
            "messages": [
                ToolMessage(
                    content="剧本已成功保存到状态中",
                    name="save_draft_script",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )


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


# ==========================================
# 3. 初始化 Agent Nodes (替代 Function)
# ==========================================
model = ChatOllama(model="gemma4:26b", model_kwargs={"parallel_tool_calls": False})

draft_script_node = create_agent(
    model=model,
    tools=[save_draft_script],
    middleware=[
        CopilotKitMiddleware(),
        StateStreamingMiddleware(
            StateItem(state_key="todos", tool="manage_todos", tool_argument="todos")
        ),
    ],
    state_schema=AgentState,
    system_prompt="""你是一位顶级的电影编剧。
核心任务：根据用户的需求，逐步扩写剧本（Logline -> Synopsis -> Locked Script）。
注意：如果用户还在思考、讨论阶段，请直接回复，**不要调用工具**。
当且仅当剧本已经打磨完成，或者用户明确表示确认/定稿时，必须调用 save_draft_script 工具将纯文本剧本保存起来。""",
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
    如果在这一轮对话中，Agent 没有调用 save_draft_script 工具，
    说明剧本还在讨论中，直接结束 Graph 等待用户回复。
    """
    messages = state.get("messages", [])

    # 从后往前找，直到碰到上一次用户的输入
    for msg in reversed(messages):
        if msg.type == "human":
            break
        # 如果发现了保存剧本的动作，说明剧本定稿，可以前往提取分镜
        if msg.type == "tool" and getattr(msg, "name", "") == "save_draft_script":
            return "extract_layout"

    # 没有找到保存动作，说明还在聊天打磨
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
