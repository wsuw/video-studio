from typing import TypedDict, Literal, Annotated, Optional
from enum import Enum
from langchain.agents import AgentState as BaseAgentState
from copilotkit import CopilotKitState


class Phase(str, Enum):
    INIT = ""
    DESIGN = "design"
    BREAKDOWN = "breakdown"
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


class Entity(TypedDict):
    id: str
    name: str
    type: Literal["character", "prop", "location"]
    description: str
    visual_reference: Optional[str]  # Master Portrait reference (GCM)


class Scene(TypedDict):
    id: str
    description: str
    entities: list[str]  # IDs of entities present in this scene
    layout_bbox: list[float]  # [x, y, w, h]
    status: Literal["pending", "locked", "rendered"]


def merge_dict(a: dict, b: dict) -> dict:
    """Reducer: 合并嵌套的字典而不是覆盖"""
    if a is None:
        return b.copy()
    c = a.copy()
    c.update(b)
    return c


class RawScene(TypedDict):
    id: str
    description: str


class DesignState(TypedDict, total=False):
    script: str  # 剧本内容
    entities: list[Entity]  # 分子级实体提取 (Characters, Props, Locations)
    raw_scenes: list[RawScene]  # 拆解阶段仅文字描述的场景
    scenes: list[Scene]  # 结构化场景与 Bbox 规划
    is_approved: bool  # 导演审核状态 (HITL)
    review_feedback: str  # 不满意时的修改意见


class AgentState(BaseAgentState, CopilotKitState):
    todos: list[Todo]

    # 按照模块聚拢的设计阶段状态 (带有合并策略，防止部分更新时丢失数据)
    design: Annotated[DesignState, merge_dict]

    current_scene_index: int
    qc_report: str  # 质检结果
    current_phase: Phase  # 当前阶段标识（前端手动设置）
    previous_phase: Optional[Phase]  # supervisor 用于检测阶段切换
