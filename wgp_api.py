import os
import sys
import uuid
import shutil
import logging
import mimetypes
from pathlib import Path
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import uvicorn

# 🚀 1. 加载 .env 配置
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

# 🚀 2. 配置日志
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("Wan2GP-Microservice")

# 🚀 3. 强行将 Wan2GP 的真实路径注入进来，以导入其底层 API
WAN2GP_DIR = r"D:/AntigravityProject/Wan2GP"
if WAN2GP_DIR not in sys.path:
    sys.path.insert(0, WAN2GP_DIR)

from shared.api import init, GenerationResult

# 🚀 4. 初始化 FastAPI 服务并挂载本地输出目录以支持静态托管
app = FastAPI(
    title="Wan2GP Unified API Microservice",
    description="整合了高超的音视频生成能力与 MinIO/S3 资产存储的统一微服务。",
    version="2.0.0",
)

os.makedirs("outputs", exist_ok=True)
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# 🚀 5. 初始化 Wan2GP 推理会话（使用高度优化的硬件加速参数，避免 VRAM 撑爆）
logger.info("Initializing Wan2GP session...")
session = init(
    root=Path(WAN2GP_DIR),
    cli_args=["--attention", "sdpa"],
)
logger.info("Wan2GP session initialized successfully!")


# ==========================================
# 内联存储客户端（支持本地静态文件 / MinIO S3 桶）
# ==========================================


class StorageClient:
    def generate_unique_path(self, extension: str) -> str:
        raise NotImplementedError

    def upload_file(self, local_path: str, request=None) -> str:
        raise NotImplementedError


class LocalStorageClient(StorageClient):
    def generate_unique_path(self, extension: str) -> str:
        if not extension.startswith("."):
            extension = f".{extension}"
        os.makedirs("outputs", exist_ok=True)
        return os.path.join("outputs", f"{uuid.uuid4()}{extension}")

    def upload_file(self, local_path: str, request=None) -> str:
        filename = os.path.basename(local_path)
        dest_path = os.path.join("outputs", filename)
        if os.path.abspath(local_path) != os.path.abspath(dest_path):
            os.makedirs("outputs", exist_ok=True)
            shutil.copy2(local_path, dest_path)
        if request:
            base_url = str(request.base_url)
            return f"{base_url.rstrip('/')}/outputs/{filename}"
        return f"/outputs/{filename}"


class S3StorageClient(StorageClient):
    def __init__(self):
        import boto3
        from botocore.config import Config

        self.endpoint = os.getenv("STORAGE_S3_ENDPOINT", "http://127.0.0.1:9000")
        self.access_key = os.getenv("STORAGE_S3_ACCESS_KEY", "minioadmin")
        self.secret_key = os.getenv("STORAGE_S3_SECRET_KEY", "minioadmin")
        self.bucket_name = os.getenv("STORAGE_S3_BUCKET", "video-studio")
        self.public_url = os.getenv("STORAGE_S3_PUBLIC_URL")
        self.s3 = boto3.client(
            "s3",
            endpoint_url=self.endpoint,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
            region_name="us-east-1",
        )

    def generate_unique_path(self, extension: str) -> str:
        if not extension.startswith("."):
            extension = f".{extension}"
        os.makedirs("outputs", exist_ok=True)
        return os.path.join("outputs", f"{uuid.uuid4()}{extension}")

    def upload_file(self, local_path: str, request=None) -> str:
        filename = os.path.basename(local_path)
        content_type, _ = mimetypes.guess_type(local_path)
        if not content_type:
            content_type = "application/octet-stream"
        with open(local_path, "rb") as f:
            self.s3.put_object(
                Bucket=self.bucket_name,
                Key=filename,
                Body=f,
                ContentType=content_type,
            )
        public_url = (
            os.getenv("STORAGE_S3_PUBLIC_URL") or self.public_url or self.endpoint
        )
        return f"{public_url.rstrip('/')}/{self.bucket_name}/{filename}"


def get_storage_client() -> StorageClient:
    backend = os.getenv("STORAGE_BACKEND", "local").lower()
    if backend == "s3":
        return S3StorageClient()
    return LocalStorageClient()


# ==========================================
# 辅助函数
# ==========================================


def resolve_audio_path(audio_path: str) -> Optional[str]:
    """按优先级定位参考音频文件所在的位置"""
    if not audio_path:
        return None
    candidates = [
        audio_path,
        os.path.join(_SCRIPT_DIR, audio_path),
        os.path.join(os.getcwd(), audio_path),
    ]
    for c in candidates:
        if os.path.exists(c):
            logger.info(f"Resolved reference audio path: '{audio_path}' -> '{c}'")
            return os.path.abspath(c)
    return None


# ==========================================
# 数据校验 Schema 结构体
# ==========================================


class GenerateRequest(BaseModel):
    prompt: str = Field(..., description="生成媒体的文本提示词")
    model_type: str = Field(
        "index_tts2", description="使用的生成模型类型 (e.g. index_tts2, ltx2)"
    )
    resolution: str = Field("832x480", description="画面分辨率")
    duration_seconds: float = Field(25.0, description="最大生成时间限制 (秒)")
    custom_settings: Optional[Dict[str, Any]] = Field(
        None, description="自定义额外微调配置项"
    )


class TTSRequest(BaseModel):
    text: str = Field(..., description="要合成的文本脚本")
    spk_audio_prompt: str = Field(
        ...,
        description="音色参考音频文件路径，例如 'speech-samples/en-US_Female_Adult.wav'",
    )
    emo_audio_prompt: Optional[str] = Field(
        None, description="情绪参考音频文件路径 (选填)"
    )
    emo_alpha: float = Field(
        1.0, ge=0.0, le=1.0, description="情绪融合度比例 (0.0 - 1.0)"
    )
    emo_vector: Optional[List[float]] = Field(None, description="8维情绪引导向量")
    use_emo_text: bool = Field(False, description="是否启用文本情感推导模式")
    emo_text: Optional[str] = Field(None, description="特定的情绪状态指令描述")
    use_random: bool = Field(False, description="推理生成中是否混入随机噪音采样")
    interval_silence: int = Field(200, description="断句间的静音时间间隔 (ms)")


# ==========================================
# API 路由接口定义
# ==========================================


@app.post("/generate")
async def generate_media(req: GenerateRequest, fastapi_req: Request):
    """
    通用音视频任务生成接口，通过设置 model_type 决定调用哪个模型，生成的文件自动上传并返回对外 URL
    """
    settings = {
        "model_type": req.model_type,
        "prompt": req.prompt,
        "resolution": req.resolution,
        "duration_seconds": req.duration_seconds,
        "force_fps": 24,
    }
    if req.custom_settings:
        settings.update(req.custom_settings)

    try:
        logger.info(f"Submitting media task to session: model_type={req.model_type}")
        job = session.submit_task(settings)
        result: GenerationResult = job.result()
        if not result.success:
            errors = [err.message for err in result.errors]
            raise HTTPException(status_code=500, detail=f"Generation failed: {errors}")

        storage_client = get_storage_client()
        is_remote = not isinstance(storage_client, LocalStorageClient)

        urls = []
        for file_path in result.generated_files:
            if os.path.exists(file_path):
                url = storage_client.upload_file(file_path, request=fastapi_req)
                urls.append(url)
                if is_remote:
                    try:
                        os.remove(file_path)
                    except Exception as ex:
                        logger.error(
                            f"Failed to delete temporary local file {file_path}: {ex}"
                        )

        return {"status": "success", "files": urls}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error during media generation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/synthesize")
async def synthesize(req: TTSRequest, fastapi_req: Request):
    """
    IndexTTS2 专属的高级声音克隆与多模态情感语音合成接口
    """
    logger.info(
        f"Received TTS synthesize request: text_len={len(req.text)}, spk='{req.spk_audio_prompt}'"
    )

    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    # 1. 定位音色克隆样本
    spk_path = resolve_audio_path(req.spk_audio_prompt)
    if not spk_path:
        raise HTTPException(
            status_code=400,
            detail=f"Speaker audio prompt file not found: {req.spk_audio_prompt}",
        )

    # 2. 定位情绪参考样本
    emo_audio_path = None
    if req.emo_audio_prompt:
        emo_audio_path = resolve_audio_path(req.emo_audio_prompt)
        if not emo_audio_path:
            raise HTTPException(
                status_code=400,
                detail=f"Emotion audio prompt file not found: {req.emo_audio_prompt}",
            )

    # 3. 情绪引导向量维数校验
    if req.emo_vector is not None and len(req.emo_vector) != 8:
        raise HTTPException(
            status_code=400,
            detail="emo_vector must contain exactly 8 float elements [happy, angry, sad, afraid, disgusted, melancholic, surprised, calm].",
        )

    # 4. 构建 Wan2GP 任务 settings，重组微调配置参数
    settings = {
        "model_type": "index_tts2",
        "prompt": req.text,
        "audio_guide": spk_path,
        "audio_guide2": emo_audio_path,
        "audio_prompt_type": "AB" if req.emo_audio_prompt else "A",
        "alt_prompt": req.emo_text if req.emo_text else "",
        "temperature": 0.8,
        "top_p": 0.8,
        "top_k": 30,
        "custom_settings": {
            "emo_alpha": req.emo_alpha,
            "emo_vector": req.emo_vector,
            "use_emo_text": req.use_emo_text,
            "emo_text": req.emo_text,
            "use_random": req.use_random,
            "interval_silence": req.interval_silence,
        },
    }

    try:
        logger.info("Submitting TTS task to high-performance session...")
        job = session.submit_task(settings)
        result: GenerationResult = job.result()
        if not result.success:
            errors = [err.message for err in result.errors]
            raise HTTPException(
                status_code=500, detail=f"TTS Synthesis Failed: {errors}"
            )

        if not result.generated_files:
            raise HTTPException(
                status_code=500,
                detail="Inference ran successfully but output WAV file list was empty.",
            )

        output_path = result.generated_files[0]

        # 5. 计算合成音频的时长(秒)
        import wave

        duration = 0.0
        try:
            with wave.open(output_path, "rb") as wav_file:
                frames = wav_file.getnframes()
                rate = wav_file.getframerate()
                if rate > 0:
                    duration = float(frames) / float(rate)
        except Exception as e:
            logger.error(f"Failed to calculate synthesized WAV duration: {e}")

        # 6. 利用配置好的存储客户端上传并返回可供访问的公开 URL
        storage_client = get_storage_client()
        url = storage_client.upload_file(output_path, request=fastapi_req)
        logger.info(f"Synthesized audio uploaded, URL: {url}")

        # 7. 若是远程 S3/MinIO 存储，即时删除本地临时文件释放磁盘空间
        is_remote = not isinstance(storage_client, LocalStorageClient)
        if is_remote and os.path.exists(output_path):
            try:
                os.remove(output_path)
            except Exception as ex:
                logger.error(
                    f"Failed to delete temporary local file {output_path}: {ex}"
                )

        filename = os.path.basename(output_path)
        return {
            "status": "success",
            "url": url,
            "filename": filename,
            "duration": round(duration, 3),
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error during IndexTTS2 synthesis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"TTS Synthesis Failed: {str(e)}")


@app.get("/health")
async def health_check():
    """
    微服务健康状况检查接口
    """
    storage_backend = os.getenv("STORAGE_BACKEND", "local").lower()
    return {
        "status": "healthy",
        "engine": "Wan2GP (Unified)",
        "models_active": ["index_tts2", "ltx2"],
        "storage_backend": storage_backend,
        "features": [
            "unified_media_generation",
            "voice_cloning_tts",
            "custom_emotion_synthesis",
            "local_s3_uploading",
        ],
    }


# ==========================================
# 调试和启动入口
# ==========================================

if __name__ == "__main__":
    logger.info("Starting FastAPI Microservice on port 8126...")
    uvicorn.run(app, host="0.0.0.0", port=8126)
