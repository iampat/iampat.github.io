// Close-up of the boot meeting the ball (s22 "dead centre" replay, s23 contact flash).
// Tavi is drawn very large so only the legs show. The ball sits on the turf line; the
// body is lowered a little so the laces meet the ball's centre, and a front grass band
// hides the boots below the turf line.

import React from "react";
import { useCurrentFrame } from "remotion";
import { CAST, HEIGHT, PITCH, WIDTH } from "../../theme";
import { EASE, pop, progress } from "../../lib/anim";
import { Player, POSES, mixPose, type Pose } from "../Player";
import { Ball } from "../Ball";
import { Label } from "../Graphics";
import { Glow } from "../World";
import { sampleAt, spinAngleAt, type BallState } from "../../physics/sim";
import { breathe, taviJoints } from "./s21-s23-bits";

const STAB: Pose = { ...POSES.strike, nearAnkle: 150 };

export const StrikeCloseUp: React.FC<{
  swingAt: number;
  contactAt: number;
  releaseAt: number;
  flight: BallState[];
  follow?: number;
  dotAt?: number;
  label?: string;
  dark?: number;
  lineNormal?: { x: number; y: number; z: number };
  ballX?: number;
  push?: number;
  /** Playback speed of the ball after contact (slow motion < 1). */
  speed?: number;
  /** When the label pops in (default: just after the dot) and its text size. */
  labelAt?: number;
  labelSize?: number;
}> = ({ swingAt, contactAt, releaseAt, flight, follow = 0.3, dotAt, label, dark = 0, lineNormal, ballX = 760, push = 0, speed = 1, labelAt, labelSize = 44 }) => {
  const frame = useCurrentFrame();
  const H = 1300;
  const G = 880;
  const ppm = H / 1.62;
  const r = 0.11 * ppm;
  // Where the laces are at contact, to line the body up with the ball's back and centre.
  const jc = taviJoints(STAB, 0, G, H);
  const hipX = ballX - r - jc.laces.x + 4;
  const dig = G - jc.laces.y - r;
  let pose: Pose;
  if (frame < swingAt) pose = breathe(POSES.plant, frame, 3, 0.3);
  else if (frame < releaseAt) pose = mixPose(POSES.plant, STAB, progress(frame, swingAt, contactAt - swingAt, EASE.soft));
  else pose = mixPose(STAB, mixPose(STAB, POSES.follow, follow), progress(frame, releaseAt, 8 / speed, EASE.enter));
  // The leg follows through at the same slow-motion rate as the ball, so it never overtakes it.
  const hx = hipX + (frame >= releaseAt ? 0.05 * H * progress(frame, releaseAt, 10 / speed, EASE.enter) : 0);
  const fl = Math.max(0, frame - releaseAt) * speed;
  const s = sampleAt(flight, fl);
  const inFlight = frame >= releaseAt;
  const bx = inFlight ? ballX + s.pos.x * ppm : ballX;
  const by = inFlight ? G - s.pos.z * ppm : G - r;
  const squash = frame >= contactAt && frame < releaseAt ? 0.88 : 1;
  const spin = s.spin;
  const dot = dotAt === undefined ? 0 : pop(frame, dotAt);
  const ring = dotAt === undefined ? 0 : progress(frame, dotAt, 16, EASE.enter);
  const zoom = 1 + push;
  return (
    <g transform={`translate(${ballX} ${G - r}) scale(${zoom}) translate(${-ballX} ${-(G - r)})`}>
      {/* Far background: night sky and the dark base of the stand. */}
      <rect x={-WIDTH} y={-HEIGHT} width={WIDTH * 3} height={HEIGHT * 3} fill={PITCH.sky} />
      <rect x={-WIDTH} y={G - 330} width={WIDTH * 3} height={240} fill={PITCH.stands} />
      <rect x={-WIDTH} y={G - 300} width={WIDTH * 3} height={26} rx={13} fill={PITCH.standsLight} opacity={0.6} />
      <rect x={-WIDTH} y={G - 230} width={WIDTH * 3} height={26} rx={13} fill={PITCH.standsLight} opacity={0.6} />
      <rect x={-WIDTH} y={G - 90} width={WIDTH * 3} height={HEIGHT} fill={PITCH.grassDark} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M${-600 + i * 700},${G - 90} L${-250 + i * 700},${G - 90} L${-50 + i * 700},${HEIGHT + 300} L${-500 + i * 700},${HEIGHT + 300} Z`} fill={PITCH.grass} />
      ))}
      <Glow cx={ballX} cy={G - r} r={420} color={PITCH.lightSoft} intensity={0.55} rings={4} />
      <Player x={hx} groundY={G + dig} h={H} pose={pose} face="focus" />
      {/* Front turf band hides the boots below the turf line. */}
      <rect x={-WIDTH} y={G - 2} width={WIDTH * 3} height={HEIGHT} fill={PITCH.grassDark} />
      <rect x={-WIDTH} y={G - 6} width={WIDTH * 3} height={10} rx={5} fill={PITCH.grassLight} />
      {/* Lights out: everything but the ball dims (the ball keeps its orange in every palette). */}
      {dark > 0.001 ? <rect x={-WIDTH} y={-HEIGHT} width={WIDTH * 3} height={HEIGHT * 3} fill={PITCH.skyHigh} opacity={dark} /> : null}
      {!inFlight || bx < WIDTH + 200 ? (
        <Ball cx={bx} cy={by} r={r} view={{ kind: "side", originX: 0, groundY: 0, ppm: 1 }} axis={spin} angle={spinAngleAt(flight, fl)} lineNormal={lineNormal} squash={squash} />
      ) : null}
      {dot > 0.001 && !inFlight ? (
        <g>
          <circle cx={ballX} cy={G - r} r={r * (0.3 + 0.9 * ring)} fill="none" stroke={CAST.fix} strokeWidth={6} opacity={1 - ring} />
          <circle cx={ballX} cy={G - r} r={15 * dot} fill={CAST.fix} />
          <circle cx={ballX} cy={G - r} r={6 * dot} fill={PITCH.sky} />
        </g>
      ) : null}
      {label && dotAt !== undefined && dot > 0.001 ? (
        <g opacity={1 - progress(frame, releaseAt - 3, 6, EASE.exit)}>
          <line x1={ballX + 18} y1={G - r} x2={ballX + r + 110} y2={G - r} stroke={PITCH.chalk} strokeWidth={6} strokeDasharray="2 12" strokeLinecap="round" opacity={progress(frame, (labelAt ?? dotAt + 3) - 2, 8)} />
        </g>
      ) : null}
      {label && dotAt !== undefined ? <Label x={ballX + r + 120} y={G - r} text={label} at={labelAt ?? dotAt + 3} until={releaseAt - 3} size={labelSize} anchor="start" /> : null}
    </g>
  );
};
