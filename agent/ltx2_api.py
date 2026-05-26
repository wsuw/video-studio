import os
import time
import uuid
import gc
import torch
from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from diffusers.pipelines.ltx2 import LTX2Pipeline, LTX2LatentUpsamplePipeline
from diffusers.pipelines.ltx2.latent_upsampler import LTX2LatentUpsamplerModel
from diffusers.pipelines.ltx2.utils import (
    DISTILLED_SIGMA_VALUES,
    STAGE_2_DISTILLED_SIGMA_VALUES,
)
from diffusers.pipelines.ltx2.export_utils import encode_video

from minio import get_storage_client, LocalStorageClient, S3StorageClient

app = FastAPI(title="LTX2 Video Generation Service")

# Ensure outputs directory exists and is served statically
os.makedirs("outputs", exist_ok=True)
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

# Global model reference
pipe: Optional[LTX2Pipeline] = None

device = "cuda"
model_path = "rootonchair/LTX-2-19b-distilled"
random_seed = 42
generator = torch.Generator(device).manual_seed(random_seed)


class GenerationRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = None
    width: int = 768
    height: int = 512
    num_frames: int = 121
    frame_rate: float = 24.0
    num_inference_steps_stage1: int = 8
    num_inference_steps_stage2: int = 3
    guidance_scale_stage1: float = 1.0
    guidance_scale_stage2: float = 1.0
    # Output path is managed internally; client can request a custom filename if desired
    output_filename: Optional[str] = None


@app.on_event("startup")
def load_models():
    global pipe
    print("Loading LTX2 pipeline into memory…")
    start = time.time()

    # 1. Load the main LTX2 pipeline with bfloat16
    pipe = LTX2Pipeline.from_pretrained(model_path, torch_dtype=torch.bfloat16)

    # 2. Enable sequential CPU offload as per official way to minimize VRAM usage
    pipe.enable_sequential_cpu_offload(device=device)

    # 3. Enable VAE Tiling to prevent OOM
    pipe.vae.enable_tiling()

    print(f"Main LTX2 pipeline loaded in {time.time() - start:.2f}s")


@app.post("/generate")
async def generate(request: GenerationRequest, fastapi_req: Request):
    if pipe is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    latent_upsampler = None
    upsample_pipe = None

    try:
        # Stage 1 – latent video & audio
        video_latent, audio_latent = pipe(
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            width=request.width,
            height=request.height,
            num_frames=request.num_frames,
            frame_rate=request.frame_rate,
            num_inference_steps=request.num_inference_steps_stage1,
            sigmas=DISTILLED_SIGMA_VALUES,
            guidance_scale=request.guidance_scale_stage1,
            generator=generator,
            output_type="latent",
            return_dict=False,
        )

        # 🚀 官网推荐方式：动态按需加载 Latent Upsampler，避免与主管道常驻在同一个显存空间中
        print("Loading Latent Upsampler model dynamically...")
        latent_upsampler = LTX2LatentUpsamplerModel.from_pretrained(
            model_path,
            subfolder="latent_upsampler",
            torch_dtype=torch.bfloat16,
        )
        upsample_pipe = LTX2LatentUpsamplePipeline(
            vae=pipe.vae, latent_upsampler=latent_upsampler
        )
        upsample_pipe.enable_model_cpu_offload(device=device)

        # Stage 1 upsample latent video
        print("Running Latent Upsampler...")
        upscaled_video_latent = upsample_pipe(
            latents=video_latent,
            output_type="latent",
            return_dict=False,
        )[0]

        # 🚀 立即从显存和内存卸载/销毁 Upsampler 管道，释放显存后再进行 Stage 2 终稿去噪精炼
        print("Unloading Latent Upsampler model from memory...")
        del upsample_pipe
        del latent_upsampler
        upsample_pipe = None
        latent_upsampler = None
        gc.collect()
        torch.cuda.empty_cache()

        # Stage 2 – final video & audio refinement
        video, audio = pipe(
            latents=upscaled_video_latent,
            audio_latents=audio_latent,
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            num_inference_steps=request.num_inference_steps_stage2,
            noise_scale=STAGE_2_DISTILLED_SIGMA_VALUES[0],
            sigmas=STAGE_2_DISTILLED_SIGMA_VALUES,
            generator=generator,
            guidance_scale=request.guidance_scale_stage2,
            output_type="np",
            return_dict=False,
        )

        # Encode video to MP4 locally
        filename = request.output_filename or f"ltx2_{uuid.uuid4().hex}.mp4"
        local_path = os.path.join("outputs", filename)
        encode_video(
            video[0],
            fps=request.frame_rate,
            audio=audio[0].float().cpu(),
            audio_sample_rate=pipe.vocoder.config.output_sampling_rate,
            output_path=local_path,
        )

        # Upload to MinIO / local storage and get public URL
        storage_client = get_storage_client()
        url = storage_client.upload_file(local_path, request=fastapi_req)

        # Cleanup local file if using remote storage
        if isinstance(storage_client, S3StorageClient) and os.path.exists(local_path):
            os.remove(local_path)

        return {"status": "success", "url": url, "output_path": local_path}

    except Exception as e:
        # 异常情况下也确保垃圾回收，释放显存
        if upsample_pipe is not None or latent_upsampler is not None:
            del upsample_pipe
            del latent_upsampler
        gc.collect()
        torch.cuda.empty_cache()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8125)
