import os
import time
import uuid
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
upscale_pipe: Optional[LTX2LatentUpsamplePipeline] = None

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
    global pipe, upscale_pipe
    print("Loading LTX2 pipeline into memory…")
    start = time.time()

    # 1. Load the main LTX2 pipeline with bfloat16
    pipe = LTX2Pipeline.from_pretrained(model_path, torch_dtype=torch.bfloat16)

    # 2. Enable FP8 Layerwise Casting for the main Transformer to compress weights from 38GB to 19GB
    if hasattr(pipe, "transformer") and hasattr(
        pipe.transformer, "enable_layerwise_casting"
    ):
        print("Enabling FP8 Layerwise Casting for LTX2 Transformer...")
        pipe.transformer.enable_layerwise_casting(
            storage_dtype=torch.float8_e4m3fn, compute_dtype=torch.bfloat16
        )

    # 3. Load the Latent Upsampler Model
    latent_upsampler = LTX2LatentUpsamplerModel.from_pretrained(
        model_path, subfolder="latent_upsampler", torch_dtype=torch.bfloat16
    )

    # 4. Enable FP8 Layerwise Casting for the Latent Upsampler to save extra VRAM
    if hasattr(latent_upsampler, "enable_layerwise_casting"):
        print("Enabling FP8 Layerwise Casting for Latent Upsampler...")
        latent_upsampler.enable_layerwise_casting(
            storage_dtype=torch.float8_e4m3fn, compute_dtype=torch.bfloat16
        )

    upscale_pipe = LTX2LatentUpsamplePipeline(
        vae=pipe.vae, latent_upsampler=latent_upsampler
    )

    # 5. Enable VAE Tiling to prevent VAE OOM during decoding
    pipe.vae.enable_tiling()

    # 6. Enable component-level CPU offload instead of slow layer-by-layer sequential offload.
    # This keeps the active model component in GPU memory during computation (utilizing the 24GB VRAM),
    # while automatically offloading idle components (like Text Encoder / VAE) to CPU.
    pipe.enable_model_cpu_offload(device=device)
    upscale_pipe.enable_model_cpu_offload(device=device)

    print(f"Models loaded in {time.time() - start:.2f}s")


@app.post("/generate")
async def generate(request: GenerationRequest, fastapi_req: Request):
    if pipe is None or upscale_pipe is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")
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

        # Stage 1 upsample latent video
        upscaled_video_latent = upscale_pipe(
            latents=video_latent,
            output_type="latent",
            return_dict=False,
        )[0]

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
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8125)
