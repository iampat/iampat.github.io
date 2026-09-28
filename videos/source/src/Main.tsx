// The whole video for one episode: scenes in order, each with its narration clip, plus the
// music bed. Audio is the master clock: scene lengths come from src/timeline.<ep>.json.

import React from "react";
import { AbsoluteFill, Sequence, Series, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { EPISODES, TIMELINE, type EpisodeId, type SceneTiming, type Timeline } from "./lib/timing";
import { SCENES } from "./scenes";
import { Placeholder } from "./scenes/Placeholder";

const FPS = 30;

/** Music track for each scene, by chapter name. Practice boards share one loop. */
const MUSIC: Record<EpisodeId, (s: SceneTiming) => string> = {
  ep1: (s) => {
    const c = s.chapter.toLowerCase();
    if (c.includes("practice") || c.includes("drill")) return "practice";
    if (c.includes("cold open") || c.includes("title")) return "open";
    if (c.includes("drive")) return "drive";
    if (c.includes("curler")) return "curler";
    if (c.includes("volley") || c.includes("chip")) return "volley";
    return "ending";
  },
  ep2: (s) => {
    const c = s.chapter.toLowerCase();
    if (c.includes("practice") || c.includes("drill")) return "practice";
    if (c.includes("cold open") || c.includes("title")) return "open";
    if (c.includes("look")) return "look";
    if (c.includes("touch")) return "touch";
    if (c.includes("shape")) return "shape";
    if (c.includes("steal") || c.includes("feint") || c.includes("bonus")) return "steal";
    return "ending";
  },
};

type Segment = { track: string; from: number; frames: number };

const segments = (t: Timeline, trackFor: (s: SceneTiming) => string): Segment[] => {
  const out: Segment[] = [];
  for (const s of t.scenes) {
    const track = trackFor(s);
    const last = out[out.length - 1];
    if (last && last.track === track) last.frames += s.frames;
    else out.push({ track, from: s.startFrame, frames: s.frames });
  }
  return out;
};

/** Is the narrator speaking at this global frame? Returns 0..1 with soft ramps. */
const speechFn = (t: Timeline) => {
  const intervals: [number, number][] = [];
  for (const s of t.scenes) {
    for (const x of s.sentences) {
      intervals.push([s.startFrame + s.leadFrames + x.start * FPS, s.startFrame + s.leadFrames + x.end * FPS]);
    }
  }
  const RAMP = 10;
  return (f: number) => {
    let best = 0;
    for (const [a, b] of intervals) {
      if (f >= a && f <= b) return 1;
      const d = f < a ? a - f : f - b;
      if (d < RAMP) best = Math.max(best, 1 - d / RAMP);
    }
    return best;
  };
};

const XFADE = 30; // music crossfade between chapters, frames

const MusicBed: React.FC<{ episode: EpisodeId }> = ({ episode }) => {
  const t = EPISODES[episode];
  const speech = React.useMemo(() => speechFn(t), [t]);
  return (
    <>
      {segments(t, MUSIC[episode]).map((seg, i) => {
        const from = Math.max(0, seg.from - (i > 0 ? XFADE / 2 : 0));
        const frames = seg.frames + (i > 0 ? XFADE / 2 : 0) + XFADE / 2;
        return (
          <Sequence key={`${seg.track}-${i}`} from={from} durationInFrames={frames} layout="none">
            <Audio
              src={staticFile(`music/${seg.track}.wav`)}
              loop
              volume={(f) => {
                const fadeIn = Math.min(1, f / XFADE);
                const fadeOut = Math.min(1, (frames - f) / XFADE);
                const duck = 1 - 0.55 * speech(from + f);
                return 0.55 * duck * fadeIn * fadeOut;
              }}
            />
          </Sequence>
        );
      })}
    </>
  );
};

export const Main: React.FC<{ episode: EpisodeId }> = ({ episode }) => {
  const t = EPISODES[episode];
  return (
    <AbsoluteFill style={{ backgroundColor: "#0E1230" }}>
      <Series>
        {t.scenes.map((s) => {
          const Scene = SCENES[s.id];
          return (
            <Series.Sequence key={s.id} durationInFrames={s.frames} premountFor={30}>
              {Scene ? <Scene /> : <Placeholder id={s.id} />}
              <Sequence from={s.leadFrames} layout="none">
                <Audio src={staticFile(s.file)} />
              </Sequence>
            </Series.Sequence>
          );
        })}
      </Series>
      <MusicBed episode={episode} />
    </AbsoluteFill>
  );
};

/** One scene alone, with its narration, for previews and chapter reviews. */
export const SingleScene: React.FC<{ id: string }> = ({ id }) => {
  const s = TIMELINE.scenes.find((x) => x.id === id)!;
  const Scene = SCENES[id];
  return (
    <AbsoluteFill style={{ backgroundColor: "#0E1230" }}>
      {Scene ? <Scene /> : <Placeholder id={id} />}
      <Sequence from={s.leadFrames} layout="none">
        <Audio src={staticFile(s.file)} />
      </Sequence>
    </AbsoluteFill>
  );
};
