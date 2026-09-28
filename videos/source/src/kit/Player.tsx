// Tavi: the player (the viewer's stand-in, a right-footed 14-year-old).
// Side view, facing right. The viewer stands on Tavi's right, so the kicking
// (right) leg is the near leg, drawn in front.
// Built from rounded primitives: thick round-capped limbs, a capsule torso, a round head.
// Poses are joint angles; `blendPoses` eases between them.

import React from "react";
import { CAST } from "../theme";

/** Angles in degrees. Limb angles: 0 = straight down, positive = forward (towards +x). */
export type Pose = {
  torso: number; // lean forward
  head: number; // tilt forward
  nearHip: number;
  nearKnee: number; // bend: shin rotates back by this much
  nearAnkle: number; // foot angle to shin: 90 = flat foot, 160 = toes pointed down
  farHip: number;
  farKnee: number;
  farAnkle: number;
  nearShoulder: number;
  nearElbow: number; // bend: forearm rotates forward by this much
  farShoulder: number;
  farElbow: number;
  /** Lift the whole body (pixels at H = 1). */
  lift?: number;
};

export const POSES = {
  stand: { torso: 2, head: 0, nearHip: 3, nearKnee: 4, nearAnkle: 90, farHip: -3, farKnee: 4, farAnkle: 90, nearShoulder: -6, nearElbow: 12, farShoulder: 6, farElbow: 12 },
  ready: { torso: 10, head: 4, nearHip: -18, nearKnee: 28, nearAnkle: 100, farHip: 22, farKnee: 14, farAnkle: 90, nearShoulder: 25, nearElbow: 40, farShoulder: -25, farElbow: 40 },
  walk1: { torso: 4, head: 2, nearHip: 20, nearKnee: 12, nearAnkle: 95, farHip: -16, farKnee: 10, farAnkle: 100, nearShoulder: -18, nearElbow: 20, farShoulder: 18, farElbow: 20 },
  walk2: { torso: 4, head: 2, nearHip: -16, nearKnee: 10, nearAnkle: 100, farHip: 20, farKnee: 12, farAnkle: 95, nearShoulder: 18, nearElbow: 20, farShoulder: -18, farElbow: 20 },
  /** Holding the ball out in front, about to drop it. */
  hold: { torso: 3, head: 8, nearHip: 3, nearKnee: 4, nearAnkle: 90, farHip: -3, farKnee: 4, farAnkle: 90, nearShoulder: 70, nearElbow: 20, farShoulder: 65, farElbow: 25 },
  run1: { torso: 14, head: 4, nearHip: 38, nearKnee: 60, nearAnkle: 100, farHip: -25, farKnee: 20, farAnkle: 110, nearShoulder: -35, nearElbow: 70, farShoulder: 35, farElbow: 70 },
  run2: { torso: 14, head: 4, nearHip: -25, nearKnee: 20, nearAnkle: 110, farHip: 38, farKnee: 60, farAnkle: 100, nearShoulder: 35, nearElbow: 70, farShoulder: -35, farElbow: 70 },
  /** Plant foot beside the ball, kicking leg cocked back, far arm out wide. */
  plant: { torso: 8, head: 6, nearHip: -38, nearKnee: 100, nearAnkle: 150, farHip: 6, farKnee: 22, farAnkle: 92, nearShoulder: -30, nearElbow: 25, farShoulder: 75, farElbow: 20 },
  /** Laces contact: knee and chest over the ball, toes down, ankle locked. */
  strike: { torso: 16, head: 10, nearHip: 8, nearKnee: 18, nearAnkle: 160, farHip: 10, farKnee: 26, farAnkle: 92, nearShoulder: -20, nearElbow: 20, farShoulder: 65, farElbow: 20 },
  follow: { torso: 8, head: 4, nearHip: 62, nearKnee: 12, nearAnkle: 150, farHip: -4, farKnee: 14, farAnkle: 95, nearShoulder: -10, nearElbow: 25, farShoulder: 40, farElbow: 20, lift: 0.02 },
  /** Leaning back at contact: the classic "over the bar" mistake. */
  leanBack: { torso: -14, head: -8, nearHip: 30, nearKnee: 25, nearAnkle: 120, farHip: -8, farKnee: 18, farAnkle: 92, nearShoulder: -35, nearElbow: 20, farShoulder: 55, farElbow: 20 },
  /** Inside-foot contact: toes up, ankle locked (foot turned out; see footTurn). */
  inside: { torso: 6, head: 8, nearHip: 10, nearKnee: 14, nearAnkle: 88, farHip: 8, farKnee: 24, farAnkle: 92, nearShoulder: -25, nearElbow: 20, farShoulder: 60, farElbow: 20 },
  /** Volley contact: thigh raised, knee over the ball, toes down. */
  volley: { torso: 20, head: 12, nearHip: 48, nearKnee: 52, nearAnkle: 158, farHip: 4, farKnee: 16, farAnkle: 92, nearShoulder: -30, nearElbow: 25, farShoulder: 80, farElbow: 15 },
  /** Chip stab: foot under the ball, chest behind, short. */
  chip: { torso: -4, head: 4, nearHip: 22, nearKnee: 34, nearAnkle: 118, farHip: 6, farKnee: 24, farAnkle: 92, nearShoulder: -25, nearElbow: 20, farShoulder: 55, farElbow: 20 },
  celebrate: { torso: -4, head: -10, nearHip: 8, nearKnee: 10, nearAnkle: 100, farHip: -12, farKnee: 30, farAnkle: 110, nearShoulder: 160, nearElbow: 10, farShoulder: 170, farElbow: 10, lift: 0.06 },
  shout: { torso: -8, head: -18, nearHip: 4, nearKnee: 6, nearAnkle: 90, farHip: -4, farKnee: 6, farAnkle: 90, nearShoulder: 40, nearElbow: 60, farShoulder: 50, farElbow: 60 },
  /** Kneeling on the left knee to draw the line around the ball. */
  crouch: { torso: 30, head: 28, nearHip: 72, nearKnee: 78, nearAnkle: 96, farHip: -4, farKnee: 92, farAnkle: 165, nearShoulder: 62, nearElbow: 18, farShoulder: 25, farElbow: 70 },
  shrug: { torso: 0, head: 6, nearHip: 3, nearKnee: 4, nearAnkle: 90, farHip: -3, farKnee: 4, farAnkle: 90, nearShoulder: 25, nearElbow: 95, farShoulder: 30, farElbow: 95 },
  /** Waiting for a pass: knees soft, on the toes, arms loose. */
  receiveReady: { torso: 8, head: 4, nearHip: 10, nearKnee: 22, nearAnkle: 96, farHip: -6, farKnee: 16, farAnkle: 100, nearShoulder: -14, nearElbow: 60, farShoulder: 14, farElbow: 60 },
  /** Soft first touch: the near foot reaches for the ball, toe a little up, and gives way. */
  receiveSoft: { torso: 10, head: 8, nearHip: 26, nearKnee: 18, nearAnkle: 84, farHip: -8, farKnee: 18, farAnkle: 100, nearShoulder: -20, nearElbow: 55, farShoulder: 22, farElbow: 50 },
  /** Stiff, straight leg: the ball bounces off the shin. */
  receiveStiff: { torso: -4, head: 2, nearHip: 16, nearKnee: 2, nearAnkle: 90, farHip: -6, farKnee: 6, farAnkle: 96, nearShoulder: -10, nearElbow: 20, farShoulder: 12, farElbow: 20 },
  /** Looking back over the shoulder while waiting (use with headTurn). */
  lookBack: { torso: 4, head: -6, nearHip: 8, nearKnee: 16, nearAnkle: 96, farHip: -6, farKnee: 14, farAnkle: 100, nearShoulder: -12, nearElbow: 50, farShoulder: 12, farElbow: 50 },
  /** Passing with the inside of the foot. */
  passInside: { torso: 6, head: 8, nearHip: 22, nearKnee: 10, nearAnkle: 86, farHip: 4, farKnee: 20, farAnkle: 92, nearShoulder: -20, nearElbow: 25, farShoulder: 35, farElbow: 25 },
} satisfies Record<string, Pose>;

export type PoseName = keyof typeof POSES;

/** Smooth walk (or run) cycle: a pose that swings between the two stride poses. */
export const cyclePose = (frame: number, kind: "walk" | "run" = "walk", strideFrames = 14): Pose => {
  const a = kind === "walk" ? POSES.walk1 : POSES.run1;
  const b = kind === "walk" ? POSES.walk2 : POSES.run2;
  const t = 0.5 + 0.5 * Math.sin((frame / strideFrames) * Math.PI);
  const p = mixPose(a, b, t);
  // Small bob at each step.
  return { ...p, lift: (p.lift ?? 0) + Math.abs(Math.cos((frame / strideFrames) * Math.PI)) * (kind === "walk" ? 0.012 : 0.03) };
};

const KEYS: (keyof Pose)[] = [
  "torso", "head", "nearHip", "nearKnee", "nearAnkle", "farHip", "farKnee", "farAnkle",
  "nearShoulder", "nearElbow", "farShoulder", "farElbow", "lift",
];

export const mixPose = (a: Pose, b: Pose, t: number): Pose => {
  const out = {} as Pose;
  for (const k of KEYS) (out as Record<string, number>)[k] = ((a[k] ?? 0) as number) + (((b[k] ?? 0) as number) - ((a[k] ?? 0) as number)) * t;
  return out;
};

/**
 * Pose at a frame from a list of [frame, pose, holdEase?] keys.
 * Between keys: eased blend (smoothstep), so limbs never snap.
 */
export const poseAt = (frame: number, track: [number, Pose | PoseName][]): Pose => {
  const get = (p: Pose | PoseName) => (typeof p === "string" ? POSES[p] : p);
  if (frame <= track[0][0]) return get(track[0][1]);
  for (let i = 1; i < track.length; i++) {
    if (frame <= track[i][0]) {
      const [f0, p0] = track[i - 1];
      const [f1, p1] = track[i];
      const t = (frame - f0) / Math.max(1, f1 - f0);
      const s = t * t * (3 - 2 * t);
      return mixPose(get(p0), get(p1), s);
    }
  }
  return get(track[track.length - 1][1]);
};

export type Face = "neutral" | "happy" | "shout" | "focus" | "wince" | "smug";

type Props = {
  /** Screen x of the hips, and screen y of the ground. */
  x: number;
  groundY: number;
  /** Pixel height of the character standing. */
  h: number;
  pose: Pose;
  face?: Face;
  /** 0..1: foot turned out (inside-foot kicks) shortens the drawn foot. */
  footTurn?: number;
  /** Mirror to face left. */
  flip?: boolean;
  /** X-ray: draw as a see-through silhouette. */
  ghost?: boolean;
  opacity?: number;
  /** Returns joint positions (for placing the ball at the boot, and so on). */
  onJoints?: (j: Joints) => void;
  /** 0..1: the head turns to look back over the shoulder (face shows on the far side). */
  headTurn?: number;
  /** Colour overrides, for example for the teammate Sam. */
  colors?: Partial<{ shirt: string; shirtShade: string; shorts: string; skin: string; skinShade: string; hair: string; sock: string; sockShade: string; band: string }>;
};

/** Sam, Tavi's friend: orange shirt, lighter skin, brown hair, no band. */
export const SAM_COLORS = { shirt: "#FF7A3D", shirtShade: "#D95A22", shorts: "#232B5C", skin: "#E8B48B", skinShade: "#C4906A", hair: "#7A3B1F", sock: "#FF7A3D", sockShade: "#D95A22", band: "#FF7A3D" };

export type Joints = {
  hip: { x: number; y: number };
  nearKnee: { x: number; y: number };
  nearAnkle: { x: number; y: number };
  nearToe: { x: number; y: number };
  /** Middle of the laces on the near boot. */
  nearLaces: { x: number; y: number };
  farAnkle: { x: number; y: number };
  farToe: { x: number; y: number };
  head: { x: number; y: number };
};

const rad = (d: number) => (d * Math.PI) / 180;
/** Point at distance len from p, at limb angle a (0 = down, positive = forward/right). */
const limb = (p: { x: number; y: number }, a: number, len: number) => ({
  x: p.x + Math.sin(rad(a)) * len,
  y: p.y + Math.cos(rad(a)) * len,
});

/** Compute joint positions for a pose, with the hip at (0,0) in units of H. */
export const solve = (pose: Pose, H: number, footTurn = 0) => {
  const hip = { x: 0, y: 0 };
  const thigh = 0.245 * H;
  const shin = 0.235 * H;
  const foot = 0.13 * H * (1 - 0.55 * footTurn);
  const nk = limb(hip, pose.nearHip, thigh);
  const na = limb(nk, pose.nearHip - pose.nearKnee, shin);
  // Foot direction = shin direction + (180 - ankle): ankle 90 is a flat foot, 160 points the toes down.
  const nToe = limb(na, pose.nearHip - pose.nearKnee + (180 - pose.nearAnkle), foot);
  const fk = limb(hip, pose.farHip, thigh);
  const fa = limb(fk, pose.farHip - pose.farKnee, shin);
  const fToe = limb(fa, pose.farHip - pose.farKnee + (180 - pose.farAnkle), foot);
  const torsoLen = 0.33 * H;
  // Lean forward moves the shoulder towards +x.
  const sh = { x: hip.x + Math.sin(rad(pose.torso)) * torsoLen, y: hip.y - Math.cos(rad(pose.torso)) * torsoLen };
  const neck = { x: sh.x + Math.sin(rad(pose.torso)) * 0.03 * H, y: sh.y - Math.cos(rad(pose.torso)) * 0.03 * H };
  const headR = 0.095 * H;
  const headC = {
    x: neck.x + Math.sin(rad(pose.torso + pose.head)) * headR * 1.05,
    y: neck.y - Math.cos(rad(pose.torso + pose.head)) * headR * 1.05,
  };
  const upper = 0.165 * H;
  const fore = 0.155 * H;
  const ne = limb(sh, pose.nearShoulder, upper);
  const nh = limb(ne, pose.nearShoulder + pose.nearElbow, fore);
  const fe = limb(sh, pose.farShoulder, upper);
  const fh = limb(fe, pose.farShoulder + pose.farElbow, fore);
  // Lowest point sets the ground: heels are the ankles, toes are the toe points.
  const lowest = Math.max(na.y, nToe.y, fa.y, fToe.y) + 0.03 * H;
  return { hip, nk, na, nToe, fk, fa, fToe, sh, neck, headC, headR, ne, nh, fe, fh, lowest };
};

export const Player: React.FC<Props> = ({
  x,
  groundY,
  h: H,
  pose,
  face = "neutral",
  footTurn = 0,
  flip = false,
  ghost = false,
  opacity = 1,
  onJoints,
  headTurn = 0,
  colors,
}) => {
  const j = solve(pose, H, footTurn);
  const dy = groundY - j.lowest - (pose.lift ?? 0) * H;
  const T = (p: { x: number; y: number }) => ({ x: x + (flip ? -p.x : p.x), y: p.y + dy });
  if (onJoints) {
    const lacesT = 0.45;
    onJoints({
      hip: T(j.hip),
      nearKnee: T(j.nk),
      nearAnkle: T(j.na),
      nearToe: T(j.nToe),
      nearLaces: T({ x: j.na.x + (j.nToe.x - j.na.x) * lacesT, y: j.na.y + (j.nToe.y - j.na.y) * lacesT }),
      farAnkle: T(j.fa),
      farToe: T(j.fToe),
      head: T(j.headC),
    });
  }

  const limbW = 0.075 * H;
  const legW = 0.085 * H;
  const line = (pts: { x: number; y: number }[], color: string, w: number, key: string) => (
    <polyline
      key={key}
      points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
      fill="none"
      stroke={color}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
  /** Boot: a rounded heel tapering to the toe, with a darker sole. Built in unflipped space, then mapped. */
  const boot = (ankle: { x: number; y: number }, toe: { x: number; y: number }, color: string, sole: string, key: string) => {
    const dx = toe.x - ankle.x;
    const dy2 = toe.y - ankle.y;
    const L = Math.hypot(dx, dy2) || 1;
    const d = { x: dx / L, y: dy2 / L };
    const n = { x: -d.y, y: d.x }; // points to the sole side for a forward foot
    const rh = 0.047 * H;
    const rt = 0.03 * H;
    const heel = { x: ankle.x - d.x * 0.015 * H, y: ankle.y - d.y * 0.015 * H };
    const pts = [
      { x: heel.x - n.x * rh, y: heel.y - n.y * rh },
      { x: toe.x - n.x * rt, y: toe.y - n.y * rt },
      { x: toe.x + n.x * rt, y: toe.y + n.y * rt },
      { x: heel.x + n.x * rh, y: heel.y + n.y * rh },
    ].map(T);
    const h2 = T(heel);
    const t2 = T(toe);
    const s1 = T({ x: heel.x + n.x * rh * 0.92, y: heel.y + n.y * rh * 0.92 });
    const s2 = T({ x: toe.x + n.x * rt * 0.9, y: toe.y + n.y * rt * 0.9 });
    return (
      <g key={key}>
        <polygon points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill={color} />
        <circle cx={h2.x} cy={h2.y} r={rh} fill={color} />
        <circle cx={t2.x} cy={t2.y} r={rt} fill={color} />
        <line x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y} stroke={sole} strokeWidth={0.018 * H} strokeLinecap="round" />
      </g>
    );
  };

  const C = { ...CAST, ...(colors ?? {}) };
  const skin = ghost ? "#2A7F8F" : C.skin;
  const skinShade = ghost ? "#236B78" : C.skinShade;
  const shirt = ghost ? "#2A7F8F" : C.shirt;
  const shirtShade = ghost ? "#236B78" : C.shirtShade;
  const shorts = ghost ? "#236B78" : C.shorts;
  const sock = ghost ? "#2A7F8F" : C.sock;
  const sockShade = ghost ? "#236B78" : C.sockShade;
  const hairC = ghost ? "#236B78" : C.hair;
  const bandC = C.band;
  // A head turn past halfway shows the face on the other side (looking back over the shoulder).
  const eyeDir = (flip ? -1 : 1) * (headTurn > 0.5 ? -1 : 1);
  const turnSquash = 1 - 0.35 * Math.sin(Math.min(1, Math.max(0, headTurn)) * Math.PI);
  const bootC = ghost ? "#2A7F8F" : CAST.boot;
  const bootShade = ghost ? "#236B78" : CAST.bootShade;

  const hip = T(j.hip);
  const sh = T(j.sh);
  const head = T(j.headC);
  const torsoAngle = (flip ? -1 : 1) * pose.torso;

  return (
    <g opacity={ghost ? 0.55 * opacity : opacity}>
      {/* Far side: darker shades. */}
      {line([sh, T(j.fe), T(j.fh)], skinShade, limbW, "farArm")}
      {line([hip, T(j.fk)], shorts, legW * 1.15, "farThigh")}
      {line([T(j.fk), T(j.fa)], sockShade, legW * 0.95, "farShin")}
      {boot(j.fa, j.fToe, bootShade, ghost ? "#236B78" : "#A9A294", "farBoot")}
      {/* Torso (capsule) and shorts. */}
      <g transform={`translate(${hip.x} ${hip.y}) rotate(${torsoAngle})`}>
        <rect x={-0.095 * H} y={-0.36 * H} width={0.19 * H} height={0.36 * H} rx={0.08 * H} fill={shirt} />
        <rect x={0.01 * H} y={-0.34 * H} width={0.07 * H} height={0.3 * H} rx={0.035 * H} fill={shirtShade} opacity={0.6} />
        {!ghost && bandC !== shirt ? <rect x={-0.095 * H} y={-0.25 * H} width={0.19 * H} height={0.035 * H} fill={bandC} /> : null}
        <rect x={-0.1 * H} y={-0.06 * H} width={0.2 * H} height={0.12 * H} rx={0.05 * H} fill={shorts} />
      </g>
      {/* Head. */}
      <g transform={`translate(${head.x} ${head.y}) scale(${turnSquash} 1)`}>
        <circle r={j.headR} fill={skin} />
        <g fill={hairC}>
          <circle cx={-j.headR * 0.45 * eyeDir} cy={-j.headR * 0.62} r={j.headR * 0.5} />
          <circle cx={j.headR * 0.12 * eyeDir} cy={-j.headR * 0.82} r={j.headR * 0.45} />
          <circle cx={-j.headR * 0.85 * eyeDir} cy={-j.headR * 0.12} r={j.headR * 0.38} />
          <circle cx={j.headR * 0.55 * eyeDir} cy={-j.headR * 0.62} r={j.headR * 0.3} />
        </g>
        {!ghost ? <FaceParts face={face} r={j.headR} dir={eyeDir} /> : null}
      </g>
      {/* Near side (kicking leg, right arm). */}
      {line([hip, T(j.nk)], shorts, legW * 1.15, "nearThighTop")}
      {line([T(j.nk), T(j.na)], sock, legW * 0.95, "nearShin")}
      {line([hip, T(j.nk)], skin, legW, "nearThigh")}
      {line([hip, T({ x: j.hip.x + (j.nk.x - j.hip.x) * 0.35, y: j.hip.y + (j.nk.y - j.hip.y) * 0.35 })], shorts, legW * 1.2, "nearShorts")}
      {boot(j.na, j.nToe, bootC, bootShade, "nearBoot")}
      {line([sh, T(j.ne), T(j.nh)], skin, limbW, "nearArm")}
      {line([sh, T({ x: j.sh.x + (j.ne.x - j.sh.x) * 0.45, y: j.sh.y + (j.ne.y - j.sh.y) * 0.45 })], shirt, limbW * 1.25, "nearSleeve")}
    </g>
  );
};

const FaceParts: React.FC<{ face: Face; r: number; dir: number }> = ({ face, r, dir }) => {
  const ex = r * 0.52 * dir;
  const ey = -r * 0.05;
  const eye = face === "wince" ? (
    <path d={`M${ex - r * 0.1},${ey} L${ex + r * 0.1},${ey}`} stroke={CAST.keeperEye} strokeWidth={r * 0.1} strokeLinecap="round" />
  ) : (
    <ellipse cx={ex} cy={ey} rx={r * 0.075} ry={face === "focus" ? r * 0.06 : r * 0.11} fill={CAST.keeperEye} />
  );
  const mx = r * 0.62 * dir;
  const my = r * 0.42;
  const mouth =
    face === "shout" ? (
      <ellipse cx={mx} cy={my} rx={r * 0.12} ry={r * 0.16} fill="#5A1F2E" />
    ) : face === "happy" ? (
      <path d={`M${mx - r * 0.14 * dir},${my - r * 0.04} Q${mx},${my + r * 0.14} ${mx + r * 0.1 * dir},${my - r * 0.06}`} fill="none" stroke="#5A1F2E" strokeWidth={r * 0.08} strokeLinecap="round" />
    ) : face === "smug" ? (
      <path d={`M${mx - r * 0.12 * dir},${my} L${mx + r * 0.1 * dir},${my - r * 0.06}`} stroke="#5A1F2E" strokeWidth={r * 0.08} strokeLinecap="round" />
    ) : (
      <path d={`M${mx - r * 0.1 * dir},${my} L${mx + r * 0.08 * dir},${my}`} stroke="#5A1F2E" strokeWidth={r * 0.07} strokeLinecap="round" />
    );
  const brow =
    face === "focus" || face === "shout" ? (
      <path d={`M${ex - r * 0.14},${ey - r * 0.2} L${ex + r * 0.12},${ey - r * 0.14}`} stroke={CAST.hair} strokeWidth={r * 0.07} strokeLinecap="round" />
    ) : null;
  return (
    <g>
      {eye}
      {brow}
      {mouth}
    </g>
  );
};
