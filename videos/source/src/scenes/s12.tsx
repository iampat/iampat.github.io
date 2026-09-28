// s12 Curler practice. The same free kick as s08 and s11: the ball is in the left channel, the far
// post is the right post, Chalk and the wall guard the near (left) post.
// The practice board: from 20 m, aim about 3 m (3 big steps) outside the far post, point the
// standing foot there, closer to goal aim less wide. The classic mistake (aim straight at the far
// post, the spin pulls it back to Chalk). The bag drill with ten ghost curlers, a drill note and a
// safety strip. Then the real curler from behind the ball, in slow motion: it starts wide (outside
// the far post), comes home (inside it). A zoom inset on the far post shows the ball go in.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage } from "../kit/Camera";
import { Dust, Floodlight, Glow, Stands, Stars, Sky } from "../kit/World";
import { Ball } from "../kit/Ball";
import { Keeper, KPOSES, keeperPoseAt, type KeeperPose } from "../kit/Keeper";
import { Arrow, Label, PracticeBoard, Stamp } from "../kit/Graphics";
import { Sfx } from "../kit/Sfx";
import { SHOTS } from "../physics/shots";
import {
  crossingAtX,
  sampleAt,
  simulate,
  spinAngleAt,
  type BallState,
  type Vec3,
} from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, idle, keys, pop, popSoft, progress, visible } from "../lib/anim";
import { project, type View } from "../lib/project";
import { CAST, FONTS, PITCH } from "../theme";
import {
  Bracket,
  ChalkDefender,
  FlagToken,
  Footprint,
  Goal3D,
  Haze,
  KitBag,
  SlowTag,
  TopBoot,
  WorldPitch,
  depthOf,
  horizonY,
  linePath,
  pcamAt,
  viewOf,
  type PCam,
} from "../kit/ext/s11-s12-world";
import {
  FAR_POST,
  GC,
  GL,
  NEAR_POST,
  TARGET,
  TH,
  TH_POST,
  WALL,
  crossPitchX,
  lineYAt,
  pathOnPitch,
  toPitch,
} from "../kit/ext/s11-s12-layout";

// World layout (metres, pitch frame): kick spot at the origin, goal line X = GL (18.5 m),
// goal centre 4.5 m to the right of the ball. The sim flights are turned onto the pitch.
const AZ = (SHOTS.CURLER.azimuthDeg * Math.PI) / 180; // launch: 8 degrees right of the target line
const REAL_S = simulate({ ...SHOTS.CURLER, ground: false, duration: 1.8 }, 30);
const REAL = pathOnPitch(REAL_S); // x axis at the target, just inside the far post
const MISS = pathOnPitch(
  simulate({ ...SHOTS.CURLER_AIM_MISS, ground: false, duration: 1.8 }, 30),
  TH_POST, // launched straight at the far post
);
const REAL_X = crossPitchX(REAL, GL);
const MISS_X = crossPitchX(MISS, GL);
const REAL_GOAL_F = REAL_X?.f ?? 40;
const MISS_GOAL_F = MISS_X?.f ?? 38;
const LAND_Y = REAL_X?.pos.y ?? TARGET.y; // where the curler goes in (about 0.3 m inside the far post)
const MISS_Y = MISS_X?.pos.y ?? FAR_POST + 2.7; // where the mistake goes in (about 2.7 m inside)
const LAUNCH_A = TH + AZ;
const FLAG20 = lineYAt(0, 0, LAUNCH_A, GL); // aim point from 20 m (about 2.8 m outside the post)
// From 10 m (halfway along the target line) the gap is only a quarter: aim about 0.7 m outside.
const SPOT10 = toPitch({ x: 10, y: 0, z: 0 });
const GAP10 = (crossingAtX(REAL_S, 10)?.pos.y ?? 0) - 10 * Math.tan(AZ);
const FLAG10 = lineYAt(
  SPOT10.x,
  SPOT10.y,
  TH - Math.atan2(GAP10, Math.hypot(TARGET.x - SPOT10.x, TARGET.y - SPOT10.y)),
  GL,
);
const STEP = (LAND_Y - FLAG20) / 3; // one big step (about 1 m)
const BRX = 1.7; // the aim bracket sits this far in front of the goal line (the steps go between)
const TGT_LEN = Math.hypot(TARGET.x, TARGET.y); // about 20 m
const NRM = { x: -Math.sin(TH), y: Math.cos(TH) }; // left of the target line

// Board view: top-down, kick on the left, goal on the right (the goal line runs up and down).
const PPM = 46;
const BOARD: View = { kind: "top", originX: 230, originY: 352, ppm: PPM };
const B = (x: number, y: number) => project({ x, y, z: 0 }, BOARD);
const PANEL = { x: 110, y: 185, w: 1115, h: 800 };
const COL = 1262; // right column (steps, drill note)
const STAMP_X = 1552;

// Behind-the-ball night view (pitch frame): a raised camera behind the ball and a little to its
// left, like a TV free-kick camera. From up here the wall sits below the goal, Chalk stays in view,
// and the ball's way out wide of the far post (then back in) shows against the grass.
const BTB_AIM: Vec3 = { x: GL - 3, y: FAR_POST + 2.5, z: 0.5 };
const btbCam = (f: number, side: number, focal: number) => {
  const p = toPitch({ x: -9, y: 3.5 + side, z: 5 });
  const d = Math.hypot(BTB_AIM.x - p.x, BTB_AIM.y - p.y);
  return {
    f,
    ...p,
    yaw: (Math.atan2(BTB_AIM.y - p.y, BTB_AIM.x - p.x) * 180) / Math.PI,
    pitch: (Math.atan2(BTB_AIM.z - p.z, d) * 180) / Math.PI,
    focal,
    cy: 520,
  };
};
const SLOW3 = 0.62; // the real curler plays in slow motion, so "Starts wide" is readable
// Zoom inset on the far post (screen circle) and what it looks at (pitch frame).
const INSET = { x: 1470, y: 300, r: 230, zoom: 3.2 };
const INSET_AIM: Vec3 = { x: GL, y: FAR_POST + 0.85, z: 1.15 };

// The pitch under the board (landing from s11): top-down, with the same curler path.
const UNDER: View = { kind: "top", originX: 330, originY: 250, ppm: 64 };

/** Ball token on the board following a pitch-frame sim path (never eased). */
const BoardFlight: React.FC<{
  path: BallState[];
  f: number;
  r?: number;
  ghost?: boolean;
  trail?: boolean;
  trailColor?: string;
  trailOpacity?: number;
  stopF?: number;
}> = ({
  path,
  f,
  r = 14,
  ghost = false,
  trail = true,
  trailColor = PITCH.chalk,
  trailOpacity = 0.5,
  stopF,
}) => {
  const ff = Math.min(f, stopF ?? path.length - 1);
  const s = sampleAt(path, ff);
  const q = project(s.pos, BOARD);
  const pts = path
    .slice(0, Math.floor(ff) + 1)
    .map((p) => project(p.pos, BOARD));
  pts.push(q);
  return (
    <g>
      {trail && pts.length > 1 ? (
        <polyline
          points={pts
            .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
            .join(" ")}
          fill="none"
          stroke={trailColor}
          strokeWidth={ghost ? 4 : 6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={trailOpacity}
          strokeDasharray={ghost ? "2 10" : undefined}
        />
      ) : null}
      {ghost ? (
        <g>
          <circle cx={q.x} cy={q.y} r={r} fill={CAST.keeper} opacity={0.25} />
          <circle
            cx={q.x}
            cy={q.y}
            r={r}
            fill="none"
            stroke={CAST.keeper}
            strokeWidth={3}
            strokeDasharray="5 4"
            opacity={0.9}
          />
        </g>
      ) : (
        <Ball
          cx={q.x}
          cy={q.y}
          r={r}
          view={BOARD}
          axis={s.spin}
          angle={spinAngleAt(path, ff)}
          lineNormal={{ x: 0.3, y: 0.2, z: 0.93 }}
        />
      )}
    </g>
  );
};

/** One line of the step list on the right of the board. */
const Step: React.FC<{
  y: number;
  text: string;
  at: number;
  until?: number;
  color: string;
  size?: number;
  dim?: boolean;
  dot?: boolean;
}> = ({ y, text, at, until, color, size = 36, dim = false, dot = true }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until, 12, 8);
  if (o <= 0.001) return null;
  const x = COL + (1 - o) * 30;
  return (
    <g opacity={o}>
      {dot ? (
        <circle
          cx={x + 12}
          cy={y - size * 0.34}
          r={10}
          fill={color}
          opacity={dim ? 0.7 : 1}
        />
      ) : null}
      <text
        x={x + (dot ? 38 : 0)}
        y={y}
        fill={dim ? PITCH.lightSoft : PITCH.chalk}
        fontFamily={FONTS.label}
        fontWeight={dim ? 700 : 800}
        fontSize={size}
      >
        {text}
      </text>
    </g>
  );
};

/** A dimension line between two screen points, with end ticks and a pill label in the middle (board ruler). */
const Span: React.FC<{
  a: { x: number; y: number };
  b: { x: number; y: number };
  text: string;
  opacity: number;
  w?: number;
}> = ({ a, b, text, opacity, w = 120 }) => {
  if (opacity <= 0.001) return null;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = (-(b.y - a.y) / L) * 14;
  const ny = ((b.x - a.x) / L) * 14;
  return (
    <g opacity={opacity}>
      <g
        stroke={PITCH.chalk}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.75}
      >
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        <line x1={a.x - nx} y1={a.y - ny} x2={a.x + nx} y2={a.y + ny} />
        <line x1={b.x - nx} y1={b.y - ny} x2={b.x + nx} y2={b.y + ny} />
      </g>
      <rect
        x={mx - w / 2}
        y={my - 26}
        width={w}
        height={52}
        rx={26}
        fill={PITCH.sky}
      />
      <text
        x={mx}
        y={my + 12}
        fill={PITCH.chalk}
        fontFamily={FONTS.label}
        fontWeight={800}
        fontSize={34}
        textAnchor="middle"
      >
        {text}
      </text>
    </g>
  );
};

/** Screen points of a board ruler along the target line, from `from` m to `to` m, off to its left side. */
const alongLine = (from: number, to: number, off = 1.45) => {
  const p = (d: number) =>
    B(
      (TARGET.x / TGT_LEN) * d + NRM.x * off,
      (TARGET.y / TGT_LEN) * d + NRM.y * off,
    );
  return { a: p(from), b: p(to) };
};

export const S12: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s12");

  // Beats (exact word cues).
  const t20 = cue("From twenty metres");
  const tAim = cue("aim about three metres");
  const tThree = cue("three metres outside");
  const tOutside = cue("outside the far post");
  const tPost = cue("far post");
  const tPoint = cue("Point your standing foot");
  const tCloser = cue("Closer to goal");
  const tLess = cue("Aim less wide");
  const tLessWide = cue("less wide");
  const tMistake = cue("Classic mistake");
  const tAiming = cue("aiming straight at the post");
  const tAtPost = cue("at the post");
  const tSpin = cue("The spin pulls");
  const tBack = cue("back to Chalk");
  const tDrill = cue("Solo drill");
  const tBag = cue("bag halfway");
  const tHalf = cue("halfway to the goal");
  const tCurl = cue("Curl ten balls");
  const tWide = cue("Starts wide");
  const tHome = cue("Comes home");
  const tHomeW = cue("home");
  const END = cue.frames;

  const boardIn = 4;
  const flagAt = tThree - 6;
  const stepsAt = [0, 1, 2].map((k) => tOutside + 6 + k * 10); // three big steps out to the flag
  const kickA = tPoint + 26; // the aimed-off curler on the board
  const slide10 = Math.max(tCloser + 6, kickA + Math.ceil(REAL_GOAL_F) + 2);
  const flagIn = tLess; // the flag slides in for the 10 m case
  const slideBack = tMistake - 6;
  const kickMiss = tAtPost + 4;
  const catchF = kickMiss + Math.round(MISS_GOAL_F);
  const clearMistake = tDrill - 8;
  const stepsOut = tDrill - 6; // the aim steps leave the column for the drill
  const shrink = progress(frame, tDrill + 2, 14, EASE.standard); // the map makes room for the safety strip
  const bagAt = tBag - 3;
  const ghostsAt = tCurl;
  // The real curler (slow motion) crosses inside the far post on "Comes", the goal line just before "home".
  const goalF = tHomeW - 4;
  const K3 = Math.round(goalF - REAL_GOAL_F / SLOW3);
  const boardOut = K3 - 10;
  const crumble = goalF + 6;

  // ---------------- Behind the ball (night): starts wide, comes home ----------------
  const btb = frame >= boardOut;
  let btbLayer: React.ReactNode = null;
  if (btb) {
    // A slow drift and a small push (about 8%) over the shot.
    const drift = progress(frame, boardOut, END - boardOut, EASE.camera);
    const c = pcamAt(frame, [
      btbCam(boardOut, 0.3, 1420),
      btbCam(END, -0.3, 1540),
    ]);
    const view = viewOf(c);
    const hy = horizonY(c);
    const f3 = Math.max(0, (frame - K3) * SLOW3);
    // After the goal line the net stops the ball: it hangs at the back of the net and drops.
    const netF = crossPitchX(REAL, GL + 1.2)?.f ?? REAL_GOAL_F + 3;
    const inNet = f3 > netF;
    const s = sampleAt(REAL, Math.min(f3, netF));
    const drop = inNet
      ? Math.min(s.pos.z - 0.11, 0.5 * 9.81 * ((f3 - netF) / 30) ** 2)
      : 0;
    const ballPos: Vec3 = { x: s.pos.x, y: s.pos.y, z: s.pos.z - drop };
    const trailPts = REAL.slice(0, Math.floor(Math.min(f3, netF)) + 1).map(
      (p) => p.pos,
    );
    // The net ripple holds about a second.
    const ripple = inNet
      ? {
          y: s.pos.y,
          z: s.pos.z,
          amp: 0.8 * Math.exp(-(frame - (goalF + 3)) / 26),
          phase: (frame - goalF) * 0.55,
        }
      : undefined;
    const kPose: KeeperPose = keeperPoseAt(frame, [
      [K3 + 6, "ready"],
      [
        K3 + 34,
        { ...KPOSES.diveL, lean: -26, shift: -0.16, lift: 0.02, stretch: 1 },
      ],
      [
        goalF + 8,
        { ...KPOSES.diveL, lean: -30, shift: -0.2, lift: 0.0, stretch: 0.98 },
      ],
      [goalF + 22, "shrug"],
    ]);
    const kFace = frame >= goalF ? "surprised" : "flat";
    const trailO = progress(frame, K3, 4);

    /** The pitch, goal, keeper, trail and ball as one camera sees them (main view or the zoom inset). */
    const world = (v: View, main: boolean) => {
      const bq = project(ballPos, v);
      const hv = main ? hy : horizonY(insetCam);
      const k = main ? 1 : INSET.zoom;
      return (
        <g>
          <rect
            x={-50}
            y={hv}
            width={2020}
            height={1400}
            fill={PITCH.grassDark}
          />
          <WorldPitch
            view={v}
            goalX={GL}
            gc={GC}
            colors={{
              a: PITCH.grass,
              b: PITCH.grassDark,
              line: PITCH.chalk,
              lineOpacity: 0.85,
            }}
            lineW={main ? undefined : 7}
          />
          <Haze
            y={hv}
            color={PITCH.lightSoft}
            opacity={0.14}
            height={200}
            id={main ? "s12-haze" : "s12-haze-in"}
          />
          <Goal3D
            view={v}
            goalX={GL}
            y0={FAR_POST}
            y1={NEAR_POST}
            net
            netOpacity={main ? 0.4 : 0.55}
            ripple={ripple}
          />
          {/* Chalk, on the line by the near post, leans the wrong way. */}
          {(() => {
            const kp = project({ x: GL - 0.6, y: NEAR_POST - 1.3, z: 0 }, v);
            return (
              <Keeper
                x={kp.x}
                groundY={kp.y}
                h={2.1 * kp.scale}
                pose={kPose}
                face={kFace}
                look={frame < goalF ? 0.4 : -0.2 + idle(frame, 2, 2, 0.2)}
              />
            );
          })()}
          {main
            ? /* Chalk wall at 9.15 m by the near post: the ball clears it, then the wall crumbles into dust. */
              WALL.map((w, i) => {
                const wp = project({ x: w.x, y: w.y, z: 0 }, v);
                const sink = progress(frame, crumble + i * 3, 14, EASE.exit);
                return (
                  <g key={i}>
                    <ChalkDefender
                      x={wp.x}
                      groundY={wp.y}
                      h={1.8 * wp.scale}
                      surprised={frame > K3 + 14}
                      sink={sink}
                      sway={idle(frame, i, 2.5, 1.5)}
                    />
                    <Dust
                      x={wp.x}
                      y={wp.y - 0.5 * wp.scale}
                      at={crumble + i * 3}
                      size={0.8 * wp.scale}
                      seed={`wall${i}`}
                    />
                  </g>
                );
              })
            : null}
          {main
            ? (() => {
                const q = project({ x: 0, y: 0, z: 0 }, v);
                return (
                  <Dust
                    x={q.x}
                    y={q.y}
                    at={K3}
                    size={0.5 * q.scale}
                    seed="kick"
                  />
                );
              })()
            : null}
          {/* The start line on the grass: the ball starts outside the far post. */}
          {main
            ? (() => {
                const o = visible(frame, tWide - 2, tHome + 6, 10, 10);
                const t = progress(frame, tWide - 2, 16, EASE.enter);
                const end = { x: GL * t, y: FLAG20 * t, z: 0 };
                const lq = project({ x: GL, y: FLAG20, z: 0 }, v);
                return (
                  <g opacity={o}>
                    <path
                      d={linePath(
                        [
                          {
                            x: 0.5 * Math.cos(LAUNCH_A),
                            y: 0.5 * Math.sin(LAUNCH_A),
                            z: 0,
                          },
                          end,
                        ],
                        v,
                      )}
                      fill="none"
                      stroke={PITCH.chalk}
                      strokeWidth={6}
                      strokeDasharray="16 12"
                      strokeLinecap="round"
                      opacity={0.85}
                    />
                    <Label
                      x={lq.x + 190}
                      y={lq.y + 100}
                      text="Starts wide"
                      at={tWide + 4}
                      until={tHome - 2}
                      size={40}
                      bg={PITCH.chalk}
                      color={PITCH.sky}
                    />
                  </g>
                );
              })()
            : null}
          {/* Ball and its bright trail. */}
          {frame >= K3 ? (
            <>
              <path
                d={linePath(trailPts.concat([ballPos]), v)}
                fill="none"
                stroke={PITCH.light}
                strokeWidth={18 * k}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.22 * trailO}
              />
              <path
                d={linePath(trailPts.concat([ballPos]), v)}
                fill="none"
                stroke={PITCH.light}
                strokeWidth={7 * k}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.95 * trailO}
              />
              {/* A soft glow marks the ball in the net for the end hold. */}
              {inNet ? (
                <Glow
                  cx={bq.x}
                  cy={bq.y}
                  r={(main ? 46 : 110) + 4 * Math.sin(frame / 5)}
                  color={PITCH.light}
                  intensity={1.6 * progress(frame, goalF + 2, 12, EASE.soft)}
                />
              ) : null}
              {depthOf(ballPos, v) > 0.8 ? (
                <Ball
                  cx={bq.x}
                  cy={bq.y}
                  r={Math.max(main ? 8 : 16, 0.11 * bq.scale)}
                  view={v}
                  axis={s.spin}
                  angle={spinAngleAt(REAL, Math.min(f3, netF))}
                  lineNormal={{ x: 0.3, y: 0.2, z: 0.93 }}
                />
              ) : null}
            </>
          ) : (
            (() => {
              const q = project({ x: 0, y: 0, z: 0.11 }, v);
              return (
                <Ball
                  cx={q.x}
                  cy={q.y}
                  r={0.11 * q.scale}
                  view={v}
                  lineNormal={{ x: 0.3, y: 0.2, z: 0.93 }}
                  angle={idle(frame, 4, 3, 0.2)}
                />
              );
            })()
          )}
        </g>
      );
    };

    // The inset: the same camera position, turned to the far post and zoomed in.
    const insetCam: PCam = {
      ...c,
      yaw:
        (Math.atan2(INSET_AIM.y - c.y, INSET_AIM.x - c.x) * 180) / Math.PI,
      pitch:
        (Math.atan2(
          INSET_AIM.z - c.z,
          Math.hypot(INSET_AIM.x - c.x, INSET_AIM.y - c.y),
        ) *
          180) /
        Math.PI,
      focal: c.focal * INSET.zoom,
      cx: INSET.x,
      cy: INSET.y,
    };
    const insetView = viewOf(insetCam);
    const insetIn = popSoft(frame, K3 + Math.round(27 / SLOW3)); // as the ball starts to come back
    const postMid = project({ x: GL, y: FAR_POST, z: 1.2 }, view);
    const standY = hy; // stands sit on the horizon
    btbLayer = (
      <g>
        <Sky />
        <Stars count={90} maxY={standY - 330} seed="s12b" />
        <g transform={`translate(${(drift - 0.5) * 24} ${standY - 820})`}>
          <Stands baseY={820} lit={1} />
          {[160, 700, 1240, 1780].map((x, i) => (
            <Floodlight key={i} x={x} baseY={800} height={380} on={1} />
          ))}
        </g>
        {world(view, true)}
        <SlowTag
          frame={frame}
          at={K3 - 6}
          until={goalF + 10}
          bg={PITCH.sky}
          text={PITCH.chalk}
          dot={PITCH.light}
        />
        {/* Zoom inset on the far post: the ball comes home big and clear, the net ripples. */}
        {insetIn > 0.01 ? (
          <g>
            <g opacity={Math.min(1, insetIn)}>
              <circle
                cx={postMid.x}
                cy={postMid.y}
                r={34}
                fill="none"
                stroke={PITCH.light}
                strokeWidth={4}
              />
              <line
                x1={postMid.x + 24}
                y1={postMid.y - 24}
                x2={INSET.x - INSET.r * 0.72 * insetIn}
                y2={INSET.y + INSET.r * 0.7 * insetIn}
                stroke={PITCH.light}
                strokeWidth={4}
                strokeLinecap="round"
                opacity={0.8}
              />
            </g>
            <g
              transform={`translate(${INSET.x} ${INSET.y}) scale(${insetIn}) translate(${-INSET.x} ${-INSET.y})`}
            >
              <defs>
                <clipPath id="s12-inset">
                  <circle cx={INSET.x} cy={INSET.y} r={INSET.r} />
                </clipPath>
              </defs>
              <circle
                cx={INSET.x}
                cy={INSET.y}
                r={INSET.r + 10}
                fill={PITCH.light}
              />
              <g clipPath="url(#s12-inset)">
                <rect
                  x={INSET.x - INSET.r}
                  y={INSET.y - INSET.r}
                  width={INSET.r * 2}
                  height={INSET.r * 2}
                  fill={PITCH.stands}
                />
                {world(insetView, false)}
              </g>
              <text
                x={INSET.x}
                y={INSET.y - INSET.r + 46}
                fill={PITCH.chalk}
                fontFamily={FONTS.hud}
                fontWeight={700}
                fontSize={30}
                textAnchor="middle"
                letterSpacing={3}
                opacity={0.9}
              >
                FAR POST
              </text>
            </g>
          </g>
        ) : null}
        <Label
          x={INSET.x}
          y={INSET.y + INSET.r + 58}
          text="Comes home"
          at={tHome + 2}
          until={END + 20}
          size={42}
          bg={PITCH.light}
          color={PITCH.sky}
        />
      </g>
    );
  }

  // ---------------- The practice board ----------------
  // Ball spot: 20 m, then 10 m (along the target line), then back to 20 m.
  const spotT = keys(
    frame,
    [slide10, slide10 + 22, slideBack, slideBack + 20],
    [0, 1, 1, 0],
    EASE.standard,
  );
  const spotW = { x: SPOT10.x * spotT, y: SPOT10.y * spotT };
  const spot = B(spotW.x, spotW.y);
  // Flag: 20 m aim point, then the 10 m aim point.
  const flagY = keys(
    frame,
    [flagIn, flagIn + 22],
    [FLAG20, FLAG10],
    EASE.standard,
  );
  const flagO =
    frame < slideBack ? 1 : 1 - progress(frame, slideBack, 8, EASE.exit);
  const flagDrop = pop(frame, flagAt, { stiffness: 260, damping: 14 });
  const flagQ = B(GL, flagY);
  // Standing foot: beside the ball on its left, turns like a compass needle.
  const aimAng = (tx: number, ty: number) =>
    (Math.atan2(tx - spotW.x, ty - spotW.y) * 180) / Math.PI; // screen angle from "up", clockwise
  const footTarget =
    frame < tMistake ? aimAng(GL, flagY) : aimAng(GL, FAR_POST);
  const swing = (at: number, from: number) => {
    const t = Math.max(0, frame - at);
    return from * Math.exp(-t / 7) * Math.cos(t * 0.45);
  };
  const footAng =
    footTarget +
    (frame < tMistake ? swing(tPoint + 4, -48) : swing(tAiming - 2, 18));
  const footO = visible(frame, tPoint, clearMistake, 10, 8);
  const footPop = popSoft(frame, tPoint);
  // The boot stands beside the ball, on the left of the line it aims along.
  const aimW = frame < tMistake ? { x: GL, y: flagY } : { x: GL, y: FAR_POST };
  const aA = Math.atan2(aimW.y - spotW.y, aimW.x - spotW.x);
  const footQ = B(
    spotW.x - Math.sin(aA) * 0.55 - Math.cos(aA) * 0.15,
    spotW.y + Math.cos(aA) * 0.55 - Math.sin(aA) * 0.15,
  );
  // Board camera: small, slow pushes only.
  const zoom = keys(
    frame,
    [0, tAim, tPoint, slide10, tSpin, tBack + 10, tDrill + 4, boardOut],
    [1, 1, 1.04, 1.03, 1.03, 1.06, 1, 1.03],
    EASE.camera,
  );
  const focus = {
    x: keys(
      frame,
      [0, tAim, tPoint, slide10, tSpin, tBack + 10, tDrill + 4],
      [668, 668, 760, 800, 800, 1000, 668],
      EASE.camera,
    ),
    y: keys(
      frame,
      [0, tAim, tPoint, slide10, tSpin, tBack + 10, tDrill + 4],
      [585, 585, 640, 620, 600, 560, 560],
      EASE.camera,
    ),
  };

  // Chalk on the goal line: guards the near post, steps across to catch the mistake.
  const chalkY = keys(
    frame,
    [kickMiss + 8, catchF - 2],
    [NEAR_POST - 1.3, MISS_Y],
    EASE.standard,
  );
  const chalkQ = B(GL - 0.1, chalkY);
  const chalkPose = keeperPoseAt(frame, [
    [kickMiss, "stand"],
    [catchF - 6, "ready"],
    [catchF, { ...KPOSES.ready, left: 25, right: 25, stretch: 0.97 }],
    [catchF + 14, "stand"],
    [tDrill + 20, "crossed"],
  ]);
  const chalkFace = frame >= catchF && frame < tDrill ? "smug" : "flat";

  // Ghost curlers for the drill.
  const ghostN = 10;
  const ghostGap = 3;
  const count = Math.max(
    0,
    Math.min(ghostN, Math.floor((frame - ghostsAt) / ghostGap) + 1),
  );
  const bagQ = B(SPOT10.x, SPOT10.y);

  return (
    <Stage bg={PITCH.sky}>
      {/* Behind the board: the floodlit pitch from above with the same curler path (landing from s11); at the end, the behind-the-ball view. */}
      {btb ? (
        btbLayer
      ) : (
        <g
          transform={`translate(960 540) scale(${1.25 - 0.25 * progress(frame, 0, 20, EASE.camera)}) translate(-960 -540)`}
        >
          <WorldPitch
            view={UNDER}
            goalX={GL}
            gc={GC}
            colors={{ a: PITCH.grass, b: PITCH.grassDark, line: PITCH.chalk }}
          />
          <Goal3D
            view={UNDER}
            goalX={GL}
            y0={FAR_POST}
            y1={NEAR_POST}
            net
            netOpacity={0.3}
            flat={1}
          />
          <polyline
            points={REAL.slice(0, Math.ceil(REAL_GOAL_F) + 1)
              .map((p) => project(p.pos, UNDER))
              .map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`)
              .join(" ")}
            fill="none"
            stroke={PITCH.lightSoft}
            strokeWidth={7}
            strokeLinecap="round"
            opacity={0.6}
          />
          {(() => {
            const q = project(sampleAt(REAL, REAL_GOAL_F).pos, UNDER);
            return (
              <Ball
                cx={q.x}
                cy={q.y}
                r={18}
                view={UNDER}
                lineNormal={{ x: 0.3, y: 0.2, z: 0.93 }}
                angle={idle(frame, 2, 3, 0.2)}
              />
            );
          })()}
        </g>
      )}
      <PracticeBoard at={boardIn} until={boardOut}>
        <defs>
          <clipPath id="s12-panel">
            <rect
              x={PANEL.x}
              y={PANEL.y}
              width={PANEL.w}
              height={PANEL.h - 122 * shrink}
              rx={32}
            />
          </clipPath>
        </defs>
        <g clipPath="url(#s12-panel)">
          <g
            transform={`translate(${focus.x} ${focus.y}) scale(${zoom}) translate(${-focus.x} ${-focus.y})`}
          >
            <rect
              x={PANEL.x - 200}
              y={PANEL.y - 200}
              width={PANEL.w + 400}
              height={PANEL.h + 400}
              fill={PITCH.grassDark}
            />
            <WorldPitch
              view={BOARD}
              goalX={GL}
              gc={GC}
              colors={{
                a: PITCH.grass,
                b: PITCH.grassDark,
                line: PITCH.chalk,
                lineOpacity: 0.7,
              }}
              lineW={4}
            />
            <Goal3D
              view={BOARD}
              goalX={GL}
              y0={FAR_POST}
              y1={NEAR_POST}
              net
              netOpacity={0.3}
              flat={1}
            />
            {/* Target: just inside the far post. */}
            {(() => {
              const a = B(GL - 0.5, FAR_POST + 1.0);
              const b = B(GL + 0.9, FAR_POST - 0.05);
              const o = visible(frame, tAim - 8, undefined, 12);
              const pulse = 0.3 + 0.12 * Math.sin(frame / 6);
              const post = B(GL, FAR_POST);
              const ring =
                popSoft(frame, tPost - 2) *
                (1 - progress(frame, tPoint, 10, EASE.exit));
              return (
                <g opacity={o}>
                  <rect
                    x={a.x}
                    y={a.y}
                    width={b.x - a.x}
                    height={b.y - a.y}
                    rx={8}
                    fill={PITCH.light}
                    opacity={pulse}
                  />
                  <rect
                    x={a.x}
                    y={a.y}
                    width={b.x - a.x}
                    height={b.y - a.y}
                    rx={8}
                    fill="none"
                    stroke={PITCH.light}
                    strokeWidth={4}
                  />
                  {ring > 0.01 ? (
                    <circle
                      cx={post.x}
                      cy={post.y}
                      r={26 * ring + 4 * Math.sin(frame / 4)}
                      fill="none"
                      stroke={PITCH.light}
                      strokeWidth={5}
                      opacity={0.95}
                    />
                  ) : null}
                </g>
              );
            })()}
            {/* Mistake: dashed aim straight at the far post, the ghost bends back to Chalk. */}
            {frame >= tAiming && frame < tDrill ? (
              <g opacity={visible(frame, tAiming, clearMistake, 10, 8)}>
                {(() => {
                  const a = B(0, 0);
                  const b = B(GL, FAR_POST);
                  const t = progress(frame, tAiming + 2, 14, EASE.enter);
                  return (
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={a.x + (b.x - a.x) * t}
                      y2={a.y + (b.y - a.y) * t}
                      stroke={CAST.mistake}
                      strokeWidth={5}
                      strokeDasharray="14 12"
                      strokeLinecap="round"
                      opacity={0.9}
                    />
                  );
                })()}
                {frame >= kickMiss ? (
                  <BoardFlight
                    path={MISS}
                    f={frame - kickMiss}
                    stopF={MISS_GOAL_F}
                    ghost
                    trailColor={CAST.keeper}
                    trailOpacity={0.8}
                    r={13}
                  />
                ) : null}
                {(() => {
                  const a = B(GL - 1.1, FAR_POST);
                  const b = B(GL - 1.1, MISS_Y);
                  const g = pop(frame, tBack - 4, {
                    stiffness: 200,
                    damping: 16,
                  });
                  return (
                    <>
                      <Bracket
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        grow={g}
                        color={CAST.mistake}
                        width={6}
                        cap={12}
                      />
                      <Label
                        x={a.x - 130}
                        y={(a.y + b.y) / 2 - 14}
                        text={`≈ ${(MISS_Y - FAR_POST).toFixed(1)} m`}
                        at={tBack}
                        size={36}
                        bg={CAST.mistake}
                        color={PITCH.chalk}
                      />
                    </>
                  );
                })()}
              </g>
            ) : null}
            {/* Drill: dashed straight line to the far post, the bag halfway, two 10 m spans. */}
            {frame >= tDrill
              ? (() => {
                  const t = progress(frame, tDrill + 4, 18, EASE.standard);
                  const a = B(0, 0);
                  const b = B(TARGET.x * t, TARGET.y * t);
                  const s1 = alongLine(0.3, TGT_LEN / 2 - 0.15);
                  const s2 = alongLine(TGT_LEN / 2 + 0.15, TGT_LEN);
                  return (
                    <g>
                      <line
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={PITCH.chalk}
                        strokeWidth={5}
                        strokeDasharray="14 12"
                        strokeLinecap="round"
                        opacity={0.75}
                      />
                      <Span
                        a={s1.a}
                        b={s1.b}
                        text="10 m"
                        opacity={visible(frame, tHalf + 2, undefined, 12)}
                      />
                      <Span
                        a={s2.a}
                        b={s2.b}
                        text="10 m"
                        opacity={visible(frame, tHalf + 8, undefined, 12)}
                      />
                    </g>
                  );
                })()
              : null}
            {/* Aim-off shot, then the 10 m case. */}
            {frame >= tPoint && frame < tMistake ? (
              <g opacity={visible(frame, tPoint, tMistake - 6, 10, 8)}>
                <line
                  x1={spot.x}
                  y1={spot.y}
                  x2={flagQ.x}
                  y2={flagQ.y}
                  stroke={PITCH.light}
                  strokeWidth={4}
                  strokeDasharray="10 12"
                  strokeLinecap="round"
                  opacity={0.8 * progress(frame, tPoint + 18, 10)}
                />
                <Arrow
                  x1={spot.x + (flagQ.x - spot.x) * 0.04}
                  y1={spot.y + (flagQ.y - spot.y) * 0.04}
                  x2={spot.x + (flagQ.x - spot.x) * 0.3}
                  y2={spot.y + (flagQ.y - spot.y) * 0.3}
                  at={tPoint + 22}
                  until={slide10}
                  color={PITCH.accent}
                  width={8}
                />
                {frame >= kickA && frame < slide10 + 4 ? (
                  <BoardFlight
                    path={REAL}
                    f={frame - kickA}
                    stopF={REAL_GOAL_F}
                    trailColor={PITCH.accent}
                    trailOpacity={0.9}
                  />
                ) : null}
              </g>
            ) : null}
            {/* Aim bracket in front of the goal line: from where the ball goes in, out to the flag. */}
            {frame < slideBack + 4
              ? (() => {
                  const a = B(GL - BRX, LAND_Y);
                  const b = B(GL - BRX, flagY);
                  const g =
                    pop(frame, tThree + 3, { stiffness: 200, damping: 16 }) *
                    flagO;
                  return (
                    <Bracket
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      grow={g}
                      color={PITCH.light}
                      width={6}
                      cap={12}
                    />
                  );
                })()
              : null}
            {frame < slideBack + 4 ? (
              <>
                <Label
                  x={B(GL - BRX, 0).x - 96}
                  y={B(0, (LAND_Y + FLAG20) / 2).y}
                  text="≈ 3 m"
                  at={tThree + 9}
                  until={slide10}
                  size={38}
                  bg={PITCH.light}
                  color={PITCH.sky}
                />
                <Label
                  x={B(GL - BRX, 0).x - 110}
                  y={B(0, (LAND_Y + FLAG10) / 2).y + 4}
                  text={`≈ ${(LAND_Y - FLAG10).toFixed(1)} m`}
                  at={tLessWide + 8}
                  until={slideBack}
                  size={38}
                  bg={PITCH.light}
                  color={PITCH.sky}
                />
              </>
            ) : null}
            {/* Three big steps from where the ball goes in, out to the flag. */}
            {stepsAt.map((at, k) => {
              const s =
                popSoft(frame, at) *
                (1 - progress(frame, slide10, 8, EASE.exit));
              if (s <= 0.001) return null;
              const q = B(
                GL - 0.75 + (k % 2 ? 0.28 : -0.28),
                LAND_Y - STEP * (k + 1) + STEP * 0.4,
              );
              return (
                <g
                  key={k}
                  transform={`translate(${q.x} ${q.y}) scale(${s}) translate(${-q.x} ${-q.y})`}
                >
                  <Footprint
                    x={q.x}
                    y={q.y}
                    angle={180}
                    len={40}
                    mirror={k % 2 === 1}
                  />
                </g>
              );
            })}
            <Label
              x={B(GL - 3.2, 0).x}
              y={B(0, FLAG20).y + 4}
              text="≈ 3 big steps"
              at={stepsAt[2] + 6}
              until={slide10}
              size={36}
              bg={PITCH.chalk}
              color={PITCH.sky}
              anchor="end"
            />
            {/* Flag. */}
            {frame >= flagAt && flagO > 0.01 ? (
              <g
                opacity={flagO}
                transform={`translate(0 ${-80 * (1 - flagDrop)})`}
              >
                <FlagToken
                  x={flagQ.x}
                  y={flagQ.y}
                  h={64}
                  color={PITCH.accent}
                  wave={idle(frame, 1, 1.2, 4)}
                />
              </g>
            ) : null}
            {/* Tavi's kit bag for the drill, dropped halfway along the line. */}
            {frame >= bagAt
              ? (() => {
                  const drop = pop(frame, bagAt, {
                    stiffness: 240,
                    damping: 13,
                  });
                  return (
                    <g>
                      <g
                        transform={`translate(${bagQ.x} ${bagQ.y}) scale(${2 - drop}) translate(${-bagQ.x} ${-bagQ.y})`}
                        opacity={Math.min(1, (frame - bagAt) / 4)}
                      >
                        <KitBag
                          x={bagQ.x}
                          y={bagQ.y}
                          len={78}
                          angle={(-TH * 180) / Math.PI}
                        />
                      </g>
                      <Dust
                        x={bagQ.x}
                        y={bagQ.y + 6}
                        at={bagAt + 6}
                        size={34}
                        seed="bag"
                      />
                    </g>
                  );
                })()
              : null}
            {/* Ten ghost curlers around the bag. */}
            {frame >= ghostsAt
              ? Array.from({ length: ghostN }, (_, i) => {
                  const at = ghostsAt + i * ghostGap;
                  if (frame < at) return null;
                  const f = frame - at;
                  const o =
                    1 - progress(f, REAL_GOAL_F + 2, 8, EASE.exit) * 0.75;
                  return (
                    <g key={i} opacity={o}>
                      <BoardFlight
                        path={REAL}
                        f={f}
                        stopF={REAL_GOAL_F}
                        r={10}
                        trail={i === 0}
                        trailColor={PITCH.chalk}
                        trailOpacity={0.35}
                      />
                    </g>
                  );
                })
              : null}
            {/* Distance ruler along the target line: 20 m, then 10 m, then 20 m. */}
            {(() => {
              const o = visible(frame, t20 - 4, tDrill, 12, 8);
              const d0 = Math.hypot(spotW.x, spotW.y);
              const r = alongLine(d0 + 0.3, TGT_LEN);
              const k =
                1 +
                0.2 * Math.sin(Math.PI * progress(frame, t20, 16, EASE.soft));
              const mx = (r.a.x + r.b.x) / 2;
              const my = (r.a.y + r.b.y) / 2;
              return (
                <g
                  transform={`translate(${mx} ${my}) scale(${k}) translate(${-mx} ${-my})`}
                >
                  <Span
                    a={r.a}
                    b={r.b}
                    text={`${Math.round(TGT_LEN - d0)} m`}
                    opacity={o}
                    w={140}
                  />
                </g>
              );
            })()}
            {/* Standing foot and the ball on its spot. */}
            {footO > 0.01 ? (
              <g
                opacity={footO}
                transform={`translate(${footQ.x} ${footQ.y}) scale(${footPop}) translate(${-footQ.x} ${-footQ.y})`}
              >
                <TopBoot x={footQ.x} y={footQ.y} angle={footAng} len={66} />
              </g>
            ) : null}
            {(frame < kickA || frame >= slide10) &&
            !(frame >= kickMiss && frame < tDrill) ? (
              <Ball
                cx={spot.x}
                cy={spot.y}
                r={16}
                view={BOARD}
                lineNormal={{ x: 0.3, y: 0.2, z: 0.93 }}
                angle={idle(frame, 1, 3, 0.2)}
              />
            ) : null}
            {/* Chalk as a board token on his goal line, by the near post. */}
            <Keeper
              x={chalkQ.x}
              groundY={chalkQ.y + 8}
              h={112}
              pose={chalkPose}
              face={chalkFace}
              look={
                frame >= kickMiss && frame < catchF
                  ? 0.5
                  : idle(frame, 3, 3, 0.3)
              }
            />
            {frame >= catchF && frame < tDrill ? (
              <g opacity={1 - progress(frame, clearMistake, 8, EASE.exit)}>
                <circle
                  cx={chalkQ.x - 30}
                  cy={chalkQ.y - 50}
                  r={13}
                  fill={PITCH.sky}
                  opacity={0.35}
                />
                <circle
                  cx={chalkQ.x - 30}
                  cy={chalkQ.y - 50}
                  r={13}
                  fill="none"
                  stroke={CAST.keeper}
                  strokeWidth={3}
                  strokeDasharray="5 4"
                />
              </g>
            ) : null}
            <Dust
              x={chalkQ.x}
              y={chalkQ.y - 30}
              at={catchF}
              size={30}
              seed="catch"
            />
          </g>
        </g>
        {/* Counter for the drill (below the path, clear of the rulers). */}
        {frame >= ghostsAt ? (
          <g
            transform={`translate(${bagQ.x + 40} ${bagQ.y + 150}) scale(${popSoft(frame, ghostsAt)})`}
          >
            <rect
              x={-110}
              y={-46}
              width={220}
              height={92}
              rx={46}
              fill={PITCH.sky}
              opacity={0.88}
            />
            <text
              x={0}
              y={17}
              fill={PITCH.chalk}
              fontFamily={FONTS.mono}
              fontWeight={500}
              fontSize={50}
              textAnchor="middle"
            >
              {count}
              <tspan fontSize={36} fill={PITCH.lightSoft}>
                {" "}
                / 10
              </tspan>
            </text>
          </g>
        ) : null}
        {/* Stamps and the step list. */}
        <Stamp
          kind="CUE"
          x={STAMP_X}
          y={265}
          at={tPoint}
          until={tMistake - 11}
        />
        <Stamp
          kind="MISTAKE"
          x={STAMP_X}
          y={265}
          at={tMistake}
          until={tDrill - 11}
        />
        <Stamp kind="DRILL" x={STAMP_X} y={265} at={tDrill} />
        <Step
          y={390}
          text="Aim ≈ 3 m outside"
          at={tAim + 4}
          until={stepsOut}
          color={PITCH.accent}
        />
        <Step
          y={460}
          text="Standing foot → flag"
          at={tPoint + 6}
          until={stepsOut}
          color={PITCH.accent}
        />
        <Step
          y={530}
          text="Closer? Aim less wide"
          at={tCloser + 4}
          until={stepsOut}
          color={PITCH.accent}
        />
        <Step
          y={625}
          text="Not straight at the post!"
          at={tMistake + 6}
          until={stepsOut}
          color={CAST.mistake}
        />
        <Step
          y={390}
          text="Bag halfway to goal"
          at={tBag - 12}
          color={PITCH.light}
        />
        <Step
          y={460}
          text="Curl 10 around it"
          at={tCurl + 2}
          color={PITCH.light}
        />
        {/* Drill note. */}
        {(() => {
          const o = visible(frame, tHalf + 6, undefined, 12);
          return o > 0.001 ? (
            <line
              x1={COL}
              y1={515}
              x2={COL + 540 * o}
              y2={515}
              stroke={PITCH.lightSoft}
              strokeWidth={3}
              opacity={0.35}
              strokeLinecap="round"
            />
          ) : null;
        })()}
        <Step
          y={570}
          text="Start near the edge of the box."
          at={tHalf + 8}
          color={PITCH.lightSoft}
          size={32}
          dim
          dot={false}
        />
        <Step
          y={618}
          text="No bag? Use a tall cone"
          at={tHalf + 14}
          color={PITCH.lightSoft}
          size={32}
          dim
          dot={false}
        />
        <Step
          y={660}
          text="or a corner flag."
          at={tHalf + 14}
          color={PITCH.lightSoft}
          size={32}
          dim
          dot={false}
        />
        <Step
          y={708}
          text="Count how many go in."
          at={tHalf + 20}
          color={PITCH.lightSoft}
          size={32}
          dim
          dot={false}
        />
        {/* Goal safety strip along the bottom of the board. */}
        {(() => {
          const o = visible(frame, tDrill + 12, undefined, 14);
          if (o <= 0.001) return null;
          return (
            <g opacity={o} transform={`translate(0 ${(1 - o) * 24})`}>
              <rect
                x={PANEL.x}
                y={880}
                width={1730}
                height={106}
                rx={30}
                fill="#16324B"
              />
              <rect
                x={PANEL.x + 22}
                y={905}
                width={176}
                height={56}
                rx={28}
                fill={PITCH.light}
              />
              <text
                x={PANEL.x + 110}
                y={944}
                fill={PITCH.sky}
                fontFamily={FONTS.hud}
                fontWeight={700}
                fontSize={32}
                textAnchor="middle"
                letterSpacing={3}
              >
                SAFETY
              </text>
              <text
                x={PANEL.x + 226}
                y={922}
                fill={PITCH.chalk}
                fontFamily={FONTS.label}
                fontWeight={700}
                fontSize={32}
              >
                Nobody in or behind the goal. Pick a spot far from roads and
                parked cars.
              </text>
              <text
                x={PANEL.x + 226}
                y={964}
                fill={PITCH.chalk}
                fontFamily={FONTS.label}
                fontWeight={700}
                fontSize={32}
              >
                Jog and pass easy for 5 minutes. Start at half power.
              </text>
            </g>
          );
        })()}
      </PracticeBoard>

      <Sfx name="whoosh" at={boardIn} volume={0.4} />
      <Sfx name="tick" at={t20 + 2} volume={0.3} />
      <Sfx name="bell" at={tAim - 6} volume={0.25} />
      <Sfx name="thump" at={flagAt + 5} volume={0.45} />
      <Sfx name="pop-soft" at={tThree + 3} volume={0.3} />
      {stepsAt.map((at, k) => (
        <Sfx key={`st${k}`} name="chalk" at={at} volume={0.22} />
      ))}
      <Sfx name="pop" at={stepsAt[2] + 6} volume={0.25} />
      <Sfx name="stamp" at={tPoint} volume={0.5} />
      <Sfx name="tick" at={tPoint + 8} volume={0.35} />
      <Sfx name="tick" at={tPoint + 15} volume={0.3} />
      <Sfx name="tick" at={tPoint + 22} volume={0.25} />
      <Sfx name="thump" at={kickA} volume={0.4} />
      <Sfx name="air" at={kickA + 4} volume={0.25} />
      <Sfx name="whoosh" at={slide10} volume={0.3} />
      <Sfx name="whoosh" at={flagIn} volume={0.22} />
      <Sfx name="pop-soft" at={tLessWide + 8} volume={0.3} />
      <Sfx name="stamp" at={tMistake} volume={0.5} />
      <Sfx name="whoosh" at={slideBack} volume={0.25} />
      <Sfx name="thump" at={kickMiss} volume={0.35} />
      <Sfx name="whoosh" at={kickMiss + 6} volume={0.35} />
      <Sfx name="thump" at={catchF} volume={0.55} />
      <Sfx name="pop" at={tBack} volume={0.3} />
      <Sfx name="stamp" at={tDrill} volume={0.5} />
      <Sfx name="pop-soft" at={tDrill + 12} volume={0.2} />
      <Sfx name="thump" at={bagAt + 6} volume={0.35} />
      <Sfx name="pop-soft" at={tHalf + 4} volume={0.25} />
      {Array.from({ length: ghostN }, (_, i) => (
        <Sfx key={i} name="tick" at={ghostsAt + i * ghostGap} volume={0.22} />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <Sfx
          key={`t${i}`}
          name="thump"
          at={ghostsAt + i * ghostGap * 2}
          volume={0.15}
        />
      ))}
      <Sfx name="whoosh" at={boardOut - 2} volume={0.4} />
      <Sfx name="thump" at={K3} volume={0.55} />
      <Sfx name="air" at={K3 + 4} volume={0.3} />
      <Sfx name="whoosh-long" at={K3 + 10} volume={0.4} />
      <Sfx name="pop-soft" at={K3 + Math.round(27 / SLOW3)} volume={0.3} />
      <Sfx name="net" at={goalF + 2} volume={0.55} />
      <Sfx name="chalk" at={crumble} volume={0.5} />
      <Sfx name="chalk" at={crumble + 6} volume={0.35} />
      <Sfx name="pop" at={tHome + 2} volume={0.3} />
    </Stage>
  );
};
