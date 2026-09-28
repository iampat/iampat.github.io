// b16 side view pieces: Tavi in the open, side-on stance (chest three-quarter to the camera, feet
// apart along the screen, head on the ball), and the chalk station drawn on the grass under her
// boots (the track, a "near" and a "back" platform, and a chimney with puffs on the ball).
//
// The kit Player is drawn in profile only, which reads as fully turned to the goal. This figure uses
// the same colours, limb widths and boot shapes, so it still reads as Tavi.

import React from "react";
import { CAST, FONTS, PITCH } from "../../theme";
import { clamp01 } from "../../lib/anim";
import { PATH_LEN, trim } from "../ep2";

type P = { x: number; y: number };

/** Open stance pose. Distances are in units of the figure height H, angles in degrees. */
export type OpenPose = {
  /** Hip centre x offset from the figure x (weight shift). */
  shift: number;
  /** Hip drop: soft knees. */
  crouch: number;
  /** Near (screen-left, nearer Sam) ankle x from the figure x. */
  nearFoot: number;
  /** Back (screen-right, further from Sam) ankle x from the figure x. */
  backFoot: number;
  /** Back ankle lifted off the grass. */
  backLift: number;
  /** 0..1: the back boot turned out, toes to the goal side (1 = full length). */
  backOpen: number;
  /** Torso lean, positive to screen right. */
  lean: number;
  /** Arms out from the body. */
  armNear: number;
  armBack: number;
};

export const OPEN_READY: OpenPose = { shift: 0, crouch: 0.006, nearFoot: -0.23, backFoot: 0.19, backLift: 0, backOpen: 0.85, lean: 2, armNear: 22, armBack: 26 };
/** The back foot reaches for the ball, the inside of the boot facing it. */
export const OPEN_REACH: OpenPose = { shift: 0.02, crouch: 0.018, nearFoot: -0.23, backFoot: 0.15, backLift: 0.025, backOpen: 1, lean: 4, armNear: 30, armBack: 34 };
/** The foot gives way with the ball. */
export const OPEN_GIVE: OpenPose = { shift: 0.04, crouch: 0.022, nearFoot: -0.23, backFoot: 0.19, backLift: 0.018, backOpen: 1, lean: 6, armNear: 26, armBack: 31 };
/** Weight over the ball, ready to play forward. */
export const OPEN_SET: OpenPose = { shift: 0.06, crouch: 0.01, nearFoot: -0.23, backFoot: 0.24, backLift: 0, backOpen: 0.9, lean: 5, armNear: 22, armBack: 28 };

const KEYS: (keyof OpenPose)[] = ["shift", "crouch", "nearFoot", "backFoot", "backLift", "backOpen", "lean", "armNear", "armBack"];

export const mixOpen = (a: OpenPose, b: OpenPose, t: number): OpenPose => {
  const out = { ...a };
  for (const k of KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
};

/** Pose at a frame from [frame, pose] keys, smoothstep between keys. */
export const openAt = (frame: number, track: [number, OpenPose][]): OpenPose => {
  if (frame <= track[0][0]) return track[0][1];
  for (let i = 1; i < track.length; i++) {
    if (frame <= track[i][0]) {
      const [f0, p0] = track[i - 1];
      const [f1, p1] = track[i];
      const u = clamp01((frame - f0) / Math.max(1, f1 - f0));
      return mixOpen(p0, p1, u * u * (3 - 2 * u));
    }
  }
  return track[track.length - 1][1];
};

const rot = (p: P, deg: number): P => {
  const a = (deg * Math.PI) / 180;
  return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) };
};
const add = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y });

/** Two-bone leg: `side` 1 bends the knee to screen right, -1 to screen left (knees track out over the feet). */
const leg = (hip: P, ankle: P, a: number, b: number, side: number) => {
  const dx = ankle.x - hip.x;
  const dy = ankle.y - hip.y;
  const d0 = Math.hypot(dx, dy) || 1;
  const u = { x: dx / d0, y: dy / d0 };
  const d = Math.min(d0, (a + b) * 0.999);
  const l = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - l * l));
  const n = { x: u.y * side, y: -u.x * side };
  return { knee: { x: hip.x + u.x * l + n.x * h, y: hip.y + u.y * l + n.y * h }, ankle: { x: hip.x + u.x * d, y: hip.y + u.y * d } };
};

/** Joint positions (world pixels) for an open pose with the figure at x, feet on groundY. */
export const solveOpen = (p: OpenPose, x: number, groundY: number, H: number) => {
  const thigh = 0.245 * H;
  const shin = 0.235 * H;
  const heelR = 0.047 * H;
  const toeR = 0.03 * H;
  const hipC = { x: x + p.shift * H, y: groundY - heelR - (0.452 - p.crouch) * H };
  const nearHip = { x: hipC.x - 0.055 * H, y: hipC.y };
  const backHip = { x: hipC.x + 0.055 * H, y: hipC.y };
  const nearLeg = leg(nearHip, { x: x + p.nearFoot * H, y: groundY - heelR }, thigh, shin, -1);
  const backLeg = leg(backHip, { x: x + p.backFoot * H, y: groundY - heelR - p.backLift * H }, thigh, shin, 1);
  // Near boot points at the camera (short); the back boot turns out to the goal side (long).
  const nearToe = { x: nearLeg.ankle.x + 0.07 * H, y: groundY - toeR * 0.8 };
  const backLen = (0.08 + 0.05 * p.backOpen) * H;
  const backToe = { x: backLeg.ankle.x + backLen, y: groundY - toeR - p.backLift * H * 0.7 };
  const top = add(hipC, rot({ x: 0, y: -0.33 * H }, p.lean));
  const nearSh = add(top, rot({ x: -0.092 * H, y: 0.025 * H }, p.lean));
  const backSh = add(top, rot({ x: 0.092 * H, y: 0.025 * H }, p.lean));
  const armDir = (deg: number, side: number) => ({ x: side * Math.sin((deg * Math.PI) / 180), y: Math.cos((deg * Math.PI) / 180) });
  const ne = add(nearSh, { x: armDir(p.armNear, -1).x * 0.165 * H, y: armDir(p.armNear, -1).y * 0.165 * H });
  const nh = add(ne, { x: armDir(p.armNear * 0.35, -1).x * 0.13 * H, y: armDir(p.armNear * 0.35, -1).y * 0.13 * H });
  const be = add(backSh, { x: armDir(p.armBack, 1).x * 0.165 * H, y: armDir(p.armBack, 1).y * 0.165 * H });
  const bh = add(be, { x: armDir(p.armBack * 0.35, 1).x * 0.13 * H, y: armDir(p.armBack * 0.35, 1).y * 0.13 * H });
  const neck = add(top, rot({ x: 0, y: -0.03 * H }, p.lean));
  const head = add(neck, rot({ x: 0, y: -0.1 * H }, p.lean));
  const lace = (a: P, t: P) => ({ x: a.x + (t.x - a.x) * 0.45, y: a.y + (t.y - a.y) * 0.45 - 0.012 * H });
  return {
    hipC,
    nearHip,
    backHip,
    nearKnee: nearLeg.knee,
    nearAnkle: nearLeg.ankle,
    nearToe,
    nearLaces: lace(nearLeg.ankle, nearToe),
    backKnee: backLeg.knee,
    backAnkle: backLeg.ankle,
    backToe,
    backLaces: lace(backLeg.ankle, backToe),
    top,
    nearSh,
    backSh,
    ne,
    nh,
    be,
    bh,
    head,
    headR: 0.095 * H,
  };
};

export type OpenJoints = ReturnType<typeof solveOpen>;

/**
 * Tavi side-on, chest three-quarter to the camera. `lookT` turns the head: 0 = face on the ball to
 * the left (Sam's side), 1 = face to the right (where she is going).
 */
export const OpenTavi: React.FC<{ x: number; groundY: number; h: number; pose: OpenPose; lookT?: number; face?: "focus" | "happy" }> = ({ x, groundY, h: H, pose, lookT = 0, face = "focus" }) => {
  const j = solveOpen(pose, x, groundY, H);
  const legW = 0.085 * H;
  const limbW = 0.075 * H;
  const line = (pts: P[], color: string, w: number, key: string) => (
    <polyline key={key} points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  );
  const boot = (ankle: P, toe: P, color: string, sole: string, key: string) => {
    const dx = toe.x - ankle.x;
    const dy = toe.y - ankle.y;
    const L = Math.hypot(dx, dy) || 1;
    const d = { x: dx / L, y: dy / L };
    const n = { x: -d.y, y: d.x };
    const rh = 0.047 * H;
    const rt = 0.03 * H;
    const heel = { x: ankle.x - d.x * 0.015 * H, y: ankle.y - d.y * 0.015 * H };
    const pts = [
      { x: heel.x - n.x * rh, y: heel.y - n.y * rh },
      { x: toe.x - n.x * rt, y: toe.y - n.y * rt },
      { x: toe.x + n.x * rt, y: toe.y + n.y * rt },
      { x: heel.x + n.x * rh, y: heel.y + n.y * rh },
    ];
    return (
      <g key={key}>
        <polygon points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill={color} />
        <circle cx={heel.x} cy={heel.y} r={rh} fill={color} />
        <circle cx={toe.x} cy={toe.y} r={rt} fill={color} />
        <line x1={heel.x + n.x * rh * 0.92} y1={heel.y + n.y * rh * 0.92} x2={toe.x + n.x * rt * 0.9} y2={toe.y + n.y * rt * 0.9} stroke={sole} strokeWidth={0.018 * H} strokeLinecap="round" />
      </g>
    );
  };
  const part = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  // Head turn: the face flips side past halfway, hidden by a quick squash (as the kit Player does).
  const lt = clamp01(lookT);
  const dir = lt < 0.5 ? -1 : 1;
  const squash = 1 - 0.32 * Math.sin(lt * Math.PI);
  const r = j.headR;
  const ex = r * 0.5 * dir;
  const ey = -r * 0.05;
  const ex2 = r * 0.02 * dir;
  const mx = r * 0.42 * dir;
  const my = r * 0.42;

  return (
    <g>
      {/* Back side (further from the camera): darker shades. */}
      {line([j.backSh, j.be, j.bh], CAST.skinShade, limbW, "backArm")}
      {line([j.backSh, part(j.backSh, j.be, 0.45)], CAST.shirtShade, limbW * 1.25, "backSleeve")}
      {line([j.backHip, j.backKnee], CAST.skinShade, legW, "backThigh")}
      {line([j.backKnee, j.backAnkle], CAST.sockShade, legW * 0.95, "backShin")}
      {boot(j.backAnkle, j.backToe, CAST.boot, CAST.bootShade, "backBoot")}
      {/* Near leg. */}
      {line([j.nearHip, j.nearKnee], CAST.skin, legW, "nearThigh")}
      {line([j.nearKnee, j.nearAnkle], CAST.sock, legW * 0.95, "nearShin")}
      {boot(j.nearAnkle, j.nearToe, CAST.boot, CAST.bootShade, "nearBoot")}
      {/* Torso: wider than the profile capsule, the shade on the side turned away. */}
      <g transform={`translate(${j.hipC.x} ${j.hipC.y}) rotate(${pose.lean})`}>
        <rect x={-0.118 * H} y={-0.36 * H} width={0.236 * H} height={0.36 * H} rx={0.09 * H} fill={CAST.shirt} />
        <rect x={0.035 * H} y={-0.34 * H} width={0.07 * H} height={0.3 * H} rx={0.035 * H} fill={CAST.shirtShade} opacity={0.6} />
        <rect x={-0.118 * H} y={-0.25 * H} width={0.236 * H} height={0.035 * H} fill={CAST.band} />
        <rect x={-0.132 * H} y={-0.065 * H} width={0.264 * H} height={0.165 * H} rx={0.055 * H} fill={CAST.shorts} />
      </g>
      {/* Head. */}
      <g transform={`translate(${j.head.x} ${j.head.y}) scale(${squash} 1)`}>
        <circle r={r} fill={CAST.skin} />
        <g fill={CAST.hair}>
          <circle cx={-r * 0.45 * dir} cy={-r * 0.62} r={r * 0.5} />
          <circle cx={r * 0.12 * dir} cy={-r * 0.82} r={r * 0.45} />
          <circle cx={-r * 0.85 * dir} cy={-r * 0.12} r={r * 0.38} />
          <circle cx={r * 0.55 * dir} cy={-r * 0.62} r={r * 0.3} />
        </g>
        <ellipse cx={ex} cy={ey} rx={r * 0.075} ry={face === "focus" ? r * 0.06 : r * 0.11} fill={CAST.keeperEye} />
        <ellipse cx={ex2} cy={ey} rx={r * 0.06} ry={face === "focus" ? r * 0.05 : r * 0.095} fill={CAST.keeperEye} />
        {face === "focus" ? <path d={`M${ex - r * 0.14},${ey - r * 0.2} L${ex + r * 0.12},${ey - r * 0.14}`} stroke={CAST.hair} strokeWidth={r * 0.07} strokeLinecap="round" /> : null}
        {face === "happy" ? (
          <path d={`M${mx - r * 0.14 * dir},${my - r * 0.04} Q${mx},${my + r * 0.14} ${mx + r * 0.1 * dir},${my - r * 0.06}`} fill="none" stroke="#5A1F2E" strokeWidth={r * 0.08} strokeLinecap="round" />
        ) : (
          <path d={`M${mx - r * 0.1 * dir},${my} L${mx + r * 0.08 * dir},${my}`} stroke="#5A1F2E" strokeWidth={r * 0.07} strokeLinecap="round" />
        )}
      </g>
      {/* Near arm. */}
      {line([j.nearSh, j.ne, j.nh], CAST.skin, limbW, "nearArm")}
      {line([j.nearSh, part(j.nearSh, j.ne, 0.45)], CAST.shirt, limbW * 1.25, "nearSleeve")}
    </g>
  );
};

// ---------- The chalk station on the grass ----------

const CHALK = PITCH.chalk;

/**
 * The train-through-a-station picture drawn on the real pitch, in world pixels: a chalk track along
 * the grass line, then a platform under each boot with its name. `p` 0..1 draws it on.
 */
export const ChalkStation: React.FC<{
  x0: number;
  x1: number;
  groundY: number;
  near: number;
  back: number;
  ppm: number;
  p: number;
  opacity?: number;
}> = ({ x0, x1, groundY, near, back, ppm, p, opacity = 1 }) => {
  if (p <= 0.001 || opacity <= 0.001) return null;
  const track = clamp01(p / 0.45);
  const platN = clamp01((p - 0.3) / 0.3);
  const platB = clamp01((p - 0.55) / 0.3);
  const ty = groundY + 0.07 * ppm;
  const tieN = Math.floor((x1 - x0) / (0.26 * ppm));
  const w = 0.028 * ppm;
  const plat = (cx: number, t: number, text: string) => {
    const pw = 0.58 * ppm;
    const top = groundY + 0.16 * ppm;
    const ph = 0.3 * ppm;
    const d = `M${cx - pw / 2},${top} L${cx + pw / 2},${top} L${cx + pw / 2 - 0.05 * ppm},${top + ph} L${cx - pw / 2 + 0.05 * ppm},${top + ph} Z`;
    return (
      <g>
        <path d={d} fill={CHALK} fillOpacity={0.1 * t} stroke={CHALK} strokeWidth={w} strokeLinejoin="round" {...trim(t)} />
        <text x={cx} y={top + ph * 0.72} fill={CHALK} opacity={clamp01(t * 2 - 1)} fontFamily={FONTS.label} fontWeight={800} fontSize={0.18 * ppm} textAnchor="middle">
          {text}
        </text>
      </g>
    );
  };
  return (
    <g opacity={opacity * 0.92}>
      <path d={`M${x0},${ty} L${x1},${ty}`} stroke={CHALK} strokeWidth={w} strokeLinecap="round" pathLength={PATH_LEN} strokeDasharray={`${PATH_LEN} ${PATH_LEN}`} strokeDashoffset={PATH_LEN * (1 - track)} />
      {Array.from({ length: tieN }, (_, i) => {
        const tx = x0 + (i + 0.5) * 0.26 * ppm;
        const on = clamp01(track * tieN - i);
        return on > 0 ? <line key={i} x1={tx} y1={ty - 0.035 * ppm} x2={tx} y2={ty + 0.045 * ppm} stroke={CHALK} strokeWidth={w * 0.7} strokeLinecap="round" opacity={0.6 * on} /> : null;
      })}
      {plat(near, platN, "near")}
      {plat(back, platB, "back")}
    </g>
  );
};

/** A chalk chimney on the ball (it does not roll with the ball) and puffs that drift back and up. */
export const TrainChimney: React.FC<{ cx: number; cy: number; r: number; frame: number; opacity: number; moving: number }> = ({ cx, cy, r, frame, opacity, moving }) => {
  if (opacity <= 0.001) return null;
  const w = r * 0.2;
  const sx = cx + r * 0.15;
  const top = cy - r * 2.3;
  // A steam-train funnel: narrow at the ball, flared at the top, with a rim.
  const funnel = `M${sx - r * 0.24},${cy - r * 0.9} L${sx - r * 0.26},${top + r * 0.55} L${sx - r * 0.55},${top} L${sx + r * 0.55},${top} L${sx + r * 0.26},${top + r * 0.55} L${sx + r * 0.24},${cy - r * 0.93}`;
  return (
    <g opacity={opacity}>
      <path d={funnel} fill={CHALK} fillOpacity={0.22} stroke={CHALK} strokeWidth={w} strokeLinejoin="round" strokeLinecap="round" />
      <line x1={sx - r * 0.66} y1={top} x2={sx + r * 0.66} y2={top} stroke={CHALK} strokeWidth={w * 1.1} strokeLinecap="round" />
      {[0, 1, 2, 3].map((k) => {
        const ph = (frame / 16 + k / 4) % 1;
        const px = sx - r * (0.3 + ph * 3.2);
        const py = top - r * (0.55 + ph * 2.1);
        const pr = r * (0.38 + ph * 0.6);
        return <circle key={k} cx={px} cy={py} r={pr} fill={CHALK} fillOpacity={0.35} stroke={CHALK} strokeWidth={w * 0.7} opacity={moving * (1 - ph) * 0.95} />;
      })}
    </g>
  );
};
