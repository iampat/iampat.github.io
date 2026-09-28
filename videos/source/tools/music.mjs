#!/usr/bin/env node
// Original music with Lyria 3.5: one instrumental track per chapter, all in D major,
// so they crossfade cleanly at chapter changes. Cached by prompt hash.
// Usage: node tools/music.mjs [--only open,drive]

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const MODEL = "lyria-3.5";
const COMMON =
  "Instrumental only, no vocals, no voice, no choir. Original ambient electronic score for an animated science video. " +
  "Soft analog synth pads, warm and clean, gentle and calm, even dynamics, leaves room for a narrator's voice. Key of D major. ";

const TRACKS = {
  open: `${COMMON}About 60 seconds. 70 BPM. A quiet night stadium: low, wide synth pad, distant shimmer, a few soft bell notes, sparse and mysterious. No drums. Ends on a held chord.`,
  drive: `${COMMON}Purely instrumental: absolutely no singing, no humming, no vocal melody, no lyrics. About 2 minutes. 92 BPM. A steady, confident low pulse on a muted synth bass, soft muted kick drum on the beat, light plucked synth motif of three rising notes. Focused and determined, not aggressive. Loops smoothly.`,
  curler: `${COMMON}About 2 minutes. 92 BPM. A floating, airy arpeggio on a bright synth that bends gently, soft pads underneath, a feeling of something curving through the air. Light and curious. Very soft percussion only.`,
  volley: `${COMMON}About 2 minutes 20 seconds. 96 BPM. Syncopated soft rhythm with a gentle ticking hi-hat for timing tension, warm bass, playful marimba accents, building to a brighter lift in the second half. Energetic but still soft.`,
  ending: `${COMMON}About 75 seconds. 70 BPM. Warm and reflective resolution: pads and a gentle piano-like synth playing the three-note motif slowly, satisfying and a little wistful, gentle fade out at the end.`,
  // Episode 2: "Why the Best Players Look Slow"
  look: `${COMMON}About 2 minutes. 88 BPM. Curious and alert: a soft ticking woodblock like a quiet clock, sparse plucked synth notes, wide airy pads, a feeling of looking around and noticing things. No heavy drums. Loops smoothly.`,
  touch: `${COMMON}About 2 minutes. 88 BPM. Soft and tactile: muted plucks, a gentle marimba, warm sub bass that lands softly on the beat, calm and controlled, like a ball settling at your feet. Very light percussion. Loops smoothly.`,
  shape: `${COMMON}About 2 minutes. 88 BPM. Open and confident: wide warm pads that slowly open up, a clear simple three-note motif rising on a soft synth, a sense of space and seeing the whole field. Light brushed percussion. Loops smoothly.`,
  steal: `${COMMON}About 45 seconds. 96 BPM. Mischievous and playful: a sneaky staccato pluck, light shaker, a sly bass slide, short stops and starts like a feint, building to a small cheeky flourish. Loops smoothly.`,
  practice: `${COMMON}About 30 seconds. 92 BPM. A short, bright, friendly loop: clean plucked synth, light claps, cheerful and simple, like a sports training montage. Loops seamlessly.`,
};

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("GEMINI_API_KEY is not set");
mkdirSync("cache/music", { recursive: true });
mkdirSync("public/music", { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["AUDIO", "TEXT"] },
  };
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) });
    if (res.ok) {
      const json = await res.json();
      const parts = json.candidates?.[0]?.content?.parts ?? [];
      const audio = parts.find((p) => p.inlineData);
      const text = parts.filter((p) => p.text).map((p) => p.text).join("\n");
      if (!audio) throw new Error(`No audio: ${JSON.stringify(json).slice(0, 500)}`);
      return { data: Buffer.from(audio.inlineData.data, "base64"), mime: audio.inlineData.mimeType, text };
    }
    const err = await res.text();
    if (res.status === 429 || res.status >= 500) {
      console.warn(`  ${res.status}, retry`);
      await sleep(5000 * attempt);
      continue;
    }
    throw new Error(`Lyria ${res.status}: ${err.slice(0, 800)}`);
  }
  throw new Error("Lyria failed after retries");
}

const probe = (p) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).toString().trim());

await Promise.all(
  Object.entries(TRACKS)
    .filter(([name]) => !only || only.includes(name))
    .map(async ([name, prompt]) => {
      const hash = createHash("sha1").update(MODEL + prompt).digest("hex").slice(0, 16);
      const cached = join("cache/music", `${name}-${hash}.wav`);
      if (!existsSync(cached)) {
        const { data, mime, text } = await generate(prompt);
        const raw = `${cached}.raw`;
        writeFileSync(raw, data);
        // Normalise to 48 kHz stereo WAV at a calm level; the mix ducks it further under the voice.
        execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-af", "loudnorm=I=-20:TP=-2:LRA=9", "-ar", "48000", "-ac", "2", cached]);
        execFileSync("rm", ["-f", raw]);
        writeFileSync(`${cached}.txt`, `${mime}\n${text}\n`);
      }
      copyFileSync(cached, join("public/music", `${name}.wav`));
      console.log(`${name}: ${probe(cached).toFixed(1)} s`);
    }),
);
