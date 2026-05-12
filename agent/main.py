# 1. 导入 LangGraph 基础组件和自定义的状态/节点
from langgraph.graph import StateGraph, END, START
from src.utils.state import AgentState
from src.utils.nodes import agent

# 2. 初始化状态机：传入定义好的 AgentState 作为数据结构
workflow = StateGraph(AgentState)

# 3. 注册节点：将定义好的 agent (大脑) 作为一个处理节点加入图中
workflow.add_node("agent", agent)

# 4. 设置流转逻辑：
#    - 从起点 (START) 直接进入 agent 节点
#    - agent 节点处理完后，直接进入终点 (END)
workflow.add_edge(START, "agent")
workflow.add_edge("agent", END)

# 5. 编译图：将定义好的逻辑转换为可执行的 graph 对象
graph = workflow.compile()
