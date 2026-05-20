import time
import torch
from diffusers.pipelines.ltx2 import LTX2Pipeline
from diffusers.pipelines.ltx2.utils import DISTILLED_SIGMA_VALUES
from diffusers.pipelines.ltx2.export_utils import encode_video

device = "cuda"
width = 768
height = 512
random_seed = 42
generator = torch.Generator(device).manual_seed(random_seed)
model_path = "rootonchair/LTX-2-19b-distilled"

load_start = time.time()
print("Loading base LTX-2 pipeline (local cache only)...")
pipe = LTX2Pipeline.from_pretrained(
    model_path, torch_dtype=torch.bfloat16, local_files_only=True
)

if hasattr(pipe, "transformer") and hasattr(pipe.transformer, "enable_layerwise_casting"):
    print("Enabling FP8 layerwise casting on base pipeline transformer...")
    pipe.transformer.enable_layerwise_casting(
        storage_dtype=torch.float8_e4m3fn,
        compute_dtype=torch.bfloat16
    )
    print("Enabling model CPU offload...")
    pipe.enable_model_cpu_offload(device=device)
else:
    print("WARNING: FP8 layerwise casting not supported. Falling back to sequential CPU offload...")
    pipe.enable_sequential_cpu_offload(device=device)

pipe.vae.enable_tiling()
print(f"Base pipeline loaded in {time.time() - load_start:.2f} seconds.")
print("Text Encoder Model Class:", type(pipe.text_encoder))

prompt = "A beautiful sunset over the ocean"
negative_prompt = "shaky, glitchy, low quality, worst quality, deformed, distorted, disfigured, motion smear, motion artifacts, fused fingers, bad anatomy, weird hand, ugly, transition, static."

frame_rate = 24.0
stage1_start = time.time()
print("Generating video using ONLY Stage 1 (direct VAE decoding to numpy)...")
video, audio = pipe(
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
    output_type="np",       # Directly decode to numpy (skipping latent upsampling and refinement)
    return_dict=False,
)
print(f"Stage 1 generation completed in {time.time() - stage1_start:.2f} seconds.")

encode_start = time.time()
output_path = "ltx2_stage1_only.mp4"
print(f"Encoding Stage 1 video and audio to {output_path}...")
encode_video(
    video[0],
    fps=frame_rate,
    audio=audio[0].float().cpu(),
    audio_sample_rate=pipe.vocoder.config.output_sampling_rate,
    output_path=output_path,
)
print(f"Video encoding completed in {time.time() - encode_start:.2f} seconds.")
print(f"Total pipeline run completed in {time.time() - load_start:.2f} seconds!")