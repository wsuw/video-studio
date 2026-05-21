import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Local Helper: Scan WAV binary headers to calculate precise duration
function getWavDuration(buffer: Buffer): number {
  try {
    // Read byte rate at offset 28 (32-bit unsigned int)
    const byteRate = buffer.readUInt32LE(28);
    if (byteRate <= 0) return 0;

    // Scan chunks to locate the 'data' chunk
    let offset = 12; // Skip 'RIFF', file size, 'WAVE'
    while (offset < buffer.length - 8) {
      const chunkId = buffer.toString("ascii", offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);

      if (chunkId === "data") {
        const duration = chunkSize / byteRate;
        return parseFloat(duration.toFixed(3));
      }

      // Safeguard against malformed/infinite chunks
      if (chunkSize <= 0) break;
      offset += 8 + chunkSize;
    }

    // Fallback: simple byte rate division
    return parseFloat((buffer.length / byteRate).toFixed(3));
  } catch (err) {
    console.error("[WAV Parser] Error reading WAV duration from header:", err);
  }
  return 0;
}

interface SpeakerTurn {
  speaker: string;
  text: string;
}

// Parses dialogue lines into speaker turns
function parseDialogue(text: string, characterVoices: Record<string, string>): SpeakerTurn[] {
  const speakerNames = new Set(
    Object.keys(characterVoices).map(name => name.toUpperCase())
  );
  speakerNames.add("NARRATOR");
  speakerNames.add("SYSTEM");
  
  const genericSpeakerRegex = /(?:^|\s|\n)([A-Z0-9_\-\u4e00-\u9fa5]+)\s*[:：]/g;
  let match;
  while ((match = genericSpeakerRegex.exec(text)) !== null) {
    const candidate = match[1].toUpperCase();
    if (candidate.length > 1) {
      speakerNames.add(candidate);
    }
  }

  const sortedSpeakers = Array.from(speakerNames).sort((a, b) => b.length - a.length);
  if (sortedSpeakers.length === 0) {
    return [];
  }

  const escapedSpeakers = sortedSpeakers.map(s => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  const turnRegex = new RegExp(`(?:^|\\s|\\n)(${escapedSpeakers.join("|")})\\s*[:：]\\s*`, "i");

  const parts = text.split(turnRegex);
  const turns: SpeakerTurn[] = [];
  
  let currentSpeaker = "NARRATOR";
  const firstPart = parts[0]?.trim();
  if (firstPart) {
    turns.push({ speaker: currentSpeaker, text: firstPart });
  }

  for (let i = 1; i < parts.length; i += 2) {
    const speaker = parts[i]?.trim().toUpperCase();
    const dialogue = parts[i + 1]?.trim();
    if (speaker && dialogue) {
      turns.push({ speaker, text: dialogue });
    }
  }

  return turns;
}

// Extracts the header and raw PCM data chunk from a WAV buffer
function extractWavPcmAndHeader(buffer: Buffer): { header: Buffer; pcm: Buffer } {
  let offset = 12; // Skip 'RIFF', file size, 'WAVE'
  while (offset < buffer.length - 8) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === "data") {
      const header = buffer.subarray(0, offset + 8);
      const pcm = buffer.subarray(offset + 8, offset + 8 + chunkSize);
      return { header, pcm };
    }

    if (chunkSize <= 0) break;
    offset += 8 + chunkSize;
  }
  
  return {
    header: buffer.subarray(0, 44),
    pcm: buffer.subarray(44),
  };
}

// Downloads remote speaker voices locally or resolves local relative path
async function resolveSpeakerPrompt(spk_audio_prompt: string): Promise<{ resolvedPath: string; tempPath: string | null }> {
  let resolvedSpkPath = spk_audio_prompt;
  let tempFilePath: string | null = null;

  if (
    spk_audio_prompt.startsWith("http://") ||
    spk_audio_prompt.startsWith("https://")
  ) {
    const tempDir = path.join(process.cwd(), "public", "audio", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilename = `spk_temp_${uuidv4()}.wav`;
    tempFilePath = path.join(tempDir, tempFilename);

    console.log(`[Generate Audio API] Downloading speaker prompt URL: ${spk_audio_prompt} -> ${tempFilePath}`);
    const downloadRes = await fetch(spk_audio_prompt);
    if (!downloadRes.ok) {
      throw new Error(`Failed to download remote speaker reference WAV file: ${downloadRes.statusText}`);
    }

    const arrayBuffer = await downloadRes.arrayBuffer();
    fs.writeFileSync(tempFilePath, Buffer.from(arrayBuffer));
    resolvedSpkPath = path.resolve(tempFilePath);
  } else {
    if (!path.isAbsolute(spk_audio_prompt)) {
      const absoluteIndexTtsPath = path.resolve(process.cwd(), "index-tts", spk_audio_prompt);
      if (fs.existsSync(absoluteIndexTtsPath)) {
        resolvedSpkPath = absoluteIndexTtsPath;
      }
    }
  }

  return { resolvedPath: resolvedSpkPath, tempPath: tempFilePath };
}

export async function POST(req: Request) {
  let tempFilePath: string | null = null;
  const tempFilesToDelete: string[] = [];
  try {
    const body = await req.json();
    const {
      text,
      spk_audio_prompt,
      emo_audio_prompt = null,
      emo_alpha = 1.0,
      emo_vector = null,
      use_emo_text = false,
      emo_text = null,
      use_random = false,
      interval_silence = 200,
      sceneId = "default",
      character_voices = {},
    } = body;

    if (!text || !spk_audio_prompt) {
      return NextResponse.json(
        { error: "Text and spk_audio_prompt are required" },
        { status: 400 }
      );
    }

    const ttsServerUrl = process.env.INDEX_TTS_API_URL || "http://127.0.0.1:8000/synthesize";

    const outputsDir = path.join(process.cwd(), "public", "audio", "outputs");
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir, { recursive: true });
    }

    // Parse the dialogue lines for multiple speakers
    const turns = parseDialogue(text, character_voices);
    console.log(`[Generate Audio API] Parsed ${turns.length} dialogue turns:`, turns);

    let audioBuffer: Buffer;

    if (turns.length <= 1) {
      // 1. Backwards-compatible path: Single speaker/narrator synthesis as usual
      let resolvedSpkPath = spk_audio_prompt;
      
      const { resolvedPath, tempPath } = await resolveSpeakerPrompt(spk_audio_prompt);
      resolvedSpkPath = resolvedPath;
      tempFilePath = tempPath;

      console.log(`[Generate Audio API] Calling IndexTTS2 FastAPI synthesis... Ref: ${resolvedSpkPath}`);

      const payload = {
        text,
        spk_audio_prompt: resolvedSpkPath,
        emo_audio_prompt,
        emo_alpha,
        emo_vector,
        use_emo_text,
        emo_text,
        use_random,
        interval_silence,
      };

      const response = await fetch(ttsServerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Generate Audio API] IndexTTS2 returned error status ${response.status}: ${errorText}`);
        return NextResponse.json(
          { error: `IndexTTS2 server synthesis failed: ${errorText}` },
          { status: response.status }
        );
      }

      const audioArrayBuffer = await response.arrayBuffer();
      audioBuffer = Buffer.from(audioArrayBuffer);
    } else {
      // 2. High-Fidelity path: Multi-speaker individual synthesis and PCM stitching
      const pcmBuffers: Buffer[] = [];
      let firstHeader: Buffer | null = null;

      for (const turn of turns) {
        const { speaker, text: turnText } = turn;
        
        // Find speaker voice reference
        let speakerVoiceRef = spk_audio_prompt; // Fallback
        if (character_voices[speaker]) {
          speakerVoiceRef = character_voices[speaker];
        } else if (speaker === "NARRATOR") {
          speakerVoiceRef = "examples/voice_04.wav"; // Narrator preset
        }

        const { resolvedPath, tempPath } = await resolveSpeakerPrompt(speakerVoiceRef);
        if (tempPath) {
          tempFilesToDelete.push(tempPath);
        }

        console.log(`[Generate Audio API] Synthesizing turn for speaker [${speaker}] with voice [${resolvedPath}]: "${turnText}"`);

        const payload = {
          text: turnText,
          spk_audio_prompt: resolvedPath,
          emo_audio_prompt,
          emo_alpha,
          emo_vector,
          use_emo_text,
          emo_text: use_emo_text ? turnText : null,
          use_random,
          interval_silence: 0, // Control silence directly in our node stitching logic
        };

        const response = await fetch(ttsServerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`TTS synthesis failed for speaker ${speaker}: ${errorText}`);
        }

        const turnArrayBuffer = await response.arrayBuffer();
        const turnWavBuffer = Buffer.from(turnArrayBuffer);

        const { header, pcm } = extractWavPcmAndHeader(turnWavBuffer);
        if (!firstHeader) {
          firstHeader = header;
        }

        // Insert silence between turns
        if (pcmBuffers.length > 0 && interval_silence > 0 && firstHeader) {
          const sampleRate = firstHeader.readUInt32LE(24);
          const blockAlign = firstHeader.readUInt16LE(32);
          const silenceSamples = Math.round(sampleRate * (interval_silence / 1000));
          const silenceBytes = silenceSamples * blockAlign;
          const silenceBuffer = Buffer.alloc(silenceBytes, 0);
          pcmBuffers.push(silenceBuffer);
        }

        pcmBuffers.push(pcm);
      }

      if (!firstHeader) {
        throw new Error("Failed to synthesize audio for any speaker turn");
      }

      const combinedPcm = Buffer.concat(pcmBuffers);
      const finalHeader = Buffer.from(firstHeader);
      
      const totalPcmLength = combinedPcm.length;
      const totalFileSize = finalHeader.length + totalPcmLength - 8;
      
      finalHeader.writeUInt32LE(totalFileSize, 4);
      finalHeader.writeUInt32LE(totalPcmLength, finalHeader.length - 4);

      audioBuffer = Buffer.concat([finalHeader, combinedPcm]);
    }

    // Save final stitched WAV to public outputs
    const outputFilename = `scene_${sceneId}_${Date.now()}.wav`;
    const absoluteOutputPath = path.join(outputsDir, outputFilename);
    fs.writeFileSync(absoluteOutputPath, audioBuffer);

    // Calculate precision duration
    const duration = getWavDuration(audioBuffer);
    console.log(`[Generate Audio API] Generation success! Output: ${absoluteOutputPath}, Duration: ${duration}s`);

    const webUrl = `/audio/outputs/${outputFilename}`;

    return NextResponse.json({
      status: "success",
      url: webUrl,
      duration: duration,
    });
  } catch (error: any) {
    console.error("[Generate Audio API] Error calling IndexTTS2 FastAPI:", error);
    return NextResponse.json(
      { error: error.message || "Failed to synthesize voiceover with local model server" },
      { status: 500 }
    );
  } finally {
    // Cleanup downloaded temporary speaker file if it exists
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        console.error("[Generate Audio API] Error deleting temp file:", cleanupErr);
      }
    }
    // Cleanup all temp files generated for multi-speaker turns
    for (const fileToDelete of tempFilesToDelete) {
      if (fileToDelete && fs.existsSync(fileToDelete)) {
        try {
          fs.unlinkSync(fileToDelete);
        } catch (cleanupErr) {
          console.error("[Generate Audio API] Error deleting turn temp file:", cleanupErr);
        }
      }
    }
  }
}
