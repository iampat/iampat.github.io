#!/usr/bin/env node
// Captions: one SRT cue per sentence, timed from src/timeline.json (measured audio).
// Usage: node tools/captions.mjs --ep ep2 [out/ep2/kicks.srt]

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const epArg = process.argv.indexOf("--ep");
const EP = epArg >= 0 ? process.argv[epArg + 1] : "ep1";
const out = process.argv.find((a, i) => i >= 2 && a.endsWith(".srt")) ?? `out/${EP}/kicks.srt`;
const t = JSON.parse(readFileSync(`src/timeline.${EP}.json`, "utf8"));
const fps = t.fps;

const stamp = (s) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(sec)},${p(r, 3)}`;
};

/** Split a line into at most two lines of about 42 characters, at a word break near the middle. */
const wrap = (text) => {
  if (text.length <= 42) return text;
  const words = text.split(" ");
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ").length;
    const b = words.slice(i).join(" ").length;
    const d = Math.abs(a - b);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return `${words.slice(0, best).join(" ")}\n${words.slice(best).join(" ")}`;
};

const cues = [];
for (const s of t.scenes) {
  const base = (s.startFrame + s.leadFrames) / fps;
  for (const x of s.sentences) {
    cues.push({ start: base + x.start, end: base + x.end + 0.25, text: x.text.replace(/<[^>]+>/g, "").trim() });
  }
}
// No overlaps: end each cue before the next starts.
for (let i = 0; i < cues.length - 1; i++) cues[i].end = Math.min(cues[i].end, cues[i + 1].start - 0.04);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, cues.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${wrap(c.text)}\n`).join("\n"));
console.log(`${cues.length} captions -> ${out}`);
