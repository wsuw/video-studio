# agent/src/nodes/voiceover_node.py
from typing import Any, Annotated, List
from pydantic import BaseModel, Field
from langchain.tools import tool, ToolRuntime
from langgraph.prebuilt import InjectedState
from langgraph.runtime import Runtime
from src.state import AgentState, Scene
from langchain.agents import create_agent
from copilotkit import CopilotKitMiddleware
from langchain.agents.middleware import after_model
from src.models import get_model


# ==========================================
# 0. Define Structured Input Schemas
# ==========================================
class SubmitVoiceoverArgs(BaseModel):
    scenes: List[Scene] = Field(
        description="Chronological list of storyboard scenes updated with dialogue text and voice_actor_id"
    )


# ==========================================
# 1. Define Tools
# ==========================================
@tool
def get_voiceover_context(state: Annotated[dict, InjectedState] = None) -> dict:
    """
    INDUSTRIAL TOOL: Return the full script, extracted character entities, and current storyboard scenes.
    Use this first to align dialogue extraction with the scenes and character IDs.
    """
    print(
        f"[get_voiceover_context] 🟢 Tool execution started. State type: {type(state)}"
    )
    try:
        if state is None:
            print(
                "[get_voiceover_context] ⚠️ Warning: injected state is None. Returning empty context."
            )
            return {"script": "", "entities": [], "scenes": []}

        design = {}
        if isinstance(state, dict):
            design = state.get("design", {})
        elif hasattr(state, "get"):
            design = state.get("design", {})
        else:
            print(
                f"[get_voiceover_context] ⚠️ Warning: state is not a dict. state={state}"
            )

        script = design.get("script", "") if isinstance(design, dict) else ""
        entities = design.get("entities", []) if isinstance(design, dict) else []
        scenes = design.get("scenes", []) if isinstance(design, dict) else []

        # Serialize entities and scenes safely
        serialized_entities = []
        for e in entities:
            if isinstance(e, dict):
                serialized_entities.append(e)
            elif hasattr(e, "dict"):
                serialized_entities.append(e.dict())
            else:
                serialized_entities.append(dict(e))

        serialized_scenes = []
        for s in scenes:
            if isinstance(s, dict):
                serialized_scenes.append(s)
            elif hasattr(s, "dict"):
                serialized_scenes.append(s.dict())
            else:
                serialized_scenes.append(dict(s))

        print(
            f"[get_voiceover_context] ✅ Success. Script len: {len(script)}, Entities: {len(serialized_entities)}, Scenes: {len(serialized_scenes)}"
        )
        return {
            "script": script,
            "entities": serialized_entities,
            "scenes": serialized_scenes,
        }
    except Exception as e:
        print(f"[get_voiceover_context] ❌ Exception: {e}")
        import traceback

        traceback.print_exc()
        return {"script": "", "entities": [], "scenes": [], "error": str(e)}


@tool(args_schema=SubmitVoiceoverArgs)
def submit_voiceover(scenes: List[Scene], runtime: ToolRuntime):
    """
    INDUSTRIAL TOOL: Call this to submit the storyboard scenes with voiceover details.
    Each scene should have its dialogue text and voice_actor_id set.
    """
    return "Voiceover dialogues and speaking characters submitted successfully. Ready for previewing and zero-shot voice synthesis."


# ==========================================
# 2. Sync Interceptor (Middleware)
# ==========================================
@after_model
def sync_voiceover_interceptor(
    state: AgentState, runtime: Runtime
) -> dict[str, Any] | None:
    """
    Intercepts the submit_voiceover tool call to update the global design state with dialogues and speakers.
    """
    last_msg = state["messages"][-1]
    print(
        f"[Voiceover Interceptor] ✅ Triggered. Last message type: {type(last_msg).__name__}"
    )
    print(
        f"[Voiceover Interceptor] Has tool_calls: {hasattr(last_msg, 'tool_calls') and bool(last_msg.tool_calls)}"
    )

    if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
        print(
            f"[Voiceover Interceptor] Tool calls found: {[tc['name'] for tc in last_msg.tool_calls]}"
        )
        for tc in last_msg.tool_calls:
            if tc["name"] == "submit_voiceover":
                try:
                    args = tc["args"]
                    scenes = args.get("scenes", [])
                    print(f"[Voiceover Interceptor] Parsed {len(scenes)} scenes.")

                    serialized_scenes = []
                    for s in scenes:
                        if isinstance(s, dict):
                            serialized_scenes.append(s)
                        elif hasattr(s, "dict"):
                            serialized_scenes.append(s.dict())
                        else:
                            serialized_scenes.append(dict(s))

                    # Update global scenes, maintaining other scene fields (like layout, shot_type, lens, motion, audio_url, etc.)
                    design_state = state.get("design", {})
                    existing_scenes = (
                        design_state.get("scenes", [])
                        if isinstance(design_state, dict)
                        else []
                    )

                    existing_scenes_dict = {}
                    for es in existing_scenes:
                        es_dict = (
                            es
                            if isinstance(es, dict)
                            else (es.dict() if hasattr(es, "dict") else dict(es))
                        )
                        sid = es_dict.get("id")
                        if sid:
                            existing_scenes_dict[sid] = es_dict

                    merged_scenes = []
                    for s in serialized_scenes:
                        sid = s.get("id")
                        if sid and sid in existing_scenes_dict:
                            merged = existing_scenes_dict[sid].copy()
                            # Update dialogue, voice actor and reset audio if text changed
                            old_dialogue = merged.get("dialogue")
                            new_dialogue = s.get("dialogue")
                            old_actor = merged.get("voice_actor_id")
                            new_actor = s.get("voice_actor_id")

                            merged["dialogue"] = new_dialogue
                            merged["voice_actor_id"] = new_actor

                            # If dialogue or speaker changed, invalidate previous audio cache to force re-synthesis
                            if old_dialogue != new_dialogue or old_actor != new_actor:
                                print(
                                    f"[Voiceover Interceptor] Scene {sid} text/speaker changed. Resetting cached audio references."
                                )
                                merged["audio_url"] = None
                                merged["audio_duration"] = None

                            merged_scenes.append(merged)
                        else:
                            merged_scenes.append(s)

                    result = {
                        "design": {
                            "scenes": merged_scenes,
                            "is_approved": False,
                        }
                    }
                    print(
                        f"[Voiceover Interceptor] ✅ Returning state update with {len(merged_scenes)} scenes updated."
                    )
                    return result
                except Exception as e:
                    print(
                        f"[Voiceover Interceptor] ❌ Error in sync_voiceover_interceptor: {e}"
                    )
                    import traceback

                    traceback.print_exc()
    return None


# ==========================================
# 3. Define Voiceover Agent Node
# ==========================================
model = get_model(parallel_tool_calls=True)

system_prompt = """
<role>
You are the Voiceover Director and Dialogue Coordinator. Your job is to take the screenplay script, the list of extracted character entities, and the planned storyboard scenes, and map out the dialogue script and voice actor assignments for each scene.
</role>

<workflow>
Step 1: Retrieve the script, entities, and scenes using the `get_voiceover_context` tool.
Step 2: Read the script thoroughly. For each planned storyboard scene:
  - Identify what part of the script is being visually depicted in this scene.
  - Determine if there are dialogue lines or narration (voiceover) associated with this scene.
  - Assign the dialogue or narration to the `dialogue` field of that scene.
  - Map the speaker to `voice_actor_id`. Use the specific entity ID (e.g. "e1", "e2") of the character who is speaking. If it is standard background narration rather than a specific character, set `voice_actor_id` to "narrator".
Step 3: Call `submit_voiceover` with the full updated list of scenes.
</workflow>

<dialogue_mapping_rules>
- Do NOT rewrite or hallucinate dialogues unless absolutely necessary. Rely directly on the dialogue lines from the original screenplay script.
- Ensure that the voiceover narration or dialogue matches the visual flow of the scenes.
- If a scene contains no spoken dialogue or narration, set `dialogue` to None (or empty) and `voice_actor_id` to None.
- Double-check character IDs from the entities list to ensure correct voice casting assignments.
</dialogue_mapping_rules>

<technical_requirements>
- TOOL_USAGE: First call `get_voiceover_context` to obtain current storyboard, script, and entities context.
- Then call `submit_voiceover` passing the updated list of scenes.
- Do NOT output raw markdown JSON in chat; always call the tool directly.
</technical_requirements>
"""

voiceover_node = create_agent(
    model=model,
    tools=[get_voiceover_context, submit_voiceover],
    middleware=[
        CopilotKitMiddleware(),
        sync_voiceover_interceptor,
    ],
    state_schema=AgentState,
    system_prompt=system_prompt,
)
