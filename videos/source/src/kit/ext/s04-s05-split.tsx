// Shared layout for the s04 -> s05 join and new parts for the final script.
// - The split-screen opening of s05 (SplitOpen): s04 ends on exactly this picture, so the cut is invisible.
// - DashedKicker: a dashed ghost player (the club player aged 12 in s04).
// - TownCar: a tiny town car on a lane along the bottom of the frame (s04).
// - CardFootIcon: a foot seen from above on the "instep" word card, with a cross over the inside (s05).
// - PitchEnd: the side-on night pitch that s05 pulls back to before s06.

import React from "react";
import { random } from "remotion";
import { EASE, idle, pop, progress } from "../../lib/anim";
import { POSES, Player, solve, type Pose } from "../Player";
import { XRayGrid, XRayLeg } from "../XRay";
import { Ball } from "../Ball";
import { Floodlight, Glow, GroundSide, Sky, Stands, Stars } from "../World";
import { CAST, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import { HammerLeg, footFrame, type P } from "./s04-s05-parts";

// ---------- s05 split layout (one source for s04's last frames and s05) ----------

/** Leg owner's height in pixels: a close-up of the shin and foot. */
export const LH = 1500;
export const PPM5 = LH / 1.62;
export const BALL_R5 = 0.11 * PPM5;
/** Hip in each half's own coordinates (off the top of the frame). */
export const HIP5: P = { x: 360, y: -40 };
export const LINE_N = { x: 0.92, y: 0.25, z: 0.3 };
/** Leg held back, and laces contact (toes down, shin upright). */
export const BACKP5: Pose = { ...POSES.strike, nearHip: 10, nearKnee: 40, nearAnkle: 150 };
export const CONTACT5: Pose = { ...POSES.strike, nearHip: 20, nearKnee: 30, nearAnkle: 150 };
/** Middle of the laces and the toe end, along the foot (0 = ankle, 1 = toe). */
export const LACES_S = 0.45;
export const TOE_S = 0.9;

/** Ball resting on the middle of the laces of the contact pose (half coordinates). */
export const BALL5: P = (() => {
  const ff = footFrame(CONTACT5, LH, HIP5.x, HIP5.y);
  const c = ff.at(LACES_S);
  return { x: c.x + ff.n.x * (BALL_R5 + ff.t), y: c.y + ff.n.y * (BALL_R5 + ff.t) };
})();

/** Loose-ankle dangle (degrees) for s05 frame f. */
export const dangleAt = (f: number) => idle(f, 0.3, 1.6, 6);
/** Right ankle angle before "toes down" (s05 frame f). */
export const rightAnkleAt = (f: number) => 118 + idle(f, 2, 2.2, 2);

/** Slow drifting specks in screen space, keyed to a given frame. */
export const MotesAt: React.FC<{ frame: number; count?: number; seed?: string; opacity?: number }> = ({
  frame,
  count = 36,
  seed = "motes",
  opacity = 1,
}) => (
  <g opacity={opacity}>
    {Array.from({ length: count }, (_, i) => {
      const sx = random(`${seed}-x-${i}`) * WIDTH;
      const sy = random(`${seed}-y-${i}`) * HEIGHT;
      const sp = 0.15 + random(`${seed}-s-${i}`) * 0.35;
      const x = (((sx + frame * sp * 0.6) % WIDTH) + WIDTH) % WIDTH;
      const y = (((sy - frame * sp) % HEIGHT) + HEIGHT * 4) % HEIGHT;
      const r = 1.5 + random(`${seed}-r-${i}`) * 2.5;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(frame / 40 + i));
      return <circle key={i} cx={x} cy={y} r={r} fill={XRAY.bone} opacity={0.12 * tw} />;
    })}
  </g>
);

/**
 * The s05 opening picture at s05 frame f (f < 0 is the end of s04): two x-ray lower legs held back,
 * a ball on each, a faint pink wash on the left and the chalk divider.
 * draw: 0..1 how far the divider has drawn down. rightIn: 0..1 the right leg slides in.
 */
export const SplitOpen: React.FC<{ f: number; draw?: number; rightIn?: number; opacity?: number }> = ({
  f,
  draw = 1,
  rightIn = 1,
  opacity = 1,
}) => {
  if (opacity <= 0.001) return null;
  const D = WIDTH / 2;
  const poseL: Pose = { ...BACKP5, nearAnkle: 150 + dangleAt(f) };
  const poseR: Pose = { ...BACKP5, nearAnkle: rightAnkleAt(f) };
  const slide = (1 - rightIn) * 420;
  return (
    <g opacity={opacity}>
      <XRayGrid />
      <rect x={0} y={0} width={D} height={HEIGHT} fill={XRAY.pink} opacity={0.035} />
      <defs>
        <clipPath id="s0405-split-left">
          <rect x={0} y={0} width={D} height={HEIGHT} />
        </clipPath>
        <clipPath id="s0405-split-right">
          <rect x={D} y={0} width={WIDTH - D} height={HEIGHT} />
        </clipPath>
      </defs>
      <g clipPath="url(#s0405-split-left)">
        <HammerLeg x={HIP5.x} y={HIP5.y} h={LH} pose={poseL} morph={0} hinge={0} />
        <Ball cx={BALL5.x} cy={BALL5.y} r={BALL_R5} view={{ kind: "side", originX: 0, groundY: 0, ppm: PPM5 }} lineNormal={LINE_N} />
      </g>
      {rightIn > 0.001 ? (
        <g clipPath="url(#s0405-split-right)" opacity={Math.min(1, rightIn * 1.6)}>
          <g transform={`translate(${D + slide} 0)`}>
            <XRayLeg x={HIP5.x} y={HIP5.y} h={LH} pose={poseR} highlight={[]} />
            <Ball cx={BALL5.x} cy={BALL5.y} r={BALL_R5} view={{ kind: "side", originX: 0, groundY: 0, ppm: PPM5 }} lineNormal={LINE_N} />
          </g>
        </g>
      ) : null}
      {draw > 0.001 ? (
        <line x1={D} y1={0} x2={D} y2={HEIGHT * draw} stroke={PITCH.chalk} strokeWidth={8} strokeLinecap="round" />
      ) : null}
      <MotesAt frame={f} seed="s05" />
    </g>
  );
};

// ---------- s04: the dashed ghost player and the town car ----------

/**
 * A dashed ghost player: a dark silhouette with a dashed outline, side view, facing right.
 * Same joint solver as Tavi. The hip is fixed at (x, hipY), so a planted standing foot stays planted.
 */
export const DashedKicker: React.FC<{
  x: number;
  hipY: number;
  h: number;
  pose: Pose;
  opacity?: number;
  color?: string;
  dash?: number;
}> = ({ x, hipY, h, pose, opacity = 1, color = XRAY.bone, dash = 0 }) => {
  if (opacity <= 0.001) return null;
  const j = solve(pose, h);
  const dy = hipY;
  const T = (p: P) => ({ x: x + p.x, y: p.y + dy });
  const pts = (a: P[]) => a.map((p) => `${T(p).x.toFixed(1)},${T(p).y.toFixed(1)}`).join(" ");
  const legW = 0.085 * h;
  const limbW = 0.07 * h;
  const torsoW = 0.16 * h;
  const edge = 0.014 * h;
  const limbs: { p: P[]; w: number }[] = [
    { p: [j.hip, j.fk, j.fa], w: legW },
    { p: [j.fa, j.fToe], w: legW * 0.8 },
    { p: [j.sh, j.fe, j.fh], w: limbW },
    { p: [j.hip, j.sh], w: torsoW },
    { p: [j.hip, j.nk, j.na], w: legW },
    { p: [j.na, j.nToe], w: legW * 0.8 },
    { p: [j.sh, j.ne, j.nh], w: limbW },
  ];
  const head = T(j.headC);
  const dashA = 0.03 * h;
  const dashB = 0.022 * h;
  return (
    <g opacity={opacity}>
      {/* Outline pass: thin dashed lines just outside each limb (sides and round ends). */}
      <g fill="none" stroke={color} strokeWidth={edge * 1.6} strokeLinecap="round" strokeDasharray={`${dashA} ${dashB}`} strokeDashoffset={-dash}>
        {limbs.map((l, i) => {
          const r = l.w / 2 + edge * 0.8;
          const P2 = l.p.map(T);
          const parts: React.ReactNode[] = [];
          for (let k = 0; k + 1 < P2.length; k++) {
            const a = P2[k];
            const b = P2[k + 1];
            const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            const n = { x: -(b.y - a.y) / L, y: (b.x - a.x) / L };
            for (const sd of [1, -1])
              parts.push(<line key={`${k}${sd}`} x1={a.x + n.x * r * sd} y1={a.y + n.y * r * sd} x2={b.x + n.x * r * sd} y2={b.y + n.y * r * sd} />);
          }
          P2.forEach((p, k) => parts.push(<circle key={`c${k}`} cx={p.x} cy={p.y} r={r} />));
          return <g key={i}>{parts}</g>;
        })}
        <circle cx={head.x} cy={head.y} r={j.headR + edge * 0.8} />
      </g>
      {/* Fill pass: covers the inner edges so only the outer outline shows. */}
      <g fill="none" stroke="#0A2A35" strokeLinecap="round" strokeLinejoin="round">
        {limbs.map((l, i) => (
          <polyline key={i} points={pts(l.p)} strokeWidth={l.w} />
        ))}
      </g>
      <circle cx={head.x} cy={head.y} r={j.headR} fill="#0A2A35" />
      {/* The kicking leg's bones, faint, so the swing reads. */}
      <polyline points={pts([j.hip, j.nk, j.na, j.nToe])} fill="none" stroke={color} strokeWidth={0.02 * h} strokeLinecap="round" strokeLinejoin="round" opacity={0.45} />
    </g>
  );
};

/** A tiny flat town car, facing right. x = front bumper, y = road line. roll = distance rolled (px). */
export const TownCar: React.FC<{ x: number; y: number; size?: number; roll: number; opacity?: number }> = ({
  x,
  y,
  size = 150,
  roll,
  opacity = 1,
}) => {
  if (opacity <= 0.001) return null;
  const L = size;
  const bodyH = L * 0.26;
  const wr = L * 0.1;
  const spin = (roll / wr) * (180 / Math.PI);
  return (
    <g transform={`translate(${x - L} ${y})`} opacity={opacity}>
      <Glow cx={L + 6} cy={-wr - bodyH * 0.45} r={L * 0.28} color={PITCH.lightSoft} intensity={0.9} rings={4} />
      {/* Cabin and body. */}
      <path
        d={`M${L * 0.22},${-wr - bodyH * 0.9} L${L * 0.34},${-wr - bodyH * 1.75} Q${L * 0.36},${-wr - bodyH * 1.85} ${L * 0.42},${-wr - bodyH * 1.85} L${L * 0.64},${-wr - bodyH * 1.85} Q${L * 0.7},${-wr - bodyH * 1.85} ${L * 0.74},${-wr - bodyH * 1.7} L${L * 0.84},${-wr - bodyH * 0.9} Z`}
        fill={XRAY.air}
      />
      <path
        d={`M${L * 0.3},${-wr - bodyH * 0.95} L${L * 0.38},${-wr - bodyH * 1.6} L${L * 0.51},${-wr - bodyH * 1.6} L${L * 0.51},${-wr - bodyH * 0.95} Z`}
        fill={XRAY.bg}
        opacity={0.85}
      />
      <path
        d={`M${L * 0.55},${-wr - bodyH * 0.95} L${L * 0.55},${-wr - bodyH * 1.6} L${L * 0.66},${-wr - bodyH * 1.6} L${L * 0.76},${-wr - bodyH * 0.95} Z`}
        fill={XRAY.bg}
        opacity={0.85}
      />
      <rect x={0} y={-wr - bodyH} width={L} height={bodyH} rx={bodyH * 0.45} fill={XRAY.air} />
      <rect x={L * 0.06} y={-wr - bodyH * 0.72} width={L * 0.88} height={bodyH * 0.14} rx={bodyH * 0.07} fill="#FFFFFF" opacity={0.3} />
      {/* Lights. */}
      <rect x={L - L * 0.07} y={-wr - bodyH * 0.8} width={L * 0.07} height={bodyH * 0.3} rx={bodyH * 0.12} fill={PITCH.lightSoft} />
      <rect x={0} y={-wr - bodyH * 0.8} width={L * 0.05} height={bodyH * 0.28} rx={bodyH * 0.1} fill={XRAY.pink} />
      {/* Wheels. */}
      {[0.22, 0.78].map((u, i) => (
        <g key={i} transform={`translate(${L * u} ${-wr}) rotate(${spin})`}>
          <circle r={wr} fill={XRAY.bg} />
          <circle r={wr * 0.45} fill={XRAY.bone} />
          <rect x={-wr * 0.1} y={-wr * 0.9} width={wr * 0.2} height={wr * 0.5} rx={wr * 0.1} fill={XRAY.bone} />
        </g>
      ))}
    </g>
  );
};

// ---------- s05: foot icon on the "instep" word card ----------

/**
 * Draws on top of the kit WordCard (same size and pop), at the card's right end: a foot seen from above,
 * laces zone in lime, and a pink cross that flashes over the inside edge ("not the inside").
 * Pass the same term, meaning, at, until, x and y as the WordCard.
 */
export const CardFootIcon: React.FC<{
  frame: number;
  term: string;
  meaning: string;
  at: number;
  until: number;
  x?: number;
  y?: number;
  crossAt: number;
}> = ({ frame, term, meaning, at, until, x = WIDTH - 60, y = 90, crossAt }) => {
  const s = pop(frame, at) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const w = Math.max(term.length * 36, meaning.length * 19, 260) + 90;
  // Foot pointing right: heel on the left, toes on the right. The inside (big-toe side) of a right foot is on top.
  const cx = w - 180;
  const cy = 90;
  const L = 290;
  const W = 96;
  const x0 = cx - L / 2;
  const q = L / 250;
  const X = (v: number) => (x0 + v * q).toFixed(1);
  const foot = `M${X(30)},${cy - W * 0.36}
    C${X(70)},${cy - W * 0.44} ${X(120)},${cy - W * 0.3} ${X(160)},${cy - W * 0.44}
    C${X(205)},${cy - W * 0.6} ${X(250)},${cy - W * 0.5} ${X(250)},${cy - W * 0.05}
    C${X(250)},${cy + W * 0.4} ${X(200)},${cy + W * 0.52} ${X(150)},${cy + W * 0.5}
    C${X(100)},${cy + W * 0.48} ${X(60)},${cy + W * 0.46} ${X(30)},${cy + W * 0.36}
    C${X(4)},${cy + W * 0.28} ${X(4)},${cy - W * 0.28} ${X(30)},${cy - W * 0.36} Z`;
  const inside = `M${X(70)},${cy - W * 0.44} C${X(110)},${cy - W * 0.34} ${X(140)},${cy - W * 0.38} ${X(175)},${cy - W * 0.5} C${X(200)},${cy - W * 0.56} ${X(215)},${cy - W * 0.56} ${X(228)},${cy - W * 0.5}`;
  const laceIn = progress(frame, at + 4, 10, EASE.enter);
  const crossK = frame < crossAt ? 0 : progress(frame, crossAt, 6, EASE.enter);
  // Three flashes, then the cross stays.
  const blink = frame - crossAt;
  const flash = blink < 0 ? 0 : blink < 24 ? (Math.floor(blink / 4) % 2 === 0 ? 1 : 0.3) : 1;
  const crossX = x0 + L * 0.6;
  const crossY = cy - W * 0.47;
  const cr = 24 * (0.6 + 0.4 * crossK);
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) translate(${-w} 0)`}>
      <path d={foot} fill={PITCH.sky} />
      {/* Inside edge (top) in pink. */}
      <path
        d={inside}
        fill="none"
        stroke={CAST.mistake}
        strokeWidth={12}
        strokeLinecap="round"
        opacity={0.35 + 0.65 * crossK}
      />
      {/* Laces zone in lime, down the middle of the top of the foot. */}
      <g opacity={laceIn}>
        <rect x={x0 + 78 * q} y={cy - 15} width={112 * q} height={30} rx={15} fill={XRAY.lime} />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={x0 + (96 + i * 25) * q} y1={cy - 9} x2={x0 + (96 + i * 25) * q} y2={cy + 9} stroke={PITCH.sky} strokeWidth={5} strokeLinecap="round" />
        ))}
      </g>
      {/* The cross over the inside. */}
      {crossK > 0.001 ? (
        <g transform={`translate(${crossX} ${crossY})`} opacity={crossK * flash}>
          <circle r={cr + 8} fill={PITCH.chalk} />
          <line x1={-cr} y1={-cr} x2={cr} y2={cr} stroke={CAST.mistake} strokeWidth={10} strokeLinecap="round" />
          <line x1={-cr} y1={cr} x2={cr} y2={-cr} stroke={CAST.mistake} strokeWidth={10} strokeLinecap="round" />
        </g>
      ) : null}
    </g>
  );
};

// ---------- s05: the side-on night pitch at the end ----------

/** Pitch world for the end of s05: metres from the ball, like the s06 opening. */
export const PITCH_END = {
  PPM: 50,
  OX: 700,
  GROUND: 820,
  TAVI_M: -1.3,
  CAM: { x: 700 - 1.0 * 50, y: 820 - 0.72 * 50, zoom: 5.3 },
};

/**
 * The side-on night pitch with Tavi and a ball, laid out like the first frame of s06 (sky, stars,
 * stands, floodlights, grass). It is drawn at camera `cam`, then scaled by `k` about screen point `from`
 * onto `to` (for the pull-back out of the boot). The far background scales less (depth).
 */
export const PitchEnd: React.FC<{
  cam: { x: number; y: number; zoom: number };
  k: number;
  from: P;
  to: P;
  pose: Pose;
  opacity?: number;
}> = ({ cam, k, from, to, pose, opacity = 1 }) => {
  if (opacity <= 0.001) return null;
  const { PPM, OX, GROUND, TAVI_M } = PITCH_END;
  const X = (m: number) => OX + m * PPM;
  const H = 1.62 * PPM;
  const Z = cam.zoom;
  const horizonY = HEIGHT / 2 + (GROUND - cam.y) * Z;
  const bgScale = 1 + (Z - 1) * 0.05;
  const kBg = 1 + (k - 1) * 0.15;
  const outer = (kk: number) => `translate(${to.x} ${to.y}) scale(${kk}) translate(${-from.x} ${-from.y})`;
  const worldT = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${Z}) translate(${-cam.x} ${-cam.y})`;
  const ballR = 0.11 * PPM;
  return (
    <g opacity={opacity}>
      <rect x={-WIDTH} y={-HEIGHT} width={WIDTH * 3} height={HEIGHT * 3} fill={PITCH.sky} />
      <g transform={outer(kBg)}>
        <Sky id="s05-end-sky" />
        <Stars count={90} maxY={Math.max(140, horizonY - 330)} seed="s06" />
        <g transform={`translate(${WIDTH / 2} ${horizonY}) scale(${bgScale}) translate(${-WIDTH / 2 - (cam.x - X(6)) * 0.04} ${-GROUND})`}>
          <Stands baseY={GROUND} lit={1} />
          {[180, 720, 1220, 1760].map((x, i) => (
            <Floodlight key={i} x={x} baseY={GROUND - 20} height={470} on={1} />
          ))}
        </g>
      </g>
      <g transform={outer(k)}>
        <g transform={worldT}>
          <GroundSide groundY={GROUND} vanishX={X(8)} />
          <Player x={X(TAVI_M)} groundY={GROUND} h={H} pose={pose} face="neutral" />
          <Ball cx={X(0)} cy={GROUND - ballR} r={ballR} view={{ kind: "side", originX: X(0), groundY: GROUND, ppm: PPM }} lineNormal={LINE_N} />
        </g>
      </g>
    </g>
  );
};

/** Screen point of Tavi's near ankle in the pitch world at camera `cam`. */
export const pitchAnkle = (pose: Pose, cam: { x: number; y: number; zoom: number }): P => {
  const { PPM, OX, GROUND, TAVI_M } = PITCH_END;
  const H = 1.62 * PPM;
  const j = solve(pose, H);
  const dy = GROUND - j.lowest - (pose.lift ?? 0) * H;
  const a = { x: OX + TAVI_M * PPM + j.na.x, y: j.na.y + dy };
  return { x: WIDTH / 2 + (a.x - cam.x) * cam.zoom, y: HEIGHT / 2 + (a.y - cam.y) * cam.zoom };
};
