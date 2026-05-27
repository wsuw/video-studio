from typing import Any, List, Optional
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
class LLMLayoutElement(BaseModel):
    entity_id: str = Field(
        description="ID of the bound character or prop (e.g., e1, e2)"
    )
    bbox: List[float] = Field(
        description="Normalized bounding box coordinates [x, y, w, h] (0.0 to 1.0) for this entity"
    )


class LLMDialogueTurn(BaseModel):
    speaker: str = Field(
        description="Entity ID of the speaker (e.g., e1, e2) or 'narrator'"
    )
    text: str = Field(
        description="Spoken dialogue or voiceover narration text for this turn"
    )
    emotion_text: Optional[str] = Field(
        None, description="Optional emotion text guide (e.g., calm: 0.8, happy: 1.0)"
    )
    use_emotion_text: bool = Field(
        True, description="Whether to use text-based emotion guide"
    )


class LLMScene(BaseModel):
    id: str = Field(description="Unique scene ID (e.g., s1, s2)")
    description: str = Field(
        description="Detailed narrative and visual setting description for this shot"
    )
    entities: List[str] = Field(
        default=[],
        description="List of character/prop Entity IDs appearing in this scene",
    )
    layout: List[LLMLayoutElement] = Field(
        default=[],
        description="Spatial layout mapping characters/props to non-overlapping bounding boxes",
    )
    lens: str = Field(
        default="50mm", description="Camera lens focal length (e.g., 24mm, 50mm, 85mm)"
    )
    shot_type: str = Field(
        default="medium", description="Camera framing (e.g., wide, medium, close-up)"
    )
    motion: str = Field(
        default="static",
        description="Camera motion (e.g., static, pan, tilt, zoom-in, zoom-out)",
    )
    dialogue_turns: List[LLMDialogueTurn] = Field(
        default=[],
        description="Chronological list of dialogue turns spoken in this scene",
    )


class SubmitStoryboardArgs(BaseModel):
    scenes: List[LLMScene] = Field(
        description="Chronological list of planned storyboard scenes with visual layout parameters"
    )


# ==========================================
# 1. Define Tools
# ==========================================
@tool(args_schema=SubmitStoryboardArgs)
def submit_storyboard(scenes: List[LLMScene], runtime: ToolRuntime):
    """
    INDUSTRIAL TOOL: Call this to submit the fully planned storyboard.
    Provide the chronological list of planned storyboard scenes with visual layout parameters directly.
    """
    return "Storyboard submitted. Ready for generation."


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
        entities_lines = "None (No entities extracted yet by Breakdown node)"

    content = f"""<role>
You are the Storyboard Artist, Cinematic Director, and Dialogue Coordinator. You have full authority and responsibility over both cinematic visual planning and dialogue mapping.
Under no circumstances should you delegate dialogue extraction to a later voiceover stage; you MUST exhaustively extract all character dialogues and narrator voiceovers from the screenplay script and bind them directly to your planned scenes right here in this node!
</role>

<screenplay_script>
{script if script else "None (No screenplay script uploaded yet)"}
</screenplay_script>

<extracted_entities>
{entities_lines}
</extracted_entities>

<workflow>
Step 1: Use the screenplay script and extracted entities above to plan chronological scenes/shots.
Step 2: For each scene, map the participating characters and props to separate non-overlapping bounding boxes within the `layout` list.
Step 3: If multiple dialogue lines or different speakers talk sequentially in the same continuous camera shot/scene, do NOT split it into separate scenes. Instead, group them chronologically inside the `dialogue_turns` list of that single Scene, specifying each turn's speaker, text, and optional emotion parameters.
Step 4: Specify a detailed camera/visual description and call `submit_storyboard` with the structured list of scenes.
</workflow>

<critical_dialogue_extraction_rules>
- DIALOGUE EXTRACTION IS MANDATORY: You MUST extract every single dialogue line and narration utterance from the <screenplay_script> that belongs to each scene, and put them into the `dialogue_turns` list.
- DO NOT LEAVE DIALOGUE_TURNS EMPTY: Under no circumstances should you submit a scene with an empty `dialogue_turns` list if there is text spoken by characters or a narrator in that segment of the script!
- DIALOGUE TURN SCHEMA: Each item in `dialogue_turns` must be structured as:
  - `speaker`: Entity ID of the character (e.g. "e1") or "narrator" for voiceover. Never write character names; always use their unique Entity ID!
  - `text`: The exact spoken words.
  - `use_emotion_text`: Set to true.
  - `emotion_text`: Optional. Add dynamic emotion description or strength (e.g., "calm: 0.8", "happy: 0.9", "angry: 1.0").
</critical_dialogue_extraction_rules>

<tool_call_example>
Always format your tool call arguments matching this structure:
{{
        "scenes": [
    {{
            "id": "s1",
      "description": "Int. room - Day. Neo stands in front of the window looking outside.",
      "entities": ["e1"],
      "layout": [
        {{
                "entity_id": "e1",
          "bbox": [0.3, 0.15, 0.4, 0.7]
        }}
      ],
      "status": "pending",
      "lens": "50mm",
      "shot_type": "medium",
      "motion": "static",
      "dialogue_turns": [
        {{
                "speaker": "e1",
          "text": "Where are we?",
          "use_emotion_text": true,
          "emotion_text": "calm: 0.8"
        }}
      ]
    }}
  ]
}}
</tool_call_example>

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
- TOOL_USAGE: Always use the database context (screenplay script and extracted entities) provided above.
- Call `submit_storyboard` passing structured arguments matching the tool schema:
  - `scenes`: List of planned storyboard scenes (containing `layout`, `lens`, `shot_type`, `motion`, and any chronological `dialogue_turns` containing speakers and text).
- MULTI-SPEAKER DIALOGUE: Ensure that whenever sequential dialogues flow in the same continuous shot/scene space, they are modeled as items in the `dialogue_turns` list rather than splitting them into separate scene cuts.
- Do NOT output raw markdown JSON in chat; always call the tool directly.
</technical_requirements>
"""

    # We use a stable ID "dynamic_prompt_context" to allow the add_messages reducer
    # to update this context in-place.
    context_msg = SystemMessage(content=content, id="dynamic_prompt_context")

    # Get copy of current messages
    current_messages = list(state.get("messages", []))

    # Rebuild messages: filter old context message and push the new one to the front
    new_messages = [context_msg] + [
        m
        for m in current_messages
        if getattr(m, "id", None) != "dynamic_prompt_context"
    ]

    return {"messages": new_messages}


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
                        s_dict = (
                            s
                            if isinstance(s, dict)
                            else (s.dict() if hasattr(s, "dict") else dict(s))
                        )
                        # Ensure backend status defaults to 'pending' to secure DB validation
                        if "status" not in s_dict or not s_dict["status"]:
                            s_dict["status"] = "pending"
                        serialized_scenes.append(s_dict)

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
    tools=[submit_storyboard],
    middleware=[
        CopilotKitMiddleware(),
        inject_dynamic_prompt,
        sync_storyboard_interceptor,
    ],
    state_schema=AgentState,
    system_prompt="",
)
