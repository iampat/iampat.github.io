// Shared pieces for b16 (back foot) and b17 (shape practice): the side-view night pitch with a
// horizon-pinned far layer, the top-down receive replay (half-turned vs straight-on), the turn
// stopwatch that stays at 0.00, drill gates, the "room" patch, Chalk waving from the dark, and
// small board helpers (cue chips, clipped panels).
//
// Every movement comes from src/physics: PASS_IN, lookStepMeet, chalkAt, TOUCHES.BACK_FOOT, rollAt.

import React from "react";
import { useCurrentFrame } from "remotion";
import { Floodlight, GroundSide, Sky, Stands, Stars } from "../World";
import { TopField } from "../Field";
import { TopPlayer, angleTo } from "../TopPlayer";
import { TimeBubble } from "../TimeBubble";
import { Ball } from "../Ball";
import { Arrow, Label } from "../Graphics";
import { chalkAt, lookStepMeet, passInAt, ringSeconds, TOUCHES, TURN_TIME } from "../../physics/ep2sims";
import { CHASE_SPEED, rollAt, rollDistance } from "../../physics/touch";
import { FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import { EASE, clamp01, idle, popSoft, progress } from "../../lib/anim";
import { project, type View } from "../../lib/project";

// ---------- Side view world (shared by b16 and the end of b17) ----------

export const SIDE_PPM = 100;
export const SIDE_GROUND = 760;
export const SIDE_OX = 1000;
export const sideX = (m: number) => SIDE_OX + m * SIDE_PPM;
export const SIDE_VIEW: View = { kind: "side", originX: SIDE_OX, groundY: SIDE_GROUND, ppm: SIDE_PPM };
export type Cam = { x: number; y: number; zoom: number };

/** World point (side view pixels) to screen pixels for a camera. */
export const toScreen = (cam: Cam, wx: number, wy: number) => ({
  x: WIDTH / 2 + (wx - cam.x) * cam.zoom,
  y: HEIGHT / 2 + (wy - cam.y) * cam.zoom,
});

const TOWERS = [-260, 560, 1380, 2200];
const TOWER_H = 430;

/**
 * The floodlit pitch seen from the side: sky and stars in screen space, the stand and the towers
 * pinned to the horizon with a small parallax share, and the grass plus `children` in world pixels.
 */
export const SideWorld: React.FC<{ cam: Cam; lights?: number; refX?: number; seed?: string; children?: React.ReactNode }> = ({
  cam,
  lights = 1,
  refX = sideX(0),
  seed = "b16",
  children,
}) => {
  const horizonY = HEIGHT / 2 + (SIDE_GROUND - cam.y) * cam.zoom;
  const worldT = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;
  const layerT = (pan: number, grow: number) =>
    `translate(${WIDTH / 2} ${horizonY}) scale(${1 + (cam.zoom - 1) * grow}) translate(${-WIDTH / 2 - (cam.x - refX) * pan} ${-SIDE_GROUND})`;
  return (
    <g>
      <Sky id={`sky-${seed}`} />
      <Stars count={80} maxY={Math.max(80, horizonY - 260)} seed={seed} />
      <g transform={layerT(0.2, 0.05)}>
        <g transform={`translate(${WIDTH / 2} 0) scale(2.2 1) translate(${-WIDTH / 2} 0)`}>
          <Stands baseY={SIDE_GROUND} lit={lights} />
        </g>
        {TOWERS.map((x) => (
          <Floodlight key={x} x={x} baseY={SIDE_GROUND - 20} height={TOWER_H} on={lights} beam flip={x > 1000} />
        ))}
      </g>
      <g transform={worldT}>
        <GroundSide groundY={SIDE_GROUND} vanishX={sideX(6)} />
        {children}
      </g>
    </g>
  );
};

// ---------- The receive from above ----------

export type Stance = "half" | "square";

const MEET = lookStepMeet();
/** Sim time (s) and pitch x (m) where the LOOK_STEP receive meets PASS_IN. */
export const MEET_T = MEET.t;
export const MEET_X = MEET.x;
const BF = TOUCHES.BACK_FOOT();
export const BF_SPEED = Math.hypot(BF.x, BF.y);
export const BF_DIR = { x: BF.x / BF_SPEED, y: BF.y / BF_SPEED };
export const BF_ROLL = rollDistance(BF_SPEED);

const smooth = (u: number) => u * u * (3 - 2 * u);
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

/**
 * The forward play after the back-foot touch: a firm pass forward and across into the open lane on
 * the far side (+y), away from Chalk's run, so he never catches it at 4 m/s.
 */
export const PLAY_SPEED = 6;
const PLAY_DIR = (() => {
  const l = Math.hypot(0.4, 1);
  return { x: 0.4 / l, y: 1 / l };
})();
/** Chalk needs about a third of a second to see the pass before he turns after it (the episode's reaction time). */
const CHALK_REACT = 0.33;
/** Length (m) of the open-lane arrow drawn ahead of the forward play. */
const LANE_LEN = 4.6;

export type ReceiveState = {
  tavi: { x: number; y: number };
  ball: { x: number; y: number };
  chalk: { x: number; y: number };
  facing: number;
  look: number;
  seconds: number;
  touched: boolean;
  turn: number;
  /** Where the forward play left from, once it has. */
  playFrom?: { x: number; y: number };
};

/**
 * Everything on the map at sim time t (s) for a stance, in pitch metres and screen degrees.
 * `playDt` (s after the touch, half stance only) is when she plays the ball forward.
 */
export const receiveState = (t: number, stance: Stance, playDt?: number): ReceiveState => {
  const dt = t - MEET_T;
  const tavi = { x: MEET_X, y: 0 };
  const mark = { x: MEET_X, y: 0, z: 0 };
  const c = chalkAt(t, mark);
  let chalk = { x: c.x, y: c.y };
  let ball: { x: number; y: number };
  let facing: number;
  let turn = 0;
  let playFrom: { x: number; y: number } | undefined;
  if (dt < 0) {
    ball = { x: passInAt(t).x, y: 0 };
    facing = stance === "half" ? 270 : 180;
  } else if (stance === "half") {
    if (playDt !== undefined && dt >= playDt) {
      const r0 = rollAt(BF_SPEED, playDt).x;
      playFrom = { x: MEET_X + BF_DIR.x * r0, y: BF_DIR.y * r0 };
      const r = rollAt(PLAY_SPEED, dt - playDt).x;
      ball = { x: playFrom.x + PLAY_DIR.x * r, y: playFrom.y + PLAY_DIR.y * r };
      // Chalk keeps running at her for a third of a second, then turns after the ball (and never
      // catches a 6 m/s pass at 4 m/s).
      if (dt - playDt > CHALK_REACT) {
        const c0 = chalkAt(MEET_T + playDt + CHALK_REACT, mark);
        const dx = ball.x - c0.x;
        const dy = ball.y - c0.y;
        const d = Math.hypot(dx, dy) || 1;
        const run = Math.min(d, CHASE_SPEED * (dt - playDt - CHALK_REACT));
        chalk = { x: c0.x + (dx / d) * run, y: c0.y + (dy / d) * run };
      }
    } else {
      const r = rollAt(BF_SPEED, dt);
      ball = { x: MEET_X + BF_DIR.x * r.x, y: BF_DIR.y * r.x };
    }
    facing = 270;
  } else {
    // The ball stays under the feet while she turns on the spot, 180 degrees in TURN_TIME.
    turn = smooth(clamp01(dt / TURN_TIME));
    facing = 180 + 180 * turn;
    const a = (facing * Math.PI) / 180;
    ball = { x: MEET_X + 0.15 * Math.cos(a), y: -0.15 * Math.sin(a) };
  }
  // The head is on the ball: screen angle from the token to the ball, relative to the body.
  const sx = (p: { x: number; y: number }) => ({ x: p.x, y: -p.y });
  const headAt = angleTo(sx(tavi).x, sx(tavi).y, sx(ball).x, sx(ball).y);
  const near = Math.hypot(ball.x - tavi.x, ball.y - tavi.y) < 0.2;
  const look = near ? 0 : Math.max(-95, Math.min(95, wrap(headAt - facing)));
  // The ring: Chalk to Tavi's mark while the pass is in flight (the sims' readings), Chalk to the ball after the touch.
  const target = dt >= 0 ? ball : tavi;
  return { tavi, ball, chalk, facing, look, seconds: ringSeconds(chalk.x, chalk.y, target.x, target.y), touched: dt >= 0, turn, playFrom };
};

type MapProps = {
  view: View;
  stance: Stance;
  /** Scene frame where the ball reaches Tavi (sim time MEET_T). */
  touchFrame: number;
  ring?: boolean;
  ringAt?: number;
  pxPerSecond?: number;
  tokenSize?: number;
  sam?: boolean;
  field?: { x0: number; x1: number; y0: number; y1: number };
  /** Dashed lime path of the back-foot touch (half stance only). */
  path?: boolean;
  /** Scene frame where she plays the ball forward after the touch (half stance only). */
  playAt?: number;
};

/**
 * The receive replay from above. It reads the frame itself so it also works inside a <Freeze>.
 * Once she plays the ball forward (`playAt`) the ring has done its job: it bursts (grows and fades)
 * at the value it had when the ball left her foot.
 */
export const MapReceive: React.FC<MapProps> = ({ view, stance, touchFrame, ring = true, ringAt = 0, pxPerSecond = 120, tokenSize = 46, sam = true, field = { x0: -16, x1: 14, y0: -8, y1: 8 }, path = true, playAt }) => {
  const frame = useCurrentFrame();
  const t = MEET_T + (frame - touchFrame) / 30;
  const playDt = playAt === undefined ? undefined : (playAt - touchFrame) / 30;
  const s = receiveState(t, stance, playDt);
  const P = (x: number, y: number) => project({ x, y, z: 0 }, view);
  const ppm = P(0, 0).scale;
  const tv = P(s.tavi.x, s.tavi.y);
  const bl = P(s.ball.x, s.ball.y);
  const ch = P(s.chalk.x, s.chalk.y);
  const sm = P(-12, 0);
  const chalkFacing = angleTo(ch.x, ch.y, bl.x, bl.y);
  const stride = ((Math.max(0, t) * 4) / 1.5) % 1;
  const sway = idle(frame, 3, 2.8, 1.2);
  const pathEnd = P(MEET_X + BF_DIR.x * BF_ROLL, BF_DIR.y * BF_ROLL);
  const pathT = s.touched ? clamp01((frame - touchFrame) / 6) : 0;
  // The ring after the play: frozen at the release value, bursting over 14 frames.
  const burst = playAt !== undefined && frame >= playAt ? clamp01((frame - playAt) / 14) : 0;
  const releaseSeconds = playDt !== undefined ? receiveState(MEET_T + playDt - 0.001, stance).seconds : s.seconds;
  const shownSeconds = burst > 0 ? releaseSeconds : s.seconds;
  const burstE = 1 - (1 - burst) * (1 - burst);
  // The open lane she already saw: drawn just before the play, the ball then rolls along it.
  const laneFromM = playDt !== undefined && stance === "half" ? { x: MEET_X + BF_DIR.x * rollAt(BF_SPEED, playDt).x, y: BF_DIR.y * rollAt(BF_SPEED, playDt).x } : undefined;
  const laneFrom = laneFromM ? P(laneFromM.x, laneFromM.y) : undefined;
  const laneTo = laneFromM ? P(laneFromM.x + PLAY_DIR.x * LANE_LEN, laneFromM.y + PLAY_DIR.y * LANE_LEN) : undefined;
  const laneT = playAt !== undefined ? progress(frame, playAt - 6, 9, EASE.enter) : 0;
  return (
    <g>
      <TopField view={view} x0={field.x0} x1={field.x1} y0={field.y0} y1={field.y1} lines={false} />
      {ring && burst < 0.999 ? (
        <g transform={`translate(${tv.x} ${tv.y}) scale(${1 + 0.7 * burstE}) translate(${-tv.x} ${-tv.y})`} opacity={1 - burst}>
          <TimeBubble x={tv.x} y={tv.y} seconds={shownSeconds} pxPerSecond={pxPerSecond} minRadius={ppm * 0.55} maxRadius={ppm * 4} fontSize={ppm * 0.5} at={ringAt} showNumber={burst < 0.3} />
        </g>
      ) : null}
      {path && stance === "half" && pathT > 0 ? (
        <line x1={tv.x} y1={tv.y} x2={tv.x + (pathEnd.x - tv.x) * pathT} y2={tv.y + (pathEnd.y - tv.y) * pathT} stroke={XRAY.lime} strokeWidth={ppm * 0.1} strokeLinecap="round" strokeDasharray={`${ppm * 0.18} ${ppm * 0.14}`} opacity={0.95} />
      ) : null}
      {laneT > 0.001 && laneFrom && laneTo ? (
        <g opacity={0.8 * (1 - burst * 0.3)}>
          <line
            x1={laneFrom.x}
            y1={laneFrom.y}
            x2={laneFrom.x + (laneTo.x - laneFrom.x) * laneT}
            y2={laneFrom.y + (laneTo.y - laneFrom.y) * laneT}
            stroke={XRAY.lime}
            strokeWidth={ppm * 0.08}
            strokeLinecap="round"
            strokeDasharray={`${ppm * 0.2} ${ppm * 0.16}`}
          />
          {laneT > 0.9 ? (
            <path
              d={(() => {
                const a = Math.atan2(laneTo.y - laneFrom.y, laneTo.x - laneFrom.x);
                const hl = ppm * 0.42;
                return `M${laneTo.x + Math.cos(a) * hl * 0.5},${laneTo.y + Math.sin(a) * hl * 0.5} L${laneTo.x + Math.cos(a + 2.5) * hl},${laneTo.y + Math.sin(a + 2.5) * hl} L${laneTo.x + Math.cos(a - 2.5) * hl},${laneTo.y + Math.sin(a - 2.5) * hl} Z`;
              })()}
              fill={XRAY.lime}
            />
          ) : null}
        </g>
      ) : null}
      {sam ? <TopPlayer x={sm.x} y={sm.y + sway} kind="sam" facing={0} size={tokenSize} /> : null}
      <TopPlayer x={ch.x} y={ch.y} kind="chalk" facing={chalkFacing} size={tokenSize} stride={stride} />
      <TopPlayer x={tv.x} y={tv.y + sway * 0.5} kind="tavi" facing={s.facing} look={s.look} size={tokenSize} />
      <Ball cx={bl.x} cy={bl.y} r={Math.max(9, ppm * 0.16)} view={view} patches={false} axis={{ x: 0, y: 1, z: 0 }} angle={(s.ball.x + s.ball.y) / 0.11} />
    </g>
  );
};

// ---------- HUD and board pieces ----------

/** "goal" in a chalk pill with a lime arrow pointing off to the right: which way is forward on a map. */
export const GoalHint: React.FC<{ x: number; y: number; at: number; until?: number; size?: number }> = ({ x, y, at, until, size = 32 }) => (
  <g>
    <Label x={x} y={y} text="goal" at={at} until={until} size={size} bg={PITCH.chalk} color={PITCH.sky} />
    <Arrow x1={x + size * 2.1} y1={y} x2={x + size * 3.6} y2={y} at={at + 4} until={until} dur={8} color={XRAY.lime} width={6} />
  </g>
);

/** A stopwatch that never starts: "no turn to pay for". */
export const TurnWatch: React.FC<{ x: number; y: number; at: number; until?: number }> = ({ x, y, at, until }) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const tremble = Math.sin(frame / 1.7) * 1.5 * (frame - at < 14 ? 1 : 0);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-180} y={-64} width={360} height={128} rx={32} fill={PITCH.sky} opacity={0.88} />
      <g transform={`translate(-112 4) rotate(${tremble})`}>
        <rect x={-7} y={-52} width={14} height={12} rx={4} fill={PITCH.chalk} />
        <circle r={36} fill="none" stroke={PITCH.chalk} strokeWidth={5} />
        <line x1={0} y1={0} x2={0} y2={-26} stroke={XRAY.lime} strokeWidth={5} strokeLinecap="round" />
        <circle r={4.5} fill={XRAY.lime} />
      </g>
      <text x={-56} y={-12} fill={PITCH.chalk} opacity={0.75} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} letterSpacing={3}>
        TURN
      </text>
      <text x={-56} y={34} fill={XRAY.lime} fontFamily={FONTS.mono} fontWeight={500} fontSize={44}>
        0.00 s
      </text>
    </g>
  );
};

/**
 * Two flat markers that pop in with a faint chalk mouth line between them, so each pair reads as one
 * gate. The mouth turns lime when the gate is called.
 */
export const Gate: React.FC<{ a: { x: number; y: number }; b: { x: number; y: number }; at: number; lit?: number; r?: number }> = ({ a, b, at, lit = 0, r = 10 }) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at);
  if (s <= 0.001) return null;
  const mouth = progress(frame, at + 4, 10, EASE.enter);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const marker = (p: { x: number; y: number }, k: string) => (
    <g key={k} transform={`translate(${p.x} ${p.y}) scale(${s})`}>
      <ellipse cx={1.5} cy={2} rx={r * 1.15} ry={r * 0.85} fill="#000" opacity={0.2} />
      <ellipse rx={r * 1.15} ry={r * 0.85} fill={lit > 0 ? XRAY.lime : PITCH.light} />
      <ellipse rx={r * 0.45} ry={r * 0.32} fill={PITCH.chalk} opacity={0.8} />
    </g>
  );
  return (
    <g>
      {mouth > 0.001 ? (
        <g>
          <rect
            x={Math.min(a.x, b.x) - r * 1.3}
            y={Math.min(a.y, b.y)}
            width={Math.abs(b.x - a.x) + r * 2.6}
            height={Math.abs(b.y - a.y)}
            fill={PITCH.chalk}
            opacity={0.07 * mouth}
          />
          <line x1={mid.x + (a.x - mid.x) * mouth} y1={mid.y + (a.y - mid.y) * mouth} x2={mid.x + (b.x - mid.x) * mouth} y2={mid.y + (b.y - mid.y) * mouth} stroke={PITCH.chalk} strokeWidth={4} strokeDasharray="8 8" strokeLinecap="round" opacity={0.5 * (1 - lit)} />
        </g>
      ) : null}
      {lit > 0 ? <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={XRAY.lime} strokeWidth={5} strokeDasharray="8 8" opacity={0.85 * lit} /> : null}
      {marker(a, "a")}
      {marker(b, "b")}
    </g>
  );
};

/** Free space on the pitch: a soft lime patch with a dashed edge that breathes. */
export const RoomPatch: React.FC<{ x: number; y: number; rx: number; ry: number; at: number; dim?: number }> = ({ x, y, rx, ry, at, dim = 1 }) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at);
  if (s <= 0.001) return null;
  const breathe = 1 + 0.03 * Math.sin(frame / 9);
  return (
    <g transform={`translate(${x} ${y}) scale(${s * breathe})`} opacity={dim}>
      <ellipse rx={rx} ry={ry} fill={XRAY.lime} opacity={0.2} />
      <ellipse rx={rx} ry={ry} fill="none" stroke={XRAY.lime} strokeWidth={4} strokeDasharray="14 12" opacity={0.75} />
    </g>
  );
};

/** Chalk's token in the dark, one mitten waving. */
export const ChalkWaver: React.FC<{ x: number; y: number; facing: number; size?: number; waveAt: number; waveFor?: number; opacity?: number }> = ({ x, y, facing, size = 44, waveAt, waveFor = 40, opacity = 0.6 }) => {
  const frame = useCurrentFrame();
  const w = frame >= waveAt && frame < waveAt + waveFor ? Math.sin(((frame - waveAt) / 4) * Math.PI) : 0;
  const up = clamp01((frame - waveAt) / 6) * (1 - progress(frame, waveAt + waveFor, 8, EASE.exit));
  const g = size * 0.22;
  return (
    <g opacity={opacity}>
      <TopPlayer x={x} y={y} kind="chalk" facing={facing} size={size} />
      {up > 0.001 ? (
        <g transform={`translate(${x} ${y}) rotate(${facing}) translate(${-size * 0.1} ${-size * 0.62 - up * size * 0.25}) rotate(${w * 28})`}>
          <rect x={-g * 0.5} y={-g * 1.1} width={g} height={g * 1.4} rx={g * 0.45} fill={PITCH.chalk} />
        </g>
      ) : null}
    </g>
  );
};

/** Pill width for a cue chip (Nunito 800 averages about half an em per character). */
const chipWidth = (text: string, size: number) => text.length * size * 0.5 + size * 2.4;

/**
 * A row of cue pills on the board. The active one lights orange. Give `x0` for a left edge or
 * `centerX` to centre the whole row.
 */
export const Chips: React.FC<{ x0?: number; centerX?: number; y: number; items: { text: string; at: number; activeAt?: number }[]; gap?: number; size?: number }> = ({ x0 = 0, centerX, y, items, gap = 28, size = 32 }) => {
  const frame = useCurrentFrame();
  const total = items.reduce((acc, it) => acc + chipWidth(it.text, size), 0) + gap * (items.length - 1);
  let x = centerX === undefined ? x0 : centerX - total / 2;
  return (
    <g>
      {items.map((it, i) => {
        const w = chipWidth(it.text, size);
        const h = size * 1.6;
        const s = popSoft(frame, it.at);
        const on = it.activeAt === undefined ? 0 : progress(frame, it.activeAt, 8);
        const cx = x + w / 2;
        x += w + gap;
        if (s <= 0.001) return null;
        return (
          <g key={i} transform={`translate(${cx} ${y}) scale(${s})`}>
            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill="#1B3D5A" />
            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={PITCH.accent} opacity={on} />
            <circle cx={-w / 2 + h / 2} r={size * 0.22} fill={on > 0.5 ? PITCH.chalk : PITCH.accent} />
            <text x={size * 0.55} y={size * 0.36} fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={size} textAnchor="middle">
              {it.text}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/** A rounded, clipped panel on the board. Children draw in panel-local pixels (0,0 = top-left). */
export const ClipPanel: React.FC<{ x: number; y: number; w: number; h: number; id: string; opacity?: number; children?: React.ReactNode }> = ({ x, y, w, h, id, opacity = 1, children }) => (
  <g transform={`translate(${x} ${y})`} opacity={opacity}>
    <defs>
      <clipPath id={id}>
        <rect width={w} height={h} rx={30} />
      </clipPath>
    </defs>
    <rect width={w} height={h} rx={30} fill={PITCH.grassDark} />
    <g clipPath={`url(#${id})`}>{children}</g>
  </g>
);
