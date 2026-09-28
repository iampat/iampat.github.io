// s01 Cold open: nine at night, an empty pitch, the line on the ball, the miss over the bar.
import React from "react";
import { random, useCurrentFrame } from "remotion";
import { Stage, cameraAt, type CamKey } from "../kit/Camera";
import { Plate, STADIUM_LAMPS } from "../kit/Plate";
import { Dust, Floodlight, Glow, GroundSide, PitchTop, Sky, Stands, StandClock, Stars } from "../kit/World";
import { Player, POSES, cyclePose, poseAt, solve, type Pose } from "../kit/Player";
import { Keeper, keeperPoseAt, type KeeperPose } from "../kit/Keeper";
import { Ball, linePoint } from "../kit/Ball";
import { Flight } from "../kit/Flight";
import { GoalSide } from "../kit/Goal";
import { Bubble, Label, SlowMoTag } from "../kit/Graphics";
import { Sfx } from "../kit/Sfx";
import { SHOTS } from "../physics/shots";
import { simulate, sampleAt } from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, clamp01, idle, lerp, progress } from "../lib/anim";
import { project, type View } from "../lib/project";
import { CAST, HEIGHT, PITCH, WIDTH } from "../theme";

const PPM = 50; // pixels per metre in the side-view world
const OX = 400; // world x of the ball spot
const GROUND = 820;
const GOAL_M = 18;
// Chalk stands one step off his line, so the near post stays clear of his outline in the side view.
const KEEPER_M = GOAL_M - 1;
const FENCE_M = GOAL_M + 3; // low fence behind the goal, with the car park past it
const X = (m: number) => OX + m * PPM;
const SIDE: View = { kind: "side", originX: OX, groundY: GROUND, ppm: PPM };
const REF_X = X(4); // camera x where all parallax layers line up

const MISS = simulate({ ...SHOTS.MISS, ground: true, duration: 3 }, 30);
const LAND_IDX = (() => {
  const i = MISS.findIndex((s) => s.bounces > 0);
  return i > 0 ? i : 57;
})();
/** Fractional sim frame where the ball centre crosses the goal line. */
const CROSS_IDX = (() => {
  const i = MISS.findIndex((s) => s.pos.x >= GOAL_M);
  if (i <= 0) return 32;
  const a = MISS[i - 1].pos.x;
  const b = MISS[i].pos.x;
  return i - 1 + (GOAL_M - a) / (b - a);
})();
const LINE_N = { x: 0.92, y: 0.25, z: 0.3 };

// Tavi carries the ball in both hands ("hold" arms) and drops it on the spot.
const TAVI_H = 1.62 * PPM;
/** Ball centre relative to Tavi: dx forward of the hips, up = height above the ground (world px). */
const heldBall = (pose: Pose) => {
  const j = solve(pose, TAVI_H);
  return { dx: (j.nh.x + j.fh.x) / 2 + 4, up: j.lowest + (pose.lift ?? 0) * TAVI_H - (j.nh.y + j.fh.y) / 2 + 3 };
};
const HOLD = heldBall(POSES.hold);
const TAVI_DROP_M = -HOLD.dx / PPM; // hips here put the held ball right over the spot
const DROP = simulate({ speed: 0, elevationDeg: -90, start: { x: 0, y: 0, z: HOLD.up / PPM }, restitution: 0.55, duration: 2 }, 30);
const DROP_B1 = Math.max(1, DROP.findIndex((s) => s.bounces >= 1));
const DROP_B2 = Math.max(DROP_B1 + 6, DROP.findIndex((s) => s.bounces >= 2));
const carryPose = (f: number, stride: number): Pose => ({
  ...cyclePose(f, "walk", stride),
  nearShoulder: POSES.hold.nearShoulder,
  nearElbow: POSES.hold.nearElbow,
  farShoulder: POSES.hold.farShoulder,
  farElbow: POSES.hold.farElbow,
});

// Slow motion for the climb, so the line visibly rolls backward. The path is always the sim;
// only the playback speed changes, with short linear ramps: [screen frames after contact, speed].
const SLOW = 0.3;
type SpeedKey = [number, number];
const speedKeys = (hold: number): SpeedKey[] => [
  [0, 1],
  [2, 1],
  [6, SLOW],
  [6 + hold, SLOW],
  [14 + hold, 1],
];
/** Sim frames played u screen frames after contact. */
const simFrames = (u: number, ks: SpeedKey[]) => {
  let t = 0;
  for (let i = 0; i < ks.length; i++) {
    const [u0, s0] = ks[i];
    if (u <= u0) break;
    const next = ks[i + 1];
    if (!next) {
      t += s0 * (u - u0);
      break;
    }
    const [u1, s1] = next;
    const e = Math.min(u, u1);
    const se = s0 + (s1 - s0) * ((e - u0) / (u1 - u0));
    t += ((s0 + se) / 2) * (e - u0);
  }
  return t;
};
/** Screen frames after contact when the sim reaches `target` frames. */
const screenFramesTo = (target: number, ks: SpeedKey[]) => {
  let u = 0;
  while (simFrames(u, ks) < target && u < 400) u += 0.25;
  return u;
};

// ---------- Background pieces for the side view ----------

const TOWERS = [-360, 180, 720, 1220, 1760, 2300];
const TOWER_BASE = GROUND - 20;
const TOWER_H = 470;

/** Dust that drifts down through the floodlight beams (far layer coordinates). */
const BeamDust: React.FC<{ frame: number }> = ({ frame }) => {
  const topY = TOWER_BASE - TOWER_H + 10;
  const botY = TOWER_BASE + 60;
  return (
    <g>
      {TOWERS.map((x, i) => {
        const dir = x > 1000 ? -1 : 1;
        return Array.from({ length: 12 }, (_, k) => {
          const s = `bd${i}-${k}`;
          const v = (random(`${s}v`) + frame * (0.0012 + random(`${s}s`) * 0.0012)) % 1;
          const left = lerp(x - 35, x + dir * 40, v);
          const right = lerp(x + 35, x + dir * 380, v);
          const cx = lerp(left, right, 0.15 + 0.7 * random(`${s}u`)) + Math.sin(frame / 37 + k) * 10;
          const tw = 0.6 + 0.4 * Math.sin(frame / 11 + random(`${s}p`) * 6.28);
          // Fade in at the lamp and out at the bottom, so the loop never pops.
          const fade = Math.sin(Math.PI * v);
          return <circle key={`${i}-${k}`} cx={cx} cy={topY + (botY - topY) * v} r={1.6 + random(`${s}r`) * 2.2} fill={PITCH.lightSoft} opacity={0.6 * tw * fade} />;
        });
      })}
    </g>
  );
};

/** Low boards along the far touchline (mid layer coordinates). */
const Boards: React.FC = () => (
  <g>
    {Array.from({ length: 30 }, (_, i) => {
      const x = -1800 + i * 200;
      return (
        <g key={i}>
          <rect x={x} y={GROUND - 36} width={184} height={32} rx={8} fill={i % 2 ? PITCH.standsLight : PITCH.stands} />
          <rect x={x + 18} y={GROUND - 25} width={40 + 60 * random(`board-${i}`)} height={9} rx={4.5} fill={i % 3 === 0 ? PITCH.teal : PITCH.chalk} opacity={0.2} />
        </g>
      );
    })}
  </g>
);

/** Grass tufts right in front of the camera (foreground layer coordinates). */
const Tufts: React.FC<{ frame: number }> = ({ frame }) => (
  <g>
    {Array.from({ length: 44 }, (_, i) => {
      const x = -2400 + i * 160 + random(`tuft-x-${i}`) * 90;
      const h = 90 + random(`tuft-h-${i}`) * 60;
      const sway = idle(frame, i, 3.4, 5);
      return (
        <g key={i} transform={`translate(${x} ${GROUND + 320})`}>
          {[-1, 0, 1].map((k) => {
            const hh = h * (k === 0 ? 1 : 0.7);
            const tip = k * 24 + (random(`tuft-l-${i}-${k}`) - 0.5) * 18 + sway;
            const b = k * 14;
            return (
              <path
                key={k}
                d={`M${b - 11},0 Q${b - 4},${-hh * 0.6} ${tip},${-hh} Q${b + 4},${-hh * 0.6} ${b + 11},0 Z`}
                fill={k === 0 ? PITCH.grassLight : PITCH.grass}
              />
            );
          })}
        </g>
      );
    })}
  </g>
);

const CAR_M = [FENCE_M + 7, FENCE_M + 12, FENCE_M + 17];

/** Car-park lamp and dark cars behind the fence. The first car's lights flash when its alarm chirps. */
const CarParkBack: React.FC<{ frame: number; alarms: number[] }> = ({ frame, alarms }) => {
  const p = PPM;
  const lampX = X(FENCE_M + 9.5);
  const blink = alarms.some((a) => frame >= a && frame < a + 16 && (frame - a) % 8 < 4) ? 1 : 0;
  const car = (m: number, body: string, key: number, alarm: number) => (
    <g key={key} transform={`translate(${X(m)} ${GROUND})`}>
      <rect x={-2.1 * p} y={-1.05 * p} width={4.2 * p} height={0.75 * p} rx={0.3 * p} fill={body} />
      <rect x={-1.2 * p} y={-1.55 * p} width={2.3 * p} height={0.65 * p} rx={0.28 * p} fill={body} />
      <rect x={-1.0 * p} y={-1.45 * p} width={0.9 * p} height={0.42 * p} rx={0.1 * p} fill={PITCH.standsLight} />
      <rect x={0.05 * p} y={-1.45 * p} width={0.85 * p} height={0.42 * p} rx={0.1 * p} fill={PITCH.standsLight} />
      {/* The roof and bonnet catch the floodlights. */}
      <rect x={-1.05 * p} y={-1.56 * p} width={2.0 * p} height={0.07 * p} rx={0.035 * p} fill={PITCH.lightSoft} opacity={0.3} />
      <rect x={-2.0 * p} y={-1.06 * p} width={0.9 * p} height={0.06 * p} rx={0.03 * p} fill={PITCH.lightSoft} opacity={0.2} />
      <rect x={1.1 * p} y={-1.06 * p} width={0.9 * p} height={0.06 * p} rx={0.03 * p} fill={PITCH.lightSoft} opacity={0.2} />
      <circle cx={-1.3 * p} cy={-0.3 * p} r={0.32 * p} fill={PITCH.skyHigh} />
      <circle cx={1.3 * p} cy={-0.3 * p} r={0.32 * p} fill={PITCH.skyHigh} />
      <circle cx={-1.3 * p} cy={-0.3 * p} r={0.12 * p} fill={PITCH.stands} />
      <circle cx={1.3 * p} cy={-0.3 * p} r={0.12 * p} fill={PITCH.stands} />
      {[-2.08, 1.96].map((lx, i) => (
        <g key={i}>
          <rect x={lx * p} y={-0.95 * p} width={0.12 * p} height={0.2 * p} rx={0.05 * p} fill={PITCH.accent} opacity={0.35 + 0.65 * alarm} />
          {alarm > 0 ? <Glow cx={(lx + 0.06) * p} cy={-0.85 * p} r={1.0 * p} color={PITCH.light} intensity={1.6 * alarm} rings={3} /> : null}
        </g>
      ))}
    </g>
  );
  return (
    <g>
      <rect x={lampX - 3} y={GROUND - 4.6 * p} width={6} height={4.6 * p} rx={3} fill={PITCH.standsLight} />
      <rect x={lampX - 0.55 * p} y={GROUND - 4.78 * p} width={0.9 * p} height={0.22 * p} rx={0.11 * p} fill={PITCH.lightSoft} opacity={0.85} />
      <Glow cx={lampX - 0.1 * p} cy={GROUND - 4.6 * p} r={2.4 * p} color={PITCH.light} intensity={0.6} rings={4} />
      {car(CAR_M[0], PITCH.skyHigh, 1, blink)}
      {car(CAR_M[1], PITCH.sky, 2, 0)}
      {car(CAR_M[2], PITCH.skyHigh, 3, 0)}
    </g>
  );
};

/** Chain-link fence behind the goal. Drawn in front of the ball, so the ball drops behind it. */
const Fence: React.FC = () => {
  const p = PPM;
  const h = 1.4 * p;
  const x0 = X(FENCE_M);
  const len = 26 * p;
  const mesh: React.ReactNode[] = [];
  for (let i = -3; i < 54; i++) {
    const x = x0 + i * 0.5 * p;
    mesh.push(<line key={`a${i}`} x1={x} y1={GROUND} x2={x + h} y2={GROUND - h} />);
    mesh.push(<line key={`b${i}`} x1={x} y1={GROUND - h} x2={x + h} y2={GROUND} />);
  }
  return (
    <g>
      <defs>
        <clipPath id="s01-fence">
          <rect x={x0} y={GROUND - h} width={len} height={h} />
        </clipPath>
      </defs>
      <g clipPath="url(#s01-fence)" stroke={PITCH.chalk} strokeWidth={1.3} opacity={0.18}>
        {mesh}
      </g>
      <g fill={PITCH.chalk} opacity={0.5}>
        <rect x={x0} y={GROUND - h - 3} width={len} height={6} rx={3} />
        {Array.from({ length: 14 }, (_, i) => (
          <rect key={i} x={x0 + i * 2 * p - 3} y={GROUND - h - 5} width={6} height={h + 5} rx={3} />
        ))}
      </g>
    </g>
  );
};

/**
 * Keeper.tsx draws crossed forearms in the pale body shade, so on his white body they read as an "X".
 * This draws the two forearms again in a darker tone, with a body-colour gap where the front one
 * crosses, then the mittens on top. Same geometry as Keeper.tsx; only for the crossed pose.
 */
const FoldedArms: React.FC<{ x: number; groundY: number; h: number; pose: KeeperPose }> = ({ x, groundY, h, pose }) => {
  const amount = clamp01((-Math.max(pose.left, pose.right) - 20) / 35);
  if (amount <= 0) return null;
  const H = h * pose.stretch;
  const W = (h * 0.34) / Math.sqrt(pose.stretch);
  const armLen = h * 0.3;
  const glove = h * 0.11;
  const shoulderY = -H * 0.72;
  const seg = (side: 1 | -1, angle: number) => {
    const a = (angle * Math.PI) / 180;
    const sx = side * W * 0.42;
    return { sx, ex: sx + side * Math.sin(a) * armLen, ey: shoulderY + Math.cos(a) * armLen };
  };
  const back = seg(1, pose.left); // his left arm: Keeper.tsx draws it first
  const front = seg(-1, pose.right);
  const sw = h * 0.07;
  const forearm = (s: { sx: number; ex: number; ey: number }, key: string) => (
    <g key={key}>
      <line x1={s.sx} y1={shoulderY} x2={s.ex} y2={s.ey} stroke={CAST.keeperShade} strokeWidth={sw} strokeLinecap="round" />
      <line x1={s.sx} y1={shoulderY} x2={s.ex} y2={s.ey} stroke={CAST.keeperEye} strokeWidth={sw} strokeLinecap="round" opacity={0.16} />
    </g>
  );
  const mitten = (side: 1 | -1, s: { ex: number; ey: number }, angle: number) => (
    <g transform={`translate(${s.ex} ${s.ey}) rotate(${-side * angle})`}>
      <rect x={-glove * 0.95} y={-glove * 0.2} width={glove * 1.9} height={glove * 2.1} rx={glove * 0.9} fill={CAST.keeper} />
      <ellipse
        cx={-side * glove * 0.95}
        cy={glove * 0.55}
        rx={glove * 0.42}
        ry={glove * 0.62}
        fill={CAST.keeper}
        transform={`rotate(${-side * 25} ${-side * glove * 0.95} ${glove * 0.55})`}
      />
      <rect x={-glove * 0.8} y={-glove * 0.35} width={glove * 1.6} height={glove * 0.5} rx={glove * 0.25} fill={CAST.keeperShade} />
      <rect x={-glove * 0.5} y={glove * 0.55} width={glove * 1.1} height={glove * 0.14} rx={glove * 0.07} fill={CAST.keeperShade} opacity={0.7} />
    </g>
  );
  // The gap line covers only the middle of the front forearm, so it never spills past his outline.
  const g0 = { x: lerp(front.sx, front.ex, 0.25), y: lerp(shoulderY, front.ey, 0.25) };
  return (
    <g opacity={amount} transform={`translate(${x + pose.shift * h} ${groundY - pose.lift * h}) rotate(${pose.lean} 0 ${-H * 0.45})`}>
      {forearm(back, "back")}
      <line x1={g0.x} y1={g0.y} x2={front.ex} y2={front.ey} stroke={CAST.keeper} strokeWidth={sw + h * 0.035} strokeLinecap="round" />
      {forearm(front, "front")}
      {mitten(1, back, pose.left)}
      {mitten(-1, front, pose.right)}
    </g>
  );
};

type CamLike = { x: number; y: number; zoom: number };

export const S01: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s01");

  // Beats (scene frames).
  const tEmpty = cue("An empty pitch");
  const tJust = cue("Just you");
  const tBall = cue("one ball");
  const tKeeper = cue("and a keeper in your head");
  const tChalk = cue("His name is Chalk");
  const tDraw = cue("You draw one line");
  const tRemember = cue("Remember that line");
  // timeline.json starts "You shoot." at 14.60 s, inside the long pause. The clip says it at
  // 13.94-14.43 s (silencedetect). "Remember" is timed well, and the true gap from it to "You"
  // is 47 frames. Math.min keeps the cue right after the shared timing is corrected.
  const tShoot = Math.min(cue("You shoot"), tRemember + 47);
  const tOver = cue("Over the bar");
  const tShout = cue("You shout at it");
  const tListen = cue("It doesn't listen");
  const tMove = cue("Chalk doesn't even move");

  // Shots.
  const shotW = tEmpty - 2; // wide side view: the empty pitch
  const shotC = tDraw - 8; // top-down close-up
  const shotD = tShoot - 19; // side view for the shot
  const kick = tShoot + 17; // contact as "shoot" ends: the long pause holds the climb

  // Hold the slow motion long enough that real time brings the ball over the bar on "Over the bar".
  let slowHold = 20;
  let bestErr = Infinity;
  for (let hold = 20; hold <= 40; hold++) {
    const err = Math.abs(kick + screenFramesTo(CROSS_IDX, speedKeys(hold)) - (tOver - 4));
    if (err < bestErr) {
      bestErr = err;
      slowHold = hold;
    }
  }
  const sk = speedKeys(slowHold);
  const slowEnd = kick + 6 + slowHold;
  const crossFrame = Math.round(kick + screenFramesTo(CROSS_IDX, sk));
  const landFrame = Math.round(kick + screenFramesTo(LAND_IDX, sk));
  const shoutCut = landFrame + 10;

  // Tavi's walk-in: he enters the wide shot on "Just you" and drops the ball on "one ball".
  const walkStart = tJust;
  const arrive = tBall + 8;
  const dropStart = arrive + 5;
  const shotB = arrive - 4; // cut to a medium on Tavi as he stops to drop the ball
  // Wide camera: a slow drift over the empty pitch, then a gentle pan left that meets Tavi.
  const wideCam = (f: number): CamLike => {
    const settle = progress(f, shotW, shotB - shotW, EASE.camera);
    const pan = progress(f, walkStart - 12, shotB - walkStart + 12, EASE.camera);
    return { x: X(17) - 0.35 * (f - shotW) - 170 * pan, y: GROUND - 250 + 6 * settle, zoom: 1 + 0.065 * settle };
  };
  const camEnter = wideCam(walkStart);
  const enterM = (camEnter.x - WIDTH / 2 / camEnter.zoom - OX) / PPM - 0.8; // just past the left edge
  const stride = Math.min(12, Math.max(6, (0.48 * (arrive - walkStart)) / (TAVI_DROP_M - enterM)));

  const sfx = (
    <>
      {STADIUM_LAMPS.map((_, i) => (
        <Sfx key={`lamp${i}`} name="light-on" at={2 + i * 7} volume={0.35} />
      ))}
      <Sfx name="whoosh-long" at={shotW - 8} volume={0.25} />
      <Sfx name="thump" at={dropStart + DROP_B1} volume={0.35} />
      <Sfx name="thump" at={dropStart + DROP_B2} volume={0.2} />
      <Sfx name="chalk" at={tKeeper + 6} volume={0.4} />
      <Sfx name="pop" at={tChalk + 4} volume={0.35} />
      <Sfx name="whoosh" at={shotC - 4} volume={0.3} />
      <Sfx name="chalk" at={tDraw + 6} volume={0.5} />
      <Sfx name="chalk" at={tDraw + 20} volume={0.45} />
      <Sfx name="bell" at={tRemember} volume={0.35} />
      <Sfx name="whoosh" at={shotD - 4} volume={0.3} />
      <Sfx name="thump" at={kick} volume={0.55} />
      <Sfx name="whoosh-long" at={kick + 2} volume={0.4} />
      <Sfx name="whoosh" at={crossFrame - 6} volume={0.35} />
      <Sfx name="alarm" at={landFrame} volume={0.3} />
      <Sfx name="pop" at={tShout} volume={0.35} />
      <Sfx name="alarm" at={tListen} volume={0.3} />
      <Sfx name="blip" at={tMove + 10} volume={0.3} />
      <Sfx name="whoosh" at={cue.frames - 14} volume={0.35} />
    </>
  );

  // ---------- Shot A: the stadium plate, lights on one by one ----------
  if (frame < shotW) {
    const push = progress(frame, 0, shotW, EASE.camera);
    const zoom = 1 + 0.04 * push;
    return (
      <Stage bg={PITCH.skyHigh}>
        <g transform={`translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${zoom}) translate(${-WIDTH / 2 - 20 * push} ${-HEIGHT / 2 + 10 * push})`}>
          <Plate name="stadium-off" />
          <Stars count={40} maxY={250} seed="s01a" />
          {STADIUM_LAMPS.map((l, i) => {
            const on = progress(frame, 2 + i * 7, 5, EASE.enter);
            return (
              <g key={i} opacity={on}>
                <rect x={l.x - 70} y={l.y - 46} width={140} height={92} rx={22} fill={PITCH.lightSoft} />
                <Glow cx={l.x} cy={l.y} r={175} color={PITCH.lightSoft} intensity={1.1} rings={4} />
              </g>
            );
          })}
          <StandClock x={960} y={392} r={40} hours={21} />
          {STADIUM_LAMPS.map((l, i) =>
            Array.from({ length: 9 }, (_, k) => {
              const on = progress(frame, 6 + i * 7, 10);
              const sx = l.x + (random(`m${i}-${k}-x`) - 0.5) * 260 + Math.sin(frame / 40 + k) * 18;
              const sy = l.y + 60 + ((random(`m${i}-${k}-y`) * 300 + frame * (0.6 + random(`m${i}-${k}-v`) * 0.8)) % 320);
              return <circle key={`${i}-${k}`} cx={sx} cy={sy} r={2 + random(`m${i}-${k}-r`) * 2.5} fill={PITCH.lightSoft} opacity={0.5 * on} />;
            }),
          )}
        </g>
        {sfx}
      </Stage>
    );
  }

  // ---------- Shot C: top-down close-up, drawing the line ----------
  if (frame >= shotC && frame < shotD) {
    const draw = progress(frame, tDraw + 6, 34, EASE.soft);
    // The line glows on "Remember that line" and settles before the cut to the shot.
    const glow = progress(frame, tRemember, 10) * (1 - progress(frame, tRemember + 20, 8));
    const top: View = { kind: "top", originX: 0, originY: 0, ppm: 1 };
    const r = 230;
    const tip = linePoint(top, r, draw * Math.PI * 2, LINE_N);
    const zoom = 1 + 0.05 * progress(frame, shotC, shotD - shotC, EASE.camera);
    return (
      <Stage bg={PITCH.grassDark}>
        <g transform={`translate(960 540) scale(${zoom}) translate(-960 -540)`}>
          <PitchTop view={{ kind: "top", originX: 960, originY: 540, ppm: 60 }} goalX={30} chalkOpacity={0} />
          <g opacity={1 - 0.2 * glow}>
            <circle cx={960 + 30} cy={540 + 34} r={r} fill="#0B3F31" opacity={0.6} />
          </g>
          <rect x={-200} y={-200} width={WIDTH + 400} height={HEIGHT + 400} fill={PITCH.sky} opacity={0.35 * glow} />
          {glow > 0 ? <Glow cx={960} cy={540} r={r * 1.6} color={PITCH.chalk} intensity={glow * 1.4} rings={5} /> : null}
          <Ball cx={960} cy={540} r={r} view={top} axis={{ x: 0, y: 0, z: 1 }} angle={0} lineNormal={LINE_N} lineDraw={draw} />
          {draw > 0 && draw < 1 ? (
            <g transform={`translate(${960 + tip.x} ${540 + tip.y}) rotate(-35)`}>
              <rect x={-12} y={-150} width={24} height={150} rx={12} fill={PITCH.chalk} />
              <rect x={-12} y={-150} width={24} height={40} rx={12} fill={PITCH.accent} />
            </g>
          ) : null}
        </g>
        {sfx}
      </Stage>
    );
  }

  // ---------- Shots W, B and D: the side-view pitch world ----------
  const inW = frame < shotB;
  const inIntro = frame < shotC; // W or B
  const inD = !inIntro;

  // Ball flight on the remapped clock (slow climb, then real time).
  const u = frame - kick;
  const sim = simFrames(u, sk);
  const bp = project(sampleAt(MISS, sim).pos, SIDE);

  // Camera keys in world pixels.
  const keysB: CamKey[] = [
    { f: shotB, x: X(-0.6), y: GROUND - 58, zoom: 4.0 },
    { f: tKeeper - 4, x: X(-0.3), y: GROUND - 55, zoom: 3.8 },
    { f: tKeeper + 30, x: X(KEEPER_M + 0.4), y: GROUND - 80, zoom: 2.6 },
    { f: tChalk + 40, x: X(KEEPER_M + 0.5), y: GROUND - 90, zoom: 2.7 },
  ];
  const keysD: CamKey[] = [
    { f: shotD, x: X(-2.6), y: GROUND - 60, zoom: 3.8 },
    { f: kick, x: X(-0.8), y: GROUND - 70, zoom: 3.2 },
  ];
  let cam: CamLike = inW ? wideCam(frame) : inIntro ? cameraAt(frame, keysB) : cameraAt(frame, keysD);
  if (inD && frame >= kick && frame < shoutCut) {
    // Close tracking shot on the ball as it climbs, then out wide to see it clear the bar.
    // Going wide, the camera leads the ball a little, so the goal and Chalk come into frame whole.
    const base = cameraAt(kick, keysD);
    const k = progress(frame, kick + 1, 12, EASE.camera);
    const w = progress(frame, slowEnd - 10, 26, EASE.camera);
    const trackX = Math.max(X(-1), Math.min(bp.x + 2.5 * PPM * w, X(GOAL_M + 9)));
    const trackY = Math.min(GROUND - 100, bp.y + 40);
    cam = {
      x: lerp(lerp(base.x, bp.x, k), trackX, w),
      y: lerp(lerp(base.y, bp.y + 10, k), trackY, w),
      zoom: lerp(lerp(base.zoom, 4.8, k), 1.35, w),
    };
  }
  if (inD && frame >= shoutCut) {
    cam = cameraAt(frame, [
      { f: shoutCut, x: X(-1.3), y: GROUND - 80, zoom: 3.1 },
      { f: tMove - 6, x: X(-1.0), y: GROUND - 80, zoom: 3.0 },
      { f: tMove + 18, x: X(KEEPER_M + 0.4), y: GROUND - 90, zoom: 2.8 },
    ]);
  }
  const endPush = progress(frame, cue.frames - 14, 14, EASE.standard);
  if (endPush > 0) {
    cam = { x: cam.x + (X(-0.25) - cam.x) * endPush, y: cam.y + (GROUND - 12 - cam.y) * endPush, zoom: cam.zoom + (9 - cam.zoom) * endPush };
  }
  const horizonY = HEIGHT / 2 + (GROUND - cam.y) * cam.zoom;
  const worldT = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;
  /** A depth layer pinned to the horizon: `pan` is its share of the camera move, `grow` its share of the zoom. */
  const layerT = (pan: number, grow: number) =>
    `translate(${WIDTH / 2} ${horizonY}) scale(${1 + (cam.zoom - 1) * grow}) translate(${-WIDTH / 2 - (cam.x - REF_X) * pan} ${-GROUND})`;

  // Tavi.
  const walkT = clamp01((frame - walkStart) / (arrive - walkStart));
  const taviXB = X(lerp(enterM, TAVI_DROP_M, walkT));
  const poseB: Pose =
    frame < arrive - 6
      ? carryPose(frame - walkStart, stride)
      : poseAt(frame, [
          [arrive - 6, carryPose(arrive - 6 - walkStart, stride)],
          [arrive, "hold"],
          [dropStart, "hold"],
          [dropStart + 12, "stand"],
        ]);
  const runStart = kick - 26;
  const taviXD = frame < runStart ? X(-3.2) : X(-3.2 + 2.6 * progress(frame, runStart, kick - runStart - 2, EASE.soft));
  // The follow-through plays on the same slowed clock as the ball.
  const pf = frame < kick ? frame : kick + sim;
  const poseD =
    frame >= shoutCut
      ? poseAt(frame, [[shoutCut, "stand"], [tShout - 2, "shout"], [tListen + 10, "shout"], [tListen + 20, "shrug"]])
      : poseAt(pf, [
          [runStart, "ready"],
          [runStart + 6, cyclePose(6, "run", 7)],
          [runStart + 13, cyclePose(13, "run", 7)],
          [kick - 6, "plant"],
          [kick, "leanBack"],
          [kick + 12, "follow"],
        ]);
  const taviX = inIntro ? taviXB : taviXD;
  const pose = inIntro ? poseB : poseD;
  const face = inD && frame >= tShout - 2 && frame < tListen + 12 ? "shout" : inD && frame >= runStart && frame < kick + 6 ? "focus" : "neutral";
  const showTavi = !inW || frame >= walkStart;

  // The ball before the kick: carried and dropped in W/B, resting on the spot in D.
  let introBall: { x: number; y: number } | null = null;
  if (inIntro && frame >= walkStart) {
    if (frame < dropStart) {
      const hb = heldBall(poseB);
      introBall = { x: taviXB + hb.dx, y: GROUND - hb.up };
    } else {
      introBall = project(sampleAt(DROP, frame - dropStart).pos, SIDE);
    }
  }
  const restBall = project({ x: 0, y: 0, z: 0.11 }, SIDE);

  // Chalk. No mouth (character spec): "thinking" gives the raised brow on its own.
  const rise = inIntro ? progress(frame, tKeeper + 6, 26, EASE.standard) : 1;
  const kPoseBase = keeperPoseAt(frame, [
    [tChalk - 2, "stand"],
    [tChalk + 6, "wide"],
    [tChalk + 12, "ready"],
    [tChalk + 20, "stand"],
    [tListen, "stand"],
    [tListen + 14, "crossed"],
  ]);
  const kPose: KeeperPose = { ...kPoseBase, stretch: kPoseBase.stretch * (1 + idle(frame, 5, 2.6, 0.006)) };
  const kFace = frame >= tListen + 8 || (frame >= tChalk && frame < tChalk + 30) ? "thinking" : "flat";
  const keeperX = X(KEEPER_M);
  const keeperH = 2.1 * PPM;

  return (
    <Stage bg={PITCH.sky}>
      <Sky />
      <Stars count={90} maxY={horizonY - 300} seed="s01b" />
      {/* Layer 0.2x: the stand, the floodlight towers, and dust in their beams. */}
      <g transform={layerT(0.2, 0.05)}>
        <g transform={`translate(${WIDTH / 2} 0) scale(2.2 1) translate(${-WIDTH / 2} 0)`}>
          <Stands baseY={GROUND} lit={1} />
        </g>
        {TOWERS.map((x) => (
          <Floodlight key={x} x={x} baseY={TOWER_BASE} height={TOWER_H} on={1} beam flip={x > 1000} />
        ))}
        <BeamDust frame={frame} />
      </g>
      {/* Layer 0.5x: boards on the far touchline. */}
      <g transform={layerT(0.5, 0.3)}>
        <Boards />
      </g>
      {/* Layer 1x: the pitch. */}
      <g transform={worldT}>
        <GroundSide groundY={GROUND} vanishX={X(8)} />
        <CarParkBack frame={frame} alarms={[landFrame, tListen]} />
        <GoalSide view={SIDE} goalX={GOAL_M} />
        {rise > 0.001 ? (
          <>
            <Keeper x={keeperX} groundY={GROUND} h={keeperH} pose={kPose} face={kFace} rise={rise} look={frame >= tMove ? -0.6 : idle(frame, 2, 3, 0.3)} />
            <FoldedArms x={keeperX} groundY={GROUND} h={keeperH} pose={kPose} />
          </>
        ) : null}
        {inIntro ? <Dust x={keeperX} y={GROUND} at={tKeeper + 6} size={60} seed="rise" /> : null}
        {inIntro ? <Dust x={keeperX} y={GROUND - 0.9 * PPM} at={tChalk + 6} size={50} seed="clap" /> : null}
        {showTavi ? <Player x={taviX} groundY={GROUND} h={TAVI_H} pose={pose} face={face} /> : null}
        {inIntro ? (
          introBall ? <Ball cx={introBall.x} cy={introBall.y} r={0.11 * PPM} view={SIDE} lineNormal={LINE_N} showLine={false} /> : null
        ) : frame >= kick ? (
          <Flight
            path={MISS}
            view={SIDE}
            at={kick}
            frame={kick + sim}
            r={0.11 * PPM * 1.1}
            trailColor={PITCH.lightSoft}
            trailOpacity={0.45 * (1 - progress(frame, landFrame + 6, 20))}
            lineNormal={LINE_N}
          />
        ) : (
          <Ball cx={restBall.x} cy={restBall.y} r={0.11 * PPM} view={SIDE} lineNormal={LINE_N} />
        )}
        <Fence />
        {inIntro ? <Label x={keeperX} y={GROUND - 2.9 * PPM} text="CHALK" at={tChalk + 4} size={14} /> : null}
        {inD && frame >= shoutCut ? (
          <Bubble x={taviX + 70} y={GROUND - 2.25 * PPM} tx={taviX + 16} ty={GROUND - 1.62 * PPM} text="DOWN! DOWN!" at={tShout} until={tListen + 6} size={16} />
        ) : null}
      </g>
      {/* Layer 1.3x: grass tufts close to the camera (in frame only in the wide shots). */}
      <g transform={layerT(1.3, 1.3)}>
        <Tufts frame={frame} />
      </g>
      {inD && frame >= kick && frame < shoutCut ? <SlowMoTag at={kick + 4} until={slowEnd} /> : null}
      {sfx}
    </Stage>
  );
};
