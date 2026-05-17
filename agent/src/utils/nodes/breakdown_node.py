import json
from typing import Any, Annotated
from langchain.tools import tool, ToolRuntime
from langgraph.prebuilt import InjectedState
from langgraph.runtime import Runtime
from src.utils.state import AgentState
from langchain.agents import create_agent
from copilotkit import CopilotKitMiddleware
from langchain.agents.middleware import after_model
from langchain_ollama import ChatOllama


# ==========================================
# 1. Define Tools
# ==========================================
@tool
def submit_breakdown(breakdown_json: str, runtime: ToolRuntime):
    """
    INDUSTRIAL TOOL: Call this to submit the final structural breakdown.
    The breakdown_json must include 'entities' and 'scenes' (with Bboxes).
    """
    return "Breakdown submitted. Awaiting sync and HITL approval."


# ==========================================
# 2. Sync Interceptor (Middleware)
# ==========================================
@after_model
def sync_breakdown_interceptor(
    state: AgentState, runtime: Runtime
) -> dict[str, Any] | None:
    """
    Intercepts the submit_breakdown tool call to update the global design state.
    """
    last_msg = state["messages"][-1]
    print(
        f"[Breakdown Interceptor] ✅ Triggered. Last message type: {type(last_msg).__name__}"
    )
    print(
        f"[Breakdown Interceptor] Has tool_calls: {hasattr(last_msg, 'tool_calls') and bool(last_msg.tool_calls)}"
    )

    if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
        print(
            f"[Breakdown Interceptor] Tool calls found: {[tc['name'] for tc in last_msg.tool_calls]}"
        )
        for tc in last_msg.tool_calls:
            if tc["name"] == "submit_breakdown":
                try:
                    raw_json = tc["args"].get("breakdown_json", "{}")
                    print(
                        f"[Breakdown Interceptor] Raw JSON (first 200 chars): {raw_json[:200]}"
                    )
                    data = json.loads(raw_json)
                    entities = data.get("entities", [])
                    scenes = data.get("scenes", [])
                    print(
                        f"[Breakdown Interceptor] Parsed: {len(entities)} entities, {len(scenes)} scenes"
                    )

                    raw_scenes = [
                        {"id": s.get("id"), "description": s.get("description")}
                        for s in scenes
                    ]

                    result = {
                        "design": {
                            "entities": entities,
                            "raw_scenes": raw_scenes,
                            "is_approved": False,
                        },
                    }
                    print(
                        f"[Breakdown Interceptor] ✅ Returning state update with {len(entities)} entities, {len(raw_scenes)} raw_scenes"
                    )
                    return result
                except Exception as e:
                    print(
                        f"[Breakdown Interceptor] ❌ Error parsing breakdown JSON: {e}"
                    )
    return None


# ==========================================
# 3. Define Breakdown Agent
# ==========================================
model = ChatOllama(model="gemma4:26b", model_kwargs={"parallel_tool_calls": True})


# New tool to fetch the current script from the state
@tool
def get_script(state: Annotated[dict, InjectedState]) -> str:
    """Return the current script stored in design.script."""
    return state.get("design", {}).get("script", "")


# Updated system prompt: instruct AI to first obtain the script via get_script
system_prompt = """
<role>
You are the 1st Assistant Director (1st AD) and Visual Planner.
</role>

<workflow>
Step 1: Retrieve the full script using the `get_script` tool.
Step 2: Perform Entity Extraction and create raw scene descriptions.
Step 3: Call `submit_breakdown` with a JSON containing `entities` and `scenes` (raw descriptions).
Step 4: The Storyboard node will later add layout_bbox etc.
</workflow>

<technical_requirements>
- TOOL_USAGE: First call `get_script` to obtain script text.
- Then call `submit_breakdown` with JSON:
  {
    "entities": [...],
    "scenes": [{"id": "s1", "description": "..."}, ...]
  }
- Do NOT output raw JSON in chat; always use the tool.
</technical_requirements>
"""

breakdown_node = create_agent(
    model=model,
    tools=[get_script, submit_breakdown],
    middleware=[
        CopilotKitMiddleware(),
        sync_breakdown_interceptor,
    ],
    state_schema=AgentState,
    system_prompt=system_prompt,
)
