from typing import TypedDict, Literal, Annotated, Optional
from enum import Enum
from pydantic import BaseModel, Field
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


class Entity(BaseModel):
    id: str = Field(description="Unique ID for the entity (e.g., e1, e2)")
    name: str = Field(description="Name of the character, prop, or location")
    type: Literal["character", "prop", "location"] = Field(description="Type of the entity")
    description: str = Field(description="Detailed visual description or role of the entity")
    visual_reference: Optional[str] = Field(None, description="Visual reference path/URL if any")


class LayoutElement(BaseModel):
    entity_id: str = Field(description="ID of the bound entity (e.g., e1, e2) being positioned")
    bbox: list[float] = Field(description="Normalized bounding box [x, y, w, h] (0.0 to 1.0) for this specific entity")


class Scene(BaseModel):
    id: str = Field(description="Unique scene ID (e.g., s1, s2)")
    description: str = Field(description="Detailed narrative and cinematic visual description for this shot")
    entities: list[str] = Field(default=[], description="List of Entity IDs (e.g. e1, e2) appearing in this scene")
    layout_bbox: list[float] = Field(default=[], description="Legacy normalized composition bounding box [x, y, w, h] (0.0 to 1.0)")
    layout: list[LayoutElement] = Field(default=[], description="List of layout elements mapping specific entities to their own non-overlapping physical bounding boxes")
    status: Literal["pending", "locked", "rendered"] = Field("pending", description="Production status of this scene")
    lens: str = Field(default="50mm", description="Shot-specific camera lens focal length (e.g., 24mm, 50mm, 85mm)")
    shot_type: str = Field(default="medium", description="Shot type/framing (e.g., wide, medium, close-up)")
    motion: str = Field(default="static", description="Camera motion/movement (e.g., static, pan, tilt, zoom-in, zoom-out)")


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
