from typing import TypedDict, Literal
from enum import Enum
from langchain.agents import AgentState as BaseAgentState
from copilotkit import CopilotKitState


class Phase(str, Enum):
    INIT = ""
    DESIGN = "design"
    GENERATE = "generate"
    REDESIGN = "redesign"
    END = "__end__"


class Todo(TypedDict):
    id: str
    title: str
    description: str
    emoji: str
    status: Literal["pending", "completed"]


class Scene(TypedDict):
    id: str
    description: str
    layout_bbox: list[float]  # [x, y, w, h]
    status: Literal["pending", "locked", "rendered"]


class AgentState(BaseAgentState, CopilotKitState):
    todos: list[Todo]
    script: str  # 剧本内容
    scenes: list[Scene]  # 结构化场景
    current_scene_index: int
    qc_report: str  # 质检结果
    is_approved: bool  # 导演审核状态
    current_phase: Phase  # 当前阶段标识
    next_agent: Phase  # 下一步要调用的 agent
