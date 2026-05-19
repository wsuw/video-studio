from typing import Any, Annotated, List
from pydantic import BaseModel, Field
from langchain.tools import tool, ToolRuntime
from langgraph.prebuilt import InjectedState
from langgraph.runtime import Runtime
from src.state import AgentState, Scene
from langchain.agents import create_agent
from copilotkit import CopilotKitMiddleware
from langchain.agents.middleware import after_model
from src.llm import get_model


# ==========================================
# 0. Define Structured Input Schemas
# ==========================================
class SubmitStoryboardArgs(BaseModel):
    scenes: List[Scene] = Field(
        description="Chronological list of planned storyboard scenes with visual layout parameters"
    )


# ==========================================
# 1. Define Tools
# ==========================================
@tool(args_schema=SubmitStoryboardArgs)
def submit_storyboard(scenes: List[Scene], runtime: ToolRuntime):
    """
    INDUSTRIAL TOOL: Call this to submit the fully planned storyboard.
    Provide the chronological list of planned storyboard scenes with visual layout parameters directly.
    """
    return "Storyboard submitted. Ready for generation."


@tool
def get_design_context(state: Annotated[dict, InjectedState] = None) -> dict:
    """
    INDUSTRIAL TOOL: Return both the script and the extracted asset entities from the state.
    Use this first to align scenes with existing entities and script text.
    """
    print(f"[get_design_context] 🟢 Tool execution started. State type: {type(state)}")
    try:
        if state is None:
            print(
                "[get_design_context] ⚠️ Warning: injected state is None. Returning empty design context."
            )
            return {"script": "", "entities": []}

        print(
            f"[get_design_context] State keys: {list(state.keys()) if hasattr(state, 'keys') else 'No keys method'}"
        )

        design = {}
        if isinstance(state, dict):
            design = state.get("design", {})
        elif hasattr(state, "get"):
            design = state.get("design", {})
        else:
            print(
                f"[get_design_context] ⚠️ Warning: state is not a dict or dict-like. state={state}"
            )

        script = design.get("script", "") if isinstance(design, dict) else ""
        entities = design.get("entities", []) if isinstance(design, dict) else []

        print(
            f"[get_design_context] ✅ Success. Script length: {len(script)}, Entities count: {len(entities)}"
        )
        return {"script": script, "entities": entities}
    except Exception as e:
        print(f"[get_design_context] ❌ Exception occurred in get_design_context: {e}")
        import traceback

        traceback.print_exc()
        return {"script": "", "entities": [], "error": str(e)}


# ==========================================
# 2. Sync Interceptor (Middleware)
# ==========================================
@after_model
def sync_storyboard_interceptor(
    state: AgentState, runtime: Runtime
) -> dict[str, Any] | None:
    """
    Intercepts the submit_storyboard tool call to update the global design state with scenes.
    """
    last_msg = state["messages"][-1]
    print(
        f"[Storyboard Interceptor] ✅ Triggered. Last message type: {type(last_msg).__name__}"
    )
    print(
        f"[Storyboard Interceptor] Has tool_calls: {hasattr(last_msg, 'tool_calls') and bool(last_msg.tool_calls)}"
    )

    if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
        print(
            f"[Storyboard Interceptor] Tool calls found: {[tc['name'] for tc in last_msg.tool_calls]}"
        )
        for tc in last_msg.tool_calls:
            if tc["name"] == "submit_storyboard":
                try:
                    args = tc["args"]
                    print(
                        "[Storyboard Interceptor] Received structured args directly (no string parsing needed!)"
                    )

                    scenes = args.get("scenes", [])
                    print(f"[Storyboard Interceptor] Parsed: {len(scenes)} scenes.")

                    # Serialize scenes safely to list of dicts for global state
                    serialized_scenes = []
                    for s in scenes:
                        if isinstance(s, dict):
                            serialized_scenes.append(s)
                        elif hasattr(s, "dict"):
                            serialized_scenes.append(s.dict())
                        else:
                            serialized_scenes.append(dict(s))

                    result = {
                        "design": {
                            "scenes": serialized_scenes,
                            "is_approved": False,
                        },
                    }
                    print(
                        f"[Storyboard Interceptor] ✅ Returning state update with {len(serialized_scenes)} scenes"
                    )
                    return result
                except Exception as e:
                    print(
                        f"[Storyboard Interceptor] ❌ Error processing storyboard arguments: {e}"
                    )
    return None


# ==========================================
# 3. Define Storyboard Agent
# ==========================================
model = get_model(parallel_tool_calls=True)

storyboard_node = create_agent(
    model=model,
    tools=[get_design_context, submit_storyboard],
    middleware=[
        CopilotKitMiddleware(),
        sync_storyboard_interceptor,
    ],
    state_schema=AgentState,
    system_prompt="""
<role>
You are the Storyboard Artist. Your job is to take the script and the list of extracted entities (provided by the Breakdown stage) and turn them into fully planned storyboard entries.
</role>

<workflow>
Step 1: Retrieve the script and extracted entities using the `get_design_context` tool.
Step 2: Plan chronological scenes/shots that break down the script text.
Step 3: For each scene, map the participating characters and props to separate non-overlapping bounding boxes within the `layout` list.
Step 4: Specify a detailed camera/visual description and call `submit_storyboard` with the structured list of scenes.
</workflow>

<cinematic_layout_rules>
You must avoid making all shots centered, and you should represent multiple entities inside the scene by assigning them distinct, non-overlapping bounding boxes (`bbox`):
- MULTI-SUBJECT COMPOSITION (e.g. Neo e1 talking to Trinity e2):
  - Place Neo on the left third: `entity_id="e1"`, `bbox=[0.1, 0.15, 0.3, 0.7]`
  - Place Trinity on the right third: `entity_id="e2"`, `bbox=[0.6, 0.15, 0.3, 0.7]`
- ITEM FOCUS (e.g. Neo e1 holding a glowing device e2):
  - Place Neo centered: `entity_id="e1"`, `bbox=[0.3, 0.1, 0.4, 0.75]`
  - Place device in his hand (lower right): `entity_id="e2"`, `bbox=[0.55, 0.6, 0.2, 0.25]`
- Rule of Thirds Single Subject:
  - Subject on left: `bbox=[0.1, 0.15, 0.35, 0.7]`
  - Subject on right: `bbox=[0.55, 0.15, 0.35, 0.7]`

Always place different entities in different coordinates (no exact overlapping), so they occupy their own physical space in the frame!
</cinematic_layout_rules>

<cinematic_optics_and_movement>
You should autonomously select appropriate camera parameters for each scene depending on the dramatic context:
- `lens`: Choose "24mm" for wide establishing landscapes or group layouts, "50mm" for conversation or normal medium perspectives, and "85mm" for intimate portraits or high-impact close-ups.
- `shot_type`: Choose "wide", "medium", or "close-up" to match your spatial composition.
- `motion`: Choose from "static" (lock position), "pan" (horizontal sweep), "tilt" (vertical rise/fall), "zoom-in" (forward dolly push), or "zoom-out" (backward pull).
</cinematic_optics_and_movement>

<technical_requirements>
- TOOL_USAGE: First call `get_design_context` to obtain script text and entities.
- Then call `submit_storyboard` passing structured arguments matching the tool schema:
  - `scenes`: List of planned storyboard scenes (containing `layout`, `lens`, `shot_type`, and `motion` parameters).
- Do NOT output raw markdown JSON in chat; always call the tool directly.
</technical_requirements>
""",
)
