import json
from typing import Any, Annotated, List
from pydantic import BaseModel, Field
from langchain.tools import tool, ToolRuntime
from langgraph.prebuilt import InjectedState
from langgraph.runtime import Runtime
from src.state import AgentState, Entity
from langchain.agents import create_agent
from copilotkit import CopilotKitMiddleware
from langchain.agents.middleware import after_model
from langchain_ollama import ChatOllama


# ==========================================
# 0. Define Structured Input Schemas
# ==========================================
class SubmitBreakdownArgs(BaseModel):
    entities: List[Entity] = Field(
        description="List of extracted characters, props, and locations"
    )


# ==========================================
# 1. Define Tools
# ==========================================
@tool(args_schema=SubmitBreakdownArgs)
def submit_breakdown(entities: List[Entity], runtime: ToolRuntime):
    """
    INDUSTRIAL TOOL: Call this to submit the final structural breakdown of the script.
    Provide the extracted characters, props, and locations directly as structured arguments.
    """
    return "Entity breakdown submitted. Awaiting sync and HITL approval."


# ==========================================
# 2. Sync Interceptor (Middleware)
# ==========================================
@after_model
def sync_breakdown_interceptor(
    state: AgentState, runtime: Runtime
) -> dict[str, Any] | None:
    """
    Intercepts the submit_breakdown tool call to update the global design state with extracted entities.
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
                    args = tc["args"]
                    print(
                        f"[Breakdown Interceptor] Received structured args directly (no string parsing needed!)"
                    )

                    entities = args.get("entities", [])
                    print(
                        f"[Breakdown Interceptor] Parsed: {len(entities)} entities. scenes will be processed in Storyboard node."
                    )

                    # Serialize entities safely to list of dicts for global state
                    serialized_entities = []
                    for e in entities:
                        if isinstance(e, dict):
                            serialized_entities.append(e)
                        elif hasattr(e, "dict"):
                            serialized_entities.append(e.dict())
                        else:
                            serialized_entities.append(dict(e))

                    result = {
                        "design": {
                            "entities": serialized_entities,
                            "is_approved": False,
                        },
                    }
                    print(
                        f"[Breakdown Interceptor] ✅ Returning state update with {len(serialized_entities)} entities"
                    )
                    return result
                except Exception as e:
                    print(
                        f"[Breakdown Interceptor] ❌ Error processing breakdown arguments: {e}"
                    )
    return None


# ==========================================
# 3. Define Breakdown Agent
# ==========================================
model = ChatOllama(model="gemma4:26b", model_kwargs={"parallel_tool_calls": True})


# New tool to fetch the current script from the state
@tool
def get_script(state: Annotated[dict, InjectedState] = None) -> str:
    """Return the current script stored in design.script."""
    print(f"[get_script] 🟢 Tool execution started. State type: {type(state)}")
    try:
        if state is None:
            print(
                "[get_script] ⚠️ Warning: injected state is None. Returning empty script."
            )
            return ""

        print(
            f"[get_script] State keys: {list(state.keys()) if hasattr(state, 'keys') else 'No keys method'}"
        )

        design = {}
        if isinstance(state, dict):
            design = state.get("design", {})
        elif hasattr(state, "get"):
            design = state.get("design", {})
        else:
            print(
                f"[get_script] ⚠️ Warning: state is not a dict or dict-like. state={state}"
            )

        script = design.get("script", "") if isinstance(design, dict) else ""
        print(f"[get_script] ✅ Success. Script length: {len(script)}")
        return script
    except Exception as e:
        print(f"[get_script] ❌ Exception occurred in get_script: {e}")
        import traceback

        traceback.print_exc()
        return ""


# Updated system prompt: instruct AI to first obtain the script via get_script and extract entities
system_prompt = """
<role>
You are the 1st Assistant Director (1st AD) and Visual Planner.
</role>

<workflow>
Step 1: Retrieve the full script using the `get_script` tool.
Step 2: Perform Entity Extraction (Characters, Props, Locations).
Step 3: Call `submit_breakdown` directly with your extracted `entities` arguments.
Step 4: The Storyboard (分镜) node will handle the scene-by-scene planning later. Do NOT attempt to break down or submit scenes here.
</workflow>

<technical_requirements>
- TOOL_USAGE: First call `get_script` to obtain script text.
- Then call `submit_breakdown` passing structured arguments matching the tool schema:
  - `entities`: List of character, prop, or location entities.
- Do NOT attempt to extract or plan scenes; scene breakdown and storyboard generation is completely delegated to the next stage.
- Do NOT output raw markdown JSON in chat; always call the tool directly.
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
