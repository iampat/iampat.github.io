// Parts for b04 (what a scan is) and b05 (too late): a head-turn pulse, a two-line word card, a mono
// seconds readout with a population caption, the eyes inset, a round close-up inset, an edge marker, a
// "sped up" tag, a grey ghost token for the pro timeline, a small polaroid that flips over to an X-ray back,
// the top-down X-ray body (head on centred shoulders, both feet in front), the two reaction dials, a ruler
// measured from the ball, Chalk's glove position, and the kerb crossing.
import React from "react";
import { useCurrentFrame } from "remotion";
import { CAST, FONTS, PITCH, XRAY } from "../../theme";
import { EASE, clamp01, pop, progress, visible } from "../../lib/anim";
import { popT, quad, segment } from "../ep2";
import type { KeeperPose } from "../Keeper";

/** 0 -> 1 -> 0 over `dur` frames from `start`: a head turns out and comes back. */
export const turnPulse = (frame: number, start: number, dur = 12) => {
  const t = (frame - start) / dur;
  if (t <= 0 || t >= 1) return 0;
  return Math.sin(Math.PI * t);
};

/** Linear easing for stopwatches and jogs (a clock does not ease). */
export const lin = (t: number) => t;

/**
 * Word card with a meaning split over several lines. Same look as the kit WordCard (chalk card, orange
 * NEW WORD pill, term, meaning) but it scales around its top-left corner and wraps the meaning, so the
 * long b04 meaning stays on screen.
 */
export const WordCardWide: React.FC<{ term: string; lines: string[]; at: number; until: number; x?: number; y?: number }> = ({ term, lines, at, until, x = 60, y = 70 }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const longest = Math.max(term.length * 36, ...lines.map((l) => l.length * 18.2), 260);
  const w = longest + 90;
  const h = 150 + lines.length * 44;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect width={w} height={h} rx={28} fill={PITCH.chalk} />
      <rect x={24} y={22} width={210} height={42} rx={21} fill={PITCH.accent} />
      <text x={129} y={52} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={26} textAnchor="middle" letterSpacing={3}>
        NEW WORD
      </text>
      <text x={24} y={124} fill={PITCH.sky} fontFamily={FONTS.title} fontWeight={800} fontSize={56}>
        {term}
      </text>
      {lines.map((l, i) => (
        <text key={i} x={24} y={172 + i * 44} fill={PITCH.stands} fontFamily={FONTS.label} fontWeight={700} fontSize={34}>
          {l}
        </text>
      ))}
    </g>
  );
};

/** A mono stopwatch readout ("0.27 s") with a small population caption under it. */
export const SecondsReadout: React.FC<{ x: number; y: number; seconds: number; caption?: string; at: number; until?: number; size?: number; color?: string }> = ({
  x,
  y,
  seconds,
  caption,
  at,
  until,
  size = 64,
  color = PITCH.light,
}) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until);
  if (o <= 0.001) return null;
  const text = `${seconds.toFixed(2)} s`;
  const w = text.length * size * 0.62 + size * 0.9;
  const capW = caption ? caption.length * 17 + 40 : 0;
  return (
    <g opacity={o} transform={`translate(${x} ${y})`}>
      <rect x={-w / 2} y={-size * 0.78} width={w} height={size * 1.3} rx={size * 0.65} fill={PITCH.sky} opacity={0.9} />
      <text y={size * 0.34} fill={color} fontFamily={FONTS.mono} fontWeight={500} fontSize={size} textAnchor="middle">
        {text}
      </text>
      {caption ? (
        <g>
          <rect x={-capW / 2} y={size * 1.35 - 32} width={capW} height={46} rx={23} fill={PITCH.sky} opacity={0.8} />
          <text y={size * 1.35} fill={PITCH.chalk} opacity={0.9} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle" letterSpacing={1}>
            {caption}
          </text>
        </g>
      ) : null}
    </g>
  );
};

/** A thin dashed leader from a point to a target, with a small ring on the target. */
const Leader: React.FC<{ x1: number; y1: number; x2: number; y2: number; ring: number; opacity: number }> = ({ x1, y1, x2, y2, ring, opacity }) => {
  const d = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ex = x2 - ((x2 - x1) / d) * ring;
  const ey = y2 - ((y2 - y1) / d) * ring;
  return (
    <g opacity={opacity}>
      <line x1={x1} y1={y1} x2={ex} y2={ey} stroke={PITCH.chalk} strokeWidth={3} strokeDasharray="9 8" strokeLinecap="round" opacity={0.75} />
      <circle cx={x2} cy={y2} r={ring} fill="none" stroke={PITCH.chalk} strokeWidth={3} opacity={0.8} />
    </g>
  );
};

/**
 * Close inset of a pair of eyes on an opaque card. The pupils sweep to one side and back over `sweepDur`
 * frames from `sweepAt`, with ghost pupils trailing behind (a streak without a blur filter). `leader` draws
 * a thin line from the card to a screen point (her head) so the eyes read as hers.
 */
export const EyesInset: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  at: number;
  until: number;
  sweepAt: number;
  sweepDur?: number;
  dir?: 1 | -1;
  leader?: { x: number; y: number; r: number };
}> = ({ x, y, w, h, at, until, sweepAt, sweepDur = 12, dir = 1, leader }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 170, damping: 15 }) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const eyeRy = h * 0.2;
  const eyeRx = h * 0.31;
  const pupilR = h * 0.09;
  const travel = eyeRx * 0.55;
  const sweep = (f: number) => turnPulse(f, sweepAt, sweepDur) * travel * dir;
  const now = sweep(frame);
  const moving = Math.abs(sweep(frame) - sweep(frame - 1)) > 0.5;
  const eyes = [0.31, 0.69].map((t) => w * t);
  return (
    <g>
      {leader ? <Leader x1={x + (w * s) / 2} y1={y + h * s} x2={leader.x} y2={leader.y} ring={leader.r} opacity={clamp01(s)} /> : null}
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <rect width={w} height={h} rx={h * 0.22} fill={PITCH.skyHigh} />
        <rect width={w} height={h} rx={h * 0.22} fill={PITCH.sky} opacity={0.92} />
        <rect width={w} height={h} rx={h * 0.22} fill="none" stroke={PITCH.chalk} strokeWidth={4} opacity={0.6} />
        {eyes.map((ex, i) => (
          <g key={i} transform={`translate(${ex} ${h * 0.52})`}>
            <ellipse rx={eyeRx} ry={eyeRy} fill={PITCH.chalk} />
            {/* Ghost pupils: where the pupil was one to five frames ago (the streak). */}
            {moving
              ? [1, 2, 3, 4, 5].map((k) => <circle key={k} cx={sweep(frame - k)} r={pupilR * (1 - k * 0.09)} fill={PITCH.sky} opacity={0.5 - k * 0.09} />)
              : null}
            <circle cx={now} r={pupilR} fill={PITCH.sky} />
            <circle cx={now + pupilR * 0.35} cy={-pupilR * 0.35} r={pupilR * 0.28} fill={PITCH.chalk} opacity={0.8} />
            {/* Upper lid. */}
            <path d={`M${-eyeRx},0 A${eyeRx},${eyeRy} 0 0 1 ${eyeRx},0`} fill={PITCH.sky} opacity={0.35} />
          </g>
        ))}
      </g>
    </g>
  );
};

/**
 * A round close-up inset. `children` draw in world coordinates; the inset shows them around `focus`
 * scaled by `k`, clipped to a circle of radius `r` at (cx, cy). `leader` points at the same spot in the
 * main view. `id` must be unique in the frame.
 */
export const RoundInset: React.FC<{
  id: string;
  cx: number;
  cy: number;
  r: number;
  at: number;
  until: number;
  focus: { x: number; y: number };
  k: number;
  leader?: { x: number; y: number; r: number };
  bg?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ id, cx, cy, r, at, until, focus, k, leader, bg, children }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 170, damping: 15 }) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  let l: React.ReactNode = null;
  if (leader) {
    const d = Math.hypot(leader.x - cx, leader.y - cy) || 1;
    l = <Leader x1={cx + ((leader.x - cx) / d) * (r + 8) * s} y1={cy + ((leader.y - cy) / d) * (r + 8) * s} x2={leader.x} y2={leader.y} ring={leader.r} opacity={clamp01(s)} />;
  }
  return (
    <g>
      {l}
      <g transform={`translate(${cx} ${cy}) scale(${s})`}>
        <defs>
          <clipPath id={id}>
            <circle r={r} />
          </clipPath>
        </defs>
        <circle r={r + 8} fill={PITCH.chalk} />
        <g clipPath={`url(#${id})`}>
          <rect x={-r} y={-r} width={2 * r} height={2 * r} fill={PITCH.sky} />
          {bg}
          <g transform={`scale(${k}) translate(${-focus.x} ${-focus.y})`}>{children}</g>
        </g>
      </g>
    </g>
  );
};

/** A pill at the left frame edge that says what is just out of shot, with an arrow (and a small ball) pointing at it. */
export const EdgeMarker: React.FC<{ x: number; y: number; text: string; at: number; until?: number; ball?: boolean }> = ({ x, y, text, at, until, ball = false }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until, 10, 8);
  if (o <= 0.001) return null;
  const size = 34;
  const textW = text.length * size * 0.56;
  const icon = ball ? 44 : 0;
  const w = 64 + icon + textW + 30;
  const h = 62;
  const slide = (1 - o) * -30;
  const nudge = 4 * Math.sin(frame / 6);
  return (
    <g opacity={o} transform={`translate(${x + slide} ${y})`}>
      <rect x={0} y={-h / 2} width={w} height={h} rx={h / 2} fill={PITCH.sky} opacity={0.9} />
      <rect x={0} y={-h / 2} width={w} height={h} rx={h / 2} fill="none" stroke={PITCH.chalk} strokeWidth={3} opacity={0.5} />
      <path d={`M${18 - nudge},0 L${44 - nudge},-15 L${44 - nudge},15 Z`} fill={PITCH.chalk} />
      {ball ? (
        <g>
          <circle cx={64 + 16} cy={0} r={15} fill={CAST.ball} />
          <circle cx={64 + 11} cy={-5} r={5} fill={CAST.ballRim} opacity={0.8} />
        </g>
      ) : null}
      <text x={64 + icon} y={size * 0.35} fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={size}>
        {text}
      </text>
    </g>
  );
};

/** A small "sped up" tag: two fast-forward triangles and a mono label on a dark pill. */
export const SpedUpTag: React.FC<{ x: number; y: number; text: string; at: number; until?: number }> = ({ x, y, text, at, until }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until, 10, 8);
  if (o <= 0.001) return null;
  const size = 30;
  const w = text.length * size * 0.62 + 96;
  const h = 54;
  const blink = 0.65 + 0.35 * Math.sin(frame / 4);
  return (
    <g opacity={o} transform={`translate(${x - w / 2} ${y})`}>
      <rect y={-h / 2} width={w} height={h} rx={h / 2} fill={PITCH.skyHigh} opacity={0.85} />
      <g fill={XRAY.lime} opacity={blink}>
        <path d="M22,-12 L38,0 L22,12 Z" />
        <path d="M38,-12 L54,0 L38,12 Z" />
      </g>
      <text x={70} y={size * 0.35} fill={PITCH.chalk} fontFamily={FONTS.mono} fontWeight={500} fontSize={size}>
        {text}
      </text>
    </g>
  );
};

/** A grey ghost of a top-down player token (a pro, no colours), same geometry as TopPlayer. */
export const GhostToken: React.FC<{ x: number; y: number; size?: number; facing?: number; look?: number; opacity?: number }> = ({ x, y, size = 64, facing = 0, look = 0, opacity = 0.85 }) => {
  const w = size;
  const h = size * 0.45;
  const headR = size * 0.27;
  const headAngle = facing + look;
  const shirt = "#8C94B8";
  const shade = "#6F779B";
  const head = "#B4BAD3";
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      <ellipse cx={size * 0.08} cy={size * 0.1} rx={w * 0.55} ry={h * 0.7} fill="#000" opacity={0.18} />
      <g transform={`rotate(${facing})`}>
        <rect x={-h / 2} y={-w / 2} width={h} height={w} rx={h / 2} fill={shirt} />
        <rect x={-h / 2} y={-w / 2} width={h * 0.45} height={w} rx={h / 2} fill={shade} opacity={0.5} />
      </g>
      <g transform={`rotate(${headAngle})`}>
        <circle r={headR} fill={head} />
        <circle cx={headR * 0.6} cy={-headR * 0.32} r={headR * 0.11} fill={PITCH.skyHigh} />
        <circle cx={headR * 0.6} cy={headR * 0.32} r={headR * 0.11} fill={PITCH.skyHigh} />
        <path d={`M${headR * 0.9},${-headR * 0.18} L${headR * 1.2},0 L${headR * 0.9},${headR * 0.18} Z`} fill={head} />
      </g>
    </g>
  );
};

/** Outer frame size of a MiniPolaroid for a photo of w x h. */
export const polaroidFrame = (w: number, h: number) => ({ W: w + 24, H: h + 24 + 26 });

/**
 * A small polaroid that pops at `at`. `flip` 0..1 turns it over (at 0.5 the back shows: the X-ray grid,
 * drawn in screen space so it lines up with XRayGrid when `scale` makes it fill the frame). `scale` grows it.
 */
export const MiniPolaroid: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  at: number;
  tilt?: number;
  flip?: number;
  scale?: number;
  children?: React.ReactNode;
}> = ({ x, y, w = 130, h = 88, at, tilt = -6, flip = 0, scale = 1, children }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 260, damping: 17 });
  if (s <= 0.001) return null;
  const fl = clamp01(flip);
  const sx = Math.cos(Math.PI * fl);
  const { W, H } = polaroidFrame(w, h);
  const k = s * scale;
  const flash = Math.max(0, 1 - (frame - at) / 5);
  if (sx < 0) {
    // The back: X-ray ink, with the grid drawn in screen coordinates and clipped to the card.
    const bw = W * k * -sx;
    const bh = H * k;
    const id = `pol-back-${Math.round(x)}-${Math.round(y)}`;
    const lines: React.ReactNode[] = [];
    const x0 = x - bw / 2;
    const y0 = y - bh / 2;
    for (let gx = Math.floor(x0 / 60) * 60; gx <= x0 + bw; gx += 60) lines.push(<line key={`x${gx}`} x1={gx} y1={y0} x2={gx} y2={y0 + bh} />);
    for (let gy = Math.floor(y0 / 60) * 60; gy <= y0 + bh; gy += 60) lines.push(<line key={`y${gy}`} x1={x0} y1={gy} x2={x0 + bw} y2={gy} />);
    return (
      <g>
        <defs>
          <clipPath id={id}>
            <rect x={x0} y={y0} width={bw} height={bh} rx={10 * k * Math.min(1, 1.2 - fl)} />
          </clipPath>
        </defs>
        <rect x={x0} y={y0} width={bw} height={bh} rx={10 * k * Math.min(1, 1.2 - fl)} fill={XRAY.bg} />
        <g clipPath={`url(#${id})`} stroke={XRAY.grid} strokeWidth={2}>
          {lines}
        </g>
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt * (1 - fl)}) scale(${k * sx} ${k})`}>
      <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={10} fill={PITCH.chalk} />
      <g transform={`translate(${-w / 2} ${-H / 2 + 12})`}>
        <rect width={w} height={h} fill={PITCH.grassDark} />
        {children}
        <rect width={w} height={h} fill="#FFFFFF" opacity={flash} />
      </g>
    </g>
  );
};

/** A tiny top-down snapshot for the pro timeline: grass, a chalk dot (the defender) and a lime patch of space. */
export const TopSnapPhoto: React.FC<{ w: number; h: number; chalk: [number, number]; space: [number, number] }> = ({ w, h, chalk, space }) => (
  <g>
    <rect width={w} height={h} fill={PITCH.grass} />
    <rect x={w * 0.33} width={w * 0.34} height={h} fill={PITCH.grassDark} opacity={0.6} />
    <line x1={0} y1={h * 0.5} x2={w} y2={h * 0.5} stroke={PITCH.chalk} strokeWidth={2} opacity={0.35} />
    <ellipse cx={w * space[0]} cy={h * space[1]} rx={w * 0.14} ry={h * 0.16} fill={XRAY.lime} opacity={0.35} />
    <circle cx={w * chalk[0] + 2} cy={h * chalk[1] + 2} r={h * 0.11} fill="#000" opacity={0.2} />
    <circle cx={w * chalk[0]} cy={h * chalk[1]} r={h * 0.11} fill={CAST.keeper} />
    <circle cx={w * 0.12} cy={h * 0.7} r={h * 0.09} fill={CAST.shirt} />
  </g>
);

// ---------------------------------------------------------------------------------------------------
// b05 parts
// ---------------------------------------------------------------------------------------------------

/**
 * Tavi from above in X-ray ink, drawn like a map token: the head sits on a wide capsule of shoulders centred
 * under it, both feet show in front. `turn` turns the skull, the nose, the ears and the eyes (not the
 * shoulders). The brain, the doors and their labels do not turn, so the labels always point at their doors.
 * `doorsIn` 0..1 pops the doors and labels. `pulse` 0..1 runs a light from the eyes to the back of the brain.
 * `facing` is the body direction (SVG degrees, -90 = up the screen). `feet` fades the feet.
 */
/** XRayTopBody foot geometry in units of the skull radius: centre (+-x, y) and the foot length and width. */
export const TOP_FOOT = { x: 0.42, y: -1.58, len: 0.66, w: 0.34 };

export const XRayTopBody: React.FC<{
  x: number;
  y: number;
  size?: number;
  turn?: number;
  pulse?: number;
  doors?: [string, string];
  lit?: [number, number];
  doorsIn?: number;
  facing?: number;
  feet?: number;
  opacity?: number;
}> = ({ x, y, size = 130, turn = 0, pulse = 0, doors = ["TURN", "PASS"], lit = [0, 0], doorsIn = 0, facing = -90, feet = 1, opacity = 1 }) => {
  const R = size;
  const w = R * 0.05;
  const turnRad = (turn * Math.PI) / 180;
  const rot = (pt: [number, number]): [number, number] => [pt[0] * Math.cos(turnRad) - pt[1] * Math.sin(turnRad), pt[0] * Math.sin(turnRad) + pt[1] * Math.cos(turnRad)];
  // The eyes sit on the front rim (a top view), not inside the circle (that reads as a face).
  const eyeL: [number, number] = [-R * 0.34, -R * 0.83];
  const eyeR: [number, number] = [R * 0.34, -R * 0.83];
  const back: [number, number] = [0, R * 0.5];
  const p = clamp01(pulse);
  const tail = 0.28;
  const flash = clamp01((p - 0.85) / 0.15);
  const pupilShift = Math.max(-1, Math.min(1, turn / 60)) * R * 0.05;
  const doorPos: [number, number][] = [
    [-R * 0.3, R * 0.34],
    [R * 0.3, R * 0.34],
  ];
  const doorW = R * 0.26;
  const doorH = R * 0.32;
  const dIn = popT(clamp01(doorsIn));
  const labelSize = Math.max(32, R * 0.25);
  const shoulderW = R * 3.8;
  const shoulderH = R * 1.6;
  const shoulderY = R * 0.12;
  const labelY = shoulderY + shoulderH / 2 + labelSize * 1.15;
  const doorColor = (l: number) => (l > 0.5 ? XRAY.lime : XRAY.bone);
  // A shoe from above: wider at the toes, narrow at the heel, a toe cap and a lace line; clear of the skull.
  const fl = R * TOP_FOOT.len;
  const fw = R * TOP_FOOT.w;
  const shoe = `M0,${-fl / 2} C${fw * 0.62},${-fl / 2} ${fw * 0.56},${-fl * 0.05} ${fw * 0.36},${fl * 0.3} Q${fw * 0.3},${fl / 2} 0,${fl / 2} Q${-fw * 0.3},${fl / 2} ${-fw * 0.36},${fl * 0.3} C${-fw * 0.56},${-fl * 0.05} ${-fw * 0.62},${-fl / 2} 0,${-fl / 2} Z`;
  const foot = (fx: number) => (
    <g key={fx} transform={`translate(${fx} ${R * TOP_FOOT.y})`}>
      <path d={shoe} fill={XRAY.tissue} opacity={0.2} />
      <path d={shoe} fill="none" stroke={XRAY.bone} strokeWidth={w * 0.8} strokeLinejoin="round" />
      <path d={`M${-fw * 0.34},${-fl * 0.22} Q0,${-fl * 0.32} ${fw * 0.34},${-fl * 0.22}`} fill="none" stroke={XRAY.bone} strokeWidth={w * 0.5} strokeLinecap="round" opacity={0.6} />
      <line x1={0} y1={-fl * 0.1} x2={0} y2={fl * 0.24} stroke={XRAY.bone} strokeWidth={w * 0.4} strokeLinecap="round" strokeDasharray={`${w * 0.5} ${w * 0.9}`} opacity={0.5} />
    </g>
  );
  const paths = [eyeL, eyeR].map((e0) => {
    const e = rot(e0);
    const c: [number, number] = [(e[0] + back[0]) * 0.3, (e[1] + back[1]) * 0.3 - R * 0.05];
    return { e, c, d: quad(e, c, back, p), path: `M${e[0]},${e[1]} Q${c[0]},${c[1]} ${back[0]},${back[1]}` };
  });
  return (
    <g transform={`translate(${x} ${y}) rotate(${facing + 90})`} opacity={opacity}>
      {/* Both feet in front (they are under the body, so they draw first). */}
      {feet > 0.01 ? <g opacity={feet}>{[-R * TOP_FOOT.x, R * TOP_FOOT.x].map(foot)}</g> : null}
      {/* Shoulders: a wide capsule centred under the head, like a map token. */}
      <rect x={-shoulderW / 2} y={shoulderY - shoulderH / 2} width={shoulderW} height={shoulderH} rx={shoulderH / 2} fill={XRAY.bg} opacity={0.7} />
      <rect x={-shoulderW / 2} y={shoulderY - shoulderH / 2} width={shoulderW} height={shoulderH} rx={shoulderH / 2} fill={XRAY.tissue} opacity={0.16} />
      <rect x={-shoulderW / 2} y={shoulderY - shoulderH / 2} width={shoulderW} height={shoulderH} rx={shoulderH / 2} fill="none" stroke={XRAY.bone} strokeWidth={w * 0.6} opacity={0.5} />
      {/* Collar bones. */}
      {[-1, 1].map((s) => (
        <path key={s} d={`M${s * R * 0.95},${shoulderY - R * 0.2} Q${s * R * 1.35},${shoulderY - R * 0.34} ${s * R * 1.72},${shoulderY - R * 0.1}`} fill="none" stroke={XRAY.bone} strokeWidth={w * 0.5} strokeLinecap="round" opacity={0.45} />
      ))}
      {/* The skull: it turns. */}
      <g transform={`rotate(${turn})`}>
        <circle r={R} fill={XRAY.bg} />
        <circle r={R} fill={XRAY.tissue} opacity={0.16} />
        <circle r={R} fill="none" stroke={XRAY.bone} strokeWidth={w} />
        <path d={`M${-R * 0.15},${-R * 0.99} Q0,${-R * 1.16} ${R * 0.15},${-R * 0.99}`} fill="none" stroke={XRAY.bone} strokeWidth={w} strokeLinecap="round" />
        <path d={`M${-R * 0.98},${-R * 0.18} Q${-R * 1.16},0 ${-R * 0.98},${R * 0.18}`} fill="none" stroke={XRAY.bone} strokeWidth={w * 0.8} strokeLinecap="round" />
        <path d={`M${R * 0.98},${-R * 0.18} Q${R * 1.16},0 ${R * 0.98},${R * 0.18}`} fill="none" stroke={XRAY.bone} strokeWidth={w * 0.8} strokeLinecap="round" />
        {[eyeL, eyeR].map((e, i) => (
          <g key={i}>
            <line x1={e[0] * 1.1} y1={e[1] - R * 0.12} x2={e[0] * 1.25 + pupilShift * 2} y2={-R * 1.3} stroke={PITCH.light} strokeWidth={w * 0.5} strokeLinecap="round" strokeDasharray={`${w * 0.8} ${w * 1.6}`} opacity={0.5} />
            <ellipse cx={e[0]} cy={e[1]} rx={R * 0.13} ry={R * 0.075} fill={XRAY.bg} stroke={XRAY.bone} strokeWidth={w * 0.7} transform={`rotate(${e[0] < 0 ? -20 : 20} ${e[0]} ${e[1]})`} />
            <circle cx={e[0] + pupilShift} cy={e[1] - R * 0.025} r={R * 0.045} fill={XRAY.bone} />
          </g>
        ))}
      </g>
      {/* The brain does not turn. */}
      <ellipse cy={R * 0.12} rx={R * 0.62} ry={R * 0.6} fill={XRAY.tissue} opacity={0.22} />
      <ellipse cy={R * 0.12} rx={R * 0.62} ry={R * 0.6} fill="none" stroke={XRAY.tissue} strokeWidth={w * 0.7} />
      <path d={`M0,${-R * 0.46} Q${R * 0.06},${-R * 0.1} 0,${R * 0.12} Q${-R * 0.06},${R * 0.4} 0,${R * 0.7}`} fill="none" stroke={XRAY.tissue} strokeWidth={w * 0.6} strokeLinecap="round" />
      {[-1, 1].map((s) => (
        <g key={s}>
          <path d={`M${s * R * 0.14},${-R * 0.3} Q${s * R * 0.34},${-R * 0.36} ${s * R * 0.42},${-R * 0.12}`} fill="none" stroke={XRAY.tissue} strokeWidth={w * 0.5} strokeLinecap="round" />
          <path d={`M${s * R * 0.12},${R * 0.02} Q${s * R * 0.36},${R * 0} ${s * R * 0.5},${R * 0.22}`} fill="none" stroke={XRAY.tissue} strokeWidth={w * 0.5} strokeLinecap="round" />
        </g>
      ))}
      {/* Optic paths from each eye to the back of the brain, and the travelling pulse. */}
      {paths.map(({ path, d }, i) => (
        <g key={i}>
          <path d={path} fill="none" stroke={XRAY.bone} strokeWidth={w * 0.35} strokeDasharray={`${w * 0.6} ${w * 1.4}`} opacity={0.3} />
          {p > 0.001 && p < 0.999 ? (
            <g>
              <path d={path} fill="none" stroke={PITCH.light} strokeWidth={w * 1.1} strokeLinecap="round" opacity={0.85} {...segment(p - tail, p)} />
              <path d={path} fill="none" stroke={PITCH.light} strokeWidth={w * 2.4} strokeLinecap="round" opacity={0.2} {...segment(p - tail, p)} />
              <circle cx={d[0]} cy={d[1]} r={w * 2.2} fill={PITCH.light} opacity={0.25} />
              <circle cx={d[0]} cy={d[1]} r={w * 1.3} fill={PITCH.light} opacity={0.6} />
              <circle cx={d[0]} cy={d[1]} r={w * 0.7} fill={PITCH.lightSoft} />
            </g>
          ) : null}
        </g>
      ))}
      {flash > 0 && p < 0.999 ? (
        <g opacity={flash}>
          <circle cx={back[0]} cy={back[1]} r={R * 0.26} fill={PITCH.light} opacity={0.18} />
          <circle cx={back[0]} cy={back[1]} r={R * 0.14} fill={PITCH.light} opacity={0.35} />
        </g>
      ) : null}
      {/* Doors and labels: they pop in together and never turn. */}
      {dIn > 0.001
        ? doorPos.map(([dx, dy], i) => {
            const l = clamp01(lit[i] ?? 0);
            const c = doorColor(l);
            const top = dy - doorH / 2;
            const d = `M${dx - doorW / 2},${dy + doorH / 2} L${dx - doorW / 2},${top + doorW / 2} A${doorW / 2},${doorW / 2} 0 0 1 ${dx + doorW / 2},${top + doorW / 2} L${dx + doorW / 2},${dy + doorH / 2} Z`;
            const lx = dx * 1.9;
            return (
              <g key={i}>
                <g transform={`translate(${dx} ${dy}) scale(${dIn}) translate(${-dx} ${-dy})`}>
                  {l > 0.01 ? (
                    <g>
                      <circle cx={dx} cy={dy} r={doorH * 1.05} fill={XRAY.lime} opacity={0.12 * l} />
                      <circle cx={dx} cy={dy} r={doorH * 0.7} fill={XRAY.lime} opacity={0.18 * l} />
                    </g>
                  ) : null}
                  <path d={d} fill={XRAY.lime} opacity={0.85 * l} />
                  <path d={d} fill={l > 0.01 ? "none" : XRAY.bg} fillOpacity={0.5} stroke={c} strokeWidth={w * 0.7} strokeLinejoin="round" />
                  <circle cx={dx + doorW * 0.22} cy={dy + doorH * 0.08} r={w * 0.45} fill={l > 0.5 ? XRAY.bg : c} />
                </g>
                <g opacity={clamp01(doorsIn * 1.5 - 0.3)}>
                  <line x1={dx} y1={dy + doorH / 2 + w} x2={lx} y2={labelY - labelSize * 0.85} stroke={doorColor(l)} strokeWidth={w * 0.35} strokeLinecap="round" opacity={0.6} />
                  <text x={lx} y={labelY} fill={doorColor(l)} fontFamily={FONTS.hud} fontWeight={700} fontSize={labelSize} textAnchor="middle" letterSpacing={3} opacity={0.7 + 0.3 * l}>
                    {doors[i]}
                  </text>
                </g>
              </g>
            );
          })
        : null}
    </g>
  );
};

/** "SEEN FROM ABOVE" tag with a mini side-view figure and an eye looking down at it. */
export const SeenFromAbove: React.FC<{ x: number; y: number; at: number; until?: number }> = ({ x, y, at, until }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until, 12, 8);
  if (o <= 0.001) return null;
  const text = "SEEN FROM ABOVE";
  const size = 32;
  const w = text.length * 22 + 130;
  const h = 96;
  const bob = 3 * Math.sin(frame / 7);
  return (
    <g opacity={o} transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx={28} fill={XRAY.bg} opacity={0.9} />
      <rect width={w} height={h} rx={28} fill="none" stroke={XRAY.bone} strokeWidth={3} opacity={0.45} />
      {/* The eye above, looking down. */}
      <g transform={`translate(56 ${22 + bob})`}>
        <path d="M-16,0 Q0,-11 16,0 Q0,11 -16,0 Z" fill="none" stroke={PITCH.light} strokeWidth={3} strokeLinejoin="round" />
        <circle cy={2} r={4.5} fill={PITCH.light} />
      </g>
      <path d={`M56,${36 + bob} L56,${46 + bob}`} stroke={PITCH.light} strokeWidth={3} strokeLinecap="round" strokeDasharray="3 4" />
      <path d={`M50,${44 + bob} L56,${51 + bob} L62,${44 + bob}`} fill="none" stroke={PITCH.light} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {/* A tiny side-view figure. */}
      <g stroke={XRAY.bone} strokeWidth={3.5} strokeLinecap="round" fill="none">
        <circle cx={56} cy={60} r={6} />
        <path d="M56,66 L56,78 M56,78 L50,88 M56,78 L62,88 M56,70 L49,76 M56,70 L63,76" />
      </g>
      <text x={104} y={h / 2 + size * 0.36} fill={XRAY.bone} fontFamily={FONTS.hud} fontWeight={700} fontSize={size} letterSpacing={3}>
        {text}
      </text>
    </g>
  );
};

const arcPath = (rad: number, a0: number, a1: number) => {
  // Degrees clockwise from 12 o'clock, centred on (0, 0).
  const at = (a: number): [number, number] => {
    const t = ((a - 90) * Math.PI) / 180;
    return [rad * Math.cos(t), rad * Math.sin(t)];
  };
  const sweep = Math.min(359.9, Math.max(0, a1 - a0));
  const [x0, y0] = at(a0);
  const [x1, y1] = at(a0 + sweep);
  return { d: `M${x0},${y0} A${rad},${rad} 0 ${sweep > 180 ? 1 : 0} 1 ${x1},${y1}`, end: [x1, y1] as [number, number] };
};

/** One stopwatch dial. `parts` are coloured arcs, each running from the previous part's end to `s` seconds. */
const Dial: React.FC<{ cx: number; r: number; parts: { s: number; color: string }[]; target: number; fullSeconds: number; title: string; active: boolean; wake: number; readColor: string }> = ({
  cx,
  r,
  parts,
  target,
  fullSeconds,
  title,
  active,
  wake,
  readColor,
}) => {
  const total = parts.length ? parts[parts.length - 1].s : 0;
  const ring = r * 0.16;
  const font = Math.max(32, r * 0.46);
  const ticks = Math.round(fullSeconds / 0.1);
  const dim = 0.35 + 0.65 * wake;
  const bump = 1 + 0.08 * (popT(wake) - wake);
  const deg = (s: number) => (s / fullSeconds) * 360;
  let prev = 0;
  let endColor = readColor;
  const arcs = parts.map((pt, i) => {
    const a0 = deg(prev);
    const a1 = deg(pt.s);
    prev = pt.s;
    if (a1 - a0 < 0.2) return null;
    endColor = pt.color;
    const { d } = arcPath(r, a0, a1);
    return (
      <g key={i}>
        <path d={d} fill="none" stroke={pt.color} strokeWidth={ring * 2.1} strokeLinecap="butt" opacity={0.16} />
        <path d={d} fill="none" stroke={pt.color} strokeWidth={ring} strokeLinecap={i === 0 ? "round" : "butt"} />
      </g>
    );
  });
  const { end } = arcPath(r, 0, deg(total));
  const ta = ((target / fullSeconds) * 360 - 90) * (Math.PI / 180);
  return (
    <g transform={`translate(${cx} 0) scale(${bump})`} opacity={dim}>
      <rect x={-r * 0.1} y={-r - r * 0.22} width={r * 0.2} height={r * 0.16} rx={r * 0.05} fill={PITCH.chalk} opacity={0.55} />
      <rect x={-r * 0.16} y={-r - r * 0.3} width={r * 0.32} height={r * 0.1} rx={r * 0.05} fill={PITCH.chalk} opacity={0.55} />
      <g transform="rotate(38)">
        <rect x={-r * 0.07} y={-r - r * 0.16} width={r * 0.14} height={r * 0.14} rx={r * 0.04} fill={PITCH.chalk} opacity={0.4} />
      </g>
      <circle r={r} fill={PITCH.sky} opacity={0.5} />
      <circle r={r} fill="none" stroke={PITCH.chalk} strokeWidth={ring} opacity={0.14} />
      {Array.from({ length: ticks }, (_, i) => {
        const a = ((i / ticks) * 360 - 90) * (Math.PI / 180);
        return <line key={i} x1={Math.cos(a) * r * 0.72} y1={Math.sin(a) * r * 0.72} x2={Math.cos(a) * r * 0.8} y2={Math.sin(a) * r * 0.8} stroke={PITCH.chalk} strokeWidth={r * 0.03} strokeLinecap="round" opacity={0.35} />;
      })}
      <circle cx={Math.cos(ta) * r} cy={Math.sin(ta) * r} r={ring * 0.55} fill={readColor} opacity={0.45} />
      {arcs}
      {active && total > 0.001 ? (
        <g transform={`translate(${end[0]} ${end[1]})`}>
          <circle r={ring * 1.6} fill={endColor} opacity={0.25} />
          <circle r={ring * 1.1} fill={endColor} opacity={0.45} />
          <circle r={ring * 0.65} fill={PITCH.chalk} />
        </g>
      ) : null}
      <text y={font * 0.36} fill={total > 0.001 ? readColor : PITCH.chalk} fontFamily={FONTS.mono} fontWeight={500} fontSize={font} textAnchor="middle">
        {total.toFixed(2)}
        <tspan fontSize={font * 0.55} fontFamily={FONTS.hud} fontWeight={700}>
          {" s"}
        </tspan>
      </text>
      <text y={-r - r * 0.42} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={Math.max(32, r * 0.3)} textAnchor="middle" letterSpacing={4}>
        {title}
      </text>
    </g>
  );
};

/**
 * The two reaction dials, side by side with a gap and no arrow between them (they are never added). The
 * CHOOSE dial starts with the NOTICE arc in the same yellow, so choosing visibly includes noticing, and says
 * "about 0.5 s in total" under it. `pNotice`, `pChoose` 0..1 fill each dial; `wake` 0..1 brings CHOOSE to
 * full brightness.
 */
export const ReactionDials: React.FC<{
  x: number;
  y: number;
  r: number;
  notice: number;
  choose: number;
  pNotice: number;
  pChoose: number;
  wake: number;
  caption?: string;
  captionO?: number;
  totalO?: number;
  fullSeconds?: number;
}> = ({ x, y, r, notice, choose, pNotice, pChoose, wake, caption, captionO = 1, totalO = 1, fullSeconds = 0.6 }) => {
  const g = r * 2.8;
  const s1 = clamp01(pNotice) * notice;
  const s2 = clamp01(pChoose) * choose;
  const capSize = Math.max(32, r * 0.3);
  const totalText = `about ${choose.toFixed(1)} s in total`;
  return (
    <g transform={`translate(${x} ${y})`}>
      <Dial cx={-g / 2} r={r} parts={[{ s: s1, color: PITCH.light }]} target={notice} fullSeconds={fullSeconds} title="NOTICE" active={pNotice > 0 && pNotice < 1} wake={1} readColor={PITCH.light} />
      <Dial
        cx={g / 2}
        r={r}
        parts={[
          { s: Math.min(s2, notice), color: PITCH.light },
          { s: s2, color: CAST.mistake },
        ]}
        target={choose}
        fullSeconds={fullSeconds}
        title="CHOOSE"
        active={pChoose > 0 && pChoose < 1}
        wake={wake}
        readColor={CAST.mistake}
      />
      {totalO > 0.001 ? (
        <text x={g / 2} y={r + capSize * 1.6} fill={CAST.mistake} opacity={totalO} fontFamily={FONTS.mono} fontWeight={500} fontSize={capSize} textAnchor="middle">
          {totalText}
        </text>
      ) : null}
      {caption && captionO > 0.001 ? (
        <text y={r + capSize * 3.05} fill={PITCH.chalk} opacity={0.75 * captionO} fontFamily={FONTS.mono} fontWeight={500} fontSize={capSize} textAnchor="middle">
          {caption}
        </text>
      ) : null}
    </g>
  );
};

/**
 * A chalk ruler measured from the ball: "0 m" at `from` (the ball), a tick every metre along +x, labels
 * above the line. `progress` 0..1 unrolls it from the ball outward. `glow` 0..1 lights the `glowAt` mark.
 */
export const BallRuler: React.FC<{ from: [number, number]; ppm: number; metres: number; progress: number; glow?: number; glowAt?: number; opacity?: number }> = ({
  from,
  ppm,
  metres,
  progress: p0,
  glow = 0,
  glowAt,
  opacity = 1,
}) => {
  const p = clamp01(p0);
  if (p <= 0.001) return null;
  const [x0, y0] = from;
  const drawn = metres * ppm * p;
  return (
    <g opacity={opacity}>
      <line x1={x0} y1={y0} x2={x0 + drawn} y2={y0} stroke={PITCH.chalk} strokeWidth={6} strokeLinecap="round" opacity={0.9} />
      {Array.from({ length: metres + 1 }, (_, i) => {
        const s = popT(clamp01(i === 0 ? 1 : (p * metres - i + 0.34) * 3));
        if (s <= 0.001) return null;
        const cx = x0 + i * ppm;
        const tick = i === 0 || i === metres ? 24 : 16;
        const hi = glowAt === i ? clamp01(glow) : 0;
        const col = hi > 0.5 ? PITCH.light : PITCH.chalk;
        return (
          <g key={i}>
            {hi > 0.01 ? (
              <g opacity={hi}>
                <circle cx={cx} cy={y0} r={tick * 2.2} fill={PITCH.light} opacity={0.14} />
                <circle cx={cx} cy={y0} r={tick * 1.4} fill={PITCH.light} opacity={0.22} />
              </g>
            ) : null}
            <g transform={`translate(${cx} ${y0}) scale(${s})`}>
              <line x1={0} y1={-tick} x2={0} y2={tick} stroke={col} strokeWidth={i === 0 || i === metres ? 6 : 4.5} strokeLinecap="round" />
            </g>
            <g transform={`translate(${cx} ${y0 - tick - 22}) scale(${s * (1 + 0.15 * hi)})`}>
              {/* A dark backing so the label reads over Chalk (he is chalk white too). */}
              <rect x={-34} y={-17} width={68} height={36} rx={18} fill={XRAY.bg} opacity={0.85} />
              <text y={10} fill={col} fontFamily={FONTS.mono} fontWeight={500} fontSize={30} textAnchor="middle">
                {i} m
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
};

/** Screen position of the centre of Chalk's front mitten (his left arm, `pose.left`) for a Keeper pose. */
export const keeperGlove = (x: number, groundY: number, h: number, pose: KeeperPose, flip: boolean) => {
  const H = h * pose.stretch;
  const W = (h * 0.34) / Math.sqrt(pose.stretch);
  const a = (pose.left * Math.PI) / 180;
  const reach = h * 0.3 + h * 0.11 * 0.85;
  const px = W * 0.42 + Math.sin(a) * reach;
  const py = -H * 0.72 + Math.cos(a) * reach;
  const l = (pose.lean * Math.PI) / 180;
  const ry = py + H * 0.45;
  const qx = px * Math.cos(l) - ry * Math.sin(l);
  const qy = px * Math.sin(l) + ry * Math.cos(l) - H * 0.45;
  const sx = flip ? -1 : 1;
  return { x: x + pose.shift * h * sx + sx * qx, y: groundY - pose.lift * h + qy };
};

/**
 * The kerb, crossed cleanly (b05 "Then move"), in the same chalk style as ChalkSketch's kerb. The near road is
 * the same line as the sketch, the far kerb draws on, and the kid walks from the sketch's waiting spot
 * (-100, 24) down the kerb, across the road and up onto the far pavement. The car has gone (speed dashes).
 * Designed in a 320 x 224 box centred on (0,0), scaled by size / 320. `walk` 0..1 moves the kid.
 */
export const KerbWalk: React.FC<{ show: number; walk: number; size?: number; x?: number; y?: number; color?: string }> = ({ show, walk: w0, size = 320, x = 0, y = 0, color = PITCH.chalk }) => {
  const o = clamp01(show);
  if (o <= 0.001) return null;
  const k = size / 320;
  const walk = clamp01(w0);
  const W = 7;
  // The kid's path (feet position).
  const pts: [number, number][] = [
    [-100, 24],
    [-60, 24],
    [-44, 60],
    [104, 60],
    [122, 24],
    [140, 24],
  ];
  const lens = pts.slice(1).map((pt, i) => Math.hypot(pt[0] - pts[i][0], pt[1] - pts[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  let dist = walk * total;
  let kx = pts[0][0];
  let fy = pts[0][1];
  for (let i = 0; i < lens.length; i++) {
    if (dist <= lens[i] || i === lens.length - 1) {
      const t = clamp01(dist / lens[i]);
      kx = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t;
      fy = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
      break;
    }
    dist -= lens[i];
  }
  const phase = Math.PI / 2 + walk * 6 * Math.PI;
  const swing = Math.sin(phase);
  const bounce = walk > 0 && walk < 1 ? -Math.abs(Math.cos(phase)) * 4 : 0;
  const hy = fy - 84 + bounce;
  const hip = fy - 30 + bounce;
  const farKerb = clamp01(walk * 4);
  const dash = clamp01((walk - 0.5) * 2.5);
  const line = (d: string, t = 1, wd = W, op = 0.95) =>
    t <= 0.002 ? null : <path d={d} fill="none" stroke={color} strokeWidth={wd} strokeLinecap="round" strokeLinejoin="round" opacity={op} pathLength={1000} strokeDasharray="1000 1000" strokeDashoffset={1000 * (1 - t)} />;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} opacity={o}>
      {line("M-160,24 L-52,24 L-52,60 L118,60")}
      {line("M118,60 L118,24 L160,24", farKerb)}
      {/* The kid, walking. */}
      <circle cx={kx} cy={hy} r={13} fill="none" stroke={color} strokeWidth={W} opacity={0.95} />
      {line(`M${kx},${hy + 13} L${kx},${hip}`)}
      {line(`M${kx},${hip} L${kx + 13 * swing},${fy}`)}
      {line(`M${kx},${hip} L${kx - 13 * swing},${fy}`)}
      {line(`M${kx},${hip - 30} L${kx - 16 * swing},${hip - 10}`)}
      {line(`M${kx},${hip - 30} L${kx + 16 * swing},${hip - 10}`)}
      {/* The car has gone: speed dashes off to the left. */}
      {line("M-158,40 L-122,40", dash, W * 0.6, 0.5)}
      {line("M-152,52 L-128,52", dash, W * 0.6, 0.5)}
    </g>
  );
};

/** Old name kept while b05 moves to KerbWalk. */
export const KerbCrossed: React.FC<{ progress: number; size?: number; x?: number; y?: number }> = ({ progress: p, size, x, y }) => <KerbWalk show={p > 0.001 ? 1 : 0} walk={p} size={size} x={x} y={y} />;
