import os
import re
from typing import Any, Optional
from langchain_openrouter import ChatOpenRouter
from langchain_core.messages import HumanMessage


# ==========================================
# 1. LLM Model Factory (Ollama, OpenAI, Anthropic, DeepSeek, OpenRouter)
# ==========================================
def get_model(parallel_tool_calls: bool = True) -> Any:
    """
    Model factory that returns the configured LLM (Ollama or DeepSeek).

    Configure via environment variables:
      - LLM_PROVIDER: "ollama" (default) or "deepseek"
      - OLLAMA_MODEL: e.g., "gemma4:26b" (default)
      - DEEPSEEK_MODEL: e.g., "deepseek-chat"
      - DEEPSEEK_API_KEY: your_deepseek_api_key
      - DEEPSEEK_API_BASE: e.g., "https://api.deepseek.com"
    """
    provider = os.getenv("LLM_PROVIDER", "ollama").lower()

    if provider == "deepseek":
        from langchain_deepseek import ChatDeepSeek

        model_name = os.getenv("DEEPSEEK_MODEL")
        api_key = os.getenv("DEEPSEEK_API_KEY")
        api_base = os.getenv("DEEPSEEK_API_BASE")
        print(
            f"[LLM Factory] 🤖 Loading ChatDeepSeek model='{model_name}' (api_base='{api_base}')"
        )
        return ChatDeepSeek(
            model=model_name,
            api_key=api_key,
            api_base=api_base,
        )

    elif provider == "openrouter":
        model_name = os.getenv("OPENROUTER_LLM_MODEL")
        api_key = os.getenv("OPENROUTER_API_KEY")
        print(f"[LLM Factory] 🤖 Loading ChatOpenRouter model='{model_name}'")

        return ChatOpenRouter(
            model=model_name,
            api_key=api_key,
            temperature=0,
            max_tokens=1024,
            max_retries=2,
        )

    else:
        from langchain_ollama import ChatOllama

        model_name = os.getenv("OLLAMA_MODEL", "gemma4:26b")

        print(
            f"[LLM Factory] 🤖 Loading ChatOllama model='{model_name}' (parallel_tool_calls={parallel_tool_calls})"
        )
        return ChatOllama(
            model=model_name, model_kwargs={"parallel_tool_calls": parallel_tool_calls}
        )


# ==========================================
# 2. Local Flux & OpenRouter Video Generation
# ==========================================
def generate_image(prompt: str, entity_type: str = "character") -> str:
    """
    Generate an image using the local Flux.2 Klein server (running on port 8124).
    If it is offline or fails, falls back to high-quality curated illustrations.
    """
    # Deterministic beautiful fallback image dataset if generation fails
    FALLBACK_PORTRAITS = {
        "character": [
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400&h=400",
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400&h=400",
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400&h=400",
            "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400&h=400",
        ],
        "prop": [
            "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=400&h=400",
            "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=400&h=400",
            "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=400&h=400",
        ],
        "location": [
            "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&q=80&w=400&h=400",
            "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&q=80&w=400&h=400",
            "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&q=80&w=400&h=400",
        ],
    }

    import hashlib
    import time
    import requests

    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(current_dir, "..", ".."))
    outputs_dir = os.path.join(project_root, "public", "images", "outputs")
    os.makedirs(outputs_dir, exist_ok=True)

    filename = f"portrait_{hashlib.md5(prompt.encode('utf-8')).hexdigest()[:12]}_{int(time.time())}.png"
    absolute_output_path = os.path.join(outputs_dir, filename)
    web_url = f"/images/outputs/{filename}"

    flux_server_url = "http://localhost:8124/generate"
    print(f"[Image Factory] 🎨 Contacting local Flux.2 Klein server at {flux_server_url} for prompt: '{prompt[:50]}'...")

    try:
        response = requests.post(
            flux_server_url,
            json={
                "prompt": prompt,
                "height": 1024,
                "width": 1024,
                "guidance_scale": 1.0,
                "num_inference_steps": 4,
                "seed": 0,
                "output_path": absolute_output_path
            },
            timeout=120
        )
        if response.status_code == 200:
            print(f"[Image Factory] ✅ Successfully generated portrait using local Flux server: {web_url}")
            return web_url
        else:
            print(f"[Image Factory] ⚠️ Flux server returned status {response.status_code}: {response.text}")
    except Exception as e:
        print(f"[Image Factory] ⚠️ Failed to connect to local Flux server: {e}")

    # Fallback to curated illustrations
    print("[Image Factory] ℹ️ Falling back to curated concept illustration.")
    val = sum(ord(c) for c in prompt)
    options = FALLBACK_PORTRAITS.get(entity_type, FALLBACK_PORTRAITS["character"])
    return options[val % len(options)]



def generate_video_via_openrouter(prompt: str) -> str:
    """
    Generate video cinematic sequences using OpenRouter's video generation models (e.g. runway/gen3 or luma/ray-v2) via ChatOpenRouter.
    """

    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("OPENROUTER_VIDEO_MODEL", "luma/ray-v2")

    # High quality fallback video if not configured
    fallback_video = "https://assets.mixkit.co/videos/preview/mixkit-cyberpunk-city-street-with-neon-lights-at-night-41586-large.mp4"

    if not api_key:
        print(
            "[OpenRouter API] ⚠️ OPENROUTER_API_KEY is not configured in .env. Using fallback cinematic video sequence."
        )
        return fallback_video

    print(
        f"[OpenRouter API] 🎬 Calling OpenRouter Video model='{model}' via ChatOpenRouter for prompt: '{prompt[:50]}'"
    )
    try:
        llm = ChatOpenRouter(
            model=model,
            api_key=api_key,
        )

        response = llm.invoke([HumanMessage(content=prompt)])
        content = response.content
        print(
            f"[OpenRouter API] 📥 Received ChatOpenRouter video response content: {content}"
        )

        # Regex to extract the first HTTP/HTTPS URL from response
        urls = re.findall(r"https?://[^\s\)\]]+", content)
        if urls:
            video_url = urls[0]
            print(f"[OpenRouter API] ✅ Extracted generated video URL: {video_url}")
            return video_url

        print(
            f"[OpenRouter API] ❌ No valid video URL found in ChatOpenRouter response."
        )
    except Exception as e:
        print(f"[OpenRouter API] ❌ Exception occurred while using ChatOpenRouter: {e}")

    return fallback_video
