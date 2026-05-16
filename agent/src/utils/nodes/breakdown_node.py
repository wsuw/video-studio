from typing import TypedDict
from src.utils.state import AgentState, Phase
from langchain.agents import create_agent
from copilotkit import CopilotKitMiddleware
from langchain_ollama import ChatOllama


# ==========================================
# 1. Define Models
# ==========================================
# (No tools/models for now to avoid schema issues)


# ==========================================
# 2. Define Breakdown Agent
# ==========================================
model = ChatOllama(model="gemma4:26b", model_kwargs={"parallel_tool_calls": True})

breakdown_node = create_agent(
    model=model,
    tools=[],  # Removed tool to avoid Pydantic schema error
    middleware=[
        CopilotKitMiddleware(),
    ],
    state_schema=AgentState,
    system_prompt="""You are the Film Director (Director Node). 
Your mission is to read the script and perform a 'Scene Breakdown'.
1. Identify the key visual beats and shots required to tell the story.
2. For each shot, provide a vivid narrative description.
3. Simply output the breakdown as text for now.""",
)
