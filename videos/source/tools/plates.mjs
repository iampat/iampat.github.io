#!/usr/bin/env node
// A few static background plates with Nano Banana Pro. Everything on top stays SVG.
// Rules: no people, no ball, no text; palette hex codes in the prompt; flat vector style.
// Usage: node tools/plates.mjs [--only stadium-off,sky] [--edit stadium-on]

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const MODEL = "gemini-3-pro-image";
const STYLE =
  "Flat vector illustration, no outlines, no strokes, rounded shapes, simple geometric forms, soft glows made of flat concentric circles, " +
  "minimal detail, clean and calm, subtle 2-tone shading only. Absolutely no people, no players, no ball, no goal posts, no text, no letters, no numbers, no logos, no signs. ";

const PLATES = {
  "stadium-off":
    STYLE +
    "A wide side-on view of an empty small football stadium at night, seen from pitch level. " +
    "A dark saturated navy night sky, #0E1230 at the top blending to #151A3D near the horizon, with a few small white stars. " +
    "Across the middle, one long low stand in deep indigo #232B5C with four simple lighter rows #2E3874 and a flat roof edge. " +
    "Four tall thin floodlight towers #232B5C standing in front of the stand, each with a rounded rectangular lamp head #2E3874, all lamps switched OFF (dark). " +
    "The bottom quarter of the image is the grass pitch seen side-on: horizontal mowing stripes in #0F5A45 and #177A58 that get wider towards the viewer, with a thin light green edge #1F8E68 at the far side. " +
    "16:9 wide composition, the horizon (bottom of the stand) at about 75% of the image height.",
  sky:
    STYLE +
    "A bright open daytime sky for showing a ball's flight path: a smooth vertical gradient from deep blue #1A4FA3 at the top through #4A93E6 to pale blue #9FD8F5 at the bottom. " +
    "A few big soft rounded flat clouds in #F4FBFF with flat shade shapes in #C7E3F5, mostly near the bottom and edges, leaving the middle clear. " +
    "A soft pale sun glow #FFF4D6 in the top right corner. 16:9 wide composition.",
};

const EDITS = {
  "stadium-on": {
    from: "stadium-off",
    prompt:
      "Edit this image: switch ON all four floodlights. Each lamp head glows warm cream #FFE9B0 with a soft flat glow of 4 concentric low-opacity circles around it, " +
      "and a very faint cone of light towards the pitch. Keep everything else exactly the same: same layout, same colours, same towers, same stand, same sky, same stars, same pitch. " +
      "No people, no ball, no text.",
  },
};

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
const editOnly = args.includes("--edit") ? args[args.indexOf("--edit") + 1].split(",") : null;
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("GEMINI_API_KEY is not set");
mkdirSync("cache/plates", { recursive: true });
mkdirSync("public/plates", { recursive: true });

async function call(parts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9", imageSize: "4K" } },
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) });
    if (res.ok) {
      const json = await res.json();
      const img = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!img) throw new Error(`No image: ${JSON.stringify(json).slice(0, 500)}`);
      return Buffer.from(img.inlineData.data, "base64");
    }
    const err = await res.text();
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 4000 * attempt));
      continue;
    }
    throw new Error(`Image ${res.status}: ${err.slice(0, 600)}`);
  }
  throw new Error("Image generation failed after retries");
}

const hashOf = (s) => createHash("sha1").update(MODEL + s).digest("hex").slice(0, 12);

if (!editOnly) {
  for (const [name, prompt] of Object.entries(PLATES)) {
    if (only && !only.includes(name)) continue;
    const cached = join("cache/plates", `${name}-${hashOf(prompt)}.png`);
    if (!existsSync(cached)) {
      process.stdout.write(`${name} ... `);
      writeFileSync(cached, await call([{ text: prompt }]));
      console.log("done");
    } else console.log(`${name} cached`);
    copyFileSync(cached, join("public/plates", `${name}.png`));
  }
}
for (const [name, e] of Object.entries(EDITS)) {
  if (editOnly && !editOnly.includes(name)) continue;
  if (only && !editOnly) continue;
  const src = join("public/plates", `${e.from}.png`);
  if (!existsSync(src)) continue;
  const srcData = readFileSync(src);
  const cached = join("cache/plates", `${name}-${hashOf(e.prompt + createHash("sha1").update(srcData).digest("hex"))}.png`);
  if (!existsSync(cached)) {
    process.stdout.write(`${name} (edit of ${e.from}) ... `);
    writeFileSync(cached, await call([{ inlineData: { mimeType: "image/png", data: srcData.toString("base64") } }, { text: e.prompt }]));
    console.log("done");
  } else console.log(`${name} cached`);
  copyFileSync(cached, join("public/plates", `${name}.png`));
}
