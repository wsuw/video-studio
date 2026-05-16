from langchain_core.messages import AIMessage, ToolMessage, RemoveMessage
from src.utils.state import AgentState, Phase


def supervisor_node(state: AgentState):
    """
    Supervisor/Dispatcher Node:
      1. Routes to the agent matching `current_phase`.
      2. On phase transitions, strips tool artifacts (tool_calls + ToolMessages)
         from the message history so the next agent sees only clean conversation
         text — no tools from a previous phase can leak through.
    """
    current_phase = state.get("current_phase", Phase.INIT)

    if not current_phase or current_phase == Phase.INIT:
        current_phase = Phase.DESIGN

    previous_phase = state.get("previous_phase")

    result = {
        "current_phase": current_phase,
        "previous_phase": current_phase,  # 记录本次阶段，供下次比对
    }

    # ── 阶段切换时：剥离历史 tool 元数据 ─────────────────────────────
    if previous_phase and previous_phase != current_phase:
        messages = state.get("messages", [])
        msg_updates = []

        for msg in messages:
            if isinstance(msg, ToolMessage):
                # ToolMessage 是内部管道数据，直接移除
                msg_updates.append(RemoveMessage(id=msg.id))

            elif (
                isinstance(msg, AIMessage)
                and hasattr(msg, "tool_calls")
                and msg.tool_calls
            ):
                # AIMessage: 保留文字内容，去掉 tool_calls 元数据
                # 使用相同 id → add_messages reducer 会原地替换而非追加
                msg_updates.append(AIMessage(content=msg.content or "", id=msg.id))

        if msg_updates:
            result["messages"] = msg_updates

    return result


def router_function(state: AgentState) -> str:
    """Conditional edge routing: reads current_phase and routes to the matching agent node."""
    current_phase = state.get("current_phase", Phase.DESIGN)
    return current_phase.value if isinstance(current_phase, Phase) else current_phase
