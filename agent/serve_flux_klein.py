import time
import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from diffusers import Flux2KleinPipeline

app = FastAPI(title="Flux.2 Klein Model Server")

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
    output_path: str = "flux-klein2.png"


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
async def generate_image(request: GenerationRequest):
    global pipe
    if pipe is None:
        raise HTTPException(status_code=503, detail="Model is not loaded yet")

    print(f"Generating image for prompt: '{request.prompt}'...")
    start_time = time.time()
    try:
        generator = torch.Generator(device=device).manual_seed(request.seed)
        image = pipe(
            prompt=request.prompt,
            height=request.height,
            width=request.width,
            guidance_scale=request.guidance_scale,
            num_inference_steps=request.num_inference_steps,
            generator=generator,
        ).images[0]
        image.save(request.output_path)
        elapsed = time.time() - start_time
        print(
            f"Generation completed in {elapsed:.2f} seconds! Saved to {request.output_path}"
        )
        return {
            "status": "success",
            "elapsed_seconds": round(elapsed, 2),
            "output_path": request.output_path,
        }
    except Exception as e:
        print(f"Error during generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8124)
