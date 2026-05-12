from typing import TypedDict, Literal
from langchain.agents import AgentState as BaseAgentState
from copilotkit import CopilotKitState


class Todo(TypedDict):
    id: str
    title: str
    description: str
    emoji: str
    status: Literal["pending", "completed"]


class AgentState(BaseAgentState, CopilotKitState):
    todos: list[Todo]
