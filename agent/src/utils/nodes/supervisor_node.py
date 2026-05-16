from src.utils.state import AgentState, Phase


def supervisor_node(state: AgentState):
    """
    Supervisor/Dispatcher Node: Decides which Agent to call next based on the current state and progress.
    """
    # Get the current execution phase, default is INIT
    current_phase = state.get("current_phase", Phase.INIT)

    # 停止自动切换逻辑，完全遵循当前阶段 (current_phase)
    # 只有在 INIT 状态下默认指向 DESIGN
    if not current_phase or current_phase == Phase.INIT:
        next_agent = Phase.DESIGN
    else:
        next_agent = current_phase

    return {
        "current_phase": next_agent,
        "next_agent": next_agent,
    }


def router_function(state: AgentState) -> str:
    """Conditional edge routing function: Reads the supervisor's decision and routes accordingly"""
    next_agent = state.get("next_agent", Phase.DESIGN)
    return next_agent.value if isinstance(next_agent, Phase) else next_agent
