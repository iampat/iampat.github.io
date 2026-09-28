// Thumbnail set 2 ("The spin line"), slot A, for "Three Spins and a Line" (1280x720).
// ONE HUGE BALL: an extreme side-on close-up of the orange ball in mid-flight just inside
// the box. Its white Line turns about the real VOLLEY spin axis (forward spin, clockwise when
// the ball flies right), with faint copies of the Line behind it and two lime spin arrows (the
// spin-ring colour from s02). Football cues: the box edge and the penalty arc in perspective,
// and the ball's shadow on the grass. Night pitch, flat vector style, no blur filters.
import React from "react";
import { AbsoluteFill, random } from "remotion";
import { Ball, linePoint } from "../../../kit/Ball";
import { Glow } from "../../../kit/World";
import type { Vec3 } from "../../../physics/sim";
import type { View } from "../../../lib/project";
import { FONTS, PITCH, XRAY } from "../../../theme";

const W = 1280;
const H = 720;

// Side view: x to the right, z up, the viewer on the kicker's right (toward = -y).
const SIDE: View = { kind: "side", originX: 0, groundY: 0, ppm: 1 };

// The hero ball.
const BX = 858;
const BY = 362;
const R = 292;

// VOLLEY spin axis is about +y: seen from this side it turns clockwise (top of the ball goes forward).
const AXIS: Vec3 = { x: 0, y: 1, z: 0 };
const ANGLE = 0.5;
const GHOST_STEP = 0.16; // radians between the fading copies of the Line

/** A Line normal that lays the Line across the ball's face: in-plane direction alpha, bowed by phi. */
const faceNormal = (alphaDeg: number, phiDeg: number): Vec3 => {
  const a = (alphaDeg * Math.PI) / 180;
  const f = (phiDeg * Math.PI) / 180;
  // right = (1,0,0), up = (0,0,1), toward = (0,-1,0)
  return { x: -Math.sin(a) * Math.cos(f), y: -Math.sin(f), z: Math.cos(a) * Math.cos(f) };
};
const LINE_N = faceNormal(62, 24);

/** Front-facing pieces of the Line, as screen paths relative to the ball centre, at a given spin angle. */
const linePaths = (angle: number, r: number): string[] => {
  // Like Ball: a piece runs from the last back point to the first back point, so it reaches the rim.
  const out: string[] = [];
  let cur: string[] = [];
  let prev = "";
  for (let i = 0; i <= 96; i++) {
    const p = linePoint(SIDE, r, (i / 96) * Math.PI * 2, LINE_N, AXIS, angle);
    const xy = `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    if (p.front) {
      if (!cur.length && prev) cur.push(prev);
      cur.push(xy);
    } else if (cur.length) {
      cur.push(xy);
      out.push(`M${cur.join(" L")}`);
      cur = [];
    }
    prev = xy;
  }
  if (cur.length > 1) out.push(`M${cur.join(" L")}`);
  return out;
};

/** A thick arc arrow round (cx, cy): screen angles in degrees (clockwise = increasing), tapered, with a head. */
const arcArrow = (cx: number, cy: number, rad: number, a0: number, a1: number, w0: number, w1: number, head: number) => {
  const steps = 40;
  const L: string[] = [];
  const Rr: string[] = [];
  const dir = Math.sign(a1 - a0);
  const headDeg = ((head * 0.9) / rad) * (180 / Math.PI) * dir;
  const aEnd = a1 - headDeg;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = ((a0 + (aEnd - a0) * t) * Math.PI) / 180;
    const w = (w0 + (w1 - w0) * t) / 2;
    L.push(`${(cx + (rad + w) * Math.cos(a)).toFixed(1)},${(cy + (rad + w) * Math.sin(a)).toFixed(1)}`);
    Rr.push(`${(cx + (rad - w) * Math.cos(a)).toFixed(1)},${(cy + (rad - w) * Math.sin(a)).toFixed(1)}`);
  }
  const ae = (aEnd * Math.PI) / 180;
  const tip = (a1 * Math.PI) / 180;
  const hw = head * 0.78;
  const base1 = `${(cx + (rad + hw) * Math.cos(ae)).toFixed(1)},${(cy + (rad + hw) * Math.sin(ae)).toFixed(1)}`;
  const base2 = `${(cx + (rad - hw) * Math.cos(ae)).toFixed(1)},${(cy + (rad - hw) * Math.sin(ae)).toFixed(1)}`;
  const tipP = `${(cx + rad * Math.cos(tip)).toFixed(1)},${(cy + rad * Math.sin(tip)).toFixed(1)}`;
  return {
    body: `M${L.join(" L")} L${Rr.reverse().join(" L")} Z`,
    head: `M${base1} L${tipP} L${base2} Z`,
  };
};

// The ground plane seen from pitch height: y = HZ + FH / D, x = VX + F * X / D.
// D = metres away from the camera, X = metres to the right. The vanishing line sits
// behind the stands, so the far grass edge (y 560) is about 22 m away.
const HZ = 500;
const VX = 640;
const FH = 1320;
const F = 880;
const G = (X: number, D: number) => ({ x: VX + (F * X) / D, y: HZ + FH / D });

// The box edge (the 16.5 m line, parallel to the goal line) runs away from the camera at X = BOX_X.
// The penalty spot is 5.5 m inside it; the arc (radius 9.15 m) shows outside the box.
const BOX_X = -1.5;
const SPOT_D = 13.5;
const ARC_R = 9.15;
const LINE_W = 0.16; // painted line width in metres (a bit thick, to read at 320 px)

/** A painted ground line along world points [X, D], as a filled band in perspective. */
const groundBand = (pts: [number, number][], w = LINE_W) => {
  const L: string[] = [];
  const Rr: string[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dd = b[1] - a[1];
    const l = Math.hypot(dx, dd) || 1;
    const nx = (-dd / l) * (w / 2);
    const nd = (dx / l) * (w / 2);
    const p = G(pts[i][0] + nx, pts[i][1] + nd);
    const q = G(pts[i][0] - nx, pts[i][1] - nd);
    L.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    Rr.push(`${q.x.toFixed(1)},${q.y.toFixed(1)}`);
  }
  return `M${L.join(" L")} L${Rr.reverse().join(" L")} Z`;
};

// Kid-voice words: a command, the key word huge.
const WORDS = [
  { t: "WATCH", y: 206, s: 124, c: "#FFFFFF" },
  { t: "THE", y: 332, s: 124, c: "#FFFFFF" },
  { t: "LINE!", y: 530, s: 194, c: PITCH.light },
];

const STRIPE = 3; // mowing stripes, metres wide, parallel to the box edge

export const Set2A: React.FC = () => {
  const horizon = 560;
  const farD = FH / (horizon - HZ);

  // Mowing stripes that line up with the box edge and run away from the camera.
  const stripes: React.ReactNode[] = [];
  for (let k = -8; k <= 8; k++) {
    if (k % 2 === 0) continue;
    const x0 = BOX_X + k * STRIPE;
    const x1 = x0 + STRIPE;
    const a = G(x0, 3);
    const b = G(x1, 3);
    const c = G(x1, farD);
    const d = G(x0, farD);
    stripes.push(<path key={k} d={`M${a.x},${a.y} L${b.x},${b.y} L${c.x},${c.y} L${d.x},${d.y} Z`} fill={PITCH.grass} />);
  }

  // The box edge and the arc (only the part outside the box).
  const boxEdge: [number, number][] = [
    [BOX_X, 3],
    [BOX_X, farD],
  ];
  const arc: [number, number][] = [];
  const t0 = Math.acos(-5.5 / ARC_R);
  for (let i = 0; i <= 48; i++) {
    const t = t0 + ((2 * Math.PI - 2 * t0) * i) / 48;
    arc.push([BOX_X + 5.5 + ARC_R * Math.cos(t), SPOT_D + ARC_R * Math.sin(t)]);
  }

  // Two big clockwise arrows hugging the ball.
  const ar = R * 1.15;
  const top = arcArrow(BX, BY, ar, 202, 322, 10, 42, 50);
  const bot = arcArrow(BX, BY, ar, 22, 142, 10, 42, 50);

  return (
    <AbsoluteFill style={{ backgroundColor: PITCH.skyHigh }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="s2a-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#080B24" />
            <stop offset="1" stopColor={PITCH.sky} />
          </linearGradient>
          <radialGradient id="s2a-vig" cx={0.6} cy={0.5} r={0.8}>
            <stop offset="0.55" stopColor="#050716" stopOpacity={0} />
            <stop offset="1" stopColor="#050716" stopOpacity={0.65} />
          </radialGradient>
          <clipPath id="s2a-ball">
            <circle cx={BX} cy={BY} r={R * 0.995} />
          </clipPath>
          <clipPath id="s2a-grass">
            <rect x={0} y={horizon} width={W} height={H - horizon} />
          </clipPath>
        </defs>

        {/* Night sky and stars (only on the text side, so the ball does not look like a planet). */}
        <rect width={W} height={H} fill="url(#s2a-sky)" />
        {Array.from({ length: 24 }, (_, i) => (
          <circle key={i} cx={random(`s2a-sx-${i}`) * 540} cy={random(`s2a-sy-${i}`) * 260} r={0.8 + random(`s2a-sr-${i}`) * 1.5} fill="#FFFFFF" opacity={0.18 + random(`s2a-so-${i}`) * 0.4} />
        ))}

        {/* Stands and grass, low: the camera is close to the ball. */}
        <rect x={0} y={horizon - 96} width={W} height={98} fill={PITCH.stands} />
        <rect x={0} y={horizon - 112} width={W} height={22} fill={PITCH.standsLight} opacity={0.7} />
        {[0, 1].map((i) => (
          <rect key={i} x={0} y={horizon - 70 + i * 32} width={W} height={14} rx={7} fill={PITCH.standsLight} opacity={0.45} />
        ))}
        <rect x={0} y={horizon} width={W} height={H - horizon} fill={PITCH.grassDark} />
        <g clipPath="url(#s2a-grass)">
          {stripes}
          {/* Pitch paint: the box edge and the penalty arc. */}
          <g fill={PITCH.chalk} opacity={0.9}>
            <path d={groundBand(boxEdge)} />
            <path d={groundBand(arc)} />
          </g>
          {/* The ball's shadow on the grass: the ball is in the air, just inside the box. */}
          <ellipse cx={880} cy={690} rx={220} ry={30} fill="#031C15" opacity={0.3} />
          <ellipse cx={880} cy={690} rx={170} ry={22} fill="#031C15" opacity={0.5} />
        </g>
        <rect x={0} y={horizon - 3} width={W} height={6} fill={PITCH.grassLight} />

        <rect width={W} height={H} fill="url(#s2a-vig)" />

        {/* Far floodlights (after the vignette, so they stay bright). */}
        {[
          [96, 64],
          [430, 40],
        ].map(([x, y], i) => (
          <g key={i}>
            <Glow cx={x} cy={y} r={150} color={PITCH.lightSoft} intensity={1} rings={8} />
            <rect x={x - 44} y={y - 18} width={88} height={36} rx={14} fill={PITCH.lightSoft} />
          </g>
        ))}

        {/* The hero ball, fading copies of its Line (where it just was), then the Line. */}
        <Ball cx={BX} cy={BY} r={R} view={SIDE} axis={AXIS} angle={ANGLE} lineNormal={LINE_N} showLine={false} />
        <g clipPath="url(#s2a-ball)">
          <g transform={`translate(${BX} ${BY})`}>
            {[3, 2, 1].map((k) =>
              linePaths(ANGLE - k * GHOST_STEP, R).map((d, j) => (
                <path key={`${k}-${j}`} d={d} fill="none" stroke={PITCH.chalk} strokeWidth={R * 0.1} strokeLinecap="round" opacity={0.36 - k * 0.1} />
              )),
            )}
            {/* The Line itself, bolder than the kit's default. */}
            {linePaths(ANGLE, R).map((d, j) => (
              <path key={`m-${j}`} d={d} fill="none" stroke={PITCH.chalk} strokeWidth={R * 0.135} strokeLinecap="round" />
            ))}
          </g>
        </g>

        {/* The spin ring: two clockwise arrows in the video's lime spin colour. */}
        <path d={top.body} fill={XRAY.lime} />
        <path d={top.head} fill={XRAY.lime} stroke={XRAY.lime} strokeWidth={8} strokeLinejoin="round" />
        <path d={bot.body} fill={XRAY.lime} />
        <path d={bot.head} fill={XRAY.lime} stroke={XRAY.lime} strokeWidth={8} strokeLinejoin="round" />

        {/* Words. */}
        <g fontFamily={FONTS.title} fontWeight={800} textAnchor="start">
          {WORDS.map(({ t, y, s, c }) => (
            <g key={t}>
              <text x={44} y={y} fontSize={s} fill="#070920" transform={`translate(0 ${s * 0.07})`}>
                {t}
              </text>
              <text x={44} y={y} fontSize={s} fill={c}>
                {t}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
