from typing import Annotated
from langchain.tools import tool
from langgraph.prebuilt import InjectedState
from langgraph.prebuilt.tool_node import _get_all_injected_args

@tool
def my_tool(state: Annotated[dict, InjectedState]):
    """Docstring 1."""
    pass

print('Class:', _get_all_injected_args(my_tool))

@tool
def my_tool2(state: Annotated[dict, InjectedState()]):
    """Docstring 2."""
    pass

print('Instance:', _get_all_injected_args(my_tool2))
