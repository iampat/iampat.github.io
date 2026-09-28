#!/usr/bin/env node
// Builds src/timeline.<ep>.json from the narration clips (node tools/timeline.mjs --ep ep2). Audio is the master clock:
// every scene length and every sentence start comes from the measured audio.
//
// For each scene: duration (ffprobe) and sentence start/end times, found by
// matching the silences in the clip (ffmpeg silencedetect) to sentence breaks.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

export const FPS = 30;
const TAIL_FRAMES = 12; // breath after each scene
const LEAD_FRAMES = 6; // tiny gap before narration starts
const MAX_SCENE_S = 45;
const MIN_TOTAL_S = 300;
const MAX_TOTAL_S = 420;
/** Extra hold frames after the narration for scenes that end on a card. */
const EXTRA_TAIL = { s02: 45, s09: 20, s13: 75, s20: 75, s23: 36, b03: 45, b17: 60, b21: 20, b22: 36 };

const PARTIAL = process.argv.includes("--partial"); // skip missing clips and the total-length check
const epArg = process.argv.indexOf("--ep");
const EP = epArg >= 0 ? process.argv[epArg + 1] : "ep1";
const sbPath = process.argv.find((a) => a.endsWith(".json")) ?? `script/${EP}/storyboard.json`;
const sb = JSON.parse(readFileSync(sbPath, "utf8"));
const errors = [];

const probe = (p) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).toString().trim());

const findSilences = (p) => {
  let out;
  try {
    out = execFileSync(
      "sh",
      ["-c", `ffmpeg -hide_banner -nostats -i "${p}" -af silencedetect=noise=-38dB:d=0.16 -f null - 2>&1`],
    ).toString();
  } catch (e) {
    out = String(e.stdout ?? "") + String(e.stderr ?? "");
  }
  const starts = [...out.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...out.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  return starts.map((s, i) => ({ start: s, end: ends[i] ?? s })).filter((x) => x.end > x.start);
};

// ---- Word timing with local whisper.cpp (no audio leaves the machine) ----
const WHISPER_MODEL = "cache/whisper/ggml-base.en.bin";
const hasWhisper = (() => {
  try {
    execFileSync("which", ["whisper-cli"], { stdio: "ignore" });
    return existsSync(WHISPER_MODEL);
  } catch {
    return false;
  }
})();

const normWord = (w) => w.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']/g, "");

/** Whisper words with times (sub-word tokens merged), cached by audio hash. */
const whisperWords = (wavPath) => {
  const hash = createHash("sha1").update(readFileSync(wavPath)).digest("hex").slice(0, 16);
  const base = `cache/whisper/${hash}`;
  if (!existsSync(`${base}.json`)) {
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", wavPath, "-ar", "16000", "-ac", "1", `${base}.wav`]);
    execFileSync("whisper-cli", ["-m", WHISPER_MODEL, "-f", `${base}.wav`, "-ml", "1", "-ojf", "-of", base, "-np"], { stdio: "ignore" });
  }
  const segs = JSON.parse(readFileSync(`${base}.json`, "utf8")).transcription;
  const words = [];
  for (const sg of segs) {
    const raw = sg.text;
    const t0 = sg.offsets.from / 1000;
    const t1 = sg.offsets.to / 1000;
    const n = normWord(raw);
    if (!n) continue;
    if (!raw.startsWith(" ") && words.length) {
      const last = words[words.length - 1];
      last.w += n;
      last.end = t1;
    } else words.push({ w: n, start: t0, end: t1 });
  }
  return words;
};

const similar = (a, b) => {
  if (a === b) return 0;
  if (a.length > 3 && b.length > 3 && (a.startsWith(b) || b.startsWith(a))) return 0.4;
  // Small edit distance.
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  const e = d[a.length][b.length];
  return e <= Math.max(1, Math.floor(Math.min(a.length, b.length) / 3)) ? 0.6 : 1.2;
};

/** Align script words to whisper words (Needleman-Wunsch) and give every script word a time. */
const alignWords = (scriptWords, heard) => {
  const n = scriptWords.length;
  const m = heard.length;
  const GAP = 0.8;
  const D = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const B = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) (D[i][0] = i * GAP), (B[i][0] = 1);
  for (let j = 1; j <= m; j++) (D[0][j] = j * GAP), (B[0][j] = 2);
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const diag = D[i - 1][j - 1] + similar(scriptWords[i - 1], heard[j - 1].w);
      const up = D[i - 1][j] + GAP;
      const left = D[i][j - 1] + GAP;
      if (diag <= up && diag <= left) (D[i][j] = diag), (B[i][j] = 0);
      else if (up <= left) (D[i][j] = up), (B[i][j] = 1);
      else (D[i][j] = left), (B[i][j] = 2);
    }
  const match = new Array(n).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (B[i][j] === 0) {
      if (similar(scriptWords[i - 1], heard[j - 1].w) < 1.2) match[i - 1] = j - 1;
      i--, j--;
    } else if (B[i][j] === 1) i--;
    else j--;
  }
  // Times for matched words; interpolate the rest between matched neighbours.
  const out = scriptWords.map((w, k) => (match[k] >= 0 ? { w, start: heard[match[k]].start, end: heard[match[k]].end, heard: true } : { w, start: NaN, end: NaN, heard: false }));
  for (let k = 0; k < n; k++) {
    if (out[k].heard) continue;
    let a = k - 1;
    while (a >= 0 && !out[a].heard) a--;
    let b = k + 1;
    while (b < n && !out[b].heard) b++;
    const t0 = a >= 0 ? out[a].end : heard.length ? heard[0].start : 0;
    const t1 = b < n ? out[b].start : heard.length ? heard[heard.length - 1].end : t0 + 0.3;
    const span = b - a;
    out[k].start = t0 + ((t1 - t0) * (k - a - 0.5)) / span;
    out[k].end = t0 + ((t1 - t0) * (k - a + 0.5)) / span;
  }
  return { words: out, matched: match.filter((x) => x >= 0).length };
};

const splitSentences = (narration) =>
  narration
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);

const scenes = [];
let totalFrames = 0;

for (const s of sb.scenes) {
  const file = `vo/${EP}/${s.id}.wav`;
  const abs = `public/${file}`;
  if (!existsSync(abs)) {
    if (!PARTIAL) errors.push(`${s.id}: missing ${abs}`);
    continue;
  }
  const dur = probe(abs);
  if (dur > MAX_SCENE_S) errors.push(`${s.id}: ${dur.toFixed(1)} s is longer than ${MAX_SCENE_S} s`);

  const sentences = splitSentences(s.narration);
  const all = findSilences(abs);
  const gaps = all.filter((g) => g.start > 0.05 && g.end < dur - 0.05);
  const speechStart = all.find((g) => g.start <= 0.05)?.end ?? 0;
  const speechEnd = all.find((g) => g.end >= dur - 0.05)?.start ?? dur;

  const span = speechEnd - speechStart;

  // 1) Whisper words aligned to the script words (approximate times; whisper drifts).
  let aligned = null;
  const sentenceOf = [];
  if (hasWhisper) {
    const scriptWords = [];
    sentences.forEach((sen, si) =>
      sen.split(/\s+/).forEach((w) => {
        // Split hyphenated words the same way the scene cue lookup does.
        for (const part of w.split("-")) {
          const n = normWord(part);
          if (n) {
            scriptWords.push(n);
            sentenceOf.push(si);
          }
        }
      }),
    );
    const res = alignWords(scriptWords, whisperWords(abs));
    if (res.matched >= scriptWords.length * 0.6) {
      aligned = res.words;
      // Map whisper's range linearly onto the real speech range (its last word's end is
      // unreliable, so anchor on its start plus an estimated length).
      if (aligned.length > 1) {
        const w0 = aligned[0].start;
        const last = aligned[aligned.length - 1];
        const lastLen = Math.min(0.9, 0.12 + last.w.length * 0.065);
        const w1 = last.start;
        const a1 = Math.max(speechStart + 0.5, speechEnd - lastLen);
        if (w1 > w0 + 0.5) {
          const k = (a1 - speechStart) / (w1 - w0);
          for (const w of aligned) {
            const len = Math.max(0.08, (w.end - w.start) * k);
            w.start = speechStart + (w.start - w0) * k;
            w.end = w.start + len;
          }
          last.end = Math.min(speechEnd, last.start + lastLen);
        }
      }
    } else {
      console.log(`warn  ${s.id}: whisper matched only ${res.matched}/${scriptWords.length} words, using pause matching`);
    }
  }

  // 2) Expected sentence breaks: from whisper when we have it, else by characters spoken.
  const expected = [];
  if (aligned) {
    for (let i = 0; i < sentences.length - 1; i++) {
      const endI = Math.max(...aligned.filter((_, k) => sentenceOf[k] === i).map((w) => w.end));
      const startN = Math.min(...aligned.filter((_, k) => sentenceOf[k] === i + 1).map((w) => w.start));
      expected.push((endI + startN) / 2);
    }
  } else {
    const chars = sentences.map((t) => t.length);
    const totalChars = chars.reduce((a, b) => a + b, 0);
    let acc = 0;
    for (let i = 0; i < sentences.length - 1; i++) {
      acc += chars[i];
      expected.push(speechStart + (acc / totalChars) * span);
    }
  }

  // 3) Match the breaks to real pauses with dynamic programming: order kept, each break
  // prefers a pause near its expected time, longer pauses win (sentence ends pause longer
  // than commas). A break with no good pause keeps its expected time.
  const nB = expected.length;
  const nG = gaps.length;
  const NONE_COST = 1.1;
  const costOf = (k, j) => {
    const mid = (gaps[j].start + gaps[j].end) / 2;
    const gd = gaps[j].end - gaps[j].start;
    return Math.abs(mid - expected[k]) / Math.max(0.6, span * 0.08) - 0.9 * Math.min(gd, 0.8);
  };
  const dp = Array.from({ length: nB }, () => new Array(nG + 1).fill(Infinity));
  const back = Array.from({ length: nB }, () => new Array(nG + 1).fill(-1));
  const lastUsed = Array.from({ length: nB }, () => new Array(nG + 1).fill(-1));
  for (let k = 0; k < nB; k++) {
    for (let c = 0; c <= nG; c++) {
      const j = c - 1;
      const own = c === 0 ? NONE_COST : costOf(k, j);
      if (k === 0) {
        dp[k][c] = own;
        lastUsed[k][c] = j;
        continue;
      }
      for (let pc = 0; pc <= nG; pc++) {
        if (!Number.isFinite(dp[k - 1][pc])) continue;
        const prevLast = lastUsed[k - 1][pc];
        if (c > 0 && j <= prevLast) continue;
        const total = dp[k - 1][pc] + own;
        if (total < dp[k][c]) {
          dp[k][c] = total;
          back[k][c] = pc;
          lastUsed[k][c] = c > 0 ? j : prevLast;
        }
      }
    }
  }
  const choice = new Array(nB).fill(0);
  if (nB > 0) {
    let bestC = 0;
    for (let c = 0; c <= nG; c++) if (dp[nB - 1][c] < dp[nB - 1][bestC]) bestC = c;
    for (let k = nB - 1; k >= 0; k--) {
      choice[k] = bestC;
      bestC = back[k][bestC];
    }
  }
  const breaks = expected.map((e, k) =>
    choice[k] > 0 ? { end: gaps[choice[k] - 1].start, start: gaps[choice[k] - 1].end } : { end: e, start: e },
  );
  const timed = sentences.map((text, i) => ({
    text,
    start: i === 0 ? speechStart : breaks[i - 1].start,
    end: i === sentences.length - 1 ? speechEnd : breaks[i].end,
  }));

  // Repair short or reversed sentences: merge with a neighbour and split by characters.
  for (let i = 0; i < timed.length; i++) {
    if (timed[i].end - timed[i].start >= 0.25) continue;
    const j = i + 1 < timed.length ? i + 1 : i - 1;
    const a = Math.min(i, j);
    const b = Math.max(i, j);
    const from = a > 0 ? timed[a - 1].end + 0.08 : speechStart;
    const to = b < timed.length - 1 ? timed[b + 1].start - 0.08 : speechEnd;
    const ca = timed[a].text.length;
    const cb = timed[b].text.length;
    const mid = from + ((to - from) * ca) / (ca + cb);
    timed[a] = { ...timed[a], start: from, end: mid - 0.06 };
    timed[b] = { ...timed[b], start: mid + 0.06, end: to };
  }

  // 4) Words: spread each sentence's whisper words over that sentence's real span.
  let words = null;
  if (aligned) {
    words = [];
    for (let si = 0; si < timed.length; si++) {
      const ws = aligned.map((w, k) => ({ ...w, k })).filter((w) => sentenceOf[w.k] === si);
      if (!ws.length) continue;
      const a = ws[0].start;
      const b = Math.max(a + 0.05, ws[ws.length - 1].end);
      const A = timed[si].start;
      const B = timed[si].end;
      const m = (t) => A + ((t - a) * (B - A)) / (b - a);
      for (const w of ws) {
        const st = Math.min(Math.max(A, m(w.start)), B);
        const en = Math.min(Math.max(st + 0.05, m(w.end)), dur);
        words.push({ w: w.w, s: si, start: Number(st.toFixed(3)), end: Number(en.toFixed(3)) });
      }
    }
  }

  const frames = LEAD_FRAMES + Math.ceil(dur * FPS) + TAIL_FRAMES + (EXTRA_TAIL[s.id] ?? 0);
  scenes.push({
    id: s.id,
    chapter: s.chapter,
    file,
    durationInSeconds: Number(dur.toFixed(3)),
    leadFrames: LEAD_FRAMES,
    frames,
    startFrame: totalFrames,
    narration: s.narration,
    sentences: timed.map((t) => ({ ...t, start: Number(t.start.toFixed(3)), end: Number(t.end.toFixed(3)) })),
    ...(words ? { words } : {}),
  });
  totalFrames += frames;
}

const totalS = totalFrames / FPS;
if (!PARTIAL && !errors.length && (totalS < MIN_TOTAL_S || totalS > MAX_TOTAL_S)) {
  errors.push(`total ${totalS.toFixed(1)} s is outside ${MIN_TOTAL_S}-${MAX_TOTAL_S} s`);
}

writeFileSync(`src/timeline.${EP}.json`, JSON.stringify({ fps: FPS, episode: EP, totalFrames, scenes }, null, 2) + "\n");
const m = Math.floor(totalS / 60);
console.log(`${scenes.length} scenes, ${totalFrames} frames, ${m}:${String(Math.round(totalS % 60)).padStart(2, "0")}`);
for (const e of errors) console.log(`ERROR ${e}`);
process.exit(errors.length ? 1 : 0);
