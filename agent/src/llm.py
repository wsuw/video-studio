import os
from typing import Any


# Lazy-load model classes to prevent import crashes if optional packages are not installed
def get_model(parallel_tool_calls: bool = True) -> Any:
    """
    Unified model factory to centralize LLM configuration.
    Allows seamless switching between Ollama, OpenAI, and Anthropic.

    Configure via environment variables:
      - LLM_PROVIDER: "ollama" (default), "openai", or "anthropic"
      - OLLAMA_MODEL: e.g., "gemma4:26b" (default)
      - OPENAI_MODEL: e.g., "gpt-4o"
      - ANTHROPIC_MODEL: e.g., "claude-3-5-sonnet-latest"
    """
    provider = os.getenv("LLM_PROVIDER", "ollama").lower()

    if provider == "ollama":
        from langchain_ollama import ChatOllama

        model_name = os.getenv("OLLAMA_MODEL", "gemma4:26b")
        print(
            f"[LLM Factory] 🤖 Loading ChatOllama model='{model_name}' (parallel_tool_calls={parallel_tool_calls})"
        )
        return ChatOllama(
            model=model_name, model_kwargs={"parallel_tool_calls": parallel_tool_calls}
        )

    elif provider == "openai":
        from langchain_openai import ChatOpenAI

        model_name = os.getenv("OPENAI_MODEL", "gpt-4o")
        print(f"[LLM Factory] 🤖 Loading ChatOpenAI model='{model_name}'")
        return ChatOpenAI(
            model=model_name,
            temperature=0.2,
        )

    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        model_name = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")
        print(f"[LLM Factory] 🤖 Loading ChatAnthropic model='{model_name}'")
        return ChatAnthropic(
            model=model_name,
            temperature=0.2,
        )

    else:
        # Fallback to Ollama
        from langchain_ollama import ChatOllama

        print(
            f"[LLM Factory] ⚠️ Unknown provider '{provider}'. Falling back to ChatOllama (gemma4:26b)"
        )
        return ChatOllama(
            model="gemma4:26b",
            model_kwargs={"parallel_tool_calls": parallel_tool_calls},
        )
