from typing import TypedDict, Literal, Annotated
from enum import Enum
from langchain.agents import AgentState as BaseAgentState
from copilotkit import CopilotKitState


class Phase(str, Enum):
    INIT = ""
    DESIGN = "design"
    STORYBOARD = "storyboard"
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


def merge_dict(a: dict, b: dict) -> dict:
    """Reducer: 合并嵌套的字典而不是覆盖"""
    if a is None:
        return b.copy()
    c = a.copy()
    c.update(b)
    return c


class DesignState(TypedDict, total=False):
    script: str  # 剧本内容
    scenes: list[Scene]  # 结构化场景
    is_approved: bool  # 导演审核状态
    review_feedback: str  # 不满意时的修改意见


class AgentState(BaseAgentState, CopilotKitState):
    todos: list[Todo]

    # 按照模块聚拢的设计阶段状态 (带有合并策略，防止部分更新时丢失数据)
    design: Annotated[DesignState, merge_dict]

    current_scene_index: int
    qc_report: str  # 质检结果
    current_phase: Phase  # 当前阶段标识
    next_agent: Phase  # 下一步要调用的 agent
