#!/usr/bin/env node
// Narration with Gemini TTS: one request per scene, cached by a hash of the request.
//
// Usage:
//   node tools/tts.mjs --ep ep2                # all scenes in script/ep2/storyboard.json -> public/vo/ep2
//   node tools/tts.mjs --scenes s01,s10        # some scenes
//   node tools/tts.mjs --voices Charon,Algieba --scenes s01 --out public/vo-test
//   node tools/tts.mjs --storyboard research/some.json
//
// Output: <out>/<sceneId>.wav (or <sceneId>-<voice>.wav with several voices),
// 48 kHz mono 16-bit, loudness-normalised per clip.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const MODEL = "gemini-3.8-flash-tts";
const STYLE = "warm, friendly, clear, lightly playful, natural pace";
const DEFAULT_VOICE = "Charon";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]?.startsWith("--") ? true : all[i + 1] ?? true]);
    return acc;
  }, []),
);

const EP = args.ep ?? "ep1";
const storyboardPath = args.storyboard ?? `script/${EP}/storyboard.json`;
const outDir = args.out ?? `public/vo/${EP}`;
const cacheDir = "cache/tts";
const voices = (args.voices ?? process.env.TTS_VOICE ?? DEFAULT_VOICE).split(",");
const onlyScenes = args.scenes ? String(args.scenes).split(",") : null;

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error("GEMINI_API_KEY is not set");
  process.exit(1);
}

const storyboard = JSON.parse(readFileSync(storyboardPath, "utf8"));
const scenes = (storyboard.scenes ?? storyboard).filter((s) => !onlyScenes || onlyScenes.includes(s.id));
if (scenes.length === 0) {
  console.error("No scenes matched");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function requestSpeech(text, voice) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    contents: [{ role: "user", parts: [{ text, speech_metadata: { style: STYLE } }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  };
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = await res.json();
      const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!part) throw new Error(`No audio in response: ${JSON.stringify(json).slice(0, 400)}`);
      return { data: Buffer.from(part.inlineData.data, "base64"), mime: part.inlineData.mimeType };
    }
    const errText = await res.text();
    if (res.status === 429 || res.status >= 500) {
      const wait = 2000 * attempt * attempt;
      console.warn(`  ${res.status}, retry in ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    throw new Error(`TTS ${res.status}: ${errText.slice(0, 600)}`);
  }
  throw new Error("TTS failed after retries");
}

function toWav48k(raw, mime, outPath) {
  const tmp = `${outPath}.raw`;
  writeFileSync(tmp, raw);
  // Newer models return a full WAV. Older ones return headerless 24 kHz 16-bit PCM.
  const isWav = raw.subarray(0, 4).toString("ascii") === "RIFF";
  const input = isWav ? ["-i", tmp] : ["-f", "s16le", "-ar", String(/rate=(\d+)/.exec(mime ?? "")?.[1] ?? 24000), "-ac", "1", "-i", tmp];
  execFileSync("ffmpeg", [
    "-y", "-v", "error", ...input,
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000",
    "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", outPath,
  ]);
  execFileSync("rm", ["-f", tmp]);
}

const duration = (p) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).toString().trim());

for (const scene of scenes) {
  for (const voice of voices) {
    // Natural gaps between sentences are enough; short-pause tags made the video run long.
    const text = scene.narration.replace(/<short pause>/g, " ").replace(/\s+/g, " ").trim();
    const hash = createHash("sha1").update(JSON.stringify([MODEL, voice, STYLE, text])).digest("hex").slice(0, 16);
    const cached = join(cacheDir, `${hash}.wav`);
    const name = voices.length > 1 ? `${scene.id}-${voice}.wav` : `${scene.id}.wav`;
    const out = join(outDir, name);
    if (!existsSync(cached)) {
      process.stdout.write(`${scene.id} (${voice}) ... `);
      const { data, mime } = await requestSpeech(text, voice);
      toWav48k(data, mime, cached);
      console.log(`${duration(cached).toFixed(2)} s [${mime}]`);
    } else {
      console.log(`${scene.id} (${voice}) cached ${duration(cached).toFixed(2)} s`);
    }
    copyFileSync(cached, out);
  }
}
