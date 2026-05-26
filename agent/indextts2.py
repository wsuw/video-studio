import os
import sys
import time
import uuid
import requests
from typing import Optional, List
from dotenv import load_dotenv

from minio import get_storage_client, S3StorageClient


# Ensure script dir is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load env variables
load_dotenv(
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
)


def download_file(url: str, dest_path: str):
    """Download a file from a URL to a local destination."""
    os.makedirs(os.path.dirname(os.path.abspath(dest_path)), exist_ok=True)
    with requests.get(url, stream=True) as r:
        r.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)


def generate_tts_audio(
    text: str,
    spk_audio_prompt: str,
    emo_audio_prompt: Optional[str] = None,
    emo_alpha: float = 1.0,
    emo_vector: Optional[List[float]] = None,
    use_emo_text: bool = False,
    emo_text: Optional[str] = None,
    use_random: bool = False,
    interval_silence: int = 200,
    request=None,
) -> dict:
    """
    Calls the local IndexTTS2 API service (running at port 8000), uploads the generated
    WAV file to S3/MinIO via storage_minio, cleans up all local temp files, and returns
    a dictionary containing status, timing, local path reference, and direct public URL.
    """
    print(f"[{time.strftime('%H:%M:%S')}] Generating TTS audio for: '{text[:30]}...'")
    start_time = time.time()

    temp_files_to_cleanup = []

    try:
        # 1. Resolve speaker audio prompt (local file path vs. web URL)
        spk_path = spk_audio_prompt
        if spk_path.startswith("http://") or spk_path.startswith("https://"):
            local_spk = os.path.join("outputs", f"spk_ref_{uuid.uuid4().hex}.wav")
            print(f"Downloading speaker prompt URL -> {local_spk}")
            download_file(spk_path, local_spk)
            spk_path = os.path.abspath(local_spk)
            temp_files_to_cleanup.append(spk_path)
        else:
            # Check if local file exists
            if not os.path.exists(spk_path):
                spk_path = os.path.abspath(spk_path)
                if not os.path.exists(spk_path):
                    # Also try relative to index-tts directory
                    index_tts_spk = os.path.join(
                        "D:\\AntigravityProject\\index-tts", spk_audio_prompt
                    )
                    if os.path.exists(index_tts_spk):
                        spk_path = index_tts_spk
                    else:
                        raise FileNotFoundError(
                            f"Speaker reference audio file not found: {spk_audio_prompt}"
                        )

        # 2. Resolve emotion audio prompt (if provided)
        emo_path = emo_audio_prompt
        if emo_path:
            if emo_path.startswith("http://") or emo_path.startswith("https://"):
                local_emo = os.path.join("outputs", f"emo_ref_{uuid.uuid4().hex}.wav")
                print(f"Downloading emotion prompt URL -> {local_emo}")
                download_file(emo_path, local_emo)
                emo_path = os.path.abspath(local_emo)
                temp_files_to_cleanup.append(emo_path)
            else:
                if not os.path.exists(emo_path):
                    emo_path = os.path.abspath(emo_path)
                    if not os.path.exists(emo_path):
                        index_tts_emo = os.path.join(
                            "D:\\AntigravityProject\\index-tts", emo_audio_prompt
                        )
                        if os.path.exists(index_tts_emo):
                            emo_path = index_tts_emo
                        else:
                            raise FileNotFoundError(
                                f"Emotion reference audio file not found: {emo_audio_prompt}"
                            )

        # 3. Call the IndexTTS2 api.py service
        wan2gp_api_url = os.getenv("WAN2GP_API_URL")
        if wan2gp_api_url:
            index_tts_url = f"{wan2gp_api_url.rstrip('/')}/generate/audio"
        else:
            index_tts_url = os.getenv(
                "INDEX_TTS_API_URL", "http://127.0.0.1:8126/generate/audio"
            )

        payload = {
            "text": text,
            "spk_audio_prompt": spk_path,
            "emo_audio_prompt": emo_path,
            "emo_alpha": emo_alpha,
            "emo_vector": emo_vector,
            "use_emo_text": use_emo_text,
            "emo_text": emo_text,
            "use_random": use_random,
            "interval_silence": interval_silence,
        }

        response = requests.post(index_tts_url, json=payload, timeout=180)

        if response.status_code != 200:
            error_detail = response.text
            try:
                error_detail = response.json().get("detail", response.text)
            except:
                pass
            raise Exception(
                f"IndexTTS2 API synthesis failed ({response.status_code}): {error_detail}"
            )

        # 4. Save the generated WAV file locally
        storage_client = get_storage_client()
        local_output_path = storage_client.generate_unique_path("wav")

        # Check if the response contains JSON with a pre-uploaded S3 or hosted URL
        is_json = False
        res_json = None
        try:
            if "application/json" in response.headers.get("content-type", "").lower():
                res_json = response.json()
                is_json = True
        except:
            pass

        if is_json and res_json and "url" in res_json:
            web_url = res_json["url"]
            if web_url.startswith("/"):
                from urllib.parse import urlparse
                parsed = urlparse(index_tts_url)
                web_url = f"{parsed.scheme}://{parsed.netloc}{web_url}"
            print(f"IndexTTS2 server returned JSON response with URL: {web_url}. Downloading to local cache...")
            download_file(web_url, local_output_path)
            # Re-upload to ensure it goes to client's configured storage client/bucket if needed
            web_url = storage_client.upload_file(local_output_path, request=request)
        else:
            with open(local_output_path, "wb") as f:
                f.write(response.content)
            # 5. Direct upload to MinIO/S3 and get URL
            web_url = storage_client.upload_file(local_output_path, request=request)

        # 6. Cleanup temporary local WAV file if S3 is active
        if isinstance(storage_client, S3StorageClient):
            if os.path.exists(local_output_path):
                os.remove(local_output_path)

        elapsed = time.time() - start_time
        print(
            f"[{time.strftime('%H:%M:%S')}] TTS successfully generated in {elapsed:.2f}s! S3 URL: {web_url}"
        )

        return {
            "status": "success",
            "elapsed_seconds": round(elapsed, 2),
            "output_path": local_output_path,
            "url": web_url,
        }

    finally:
        # Cleanup temporary downloaded files
        for temp_file in temp_files_to_cleanup:
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except Exception as ex:
                    print(f"Error cleaning up temp file {temp_file}: {ex}")


if __name__ == "__main__":
    print("Testing indextts2 local calling function...")
    try:
        # Run a simple test using the official voice examples
        res = generate_tts_audio(
            text="你好，这是通过本地 Python 工具类调用 IndexTTS2 引擎并上传到 MinIO 的音频测试！",
            spk_audio_prompt="D:\\AntigravityProject\\index-tts\\examples\\voice_01.wav",
        )
        print("Test successful! Result:")
        print(res)
    except Exception as e:
        print(f"Test failed: {e}")
