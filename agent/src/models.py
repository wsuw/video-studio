import os
import re
from typing import Any, Optional
from langchain_openrouter import ChatOpenRouter
from langchain_core.messages import HumanMessage
from dotenv import load_dotenv

# Load environment variables from root .env file (2 levels up from agent/src/)
current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.abspath(os.path.join(current_dir, "..", "..", ".env"))
load_dotenv(env_path)


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
            f"[LLM Factory] [INFO] Loading ChatDeepSeek model='{model_name}' (api_base='{api_base}')"
        )
        return ChatDeepSeek(
            model=model_name,
            api_key=api_key,
            api_base=api_base,
        )

    elif provider == "openrouter":
        model_name = os.getenv("OPENROUTER_LLM_MODEL")
        api_key = os.getenv("OPENROUTER_API_KEY")
        print(f"[LLM Factory] [INFO] Loading ChatOpenRouter model='{model_name}'")

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
        ollama_base_url = os.getenv("OLLAMA_BASE_URL")

        print(
            f"[LLM Factory] [INFO] Loading ChatOllama model='{model_name}' (base_url='{ollama_base_url}', parallel_tool_calls={parallel_tool_calls})"
        )
        
        kwargs = {
            "model": model_name,
            "model_kwargs": {"parallel_tool_calls": parallel_tool_calls}
        }
        if ollama_base_url:
            kwargs["base_url"] = ollama_base_url
            
        return ChatOllama(**kwargs)


# ==========================================
# 2. Local Flux.2-klein & OpenRouter Video Generation
# ==========================================
def generate_image(prompt: str, entity_type: str = "character") -> str:
    """
    Generate an image using the local Flux.2-klein server.
    Raises an exception if it is offline or fails, allowing the client to show errors.
    """
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

    wan2gp_api_url = os.getenv("WAN2GP_API_URL")
    if wan2gp_api_url:
        flux_server_url = f"{wan2gp_api_url.rstrip('/')}/generate/image"
    else:
        flux_server_url = os.getenv("FLUX_SERVER_URL", "http://127.0.0.1:8126/generate/image")

    print(f"[Image Factory] [INFO] Contacting image server at {flux_server_url} for prompt: '{prompt[:50]}'...")

    is_unified = "/generate/image" in flux_server_url

    try:
        if is_unified:
            payload = {
                "prompt": prompt,
                "model_type": "flux",
                "resolution": "1024x1024",
                "custom_settings": {
                    "guidance_scale": 1.0,
                    "num_inference_steps": 4,
                    "seed": 0
                }
            }
        else:
            payload = {
                "prompt": prompt,
                "height": 1024,
                "width": 1024,
                "guidance_scale": 1.0,
                "num_inference_steps": 4,
                "seed": 0,
                "output_path": absolute_output_path
            }

        response = requests.post(
            flux_server_url,
            json=payload,
            timeout=120
        )
        if response.status_code == 200:
            res_json = response.json()
            generated_url = res_json.get("url") or (res_json.get("files") and res_json.get("files")[0])
            
            # If the URL is relative, prepend the host of the server
            if generated_url and generated_url.startswith("/"):
                from urllib.parse import urlparse
                parsed = urlparse(flux_server_url)
                generated_url = f"{parsed.scheme}://{parsed.netloc}{generated_url}"
                
            if generated_url:
                print(f"[Image Factory] [SUCCESS] Successfully generated portrait using local server: {generated_url}")
                return generated_url
            print(f"[Image Factory] [SUCCESS] Successfully generated portrait using local server, but 'url'/'files' not in response. Using legacy web_url: {web_url}")
            return web_url
        else:
            raise RuntimeError(f"Flux server returned status {response.status_code}: {response.text}")
    except Exception as e:
        print(f"[Image Factory] [ERROR] Failed to generate image via Flux server: {e}")
        raise e



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
            "[OpenRouter API] [WARNING] OPENROUTER_API_KEY is not configured in .env. Using fallback cinematic video sequence."
        )
        return fallback_video

    print(
        f"[OpenRouter API] [INFO] Calling OpenRouter Video model='{model}' via ChatOpenRouter for prompt: '{prompt[:50]}'"
    )
    try:
        llm = ChatOpenRouter(
            model=model,
            api_key=api_key,
        )

        response = llm.invoke([HumanMessage(content=prompt)])
        content = response.content
        print(
            f"[OpenRouter API] [INFO] Received ChatOpenRouter video response content: {content}"
        )

        # Regex to extract the first HTTP/HTTPS URL from response
        urls = re.findall(r"https?://[^\s\)\]]+", content)
        if urls:
            video_url = urls[0]
            print(f"[OpenRouter API] [SUCCESS] Extracted generated video URL: {video_url}")
            return video_url

        print(
            f"[OpenRouter API] [ERROR] No valid video URL found in ChatOpenRouter response."
        )
    except Exception as e:
        print(f"[OpenRouter API] [ERROR] Exception occurred while using ChatOpenRouter: {e}")

    return fallback_video
