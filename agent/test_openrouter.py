import os
import sys
from dotenv import load_dotenv
from langchain_openrouter import ChatOpenRouter
from langchain_core.messages import HumanMessage, SystemMessage

# Support UTF-8 output on Windows if possible
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def test_openrouter():
    print("[INFO] Loading .env configuration...")
    load_dotenv()

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        print("[ERROR] OPENROUTER_API_KEY is not set in your .env file!")
        return

    # Using the requested model
    model_name = "google/gemma-4-31b-it:free"



    
    print(f"[INFO] Initializing ChatOpenRouter with model: '{model_name}'...")
    try:
        model = ChatOpenRouter(
            model=model_name,
            api_key=api_key,
            temperature=0.3,
            max_tokens=1024,
            max_retries=2,
        )
        
        messages = [
            SystemMessage(content="You are a helpful AI coding assistant."),
            HumanMessage(content="Hello! Please introduce yourself, tell me your model name, and verify if you can receive this message successfully.")
        ]
        
        print("[INFO] Sending request to OpenRouter API (this may take a few seconds)...")
        response = model.invoke(messages)
        
        print("\n[SUCCESS] Response received from OpenRouter:")
        print("=" * 60)
        print(response.content)
        print("=" * 60)
        
    except Exception as e:
        import traceback
        print(f"\n[ERROR] Occurred while calling OpenRouter API: {e}")
        traceback.print_exc()


if __name__ == "__main__":
    test_openrouter()
