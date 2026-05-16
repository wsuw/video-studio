# agent/main.py
from langgraph.graph import StateGraph, END, START
from src.utils.state import AgentState
from src.utils.nodes.design_node import design_node
from src.utils.nodes.director_node import director_node
from src.utils.nodes.storyboard_node import storyboard_node
from src.utils.nodes.generation_node import generation_node
from src.utils.nodes.redesign_node import redesign_node
from src.utils.nodes.supervisor_node import supervisor_node, router_function

# 1. 定义工作流结构
workflow = StateGraph(AgentState)

# 2. 注册节点
workflow.add_node("supervisor", supervisor_node)
workflow.add_node("design", design_node)
workflow.add_node("breakdown", director_node)
workflow.add_node("storyboard", storyboard_node)
workflow.add_node("generate", generation_node)
workflow.add_node("redesign", redesign_node)


# 3. 设置流转逻辑 (Supervisor 模式)
workflow.add_edge(START, "supervisor")

# 基于 supervisor 输出的 next_agent 路由到具体节点
workflow.add_conditional_edges(
    "supervisor",
    router_function,
    {
        "design": "design",
        "breakdown": "breakdown",
        "storyboard": "storyboard",
        "generate": "generate",
        "redesign": "redesign",
        "__end__": END,
    },
)

workflow.add_edge("design", END)
workflow.add_edge("breakdown", END)
workflow.add_edge("storyboard", END)
workflow.add_edge("generate", END)
workflow.add_edge("redesign", END)

# 4. 编译工作流 (不在此处配置 checkpointer，由 langgraph dev 托管)
graph = workflow.compile()
