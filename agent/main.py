# agent/main.py
from langgraph.graph import StateGraph, END, START
from src.utils.state import AgentState
from src.utils.nodes.design_node import design_node
from src.utils.nodes.generation_node import generation_node
from src.utils.nodes.redesign_node import redesign_node
from src.utils.nodes.supervisor_node import supervisor_node, router_function
from src.test.main import agent

# 1. 定义工作流结构
workflow = StateGraph(AgentState)

# 2. 注册节点
workflow.add_node("supervisor", supervisor_node)
workflow.add_node("design", design_node)
workflow.add_node("generate", generation_node)
workflow.add_node("redesign", redesign_node)
workflow.add_node("agent", agent)


# 3. 设置流转逻辑 (Supervisor 模式)
workflow.add_edge(START, "agent")
workflow.add_edge("agent", "supervisor")

# 基于 supervisor 输出的 next_agent 路由到具体节点
workflow.add_conditional_edges(
    "supervisor",
    router_function,
    {
        "design": "design",
        "generate": "generate",
        "redesign": "redesign",
        "__end__": END,
    },
)

# 各个 agent 节点执行完毕后，返回 supervisor 进行下一轮判断
workflow.add_edge("design", "supervisor")
workflow.add_edge("generate", "supervisor")
workflow.add_edge("redesign", "supervisor")

# 4. 编译工作流 (不在此处配置 checkpointer，由 langgraph dev 托管)
graph = workflow.compile(interrupt_before=["generate"])
