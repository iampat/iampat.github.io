// A ball flying along a simulated path, with its trail and optional ghost path.
// The ball moves at real time steps (never eased). Slow motion = `speed` < 1.

import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { simulate, sampleAt, spinAngleAt, type BallState, type KickParams } from "../physics/sim";
import { pathD, project, type View } from "../lib/project";
import { Ball } from "./Ball";
import { PITCH } from "../theme";

export const useFlight = (params: KickParams) => useMemo(() => simulate(params, 30), [JSON.stringify(params)]); // eslint-disable-line react-hooks/exhaustive-deps

type Props = {
  path: BallState[];
  view: View;
  /** Scene frame at which the kick happens. */
  at: number;
  /** Playback speed (1 = real time, 0.25 = slow motion). */
  speed?: number;
  /** Ball radius in pixels. Default: true size from the view scale (at least 10 px). */
  r?: number;
  trail?: boolean;
  trailColor?: string;
  trailOpacity?: number;
  /** Draw the full path faintly (dashed) from the start. */
  ghost?: boolean;
  ghostColor?: string;
  /** Hide the ball before the kick (for example when a player holds it). */
  hideBefore?: boolean;
  /** Stop drawing after this many seconds of flight. */
  maxT?: number;
  lineNormal?: { x: number; y: number; z: number };
  frame?: number;
};

export const Flight: React.FC<Props> = ({
  path,
  view,
  at,
  speed = 1,
  r,
  trail = true,
  trailColor = PITCH.chalk,
  trailOpacity = 0.55,
  ghost = false,
  ghostColor = PITCH.chalk,
  hideBefore = false,
  maxT,
  lineNormal,
  frame: frameOverride,
}) => {
  const current = useCurrentFrame();
  const frame = frameOverride ?? current;
  if (hideBefore && frame < at) return null;
  let f = Math.max(0, (frame - at) * speed);
  if (maxT !== undefined) f = Math.min(f, maxT * 30);
  const s = sampleAt(path, f);
  const p = project(s.pos, view);
  const radius = r ?? Math.max(10, 0.11 * p.scale);
  const upto = Math.min(path.length, Math.floor(f) + 1);
  const trailPts = path
    .slice(0, upto)
    .map((q) => project(q.pos, view))
    .filter((q) => view.kind !== "persp" || q.depth > 0.3);
  if (view.kind !== "persp" || p.depth > 0.3) trailPts.push(p);
  const hidden = view.kind === "persp" && p.depth <= 0.3;
  const spin = s.spin;
  const axis = Math.hypot(spin.x, spin.y, spin.z) > 1e-6 ? spin : { x: 0, y: 0, z: 1 };
  return (
    <g>
      {ghost ? (
        <path d={pathD(path.map((q) => project(q.pos, view)).filter((q) => view.kind !== "persp" || q.depth > 0.3))} fill="none" stroke={ghostColor} strokeWidth={3} strokeDasharray="4 14" strokeLinecap="round" opacity={0.5} />
      ) : null}
      {trail && trailPts.length > 1 ? (
        <path d={pathD(trailPts)} fill="none" stroke={trailColor} strokeWidth={Math.max(3, radius * 0.28)} strokeLinecap="round" strokeLinejoin="round" opacity={trailOpacity} />
      ) : null}
      {hidden ? null : <Ball cx={p.x} cy={p.y} r={radius} view={view} axis={axis} angle={spinAngleAt(path, f)} lineNormal={lineNormal} />}
    </g>
  );
};

/** Where the ball is (in screen space) at a scene frame. Useful for placing labels. */
export const flightPoint = (path: BallState[], view: View, at: number, frame: number, speed = 1) =>
  project(sampleAt(path, Math.max(0, (frame - at) * speed)).pos, view);
