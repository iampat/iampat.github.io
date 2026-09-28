// s11 Why curlers look late. The scene opens out of the s10 x-ray air: the teal fades and the
// camera tilts down past the floodlights into a keeper's-eye view on the ball's launch line. The
// ball swerves late. The camera rises to a top-down map (the same free kick as s08: ball in the
// left channel, far post = right post): the bend stays the same (curve gauge, a spin-push arrow
// that stays on), the gap from the launch line grows with distance (x4 for twice the distance),
// a goal frame for scale, then the keeper's-eye view again: the ghost flies straight at Chalk,
// the real ball slides sideways late, into the far post.
// Palette: Open Sky tones on a navy "diagram" night with floodlights and green-tinted grass.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage } from "../kit/Camera";
import { Dust, Floodlight, Stands, Stars } from "../kit/World";
import { XRayGrid } from "../kit/XRay";
import { AirFlow } from "../kit/AirFlow";
import { Ball } from "../kit/Ball";
import { Keeper, KPOSES } from "../kit/Keeper";
import { GOAL_W } from "../kit/Goal";
import { Label } from "../kit/Graphics";
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
import { CAST, FONTS, PITCH, SKY } from "../theme";
import {
  Bracket,
  CurveGauge,
  Goal3D,
  Haze,
  Mitten,
  PushArrow,
  SlowTag,
  WorldPitch,
  depthOf,
  horizonY,
  linePath,
  mixHex,
  pcamAt,
  viewOf,
  type PCam,
  type PKey,
} from "../kit/ext/s11-s12-world";
import {
  FAR_POST,
  GC,
  GL,
  NEAR_POST,
  camOnPitch,
  crossPitchX,
  pathOnPitch,
} from "../kit/ext/s11-s12-layout";

// Two frames. Pitch frame (goal, pitch lines): see s11-s12-layout. Sim frame (flight, map
// overlays): the kick at the origin, x along the target line (the ball goes in just inside the
// far post). One camera, two views: `viewS` draws sim points, `viewW` draws pitch points.
const AZ = (SHOTS.CURLER.azimuthDeg * Math.PI) / 180; // launch line: 8 degrees right of the target line
const TAN = Math.tan(AZ);
const lineY = (x: number) => x * TAN;

const REAL = simulate({ ...SHOTS.CURLER, ground: false, duration: 1.7 }, 30);
const trackY = (x: number) => crossingAtX(REAL, x)?.pos.y ?? 0;
const crossF = (path: BallState[], x: number) => {
  for (let i = 1; i < path.length; i++) {
    if (path[i - 1].pos.x < x && path[i].pos.x >= x)
      return (
        i - 1 + (x - path[i - 1].pos.x) / (path[i].pos.x - path[i - 1].pos.x)
      );
  }
  return path.length - 1;
};
// Sample where the curler crosses the goal line (just inside the far post).
const GOAL_F = crossPitchX(pathOnPitch(REAL), GL)?.f ?? crossF(REAL, 20);
const G10 = trackY(10) - lineY(10); // gap at 10 m (about 0.68 m)
const G20 = trackY(20) - lineY(20); // gap at 20 m (about 2.7 m)

// Horizontal bend radius along the path (from the samples), for the curve gauge.
const RADIUS = REAL.map((s, i) => {
  const a = REAL[Math.min(i + 1, REAL.length - 1)];
  const b = REAL[Math.max(i - 1, 0)];
  const ax = (a.vel.x - b.vel.x) * 15;
  const ay = (a.vel.y - b.vel.y) * 15;
  const k =
    (s.vel.x * ay - s.vel.y * ax) / Math.pow(s.vel.x ** 2 + s.vel.y ** 2, 1.5);
  return k > 1e-6 ? 1 / k : 1e3;
});
RADIUS[0] = RADIUS[1];

// Circle through the start, middle and end of the ground track (about 150 m across).
const CIRCLE = (() => {
  const A = REAL[0].pos;
  const B = REAL[Math.round(GOAL_F / 2)].pos;
  const C = sampleAt(REAL, GOAL_F).pos;
  const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
  const s2 = (p: Vec3) => p.x * p.x + p.y * p.y;
  const ux =
    (s2(A) * (B.y - C.y) + s2(B) * (C.y - A.y) + s2(C) * (A.y - B.y)) / d;
  const uy =
    (s2(A) * (C.x - B.x) + s2(B) * (A.x - C.x) + s2(C) * (B.x - A.x)) / d;
  return { x: ux, y: uy, r: Math.hypot(A.x - ux, A.y - uy) };
})();

// Palette: a navy diagram night with floodlights. Grass keeps a green tint, lines are chalk-white.
const GRASS = {
  a: mixHex(PITCH.grass, SKY.deep, 0.18),
  b: mixHex(PITCH.grassDark, SKY.deep, 0.18),
  line: SKY.cloud,
};
const NIGHT_TOP = mixHex(SKY.deep, "#000000", 0.5);

// Cameras (sim frame).
// Keeper's eye on the launch line, 25 m from the ball (about 3 m behind the goal line, outside the
// far post), in a crouch (eye 1.2 m up, about the height the ball goes in). The straight line comes right
// at you; the real ball slides sideways, late, into the far post on the right of the frame.
const POV_D = 25;
const POV: PCam = {
  x: POV_D * Math.cos(AZ),
  y: POV_D * Math.sin(AZ),
  z: 1.2,
  yaw: (AZ * 180) / Math.PI + 180,
  pitch: 0,
  focal: 1300,
  cy: 470,
};
// Opening: looking up at the floodlights (out of the s10 air), then a tilt down into the keeper view.
const POV_UP: PCam = { ...POV, pitch: 19, focal: 1150 };
const TOP: PCam = {
  x: 10,
  y: -1.3,
  z: 15.8,
  yaw: 90,
  pitch: -89.99,
  focal: 1200,
  cy: 540,
};
const TOP2: PCam = { ...TOP, x: 10.6, z: 15.0 };
// The 20 m end: a gentle pan right with a small push, so the goal frame fits beside the bracket.
const ZOOM: PCam = {
  x: 19.3,
  y: -1.55,
  z: 13.0,
  yaw: 90,
  pitch: -89.99,
  focal: 1200,
  cy: 540,
};

// The straight line Chalk expects: the same flight with the sideways drift taken away (same height,
// same timing, straight along the launch line). Only the sideways slide tells the two balls apart.
// After the goal-line moment it keeps coming at chest height, into Chalk's mittens.
const GHOST_STOP = 2.4; // metres in front of Chalk's eyes
const GHOST: BallState[] = (() => {
  const along = (p: Vec3) => p.x * Math.cos(AZ) + p.y * Math.sin(AZ);
  const at = (a: number, z: number, s: BallState): BallState => ({
    ...s,
    pos: { x: a * Math.cos(AZ), y: a * Math.sin(AZ), z },
  });
  const n = Math.ceil(GOAL_F);
  const out = REAL.slice(0, n).map((s) => at(along(s.pos), s.pos.z, s));
  const g = sampleAt(REAL, GOAL_F);
  const a0 = along(g.pos);
  const v = along(REAL[n].pos) - along(REAL[n - 1].pos); // metres per sample at the line
  for (let k = n; k < 200; k++) {
    const a = a0 + (k - GOAL_F) * v;
    out.push(at(Math.min(a, POV_D - GHOST_STOP), g.pos.z, REAL[Math.min(k, REAL.length - 1)]));
    if (a >= POV_D - GHOST_STOP) break;
  }
  return out;
})();
const GHOST_END = GHOST.length - 1;

// s10 ends on the ball in the Air Crowd (x-ray, top view): s11 opens on it and pulls back.
const AIR = { x: 904, y: 524, r: 144 };
const TOP_UNIT: View = { kind: "topUp", originX: 0, originY: 0, ppm: 1 };
const TILT = 22; // opening tilt-down, frames
const K1 = 18; // first kick (keeper's eye, slow motion), once the tilt has landed
const SLOW = 0.62;
const TAIL = 12; // comet tail in the keeper views, samples

/** A ball trail in any view: one segment per sample, thicker when close. `flat` squashes height to the ground. */
const Trail: React.FC<{
  path: BallState[];
  upto: number;
  view: View;
  flat: number;
  color: string;
  wMul?: number;
  from?: number;
  /** Fade the older end of the trail (a comet tail). */
  fade?: boolean;
}> = ({ path, upto, view, flat, color, wMul = 1, from = 0, fade = false }) => {
  if (upto <= from) return null;
  const pts: Vec3[] = [];
  const f0 = Math.max(0, from);
  pts.push(sampleAt(path, f0).pos);
  for (let i = Math.floor(f0) + 1; i < upto && i < path.length; i++)
    pts.push(path[i].pos);
  pts.push(sampleAt(path, upto).pos);
  const P = pts.map((p) => ({ x: p.x, y: p.y, z: p.z * (1 - flat) }));
  const segs = [];
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i];
    const b = P[i + 1];
    if (depthOf(a, view) < 0.9 || depthOf(b, view) < 0.9) continue;
    const pa = project(a, view);
    const pb = project(b, view);
    const w =
      Math.min(14, Math.max(3, 0.085 * Math.min(pa.scale, pb.scale))) * wMul;
    const o = fade ? 0.15 + 0.85 * ((i + 1) / (P.length - 1)) : 1;
    segs.push(
      <line
        key={i}
        x1={pa.x}
        y1={pa.y}
        x2={pb.x}
        y2={pb.y}
        stroke={color}
        strokeWidth={w}
        strokeLinecap="round"
        opacity={o}
      />,
    );
  }
  return <g>{segs}</g>;
};

/** The ball at sample f of a path (never eased: it follows the sim). */
const PathBall: React.FC<{
  path: BallState[];
  f: number;
  view: View;
  flat?: number;
  minR?: number;
  ghost?: boolean;
}> = ({ path, f, view, flat = 0, minR = 7, ghost = false }) => {
  const s = sampleAt(path, f);
  const p = { x: s.pos.x, y: s.pos.y, z: s.pos.z * (1 - flat) };
  if (depthOf(p, view) < 0.9) return null;
  const q = project(p, view);
  const r = Math.max(minR, 0.11 * q.scale);
  if (ghost) {
    return (
      <g>
        <circle cx={q.x} cy={q.y} r={r} fill={CAST.keeper} opacity={0.18} />
        <circle
          cx={q.x}
          cy={q.y}
          r={r}
          fill="none"
          stroke={CAST.keeper}
          strokeWidth={Math.max(2.5, r * 0.14)}
          strokeDasharray={`${r * 0.5} ${r * 0.35}`}
          opacity={0.8}
        />
      </g>
    );
  }
  return (
    <Ball
      cx={q.x}
      cy={q.y}
      r={r}
      view={view}
      axis={s.spin}
      angle={spinAngleAt(path, f)}
      lineNormal={{ x: 0.2, y: 0.3, z: 0.93 }}
    />
  );
};

/** A round "!" badge that pops in. */
const Bang: React.FC<{
  x: number;
  y: number;
  at: number;
  until: number;
  r?: number;
}> = ({ x, y, at, until, r = 50 }) => {
  const frame = useCurrentFrame();
  const s =
    pop(frame, at, { stiffness: 320, damping: 14 }) *
    (1 - progress(frame, until, 7, EASE.exit));
  if (s <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y + idle(frame, 3, 1.4, 4)}) scale(${s})`}>
      <circle r={r} fill={SKY.accent} />
      <text
        y={r * 0.38}
        fill={SKY.cloud}
        fontFamily={FONTS.title}
        fontWeight={800}
        fontSize={r * 1.2}
        textAnchor="middle"
      >
        !
      </text>
    </g>
  );
};

export const S11: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s11");

  // Beats (exact word cues).
  const tDont = cue("They don't");
  const tSame = cue("They bend about the same");
  const tWay = cue.wordEnd("the whole way");
  const tBut = cue("But the gap");
  const tFaster = cue("faster and faster");
  const tFaster2 = cue("and faster");
  const tTwenty = cue("From twenty metres");
  const tTheGap = cue("the gap is almost");
  const tAlmost = cue("almost three metres");
  const tThree = cue("three metres");
  const tKeeper = cue("So to the keeper");
  const END = cue.frames;

  const swoopA = Math.max(tDont + 4, K1 + Math.ceil(GOAL_F / SLOW) + 1); // rise to top-down after the ball is in
  const swoopB = swoopA + 32;
  const mapIn = swoopB - 2;
  // Marker, gauge and spin-push arrow ride along the path through "the whole way".
  const rideAt = Math.max(tSame + 3, swoopB);
  const RIDE = GOAL_F / Math.max(40, tWay - rideAt);
  const rideEnd = rideAt + Math.ceil(GOAL_F / RIDE);
  const ruler = tBut + 4; // launch line drops in
  const brAt = [ruler + 12, ruler + 26, ruler + 42, ruler + 58];
  const split = tFaster + 2;
  const glow = tFaster2 + 2;
  const panA = split + 26; // slow pan to the 20 m end
  const panB = tTheGap + 4;
  const labelAt = tTheGap - 4; // "≈ 2.7 m"
  const tip0 = Math.max(labelAt + 6, tAlmost - 16); // goal frame tips and lands on "almost"
  const tipLand = tip0 + 16;
  const diveA = tKeeper; // dive down into the keeper view
  const diveB = diveA + 24;
  const out = diveA; // map overlays fade as the dive starts
  const K2 = diveB - 2; // second kick (keeper view, real time)

  // Camera (sim frame).
  const breathe = {
    yaw: idle(frame, 1, 3.4, 0.25),
    pitch: idle(frame, 2, 2.9, 0.15),
  };
  const camKeys: PKey[] = [
    { f: 0, ...POV_UP },
    { f: TILT, ...POV },
    { f: swoopA, ...POV, focal: 1180 },
    { f: swoopB, ...TOP },
    { f: panA, ...TOP2 },
    { f: panB, ...ZOOM },
    { f: diveA, ...ZOOM, z: ZOOM.z - 0.6 },
    { f: diveB, ...POV },
    { f: END, ...POV, focal: 1370 },
  ];
  const cam0 = pcamAt(frame, camKeys);
  const povness =
    1 -
    progress(frame, swoopA, 12, EASE.soft) +
    progress(frame, diveB - 10, 10, EASE.soft);
  const camS: PCam = {
    ...cam0,
    yaw: cam0.yaw + breathe.yaw * povness,
    pitch: cam0.pitch + breathe.pitch * povness,
  };
  const view = viewOf(camS); // sim-frame points
  const viewW = viewOf(camOnPitch(camS)); // pitch-frame points (the same camera)
  const hy = horizonY(camS);
  const flat =
    progress(frame, swoopA, 28, EASE.camera) *
    (1 - progress(frame, diveA, 24, EASE.camera));
  const mapT = frame >= swoopB - 1 && frame < diveA + 10; // straight-down map: overlays valid
  const outO = 1 - progress(frame, out, 8, EASE.exit);
  const P = (x: number, y: number, z = 0) => project({ x, y, z }, view);

  // Flight 1 (slow motion): sample index along the path. The ball rests on its spot before the kick.
  const f1 = Math.max(0, (frame - K1) * SLOW);
  const f1Ball = Math.min(f1, REAL.length - 1);
  const trail1Upto = Math.min(f1, GOAL_F + 0.6);
  const trail1Op = 1 - progress(frame, diveB - 12, 10, EASE.exit);
  // Comet tail in the keeper view; the whole path unrolls as the camera rises to the map.
  const trail1From = Math.max(0, trail1Upto - TAIL - 60 * flat);
  // Flight 2 (real time).
  const f2 = Math.max(0, frame - K2);

  // "!" position: where the ball is when the swerve shows.
  const bangF = K1 + Math.round(30 / SLOW);
  const bangBall = project(
    sampleAt(REAL, (bangF - K1) * SLOW).pos,
    viewOf(pcamAt(bangF, camKeys)),
  );

  // Map overlays.
  const circleO = visible(frame, mapIn + 4, tTwenty, 12, 10);
  const leaderO = visible(frame, mapIn + 10, tBut + 20, 12, 8);
  const markerF = Math.min(GOAL_F, Math.max(0, (frame - rideAt) * RIDE));
  const markerO = visible(frame, rideAt, rideEnd + 2, 10, 6);
  const rulerDrop = pop(frame, ruler, { stiffness: 240, damping: 17 });
  const rulerO = Math.min(1, Math.max(0, (frame - ruler) / 5)) * outO;
  const glowT =
    progress(frame, glow, 14, EASE.soft) *
    (1 - progress(frame, tTwenty + 30, 10, EASE.exit));
  const copiesO = 1 - progress(frame, tTwenty + 30, 8, EASE.exit);
  const tipDeg = keys(
    frame,
    [tip0, tipLand, tipLand + 4, tipLand + 9],
    [0, 90, 83, 90],
    EASE.exit,
  );
  const tipO = visible(frame, tip0 - 6, out, 8, 8);

  // Pitch colours: the chalk lines step back while the big circle is on, so the D never reads as the circle.
  const colors = {
    ...GRASS,
    lineOpacity: 0.62 - 0.34 * circleO,
  };

  // Screen helpers for the map.
  const markerS = sampleAt(REAL, markerF);
  const markerPos = markerS.pos;
  const mk = P(markerPos.x, markerPos.y);
  const gaugeVal =
    1 / RADIUS[Math.min(RADIUS.length - 1, Math.round(markerF))] / (2 / 75);
  // Spin push: sideways, to the left of the ball's way (horizontal part), the same size all flight long.
  const vh = Math.hypot(markerS.vel.x, markerS.vel.y) || 1;
  const pushTip = P(
    markerPos.x - markerS.vel.y / vh,
    markerPos.y + markerS.vel.x / vh,
  );
  const pdx = pushTip.x - mk.x;
  const pdy = pushTip.y - mk.y;
  const pl = Math.hypot(pdx, pdy) || 1;
  const pushO = visible(frame, rideAt + 4, rideEnd + 2, 8, 6);
  const pushLen = 96 * progress(frame, rideAt + 4, 10, EASE.enter);
  // The giant circle, drawn as dots in the path colour: it carries on from both ends of the path.
  const circleC = P(CIRCLE.x, CIRCLE.y);
  const circleR = CIRCLE.r * P(CIRCLE.x, CIRCLE.y).scale;
  // Leader: from the label down to the orange path itself.
  const leadS = sampleAt(REAL, GOAL_F * 0.3).pos;
  const leadPt = P(leadS.x, leadS.y);

  // Goal frame that tips over beside the 20 m bracket (true 3D, true size).
  const th = (tipDeg * Math.PI) / 180;
  const gx0 = 20.8;
  const gx1 = gx0 + GOAL_W;
  const gy = lineY(20);
  const gTop = (x: number): Vec3 => ({
    x,
    y: gy + 2.44 * Math.sin(th),
    z: 2.44 * Math.cos(th),
  });
  const gBase = (x: number): Vec3 => ({ x, y: gy, z: 0 });
  // The part of the 20 m gap that is more than a goal is tall.
  const extraO = progress(frame, tThree - 2, 10, EASE.soft) * outO;
  const extraPulse =
    1 + 0.25 * Math.sin(Math.PI * progress(frame, tThree - 2, 18, EASE.soft));

  const showBall1 = frame < swoopA + 4;
  const showNightPOV = frame >= diveB - 12;
  // The ghost has made its point once Chalk pops in: it fades, so the last frame is a clean hold.
  const catchF = K2 + GHOST_END; // the ghost reaches Chalk's chest
  const ghostO = 1 - progress(frame, catchF - 1, 6, EASE.exit);
  const ghostEnd = project(GHOST[GHOST_END].pos, view);

  // Stands and floodlights sit on the horizon behind the kicker; they slide with the camera's turn.
  const standX = ((camS.yaw - POV.yaw) * Math.PI * camS.focal) / 180;
  // In the last keeper view the chalk spots step back, so the ghost coming at Chalk never reads as "back at the spot".
  const spotO = 1 - 0.85 * progress(frame, K2 + 6, 12, EASE.soft);
  // Opening: the s10 x-ray fades away while the camera tilts down past the floodlights.
  const xrayO = 1 - progress(frame, 0, 14, EASE.soft);
  const airO = 1 - progress(frame, 1, 11, EASE.soft);
  const airS = 1 - 0.8 * progress(frame, 0, 13, EASE.camera);

  return (
    <Stage bg={SKY.deep}>
      {/* Sky: a navy diagram night, stars, the stands and their floodlights. */}
      <defs>
        <linearGradient
          id="s11-night"
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={Math.min(0, hy - 900)}
          x2={0}
          y2={Math.max(200, hy)}
        >
          <stop offset={0} stopColor={NIGHT_TOP} />
          <stop offset={1} stopColor={SKY.deep} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={1920} height={1080} fill="url(#s11-night)" />
      {hy > 0 ? (
        <Stars
          count={90}
          maxY={Math.max(0, hy - 300)}
          seed="s11n"
          color={SKY.cloud}
        />
      ) : null}
      {hy > -40 ? (
        <g transform={`translate(${standX} ${hy - 820})`}>
          <Stands baseY={820} lit={1} />
          {[160, 700, 1240, 1780].map((x, i) => (
            <Floodlight key={i} x={x} baseY={800} height={380} on={1} />
          ))}
        </g>
      ) : null}
      {/* Ground. */}
      <rect
        x={-50}
        y={Math.max(-50, hy)}
        width={2020}
        height={1200}
        fill={GRASS.b}
      />
      <WorldPitch
        view={viewW}
        goalX={GL}
        gc={GC}
        colors={colors}
        spotOpacity={spotO}
      />
      <Haze
        y={hy}
        color={mixHex(SKY.deep, PITCH.lightSoft, 0.35)}
        opacity={0.3}
        height={170}
        id="s11-haze"
      />
      {/* Kick spot. */}
      {depthOf({ x: 0, y: 0, z: 0 }, view) > 1 && spotO > 0.01 ? (
        <circle
          cx={P(0, 0).x}
          cy={P(0, 0).y}
          r={Math.max(3, 0.25 * P(0, 0).scale)}
          fill={GRASS.line}
          opacity={0.9 * spotO}
        />
      ) : null}

      {/* The real goal (pitch frame). Net only when seen from above. */}
      <g opacity={mapT ? 1 - 0.7 * progress(frame, tip0 - 8, 10) * outO : 1}>
        <Goal3D
          view={viewW}
          goalX={GL}
          y0={FAR_POST}
          y1={NEAR_POST}
          color={SKY.cloud}
          net={flat > 0.6}
          netOpacity={0.35 * flat}
          flat={flat}
        />
      </g>

      {/* Huge faint circle: the curve is one slice of it. Orange dots carry the path on, off the frame. */}
      {mapT && circleO > 0.01 ? (
        <g opacity={circleO}>
          <circle
            cx={circleC.x}
            cy={circleC.y}
            r={circleR}
            fill="none"
            stroke={SKY.accent}
            strokeWidth={6}
            strokeDasharray="1 17"
            strokeLinecap="round"
            opacity={0.75}
          />
          <line
            x1={leadPt.x + 40}
            y1={215}
            x2={leadPt.x + 4}
            y2={leadPt.y - 16}
            stroke={SKY.cloud}
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.85 * leaderO}
          />
          <circle
            cx={leadPt.x}
            cy={leadPt.y}
            r={11}
            fill="none"
            stroke={SKY.cloud}
            strokeWidth={4}
            opacity={0.85 * leaderO}
          />
        </g>
      ) : null}
      {mapT ? (
        <Label
          x={leadPt.x + 60}
          y={190}
          text="part of a circle 150 m wide"
          at={mapIn + 10}
          until={tBut + 20}
          size={36}
          color={SKY.deep}
          bg={SKY.cloud}
        />
      ) : null}

      {/* Launch line: a dashed ruler that drops in. */}
      {mapT && rulerO > 0.01 ? (
        <g opacity={rulerO} transform={`translate(0 ${-70 * (1 - rulerDrop)})`}>
          <path
            d={linePath(
              [
                { x: 0, y: 0, z: 0 },
                { x: 22.5, y: lineY(22.5), z: 0 },
              ],
              view,
            )}
            stroke={SKY.cloud}
            strokeWidth={6}
            strokeDasharray="18 14"
            strokeLinecap="round"
            fill="none"
          />
          {Array.from({ length: 23 }, (_, i) => {
            const big = i % 5 === 0 && i > 0;
            const a = P(i, lineY(i));
            const b = P(i, lineY(i) - (big ? 0.34 : 0.18));
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={SKY.cloud}
                strokeWidth={big ? 5 : 3}
                strokeLinecap="round"
                opacity={big ? 1 : 0.7}
              />
            );
          })}
          {[5, 10, 15, 20].map((m) => {
            const q = P(m, lineY(m) - 0.92);
            const k =
              m === 20
                ? 1 +
                  0.25 *
                    Math.sin(Math.PI * progress(frame, tTwenty, 16, EASE.soft))
                : 1;
            return (
              <text
                key={m}
                x={q.x}
                y={q.y}
                fill={SKY.cloud}
                fontFamily={FONTS.label}
                fontWeight={800}
                fontSize={36 * k}
                textAnchor="middle"
              >
                {m} m
              </text>
            );
          })}
        </g>
      ) : null}

      {/* Second half of the path glows (three quarters of the gap happens there). */}
      {mapT && glowT > 0.01 ? (
        <g opacity={glowT}>
          <Trail
            path={REAL}
            from={crossF(REAL, 10)}
            upto={GOAL_F}
            view={view}
            flat={1}
            color={SKY.sun}
            wMul={3.2}
          />
        </g>
      ) : null}

      {/* Path trail: a comet tail in the keeper view, the whole path on the map. */}
      <g opacity={trail1Op}>
        <Trail
          path={REAL}
          from={trail1From}
          upto={trail1Upto}
          view={view}
          flat={flat}
          color={SKY.accent}
          fade={flat < 0.99}
        />
      </g>

      {/* Gap brackets at 5, 10, 15 and 20 m. */}
      {mapT
        ? [5, 10, 15, 20].map((m, i) => {
            const a = P(m, lineY(m));
            const b = P(m, trackY(m));
            const g = pop(frame, brAt[i], { stiffness: 220, damping: 15 });
            return (
              <Bracket
                key={m}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                grow={g}
                opacity={outO}
                cap={m === 5 ? 10 : 16}
              />
            );
          })
        : null}
      {/* The top of the 20 m gap: the part that is more than a goal is tall. */}
      {mapT && extraO > 0.01 ? (
        <line
          x1={P(20, gy + 2.44).x}
          y1={P(20, gy + 2.44).y}
          x2={P(20, trackY(20)).x}
          y2={P(20, trackY(20)).y}
          stroke={SKY.accent}
          strokeWidth={13 * extraPulse}
          strokeLinecap="round"
          opacity={extraO}
        />
      ) : null}

      {/* Twice the distance, four times the gap: four copies of the 10 m bracket stack up at 20 m. */}
      {mapT && frame >= split
        ? [0, 1, 2, 3].map((i) => {
            const t = progress(frame, split + i * 4, 16, EASE.standard);
            const from = { x: 10, y0: lineY(10), y1: trackY(10) };
            const toX = 19.25;
            const toY0 = lineY(20) + i * G10;
            const x = from.x + (toX - from.x) * t;
            const y0 = from.y0 + (toY0 - from.y0) * t;
            const pad = 0.035;
            const a = P(x, y0 + pad);
            const b = P(x, y0 + G10 - pad);
            const hot = i > 0 ? glowT : 0;
            return (
              <Bracket
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                color={mixHex(SKY.cloud, SKY.sun, hot)}
                width={6}
                cap={12}
                opacity={
                  Math.min(1, (frame - split - i * 4) / 4) * copiesO * outO
                }
              />
            );
          })
        : null}
      {mapT ? (
        <Label
          x={P(18.1, lineY(20) + 2 * G10).x}
          y={P(18.1, lineY(20) + 2 * G10).y}
          text="×4"
          at={split + 20}
          until={tTwenty + 30}
          size={40}
          color={SKY.deep}
          bg={SKY.cloud}
        />
      ) : null}

      {/* Goal frame tips over and lies beside the 20 m bracket: the gap is more than a goal is tall. */}
      {mapT && tipO > 0.01 ? (
        <g opacity={tipO}>
          <path
            d={linePath([gBase(gx0), gTop(gx0), gTop(gx1), gBase(gx1)], view)}
            fill="none"
            stroke={SKY.cloud}
            strokeWidth={0.12 * P(22, 0).scale}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g stroke={SKY.cloud} strokeWidth={2.5} opacity={0.35}>
            {Array.from({ length: 9 }, (_, i) => {
              const x = gx0 + ((i + 1) * GOAL_W) / 10;
              return <path key={i} d={linePath([gBase(x), gTop(x)], view)} />;
            })}
          </g>
          {tipDeg > 85 ? (
            <path
              d={`M${P(20, trackY(20)).x + 18},${P(20, trackY(20)).y} L${P(gx1 + 0.3, trackY(20)).x},${P(gx1 + 0.3, trackY(20)).y}`}
              stroke={SKY.sun}
              strokeWidth={6}
              strokeDasharray="14 10"
              strokeLinecap="round"
              opacity={progress(frame, tipLand, 8)}
            />
          ) : null}
        </g>
      ) : null}
      {mapT ? (
        <Label
          x={P(20, (lineY(20) + trackY(20)) / 2).x - 150}
          y={P(20, (lineY(20) + trackY(20)) / 2).y}
          text={`≈ ${G20.toFixed(1)} m`}
          at={labelAt}
          until={out}
          size={44 * (frame >= tThree - 2 ? extraPulse : 1)}
          color={SKY.deep}
          bg={SKY.sun}
        />
      ) : null}
      {mapT ? (
        <Label
          x={P((gx0 + gx1) / 2, gy + 1.22).x}
          y={P((gx0 + gx1) / 2, gy + 1.22).y}
          text="a goal is 2.44 m tall"
          at={tipLand - 4}
          until={out}
          size={36}
          color={SKY.deep}
          bg={SKY.cloud}
        />
      ) : null}

      {/* Marker ball, spin-push arrow and curve gauge riding along the path: the push stays on, the needle hardly moves. */}
      {mapT && markerO > 0.01 ? (
        <g opacity={markerO}>
          <PushArrow
            x={mk.x + (pdx / pl) * 24}
            y={mk.y + (pdy / pl) * 24}
            dx={pdx}
            dy={pdy}
            len={pushLen}
            width={13}
            color={SKY.accent}
            opacity={pushO}
          />
          <PathBall path={REAL} f={markerF} view={view} flat={1} minR={17} />
          <CurveGauge
            x={mk.x}
            y={mk.y + 128}
            value={gaugeVal}
            bg={SKY.deep}
            track={SKY.cloud}
            needle={SKY.accent}
            text={SKY.cloud}
            scale={popSoft(frame, rideAt + 2)}
          />
        </g>
      ) : null}
      {mapT ? (
        <Label
          x={mk.x + (pdx / pl) * 160}
          y={mk.y + (pdy / pl) * 160}
          text="spin push"
          at={rideAt + 8}
          until={rideEnd}
          size={36}
          color={SKY.cloud}
          bg={SKY.accent}
        />
      ) : null}

      {/* Flight 1: keeper's eye, slow motion. */}
      {showBall1 && f1Ball < GOAL_F + 1.5 ? (
        <PathBall path={REAL} f={f1Ball} view={view} flat={flat} minR={9} />
      ) : null}
      {frame < swoopA + 6 ? (
        <Bang
          x={bangBall.x + 110}
          y={bangBall.y - 110}
          at={bangF}
          until={swoopA}
        />
      ) : null}
      <SlowTag
        frame={frame}
        at={K1 - 4}
        until={swoopA - 4}
        bg={SKY.deep}
        text={SKY.cloud}
        dot={SKY.accent}
      />
      {/* The map marker also rides slower than real time. */}
      <SlowTag
        frame={frame}
        at={rideAt}
        until={rideEnd}
        bg={SKY.deep}
        text={SKY.cloud}
        dot={SKY.accent}
      />

      {/* Keeper view again: the ghost flies straight at Chalk, the real ball slides sideways, late. */}
      {showNightPOV ? (
        <g>
          <g opacity={ghostO}>
            {frame >= K2 ? (
              <PathBall
                path={GHOST}
                f={Math.min(f2, GHOST_END)}
                view={view}
                ghost
                minR={9}
              />
            ) : null}
          </g>
          {/* The ghost lands in Chalk's mittens as a puff of chalk: he caught nothing. */}
          <Dust
            x={ghostEnd.x}
            y={ghostEnd.y}
            at={catchF}
            size={110}
            seed="s11-ghost"
          />
          <Trail
            path={REAL}
            from={Math.max(0, Math.min(f2, GOAL_F + 0.6) - TAIL)}
            upto={Math.min(f2, GOAL_F + 0.6)}
            view={view}
            flat={0}
            color={SKY.accent}
            fade
          />
          {frame >= K2 ? (
            <PathBall
              path={REAL}
              f={Math.min(f2, GOAL_F + 1.2)}
              view={view}
              minR={9}
            />
          ) : null}
          {/* A small side arrow: the real ball slides sideways (the spin push), late. */}
          {(() => {
            const ff = Math.min(f2, GOAL_F);
            const a = project(sampleAt(REAL, ff).pos, view);
            const g = project(sampleAt(GHOST, ff).pos, view);
            const dx = a.x - g.x;
            const dy = a.y - g.y;
            const sep = Math.hypot(dx, dy);
            const o =
              Math.min(1, Math.max(0, (sep - 24) / 30)) *
              (1 - progress(frame, K2 + GOAL_F + 6, 8, EASE.exit));
            if (o <= 0.01 || frame < K2) return null;
            const r = Math.max(9, 0.11 * a.scale);
            return (
              <PushArrow
                x={a.x + (dx / sep) * (r + 10)}
                y={a.y + (dy / sep) * (r + 10) - 4}
                dx={dx}
                dy={dy}
                len={78}
                width={11}
                color={SKY.accent}
                opacity={o}
              />
            );
          })()}
          {/* Chalk's mittens close in on the ghost: he expects the straight one, at his chest. */}
          {(() => {
            const follow = progress(frame, K2 + 10, GHOST_END - 10, EASE.standard);
            const late = progress(frame, catchF + 1, 6, EASE.enter);
            const o = visible(frame, diveB - 6, catchF + 8, 10, 8);
            const lx = 330 + (ghostEnd.x - 150 - 330) * follow + 70 * late;
            const rx = 1590 + (ghostEnd.x + 150 - 1590) * follow + 70 * late;
            const y = 1100 + (ghostEnd.y + 80 - 1100) * follow;
            return (
              <g opacity={o}>
                <Mitten
                  x={lx}
                  y={y + idle(frame, 1, 1.6, 8)}
                  s={1.05}
                  angle={20 - 26 * follow}
                />
                <Mitten
                  x={rx}
                  y={y + idle(frame, 2, 1.6, 8)}
                  s={1.05}
                  angle={-20 + 26 * follow}
                  flip
                />
              </g>
            );
          })()}
          {/* Chalk pops in on the side he was watching: eyes wide. */}
          {(() => {
            const inT = pop(frame, catchF + 3, { stiffness: 260, damping: 16 });
            if (inT <= 0.001) return null;
            const x = -300 + 520 * inT;
            return (
              <g>
                <Keeper
                  x={x}
                  groundY={1480}
                  h={860}
                  pose={{ ...KPOSES.stand, lean: 9 }}
                  face="surprised"
                  look={1}
                />
              </g>
            );
          })()}
          <Bang
            x={470}
            y={560}
            at={Math.min(catchF + 8, END - 8)}
            until={END + 10}
            r={56}
          />
        </g>
      ) : null}

      {/* Opening: pull back out of the s10 x-ray air (teal grid, Air Crowd, ball) into the floodlit night. */}
      {xrayO > 0.01 ? (
        <g>
          <XRayGrid opacity={xrayO} />
          {airO > 0.01 ? (
            <g
              opacity={airO}
              transform={`translate(${AIR.x} ${AIR.y}) scale(${airS}) translate(${-AIR.x} ${-AIR.y})`}
            >
              <AirFlow
                cx={AIR.x}
                cy={AIR.y}
                R={AIR.r}
                spin={1}
                rotate={90}
                count={170}
                speed={9}
                spread={AIR.r * 5.4}
                at={-400}
                seed="s11-air"
                opacity={0.65}
              />
              <Ball
                cx={AIR.x}
                cy={AIR.y}
                r={AIR.r}
                view={TOP_UNIT}
                axis={{ x: 0, y: 0, z: 1 }}
                angle={frame * 0.35}
                lineNormal={{ x: 0.92, y: 0.25, z: 0.3 }}
              />
            </g>
          ) : null}
        </g>
      ) : null}

      {/* SFX. */}
      <Sfx name="whoosh-long" at={0} volume={0.3} />
      <Sfx name="light-on" at={6} volume={0.2} />
      <Sfx name="thump" at={K1} volume={0.3} />
      <Sfx name="whoosh" at={K1 + 20} volume={0.35} />
      <Sfx name="whoosh-long" at={bangF - 6} volume={0.35} />
      <Sfx name="pop" at={bangF} volume={0.4} />
      <Sfx name="whoosh-long" at={swoopA - 2} volume={0.3} />
      <Sfx name="air" at={swoopA + 4} volume={0.25} />
      <Sfx name="tick" at={rideAt + 14} volume={0.3} />
      <Sfx name="tick" at={rideAt + 30} volume={0.3} />
      <Sfx name="tick" at={rideAt + 46} volume={0.3} />
      <Sfx name="thump" at={ruler + 5} volume={0.3} />
      <Sfx name="tick" at={ruler + 6} volume={0.4} />
      {brAt.map((a, i) => (
        <Sfx
          key={i}
          name={i < 2 ? "pop-soft" : "pop"}
          at={a}
          volume={0.25 + i * 0.07}
        />
      ))}
      <Sfx name="pop" at={split + 4} volume={0.3} />
      <Sfx name="pop" at={split + 16} volume={0.35} />
      <Sfx name="bell" at={glow} volume={0.25} />
      <Sfx name="pop" at={labelAt} volume={0.4} />
      <Sfx name="thump" at={tipLand} volume={0.5} />
      <Sfx name="pop-soft" at={tipLand - 4} volume={0.3} />
      <Sfx name="pop" at={tThree - 2} volume={0.3} />
      <Sfx name="whoosh-long" at={diveA - 2} volume={0.35} />
      <Sfx name="thump" at={K2} volume={0.2} />
      <Sfx name="whoosh" at={K2 + 30} volume={0.45} />
      <Sfx name="net" at={K2 + Math.round(GOAL_F) + 1} volume={0.3} />
      <Sfx name="chalk" at={catchF} volume={0.45} />
      <Sfx name="pop" at={catchF + 3} volume={0.35} />
    </Stage>
  );
};
