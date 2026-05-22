import os
import time
import torch
import uvicorn
from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from diffusers import ZImagePipeline

from minio import get_storage_client, LocalStorageClient, S3StorageClient

app = FastAPI(title="Z-Image-Turbo Generation Service")

# 确保输出目录存在并挂载为静态文件服务
os.makedirs("outputs", exist_ok=True)
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

# 全局 pipeline 引用
pipe: Optional[ZImagePipeline] = None

class GenerationRequest(BaseModel):
    prompt: str
    height: int = 1024
    width: int = 1024
    num_inference_steps: int = 9
    guidance_scale: float = 0.0   # Turbo 模型建议为 0
    seed: int = 42
    output_filename: Optional[str] = None

@app.on_event("startup")
def load_model():
    global pipe
    print("正在加载 Z-Image-Turbo 模型...")
    start = time.time()
    pipe = ZImagePipeline.from_pretrained(
        "Tongyi-MAI/Z-Image-Turbo",
        torch_dtype=torch.bfloat16,
        low_cpu_mem_usage=False,
    )
    pipe.to("cuda")
    print(f"模型加载完成，耗时 {time.time() - start:.2f}s")

@app.post("/generate")
async def generate(request: GenerationRequest, fastapi_req: Request):
    if pipe is None:
        raise HTTPException(status_code=503, detail="模型尚未加载")

    print(f"[{time.strftime('%H:%M:%S')}] 开始生成：{request.prompt[:50]}...")
    start = time.time()
    try:
        generator = torch.Generator("cuda").manual_seed(request.seed)

        image = pipe(
            prompt=request.prompt,
            height=request.height,
            width=request.width,
            num_inference_steps=request.num_inference_steps,
            guidance_scale=request.guidance_scale,
            generator=generator,
        ).images[0]

        # 保存图片到本地
        storage_client = get_storage_client()
        if isinstance(storage_client, LocalStorageClient):
            local_path = storage_client.generate_unique_path("png")
        else:
            import uuid
            local_path = os.path.join("outputs", request.output_filename or f"zimg_{uuid.uuid4().hex}.png")

        os.makedirs(os.path.dirname(os.path.abspath(local_path)), exist_ok=True)
        image.save(local_path)

        # 上传到 MinIO / 本地存储并获取公开 URL
        url = storage_client.upload_file(local_path, request=fastapi_req)

        # 使用远程存储时清理本地临时文件
        if isinstance(storage_client, S3StorageClient) and os.path.exists(local_path):
            os.remove(local_path)

        elapsed = time.time() - start
        print(f"[{time.strftime('%H:%M:%S')}] 生成完成，耗时 {elapsed:.2f}s，URL: {url}")
        return {
            "status": "success",
            "elapsed_seconds": round(elapsed, 2),
            "output_path": local_path,
            "url": url,
        }
    except Exception as e:
        print(f"生成失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8126)
