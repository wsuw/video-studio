from langchain_ollama import ChatOllama
from langchain.tools import tool
from langchain.messages import ToolMessage
from langgraph.types import Command
from langgraph.runtime import Runtime
from pydantic import BaseModel, Field
from src.utils.state import AgentState, Phase
from langchain.agents import create_agent
from copilotkit import CopilotKitMiddleware


# ==========================================
# 1. Define Pydantic Models
# ==========================================
class BreakdownScene(BaseModel):
    id: str = Field(..., description="Unique ID, e.g., s1, s2")
    description: str = Field(..., description="Narrative description of what happens in this scene/shot.")

# ==========================================
# 2. Define Tools
# ==========================================
@tool
def save_script_breakdown(scenes: list[BreakdownScene], runtime: Runtime) -> Command:
    """
    Call this tool to save the textual breakdown of the script into scenes. 
    This is the first step before visual storyboarding.
    """
    parsed_scenes = []
    for s in scenes:
        scene_dict = s if isinstance(s, dict) else s.dict()
        scene_dict["status"] = "pending"
        scene_dict["layout_bbox"] = [0.25, 0.25, 0.5, 0.5] # Default center crop
        parsed_scenes.append(scene_dict)

    return Command(
        update={
            "design": {
                "scenes": parsed_scenes,
                "is_approved": False,
            },
            "next_agent": Phase.END,
            "messages": [
                ToolMessage(
                    content="Script breakdown successfully saved. Waiting for director approval.",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )

# ==========================================
# 3. Define Director Agent
# ==========================================
model = ChatOllama(model="gemma4:26b", model_kwargs={"parallel_tool_calls": True})

director_node = create_agent(
    model=model,
    tools=[save_script_breakdown],
    middleware=[
        CopilotKitMiddleware(),
    ],
    state_schema=AgentState,
    system_prompt="""You are the Film Director (Director Node). 
Your mission is to read the script and perform a 'Scene Breakdown'.
1. Identify the key visual beats and shots required to tell the story.
2. For each shot, provide a vivid narrative description.
3. Use the save_script_breakdown tool to deliver the result.
Do NOT worry about camera coordinates or Bboxes yet; focus on the storytelling and shot selection.""",
)
