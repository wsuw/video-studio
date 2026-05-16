import json
from typing import Any
from langchain.tools import tool, ToolRuntime
from langgraph.runtime import Runtime
from src.utils.state import AgentState, Phase
from langchain.agents import create_agent
from copilotkit import CopilotKitMiddleware
from langchain.agents.middleware import after_model
from langchain_ollama import ChatOllama


# ==========================================
# 1. Define Tools
# ==========================================
@tool
def submit_storyboard(storyboard_json: str, runtime: ToolRuntime):
    """Submit the fully planned storyboard.
    Expected JSON structure:
    {
        "scenes": [
            {
                "id": "s1",
                "description": "…",
                "entities": ["c1", "p3"],
                "layout_bbox": [0.1, 0.2, 0.6, 0.8],
                "status": "pending"
            }
        ]
    }
    """
    return "Storyboard submitted. Ready for generation."


# ==========================================
# 2. Sync Interceptor (Middleware)
# ==========================================
@after_model
def sync_storyboard_interceptor(
    state: AgentState, runtime: Runtime
) -> dict[str, Any] | None:
    """Intercept submit_storyboard calls and write full scenes into design state."""
    last_msg = state["messages"][-1]
    if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
        for tc in last_msg.tool_calls:
            if tc["name"] == "submit_storyboard":
                try:
                    data = json.loads(tc["args"].get("storyboard_json", "{}"))
                    return {
                        "design": {
                            "scenes": data.get("scenes", []),
                            "is_approved": False,
                        },
                    }
                except Exception as e:
                    print(f"Error parsing storyboard JSON: {e}")
    return None


# ==========================================
# 3. Define Storyboard Agent
# ==========================================
model = ChatOllama(model="gemma4:26b", model_kwargs={"parallel_tool_calls": True})

storyboard_node = create_agent(
    model=model,
    tools=[submit_storyboard],
    middleware=[
        CopilotKitMiddleware(),
        sync_storyboard_interceptor,
    ],
    state_schema=AgentState,
    system_prompt="""
<role>
You are the Storyboard Artist. Your job is to take the raw scene descriptions (provided by the Breakdown stage) and turn them into fully planned storyboard entries.
</role>

<workflow>
1. For each raw scene, decide which entities appear (character, prop, location).
2. Generate a bounding‑box `[x, y, w, h]` (normalized 0‑1) that indicates where the main subject should be placed.
3. Assemble a JSON payload matching the `submit_storyboard` tool schema and call the tool.
</workflow>

<technical_requirements>
- You MUST call `submit_storyboard` exactly once with a JSON string containing a `scenes` array.
- Do NOT output raw JSON in the chat; use the tool.
</technical_requirements>
""",
)
