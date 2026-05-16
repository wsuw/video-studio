from src.utils.state import AgentState, Phase
from langgraph.graph import END


def supervisor_node(state: AgentState):
    """
    Supervisor/Dispatcher Node: Decides which Agent to call next based on the current state and progress.
    """
    # Get the current execution phase, default is INIT
    current_phase = state.get("current_phase", Phase.INIT)
    design = state.get("design", {})
    is_approved = design.get("is_approved", False)
    script = design.get("script", "")
    scenes = design.get("scenes", [])

    # Simple rule-based routing logic.
    # In practice, this could also let the LLM judge state["messages"] to decide the transition.

    if not current_phase or current_phase == Phase.INIT:
        next_agent = Phase.DESIGN
    elif current_phase == Phase.DESIGN:
        # If the script exists, proceed to the storyboard phase
        if script:
            next_agent = Phase.STORYBOARD
        else:
            next_agent = Phase.DESIGN
    elif current_phase == Phase.STORYBOARD:
        # If storyboards are complete, proceed to the generation phase
        if scenes:
            next_agent = Phase.GENERATE
        else:
            next_agent = Phase.STORYBOARD
    elif current_phase == Phase.GENERATE:
        next_agent = Phase.REDESIGN
    elif current_phase == Phase.REDESIGN:
        next_agent = Phase.END
    else:
        next_agent = Phase.END

    return {
        "current_phase": next_agent if next_agent != Phase.END else current_phase,
        "next_agent": next_agent,
    }


def router_function(state: AgentState) -> str:
    """Conditional edge routing function: Reads the supervisor's decision and routes accordingly"""
    next_agent = state.get("next_agent", Phase.DESIGN)
    return next_agent.value if isinstance(next_agent, Phase) else next_agent
