from src.utils.state import AgentState, Phase
from langgraph.graph import END


def supervisor_node(state: AgentState):
    """
    主管/调度节点：根据当前状态和进度，决定下一步调用哪个 Agent。
    """
    # 获取当前的执行阶段，默认为 INIT
    current_phase = state.get("current_phase", Phase.INIT)
    is_approved = state.get("is_approved", False)
    script = state.get("script", "")

    # 简单的基于规则的路由逻辑
    # 实际应用中，这里也可以通过让 LLM 判断 state["messages"] 来决定跳转

    if not current_phase or current_phase == Phase.INIT:
        next_agent = Phase.DESIGN
    elif current_phase == Phase.DESIGN:
        if is_approved or script:
            next_agent = Phase.GENERATE
        else:
            next_agent = Phase.DESIGN  # 没通过则继续留在此阶段或交给用户
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
    """条件边路由函数：读取 supervisor 的决定并进行路由"""
    next_agent = state.get("next_agent", Phase.DESIGN)
    return next_agent.value if isinstance(next_agent, Phase) else next_agent
