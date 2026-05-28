import os
import sys
import uuid
import shutil
import logging
import mimetypes
import urllib.request
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
WAN2GP_DIR = os.getenv("WAN2GP_DIR", r"D:/AntigravityProject/Wan2GP")
abs_wan2gp_dir = os.path.abspath(WAN2GP_DIR)
if abs_wan2gp_dir not in sys.path:
    sys.path.insert(0, abs_wan2gp_dir)

from shared.api import init, GenerationResult

# 🚀 4. 初始化 FastAPI 服务并挂载本地输出目录以支持静态托管
app = FastAPI(
    title="Wan2GP Unified API Microservice",
    description="整合了高超的音视频生成能力与 MinIO/S3 资产存储的统一微服务。",
    version="2.1.0",
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
        orig_filename = os.path.basename(local_path)
        name_part, ext_part = os.path.splitext(orig_filename)
        filename = f"{name_part}_{uuid.uuid4().hex[:12]}{ext_part}"
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
        orig_filename = os.path.basename(local_path)
        name_part, ext_part = os.path.splitext(orig_filename)
        filename = f"{name_part}_{uuid.uuid4().hex[:12]}{ext_part}"
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
    """按优先级定位参考音频文件所在的位置，支持本地相对路径与远程 HTTP(S) URL"""
    if not audio_path:
        return None

    # 如果是 URL，下载到本地 outputs/temp/ 目录
    if audio_path.startswith("http://") or audio_path.startswith("https://"):
        try:
            os.makedirs(os.path.join("outputs", "temp"), exist_ok=True)
            temp_filename = f"ref_{uuid.uuid4()}.wav"
            temp_path = os.path.join("outputs", "temp", temp_filename)
            logger.info(
                f"Downloading remote reference audio: {audio_path} -> {temp_path}"
            )

            import urllib.parse
            encoded_audio_path = urllib.parse.quote(audio_path, safe='/:?=&')
            with urllib.request.urlopen(encoded_audio_path, timeout=30) as response:
                with open(temp_path, "wb") as f:
                    f.write(response.read())

            return os.path.abspath(temp_path)
        except Exception as e:
            logger.error(f"Failed to download remote audio reference {audio_path}: {e}")
            return None

    candidates = [
        audio_path,
        os.path.join(_SCRIPT_DIR, audio_path),
        os.path.join(os.getcwd(), audio_path),
        os.path.join(_SCRIPT_DIR, "index-tts", audio_path),
        os.path.join(os.getcwd(), "index-tts", audio_path),
    ]
    for c in candidates:
        if os.path.exists(c):
            logger.info(f"Resolved reference audio path: '{audio_path}' -> '{c}'")
            return os.path.abspath(c)
    return None


def resolve_image_path(image_path: str) -> Optional[str]:
    """按优先级定位参考图像文件所在的位置，支持本地相对路径与远程 HTTP(S) URL"""
    if not image_path:
        return None

    # 如果是 URL，下载到本地 outputs/temp/ 目录
    if image_path.startswith("http://") or image_path.startswith("https://"):
        try:
            os.makedirs(os.path.join("outputs", "temp"), exist_ok=True)
            # 提取原文件后缀名以保持图片格式正确
            ext = os.path.splitext(image_path.split("?")[0])[1] or ".png"
            temp_filename = f"ref_{uuid.uuid4()}{ext}"
            temp_path = os.path.join("outputs", "temp", temp_filename)
            logger.info(
                f"Downloading remote reference image: {image_path} -> {temp_path}"
            )

            import urllib.parse
            encoded_image_path = urllib.parse.quote(image_path, safe='/:?=&')
            with urllib.request.urlopen(encoded_image_path, timeout=30) as response:
                with open(temp_path, "wb") as f:
                    f.write(response.read())

            return os.path.abspath(temp_path)
        except Exception as e:
            logger.error(f"Failed to download remote image reference {image_path}: {e}")
            return None

    candidates = [
        image_path,
        os.path.join(_SCRIPT_DIR, image_path),
        os.path.join(os.getcwd(), image_path),
    ]
    for c in candidates:
        if os.path.exists(c):
            logger.info(f"Resolved reference image path: '{image_path}' -> '{c}'")
            return os.path.abspath(c)
    return None


# ==========================================
# 数据校验 Schema 结构体
# ==========================================


class GenerateRequest(BaseModel):
    """通用/兼容模式请求体"""

    prompt: str = Field(..., description="生成媒体的文本提示词")
    model_type: str = Field(
        "index_tts2", description="使用的生成模型类型 (e.g. index_tts2, ltx2)"
    )
    resolution: str = Field("832x480", description="画面分辨率")
    duration_seconds: float = Field(25.0, description="最大生成时间限制 (秒)")
    custom_settings: Optional[Dict[str, Any]] = Field(
        None, description="自定义额外微调配置项"
    )


class VideoGenerateRequest(BaseModel):
    """视频生成专属请求体"""

    prompt: str = Field(..., description="视频提示词")
    model_type: str = Field("ltx2_22B_distilled", description="视频生成模型")
    resolution: str = Field("768x512", description="视频分辨率")
    duration_seconds: float = Field(4.0, description="最大生成时长(秒)")
    video_length: int = Field(97, description="视频帧数")
    force_fps: int = Field(24, description="强制视频帧率")

    # 新增高级图像及音频引导控制参数（添加清晰的文档注释）
    image_start: Optional[str] = Field(
        None, 
        description="首帧/起始图像的本地相对路径或公开 URL (选填)。设置时需确保 image_prompt_type 包含 'S'。"
    )
    image_end: Optional[str] = Field(
        None, 
        description="尾帧/结束图像的本地相对路径或公开 URL (选填)。设置时需确保 image_prompt_type 包含 'E'。"
    )
    image_prompt_type: Optional[str] = Field(
        None, 
        description="图像引导类型选项 (选填)。支持：'S' (仅首帧), 'E' (仅尾帧), 'ES'/'SE' (首尾双帧插值过渡模式)。"
    )
    audio_guide: Optional[str] = Field(
        None, 
        description="音频引导/音轨背景参考的本地相对路径或公开 URL (选填)。设置时需确保 audio_prompt_type 包含 'A'。"
    )
    audio_prompt_type: Optional[str] = Field(
        None, 
        description="音频引导类型选项 (选填)。支持：'A' (单路音频引导), 'AB' (双路声源引导)。"
    )

    custom_settings: Optional[Dict[str, Any]] = Field(
        None, description="自定义微调配置参数"
    )


class ImageGenerateRequest(BaseModel):
    """图片生成专属请求体"""

    prompt: str = Field(..., description="图片提示词")
    model_type: str = Field("flux", description="图片生成模型")
    resolution: str = Field("1024x1024", description="图片分辨率")
    image_refs: Optional[List[str]] = Field(
        None, description="参考图像的本地路径或公开 URL 列表 (选填)。"
    )
    custom_settings: Optional[Dict[str, Any]] = Field(
        None, description="自定义微调配置参数"
    )


class AudioGenerateRequest(BaseModel):
    """语音合成/声音克隆请求体"""

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


TTSRequest = AudioGenerateRequest


# ==========================================
# API 路由接口定义
# ==========================================


@app.post("/generate/video")
async def generate_video(req: VideoGenerateRequest, fastapi_req: Request):
    """
    🎬 专属视频生成接口，支持控制帧率、时长和分辨率，资产自动上传
    """
    temp_files_to_clean = []
    try:
        settings = {
            "model_type": req.model_type,
            "prompt": req.prompt,
            "resolution": req.resolution,
            "duration_seconds": req.duration_seconds,
            "video_length": req.video_length,
            "force_fps": req.force_fps,
        }

        # 1. 动态解析并下载首帧图像 (Start Image)
        if req.image_start:
            resolved_start = resolve_image_path(req.image_start)
            if resolved_start:
                settings["image_start"] = resolved_start
                if "outputs/temp" in resolved_start.replace("\\", "/"):
                    temp_files_to_clean.append(resolved_start)
            else:
                raise HTTPException(status_code=400, detail=f"Image start file/URL unresolved: {req.image_start}")

        # 2. 动态解析并下载尾帧图像 (End Image)
        if req.image_end:
            resolved_end = resolve_image_path(req.image_end)
            if resolved_end:
                settings["image_end"] = resolved_end
                if "outputs/temp" in resolved_end.replace("\\", "/"):
                    temp_files_to_clean.append(resolved_end)
            else:
                raise HTTPException(status_code=400, detail=f"Image end file/URL unresolved: {req.image_end}")

        if req.image_prompt_type:
            settings["image_prompt_type"] = req.image_prompt_type

        # 3. 动态解析并下载音频引导 (Audio Guide)
        if req.audio_guide:
            resolved_audio = resolve_audio_path(req.audio_guide)
            if resolved_audio:
                settings["audio_guide"] = resolved_audio
                if "outputs/temp" in resolved_audio.replace("\\", "/"):
                    temp_files_to_clean.append(resolved_audio)
            else:
                raise HTTPException(status_code=400, detail=f"Audio guide file/URL unresolved: {req.audio_guide}")

        if req.audio_prompt_type:
            settings["audio_prompt_type"] = req.audio_prompt_type

        if req.custom_settings:
            settings.update(req.custom_settings)

        logger.info(f"Submitting video task: model_type={req.model_type}")
        job = session.submit_task(settings)
        result: GenerationResult = job.result()
        if not result.success:
            errors = [err.message for err in result.errors]
            raise HTTPException(
                status_code=500, detail=f"Video Generation failed: {errors}"
            )

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
        logger.error(f"Error during video generation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # 清理临时下载的图像与音频等参考样本，释放磁盘空间
        for temp_file in temp_files_to_clean:
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                    logger.info(f"[Cleanup] Deleted temporary media reference file: {temp_file}")
                except Exception as ex:
                    logger.error(f"[Cleanup] Failed to delete temporary file {temp_file}: {ex}")


@app.post("/generate/image")
async def generate_image(req: ImageGenerateRequest, fastapi_req: Request):
    """
    🖼️ 专属图片/关键帧生成接口，无时长参数，纯静态图片资产自动上传
    """
    temp_files_to_clean = []
    try:
        settings = {
            "model_type": req.model_type,
            "prompt": req.prompt,
            "resolution": req.resolution,
            "image_mode": 1,
            "video_length": 0,
            "duration_seconds": 0,
            "force_fps": 24,
        }

        custom_settings = req.custom_settings.copy() if req.custom_settings else {}

        # 合并 top-level image_refs 到 custom_settings 里的 image_refs 中并统一解析
        raw_refs = []
        if req.image_refs:
            raw_refs.extend(req.image_refs)
        if "image_refs" in custom_settings and isinstance(custom_settings["image_refs"], list):
            raw_refs.extend(custom_settings["image_refs"])

        # 动态解析并下载参考图列表中的所有 URL，转为本地路径
        if raw_refs:
            resolved_refs = []
            for ref in raw_refs:
                if isinstance(ref, str):
                    resolved_ref = resolve_image_path(ref)
                    if resolved_ref:
                        resolved_refs.append([resolved_ref, ""])  # 对应 wgp.py 的 list-of-tuples 格式要求
                        if "outputs/temp" in resolved_ref.replace("\\", "/"):
                            temp_files_to_clean.append(resolved_ref)
                    else:
                        raise HTTPException(status_code=400, detail=f"Image reference unresolved: {ref}")
                else:
                    resolved_refs.append(ref)
            settings["image_refs"] = resolved_refs
            settings["video_prompt_type"] = "I"

        if req.custom_settings:
            # 排除掉原本未被转义的 image_refs，保留其他 custom_settings
            clean_custom = {k: v for k, v in req.custom_settings.items() if k != "image_refs"}
            settings.update(clean_custom)

        logger.info(f"Submitting image task: model_type={req.model_type}")
        job = session.submit_task(settings)
        result: GenerationResult = job.result()
        if not result.success:
            errors = [err.message for err in result.errors]
            raise HTTPException(
                status_code=500, detail=f"Image Generation failed: {errors}"
            )

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
        logger.error(f"Error during image generation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # 清理临时下载的参考图，释放磁盘空间
        for temp_file in temp_files_to_clean:
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                    logger.info(f"[Cleanup] Deleted temporary reference image file: {temp_file}")
                except Exception as ex:
                    logger.error(f"[Cleanup] Failed to delete temporary file {temp_file}: {ex}")


@app.post("/generate")
async def generate_media(req: GenerateRequest, fastapi_req: Request):
    """
    🔄 通用/兼容模式生成接口，适合历史客户端使用，自动根据模型格式上传
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
        logger.info(f"Submitting general task: model_type={req.model_type}")
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


@app.post("/generate/audio")
async def generate_audio(req: AudioGenerateRequest, fastapi_req: Request):
    """
    🎤 专属高级声音克隆与多模态情感语音合成端点 (TTS)
    """
    logger.info(
        f"Received TTS synthesize request: text_len={len(req.text)}, spk='{req.spk_audio_prompt}'"
    )

    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    temp_files_to_clean = []
    try:
        # 1. 定位音色克隆样本
        spk_path = resolve_audio_path(req.spk_audio_prompt)
        if not spk_path:
            raise HTTPException(
                status_code=400,
                detail=f"Speaker audio prompt file not found: {req.spk_audio_prompt}",
            )
        if spk_path and ("outputs/temp" in spk_path.replace("\\", "/")):
            temp_files_to_clean.append(spk_path)

        # 2. 定位情绪参考样本
        emo_audio_path = None
        if req.emo_audio_prompt:
            emo_audio_path = resolve_audio_path(req.emo_audio_prompt)
            if not emo_audio_path:
                raise HTTPException(
                    status_code=400,
                    detail=f"Emotion audio prompt file not found: {req.emo_audio_prompt}",
                )
            if emo_audio_path and ("outputs/temp" in emo_audio_path.replace("\\", "/")):
                temp_files_to_clean.append(emo_audio_path)

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

        logger.info("Submitting TTS task to session...")
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
    finally:
        # 清理临时下载的参考音频文件
        for temp_file in temp_files_to_clean:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                    logger.info(
                        f"Cleaned up temporary downloaded reference file: {temp_file}"
                    )
                except Exception as ex:
                    logger.error(
                        f"Failed to delete temp reference file {temp_file}: {ex}"
                    )


class StitchRequest(BaseModel):
    video_urls: List[str]


def get_local_or_downloaded_path(url: str, temp_dir: str) -> str:
    import urllib.parse
    parsed = urllib.parse.urlparse(url)
    path_str = parsed.path
    if "/outputs/" in path_str:
        filename = path_str.split("/outputs/")[-1]
        local_path = os.path.join("outputs", filename)
        if os.path.exists(local_path):
            return os.path.abspath(local_path)
            
    os.makedirs(temp_dir, exist_ok=True)
    temp_filename = f"stitch_{uuid.uuid4().hex[:12]}.mp4"
    dest_path = os.path.join(temp_dir, temp_filename)
    
    logger.info(f"Downloading remote video for stitching: {url} -> {dest_path}")
    encoded_url = urllib.parse.quote(url, safe='/:?=&')
    with urllib.request.urlopen(encoded_url, timeout=30) as response:
        with open(dest_path, "wb") as f:
            f.write(response.read())
            
    return os.path.abspath(dest_path)


@app.post("/stitch-videos")
async def stitch_videos(req: StitchRequest, fastapi_req: Request):
    import subprocess
    if not req.video_urls:
        raise HTTPException(status_code=400, detail="No video URLs provided")
        
    temp_dir = os.path.join("outputs", "temp", f"stitch_job_{uuid.uuid4().hex[:8]}")
    os.makedirs(temp_dir, exist_ok=True)
    
    resolved_paths = []
    try:
        # Resolve all input videos
        for url in req.video_urls:
            local_path = get_local_or_downloaded_path(url, temp_dir)
            resolved_paths.append(local_path)
            
        # Create concat.txt file
        concat_txt_path = os.path.join(temp_dir, "concat.txt")
        with open(concat_txt_path, "w", encoding="utf-8") as f:
            for path in resolved_paths:
                safe_path = path.replace("\\", "/")
                f.write(f"file '{safe_path}'\n")
                
        # Resolve ffmpeg binary path
        ffmpeg_bin = os.path.join(WAN2GP_DIR, "ffmpeg_bins", "ffmpeg.exe" if os.name == "nt" else "ffmpeg")
        if not os.path.exists(ffmpeg_bin):
            ffmpeg_bin = shutil.which("ffmpeg.exe") or shutil.which("ffmpeg") or "ffmpeg"
            
        output_filename = f"compilation_{uuid.uuid4().hex[:12]}.mp4"
        output_path = os.path.join("outputs", output_filename)
        
        # Run ffmpeg concat command
        cmd = [
            ffmpeg_bin,
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_txt_path,
            "-c", "copy",
            output_path
        ]
        
        logger.info(f"Running ffmpeg stitching: {' '.join(cmd)}")
        process = subprocess.run(cmd, capture_output=True, text=True, check=False)
        
        if process.returncode != 0:
            logger.error(f"FFmpeg stitching failed: {process.stderr}")
            raise HTTPException(status_code=500, detail=f"FFmpeg concatenation failed: {process.stderr}")
            
        # Upload using storage client
        storage_client = get_storage_client()
        url = storage_client.upload_file(output_path, request=fastapi_req)
        logger.info(f"Stitched video uploaded: {url}")
        
        # If remote S3 storage, clean up local stitched file
        if not isinstance(storage_client, LocalStorageClient) and os.path.exists(output_path):
            try:
                os.remove(output_path)
            except Exception as e:
                logger.error(f"Failed to delete temp output: {e}")
                
        return {"status": "success", "url": url}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Stitching execution failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temp folder and downloaded pieces
        if os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
            except Exception as e:
                logger.error(f"Cleanup of temp stitch directory failed: {e}")



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
