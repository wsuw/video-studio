import os
import time
import logging
from typing import Optional
import torch
import uvicorn
import huggingface_hub
import diffusers
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from diffusers import LTX2Pipeline, FlowMatchEulerDiscreteScheduler
from diffusers.pipelines.ltx2 import LTX2LatentUpsamplePipeline
from diffusers.pipelines.ltx2.latent_upsampler import LTX2LatentUpsamplerModel
from diffusers.pipelines.ltx2.utils import DISTILLED_SIGMA_VALUES, STAGE_2_DISTILLED_SIGMA_VALUES
from diffusers.pipelines.ltx2.export_utils import encode_video
from storage_minio import get_storage_client, LocalStorageClient, S3StorageClient

# Enable logging and progress reporting
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
huggingface_hub.logging.set_verbosity_info()
diffusers.utils.logging.set_verbosity_info()

app = FastAPI(title="LTX-2 Video Model Server")

# Ensure outputs folder exists and mount it as StaticFiles
os.makedirs("outputs", exist_ok=True)
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

# Global pipeline references
pipe = None
upsample_pipe = None
device = "cuda"
dtype = torch.bfloat16


class VideoGenerationRequest(BaseModel):
    prompt: str
    negative_prompt: str = "shaky, glitchy, low quality, worst quality, deformed, distorted, disfigured, motion smear, motion artifacts, fused fingers, bad anatomy, weird hand, ugly, transition, static."
    width: int = 768
    height: int = 512
    num_frames: int = 121
    frame_rate: float = 24.0
    num_inference_steps_stage1: int = 8  # Default to 8 steps since base model is distilled
    num_inference_steps_stage2: int = 3  # Default to 3 steps for Stage 2
    guidance_scale_stage1: float = 1.0  # Distilled models usually work best with guidance scale 1.0
    guidance_scale_stage2: float = 1.0
    seed: int = 0
    output_path: Optional[str] = None
    stage1_only: bool = False  # Set to True to skip latent upsampling and Stage 2 refinement


@app.on_event("startup")
def load_model():
    global pipe, upsample_pipe
    model_path = "rootonchair/LTX-2-19b-distilled"
    print("=" * 60)
    print(f"Starting LTX-2 pipeline initialization...")
    print(f"Model ID: {model_path}")
    print("NOTE: The model is 19 Billion parameters (very large!).")
    print("If running for the first time, downloading the weights (approx. 38GB) may take a while.")
    print("Please check your network speed if it appears to be stuck during downloading.")
    print("=" * 60)
    
    start_time = time.time()
    try:
        print(f"[{time.strftime('%H:%M:%S')}] Loading base LTX-2 distilled pipeline from Hugging Face / Cache...")
        pipe = LTX2Pipeline.from_pretrained(
            model_path, 
            torch_dtype=dtype,
            local_files_only=True,
        )
        print(f"[{time.strftime('%H:%M:%S')}] Base pipeline loaded in {time.time() - start_time:.2f} seconds.")

        # Enable FP8 Layerwise Casting on Transformer to fit 19B model into VRAM
        if hasattr(pipe, "transformer") and hasattr(pipe.transformer, "enable_layerwise_casting"):
            print(f"[{time.strftime('%H:%M:%S')}] Enabling FP8 layerwise casting on base pipeline transformer...")
            pipe.transformer.enable_layerwise_casting(
                storage_dtype=torch.float8_e4m3fn,
                compute_dtype=torch.bfloat16
            )
            print("Enabling model CPU offload for base pipeline...")
            pipe.enable_model_cpu_offload(device=device)
        else:
            print("WARNING: FP8 layerwise casting not supported. Falling back to sequential CPU offload...")
            pipe.enable_sequential_cpu_offload(device=device)

        print(f"[{time.strftime('%H:%M:%S')}] Loading Latent Upsampler model...")
        upsampler_start = time.time()
        latent_upsampler = LTX2LatentUpsamplerModel.from_pretrained(
            model_path,
            subfolder="latent_upsampler",
            torch_dtype=dtype,
            local_files_only=True,
        )
        if hasattr(latent_upsampler, "enable_layerwise_casting"):
            print(f"[{time.strftime('%H:%M:%S')}] Enabling FP8 layerwise casting on latent upsampler...")
            latent_upsampler.enable_layerwise_casting(
                storage_dtype=torch.float8_e4m3fn,
                compute_dtype=torch.bfloat16
            )
        print(f"[{time.strftime('%H:%M:%S')}] Latent upsampler model loaded in {time.time() - upsampler_start:.2f} seconds.")

        print("Loading Latent Upsample Pipeline...")
        upsample_pipe = LTX2LatentUpsamplePipeline(vae=pipe.vae, latent_upsampler=latent_upsampler)
        
        print("Enabling model CPU offload for upsample_pipe...")
        upsample_pipe.enable_model_cpu_offload(device=device)

        # Enable VAE tiling to prevent OOM during VAE decoding
        print("Enabling VAE tiling...")
        pipe.vae.enable_tiling()

        print(f"All components loaded successfully in {time.time() - start_time:.2f} seconds!")
    except Exception as e:
        print(f"Error loading LTX-2 Distilled pipeline: {e}")
        pipe = None
        upsample_pipe = None


@app.post("/generate")
async def generate_video(request: VideoGenerationRequest, fastapi_req: Request):
    global pipe, upsample_pipe
    if pipe is None or (upsample_pipe is None and not request.stage1_only):
        raise HTTPException(
            status_code=503,
            detail="LTX-2 pipeline components are not fully loaded",
        )

    mode_str = "Stage 1 only (draft preview)" if request.stage1_only else "2-stage distilled pipeline"
    print(f"[{time.strftime('%H:%M:%S')}] Generating video via {mode_str} for prompt: '{request.prompt}'...")
    start_time = time.time()
    try:
        storage_client = get_storage_client()
        
        # Determine secure output path inside outputs/
        if isinstance(storage_client, LocalStorageClient):
            local_save_path = storage_client.generate_unique_path("mp4")
        else:
            import uuid
            local_save_path = os.path.join("outputs", f"{uuid.uuid4()}.mp4")

        # Create output directory if it doesn't exist
        output_dir = os.path.dirname(os.path.abspath(local_save_path))
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)

        generator = torch.Generator(device=device).manual_seed(request.seed)
        
        # --- STAGE 1: Base Latent Generation ---
        def stage1_callback(pipe_obj, step_index, timestep, callback_kwargs):
            print(f"[{time.strftime('%H:%M:%S')}] [Stage 1] Step {step_index}/{request.num_inference_steps_stage1} completed. Timestep: {timestep.item() if hasattr(timestep, 'item') else timestep}")
            return callback_kwargs

        print(f"[{time.strftime('%H:%M:%S')}] [Stage 1] Generating base latents ({request.num_inference_steps_stage1} steps)...")
        stage1_start = time.time()
        output_type = "np" if request.stage1_only else "latent"
        
        stage1_res = pipe(
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            width=request.width,
            height=request.height,
            num_frames=request.num_frames,
            frame_rate=request.frame_rate,
            num_inference_steps=request.num_inference_steps_stage1,
            sigmas=DISTILLED_SIGMA_VALUES,
            guidance_scale=request.guidance_scale_stage1,
            output_type=output_type,
            generator=generator,
            return_dict=False,
            callback_on_step_end=stage1_callback,
        )

        if request.stage1_only:
            video, audio = stage1_res
            print(f"[{time.strftime('%H:%M:%S')}] [Stage 1 Only] Completed base generation and decoding in {time.time() - stage1_start:.2f} seconds.")
            
            # Force offload Stage 1 models to CPU and clear VRAM
            print("Offloading Stage 1 models and VAE to CPU...")
            pipe.vae.to("cpu")
            pipe.transformer.to("cpu")
            import gc
            gc.collect()
            torch.cuda.empty_cache()
        else:
            video_latent, audio_latent = stage1_res
            print(f"[{time.strftime('%H:%M:%S')}] [Stage 1] Completed base latent generation in {time.time() - stage1_start:.2f} seconds.")

            # Force offload Stage 1 models to CPU to free VRAM for the next stages
            print("Offloading Stage 1 transformer to CPU...")
            pipe.transformer.to("cpu")
            import gc
            gc.collect()
            torch.cuda.empty_cache()

            # --- LATENT UPSAMPLING ---
            print(f"[{time.strftime('%H:%M:%S')}] [Upsampler] Upscaling video latents...")
            upscale_start = time.time()
            upscaled_video_latent = upsample_pipe(
                latents=video_latent,
                output_type="latent",
                return_dict=False,
            )[0]
            print(f"[{time.strftime('%H:%M:%S')}] [Upsampler] Completed upsampling in {time.time() - upscale_start:.2f} seconds.")

            # Force offload upsampler to CPU to free VRAM for Stage 2 VAE decoding
            print("Offloading latent upsampler to CPU...")
            upsample_pipe.latent_upsampler.to("cpu")
            import gc
            gc.collect()
            torch.cuda.empty_cache()

            # --- STAGE 2: Distilled Refinement & Decode ---
            # Change scheduler to use Stage 2 distilled sigmas
            original_scheduler = pipe.scheduler
            new_scheduler = FlowMatchEulerDiscreteScheduler.from_config(
                pipe.scheduler.config, use_dynamic_shifting=False, shift_terminal=None
            )
            pipe.scheduler = new_scheduler

            def stage2_callback(pipe_obj, step_index, timestep, callback_kwargs):
                print(f"[{time.strftime('%H:%M:%S')}] [Stage 2] Step {step_index}/{request.num_inference_steps_stage2} completed. Timestep: {timestep.item() if hasattr(timestep, 'item') else timestep}")
                return callback_kwargs

            print(f"[{time.strftime('%H:%M:%S')}] [Stage 2] Refining and decoding upscaled latents ({request.num_inference_steps_stage2} steps)...")
            stage2_start = time.time()
            video, audio = pipe(
                latents=upscaled_video_latent,
                audio_latents=audio_latent,
                prompt=request.prompt,
                negative_prompt=request.negative_prompt,
                num_inference_steps=request.num_inference_steps_stage2,
                noise_scale=STAGE_2_DISTILLED_SIGMA_VALUES[0],
                sigmas=STAGE_2_DISTILLED_SIGMA_VALUES,
                guidance_scale=request.guidance_scale_stage2,
                output_type="np",
                generator=generator,
                return_dict=False,
                callback_on_step_end=stage2_callback,
            )
            print(f"[{time.strftime('%H:%M:%S')}] [Stage 2] Completed refinement and decoding in {time.time() - stage2_start:.2f} seconds.")

            # Force offload Stage 2 components to CPU and clear VRAM
            print("Offloading Stage 2 components and clearing CUDA cache...")
            pipe.vae.to("cpu")
            pipe.transformer.to("cpu")
            import gc
            gc.collect()
            torch.cuda.empty_cache()

            # Restore original scheduler
            pipe.scheduler = original_scheduler

        # Export video with audio (if vocoder/audio exists)
        audio_tensor = None
        if audio is not None and len(audio) > 0:
            audio_tensor = audio[0].float().cpu()

        audio_sample_rate = 24000
        if hasattr(pipe, "vocoder") and pipe.vocoder is not None:
            if hasattr(pipe.vocoder, "config") and hasattr(pipe.vocoder.config, "output_sampling_rate"):
                audio_sample_rate = pipe.vocoder.config.output_sampling_rate

        print(f"[{time.strftime('%H:%M:%S')}] [Export] Encoding video with audio...")
        encode_video(
            video[0],
            fps=request.frame_rate,
            audio=audio_tensor,
            audio_sample_rate=audio_sample_rate,
            output_path=local_save_path,
        )

        # Upload and generate direct downloadable web URL
        web_url = storage_client.upload_file(local_save_path, request=fastapi_req)

        # Cleanup temporary local file if using S3
        if isinstance(storage_client, S3StorageClient):
            if os.path.exists(local_save_path):
                os.remove(local_save_path)

        elapsed = time.time() - start_time
        print(
            f"[{time.strftime('%H:%M:%S')}] Generation completed in {elapsed:.2f} seconds! Saved to {local_save_path} -> URL: {web_url}"
        )
        return {
            "status": "success",
            "elapsed_seconds": round(elapsed, 2),
            "output_path": local_save_path,
            "url": web_url,
        }
    except Exception as e:
        print(f"Error during video generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": pipe is not None and upsample_pipe is not None}


if __name__ == "__main__":
    port = int(os.getenv("LTX2_PORT", "8125"))
    uvicorn.run(app, host="0.0.0.0", port=port)

