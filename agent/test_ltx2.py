import os
import time
import logging
import torch
import huggingface_hub
import diffusers
from diffusers.pipelines.ltx2 import LTX2Pipeline, LTX2LatentUpsamplePipeline
from diffusers.pipelines.ltx2.latent_upsampler import LTX2LatentUpsamplerModel
from diffusers.pipelines.ltx2.utils import DISTILLED_SIGMA_VALUES, STAGE_2_DISTILLED_SIGMA_VALUES
from diffusers.pipelines.ltx2.export_utils import encode_video

# Record the start time of the entire script execution
script_start_time = time.time()

# Enable logging and progress reporting
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
huggingface_hub.logging.set_verbosity_info()
diffusers.utils.logging.set_verbosity_info()

device = "cuda"
width = 512
height = 512
random_seed = 42
generator = torch.Generator(device).manual_seed(random_seed)
model_path = "rootonchair/LTX-2-19b-distilled"

print("=" * 60)
print(f"Starting LTX-2 pipeline initialization...")
print(f"Model ID: {model_path}")
print("NOTE: The model is 19 Billion parameters (very large!).")
print("If running for the first time, downloading the weights (approx. 38GB) may take a while.")
print("Please check your network speed if it appears to be stuck during downloading.")
print("=" * 60)

start_time = time.time()
print(f"[{time.strftime('%H:%M:%S')}] Loading LTX-2 distilled pipeline from Hugging Face / Cache...")
pipe = LTX2Pipeline.from_pretrained(
    model_path, torch_dtype=torch.bfloat16
)
print(f"[{time.strftime('%H:%M:%S')}] Base pipeline loaded in {time.time() - start_time:.2f} seconds.")

# Enable FP8 Layerwise Casting on Transformer to fit 19B model into RTX 3090's 24GB VRAM
if hasattr(pipe, "transformer") and hasattr(pipe.transformer, "enable_layerwise_casting"):
    print(f"[{time.strftime('%H:%M:%S')}] Enabling FP8 layerwise casting on base pipeline transformer...")
    pipe.transformer.enable_layerwise_casting(
        storage_dtype=torch.float8_e4m3fn,
        compute_dtype=torch.bfloat16
    )
    print("Enabling model CPU offload for base pipeline (extremely fast compared to sequential offload)...")
    pipe.enable_model_cpu_offload(device=device)
else:
    print("WARNING: FP8 layerwise casting not supported. Falling back to sequential CPU offload...")
    pipe.enable_sequential_cpu_offload(device=device)

# Enable VAE tiling to prevent VRAM OOM during decoding
print("Enabling VAE tiling...")
pipe.vae.enable_tiling()

prompt = "A beautiful sunset over the ocean"
negative_prompt = "shaky, glitchy, low quality, worst quality, deformed, distorted, disfigured, motion smear, motion artifacts, fused fingers, bad anatomy, weird hand, ugly, transition, static."

def stage1_callback(pipe_obj, step_index, timestep, callback_kwargs):
    print(f"[{time.strftime('%H:%M:%S')}] [Stage 1] Step {step_index}/8 completed. Timestep: {timestep.item() if hasattr(timestep, 'item') else timestep}")
    return callback_kwargs

print(f"[{time.strftime('%H:%M:%S')}] Generating stage 1 base latents (prompt: '{prompt}')...")
frame_rate = 24.0
stage1_start = time.time()
video_latent, audio_latent = pipe(
    prompt=prompt,
    negative_prompt=negative_prompt,
    width=width,
    height=height,
    num_frames=121,
    frame_rate=frame_rate,
    num_inference_steps=8,
    sigmas=DISTILLED_SIGMA_VALUES,
    guidance_scale=1.0,
    generator=generator,
    output_type="latent",
    return_dict=False,
    callback_on_step_end=stage1_callback,
)
print(f"[{time.strftime('%H:%M:%S')}] Stage 1 base latents generated in {time.time() - stage1_start:.2f} seconds.")

# Force offload Stage 1 models to CPU to free VRAM for the next stages
print("Offloading Stage 1 transformer and text_encoder to CPU...")
pipe.transformer.to("cpu")
if hasattr(pipe, "text_encoder"):
    pipe.text_encoder.to("cpu")
import gc
gc.collect()
torch.cuda.empty_cache()

print(f"[{time.strftime('%H:%M:%S')}] Loading latent upsampler model...")
upsampler_start = time.time()
latent_upsampler = LTX2LatentUpsamplerModel.from_pretrained(
    model_path,
    subfolder="latent_upsampler",
    torch_dtype=torch.bfloat16,
)
if hasattr(latent_upsampler, "enable_layerwise_casting"):
    print(f"[{time.strftime('%H:%M:%S')}] Enabling FP8 layerwise casting on latent upsampler...")
    latent_upsampler.enable_layerwise_casting(
        storage_dtype=torch.float8_e4m3fn,
        compute_dtype=torch.bfloat16
    )
upsample_pipe = LTX2LatentUpsamplePipeline(vae=pipe.vae, latent_upsampler=latent_upsampler)
print(f"[{time.strftime('%H:%M:%S')}] Latent upsampler loaded in {time.time() - upsampler_start:.2f} seconds.")

print("Enabling model CPU offload for upsample pipeline...")
upsample_pipe.enable_model_cpu_offload(device=device)

print(f"[{time.strftime('%H:%M:%S')}] Upsampling video latents...")
upscale_start = time.time()
upscaled_video_latent = upsample_pipe(
    latents=video_latent,
    output_type="latent",
    return_dict=False,
)[0]
print(f"[{time.strftime('%H:%M:%S')}] Video latents upsampled in {time.time() - upscale_start:.2f} seconds.")

# Force offload upsampler to CPU to free VRAM for Stage 2 VAE decoding
print("Offloading latent upsampler to CPU...")
upsample_pipe.latent_upsampler.to("cpu")
gc.collect()
torch.cuda.empty_cache()

def stage2_callback(pipe_obj, step_index, timestep, callback_kwargs):
    print(f"[{time.strftime('%H:%M:%S')}] [Stage 2] Step {step_index}/3 completed. Timestep: {timestep.item() if hasattr(timestep, 'item') else timestep}")
    return callback_kwargs

print(f"[{time.strftime('%H:%M:%S')}] Generating stage 2 refined video and audio...")
stage2_start = time.time()
video, audio = pipe(
    latents=upscaled_video_latent,
    audio_latents=audio_latent,
    prompt=prompt,
    negative_prompt=negative_prompt,
    num_inference_steps=3,
    noise_scale=STAGE_2_DISTILLED_SIGMA_VALUES[0], # renoise with first sigma value
    sigmas=STAGE_2_DISTILLED_SIGMA_VALUES,
    generator=generator,
    guidance_scale=1.0,
    output_type="np",
    return_dict=False,
    callback_on_step_end=stage2_callback,
)
print(f"[{time.strftime('%H:%M:%S')}] Stage 2 refined video and audio generated in {time.time() - stage2_start:.2f} seconds.")

# Force offload Stage 2 components to CPU and clear VRAM
print("Offloading Stage 2 components and clearing CUDA cache...")
pipe.vae.to("cpu")
pipe.transformer.to("cpu")
gc.collect()
torch.cuda.empty_cache()

output_path = "ltx2_distilled_sample.mp4"
print(f"[{time.strftime('%H:%M:%S')}] Encoding generated video and audio to {output_path}...")
encode_video(
    video[0],
    fps=frame_rate,
    audio=audio[0].float().cpu(),
    audio_sample_rate=pipe.vocoder.config.output_sampling_rate,
    output_path=output_path,
)
total_elapsed = time.time() - script_start_time
print(f"[{time.strftime('%H:%M:%S')}] Done! Test completed successfully. Total run time: {total_elapsed:.2f} seconds.")


