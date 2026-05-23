import os
import time
import uuid
import torch
from diffusers import ZImagePipeline
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from minio import get_storage_client, LocalStorageClient, S3StorageClient

app = FastAPI(title="Z-Image Turbo API", version="1.0")

# Ensure output directory exists and mount it as FastAPI StaticFiles
os.makedirs("outputs", exist_ok=True)
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

# Global pipeline reference
pipe = None


# Load the pipeline once on startup for efficiency
@app.on_event("startup")
def load_pipeline():
    global pipe
    try:
        pipe = ZImagePipeline.from_pretrained(
            "Tongyi-MAI/Z-Image-Turbo",
            torch_dtype=torch.bfloat16,
            low_cpu_mem_usage=False,
        )
        pipe.to("cuda")
        # Optional: enable CPU offload for low‑memory environments
        # pipe.enable_model_cpu_offload()
        # Optional: compile the model for faster inference
        # pipe.transformer.compile()
    except Exception as e:
        raise RuntimeError(f"Failed to load Z-Image Turbo pipeline: {e}")


class GenerateRequest(BaseModel):
    prompt: str = Field(..., description="Text prompt describing the desired image")
    height: int = Field(1024, ge=64, le=2048, description="Image height in pixels")
    width: int = Field(1024, ge=64, le=2048, description="Image width in pixels")
    num_inference_steps: int = Field(
        9, ge=1, le=50, description="Number of diffusion steps (Turbo models use 8‑9)"
    )
    guidance_scale: float = Field(
        0.0, ge=0.0, le=10.0, description="Guidance scale – must be 0 for Turbo models"
    )
    seed: int | None = Field(None, description="Random seed for reproducibility")


@app.post("/generate")
async def generate_image(req: GenerateRequest, fastapi_req: Request):
    """Generate an image from a text prompt using Z‑Image‑Turbo.

    Saves the image locally, uploads it to MinIO (or Local Storage, depending on configuration),
    and returns a JSON payload with the public URL.
    """
    global pipe
    if pipe is None:
        raise HTTPException(status_code=503, detail="Model is not loaded yet")

    start_time = time.time()
    try:
        storage_client = get_storage_client()

        # Decide file path inside outputs folder
        if isinstance(storage_client, LocalStorageClient):
            local_save_path = storage_client.generate_unique_path("png")
        else:
            # S3/Cloud fallback temporal location
            local_save_path = os.path.join("outputs", f"{uuid.uuid4()}.png")

        # Setup generator
        generator = torch.Generator("cuda")
        if req.seed is not None:
            generator.manual_seed(req.seed)

        # Generate image
        image = pipe(
            prompt=req.prompt,
            height=req.height,
            width=req.width,
            num_inference_steps=req.num_inference_steps,
            guidance_scale=req.guidance_scale,
            generator=generator,
        ).images[0]

        # Save image physically
        image.save(local_save_path)

        # Upload to MinIO/S3 and get public URL
        web_url = storage_client.upload_file(local_save_path, request=fastapi_req)

        # Cleanup temporary local file if using S3
        if isinstance(storage_client, S3StorageClient):
            if os.path.exists(local_save_path):
                os.remove(local_save_path)

        elapsed = time.time() - start_time
        return {
            "status": "success",
            "elapsed_seconds": round(elapsed, 2),
            "output_path": local_save_path,
            "url": web_url,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8124)
