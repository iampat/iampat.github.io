// s16 Forward spin from the roll. X-ray contact in ultra slow motion (the foot swings level, the
// falling ball slides down the laces, then grips), the topspin WordCard, the Air Crowd flick and the
// dive arrow, then a zoom-through to the Open Sky side view: VOLLEY dips under the bar, VOLLEY_GHOST
// clears it and drops into the car park (silent hazard lights), and a from-behind inset shows the corner.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage } from "../kit/Camera";
import { Ball } from "../kit/Ball";
import { Player, POSES, solve, type Pose } from "../kit/Player";
import { XRayLeg } from "../kit/XRay";
import { AirFlow } from "../kit/AirFlow";
import { Arrow, Label, SlowMoTag, WordCard } from "../kit/Graphics";
import { Sfx } from "../kit/Sfx";
import { SHOTS } from "../physics/shots";
import { AIR_DENSITY, BALL, GRAVITY, sampleAt, simulate, spinAngleAt, type BallState } from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, clamp01, idle, lerp, progress, visible } from "../lib/anim";
import { project } from "../lib/project";
import { FONTS, HEIGHT, PITCH, SKY, WIDTH, XRAY } from "../theme";
import {
  Bracket,
  DottedTrail,
  ForceArrow,
  GhostBall,
  NetRipple,
  RoundInset,
  SlipStreaks,
  SolidTrail,
  Spark,
  SpinArrows,
  WheelRamp,
  WordCardIcon,
  XRayBoot,
  breathe,
  voCues,
} from "../kit/ext/s16-s18-fx";
import { SKY_BALL_R, SKY_GOAL_M, SKY_GROUND, SKY_TAVI_H, SKY_VIEW, SX, SZ, SkyBackdrop, SkyWorld, placeForBall, toScreen, worldTransform } from "../kit/ext/s16-s18-sky";

// ---------- Physics ----------
const VOL = simulate({ ...SHOTS.VOLLEY }, 30);
const GHOST = simulate({ ...SHOTS.VOLLEY_GHOST }, 30);
/** Fractional sample index where a path first reaches x. */
const crossIdx = (path: BallState[], x: number) => {
  for (let i = 1; i < path.length; i++) {
    if (path[i - 1].pos.x < x && path[i].pos.x >= x) return i - 1 + (x - path[i - 1].pos.x) / (path[i].pos.x - path[i - 1].pos.x);
  }
  return path.length - 1;
};
const firstBounce = (path: BallState[]) => {
  const i = path.findIndex((s) => s.bounces > 0);
  return i > 0 ? i : path.length - 1;
};
const FC = crossIdx(VOL, SKY_GOAL_M);
const FCG = crossIdx(GHOST, SKY_GOAL_M);
const NET_X = SKY_GOAL_M + 1.1; // back of the net at the ball's height
const FNET = crossIdx(VOL, NET_X);
const FLANDG = firstBounce(GHOST);
const Z_REAL = sampleAt(VOL, FC).pos.z;
const Z_GHOST = sampleAt(GHOST, FCG).pos.z;
const GAP_M = Math.round(Z_GHOST - Z_REAL);
// Spin push vs weight for the dive arrow (fixed Cl for VOLLEY).
const PUSH_RATIO = (0.5 * AIR_DENSITY * BALL.area * SHOTS.VOLLEY.speed ** 2 * (SHOTS.VOLLEY.cl as number)) / (BALL.mass * GRAVITY);
const SPIN_AXIS = { x: 0.174, y: 0.985, z: 0 }; // VOLLEY spin axis (topspin)
const LINE_N = { x: 0.6, y: 0.5, z: 0.62 };

// ---------- X-ray world (pixels) ----------
const XH = 1600; // character height the x-ray leg belongs to
const XR = (BALL.radius / 1.62) * XH; // ball radius at that scale
const HIP = { x: 360, y: 120 };
const PRE: Pose = { ...POSES.volley, nearHip: 34, nearKnee: 58, nearAnkle: 152 };
const VOLP: Pose = POSES.volley;
const PUSH: Pose = { ...POSES.volley, nearHip: 60, nearKnee: 50, nearAnkle: 156 };
const J = solve(VOLP, XH);
const ANK = { x: HIP.x + J.na.x, y: HIP.y + J.na.y };
const TOE = { x: HIP.x + J.nToe.x, y: HIP.y + J.nToe.y };
const FL = Math.hypot(TOE.x - ANK.x, TOE.y - ANK.y);
const FD = { x: (TOE.x - ANK.x) / FL, y: (TOE.y - ANK.y) / FL }; // down the laces
const FN = { x: FD.y, y: -FD.x }; // out of the laces (forward and up)
const LACES = { x: ANK.x + (TOE.x - ANK.x) * 0.4, y: ANK.y + (TOE.y - ANK.y) * 0.4 };
const FOOT_HALF = XH * 0.075 * 0.5;
const C0 = { x: LACES.x + FN.x * (XR + FOOT_HALF * 0.85), y: LACES.y + FN.y * (XR + FOOT_HALF * 0.85) };
const SLIDE = 46;
const FALL = 5; // ball fall, px per frame (ultra slow motion)
const VF = 2.4; // level foot swing, px per frame: slower than the fall, so the ball slides down the laces
const VB = 12; // ball speed after it leaves the boot, px per frame
const W_SPIN = 0.075; // rad per frame on screen (slowed for reading)

// ---------- Sky: Tavi at the volley contact ----------
const TH = SKY_TAVI_H;
const BR = SKY_BALL_R;
const contactPose = placeForBall(SHOTS.VOLLEY.start);
const FOLLOW_SKY: Pose = { ...POSES.follow, nearHip: 78, nearKnee: 30, torso: 12 };

// Speech onsets measured on the final VO where whisper drifts (see voCues).
const MEASURED: Record<string, number> = {
  "That can give it": 3.225,
  "It flicks air up": 4.86,
  "so the spin push": 6.569,
  "push points down": 7.3,
  "It dives": 8.442,
};

export const S16: React.FC = () => {
  const frame = useCurrentFrame();
  const cue0 = useCues("s16");
  const cue = voCues(cue0, MEASURED);

  // ---------- Beats ----------
  const tRolls = cue("rolls down your laces");
  const tLaces = cue("laces");
  const tThat = cue("That can give it");
  const tTopspin = cue("topspin");
  const tFlick = cue("It flicks air up");
  const tPush = cue("so the spin push");
  const tDives = cue("It dives");
  const END = cue0.frames;

  const c0 = tRolls - 2; // ball meets the laces
  const g0 = tLaces + 2; // slip ends, the ball grips
  // Weight comes in on "so the", as the yardstick. The dive arrow draws on "spin push" and is full,
  // with its label, by "points". The pair then holds about 1.5 s, through "It dives".
  const weightAt = tPush - 12;
  const diveAt = tPush;
  const DIVE_DUR = 12;
  const T0 = tDives + 6; // zoom-through to the sky view starts just after "It dives"
  const TD = 15;
  const K = T0 + TD + 1; // kick in the sky view
  const S = 0.6; // sky slow motion (keeps the goal-line gap on "than with no spin")
  const crossF = K + FC / S; // real ball at the goal line
  const netF = K + FNET / S;
  const landF = K + FLANDG / S; // ghost lands in the car park

  // ---------- X-ray: the foot swings level ----------
  /** Hip x offset: the leg swings in level (constant height), meets the ball, and pushes on. */
  const legDX = (f: number) => {
    if (f < c0) return -VF * (c0 - f) * (0.55 + 0.45 * clamp01((f - (c0 - 40)) / 40));
    // After contact the swing slows a little while the ball slides, then pushes on.
    let dx = 0;
    for (let k = c0; k < f; k++) dx += k < g0 ? VF * 0.9 : VF * (1 + 1.4 * clamp01((k - g0) / 10)) * (1 - 0.8 * clamp01((k - g0 - 12) / 50));
    return dx;
  };

  // ---------- X-ray ball state ----------
  const ballX = (f: number) => {
    if (f < c0) return { x: C0.x, y: C0.y - (c0 - f) * FALL };
    if (f < g0) {
      const s = EASE.enter(clamp01((f - c0) / (g0 - c0)));
      const d = legDX(f);
      return { x: C0.x + d + FD.x * SLIDE * s, y: C0.y + FD.y * SLIDE * s };
    }
    let x = C0.x + legDX(g0) + FD.x * SLIDE;
    let y = C0.y + FD.y * SLIDE;
    for (let k = g0; k < f; k++) {
      const v = VF + (VB - VF) * clamp01((k - g0) / 12);
      const a = ((23 * Math.PI) / 180) * clamp01((k - g0) / 6) * (1 - EASE.standard(clamp01((k - g0 - 8) / 55)));
      x += v * Math.cos(a);
      y -= v * Math.sin(a);
    }
    return { x, y };
  };
  const spinX = (f: number) => {
    let a = 0;
    for (let k = c0; k < f; k++) a += W_SPIN * clamp01((k - c0) / (g0 + 8 - c0));
    return a;
  };

  // ---------- The X-ray layer (screen space) ----------
  const xrayCam = (f: number) => {
    const b = ballX(f);
    const e0 = EASE.camera(clamp01(f / (g0 + 6)));
    const a0 = { x: lerp(880, 930, e0), y: lerp(650, 690, e0), zoom: lerp(1.0, 1.1, e0) };
    const k = progress(f, g0 + 8, 52, EASE.camera);
    return { x: lerp(a0.x, b.x + 30, k), y: lerp(a0.y, b.y + 10, k), zoom: lerp(a0.zoom, 1.2, k) };
  };
  const xrayLayer = (f: number, wide = false) => {
    const b = ballX(f);
    const cam = xrayCam(f);
    const scr = toScreen(cam, b);
    const R = XR * cam.zoom;
    const hipX = HIP.x + legDX(f);
    // Leg pose: swings in, holds level through the slip, then pushes through.
    const legPose =
      f < c0 - 24
        ? mixP(PRE, VOLP, EASE.soft(clamp01(f / (c0 - 24))))
        : f < g0
          ? VOLP
          : mixP(VOLP, PUSH, EASE.soft(clamp01((f - g0) / 60)));
    const contact = f >= c0 - 1 && f < g0 + 14 ? 1 - progress(f, g0 + 6, 10) : 0;
    // Grid in world space, so it streams past when the camera follows the ball.
    const pad = wide ? 3200 : 60;
    const x0 = cam.x - WIDTH / 2 / cam.zoom - pad;
    const x1 = cam.x + WIDTH / 2 / cam.zoom + pad;
    const y0 = cam.y - HEIGHT / 2 / cam.zoom - pad;
    const y1 = cam.y + HEIGHT / 2 / cam.zoom + pad;
    const gl: React.ReactNode[] = [];
    for (let gx = Math.floor(x0 / 60) * 60; gx <= x1; gx += 60) gl.push(<line key={`gx${gx}`} x1={gx} y1={y0} x2={gx} y2={y1} />);
    for (let gy = Math.floor(y0 / 60) * 60; gy <= y1; gy += 60) gl.push(<line key={`gy${gy}`} x1={x0} y1={gy} x2={x1} y2={gy} />);
    const angle = spinX(f);
    const lj = solve(legPose, XH);
    const contactPt = toScreen(cam, { x: b.x - FN.x * XR, y: b.y - FN.y * XR });
    const airOn = f >= tFlick - 12;
    // A faint level guide under the foot while it swings in: the foot moves flat, not up.
    const levelY = HIP.y + lj.nToe.y + 30;
    return (
      <g>
        <rect x={-4000} y={-4000} width={WIDTH + 8000} height={HEIGHT + 8000} fill={XRAY.bg} />
        <g transform={worldTransform(cam)}>
          <g stroke={XRAY.grid} strokeWidth={2 / cam.zoom}>{gl}</g>
          <line
            x1={hipX + lj.nToe.x - 420}
            y1={levelY}
            x2={hipX + lj.nToe.x + 60}
            y2={levelY}
            stroke={XRAY.lime}
            strokeWidth={5}
            strokeDasharray="4 16"
            strokeLinecap="round"
            opacity={0.55 * visible(f, 6, g0 + 6, 12, 10)}
          />
          <XRayLeg x={hipX} y={HIP.y} h={XH} pose={legPose} highlight={contact > 0 ? ["foot"] : []} highlightAmount={contact} showFar />
          <XRayBoot ankle={{ x: hipX + lj.na.x, y: HIP.y + lj.na.y }} toe={{ x: hipX + lj.nToe.x, y: HIP.y + lj.nToe.y }} h={XH} laces={visible(f, c0 - 16, g0 + 30, 10, 12)} />
        </g>
        {/* Dust motes drift so the frame is never still. */}
        {Array.from({ length: 14 }, (_, i) => (
          <circle key={i} cx={(i * 197 + 80 - ((cam.x * 0.4) % 1920) + 1920 * 2) % 1920} cy={((i * 131 + 60) % 1080) + idle(f, i, 4, 10)} r={3 + (i % 3)} fill={XRAY.grid} opacity={0.9} />
        ))}
        {airOn ? <AirFlow cx={scr.x} cy={scr.y} R={R} spin={-0.75} rotate={180} speed={VB * cam.zoom} count={120} at={tFlick - 12} seed="s16air" /> : null}
        <SpinArrows cx={scr.x} cy={scr.y} r={R} angle={angle} dir={1} color={XRAY.lime} opacity={progress(f, tThat + 2, 10) * (1 - progress(f, tPush - 6, 10))} scale={0.9 + 0.1 * progress(f, tThat + 2, 14, EASE.back)} />
        <Ball cx={scr.x} cy={scr.y} r={R} view={SKY_VIEW} axis={SPIN_AXIS} angle={angle} lineNormal={LINE_N} showBack />
        {/* The slip: streaks trail up the laces while the ball slides down them. Then the grip spark. */}
        <SlipStreaks x={contactPt.x + FN.x * 18 - FD.x * 20} y={contactPt.y + FN.y * 18 - FD.y * 20} dir={FD} at={c0 + 2} until={g0 - 2} len={110} spread={30} color={XRAY.bone} />
        <Spark x={contactPt.x} y={contactPt.y} at={g0} size={120} color={XRAY.lime} core={XRAY.bone} rays={10} />
        {/* The flick: air thrown up off the back of the ball. */}
        <Arrow x1={scr.x - R * 1.05} y1={scr.y - R * 0.55} x2={scr.x - R * 2.3} y2={scr.y - R * 1.9} curve={-0.25} at={tFlick + 6} until={T0 - 4} color={XRAY.air} width={12} />
        {/* Weight and the dive arrow (spin push about a third of the weight). */}
        <ForceArrow x={scr.x + R * 0.45} y={scr.y + R * 1.08} len={300} color={XRAY.bone} at={weightAt} until={T0 + TD} label="weight" labelAt="right" labelColor={XRAY.bg} />
        <ForceArrow x={scr.x - R * 0.45} y={scr.y + R * 1.08} len={300 * PUSH_RATIO} color={XRAY.ball} at={diveAt} dur={DIVE_DUR} until={T0 + TD} label="dive" labelAt="left" labelColor={XRAY.bg} />
      </g>
    );
  };

  // ---------- Sky layer ----------
  const skyCam = (() => {
    const keys = [
      { f: T0, x: SX(5.2), y: SZ(2.3), zoom: 1.5 },
      { f: K + 4, x: SX(5.4), y: SZ(2.3), zoom: 1.49 },
      { f: K + 64, x: SX(12.6), y: SZ(2.7), zoom: 1.3 },
      { f: END, x: SX(13.1), y: SZ(2.7), zoom: 1.34 },
    ];
    const fs = keys.map((k) => k.f);
    const at = (arr: number[]) => interp(frame, fs, arr);
    return { x: at(keys.map((k) => k.x)), y: at(keys.map((k) => k.y)), zoom: at(keys.map((k) => k.zoom)) };
  })();

  const tfReal = frame < K ? 0 : Math.min((frame - K) * S, FNET);
  const tfGhost = frame < K ? 0 : (frame - K) * S;
  const inNet = frame >= netF;
  const realPts = VOL.slice(0, Math.floor(tfReal) + 1).map((s) => project(s.pos, SKY_VIEW));
  const realNow = project(sampleAt(VOL, tfReal).pos, SKY_VIEW);
  realPts.push(realNow);
  // In the net: the ball drops down the back of the net.
  const netDrop = progress(frame, netF + 3, 16, EASE.enter);
  const realDraw = inNet ? { x: realNow.x + 6 * netDrop, y: lerp(realNow.y, SZ(BALL.radius), netDrop) } : realNow;
  const ghostPts = GHOST.slice(0, Math.min(FLANDG, Math.floor(tfGhost)) + 1).map((s) => project(s.pos, SKY_VIEW));
  const ghostNow = project(sampleAt(GHOST, tfGhost).pos, SKY_VIEW);
  ghostPts.push(project(sampleAt(GHOST, Math.min(tfGhost, FLANDG)).pos, SKY_VIEW));
  const ghostBallFade = 1 - progress(tfGhost, FLANDG + 3, 8);
  const tavPose = frame < K ? contactPose.pose : mixP(contactPose.pose, FOLLOW_SKY, EASE.soft(clamp01((frame - K) / 12)));

  const skyLayer = () => (
    <g>
      <SkyBackdrop cam={skyCam} id="s16sky" />
      <g transform={worldTransform(skyCam)}>
        <SkyWorld hazardAt={landF} />
        <Player x={contactPose.x} groundY={SKY_GROUND} h={TH} pose={frame > K + 12 ? breathe(tavPose, frame, 0.8, 2) : tavPose} face="focus" />
        {/* Ghost: no spin, dotted path, dashed outline. */}
        {frame >= K ? (
          <g>
            <DottedTrail pts={ghostPts} color={SKY.deep} width={5} gap={13} opacity={0.75} />
            <GhostBall cx={ghostNow.x} cy={ghostNow.y} r={BR} color={SKY.deep} opacity={ghostBallFade} />
          </g>
        ) : null}
        <SolidTrail pts={realPts} color={SKY.accent} core={SKY.sunSoft} width={7} opacity={0.95} />
        <Ball cx={realDraw.x} cy={realDraw.y} r={BR} view={SKY_VIEW} axis={SPIN_AXIS} angle={spinAngleAt(VOL, tfReal) + (inNet ? netDrop * 3 : 0)} lineNormal={LINE_N} />
        <NetRipple cx={SX(NET_X)} cy={realNow.y} at={netF} size={34} squashY={1.5} />
        {/* The gap at the goal line, measured from the two paths. */}
        <Bracket x={SX(SKY_GOAL_M) - 26} y1={SZ(Z_GHOST)} y2={SZ(Z_REAL)} at={crossF + 2} color={SKY.deep} width={4} tick={10} side={1} />
        <BracketTag x={SX(SKY_GOAL_M) - 26} yTop={SZ(Z_GHOST)} text={`up to ≈ ${GAP_M} m`} at={crossF + 6} />
      </g>
      <SlowMoTag at={K} until={landF + 10} />
      {/* The corner, seen from behind the kicker: the real ball dips in under the bar, inside the right post. */}
      <RoundInset x={600} y={290} r={190} at={netF + 2} until={END + 20} bg={SKY.deep} ring={SKY.cloud} id="s16corner">
        <CornerView frame={frame} at={netF + 4} />
      </RoundInset>
    </g>
  );

  // ---------- Compose ----------
  const inSky = frame >= T0;
  const e = EASE.camera(progress(frame, T0, TD, (t) => t));
  let zoomThrough: React.ReactNode = null;
  if (inSky && frame < T0 + TD) {
    const xrF = T0; // hold the x-ray frame while it shrinks away
    const b = ballX(xrF);
    const camX = xrayCam(xrF);
    const xs = toScreen(camX, b);
    const target = toScreen(skyCam, project(SHOTS.VOLLEY.start, SKY_VIEW));
    const k = lerp(1, (BR * skyCam.zoom) / (XR * camX.zoom), e);
    const cx = lerp(xs.x, target.x, e);
    const cy = lerp(xs.y, target.y, e);
    const clipR = lerp(1300, BR * skyCam.zoom * 1.05, e);
    zoomThrough = (
      <g>
        <defs>
          <clipPath id="s16lens">
            <circle cx={cx} cy={cy} r={clipR} />
          </clipPath>
        </defs>
        <g clipPath="url(#s16lens)" opacity={1 - progress(frame, T0 + TD - 4, 4)}>
          <g transform={`translate(${cx} ${cy}) scale(${k}) translate(${-xs.x} ${-xs.y})`}>{xrayLayer(xrF, true)}</g>
        </g>
        <circle cx={cx} cy={cy} r={clipR} fill="none" stroke={SKY.cloud} strokeWidth={6} opacity={0.8 * (1 - e)} />
      </g>
    );
  }

  const WC_MEANING = "the top of the ball turns toward the goal as it flies";
  return (
    <Stage bg={inSky ? SKY.mid : XRAY.bg}>
      {inSky ? skyLayer() : xrayLayer(frame)}
      {zoomThrough}
      {!inSky ? (
        <>
          <SlowMoTag at={0} until={T0 - 6} label="ULTRA SLOW MOTION" />
          <RoundInset x={1560} y={700} r={170} at={tThat + 6} until={tFlick + 20} bg={XRAY.grid} ring={XRAY.tissue} id="s16wheel">
            <WheelRamp t={clamp01((frame - tThat - 12) / 60) ** 1.6} />
          </RoundInset>
          <WordCard term="topspin" meaning={WC_MEANING} at={tTopspin} until={tTopspin + 68} x={WIDTH - 60} y={70} />
          <WordCardIcon term="topspin" meaning={WC_MEANING} at={tTopspin} until={tTopspin + 68} x={WIDTH - 60} y={70} />
        </>
      ) : null}

      {/* Sound. */}
      <Sfx name="thump" at={c0} volume={0.3} />
      <Sfx name="chalk" at={c0 + 2} volume={0.35} />
      <Sfx name="tick" at={g0} volume={0.5} />
      <Sfx name="whoosh-long" at={tThat + 8} volume={0.18} />
      <Sfx name="pop" at={tTopspin} volume={0.4} />
      <Sfx name="air" at={tFlick} volume={0.4} />
      <Sfx name="pop-soft" at={weightAt} volume={0.3} />
      <Sfx name="whoosh" at={diveAt} volume={0.35} />
      <Sfx name="pop-soft" at={diveAt + Math.round(DIVE_DUR * 0.72)} volume={0.3} />
      <Sfx name="whoosh-long" at={T0} volume={0.3} />
      <Sfx name="thump" at={K} volume={0.5} />
      <Sfx name="whoosh" at={K + 2} volume={0.3} />
      <Sfx name="pop-soft" at={crossF + 6} volume={0.35} />
      <Sfx name="net" at={netF} volume={0.5} />
      <Sfx name="alarm" at={landF} volume={0.2} />
      <Sfx name="pop-soft" at={netF + 2} volume={0.25} />
    </Stage>
  );
};

/** Pose blend without a smoothstep (callers pass their own ease). */
const mixP = (a: Pose, b: Pose, t: number): Pose => {
  const out: Record<string, number> = {};
  for (const k of Object.keys(a) as (keyof Pose)[]) out[k] = (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * t;
  return out as unknown as Pose;
};

/** Eased piecewise interpolation (camera keys). */
const interp = (f: number, fs: number[], vs: number[]) => {
  if (f <= fs[0]) return vs[0];
  for (let i = 1; i < fs.length; i++) {
    if (f <= fs[i]) return lerp(vs[i - 1], vs[i], EASE.camera((f - fs[i - 1]) / Math.max(1, fs[i] - fs[i - 1])));
  }
  return vs[vs.length - 1];
};

/** Front view from behind the kicker (orthographic): goal mouth, real path into the top-right corner, ghost over the bar. */
const CornerView: React.FC<{ frame: number; at: number }> = ({ frame, at }) => {
  const sc = 44;
  const gy = 70; // ground line
  const P = (s: BallState) => ({ x: -s.pos.y * sc, y: gy - s.pos.z * sc });
  const d = progress(frame, at, 20, EASE.soft);
  const upto = (path: BallState[], end: number) => path.slice(0, Math.max(2, Math.floor(end * d) + 1)).map(P);
  const real = upto(VOL, FNET);
  const ghost = upto(GHOST, FCG + 3);
  const hw = 3.66 * sc;
  const bar = gy - 2.44 * sc;
  const end = P(sampleAt(VOL, FNET * d));
  const net: React.ReactNode[] = [];
  for (let i = 1; i < 8; i++) net.push(<line key={`v${i}`} x1={-hw + (2 * hw * i) / 8} y1={bar} x2={-hw + (2 * hw * i) / 8} y2={gy} />);
  for (let i = 1; i < 4; i++) net.push(<line key={`h${i}`} x1={-hw} y1={bar + ((gy - bar) * i) / 4} x2={hw} y2={bar + ((gy - bar) * i) / 4} />);
  return (
    <g>
      <rect x={-240} y={gy} width={480} height={240} fill={PITCH.grass} />
      <g stroke={SKY.cloud} strokeWidth={1.5} opacity={0.35}>{net}</g>
      <path d={`M${-hw},${gy} L${-hw},${bar} L${hw},${bar} L${hw},${gy}`} fill="none" stroke={SKY.cloud} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
      <DottedTrail pts={ghost} color={SKY.cloud} width={6} gap={12} opacity={0.85} />
      <SolidTrail pts={real} color={SKY.accent} core={SKY.sunSoft} width={9} />
      <circle cx={end.x} cy={end.y} r={12} fill={SKY.accent} />
      <text x={0} y={gy + 56} fill={SKY.cloud} fontFamily={FONTS.label} fontWeight={800} fontSize={32} textAnchor="middle" opacity={progress(frame, at + 14, 8)}>
        from behind
      </text>
    </g>
  );
};

/** The bracket's tag: a pill above the paths with a short leader down to the bracket, plus a small "model" note. */
const BracketTag: React.FC<{ x: number; yTop: number; text: string; at: number; until?: number }> = ({ x, yTop, text, at, until }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until, 10, 8);
  if (o <= 0.001) return null;
  const ly = yTop - 80;
  return (
    <g>
      <line x1={x} y1={yTop - 6} x2={x} y2={ly + 18} stroke={SKY.deep} strokeWidth={3} strokeDasharray="2 7" strokeLinecap="round" opacity={o} />
      <Label x={x + 10} y={ly} text={text} at={at} until={until} size={32} anchor="end" bg={SKY.deep} color={SKY.cloud} />
      <Label x={x + 20} y={ly} text="model" at={at + 6} until={until} size={32} anchor="start" bg={SKY.deep} color={SKY.horizon} />
    </g>
  );
};
