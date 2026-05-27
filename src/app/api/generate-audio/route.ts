import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// ── 类型定义 ──────────────────────────────────────────────
interface SpeakerTurn {
  speaker: string;
  text: string;
  emo_preset?: string;
  emo_alpha?: number;
  emo_vector?: number[];
  emotion_text?: string;
}

interface TtsApiResult {
  status: string;
  url: string;
  filename: string;
  duration?: number;
}

// ── WAV 工具函数 ───────────────────────────────────────────

/** 从 WAV 头精确计算时长（秒） */
function getWavDuration(buf: Buffer): number {
  try {
    const byteRate = buf.readUInt32LE(28);
    if (byteRate <= 0) return 0;
    let offset = 12;
    while (offset < buf.length - 8) {
      const chunkId = buf.toString("ascii", offset, offset + 4);
      const chunkSize = buf.readUInt32LE(offset + 4);
      if (chunkId === "data") return parseFloat((chunkSize / byteRate).toFixed(3));
      if (chunkSize <= 0) break;
      offset += 8 + chunkSize;
    }
    return parseFloat((buf.length / byteRate).toFixed(3));
  } catch {
    return 0;
  }
}

/** 从 WAV buffer 中分离 header 和 PCM 数据 */
function extractWavPcm(buf: Buffer): { header: Buffer; pcm: Buffer } {
  let offset = 12;
  while (offset < buf.length - 8) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === "data") {
      return {
        header: buf.subarray(0, offset + 8),
        pcm: buf.subarray(offset + 8, offset + 8 + chunkSize),
      };
    }
    if (chunkSize <= 0) break;
    offset += 8 + chunkSize;
  }
  return { header: buf.subarray(0, 44), pcm: buf.subarray(44) };
}

/** 将多段 PCM 拼接成完整 WAV（自动插入静音间隔） */
function stitchWav(segments: Buffer[], header: Buffer, silenceMs: number): Buffer {
  const sampleRate = header.readUInt32LE(24);
  const blockAlign = header.readUInt16LE(32);
  const silenceBytes = Math.round(sampleRate * (silenceMs / 1000)) * blockAlign;
  const silenceBuf = Buffer.alloc(silenceBytes, 0);

  const parts: Buffer[] = [];
  for (let i = 0; i < segments.length; i++) {
    if (i > 0 && silenceBytes > 0) parts.push(silenceBuf);
    parts.push(segments[i]);
  }

  const combinedPcm = Buffer.concat(parts);
  const finalHeader = Buffer.from(header);
  finalHeader.writeUInt32LE(finalHeader.length + combinedPcm.length - 8, 4);
  finalHeader.writeUInt32LE(combinedPcm.length, finalHeader.length - 4);
  return Buffer.concat([finalHeader, combinedPcm]);
}

// ── 音色参考解析 ───────────────────────────────────────────

/** 将音色 URL 或相对路径直接传递给 Python 后端进行下载和定位，免去 Next.js 端冗余下载 */
async function resolveSpeakerPath(
  ref: string
): Promise<{ resolved: string; temp: string | null }> {
  return { resolved: ref, temp: null };
}

// ── TTS API 调用 ───────────────────────────────────────────

/** 调用 IndexTTS2，返回 TTS 服务上传后的结果 */
async function callTts(url: string, payload: Record<string, unknown>): Promise<TtsApiResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`TTS API error ${res.status}: ${msg}`);
  }
  return res.json() as Promise<TtsApiResult>;
}

/** 从 TTS 返回的 url 下载 WAV buffer（自动将公网 MinIO 域名替换为局域网 Endpoint 域名以绕过 403 限制） */
async function fetchAudioBuffer(audioUrl: string, serverBase: string): Promise<Buffer> {
  let full = audioUrl.startsWith("http") ? audioUrl : `${serverBase}${audioUrl}`;

  const publicUrl = process.env.STORAGE_S3_PUBLIC_URL;
  const s3Endpoint = process.env.STORAGE_S3_ENDPOINT || "http://127.0.0.1:9000";

  if (publicUrl && full.startsWith(publicUrl)) {
    full = full.replace(publicUrl, s3Endpoint);
    console.log(`[Audio API] S3 public URL translated to local endpoint: ${full}`);
  }

  const res = await fetch(full);
  if (!res.ok) throw new Error(`Failed to download audio from ${full}: ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── 对话解析 ──────────────────────────────────────────────

/** 将多人对话文本拆分为 [{ speaker, text }] */
function parseDialogue(text: string, characterVoices: Record<string, string>): SpeakerTurn[] {
  const speakers = new Set([
    ...Object.keys(characterVoices).map(k => k.toUpperCase()),
    "NARRATOR",
    "SYSTEM",
  ]);

  // 自动识别文本中 "名字:" 格式的角色
  for (const m of text.matchAll(/(?:^|\s|\n)([A-Z0-9_\-\u4e00-\u9fa5]{2,})\s*[:：]/g)) {
    speakers.add(m[1].toUpperCase());
  }

  const sorted = [...speakers].sort((a, b) => b.length - a.length);
  const escaped = sorted.map(s => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"));
  const re = new RegExp(`(?:^|\\s|\\n)(${escaped.join("|")})\\s*[:：]\\s*`, "i");

  const parts = text.split(re);
  const turns: SpeakerTurn[] = [];

  if (parts[0]?.trim()) turns.push({ speaker: "NARRATOR", text: parts[0].trim() });
  for (let i = 1; i < parts.length; i += 2) {
    const speaker = parts[i]?.trim().toUpperCase();
    const dialogue = parts[i + 1]?.trim();
    if (speaker && dialogue) turns.push({ speaker, text: dialogue });
  }
  return turns;
}

// ── 清理临时文件 ───────────────────────────────────────────
function cleanupFiles(files: (string | null)[]) {
  for (const f of files) {
    if (f && fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  }
}

// ── 情绪配置解析工具函数 ───────────────────────────────────

function parseEmotionText(emotionText: string | undefined | null, defaultAlpha: number = 0.6): {
  emo_vector: number[] | null;
  emo_alpha: number;
  use_emo_text: boolean;
  emo_text: string | null;
} {
  if (!emotionText) {
    return { emo_vector: null, emo_alpha: defaultAlpha, use_emo_text: false, emo_text: null };
  }

  const trimmed = emotionText.trim();
  const lower = trimmed.toLowerCase();

  // 1. 匹配标准单情绪及强度格式，例如：happy: 0.8 或 calm: 0.6 或 happy
  const labels = [
    "happy",
    "angry",
    "sad",
    "afraid",
    "disgusted",
    "melancholic",
    "surprised",
    "calm",
  ];

  // 支持 scared -> afraid 映射以确保兼容性
  const cleanLower = lower === "scared" ? "afraid" : lower;

  const match = cleanLower.match(/^([a-z]+)(?:\s*:\s*([0-9.]+))?$/);
  if (match) {
    const emotionName = match[1];
    const strength = match[2] ? parseFloat(match[2]) : 0.8;

    const index = labels.indexOf(emotionName);
    if (index !== -1) {
      const vector = [0, 0, 0, 0, 0, 0, 0, 0];
      vector[index] = 1.0; // 该维度情绪置为满值，依靠 alpha 控制整体混合强度
      return {
        emo_vector: vector,
        emo_alpha: strength,
        use_emo_text: false,
        emo_text: trimmed,
      };
    }
  }

  // 2. 匹配 JSON / Python 字典格式的一组情绪强度混合，例如：{'happy': 0.2, 'calm': 0.05}
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      // 标准化为 JSON 双引号格式
      const jsonStr = trimmed.replace(/'/g, '"');
      const dict = JSON.parse(jsonStr);

      const labels = [
        "happy",
        "angry",
        "sad",
        "afraid",
        "disgusted",
        "melancholic",
        "surprised",
        "calm",
      ];

      // 建立近义词/同义词情绪映射表，确保未知情绪能够优雅转换
      const emotionMapping: Record<string, string> = {
        scared: "afraid",
        fear: "afraid",
        panicked: "afraid",
        excited: "happy",
        joy: "happy",
        determined: "calm", // determined 对应坚定，映射到 calm
        frustrated: "angry",
        grief: "sad",
        depressed: "sad",
        bored: "calm",
        tired: "calm",
      };

      // 进行清洗和聚合
      const cleanDict: Record<string, number> = {};
      for (const key of Object.keys(dict)) {
        const val = dict[key];
        if (typeof val === "number") {
          const lowerKey = key.toLowerCase().trim();
          const mappedKey = emotionMapping[lowerKey] || lowerKey;
          cleanDict[mappedKey] = (cleanDict[mappedKey] || 0) + val;
        }
      }

      const vector = labels.map(label => {
        return typeof cleanDict[label] === "number" ? cleanDict[label] : 0.0;
      });

      const parsedAlpha = typeof dict["alpha"] === "number" ? dict["alpha"] : defaultAlpha;

      return {
        emo_vector: vector,
        emo_alpha: parsedAlpha,
        use_emo_text: false,
        emo_text: trimmed,
      };
    } catch (e) {
      console.warn("[Audio API] Failed to parse dictionary-like emotion_text:", trimmed, e);
    }
  }

  // 3. 回退到传统的文本情绪描述（例如 "calm: 0.8" 或自由文本描述）
  return { emo_vector: null, emo_alpha: defaultAlpha, use_emo_text: true, emo_text: trimmed };
}

// ── POST Handler ───────────────────────────────────────────

export async function POST(req: Request) {
  const tempFiles: (string | null)[] = [];

  try {
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
      character_voices = {} as Record<string, string>,
      turns: clientTurns = null,
    } = await req.json();

    if (!text || !spk_audio_prompt) {
      return NextResponse.json({ error: "text and spk_audio_prompt are required" }, { status: 400 });
    }

    const wan2gpApiUrl = process.env.WAN2GP_API_URL || "http://127.0.0.1:8126";
    const ttsServerUrl = `${wan2gpApiUrl.replace(/\/$/, "")}/generate/audio`;
    const ttsServerBase = new URL(ttsServerUrl).origin;

    const outputsDir = path.join(process.cwd(), "public", "audio", "outputs");
    fs.mkdirSync(outputsDir, { recursive: true });

    // 基础 TTS 参数（无需每次重复声明）
    const baseTtsPayload = { emo_audio_prompt, emo_alpha, emo_vector, use_emo_text, use_random };

    const turns = clientTurns && clientTurns.length > 0
      ? clientTurns
      : parseDialogue(text, character_voices);
    console.log(`[Audio API] ${turns.length} turn(s) parsed`);

    let audioBuffer: Buffer;

    if (turns.length <= 1) {
      // ── 单人路径 ──────────────────────────────────────────
      const singleTurn = turns[0];
      const speaker = singleTurn?.speaker || "NARRATOR";
      const voiceRef = character_voices[speaker] ?? spk_audio_prompt;

      const { resolved, temp } = await resolveSpeakerPath(voiceRef);
      tempFiles.push(temp);

      // 解析单句的 emotion_text 属性
      const parsedEmo = parseEmotionText(singleTurn?.emotion_text || emo_text, emo_alpha);
      const finalEmoVector = parsedEmo.emo_vector ?? emo_vector;
      const finalEmoAlpha = parsedEmo.emo_alpha;
      const finalEmoText = parsedEmo.emo_text || (use_emo_text ? (singleTurn?.text ?? text) : null);
      const finalUseEmoText = parsedEmo.use_emo_text || use_emo_text;

      const result = await callTts(ttsServerUrl, {
        ...baseTtsPayload,
        text: singleTurn?.text ?? text,
        spk_audio_prompt: resolved,
        emo_vector: finalEmoVector,
        emo_alpha: finalEmoAlpha,
        emo_text: finalEmoText,
        use_emo_text: finalUseEmoText,
        interval_silence,
      });

      // 直接将 Python 产生并上传至存储的公网链接及算好的时长返回给前端，免去下载缓存环路！
      console.log(`[Audio API] Single-speaker direct URL returned: ${result.url} (${result.duration || 0}s)`);
      return NextResponse.json({
        status: "success",
        url: result.url,
        duration: result.duration || 0,
      });
    } else {
      // ── 多人路径：逐 turn 合成后 PCM 拼接 ─────────────────
      const pcmSegments: Buffer[] = [];
      let wavHeader: Buffer | null = null;

      for (const turn of turns) {
        const speaker = turn.speaker;
        const turnText = turn.text;

        // 解析当前 Turn 的 emotion_text
        const parsedEmo = parseEmotionText(turn.emotion_text || emo_text, emo_alpha);
        const turnEmoVector = parsedEmo.emo_vector ?? emo_vector;
        const turnEmoAlpha = parsedEmo.emo_alpha;
        const turnEmoText = parsedEmo.emo_text || (use_emo_text ? turnText : null);
        const turnUseEmoText = parsedEmo.use_emo_text || use_emo_text;

        const voiceRef = character_voices[speaker] ?? spk_audio_prompt;

        const { resolved, temp } = await resolveSpeakerPath(voiceRef);
        tempFiles.push(temp);

        console.log(`[Audio API] Synthesizing [${speaker}]: "${turnText.slice(0, 30)}..."`);

        const result = await callTts(ttsServerUrl, {
          ...baseTtsPayload,
          text: turnText,
          spk_audio_prompt: resolved,
          emo_vector: turnEmoVector,
          emo_alpha: turnEmoAlpha,
          emo_text: turnEmoText,
          use_emo_text: turnUseEmoText,
          interval_silence: 0,
        });

        const wavBuf = await fetchAudioBuffer(result.url, ttsServerBase);
        const { header, pcm } = extractWavPcm(wavBuf);
        if (!wavHeader) wavHeader = header;
        pcmSegments.push(pcm);
      }

      if (!wavHeader) throw new Error("No audio generated for any speaker turn");
      audioBuffer = stitchWav(pcmSegments, wavHeader, interval_silence);
    }

    // ── 上传到 MinIO / S3 并返回结果 ────────────────────────────
    const filename = `scene_${sceneId}_${Date.now()}.wav`;
    const duration = getWavDuration(audioBuffer);

    try {
      const s3Client = new S3Client({
        endpoint: process.env.STORAGE_S3_ENDPOINT || "http://127.0.0.1:9000",
        credentials: {
          accessKeyId: process.env.STORAGE_S3_ACCESS_KEY || "minioadmin",
          secretAccessKey: process.env.STORAGE_S3_SECRET_KEY || "minioadmin",
        },
        region: "us-east-1",
        forcePathStyle: true,
      });

      const s3Bucket = process.env.STORAGE_S3_BUCKET || "video-studio";

      console.log(`[Audio API] Uploading stitched audio to MinIO bucket "${s3Bucket}" as "${filename}"...`);
      await s3Client.send(new PutObjectCommand({
        Bucket: s3Bucket,
        Key: filename,
        Body: audioBuffer,
        ContentType: "audio/wav",
      }));

      const publicUrl = process.env.STORAGE_S3_PUBLIC_URL || process.env.STORAGE_S3_ENDPOINT || "http://127.0.0.1:9000";
      const fileUrl = `${publicUrl.replace(/\/$/, "")}/${s3Bucket}/${filename}`;
      console.log(`[Audio API] Stitched audio uploaded successfully to MinIO. Public URL: ${fileUrl}`);

      return NextResponse.json({
        status: "success",
        url: fileUrl,
        duration,
      });
    } catch (s3Error: any) {
      console.error("[Audio API] Failed to upload stitched audio to MinIO, falling back to local storage:", s3Error);

      const outPath = path.join(outputsDir, filename);
      fs.writeFileSync(outPath, audioBuffer);
      console.log(`[Audio API] Local fallback written: ${filename}`);

      return NextResponse.json({
        status: "success",
        url: `/audio/outputs/${filename}`,
        duration,
      });
    }
  } catch (err: any) {
    console.error("[Audio API] Error:", err);
    return NextResponse.json(
      { error: err.message || "Audio synthesis failed" },
      { status: 500 }
    );
  } finally {
    cleanupFiles(tempFiles);
  }
}
