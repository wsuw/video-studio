# agent/src/nodes/voiceover_node.py
from typing import Any, List
from pydantic import BaseModel, Field
from langchain.tools import tool, ToolRuntime
from langgraph.runtime import Runtime
from src.state import AgentState, Scene
from langchain.agents import create_agent
from copilotkit import CopilotKitMiddleware
from langchain.agents.middleware import before_model, after_model
from langchain_core.messages import SystemMessage
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
# ==========================================
# 2. Dynamic Prompt Injection (Middleware)
# ==========================================
@before_model
def inject_dynamic_prompt(state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
    """
    [Dynamic Context Sentinel] Injects the complete combined system prompt (static + dynamic script context)
    into the conversation messages history prior to calling the LLM.
    """
    design = state.get("design", {}) or {}
    script = design.get("script", "")
    entities = design.get("entities", [])
    scenes = design.get("scenes", [])

    # Format entities
    entities_lines = ""
    for idx, ent in enumerate(entities):
        e_dict = (
            ent
            if isinstance(ent, dict)
            else (ent.dict() if hasattr(ent, "dict") else dict(ent))
        )
        eid = e_dict.get("id", f"e{idx + 1}")
        name = e_dict.get("name", "Unnamed")
        etype = e_dict.get("type", "character")
        desc = e_dict.get("description", "")
        entities_lines += (
            f"- [{etype.upper()}] ID: {eid}, Name: {name}, Description: {desc}\n"
        )
    if not entities_lines:
        entities_lines = "None"

    # Format scenes
    scenes_lines = ""
    for s in scenes:
        s_dict = (
            s if isinstance(s, dict) else (s.dict() if hasattr(s, "dict") else dict(s))
        )
        sid = s_dict.get("id")
        desc = s_dict.get("description", "")
        turns = s_dict.get("dialogue_turns", []) or []

        turns_desc = ""
        for t in turns:
            t_dict = (
                t
                if isinstance(t, dict)
                else (t.dict() if hasattr(t, "dict") else dict(t))
            )
            turns_desc += f'    * Speaker {t_dict.get("speaker")}: "{t_dict.get("text")}" (Emotion: {t_dict.get("emotion_text")})\n'
        if not turns_desc:
            turns_desc = "    * (No dialogue turns assigned yet)\n"

        scenes_lines += f"- Scene {sid}: {desc}\n{turns_desc}"

    content = f"""<role>
You are the Voiceover Director and Dialogue Coordinator. Your job is to review the screenplay script, the list of extracted character entities, and the planned storyboard scenes, and fine-tune or polish the dialogue turns and emotional tone assignments for each scene.
</role>

<screenplay_script>
{script if script else "None"}
</screenplay_script>

<extracted_entities>
{entities_lines}
</extracted_entities>

<storyboard_scenes>
{scenes_lines if scenes_lines else "None"}
</storyboard_scenes>

<workflow>
Step 1: Review the screenplay script, character entities, and current storyboard scenes provided dynamically above.
Step 2: If the user requests updates to speaking characters, dialogue turns, or emotional expressions, update the specific `dialogue_turns` list of the targeted scene according to the <critical_emotion_guidance_rules> below.
Step 3: Call `submit_voiceover` with the full updated scenes containing the polished `dialogue_turns`.
</workflow>

<critical_emotion_guidance_rules>
We only use a single `emotion_text` field to specify emotion configurations for dialogue turns. The大模型 (LLM) MUST format `emotion_text` as a JSON-like inline dictionary group of detailed emotion strengths.
  - The dictionary keys MUST ONLY be chosen from the following 8 standard emotions: 'happy', 'angry', 'sad', 'afraid', 'disgusted', 'melancholic', 'surprised', 'calm'.
  - You are STRICTLY PROHIBITED from using any other keys (such as 'determined', 'excited', 'fear', 'whisper', etc.). If you want to convey other tones, you must map them to combinations of the 8 standard emotions (e.g. 'determined' can be mapped to a blend of 'calm' and 'angry', for example: "{{'calm': 0.7, 'angry': 0.2}}").
  - Example: "{{'calm': 0.6}}" or "{{'happy': 0.8, 'surprised': 0.2}}" or "{{'angry': 0.7, 'afraid': 0.3}}"

Using this dictionary format allows blending multiple emotions precisely in a single field.
</critical_emotion_guidance_rules>

<technical_requirements>
- TOOL_USAGE: Always use the database context and existing scenes provided above.
- Call `submit_voiceover` passing structured arguments matching the tool schema:
  - `scenes`: List of storyboard scenes containing the polished `dialogue_turns`.
- Do NOT output raw markdown JSON in chat; always call the tool directly.
</technical_requirements>
"""

    context_msg = SystemMessage(content=content, id="dynamic_prompt_context")

    current_messages = list(state.get("messages", []))
    new_messages = [context_msg] + [
        m
        for m in current_messages
        if getattr(m, "id", None) != "dynamic_prompt_context"
    ]

    return {"messages": new_messages}


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
    Intercepts the submit_voiceover tool call to update the global design state with scenes containing dialogue_turns.
    """
    last_msg = state["messages"][-1]
    print(
        f"[Voiceover Interceptor] ✅ Triggered. Last message type: {type(last_msg).__name__}"
    )

    if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
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

                    # Load existing scenes
                    design_state = state.get("design", {}) or {}
                    existing_scenes = design_state.get("scenes", []) or []

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

                            # Preserve all visual, camera, and state-level properties from storyboard
                            # and simply update/polish dialogue_turns
                            merged["dialogue_turns"] = s.get("dialogue_turns", []) or []
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

voiceover_node = create_agent(
    model=model,
    tools=[submit_voiceover],
    middleware=[
        CopilotKitMiddleware(),
        inject_dynamic_prompt,
        sync_voiceover_interceptor,
    ],
    state_schema=AgentState,
    system_prompt="",
)
