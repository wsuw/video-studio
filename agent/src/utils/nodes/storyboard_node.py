from langgraph.graph import END
from langchain_ollama import ChatOllama
from langchain.agents import tool
from langchain.messages import ToolMessage
from langgraph.types import Command
from langgraph.runtime import Runtime
from pydantic import BaseModel, Field
from typing import List
from src.utils.state import AgentState, Phase
from deepagents import create_deep_agent


# ==========================================
# 1. Define Pydantic Models
# ==========================================
class SceneOutput(BaseModel):
    id: str = Field(..., description="Unique identifier for the scene, e.g., s1, s2")
    description: str = Field(
        ...,
        description="Detailed visual description of the scene, covering character actions and environmental lighting/shadows",
    )
    layout_bbox: List[float] = Field(
        ...,
        description="Bbox coordinates [x, y, w, h] of the main subject, using 0.0-1.0 scale",
    )


# ==========================================
# 2. Define Tools
# ==========================================
@tool
def save_layout_scenes(scenes: list[SceneOutput], runtime: Runtime) -> Command:
    """
    Call this tool to save the list of scenes after storyboard decomposition is complete.
    """
    parsed_scenes = []
    for s in scenes:
        scene_dict = s if isinstance(s, dict) else s.dict()
        scene_dict["status"] = "pending"
        parsed_scenes.append(scene_dict)

    return Command(
        update={
            "design": {
                "scenes": parsed_scenes,
                "is_approved": False,
            },
            "current_scene_index": 0,
            "next_agent": Phase.END,  # Hand back control upon completion
            "messages": [
                ToolMessage(
                    content="Storyboard successfully decomposed and saved",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )


# ==========================================
# 3. Define Storyboard Agent
# ==========================================
model = ChatOllama(model="qwen2.5:14b", temperature=0)

storyboard_agent = create_deep_agent(
    model=model,
    tools=[save_layout_scenes],
    state_schema=AgentState,
    system_prompt="""You are a Visual Composition Engineer (Layout Engineer) in the film industry.
Your sole mission is: Read the script content in the current state and precisely decompose it into multiple visual storyboards.
Requirements:
1. Each storyboard must have a detailed visual description.
2. You must plan the Bbox coordinates [x, y, w, h] for the main subject in each storyboard.
3. Upon completion, you MUST call the save_layout_scenes tool to save the results.""",
)


def storyboard_node(state: AgentState):
    """Storyboard node entry point"""
    return storyboard_agent.invoke(state)
