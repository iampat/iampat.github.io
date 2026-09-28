// Thumbnail set 5, slot A, for "Three Spins and a Line" (1280x720): "HOW DO I CURL IT?".
// One strong picture: seen from high behind the ball, the inside of Tavi's white boot wipes across
// the back of the orange ball, just right of centre, out to the right (s09). The ball leaves along a
// glowing curved arrow that starts wide and bends back into the far post (the real CURLER flight,
// its sideways bend widened so it reads at thumbnail size).
import React from "react";
import { AbsoluteFill, random } from "remotion";
import { Ball, linePoint } from "../../../kit/Ball";
import { Keeper } from "../../../kit/Keeper";
import { Glow } from "../../../kit/World";
import { SHOTS } from "../../../physics/shots";
import { simulate, type Vec3 } from "../../../physics/sim";
import { project, type View } from "../../../lib/project";
import { CAST, FONTS, PITCH } from "../../../theme";

const W = 1280;
const H = 720;
const INK = "#070920"; // flat text shadow
const SOLE = "#A9A294";

type P2 = { x: number; y: number };
const add = (a: P2, b: P2, k = 1): P2 => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const deg = (v: number) => (v * Math.PI) / 180;
const f1 = (p: P2) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
const pts = (list: P2[]) => list.map(f1).join(" ");

// ---- Background camera: behind and above the kick spot, looking at the goal ----
// World: kick spot at the origin, x towards goal, y = left, z = up.
const GX = 20; // goal line (the video's curler is from twenty metres)
const GY = 2.8; // goal centre: left of the kick line, so the ball curls in at the far (right) post
const GW = 7.32;
const GH = 2.44;
const BEND = 2.6; // sideways bend multiplier, for readability only
const K_SCREEN: P2 = { x: 430, y: 600 }; // where the kick spot lands (hidden behind the hero ball)
const V0: View = { kind: "persp", cam: { x: -6, y: 0.6, z: 4.2 }, yawDeg: 3, pitchDeg: -13, focal: 900, cx: 0, cy: 0 };
const k0 = project({ x: 0, y: 0, z: 0 }, V0);
const VIEW: View = { ...V0, cx: K_SCREEN.x - k0.x, cy: K_SCREEN.y - k0.y };
const P = (x: number, y: number, z: number) => project({ x, y, z }, VIEW);

/** The curler in world metres, from the kick to the goal line, with its bend widened about the chord. */
const curlerPath = (): Vec3[] => {
  const raw = simulate(SHOTS.CURLER, 60).map((s) => s.pos);
  const out: Vec3[] = [];
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    if (p.x >= GX) {
      const q = raw[i - 1];
      const t = (GX - q.x) / (p.x - q.x);
      out.push({ x: GX, y: q.y + (p.y - q.y) * t, z: q.z + (p.z - q.z) * t });
      break;
    }
    out.push(p);
  }
  const end = out[out.length - 1];
  return out.map((p) => {
    const chord = (end.y * p.x) / end.x;
    return { x: p.x, y: chord + BEND * (p.y - chord), z: p.z };
  });
};
const PATH = curlerPath();

/** A tapered ribbon along screen points: width goes from w0 (start) to w1 (end). */
const ribbon = (list: P2[], w0: number, w1: number, ease = 0.6) => {
  const n = list.length;
  const L: string[] = [];
  const R: string[] = [];
  let total = 0;
  const acc = [0];
  for (let i = 1; i < n; i++) {
    total += Math.hypot(list[i].x - list[i - 1].x, list[i].y - list[i - 1].y);
    acc.push(total);
  }
  for (let i = 0; i < n; i++) {
    const a = list[Math.max(0, i - 1)];
    const b = list[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    const t = acc[i] / (total || 1);
    const w = (w0 + (w1 - w0) * Math.pow(t, ease)) / 2;
    L.push(f1({ x: list[i].x + nx * w, y: list[i].y + ny * w }));
    R.push(f1({ x: list[i].x - nx * w, y: list[i].y - ny * w }));
  }
  return `M${L.join(" L")} L${R.reverse().join(" L")} Z`;
};

const quad = (a: P2, b: P2, c: P2, d: P2) => `M${f1(a)} L${f1(b)} L${f1(c)} L${f1(d)} Z`;

// ---- Hero: the ball and the boot, drawn close up from high behind ----
const B: P2 = { x: 400, y: 430 }; // ball centre
const R = 150; // ball radius
const HERO: View = { kind: "persp", cam: { x: -1, y: 0, z: 1 }, yawDeg: 0, pitchDeg: -38, focal: 1000, cx: 0, cy: 0 };
const SPIN_AXIS: Vec3 = { x: -0.063, y: -0.45, z: 0.891 }; // the CURLER spin: anticlockwise from above
const LINE_N: Vec3 = { x: 0.55, y: 0.83, z: 0.1 }; // a Line from the top of the ball down across its face

/** The front part of the Line at a spin angle, as path strings around the ball centre. */
const linePaths = (angle: number): string[] => {
  const out: string[] = [];
  let seg: P2[] = [];
  for (let i = 0; i <= 120; i++) {
    const p = linePoint(HERO, R, (i / 120) * 2 * Math.PI, LINE_N, SPIN_AXIS, angle);
    if (p.front) seg.push({ x: B.x + p.x, y: B.y + p.y });
    else if (seg.length) {
      if (seg.length > 1) out.push(`M${seg.map(f1).join(" L")}`);
      seg = [];
    }
  }
  if (seg.length > 1) out.push(`M${seg.map(f1).join(" L")}`);
  return out;
};

// Boot: the right foot turned out, toes to the right, the inside of the foot against the back of the
// ball just right of centre. Local coordinates: u from the heel (0) to the toe (BL); v from the inside
// edge (0, touching the ball) towards the sole (BW), which faces the camera.
const BL = 380;
const BW = 138;
const PHI = -9; // boot direction on screen, degrees (negative: toe a little up)
const d: P2 = { x: Math.cos(deg(PHI)), y: Math.sin(deg(PHI)) };
const m: P2 = { x: -d.y, y: d.x }; // towards the sole side (down the screen)
const CONTACT: P2 = { x: B.x + 0.3 * R, y: B.y + 0.6 * R };
const U_C = 0.64 * BL; // contact: between the big-toe joint and the arch
const O = add(add(CONTACT, d, -U_C), m, 4);
const BP = (u: number, v: number): P2 => add(add(O, d, u), m, v);

const Boot: React.FC = () => {
  const at = (u: number, v: number) => f1(BP(u, v));
  // Outline: inside edge (heel to toe), round toe, outside edge back to a round heel.
  const outline = [
    `M${at(40, 8)}`,
    `C${at(120, -4)} ${at(170, 10)} ${at(215, 2)}`, // arch
    `C${at(260, -8)} ${at(320, -10)} ${at(350, 8)}`, // big-toe joint
    `C${at(392, 30)} ${at(388, 84)} ${at(344, 98)}`, // toe
    `C${at(280, 120)} ${at(160, BW)} ${at(70, BW - 6)}`, // outside edge
    `C${at(-10, BW - 10)} ${at(-22, 30)} ${at(40, 8)}`, // heel
    "Z",
  ].join(" ");
  // Side wall (the outside of the boot, facing the camera) and the sole along its lower edge.
  const wall = [
    `M${at(352, 70)}`,
    `C${at(300, 96)} ${at(170, 106)} ${at(70, 104)}`,
    `C${at(20, 104)} ${at(-6, 90)} ${at(-8, 70)}`,
    `C${at(-14, 116)} ${at(20, BW - 8)} ${at(70, BW - 6)}`,
    `C${at(160, BW)} ${at(280, 120)} ${at(344, 98)}`,
    "Z",
  ].join(" ");
  const sole = `M${at(340, 100)} C${at(280, 122)} ${at(160, BW + 2)} ${at(70, BW - 4)} C${at(20, BW - 8)} ${at(-8, 118)} ${at(-10, 96)}`;
  const laces = [150, 186, 222, 258];
  return (
    <g>
      <path d={outline} fill={CAST.boot} />
      <path d={wall} fill={CAST.bootShade} />
      <path d={sole} fill="none" stroke={SOLE} strokeWidth={11} strokeLinecap="round" />
      {/* Laces along the top of the foot. */}
      {laces.map((u, i) => (
        <line key={i} x1={BP(u, 30).x} y1={BP(u, 30).y} x2={BP(u + 10, 62).x} y2={BP(u + 10, 62).y} stroke={CAST.bootShade} strokeWidth={10} strokeLinecap="round" />
      ))}
      {/* A soft highlight along the inside edge. */}
      <path d={`M${at(120, 14)} C${at(200, 12)} ${at(280, 4)} ${at(336, 18)}`} fill="none" stroke="#FFFFFF" strokeWidth={8} strokeLinecap="round" opacity={0.7} />
    </g>
  );
};

/** The shin rises from the ankle towards the camera, so on screen it runs down off the frame. */
const Shin: React.FC = () => {
  const a0 = BP(40, 30);
  const a1 = BP(130, 44);
  const dir: P2 = { x: -0.28, y: 0.96 };
  const b0 = add(a0, dir, 360);
  const b1 = add(add(a1, dir, 360), { x: 1, y: 0 }, 70);
  const s0 = add(a1, { x: -1, y: 0 }, 30);
  const s1 = add(b1, { x: -1, y: 0 }, 52);
  return (
    <g>
      <polygon points={pts([a0, a1, b1, b0])} fill={CAST.sock} />
      <polygon points={pts([s0, a1, b1, s1])} fill={CAST.sockShade} />
      {/* The boot collar. */}
      <path d={`M${f1(add(a0, { x: -6, y: -4 }))} Q${f1(add({ x: (a0.x + a1.x) / 2, y: (a0.y + a1.y) / 2 }, m, 26))} ${f1(add(a1, { x: 6, y: -2 }))}`} fill="none" stroke={CAST.bootShade} strokeWidth={12} strokeLinecap="round" />
    </g>
  );
};

/** Short chalk streaks behind the boot: it swept in from behind and to the left. */
const Streaks: React.FC = () => {
  const s: P2 = { x: -0.62, y: 0.78 }; // trailing direction (opposite the sweep)
  const list = [
    { u: 20, v: 40, len: 120, w: 14, o: 0.55 },
    { u: 60, v: 118, len: 170, w: 14, o: 0.45 },
    { u: 250, v: 124, len: 110, w: 12, o: 0.35 },
  ];
  return (
    <g stroke={PITCH.chalk} strokeLinecap="round" fill="none">
      {list.map((l, i) => {
        const p0 = add(BP(l.u, l.v), s, 26);
        const p1 = add(p0, s, l.len);
        return <line key={i} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} strokeWidth={l.w} opacity={l.o} />;
      })}
    </g>
  );
};

// ---- Words ----
const Words: React.FC = () => (
  <g fontFamily={FONTS.title} fontWeight={800} textAnchor="end">
    <text x={1228} y={178} fontSize={104} fill={INK} transform="translate(0 8)">
      HOW DO I
    </text>
    <text x={1228} y={178} fontSize={104} fill={PITCH.chalk}>
      HOW DO I
    </text>
    <text x={1232} y={346} fontSize={166} fill={INK} transform="translate(0 11)">
      CURL IT?
    </text>
    <text x={1232} y={346} fontSize={166} fill={PITCH.light}>
      CURL IT?
    </text>
  </g>
);

export const Set5A: React.FC = () => {
  // Pitch stripes across the kick direction.
  const stripes: React.ReactNode[] = [];
  for (let i = -2; i < 16; i += 2) {
    const x0 = i * 2.5;
    const x1 = x0 + 2.5;
    stripes.push(<path key={i} d={quad(P(x0, 40, 0), P(x1, 40, 0), P(x1, -40, 0), P(x0, -40, 0))} fill={PITCH.grass} />);
  }
  const far = P(60, 0, 0);
  const line = (list: [number, number][]) => list.map(([x, y], i) => `${i ? "L" : "M"}${f1(P(x, y, 0))}`).join(" ");
  const arc: [number, number][] = [];
  for (let a = -53; a <= 53; a += 4) {
    const t = deg(a);
    arc.push([GX - 11 - 9.15 * Math.cos(t), GY + 9.15 * Math.sin(t)]);
  }

  // Goal frame and net.
  const gl = P(GX, GY + GW / 2, 0);
  const gr = P(GX, GY - GW / 2, 0);
  const tl = P(GX, GY + GW / 2, GH);
  const tr = P(GX, GY - GW / 2, GH);
  const nbl = P(GX + 2, GY + GW / 2, 0);
  const nbr = P(GX + 2, GY - GW / 2, 0);
  const ntl = P(GX + 1.2, GY + GW / 2, GH * 0.92);
  const ntr = P(GX + 1.2, GY - GW / 2, GH * 0.92);
  const postW = Math.max(6, gl.scale * 0.14);
  const net: React.ReactNode[] = [];
  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    net.push(<line key={`c${i}`} x1={ntl.x + (ntr.x - ntl.x) * t} y1={ntl.y + (ntr.y - ntl.y) * t} x2={nbl.x + (nbr.x - nbl.x) * t} y2={nbl.y + (nbr.y - nbl.y) * t} />);
  }
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    net.push(<line key={`r${i}`} x1={ntl.x + (nbl.x - ntl.x) * t} y1={ntl.y + (nbl.y - ntl.y) * t} x2={ntr.x + (nbr.x - ntr.x) * t} y2={ntr.y + (nbr.y - ntr.y) * t} />);
  }
  const kp = P(GX - 0.2, GY + 0.6, 0);

  // The flight on screen, and an arrowhead at its end.
  const fl: P2[] = PATH.map((p) => P(p.x, p.y, p.z));
  const end = fl[fl.length - 1];
  const prev = fl[fl.length - 4];
  const ang = Math.atan2(end.y - prev.y, end.x - prev.x);
  const hs = 34;
  const tip = { x: end.x + Math.cos(ang) * hs, y: end.y + Math.sin(ang) * hs };
  const w1 = { x: end.x + Math.cos(ang + 2.2) * hs, y: end.y + Math.sin(ang + 2.2) * hs };
  const w2 = { x: end.x + Math.cos(ang - 2.2) * hs, y: end.y + Math.sin(ang - 2.2) * hs };
  const body = fl.slice(0, fl.length - 1);

  return (
    <AbsoluteFill style={{ backgroundColor: PITCH.skyHigh }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="s5a-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#080B24" />
            <stop offset="1" stopColor={PITCH.sky} />
          </linearGradient>
          <radialGradient id="s5a-vig" cx={0.45} cy={0.5} r={0.8}>
            <stop offset="0.55" stopColor="#050716" stopOpacity={0} />
            <stop offset="1" stopColor="#050716" stopOpacity={0.55} />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#s5a-sky)" />
        {Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={random(`s5a-sx-${i}`) * W} cy={random(`s5a-sy-${i}`) * 60} r={0.8 + random(`s5a-sr-${i}`) * 1.3} fill="#FFFFFF" opacity={0.2 + random(`s5a-so-${i}`) * 0.4} />
        ))}
        {/* Floodlights. */}
        {[
          [90, 26],
          [560, 20],
        ].map(([x, y], i) => (
          <g key={i}>
            <Glow cx={x} cy={y} r={190} color={PITCH.lightSoft} intensity={1.2} rings={5} />
            <rect x={x - 46} y={y - 18} width={92} height={36} rx={13} fill={PITCH.lightSoft} />
          </g>
        ))}
        {/* Stands behind the goal. */}
        <rect x={0} y={far.y - 70} width={W} height={72} fill={PITCH.stands} />
        <rect x={0} y={far.y - 82} width={W} height={18} fill={PITCH.standsLight} opacity={0.7} />
        <rect x={0} y={far.y - 48} width={W} height={12} rx={6} fill={PITCH.standsLight} opacity={0.5} />
        <rect x={0} y={far.y - 24} width={W} height={12} rx={6} fill={PITCH.standsLight} opacity={0.5} />
        {/* Grass. */}
        <rect x={0} y={far.y} width={W} height={H - far.y} fill={PITCH.grassDark} />
        {stripes}
        <g fill="none" stroke={PITCH.chalk} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.45}>
          <path d={line([[GX, -40], [GX, 40]])} />
          <path d={line([[GX, GY - 9.16], [GX - 5.5, GY - 9.16], [GX - 5.5, GY + 9.16], [GX, GY + 9.16]])} />
          <path d={line([[GX, GY - 20.16], [GX - 16.5, GY - 20.16], [GX - 16.5, GY + 20.16], [GX, GY + 20.16]])} />
          <path d={line(arc)} />
        </g>
        {/* Net, goal frame and Chalk. */}
        <path d={quad(nbl, ntl, ntr, nbr)} fill={PITCH.skyHigh} opacity={0.55} />
        <g stroke={PITCH.chalk} strokeWidth={1.5} opacity={0.4}>
          {net}
        </g>
        <path d={`M${f1(gl)} L${f1(tl)} L${f1(tr)} L${f1(gr)}`} fill="none" stroke={PITCH.chalk} strokeWidth={postW} strokeLinecap="round" strokeLinejoin="round" />
        <Keeper x={kp.x} groundY={kp.y} h={1.9 * kp.scale} pose={{ left: 40, right: 50, lean: -10, shift: -0.1, lift: 0, stretch: 0.96 }} face="surprised" look={1} />
        {/* The curved arrow: the ball starts wide and bends back in. */}
        <path d={ribbon(body, 150, 40)} fill={PITCH.light} opacity={0.1} />
        <path d={ribbon(body, 100, 26)} fill={PITCH.light} opacity={0.22} />
        <path d={ribbon(body, 54, 16)} fill={PITCH.lightSoft} />
        <path d={ribbon(body, 26, 7)} fill="#FFFFFF" />
        <polygon points={pts([tip, w1, w2])} fill={PITCH.lightSoft} stroke={PITCH.lightSoft} strokeWidth={8} strokeLinejoin="round" />
        <rect width={W} height={H} fill="url(#s5a-vig)" />
        {/* Hero: shadow, ball, Line with two earlier copies (it turns: the back of the ball moves right). */}
        <ellipse cx={B.x + 20} cy={B.y + R * 1.0} rx={R * 1.1} ry={R * 0.3} fill="#08261D" opacity={0.5} />
        <Glow cx={CONTACT.x} cy={CONTACT.y} r={260} color={PITCH.lightSoft} intensity={0.9} rings={5} />
        <Ball cx={B.x} cy={B.y} r={R} view={HERO} axis={SPIN_AXIS} lineNormal={LINE_N} showLine={false} />
        {[
          { a: -0.5, o: 0.18 },
          { a: -0.25, o: 0.38 },
          { a: 0, o: 1 },
        ].map((g, i) =>
          linePaths(g.a).map((p, j) => <path key={`${i}-${j}`} d={p} fill="none" stroke={CAST.ballLine} strokeWidth={R * 0.11} strokeLinecap="round" opacity={g.o} />),
        )}
        <Streaks />
        <Boot />
        <Shin />
        <Words />
      </svg>
    </AbsoluteFill>
  );
};
