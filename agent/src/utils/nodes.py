# LangChain Agent components
from langchain.agents import create_agent

# CopilotKit Middleware
from copilotkit import CopilotKitMiddleware, StateStreamingMiddleware, StateItem

# Models & Tools
from langchain_ollama import ChatOllama
from src.test.query import query_data
from src.test.todos import todo_tools
from src.test.a2ui_dynamic_schema import generate_a2ui
from src.test.a2ui_fixed_schema import search_flights


model = ChatOllama(model="gemma4:26b", model_kwargs={"parallel_tool_calls": False})

agent = create_agent(
    model=model,
    tools=[query_data, *todo_tools, generate_a2ui, search_flights],
    middleware=[
        CopilotKitMiddleware(),
        StateStreamingMiddleware(
            StateItem(state_key="todos", tool="manage_todos", tool_argument="todos")
        ),
    ],
    system_prompt="""
        You are a polished, professional demo assistant. Keep responses to 1-2 sentences.

        Tool guidance:
        - Flights: call search_flights to show flight cards with a pre-built schema.
        - Dashboards & rich UI: call generate_a2ui to create dashboard UIs with metrics,
          charts, tables, and cards. It handles rendering automatically.
        - Charts: call query_data first, then render with the chart component.
        - Todos: enable app mode first, then manage todos.
        - A2UI actions: when you see a log_a2ui_event result (e.g. "view_details"),
          respond with a brief confirmation. The UI already updated on the frontend.
    """,
)
