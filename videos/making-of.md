---
title: How we make the soccer science videos
---

# How we make the soccer science videos

This page explains how the videos on this site were made:

- [Three Spins and a Line](three-spins/): the science of three kicks, 6:13.
- [Why the Best Players Look Slow](why-slow/): football as a game of time, 6:21.

The full source code is in [`videos/source/`](https://github.com/iampat/iampat.github.io/tree/master/videos/source).

## The short version

- Every frame is **drawn by code**, as SVG, with [Remotion](https://www.remotion.dev/) (React and TypeScript). There is no AI video. AI images appear only as two static backdrops in episode 1, a stadium and a sky, made with Nano Banana. Code-drawn SVG goes on top of them.
- The ball moves on a **physics simulation**, not a hand-drawn curve. Tests check the simulation against published numbers.
- The **narration** is Gemini TTS (voice "Charon"). The **music** is Lyria (instrumental). The **sound effects** are made with ffmpeg from sine waves and noise.
- **The audio is the master clock.** Every animation beat is tied to a word in the narration. Word times come from local speech recognition (whisper.cpp) and are then snapped to real pauses in the audio.
- The work is done by **many AI agents in parallel**, with checks between the steps. Researchers find the facts, and fact-checkers try to prove them wrong. Writers write the script, and critics (a 12-year-old, a coach, a scientist) review it. Builders draw the scenes, and fresh-eyes reviewers check every 2 seconds of the result.

## The pipeline

Each step is a separate stage. The output of one step is the input of the next.

1. **Research.** One agent per topic collects claims with sources. A second agent tries to refute each claim. Only the "safe numbers" that survive may be spoken. For example, the check changed "the spin push is 2 to 3 N" to "about 2 N, half the ball's weight". It also changed "a quarter of a second to react" to two measured numbers.
   Output: `source/research/*.json`.
2. **Topic check.** A "veteran coach" agent scores the topic against other ideas (impact, how teachable it is, the science, freshness) and can swap a chapter. In episode 1 this check swapped the chip for the volley, which scores about 1 in 5 goals.
3. **Storyboard.** Two writers each draft the full script from a different angle, one story-first and one metaphor-first. A judge merges the best of both. Then four critics review it: a 12-year-old player, a 16-year-old academy player, a youth coach and a scientist. A final pass applies their fixes.
   Output: `source/script/<episode>/storyboard.json`, which holds every scene's narration, its visual beats, the physics values and the facts used.
4. **Language lint.** `tools/lint-script.mjs` fails the build in these cases:
   - a sentence has more than 16 words;
   - the script uses an "AI-sounding" word (delve, journey, unleash, ...);
   - it uses an undeclared science word;
   - it has fewer than 4 or more than 6 learn-words, or a learn-word has no word card on screen;
   - it states a number with no fact behind it.
5. **Audio.** `tools/tts.mjs` makes one narration request per scene, cached by a hash of the text. `tools/music.mjs` makes one Lyria track per chapter, all in D major so they crossfade. `tools/sfx.sh` makes the sound effects.
6. **Timeline.** `tools/timeline.mjs` measures each clip. It aligns the script words to the whisper words, fixes whisper's drift with the real pauses (silencedetect), and writes `src/timeline.<ep>.json`.
7. **Physics.** `src/physics/sim.ts` handles gravity, drag, the spin push and spin decay (RK4). `shots.ts` and `ep2sims.ts` hold every named flight and touch. `*.test.ts` checks them against the storyboard: for example, the curler bends about 2.5 m over 20 m, and the time bubble reads 0.6 s in the opening and 2.4 s at the end.
8. **Scenes.** Parallel builder agents each own 2–3 scenes and their own registry file, so they never edit the same file. They key every beat with `useCues(id)("exact phrase")`, render stills and look at them before they finish.
9. **QA.** The draft is rendered at half size, and one frame is taken every 2 seconds at exact frame numbers. Fresh-eyes reviewers check four lenses: narration sync, visual polish, physics and coaching accuracy, and a young viewer's attention. Separate fixers apply the findings.
10. **Render and publish.** `tools/render.sh <ep>` runs these steps in order:
    - the lint, the timeline, the type-check and the tests;
    - the 1080p render;
    - a two-pass loudness pass to −14 LUFS with a limiter;
    - the SRT captions and a contact sheet.

    `tools/publish.sh` then makes a web encode under 50 MB and a simple page with captions and a poster, and opens and merges the PR.

## Code map (`videos/source/`)

| Path | What it is |
| --- | --- |
| `src/kit/` | The drawing kit. The world (sky, stands, floodlights, grass), `Player` (Tavi, posable joints), `Keeper` (Chalk), `Ball` (the spin line is a real 3D great circle), `Flight`, `Goal`, `AirFlow` (the "Air Crowd" streams around a spinning ball), `XRay`, `TimeBubble`, `TopPlayer`, `VisionFan`, graphics (labels, word cards, practice boards). |
| `src/kit/ep2/` | Shared parts for episode 2: the two-part stopwatch, the x-ray head, the seconds ruler, the speed-gap meter, the split screen, the chalk sketches. |
| `src/kit/ext/` | Helper parts that one builder made for its own scenes. |
| `src/physics/` | The simulation, the named shots, first-touch physics and the tests. |
| `src/scenes/` | One file per scene (`s01`–`s23` for episode 1, `ep2/b01`–`b22` for episode 2). |
| `src/lib/` | `timing.ts` (word cues), `anim.ts` (easing, pops, idle motion), `project.ts` (3D to screen). |
| `src/Main.tsx`, `src/Root.tsx` | The timeline per episode: scenes, narration, a music bed that dips under the voice. |
| `src/preview/` | Test sheets, the thumbnails (`thumb/`, `thumb/sets/`) and the profile avatars. |
| `tools/` | TTS, music, SFX, timeline, lint, captions, QA frames, render, publish. |
| `docs/` | The kit guide (`KIT.md`), the episode 2 concept and its visual rules. |
| `script/` | The final storyboards. |
| `research/` | The fact-checked research results. |

## How to rebuild the videos

Only source is kept. Code rebuilds every render, thumbnail and avatar.

**What is kept and what is rebuilt**

| Item | How you get it |
| --- | --- |
| `node_modules/` | `npm i` |
| `public/sfx/` | `tools/sfx.sh` (ffmpeg, the same result each run) |
| `public/vo/`, `public/music/`, `public/plates/` | Kept as files. They are not in this repo because of their size (about 260 MB). |
| `out/`: videos, captions, contact sheets | `tools/render.sh <ep>` |
| Thumbnails and avatars | `npx remotion still <id>` |

The narration, music and backdrops come from AI models (Gemini TTS, Lyria and Nano Banana). A new run gives a different result. New narration also changes the timing of every scene. Thus keep these files. Make them again only if you want a new version:

```sh
export GEMINI_API_KEY=...
node tools/tts.mjs --ep ep1     # narration, one clip per scene
node tools/music.mjs            # music for both episodes, one track per chapter
node tools/plates.mjs           # the two episode 1 backdrops
```

**Steps**

1. Install the packages and make the sound effects:
   ```sh
   npm i
   tools/sfx.sh
   ```
2. Render an episode. The script runs the lint, the timeline, the type-check, the tests, the 1080p render, the loudness pass, the captions and the contact sheet:
   ```sh
   tools/render.sh ep1    # out/ep1/kicks_final.mp4, .srt, contact sheet
   tools/render.sh ep2    # out/ep2/...
   ```
3. Render a thumbnail or an avatar as a still:
   ```sh
   npx remotion still ThumbA out/thumb/thumb-a.png          # ThumbA, ThumbB, ThumbC: the first thumbnail ideas
   npx remotion still Set1A out/thumb/publish/set1-a.png    # Set1A to Set4C
   npx remotion still AvatarC out/avatar/avatar-c.png       # AvatarA, AvatarB, AvatarC, AvatarQuick
   ```
   The thumbnail captions are in `src/preview/thumb/sets/sets.json`.
4. Publish:
   ```sh
   # web encode, page, PR, merge
   tools/publish.sh ep2 why-slow "Why the Best Players Look Slow" 44.5 "Why the Best Players Look Slow (video)"
   # one thumbnail set on the Three Spins page
   tools/publish-thumb-set.sh 1 "The bend"
   ```

Check the code at any time with `npx tsc --noEmit` and `npx vitest run`.

## What we learned

**Make it honest.**
- Fact-check before you write. The fact-check corrected numbers in every topic.
- Name the population behind each number ("pro players", "youth players"), and say "went with", not "because", for studies that only show a link.
- Drive the ball with physics, so the picture never lies. Where the real effect is too small to see (a curler's bend from behind the kicker), draw it bigger and say so in the code.

**Write for kids.**
- Use short sentences and plain words, and teach at most 4–6 real terms, each on a word card.
- Titles and descriptions sound like a kid wrote them for other kids.
- Show first, then explain. Put a new picture on screen every 3–5 seconds.

**Timing.**
- Pause tags in the TTS text made the first video run 7:13. Removing the short pauses brought it to about 6:10 with no words cut.
- Whisper's word times drift late and can land past the end of a clip. The fix: whisper gives the order of the words, and the real pauses in the audio give the times.
- Pick video frames at exact frame numbers (`select=not(mod(n,60))`). `fps=1/2` takes frames half an interval late, and that misled one QA pass by about 1 second.

**Working with many agents.**
- Give each agent its own files (one registry per builder) and one shared kit that only the lead edits. Then parallel work never collides.
- Keep reviewers separate from fixers, and give reviewers small slices: about 20 frames each, not all 190.
- Usage limits stopped workflows twice. Resuming a saved run replays the finished agents from cache, so no work was lost. Agents inherit the model that was active when they started, so a model switch means a relaunch.
- Stage publish files in their own folder. A test once overwrote files that builders were still writing.

**Sound.**
- Lyria added vocals once even when told not to. A quick Gemini listen ("any singing?") caught it.
- One loudness pass is not enough for the true peak. Use two-pass loudnorm plus a limiter.

**Publishing.**
- GitHub warns about files over 50 MB and rejects files over 100 MB. The 1080p web copies are about 48 MB.
- On iPhone, "Save to Photos" needs the Web Share API with a file. The first tap downloads the video, and the second tap opens the share sheet, because iOS only opens it right after a tap.

## Costs (approximate)

| Item | Cost |
| --- | --- |
| Narration (Gemini TTS) per episode | about $0.10 |
| Music (Lyria) per episode | $0.25–0.50 |
| Backdrop images (Nano Banana) | less than $2 |
| Rendering | free, on the local machine: about 3 minutes per 1080p episode |

The agent work (research, writing, drawing, review) is most of the effort and the cost.
