import os
import time
from typing import Optional
import torch
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from diffusers import Flux2KleinPipeline
from minio import get_storage_client, LocalStorageClient, S3StorageClient

app = FastAPI(title="Flux.2 Klein Model Server")

# Ensure output directory exists and mount it as FastAPI StaticFiles
os.makedirs("outputs", exist_ok=True)
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

# Global pipeline reference
pipe = None
device = "cuda"
dtype = torch.bfloat16

class GenerationRequest(BaseModel):
    prompt: str
    height: int = 256
    width: int = 256
    guidance_scale: float = 1.0
    num_inference_steps: int = 4
    seed: int = 0
    # Reserved output_path for legacy support, but will be saved inside outputs/ securely
    output_path: Optional[str] = None

@app.on_event("startup")
def load_model():
    global pipe
    print("Loading Flux2Klein model into memory...")
    start_time = time.time()
    pipe = Flux2KleinPipeline.from_pretrained(
        "black-forest-labs/FLUX.2-klein-4B", torch_dtype=dtype
    )
    # Save VRAM by offloading the model to CPU when idle
    pipe.enable_model_cpu_offload()
    print(f"Model loaded successfully in {time.time() - start_time:.2f} seconds!")

@app.post("/generate")
async def generate_image(request: GenerationRequest, fastapi_req: Request):
    global pipe
    if pipe is None:
        raise HTTPException(status_code=503, detail="Model is not loaded yet")

    print(f"Generating image for prompt: '{request.prompt}'...")
    start_time = time.time()
    try:
        storage_client = get_storage_client()
        
        # Decide file path inside outputs folder
        if isinstance(storage_client, LocalStorageClient):
            local_save_path = storage_client.generate_unique_path("png")
        else:
            # S3/Cloud fallback temporal location
            import uuid
            local_save_path = os.path.join("outputs", f"{uuid.uuid4()}.png")

        generator = torch.Generator(device=device).manual_seed(request.seed)
        image = pipe(
            prompt=request.prompt,
            height=request.height,
            width=request.width,
            guidance_scale=request.guidance_scale,
            num_inference_steps=request.num_inference_steps,
            generator=generator,
        ).images[0]
        
        # Save image physically
        image.save(local_save_path)
        
        # Upload/Process URL conversion
        web_url = storage_client.upload_file(local_save_path, request=fastapi_req)
        
        # Cleanup temporary local file if using S3
        if isinstance(storage_client, S3StorageClient):
            if os.path.exists(local_save_path):
                os.remove(local_save_path)
                
        elapsed = time.time() - start_time
        print(
            f"Generation completed in {elapsed:.2f} seconds! Saved to {local_save_path} -> URL: {web_url}"
        )
        return {
            "status": "success",
            "elapsed_seconds": round(elapsed, 2),
            "output_path": local_save_path,
            "url": web_url,
        }
    except Exception as e:
        print(f"Error during generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8124)
