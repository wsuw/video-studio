from typing import List
from pydantic import BaseModel, Field
from langchain.tools import tool, ToolRuntime
from langgraph.runtime import Runtime
from src.state import AgentState, Entity
from langchain.agents import create_agent
from copilotkit import CopilotKitMiddleware
from langchain.agents.middleware import before_model, after_model
from langchain_core.messages import SystemMessage
from src.models import get_model, generate_image
from typing import Any
import os
import json


# ==========================================
# 0. Define Structured Input Schemas
# ==========================================
class SubmitBreakdownArgs(BaseModel):
    entities: List[Entity] = Field(
        description="List of extracted characters, props, and locations"
    )


class GeneratePortraitArgs(BaseModel):
    entity_id: str = Field(
        description="The unique ID (e.g., e1, e2) of the entity to generate a visual reference for"
    )
    style_prompt: str = Field(
        description="Detailed visual prompt including style, age, clothing, lighting, or texture details"
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


@tool(args_schema=GeneratePortraitArgs)
def generate_entity_portrait(
    entity_id: str, style_prompt: str, runtime: ToolRuntime
) -> str:
    """
    CONCEPT ART TOOL: Generate a canonical visual reference image (Master Portrait) for the specified entity
    to maintain absolute visual consistency across different storyboard scenes.
    """
    entity_type = "character"
    if "prop" in entity_id.lower() or "prop" in style_prompt.lower():
        entity_type = "prop"
    elif (
        "loc" in entity_id.lower()
        or "room" in style_prompt.lower()
        or "street" in style_prompt.lower()
        or "place" in style_prompt.lower()
    ):
        entity_type = "location"

    selected_url = generate_image(style_prompt, entity_type)
    return f"Success: Portrait generated for {entity_id}. Master portrait reference URL: {selected_url}"


# ==========================================
# 2. Sync Interceptor (Middleware)
# ==========================================
@after_model
def sync_breakdown_interceptor(
    state: AgentState, runtime: Runtime
) -> dict[str, Any] | None:
    """
    Intercepts the submit_breakdown and generate_entity_portrait tool calls to update the global design state.
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
                    )  # Serialize entities safely to list of dicts for global state

                    # Load existing entities from state to prevent partial updates from wiping out other assets
                    existing_entities = []
                    design_state = state.get("design", {})
                    if isinstance(design_state, dict):
                        existing_entities = design_state.get("entities", [])

                    # Construct lookup by ID for existing entities
                    existing_entities_dict = {}
                    for e in existing_entities:
                        e_dict = (
                            e
                            if isinstance(e, dict)
                            else (e.dict() if hasattr(e, "dict") else dict(e))
                        )
                        eid = e_dict.get("id")
                        if eid:
                            existing_entities_dict[eid] = e_dict

                    # Map and merge incoming entities
                    incoming_entities = []
                    for e in entities:
                        e_dict = (
                            e
                            if isinstance(e, dict)
                            else (e.dict() if hasattr(e, "dict") else dict(e))
                        )
                        eid = e_dict.get("id")
                        if eid:
                            if eid in existing_entities_dict:
                                merged = existing_entities_dict[eid].copy()
                                # Merge selectively to avoid overwriting existing assets/media references with None or empty strings
                                for k, v in e_dict.items():
                                    if v is not None and v != "":
                                        merged[k] = v
                                    else:
                                        if (
                                            k not in merged
                                            or merged[k] is None
                                            or merged[k] == ""
                                        ):
                                            merged[k] = v
                                existing_entities_dict[eid] = merged
                                incoming_entities.append(merged)
                            else:
                                existing_entities_dict[eid] = e_dict
                                incoming_entities.append(e_dict)

                    # Determine final entities list
                    if (
                        len(entities) < len(existing_entities)
                        and len(existing_entities) > 0
                    ):
                        print(
                            f"[Breakdown Interceptor] Detected partial update ({len(entities)} incoming vs {len(existing_entities)} existing). Merging and preserving other entities."
                        )
                        final_entities_to_process = []
                        seen_ids = set()
                        # Maintain original list order
                        for e in existing_entities:
                            e_dict = (
                                e
                                if isinstance(e, dict)
                                else (e.dict() if hasattr(e, "dict") else dict(e))
                            )
                            eid = e_dict.get("id")
                            if eid in existing_entities_dict:
                                final_entities_to_process.append(
                                    existing_entities_dict[eid]
                                )
                                seen_ids.add(eid)
                        # Add any new ones that weren't in existing_entities
                        for eid, e_dict in existing_entities_dict.items():
                            if eid not in seen_ids:
                                final_entities_to_process.append(e_dict)
                    else:
                        print(
                            f"[Breakdown Interceptor] Detected full update or fresh extraction. Replacing list with incoming entities."
                        )
                        final_entities_to_process = incoming_entities

                    # Automatically generate visual reference portraits in parallel for all extracted entities
                    import concurrent.futures

                    def process_entity_visual(e_dict):
                        ref = e_dict.get("visual_reference")
                        # Generate if ref is missing, empty, or a simple placeholder
                        if not ref or not ref.startswith("http"):
                            name = e_dict.get("name", "Asset")
                            desc = e_dict.get("description", "")
                            e_type = e_dict.get("type", "character")

                            style_prompt = f"Concept art of {name}: {desc}. Beautiful detailed cinematic style."
                            print(
                                f"[Auto Portrait] 🎨 Generating background portrait for {name} ({e_type})..."
                            )
                            try:
                                url = generate_image(style_prompt, e_type)
                                e_dict["visual_reference"] = url
                                print(
                                    f"[Auto Portrait] ✅ Success: Linked background portrait {url} to {name}"
                                )
                            except Exception as ex:
                                print(
                                    f"[Auto Portrait] ❌ Failed to generate portrait for {name}: {ex}"
                                )
                        return e_dict

                    print(
                        f"[Breakdown Interceptor] ⚡ Starting parallel portrait generation for {len(final_entities_to_process)} entities..."
                    )
                    with concurrent.futures.ThreadPoolExecutor(
                        max_workers=5
                    ) as executor:
                        final_entities = list(
                            executor.map(
                                process_entity_visual, final_entities_to_process
                            )
                        )

                    result = {
                        "design": {
                            "entities": final_entities,
                            "is_approved": False,
                        },
                    }
                    print(
                        f"[Breakdown Interceptor] ✅ Returning state update with {len(final_entities)} entities populated with portraits"
                    )
                    return result
                except Exception as e:
                    print(
                        f"[Breakdown Interceptor] ❌ Error processing breakdown arguments: {e}"
                    )
            elif tc["name"] == "generate_entity_portrait":
                try:
                    args = tc["args"]
                    entity_id = args.get("entity_id")
                    style_prompt = args.get("style_prompt")
                    print(
                        f"[Breakdown Interceptor] Intercepted manual portrait generation for entity: {entity_id}"
                    )

                    entity_type = "character"
                    if "prop" in entity_id.lower() or "prop" in style_prompt.lower():
                        entity_type = "prop"
                    elif (
                        "loc" in entity_id.lower()
                        or "room" in style_prompt.lower()
                        or "street" in style_prompt.lower()
                        or "place" in style_prompt.lower()
                    ):
                        entity_type = "location"

                    selected_url = generate_image(style_prompt, entity_type)

                    design = state.get("design", {})
                    entities = design.get("entities", [])

                    updated_entities = []
                    for e in entities:
                        e_dict = (
                            e
                            if isinstance(e, dict)
                            else (e.dict() if hasattr(e, "dict") else dict(e))
                        )
                        if e_dict.get("id") == entity_id:
                            e_dict["visual_reference"] = selected_url
                        updated_entities.append(e_dict)

                    result = {
                        "design": {
                            "entities": updated_entities,
                        }
                    }
                    print(
                        f"[Breakdown Interceptor] ✅ Linked reference {selected_url} to entity {entity_id}"
                    )
                    return result
                except Exception as ex:
                    print(
                        f"[Breakdown Interceptor] ❌ Error in generate_entity_portrait interceptor: {ex}"
                    )
    return None


# ==========================================
# 3. Dynamic System Prompt (reads live state)
# ==========================================

# Statically resolve and load voices at module load time to prevent blocking event loop at runtime
_VOICES_LIST: list = []

try:
    _candidates = [
        os.path.join(os.getcwd(), "speech-samples", "_voices_local.json"),
        os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "speech-samples",
            "_voices_local.json",
        ),
        os.path.join(os.getcwd(), "..", "speech-samples", "_voices_local.json"),
    ]
    _resolved_path = None
    for _p in _candidates:
        if os.path.exists(_p):
            _resolved_path = _p
            break
    if _resolved_path:
        with open(_resolved_path, "r", encoding="utf-8") as _f:
            _VOICES_LIST = json.load(_f)
except Exception as _ex:
    print(f"[breakdown] Failed to eagerly load voices at startup: {_ex}")


def _load_voices() -> list:
    """Return the cached voices list loaded eagerly at module load time."""
    return _VOICES_LIST


# ==========================================
# 3. Dynamic Prompt Injection (Middleware)
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
        entities_lines = "None (No entities extracted yet)"

    # Format voices
    voices_lines = ""
    for v in _load_voices():
        voices_lines += f"- ID: {v.get('id')} | Name: {v.get('name')} ({v.get('gender')}, {v.get('ageGroup', 'Adult')})\n"
    if not voices_lines:
        voices_lines = "No voices available in index."

    content = f"""<role>
You are the 1st Assistant Director (1st AD) and Visual Planner.
</role>

<screenplay_script>
{script if script else "None (No screenplay script uploaded yet)"}
</screenplay_script>

<extracted_entities>
{entities_lines}
</extracted_entities>

<available_voices>
For each character entity you extract or update, you MUST select the most suitable voice timbre from this list. Set the character's `voice_reference` property to the chosen voice's ID (UUID string).
Do NOT generate a random UUID; you must select a valid ID from this list matching the character's gender, age, and personality:
{voices_lines}
</available_voices>

<workflow>
Step 1: Perform Entity Extraction (Characters, Props, Locations) using the screenplay script and existing entities above.
Step 2: Call `submit_breakdown` directly with your extracted `entities` arguments.
Step 3: The Storyboard (分镜) node will handle the scene-by-scene planning later. Do NOT attempt to break down or submit scenes here.
</workflow>

<technical_requirements>
- TOOL_USAGE: Always use the database context (screenplay script and existing entities) provided above.
- Call `submit_breakdown` to save initial entity decomposition or update existing entities.
- VOICE_TIMBRE_SELECTION: For every character entity you extract or update, you MUST select the most suitable voice timbre from the `<available_voices>` list. Match the voice's gender, ageGroup, and personality description with the character's traits, and assign that voice's UUID string to the `voice_reference` property of the `Entity` object. Never make up a voice ID; always select a valid ID from the list.
- If the user asks to "Auto-Style" or refine/generate a visual profile for a specific entity, follow these steps:
  1. Locate the target entity from the context above.
  2. Generate a rich visual description (style parameters, appearance, textures) based on the user's request.
  3. Call `submit_breakdown` with the updated list of entities containing the new description.
  4. Call `generate_entity_portrait` to regenerate/update the portrait image for that entity so it matches the new style perfectly.
- All concept art portraits for the entities will be automatically generated and linked by the backend upon submission.
- Do NOT attempt to extract or plan scenes; scene breakdown and storyboard generation is completely delegated to the next stage.
- Do NOT output raw markdown JSON in chat; always call the tool directly.
</technical_requirements>
"""

    # We use a stable ID "dynamic_prompt_context" to allow the add_messages reducer
    # to update this context in-place.
    context_msg = SystemMessage(content=content, id="dynamic_prompt_context")

    # 获取当前消息列表的副本
    current_messages = list(state.get("messages", []))

    # 构建新列表：先过滤旧的，再插入新的到最前面
    new_messages = [context_msg] + [
        m
        for m in current_messages
        if getattr(m, "id", None) != "dynamic_prompt_context"
    ]

    # 通过返回字典，让 LangGraph 框架负责将新消息合并回状态
    return {"messages": new_messages}


# ==========================================
# 4. Export Agent as Node
# ==========================================
model = get_model(parallel_tool_calls=True)

breakdown_node = create_agent(
    model=model,
    tools=[submit_breakdown, generate_entity_portrait],
    middleware=[
        CopilotKitMiddleware(),
        inject_dynamic_prompt,
        sync_breakdown_interceptor,
    ],
    state_schema=AgentState,
    system_prompt="",
)
