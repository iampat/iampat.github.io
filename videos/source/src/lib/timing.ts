// Word-level cues for scenes. Audio is the master clock: every visual beat is keyed
// to a phrase in the narration, and this file turns the phrase into a frame number.
//
//   const cue = useCues("s04");
//   const f = cue("the whip");      // frame (inside the scene) where "the whip" starts
//   const e = cue.end("the whip");  // frame where the sentence holding it ends

import ep1 from "../timeline.ep1.json";
import ep2 from "../timeline.ep2.json";

export type TimedSentence = { text: string; start: number; end: number };
/** One narration word with its time (from local whisper alignment); s = sentence index. */
export type TimedWord = { w: string; s: number; start: number; end: number };
export type SceneTiming = {
  id: string;
  chapter: string;
  file: string;
  durationInSeconds: number;
  leadFrames: number;
  frames: number;
  startFrame: number;
  narration: string;
  sentences: TimedSentence[];
  words?: TimedWord[];
};

export type Timeline = { fps: number; episode?: string; totalFrames: number; scenes: SceneTiming[] };
export type EpisodeId = "ep1" | "ep2";
export const EPISODES: Record<EpisodeId, Timeline> = {
  ep1: ep1 as unknown as Timeline,
  ep2: ep2 as unknown as Timeline,
};
/** All scenes of all episodes (scene ids are unique across episodes). */
export const TIMELINE: Timeline = {
  fps: 30,
  totalFrames: EPISODES.ep1.totalFrames + EPISODES.ep2.totalFrames,
  scenes: [...EPISODES.ep1.scenes, ...EPISODES.ep2.scenes],
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const sceneTiming = (id: string): SceneTiming => {
  const s = TIMELINE.scenes.find((x) => x.id === id);
  if (!s) throw new Error(`No timing for scene ${id}. Run: node tools/timeline.mjs --ep <episode>`);
  return s;
};

export type Cue = ((phrase: string, offsetFrames?: number) => number) & {
  end: (phrase: string, offsetFrames?: number) => number;
  /** Frame where the phrase's last word ends (exact with word timing; else the sentence end). */
  wordEnd: (phrase: string, offsetFrames?: number) => number;
  sentence: (index: number) => { start: number; end: number };
  frames: number;
  lead: number;
};

/**
 * Returns a function that maps a narration phrase to the frame where it starts,
 * relative to the scene start. Throws if the phrase is not in the narration,
 * so a script change that breaks a beat fails loudly.
 */
export const useCues = (id: string): Cue => {
  const s = sceneTiming(id);
  const fps = TIMELINE.fps;
  const sentences = s.sentences.map((x) => ({ ...x, n: norm(x.text) }));

  const locate = (phrase: string) => {
    const p = norm(phrase);
    // Whole-word match first (so "in" does not match inside "standing"), then any substring.
    for (const sen of sentences) {
      const m = new RegExp(`(^| )${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).exec(sen.n);
      if (m) {
        const i = m.index + (m[1] ? 1 : 0);
        return { sen, frac: sen.n.length ? i / sen.n.length : 0 };
      }
    }
    for (const sen of sentences) {
      const i = sen.n.indexOf(p);
      if (i >= 0) return { sen, frac: sen.n.length ? i / sen.n.length : 0 };
    }
    throw new Error(`Scene ${id}: phrase not found in narration: "${phrase}"`);
  };

  // Exact word times when the timeline has them.
  const words = s.words;
  const findWords = (phrase: string) => {
    if (!words) return -1;
    const toks = norm(phrase).split(" ").filter(Boolean).map((t) => t.replace(/'/g, ""));
    const ws = words.map((w) => w.w.replace(/'/g, ""));
    for (let i = 0; i + toks.length <= ws.length; i++) {
      let ok = true;
      for (let k = 0; k < toks.length; k++) if (ws[i + k] !== toks[k]) ok = false;
      if (ok) return i;
    }
    return -1;
  };

  const cue = ((phrase: string, offset = 0) => {
    const wi = findWords(phrase);
    if (wi >= 0 && words) return Math.round(s.leadFrames + words[wi].start * fps) + offset;
    const { sen, frac } = locate(phrase);
    return Math.round(s.leadFrames + (sen.start + frac * (sen.end - sen.start)) * fps) + offset;
  }) as Cue;
  cue.end = (phrase: string, offset = 0) => {
    const { sen } = locate(phrase);
    return Math.round(s.leadFrames + sen.end * fps) + offset;
  };
  cue.wordEnd = (phrase: string, offset = 0) => {
    const wi = findWords(phrase);
    if (wi >= 0 && words) {
      const n = norm(phrase).split(" ").filter(Boolean).length;
      return Math.round(s.leadFrames + words[Math.min(words.length - 1, wi + n - 1)].end * fps) + offset;
    }
    return cue.end(phrase, offset);
  };
  cue.sentence = (index: number) => ({
    start: Math.round(s.leadFrames + s.sentences[index].start * fps),
    end: Math.round(s.leadFrames + s.sentences[index].end * fps),
  });
  cue.frames = s.frames;
  cue.lead = s.leadFrames;
  return cue;
};
