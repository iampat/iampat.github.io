#!/usr/bin/env node
// QA frames: extract one frame every N frames from a rendered video at EXACT frame numbers,
// and write an index that maps each frame to its scene, scene-local frame and the sentence
// being spoken. (ffmpeg's fps=1/2 filter picks frames half an interval late; select does not.)
//
// Usage: node tools/qa-frames.mjs --ep ep2 --video out/ep2/kicks_draft.mp4 [--every 60] [--out out/ep2/qa]

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
};
const EP = arg("ep", "ep1");
const video = arg("video", `out/${EP}/kicks_draft.mp4`);
const every = Number(arg("every", "60"));
const outDir = arg("out", `out/${EP}/qa`);
const width = Number(arg("width", "960"));

if (!existsSync(video)) throw new Error(`missing video ${video}`);
const t = JSON.parse(readFileSync(`src/timeline.${EP}.json`, "utf8"));
const fps = t.fps;

if (existsSync(outDir)) rmSync(outDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

// Exact frame picks: n is the 0-based frame index of the video stream.
execFileSync("ffmpeg", [
  "-y", "-v", "error", "-i", video,
  "-vf", `select='not(mod(n\\,${every}))',scale=${width}:-1`,
  "-fps_mode", "vfr", join(outDir, "f%04d.png"),
]);

const files = readdirSync(outDir).filter((f) => f.endsWith(".png")).sort();
const index = files.map((f, i) => {
  const gf = i * every;
  const scene = t.scenes.find((s) => s.startFrame <= gf && gf < s.startFrame + s.frames);
  if (!scene) return { file: join(outDir, f), frame: gf, time_s: gf / fps };
  const lf = gf - scene.startFrame;
  const ts = (lf - scene.leadFrames) / fps;
  const now = scene.sentences.find((x) => x.start - 0.15 <= ts && ts <= x.end + 0.3);
  const prev = [...scene.sentences].reverse().find((x) => x.end < ts);
  const word = (scene.words ?? []).find((w) => w.start <= ts && ts <= w.end);
  return {
    file: join(outDir, f),
    frame: gf,
    time_s: Number((gf / fps).toFixed(2)),
    scene: scene.id,
    chapter: scene.chapter,
    scene_frame: lf,
    spoken_now: now?.text ?? null,
    word_now: word?.w ?? null,
    last_spoken: prev?.text ?? null,
  };
});
writeFileSync(join(outDir, "index.json"), JSON.stringify(index, null, 1));
console.log(`${files.length} frames every ${every} frames -> ${outDir}/index.json`);
