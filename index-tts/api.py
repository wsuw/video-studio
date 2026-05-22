import os
import sys
import uuid
import shutil
import logging
import mimetypes
from typing import List, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# 加载 .env 配置
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

# ==========================================
# 内联存储客户端（支持本地 / MinIO S3）
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
        self.endpoint   = os.getenv("STORAGE_S3_ENDPOINT",   "http://127.0.0.1:9000")
        self.access_key = os.getenv("STORAGE_S3_ACCESS_KEY", "minioadmin")
        self.secret_key = os.getenv("STORAGE_S3_SECRET_KEY", "minioadmin")
        self.bucket_name = os.getenv("STORAGE_S3_BUCKET",   "video-studio")
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
                Bucket=self.bucket_name, Key=filename,
                Body=f, ContentType=content_type,
            )
        base_url = self.public_url if self.public_url else self.endpoint
        return f"{base_url.rstrip('/')}/{self.bucket_name}/{filename}"

def get_storage_client() -> StorageClient:
    backend = os.getenv("STORAGE_BACKEND", "local").lower()
    if backend == "s3":
        return S3StorageClient()
    return LocalStorageClient()

# ==========================================

from indextts.infer_v2 import IndexTTS2

# 配置日志
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("IndexTTS2-API")

app = FastAPI(
    title="IndexTTS2 API Server",
    description="整合所有合成方式（语音克隆、情感参考音频、8维情感向量、文本情感引导、自定义情感描述）的 FastAPI 服务。",
    version="2.0.0",
)

# 本地模式下将 outputs/ 挂载为静态文件服务
os.makedirs("outputs", exist_ok=True)
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

# 脚本和父目录的绝对路径（用于路径解析）
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_PARENT_DIR = os.path.dirname(_SCRIPT_DIR)

def resolve_audio_path(audio_path: str) -> Optional[str]:
    """按优先级依次尝试定位音频文件：
    1. 原始路径（绝对路径或相对 cwd）
    2. 相对脚本所在目录（index-tts/）
    3. 相对父目录（video-studio/）
    4. 相对当前工作目录
    """
    candidates = [
        audio_path,
        os.path.join(_SCRIPT_DIR, audio_path),
        os.path.join(_PARENT_DIR, audio_path),
        os.path.join(os.getcwd(), audio_path),
    ]
    for c in candidates:
        if os.path.exists(c):
            logger.debug(f"Resolved '{audio_path}' -> '{c}'")
            return os.path.abspath(c)
    return None


# 全局初始化 TTS 模型（仅在启动时加载一次）
logger.info("Initializing IndexTTS2 model with official config...")
try:
    # 严格按照您测试成功的参数进行初始化
    tts = IndexTTS2(
        cfg_path="checkpoints/config.yaml",
        model_dir="checkpoints",
        use_fp16=False,
        use_cuda_kernel=False,
        use_deepspeed=False,
    )
    logger.info("IndexTTS2 model loaded successfully!")
except Exception as e:
    logger.error(f"Failed to load IndexTTS2 model: {e}", exc_info=True)
    raise e


# 统一的请求体，集成所有使用场景的参数
class TTSRequest(BaseModel):
    text: str = Field(..., description="要合成的文本脚本")
    spk_audio_prompt: str = Field(
        ..., description="音色参考音频文件路径，例如 'examples/voice_01.wav'"
    )

    # 方式二 & 三：情绪参考音频控制
    emo_audio_prompt: Optional[str] = Field(
        None, description="情绪参考音频文件路径，例如 'examples/emo_sad.wav'"
    )
    emo_alpha: float = Field(
        1.0,
        ge=0.0,
        le=1.0,
        description="情感融合强度，有效范围 0.0 - 1.0，当使用 emo_audio_prompt 或文本情感模式时起作用",
    )

    # 方式四：情绪向量直接控制
    emo_vector: Optional[List[float]] = Field(
        None,
        description="8维情绪向量，顺序为: [happy, angry, sad, afraid, disgusted, melancholic, surprised, calm]",
    )

    # 方式五 & 六：文本脚本引导/特定情感描述
    use_emo_text: bool = Field(
        False,
        description="是否启用文本情感模式（自动把文本转化为情感向量）。建议将 emo_alpha 设为 0.6 左右",
    )
    emo_text: Optional[str] = Field(
        None,
        description="特定的文本情感描述，例如 '你吓死我了！你是鬼吗？'，仅在 use_emo_text 为 True 时生效",
    )

    # 其它控制参数
    use_random: bool = Field(
        False,
        description="是否在推理中引入随机性（注：启用随机采样会略微降低语音克隆保真度）",
    )
    interval_silence: int = Field(200, description="句子之间的静音间隔时长（毫秒）")


@app.post("/synthesize")
async def synthesize(req: TTSRequest, fastapi_req: Request):
    logger.info(
        f"Received request: text='{req.text[:20]}...', spk='{req.spk_audio_prompt}'"
    )

    # 1. 文本校验
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    # 2. 定位音色参考音频
    spk_path = resolve_audio_path(req.spk_audio_prompt)
    if not spk_path:
        raise HTTPException(
            status_code=400,
            detail=f"Speaker audio prompt file not found: {req.spk_audio_prompt}",
        )

    # 3. 定位情绪参考音频
    emo_audio_path = None
    if req.emo_audio_prompt:
        emo_audio_path = resolve_audio_path(req.emo_audio_prompt)
        if not emo_audio_path:
            raise HTTPException(
                status_code=400,
                detail=f"Emotion audio prompt file not found: {req.emo_audio_prompt}",
            )

    # 4. 情绪向量格式校验
    if req.emo_vector is not None:
        if len(req.emo_vector) != 8:
            raise HTTPException(
                status_code=400,
                detail="emo_vector must contain exactly 8 float elements [happy, angry, sad, afraid, disgusted, melancholic, surprised, calm].",
            )

    # 创建输出目录
    output_dir = os.path.join(os.getcwd(), "outputs")
    os.makedirs(output_dir, exist_ok=True)

    # 生成临时 WAV 文件路径
    filename = f"gen_{uuid.uuid4().hex}.wav"
    output_path = os.path.join(output_dir, filename)

    try:
        logger.info("Executing model inference...")
        # 统一调用 tts.infer，传入所有的相关参数
        # 依据官方文档说明：
        # - 如果指定了 emo_vector，或者 use_emo_text=True，那么 emo_audio_prompt 会被库内部忽略或做特殊融合处理
        tts.infer(
            spk_audio_prompt=spk_path,
            text=req.text,
            output_path=output_path,
            emo_audio_prompt=emo_audio_path,
            emo_alpha=req.emo_alpha,
            emo_vector=req.emo_vector,
            use_emo_text=req.use_emo_text,
            emo_text=req.emo_text,
            use_random=req.use_random,
            interval_silence=req.interval_silence,
            verbose=True,
        )

        if not os.path.exists(output_path):
            raise HTTPException(
                status_code=500,
                detail="Inference ran but output WAV file was not generated.",
            )

        logger.info(f"Synthesis successful! Audio saved to {output_path}")

        # 上传到 MinIO / 本地存储，返回公开 URL
        storage_client = get_storage_client()
        url = storage_client.upload_file(output_path, request=fastapi_req)
        logger.info(f"Audio uploaded, URL: {url}")

        # 使用远程存储时删除本地临时文件
        if isinstance(storage_client, S3StorageClient) and os.path.exists(output_path):
            os.remove(output_path)

        return {
            "status": "success",
            "url": url,
            "filename": filename,
        }

    except Exception as e:
        logger.error(f"Error during IndexTTS2 synthesis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"TTS Synthesis Failed: {str(e)}")


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model": "IndexTTS2",
        "supported_features": [
            "voice_cloning",
            "emotion_audio_guidance",
            "emotion_vector_guidance",
            "text_emotion_guidance",
            "custom_emotion_text",
        ],
    }


if __name__ == "__main__":
    import uvicorn

    # 监听 127.0.0.1 端口 8000
    logger.info("Starting uvicorn server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
