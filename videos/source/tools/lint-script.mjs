#!/usr/bin/env node
// Checks the narration against the language rules for U12-U14 viewers.
// Exit code 1 on any error. Usage: node tools/lint-script.mjs [storyboard.json]

import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "script/storyboard.json";
const sb = JSON.parse(readFileSync(path, "utf8"));
const scenes = sb.scenes;

const errors = [];
const warnings = [];

// Words people mock AI text for, plus the user's own banned list.
const BANNED = [
  "delve", "delves", "delving", "tapestry", "realm", "testament", "demystify", "crucial", "landscape",
  "embark", "unleash", "unlock the secrets", "elevate", "harness", "navigate", "navigating", "seamless", "seamlessly",
  "intricate", "vibrant", "pivotal", "robust", "showcase", "game-changer", "game changer", "dive into",
  "dive deep", "deep dive", "it's worth noting", "worth noting", "in today's", "furthermore", "moreover",
  "additionally", "utilize", "leverage", "paramount", "meticulous", "bustling", "symphony", "journey",
  "ever-evolving", "in conclusion", "unveil", "whimsical", "boasts", "nestled", "captivating",
];

// Science words that must not appear unless they are declared learn-words.
const JARGON = [
  "magnus", "reynolds", "drag crisis", "boundary layer", "coefficient", "momentum", "kinetic", "elastic",
  "velocity", "aerodynamic", "turbulence", "turbulent", "vortex", "vortices", "trajectory", "deformation",
  "restitution", "angular", "torque", "bernoulli", "newton", "inertia", "acceleration", "oscillat",
  "friction", "drag", "gravity", "plant foot", "follow-through", "instep", "topspin", "backspin",
  // Episode 2 topics
  "reaction time", "peripheral", "field of view", "saccade", "fixation", "cognitive", "working memory",
  "perception", "visual exploratory", "exploratory", "coefficient", "restitution", "closing speed",
  "half-turn", "half turn", "open body", "back foot", "first touch", "cushion", "rondo", "scanning", "scan",
];

const learn = (sb.learn_words ?? []).map((w) => ({ ...w, term: w.term.toLowerCase() }));
if (learn.length < 4 || learn.length > 6) errors.push(`learn_words: need 4-6, found ${learn.length}`);

const strip = (t) => t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const words = (t) => strip(t).split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
const has = (text, term) => new RegExp(`(^|[^a-z])${term.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}`, "i").test(text);

const NUMBER_WORDS = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|hundredth|thousand|thousandths?|percent|metres?|kilometres?)\b/gi;

let total = 0;
let longish = 0;
let sentences = 0;
const firstUse = new Map();

for (const s of scenes) {
  const text = strip(s.narration);
  total += words(text).length;

  for (const b of BANNED) if (has(text, b)) errors.push(`${s.id}: banned word "${b}"`);

  for (const j of JARGON) {
    if (!has(text, j)) continue;
    const declared = learn.find((l) => l.term.includes(j) || j.includes(l.term));
    if (!declared) errors.push(`${s.id}: science/soccer term "${j}" is not a declared learn-word`);
  }

  for (const l of learn) {
    if (!firstUse.has(l.term) && has(text, l.term)) firstUse.set(l.term, s);
  }

  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const n = words(sentence).length;
    if (n === 0) continue;
    sentences++;
    if (n > 16) errors.push(`${s.id}: sentence has ${n} words (max 16): "${sentence}"`);
    else if (n > 12) longish++;
  }

  const nums = text.match(NUMBER_WORDS)?.filter((n) => !/^(one|two|three)$/i.test(n)) ?? [];
  if (nums.length > 0 && !(s.facts_used ?? []).length) {
    errors.push(`${s.id}: narration has numbers (${[...new Set(nums)].join(", ")}) but facts_used is empty`);
  }
}

for (const l of learn) {
  const s = firstUse.get(l.term);
  if (!s) {
    errors.push(`learn-word "${l.term}" is never used in the narration`);
    continue;
  }
  const beats = (s.visual_beats ?? []).join(" ").toLowerCase();
  if (!beats.includes("wordcard") && !beats.includes("word card")) {
    errors.push(`learn-word "${l.term}" first appears in ${s.id}, but that scene has no WordCard beat`);
  }
}

// The Gemini voice reads about 135 words per minute with pauses: 800-860 words is about 6:30 with holds.
if (total < 760 || total > 900) errors.push(`total words ${total}, allowed 760-900`);
else if (total < 800 || total > 860) warnings.push(`total words ${total}, target 800-860`);
if (sentences && longish / sentences > 0.3) {
  warnings.push(`${Math.round((100 * longish) / sentences)}% of sentences have 13-16 words (target: most at 12 or fewer)`);
}

for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`${scenes.length} scenes, ${total} words, ${sentences} sentences, ${learn.length} learn-words: ${learn.map((l) => l.term).join(", ")}`);
process.exit(errors.length ? 1 : 0);
