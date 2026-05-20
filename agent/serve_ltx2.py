import os
import time
import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from diffusers import LTX2Pipeline
from diffusers.pipelines.ltx2.export_utils import encode_video

app = FastAPI(title="LTX-2 Video Model Server")

# Global pipeline reference
pipe = None
device = "cuda"
dtype = torch.bfloat16


class VideoGenerationRequest(BaseModel):
    prompt: str
    negative_prompt: str = "worst quality, inconsistent motion, blurry, jittery, distorted"
    width: int = 768
    height: int = 512
    num_frames: int = 121
    frame_rate: float = 24.0
    num_inference_steps: int = 40
    guidance_scale: float = 4.0
    seed: int = 0
    output_path: str = "video.mp4"


@app.on_event("startup")
def load_model():
    global pipe
    print("Loading LTX-2 model into memory...")
    start_time = time.time()
    try:
        pipe = LTX2Pipeline.from_pretrained(
            "Lightricks/LTX-2", torch_dtype=dtype
        )
        # Save VRAM by offloading the model to CPU when idle
        pipe.enable_model_cpu_offload()
        print(f"Model loaded successfully in {time.time() - start_time:.2f} seconds!")
    except Exception as e:
        print(f"Error loading LTX-2 model: {e}")
        # We don't crash startup immediately so developer can see the error logs
        pipe = None


@app.post("/generate")
async def generate_video(request: VideoGenerationRequest):
    global pipe
    if pipe is None:
        raise HTTPException(
            status_code=503,
            detail="LTX-2 model is not loaded yet or failed to load on startup",
        )

    print(f"Generating video for prompt: '{request.prompt}'...")
    start_time = time.time()
    try:
        # Create output directory if it doesn't exist
        output_dir = os.path.dirname(os.path.abspath(request.output_path))
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)

        generator = torch.Generator(device=device).manual_seed(request.seed)
        
        # Run inference pipeline
        video, audio = pipe(
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            width=request.width,
            height=request.height,
            num_frames=request.num_frames,
            frame_rate=request.frame_rate,
            num_inference_steps=request.num_inference_steps,
            guidance_scale=request.guidance_scale,
            output_type="np",
            generator=generator,
            return_dict=False,
        )

        # Export video with audio (if vocoder/audio exists)
        audio_tensor = None
        if audio is not None and len(audio) > 0:
            audio_tensor = audio[0].float().cpu()

        audio_sample_rate = 24000
        if hasattr(pipe, "vocoder") and pipe.vocoder is not None:
            if hasattr(pipe.vocoder, "config") and hasattr(pipe.vocoder.config, "output_sampling_rate"):
                audio_sample_rate = pipe.vocoder.config.output_sampling_rate

        encode_video(
            video[0],
            fps=request.frame_rate,
            audio=audio_tensor,
            audio_sample_rate=audio_sample_rate,
            output_path=request.output_path,
        )

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
        print(f"Error during video generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": pipe is not None}


if __name__ == "__main__":
    port = int(os.getenv("LTX2_PORT", "8125"))
    uvicorn.run(app, host="0.0.0.0", port=port)
