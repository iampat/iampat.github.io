// Parts for scenes s04 and s05 (chapter 1 x-ray views).
// World grid, whip, motion trails, the trampoline cutaway ball,
// the trolley inset, the hammer ankle, leak puffs, the speed bar and the save inset.

import React from "react";
import { random, useCurrentFrame } from "remotion";
import { EASE, clamp01, pop, popSoft, progress } from "../../lib/anim";
import { solve, type Pose } from "../Player";
import { Keeper, type KeeperFace, type KeeperPose } from "../Keeper";
import { GoalFront } from "../Goal";
import { Ball } from "../Ball";
import { Glow } from "../World";
import { project, type View } from "../../lib/project";
import { sampleAt, spinAngleAt, type BallState } from "../../physics/sim";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";

export type P = { x: number; y: number };
export type Cam = { x: number; y: number; zoom: number };

/** World point -> screen point for a camera that centres (cam.x, cam.y). */
export const toScreen = (p: P, cam: Cam): P => ({
  x: WIDTH / 2 + (p.x - cam.x) * cam.zoom,
  y: HEIGHT / 2 + (p.y - cam.y) * cam.zoom,
});

export const camTransform = (cam: Cam) =>
  `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;

/** A grid in world space that covers whatever the camera sees (lines stay 2 px on screen). */
export const WorldGrid: React.FC<{
  cam: Cam;
  step?: number;
  color?: string;
  opacity?: number;
}> = ({ cam, step = 60, color = XRAY.grid, opacity = 1 }) => {
  const halfW = WIDTH / 2 / cam.zoom;
  const halfH = HEIGHT / 2 / cam.zoom;
  const x0 = Math.floor((cam.x - halfW) / step) * step - step;
  const x1 = cam.x + halfW + step;
  const y0 = Math.floor((cam.y - halfH) / step) * step - step;
  const y1 = cam.y + halfH + step;
  const lines: React.ReactNode[] = [];
  for (let x = x0; x <= x1; x += step)
    lines.push(<line key={`x${x}`} x1={x} y1={y0} x2={x} y2={y1} />);
  for (let y = y0; y <= y1; y += step)
    lines.push(<line key={`y${y}`} x1={x0} y1={y} x2={x1} y2={y} />);
  return (
    <g stroke={color} strokeWidth={2 / cam.zoom} opacity={opacity}>
      {lines}
    </g>
  );
};

/** Slow drifting specks in screen space, so an x-ray frame is never fully still. */
export const Motes: React.FC<{
  count?: number;
  seed?: string;
  color?: string;
  opacity?: number;
}> = ({ count = 36, seed = "motes", color = XRAY.bone, opacity = 1 }) => {
  const frame = useCurrentFrame();
  return (
    <g opacity={opacity}>
      {Array.from({ length: count }, (_, i) => {
        const sx = random(`${seed}-x-${i}`) * WIDTH;
        const sy = random(`${seed}-y-${i}`) * HEIGHT;
        const sp = 0.15 + random(`${seed}-s-${i}`) * 0.35;
        const x = (sx + frame * sp * 0.6) % WIDTH;
        const y = (sy - frame * sp + HEIGHT * 4) % HEIGHT;
        const r = 1.5 + random(`${seed}-r-${i}`) * 2.5;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(frame / 40 + i));
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={r}
            fill={color}
            opacity={0.12 * tw}
          />
        );
      })}
    </g>
  );
};

/** Smooth points through a list (Catmull-Rom), n samples per segment. */
const spline = (pts: P[], n = 14): P[] => {
  if (pts.length < 3) return pts;
  const out: P[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

/**
 * The kicking leg drawn as a bullwhip, for the "whip" beat.
 * The thigh is the stiff handle (grip bands, a knob at the hip), the shin and foot are the tapered,
 * braided lash, and a small popper hangs off the toe. One loop runs down the lash:
 * phase 0 = at the knee, 1 = at the tip (the crack). amount 0..1 fades the whip in over the leg.
 */
export const Bullwhip: React.FC<{
  hip: P;
  knee: P;
  ankle: P;
  toe: P;
  /** End of the popper, just past the toe. */
  tail: P;
  amount: number;
  phase: number;
  /** Loop height in pixels. */
  loop: number;
  handleW: number;
  /** Lash thickness at the knee. */
  lashW: number;
  color?: string;
  handleColor?: string;
  glowColor?: string;
}> = ({
  hip,
  knee,
  ankle,
  toe,
  tail,
  amount,
  phase,
  loop,
  handleW,
  lashW,
  color = XRAY.bone,
  handleColor = XRAY.pink,
  glowColor = XRAY.pink,
}) => {
  if (amount <= 0.001) return null;
  const grow = 0.55 + 0.45 * amount;
  const s = spline([knee, ankle, toe, tail], 16);
  const lens = [0];
  for (let i = 1; i < s.length; i++)
    lens.push(lens[i - 1] + Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y));
  const L = lens[lens.length - 1] || 1;
  const loopH = loop * (1 - 0.55 * clamp01(phase)) * amount;
  const mid: P[] = [];
  const nrm: P[] = [];
  const wid: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const a = s[Math.max(0, i - 1)];
    const b = s[Math.min(s.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dl = Math.hypot(dx, dy) || 1;
    // Normal to the left of the lash direction: for a lash hanging down it points back (-x).
    const n = { x: -dy / dl, y: dx / dl };
    const u = lens[i] / L;
    const k = (u - phase) / 0.2;
    const off = Math.abs(k) < 1 ? loopH * 0.5 * (1 + Math.cos(Math.PI * k)) : 0;
    mid.push({ x: s[i].x + n.x * off, y: s[i].y + n.y * off });
    nrm.push(n);
    wid.push(lashW * grow * (1 - 0.86 * Math.pow(u, 0.9)));
  }
  const left = mid.map((c, i) => ({ x: c.x + (nrm[i].x * wid[i]) / 2, y: c.y + (nrm[i].y * wid[i]) / 2 }));
  const right = mid.map((c, i) => ({ x: c.x - (nrm[i].x * wid[i]) / 2, y: c.y - (nrm[i].y * wid[i]) / 2 }));
  const pts = (a: P[]) => a.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L");
  const lashD = `M${pts(left)} L${pts([...right].reverse())} Z`;
  // Braid marks: short slanted strokes across the lash.
  const braids: React.ReactNode[] = [];
  for (let i = 3; i < mid.length - 4; i += 3) {
    const n = nrm[i];
    const t = { x: n.y, y: -n.x };
    const h = wid[i] * 0.42;
    const sl = 0.45;
    braids.push(
      <line
        key={i}
        x1={mid[i].x + (n.x + t.x * sl) * h}
        y1={mid[i].y + (n.y + t.y * sl) * h}
        x2={mid[i].x - (n.x - t.x * sl) * h}
        y2={mid[i].y - (n.y - t.y * sl) * h}
        stroke={XRAY.tissue}
        strokeWidth={Math.max(1.5, wid[i] * 0.16)}
        strokeLinecap="round"
        opacity={0.75}
      />,
    );
  }
  // Loop crest (the travelling bright spot).
  const ci = Math.min(mid.length - 1, Math.max(0, Math.round(clamp01(phase) * (mid.length - 1))));
  const crest = mid[ci];
  // Handle: hip -> knee.
  const hx = knee.x - hip.x;
  const hy = knee.y - hip.y;
  const hl = Math.hypot(hx, hy) || 1;
  const hd = { x: hx / hl, y: hy / hl };
  const hn = { x: -hd.y, y: hd.x };
  const hw = handleW * grow;
  const at = (t: number) => ({ x: hip.x + hx * t, y: hip.y + hy * t });
  // Popper: three short strands at the tip, fanned along the lash end.
  const end = mid[mid.length - 1];
  const pre = mid[Math.max(0, mid.length - 4)];
  const ea = Math.atan2(end.y - pre.y, end.x - pre.x);
  const pl = lashW * 1.25;
  return (
    <g opacity={amount}>
      {/* Lash glow, lash, braid. */}
      <path d={lashD} fill={glowColor} opacity={0.25} stroke={glowColor} strokeWidth={lashW * 0.9} strokeLinejoin="round" />
      <path d={lashD} fill={color} />
      {braids}
      {[-0.38, 0, 0.38].map((da, i) => (
        <line
          key={i}
          x1={end.x}
          y1={end.y}
          x2={end.x + Math.cos(ea + da) * pl}
          y2={end.y + Math.sin(ea + da) * pl}
          stroke={color}
          strokeWidth={Math.max(2, lashW * 0.16)}
          strokeLinecap="round"
        />
      ))}
      {/* Handle with grip bands and a knob. */}
      <line x1={hip.x} y1={hip.y} x2={knee.x} y2={knee.y} stroke={glowColor} strokeWidth={hw * 1.7} strokeLinecap="round" opacity={0.22} />
      <line x1={hip.x} y1={hip.y} x2={knee.x} y2={knee.y} stroke={handleColor} strokeWidth={hw} strokeLinecap="round" />
      <line
        x1={hip.x + hn.x * hw * 0.2}
        y1={hip.y + hn.y * hw * 0.2}
        x2={knee.x + hn.x * hw * 0.2}
        y2={knee.y + hn.y * hw * 0.2}
        stroke="#FFFFFF"
        strokeWidth={hw * 0.2}
        strokeLinecap="round"
        opacity={0.35}
      />
      {[0.2, 0.34, 0.48, 0.62].map((t, i) => {
        const c = at(t);
        return (
          <line
            key={i}
            x1={c.x + hn.x * hw * 0.5}
            y1={c.y + hn.y * hw * 0.5}
            x2={c.x - hn.x * hw * 0.5}
            y2={c.y - hn.y * hw * 0.5}
            stroke={XRAY.bg}
            strokeWidth={hw * 0.16}
            strokeLinecap="round"
            opacity={0.4}
          />
        );
      })}
      <circle cx={hip.x} cy={hip.y} r={hw * 0.74} fill={handleColor} />
      <circle cx={hip.x} cy={hip.y} r={hw * 0.32} fill={color} />
      {/* Metal ring where the lash joins the handle. */}
      <circle cx={knee.x} cy={knee.y} r={hw * 0.58} fill={color} />
      <circle cx={knee.x} cy={knee.y} r={hw * 0.26} fill={handleColor} />
      {/* The loop. */}
      {phase > 0.001 && phase < 0.999 ? (
        <>
          <circle cx={crest.x} cy={crest.y} r={lashW * 0.95} fill={glowColor} opacity={0.5} />
          <circle cx={crest.x} cy={crest.y} r={lashW * 0.42} fill="#FFFFFF" opacity={0.85} />
        </>
      ) : null}
    </g>
  );
};

/** A fading motion trail through recent positions (oldest first). */
export const MotionTrail: React.FC<{
  pts: P[];
  color: string;
  width: number;
  opacity?: number;
}> = ({ pts, color, width, opacity = 1 }) => {
  if (pts.length < 2 || opacity <= 0.001) return null;
  const n = pts.length - 1;
  return (
    <g opacity={opacity}>
      {pts.slice(1).map((p, i) => {
        const a = pts[i];
        const k = (i + 1) / n;
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={p.x}
            y2={p.y}
            stroke={color}
            strokeWidth={width * (0.25 + 0.75 * k)}
            strokeLinecap="round"
            opacity={0.7 * k}
          />
        );
      })}
    </g>
  );
};

/** Zigzag spring between two points. */
const springPath = (a: P, b: P, coils: number, amp: number) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const n = { x: -dy / L, y: dx / L };
  const pts: P[] = [a];
  for (let i = 1; i < coils * 2; i++) {
    const t = i / (coils * 2);
    const s = i % 2 ? 1 : -1;
    pts.push({
      x: a.x + dx * t + n.x * amp * s,
      y: a.y + dy * t + n.y * amp * s,
    });
  }
  pts.push(b);
  return `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}`;
};

/**
 * The ball as a cutaway with a small trampoline inside, lying on its side so the mat faces the foot (left).
 * flat: 0..~0.35 of r pressed flat on the left. bow: mat push to the right (-0.5..1).
 * ring: 0..1 contact timer ring. open: 0..1 how much of the cutaway shows.
 */
export const CutawayBall: React.FC<{
  cx: number;
  cy: number;
  r: number;
  flat?: number;
  bow?: number;
  open?: number;
  ring?: number;
  ringOpacity?: number;
}> = ({
  cx,
  cy,
  r,
  flat = 0,
  bow = 0,
  open = 1,
  ring = 0,
  ringOpacity = 0,
}) => {
  const d = flat * r;
  const bulge = 1 + 0.22 * flat;
  const shell: P[] = [];
  for (let i = 0; i <= 96; i++) {
    const th = (i / 96) * Math.PI * 2;
    shell.push({
      x: Math.max(r * Math.cos(th), -r + d),
      y: r * Math.sin(th) * bulge,
    });
  }
  const shellD = `M${shell.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")} Z`;
  const inner = shell.map((p) => ({ x: p.x * 0.84 + 0.0, y: p.y * 0.84 }));
  const innerD = `M${inner.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")} Z`;
  // Trampoline on its side: rim ends top and bottom, mat between them, legs to the right.
  const xr = -0.5 * r + d * 0.84;
  const rimT = { x: xr, y: -0.6 * r * bulge };
  const rimB = { x: xr, y: 0.6 * r * bulge };
  const matT = { x: xr, y: -0.4 * r * bulge };
  const matB = { x: xr, y: 0.4 * r * bulge };
  const ctrl = { x: xr + bow * 0.6 * r, y: 0 };
  const legT = { x: xr + 0.46 * r, y: -0.68 * r };
  const legB = { x: xr + 0.46 * r, y: 0.68 * r };
  const lw = Math.max(2, r * 0.06);
  const ringR = r * 1.32;
  const circ = 2 * Math.PI * ringR;
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {ringOpacity > 0.001 ? (
        <g opacity={ringOpacity}>
          <circle
            r={ringR}
            fill="none"
            stroke={XRAY.grid}
            strokeWidth={lw * 1.6}
          />
          <circle
            r={ringR}
            fill="none"
            stroke={XRAY.bone}
            strokeWidth={lw * 1.6}
            strokeDasharray={`${circ * clamp01(ring)} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90)"
          />
          {/* Stopwatch knob at the top of the ring. */}
          <circle cx={0} cy={-ringR} r={r * 0.1} fill={XRAY.bone} />
          <rect
            x={-r * 0.05}
            y={-ringR - r * 0.22}
            width={r * 0.1}
            height={r * 0.12}
            rx={r * 0.03}
            fill={XRAY.bone}
          />
        </g>
      ) : null}
      <path d={shellD} fill={CAST.ball} />
      <g opacity={open}>
        <path d={innerD} fill={XRAY.bg} />
        <path d={innerD} fill={XRAY.grid} opacity={0.7} />
        {/* Legs. */}
        <g
          stroke={XRAY.bone}
          strokeWidth={lw}
          strokeLinecap="round"
          opacity={0.75}
        >
          <line x1={rimT.x} y1={rimT.y} x2={legT.x} y2={legT.y} />
          <line x1={rimB.x} y1={rimB.y} x2={legB.x} y2={legB.y} />
          <line
            x1={legT.x}
            y1={legT.y - 0.1 * r}
            x2={legT.x}
            y2={legT.y + 0.1 * r}
          />
          <line
            x1={legB.x}
            y1={legB.y - 0.1 * r}
            x2={legB.x}
            y2={legB.y + 0.1 * r}
          />
          <line
            x1={(rimT.x + legT.x) / 2}
            y1={(rimT.y + legT.y) / 2}
            x2={(rimB.x + legB.x) / 2}
            y2={(rimB.y + legB.y) / 2}
            opacity={0.5}
          />
        </g>
        {/* Springs. */}
        <g
          stroke={XRAY.bone}
          strokeWidth={lw * 0.7}
          fill="none"
          strokeLinejoin="round"
        >
          <path d={springPath(rimT, matT, 4, r * 0.05)} />
          <path d={springPath(matB, rimB, 4, r * 0.05)} />
        </g>
        {/* Mat. */}
        <path
          d={`M${matT.x},${matT.y} Q${ctrl.x},${ctrl.y} ${matB.x},${matB.y}`}
          fill="none"
          stroke={XRAY.lime}
          strokeWidth={lw * 1.7}
          strokeLinecap="round"
        />
        {/* Rim ends. */}
        <circle cx={rimT.x} cy={rimT.y} r={lw * 1.3} fill={XRAY.bone} />
        <circle cx={rimB.x} cy={rimB.y} r={lw * 1.3} fill={XRAY.bone} />
      </g>
      {/* Rim light on the lit edge. */}
      <path
        d={`M${-r * 0.8},${-r * 0.45 * bulge} A${r * 0.94},${r * 0.94 * bulge} 0 0 1 ${r * 0.1},${-r * 0.93 * bulge}`}
        fill="none"
        stroke={CAST.ballRim}
        strokeWidth={Math.max(1.5, r * 0.07)}
        strokeLinecap="round"
        opacity={0.8}
      />
    </g>
  );
};

/** An arrow drawn at full length (no draw-on), with a rounded shaft and head. */
export const FlatArrow: React.FC<{
  x: number;
  y: number;
  len: number;
  color: string;
  width?: number;
  angle?: number;
  opacity?: number;
  outline?: boolean;
}> = ({
  x,
  y,
  len,
  color,
  width = 12,
  angle = 0,
  opacity = 1,
  outline = false,
}) => {
  if (len <= 1 || opacity <= 0.001) return null;
  const head = Math.min(len * 0.45, width * 2.6);
  if (outline) {
    const hw = width / 2;
    const hh = head * 0.62;
    const d = `M0,${-hw} L${len - head},${-hw} L${len - head},${-hh} L${len},0 L${len - head},${hh} L${len - head},${hw} L0,${hw} Z`;
    return (
      <g transform={`translate(${x} ${y}) rotate(${angle})`} opacity={opacity}>
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeDasharray="8 6"
          strokeLinejoin="round"
        />
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} opacity={opacity}>
      <line
        x1={0}
        y1={0}
        x2={len - head * 0.8}
        y2={0}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
      />
      <path
        d={`M${len},0 L${len - head},${-head * 0.62} L${len - head},${head * 0.62} Z`}
        fill={color}
        stroke={color}
        strokeWidth={width * 0.45}
        strokeLinejoin="round"
      />
    </g>
  );
};

/**
 * Inset: a heavy trolley (4 times the ball) bumps a ball. Straight-line physics, no easing.
 * Restitution 0.5625: the ball leaves at 1.25 V and the trolley rolls on at 0.6875 V
 * (the same ball/foot ratio as the s03 bars and the main x-ray arrows).
 * The trolley is already inside the panel when the panel opens, and rolls at one speed until the bump.
 * After the bump its arrow stays behind as a dashed outline (its speed at the hit), so the ball arrow
 * is compared with the speed that hit it.
 */
export const TrolleyInset: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  at: number;
  bump: number;
  until: number;
  /** Frame where the weight badge pulses ("way heavier"). */
  pulseAt?: number;
}> = ({ x, y, w, h, at, bump, until, pulseAt }) => {
  const frame = useCurrentFrame();
  const s =
    pop(frame, at, { stiffness: 180, damping: 15 }) *
    (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const BALL_K = 1.25;
  const TROLLEY_K = 0.6875;
  const trackY = h * 0.8;
  const tw = w * 0.28;
  const th = h * 0.36;
  const br = h * 0.11;
  const ballX0 = w * 0.62;
  const startFront = tw + w * 0.05; // whole trolley in view when the panel opens
  const V = (ballX0 - br - startFront) / Math.max(1, bump - at); // px per frame before the bump
  const dt = frame - bump;
  // Trolley front edge position.
  const front = dt < 0 ? ballX0 - br + dt * V : ballX0 - br + dt * TROLLEY_K * V;
  const ballX = dt < 0 ? ballX0 : ballX0 + dt * BALL_K * V;
  const spin = dt < 0 ? 0 : (dt * BALL_K * V) / br;
  const wheelSpin = (front / (th * 0.18)) * (180 / Math.PI);
  const clipId = `trolley-clip-${Math.round(x)}-${Math.round(y)}`;
  const A = w * 0.15; // arrow length for the trolley's speed at the hit
  const flash = dt >= 0 && dt < 6 ? 1 - dt / 6 : 0;
  const tArrowY = trackY - th * 1.18 - 44;
  const hitFront = ballX0 - br;
  const tArrowX = (dt < 0 ? front : hitFront) - tw * 0.5 - A / 2;
  const solidT = dt < 0 ? 1 : 1 - clamp01(dt / 6);
  const dashedT = dt < 0 ? 0 : clamp01(dt / 4) * 0.85;
  return (
    <g
      transform={`translate(${x + w / 2} ${y + h / 2}) scale(${s}) translate(${-w / 2} ${-h / 2})`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect width={w} height={h} rx={34} />
        </clipPath>
      </defs>
      <rect width={w} height={h} rx={34} fill={XRAY.grid} />
      <g clipPath={`url(#${clipId})`}>
        {/* Track. */}
        <rect
          x={-10}
          y={trackY}
          width={w + 20}
          height={8}
          rx={4}
          fill={XRAY.tissue}
          opacity={0.8}
        />
        {Array.from({ length: 14 }, (_, i) => (
          <rect
            key={i}
            x={(((i * w) / 12 + w) % (w + 40)) - 20}
            y={trackY + 16}
            width={w / 30}
            height={5}
            rx={2.5}
            fill={XRAY.tissue}
            opacity={0.35}
          />
        ))}
        {/* Trolley. */}
        <g transform={`translate(${front - tw} ${trackY - th - th * 0.18})`}>
          <rect width={tw} height={th} rx={th * 0.2} fill={PITCH.teal} />
          <rect
            x={tw * 0.08}
            y={th * 0.12}
            width={tw * 0.84}
            height={th * 0.2}
            rx={th * 0.1}
            fill="#FFFFFF"
            opacity={0.25}
          />
          <text
            x={tw / 2}
            y={th * 0.72}
            fill={XRAY.bg}
            fontFamily={FONTS.title}
            fontWeight={800}
            fontSize={Math.max(32, th * 0.4)}
            textAnchor="middle"
          >
            LEG
          </text>
          {[0.24, 0.76].map((u, i) => (
            <g
              key={i}
              transform={`translate(${tw * u} ${th + th * 0.02}) rotate(${wheelSpin})`}
            >
              <circle r={th * 0.18} fill={XRAY.bg} />
              <circle r={th * 0.07} fill={XRAY.bone} />
              <rect
                x={-th * 0.02}
                y={-th * 0.16}
                width={th * 0.04}
                height={th * 0.1}
                fill={XRAY.bone}
              />
            </g>
          ))}
          {/* Weight badge on the corner. */}
          <g
            transform={`translate(${tw * 0.92} ${th * 0.02}) rotate(8) scale(${
              pulseAt !== undefined && frame >= pulseAt
                ? 1 + 0.4 * Math.sin(Math.PI * clamp01((frame - pulseAt) / 16))
                : 1
            })`}
          >
            <rect
              x={-44}
              y={-24}
              width={88}
              height={48}
              rx={24}
              fill={XRAY.bone}
            />
            <text
              y={12}
              fill={XRAY.bg}
              fontFamily={FONTS.hud}
              fontWeight={700}
              fontSize={32}
              textAnchor="middle"
            >
              ×4
            </text>
          </g>
        </g>
        {/* Ball. */}
        <g
          transform={`translate(${ballX} ${trackY - br}) rotate(${(spin * 180) / Math.PI})`}
        >
          <circle r={br} fill={CAST.ballShade} />
          <circle
            cx={-br * 0.12}
            cy={-br * 0.12}
            r={br * 0.9}
            fill={CAST.ball}
          />
          <line
            x1={-br * 0.9}
            y1={0}
            x2={br * 0.9}
            y2={0}
            stroke={PITCH.chalk}
            strokeWidth={br * 0.16}
            strokeLinecap="round"
          />
        </g>
        {flash > 0 ? (
          <g
            opacity={flash}
            stroke={XRAY.bone}
            strokeWidth={5}
            strokeLinecap="round"
          >
            {[-50, -20, 20, 50].map((a, i) => {
              const rad = (a * Math.PI) / 180;
              const cx = ballX0 - br;
              const cy = trackY - br;
              return (
                <line
                  key={i}
                  x1={cx + Math.cos(rad) * br * 1.3}
                  y1={cy + Math.sin(rad) * br * 1.3}
                  x2={cx + Math.cos(rad) * br * 2}
                  y2={cy + Math.sin(rad) * br * 2}
                />
              );
            })}
          </g>
        ) : null}
        {/* Speed arrows (length = speed). The trolley's arrow stays as a dashed outline after the hit. */}
        <FlatArrow x={tArrowX} y={tArrowY} len={A} color={PITCH.teal} width={12} opacity={solidT} />
        <FlatArrow x={tArrowX} y={tArrowY} len={A} color={PITCH.teal} width={12} opacity={dashedT} outline />
        <FlatArrow
          x={ballX - br * 0.3}
          y={trackY - br * 2 - 30}
          len={A * BALL_K * clamp01(dt / 4)}
          color={CAST.ball}
          width={12}
          opacity={clamp01(dt / 3)}
        />
      </g>
    </g>
  );
};

/** Orange puffs that escape from a point and fade (energy leaking away). */
export const LeakPuffs: React.FC<{
  x: number;
  y: number;
  at: number;
  size?: number;
  seed?: string;
  count?: number;
  dir?: number;
}> = ({ x, y, at, size = 40, seed = "leak", count = 7, dir = 200 }) => {
  const frame = useCurrentFrame();
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const start = at + i * 3;
        const t = (frame - start) / 34;
        if (t < 0 || t > 1) return null;
        const a =
          ((dir + (random(`${seed}-a-${i}`) - 0.5) * 110) * Math.PI) / 180;
        const e = 1 - Math.pow(1 - t, 2.2);
        const dist = size * (1.2 + random(`${seed}-d-${i}`) * 1.6) * e;
        const r =
          size * (0.22 + random(`${seed}-r-${i}`) * 0.2) * (0.6 + 0.8 * t);
        return (
          <g key={i} opacity={t < 0.5 ? 1 : (1 - t) * 2}>
            <circle
              cx={x + Math.cos(a) * dist}
              cy={y + Math.sin(a) * dist - t * size * 0.6}
              r={r}
              fill={CAST.ball}
            />
            <circle
              cx={x + Math.cos(a) * dist - r * 0.25}
              cy={y + Math.sin(a) * dist - t * size * 0.6 - r * 0.25}
              r={r * 0.45}
              fill={CAST.ballRim}
              opacity={0.7}
            />
          </g>
        );
      })}
    </g>
  );
};

/**
 * The x-ray lower leg that turns into a real hammer (morph 0..1): the shin becomes the handle and the
 * foot becomes the head. The head sits across the end of the handle (at the ankle) with its flat striking
 * face towards the ball, and a wedge on the back. With morph 0 it draws the plain x-ray leg.
 * - kind "loose": the head hangs on a pink hinge pin; flop (degrees) tips the face down on the pin.
 * - kind "solid": the head is fixed to the handle by a lime collar.
 * headHalf: distance from the pin to the striking face (pixels).
 * The foot angle maps onto the head angle, so the morph turns the foot into the head:
 * head tilt = nearAnkle - 90 (0 = square across the handle, 60 = the foot with its toes down).
 */
export const HammerLeg: React.FC<{
  x: number;
  y: number;
  h: number;
  pose: Pose;
  morph: number;
  hinge: number;
  kind?: "loose" | "solid";
  flop?: number;
  headHalf?: number;
  /** 0..1 clean-hit flash on the face. */
  flash?: number;
}> = ({ x, y, h, pose, morph, hinge, kind = "loose", flop = 0, headHalf, flash = 0 }) => {
  const j = solve(pose, h);
  const T = (p: P) => ({ x: x + p.x, y: y + p.y });
  const hip = T(j.hip);
  const knee = T(j.nk);
  const ankle = T(j.na);
  const toe = T(j.nToe);
  const w = h * 0.03;
  const m = clamp01(morph);
  const tissue = (a: P, b: P, width: number, key: string, op = 0.55) =>
    op <= 0.001 ? null : (
      <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={XRAY.tissue} strokeWidth={width} strokeLinecap="round" opacity={op} />
    );
  const bone = (a: P, b: P, width: number, key: string, op = 1) =>
    op <= 0.001 ? null : (
      <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={XRAY.bone} strokeWidth={width} strokeLinecap="round" opacity={op} />
    );
  const mid = { x: (ankle.x + toe.x) / 2, y: (ankle.y + toe.y) / 2 };
  // Handle frame: hd along the shin (knee -> ankle), pf square to it, towards the front.
  const sl = Math.hypot(ankle.x - knee.x, ankle.y - knee.y) || 1;
  const hd = { x: (ankle.x - knee.x) / sl, y: (ankle.y - knee.y) / sl };
  const pf = { x: hd.y, y: -hd.x };
  const L = headHalf ?? h * 0.105;
  const TH = L * 1.2; // head thickness
  const LB = L * 1.3; // the back of the head (behind the pin) is longer than the face side, like a claw hammer
  const footTilt = pose.nearAnkle - 90;
  const e = m * m * (3 - 2 * m);
  const tilt = footTilt + (flop - footTilt) * e;
  const tr = (tilt * Math.PI) / 180;
  const ax = { x: Math.cos(tr) * pf.x + Math.sin(tr) * hd.x, y: Math.cos(tr) * pf.y + Math.sin(tr) * hd.y };
  const ang = (Math.atan2(ax.y, ax.x) * 180) / Math.PI;
  const headIn = clamp01(m * 1.7);
  const headScale = 0.62 + 0.38 * e;
  const handleW = w * (1 + 0.45 * e);
  const face = { x: ankle.x + ax.x * L * headScale, y: ankle.y + ax.y * L * headScale };
  return (
    <g>
      {tissue(hip, knee, h * 0.11, "t")}
      {tissue(knee, ankle, h * 0.09, "s", 0.55 * (1 - m))}
      {tissue(ankle, toe, h * 0.075, "f", 0.55 * (1 - m))}
      {bone(hip, knee, w * 1.2, "b1")}
      {bone(knee, ankle, w, "b2", 1 - m)}
      {bone(ankle, mid, w * 0.9, "b3", 1 - m)}
      {bone(mid, toe, w * 0.7, "b4", 1 - m)}
      {/* Handle (the shin), with a grip near the knee end. */}
      {m > 0.001 ? (
        <g opacity={m}>
          <line x1={knee.x} y1={knee.y} x2={ankle.x} y2={ankle.y} stroke={XRAY.tissue} strokeWidth={handleW} strokeLinecap="round" />
          <line
            x1={knee.x + (hd.x - pf.x * 0.22) * handleW * 0.6}
            y1={knee.y + (hd.y - pf.y * 0.22) * handleW * 0.6}
            x2={ankle.x - (hd.x + pf.x * 0.22) * handleW * 1.2}
            y2={ankle.y - (hd.y + pf.y * 0.22) * handleW * 1.2}
            stroke={XRAY.bone}
            strokeWidth={handleW * 0.2}
            strokeLinecap="round"
            opacity={0.4}
          />
          {[0.1, 0.18, 0.26].map((t, i) => {
            const c = { x: knee.x + (ankle.x - knee.x) * t, y: knee.y + (ankle.y - knee.y) * t };
            return (
              <line
                key={i}
                x1={c.x + pf.x * handleW * 0.5}
                y1={c.y + pf.y * handleW * 0.5}
                x2={c.x - pf.x * handleW * 0.5}
                y2={c.y - pf.y * handleW * 0.5}
                stroke={XRAY.bg}
                strokeWidth={handleW * 0.14}
                strokeLinecap="round"
                opacity={0.45}
              />
            );
          })}
        </g>
      ) : null}
      <circle cx={hip.x} cy={hip.y} r={w * 1.3} fill={XRAY.bone} />
      <circle cx={knee.x} cy={knee.y} r={w * 1.15} fill={XRAY.bone} />
      {/* Hammer head: body, striking face at the front, wedge at the back. */}
      {headIn > 0.001 ? (
        <g transform={`translate(${ankle.x} ${ankle.y}) rotate(${ang}) scale(${headScale})`} opacity={headIn}>
          {/* Claw at the back, curving towards the handle. */}
          <path
            d={`M${-LB + TH * 0.2},${TH * 0.42} Q${-LB - L * 0.62},${TH * 0.42} ${-LB - L * 0.9},${-TH * 0.62} Q${-LB - L * 0.42},${-TH * 0.12} ${-LB + TH * 0.2},${-TH * 0.3} Z`}
            fill={XRAY.bone}
            stroke={XRAY.bone}
            strokeWidth={TH * 0.06}
            strokeLinejoin="round"
          />
          {/* Body, then a slim neck and the wide striking face. */}
          <rect x={-LB} y={-TH * 0.42} width={LB + L * 0.5} height={TH * 0.84} rx={TH * 0.16} fill={XRAY.bone} />
          <rect x={L * 0.4} y={-TH * 0.34} width={L * 0.4} height={TH * 0.68} fill={XRAY.bone} />
          <rect x={L * 0.72} y={-TH * 0.56} width={L * 0.28} height={TH * 1.12} rx={TH * 0.12} fill={XRAY.bone} />
          <rect x={L * 0.72} y={-TH * 0.56} width={L * 0.28} height={TH * 1.12} rx={TH * 0.12} fill={XRAY.tissue} opacity={0.3} />
          <rect x={-LB + TH * 0.12} y={-TH * 0.34} width={LB + L * 0.2} height={TH * 0.14} rx={TH * 0.07} fill="#FFFFFF" opacity={0.55} />
          <rect x={-LB + TH * 0.12} y={TH * 0.18} width={LB + L * 0.2} height={TH * 0.12} rx={TH * 0.06} fill={XRAY.tissue} opacity={0.35} />
        </g>
      ) : null}
      {/* The pin: a pink hinge (loose) or a lime collar (solid). */}
      {kind === "solid" && m > 0.001 ? (
        <g opacity={m}>
          <line
            x1={ankle.x - hd.x * (TH * 0.42 * headScale + handleW * 0.3) + pf.x * handleW * 0.62}
            y1={ankle.y - hd.y * (TH * 0.42 * headScale + handleW * 0.3) + pf.y * handleW * 0.62}
            x2={ankle.x - hd.x * (TH * 0.42 * headScale + handleW * 0.3) - pf.x * handleW * 0.62}
            y2={ankle.y - hd.y * (TH * 0.42 * headScale + handleW * 0.3) - pf.y * handleW * 0.62}
            stroke={XRAY.lime}
            strokeWidth={handleW * 0.4}
            strokeLinecap="round"
          />
          <circle cx={ankle.x} cy={ankle.y} r={w * 0.42} fill={XRAY.lime} />
        </g>
      ) : (
        <circle cx={ankle.x} cy={ankle.y} r={w * 1.05} fill={XRAY.bone} opacity={1 - m} />
      )}
      {kind === "loose" && hinge > 0.001 ? (
        <g opacity={hinge} transform={`translate(${ankle.x} ${ankle.y}) scale(${0.6 + 0.4 * hinge})`}>
          <circle r={w * 0.9} fill="none" stroke={XRAY.pink} strokeWidth={w * 0.3} />
          <circle r={w * 0.46} fill={XRAY.pink} />
          <circle r={w * 0.18} fill={XRAY.bg} />
        </g>
      ) : null}
      {/* Clean hit: a short lime burst at the face. */}
      {flash > 0.001 ? (
        <g opacity={flash} stroke={XRAY.lime} strokeWidth={w * 0.5} strokeLinecap="round">
          {[-60, -30, 0, 30, 60].map((a, i) => {
            const r = ((ang + a) * Math.PI) / 180;
            const r0 = TH * 0.7 + (1 - flash) * TH * 0.5;
            return (
              <line
                key={i}
                x1={face.x + Math.cos(r) * r0}
                y1={face.y + Math.sin(r) * r0}
                x2={face.x + Math.cos(r) * (r0 + TH * 0.55)}
                y2={face.y + Math.sin(r) * (r0 + TH * 0.55)}
              />
            );
          })}
        </g>
      ) : null}
    </g>
  );
};

/** Point on the foot axis (s = 0 at the ankle, 1 at the toe) and the front normal, for a pose drawn at (x, y). */
export const footFrame = (pose: Pose, h: number, x: number, y: number) => {
  const j = solve(pose, h);
  const ankle = { x: x + j.na.x, y: y + j.na.y };
  const toe = { x: x + j.nToe.x, y: y + j.nToe.y };
  const L = Math.hypot(toe.x - ankle.x, toe.y - ankle.y) || 1;
  const d = { x: (toe.x - ankle.x) / L, y: (toe.y - ankle.y) / L };
  const n = { x: d.y, y: -d.x };
  const at = (sAlong: number) => ({
    x: ankle.x + d.x * L * sAlong,
    y: ankle.y + d.y * L * sAlong,
  });
  return {
    ankle,
    toe,
    knee: { x: x + j.nk.x, y: y + j.nk.y },
    hip: { x, y },
    L,
    d,
    n,
    at,
    t: h * 0.0375,
  };
};

/** Horizontal speed bar: fills to 1, then can drop to `value` with the lost part shown in pink. */
export const SpeedBar: React.FC<{
  x: number;
  y: number;
  w: number;
  at: number;
  dropAt: number;
  value: number;
  caption: string;
  dropLabel: string;
  until?: number;
}> = ({ x, y, w, at, dropAt, value, caption, dropLabel, until }) => {
  const frame = useCurrentFrame();
  const o =
    progress(frame, at, 12, EASE.enter) *
    (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (o <= 0.001) return null;
  const fill = progress(frame, at + 4, 18, EASE.standard);
  const drop = progress(frame, dropAt, 16, EASE.standard);
  const cur = fill * (1 - (1 - value) * drop);
  const h = 44;
  const lostOp = drop * (1 - 0.5 * progress(frame, dropAt + 16, 20, EASE.soft));
  const lab = popSoft(frame, dropAt + 6);
  return (
    <g opacity={o} transform={`translate(${x} ${y})`}>
      <text
        x={0}
        y={-24}
        fill={XRAY.bone}
        fontFamily={FONTS.hud}
        fontWeight={700}
        fontSize={34}
        letterSpacing={3}
      >
        {caption}
      </text>
      <rect x={0} y={0} width={w} height={h} rx={h / 2} fill={XRAY.grid} />
      {drop > 0 ? (
        <rect
          x={w * value}
          y={0}
          width={w * (1 - value)}
          height={h}
          rx={h / 2}
          fill="none"
          stroke={XRAY.pink}
          strokeWidth={4}
          strokeDasharray="10 8"
          opacity={lostOp}
        />
      ) : null}
      <rect
        x={0}
        y={0}
        width={Math.max(h, w * cur)}
        height={h}
        rx={h / 2}
        fill={XRAY.lime}
        opacity={fill > 0 ? 1 : 0}
      />
      {lab > 0.001 ? (
        <g
          transform={`translate(${(w * (1 + value)) / 2} ${h + 52}) scale(${lab})`}
        >
          <rect
            x={-150}
            y={-30}
            width={300}
            height={60}
            rx={30}
            fill={XRAY.pink}
          />
          <text
            y={12}
            fill={XRAY.bg}
            fontFamily={FONTS.label}
            fontWeight={800}
            fontSize={34}
            textAnchor="middle"
          >
            {dropLabel}
          </text>
        </g>
      ) : null}
    </g>
  );
};

/** Screen position of a flight in a view at a frame (clamped to the path). */
const flightAt = (path: BallState[], view: View, at: number, frame: number) =>
  project(sampleAt(path, Math.max(0, frame - at)).pos, view);

/**
 * Floodlit inset from behind the kicker: a slow shot (solid ball) is caught by Chalk's diving mitten,
 * and a full-speed ghost (dashed) goes past the same spot earlier, into the net.
 */
export const SaveInset: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  at: number;
  until: number;
  kick: number;
  slow: BallState[];
  fast: BallState[];
  goalX: number;
  keeperPose: KeeperPose;
  keeperFace: KeeperFace;
  keeperLook: number;
  catchFrame: number;
  lineNormal?: { x: number; y: number; z: number };
}> = ({
  x,
  y,
  w,
  h,
  at,
  until,
  kick,
  slow,
  fast,
  goalX,
  keeperPose,
  keeperFace,
  keeperLook,
  catchFrame,
  lineNormal,
}) => {
  const frame = useCurrentFrame();
  const s =
    pop(frame, at, { stiffness: 170, damping: 15 }) *
    (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const view: View = {
    kind: "persp",
    cam: { x: -1, y: 0, z: 1.5 },
    yawDeg: 0,
    pitchDeg: -3,
    focal: w * 1.85,
    cx: w / 2,
    cy: h * 0.5,
  };
  const kp = project({ x: goalX, y: 0, z: 0 }, view);
  const horizon = project({ x: 400, y: 0, z: 0 }, view).y;
  const clipId = `save-inset-${Math.round(x)}-${Math.round(y)}`;
  // Ghost (full speed): stops at the back of the net.
  const fastEnd = fast.findIndex((q) => q.pos.x >= goalX + 1.6);
  const fastF = Math.min(frame - kick, fastEnd > 0 ? fastEnd : fast.length - 1);
  const ghostOn =
    frame >= kick
      ? 1 - progress(frame, kick + (fastEnd > 0 ? fastEnd : 40) + 6, 10)
      : 0;
  const gp = flightAt(fast, view, 0, fastF);
  const gr = Math.max(9, 0.11 * gp.scale);
  const ghostTrail = fast
    .slice(0, Math.max(1, Math.floor(Math.max(0, fastF)) + 1))
    .map((q) => project(q.pos, view));
  // Slow ball: caught at the crossing frame.
  const sf = Math.min(frame, catchFrame) - kick;
  const bs = sampleAt(slow, Math.max(0, sf));
  const bp = project(bs.pos, view);
  const br = Math.max(9, 0.11 * bp.scale);
  const slowTrail = slow
    .slice(0, Math.max(1, Math.floor(Math.max(0, sf)) + 1))
    .map((q) => project(q.pos, view));
  const slap =
    frame >= catchFrame && frame < catchFrame + 14
      ? 1 - (frame - catchFrame) / 14
      : 0;
  const netShake =
    frame >= kick + fastEnd && fastEnd > 0
      ? Math.exp(-(frame - kick - fastEnd) / 6) *
        Math.sin((frame - kick - fastEnd) * 1.6) *
        4
      : 0;
  const path = (pts: P[]) =>
    pts.length > 1
      ? `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}`
      : "";
  const stripes = [];
  for (let i = 0; i < 12; i++) {
    const x0 = 6 + i * 3;
    const a = project({ x: x0, y: 30, z: 0 }, view);
    const b = project({ x: x0 + 1.5, y: 30, z: 0 }, view);
    const c = project({ x: x0 + 1.5, y: -30, z: 0 }, view);
    const d = project({ x: x0, y: -30, z: 0 }, view);
    stripes.push(
      <path
        key={i}
        d={`M${a.x},${a.y} L${b.x},${b.y} L${c.x},${c.y} L${d.x},${d.y} Z`}
        fill={PITCH.grass}
      />,
    );
  }
  return (
    <g
      transform={`translate(${x + w / 2} ${y + h / 2}) scale(${s}) translate(${-w / 2} ${-h / 2})`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect width={w} height={h} rx={36} />
        </clipPath>
        <linearGradient id={`${clipId}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PITCH.skyHigh} />
          <stop offset="1" stopColor={PITCH.sky} />
        </linearGradient>
      </defs>
      <rect
        x={-8}
        y={-8}
        width={w + 16}
        height={h + 16}
        rx={42}
        fill={PITCH.chalk}
      />
      <g clipPath={`url(#${clipId})`}>
        <rect width={w} height={h} fill={`url(#${clipId}-sky)`} />
        {/* Stands and lamps behind the goal. */}
        <rect
          x={-10}
          y={horizon - h * 0.2}
          width={w + 20}
          height={h * 0.2 + 4}
          rx={12}
          fill={PITCH.stands}
        />
        <rect
          x={-10}
          y={horizon - h * 0.2}
          width={w + 20}
          height={14}
          rx={7}
          fill={PITCH.standsLight}
        />
        {[0.12, 0.88].map((u, i) => (
          <g key={i}>
            <rect
              x={w * u - 3}
              y={horizon - h * 0.36}
              width={6}
              height={h * 0.16}
              fill={PITCH.standsLight}
            />
            <rect
              x={w * u - 34}
              y={horizon - h * 0.42}
              width={68}
              height={40}
              rx={12}
              fill={PITCH.lightSoft}
            />
            <Glow
              cx={w * u}
              cy={horizon - h * 0.4}
              r={90}
              color={PITCH.lightSoft}
              intensity={1}
              rings={4}
            />
          </g>
        ))}
        <rect
          x={-10}
          y={horizon}
          width={w + 20}
          height={h}
          fill={PITCH.grassDark}
        />
        {stripes}
        <g transform={`translate(0 ${netShake})`}>
          <GoalFront view={view} goalX={goalX} netOpacity={0.45} />
        </g>
        <Keeper
          x={kp.x}
          groundY={kp.y}
          h={2.1 * kp.scale}
          pose={keeperPose}
          face={keeperFace}
          look={keeperLook}
        />
        {/* Ghost: the full-speed laces drive. */}
        {ghostOn > 0.001 ? (
          <g opacity={ghostOn}>
            <path
              d={path(ghostTrail)}
              fill="none"
              stroke={PITCH.chalk}
              strokeWidth={3}
              strokeDasharray="4 10"
              strokeLinecap="round"
              opacity={0.6}
            />
            <circle
              cx={gp.x}
              cy={gp.y}
              r={gr}
              fill="none"
              stroke={PITCH.chalk}
              strokeWidth={3}
              strokeDasharray="5 5"
              opacity={0.75}
            />
          </g>
        ) : null}
        {/* The toe hit. */}
        {frame >= kick ? (
          <g>
            <path
              d={path(slowTrail)}
              fill="none"
              stroke={PITCH.lightSoft}
              strokeWidth={Math.max(3, br * 0.3)}
              strokeLinecap="round"
              opacity={0.45}
            />
            <Ball
              cx={bp.x}
              cy={bp.y}
              r={br}
              view={view}
              axis={bs.spin}
              angle={spinAngleAt(slow, Math.max(0, sf))}
              lineNormal={lineNormal}
            />
          </g>
        ) : null}
        {slap > 0 ? (
          <g
            opacity={slap}
            stroke={PITCH.chalk}
            strokeWidth={4}
            strokeLinecap="round"
          >
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const a = (i / 8) * Math.PI * 2;
              const r0 = br * 1.6 + (1 - slap) * 16;
              return (
                <line
                  key={i}
                  x1={bp.x + Math.cos(a) * r0}
                  y1={bp.y + Math.sin(a) * r0}
                  x2={bp.x + Math.cos(a) * (r0 + 14)}
                  y2={bp.y + Math.sin(a) * (r0 + 14)}
                />
              );
            })}
          </g>
        ) : null}
      </g>
    </g>
  );
};

/**
 * A pill label like the kit Label, but sized for UPPERCASE text (the kit Label estimates
 * 0.56 x size per character, which is too narrow for heavy capitals, so the text spills out).
 */
export const Pill: React.FC<{
  x: number;
  y: number;
  text: string;
  at: number;
  until?: number;
  color?: string;
  bg?: string;
  size?: number;
  anchor?: "start" | "middle" | "end";
  charW?: number;
}> = ({
  x,
  y,
  text,
  at,
  until,
  color = PITCH.sky,
  bg = PITCH.chalk,
  size = 40,
  anchor = "middle",
  charW = 0.7,
}) => {
  const frame = useCurrentFrame();
  const sc =
    popSoft(frame, at) *
    (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (sc <= 0.001) return null;
  const w = text.length * size * charW + size * 1.2;
  const h = size * 1.55;
  const ox = anchor === "middle" ? -w / 2 : anchor === "end" ? -w : 0;
  return (
    <g transform={`translate(${x} ${y}) scale(${sc})`}>
      <rect x={ox} y={-h / 2} width={w} height={h} rx={h / 2} fill={bg} />
      <text
        x={ox + w / 2}
        y={size * 0.35}
        fill={color}
        fontFamily={FONTS.label}
        fontWeight={800}
        fontSize={size}
        textAnchor="middle"
      >
        {text}
      </text>
    </g>
  );
};
