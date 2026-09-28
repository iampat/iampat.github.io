// s22 Ending, knuckleball teaser: the Line that hardly turns, the flapping wake and the
// zigzag, Chalk and Tavi both lost, then "nail the drive first" and the next-level card.
import React from "react";
import { random, useCurrentFrame } from "remotion";
import { Stage, cameraAt } from "../kit/Camera";
import { CarPark, Dust, GroundSide, PitchTop, Stars } from "../kit/World";
import { Player, POSES, mixPose, type Pose } from "../kit/Player";
import { Keeper, keeperPoseAt, type KeeperFace, type KeeperPose } from "../kit/Keeper";
import { Ball } from "../kit/Ball";
import { Flight } from "../kit/Flight";
import { GoalTop } from "../kit/Goal";
import { AirFlow } from "../kit/AirFlow";
import { Label, SlowMoTag } from "../kit/Graphics";
import { Sfx } from "../kit/Sfx";
import { SHOTS } from "../physics/shots";
import { sampleAt, simulate, spinAngleAt, type Vec3 } from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, idle, pop, popSoft, progress } from "../lib/anim";
import { pathD, project, type View } from "../lib/project";
import { FONTS, HEIGHT, PITCH, WIDTH } from "../theme";
import { recapBeats, RECAP_HOLD, RecapRow } from "../kit/ext/s21-s23-recap";
import {
  ChalkBox,
  FlagInset,
  HudValue,
  KickChecklist,
  NextLevelCard,
  PalmUp,
  RECAP,
  ShrugMarks,
  SideBackdrop,
  Streak,
  breathe,
  camT,
  mixCam,
  streakPoints,
  taviJoints,
  toScreen,
  type Cam,
} from "../kit/ext/s21-s23-bits";
import { GroundLines, NetGoal, StadiumPlate, behindCam } from "../kit/ext/s21-s23-goal";
import { StrikeCloseUp } from "../kit/ext/s21-s23-closeup";

const PPM = 50;
const OX = 400;
const GROUND = 820;
const X = (m: number) => OX + m * PPM;
const SIDE: View = { kind: "side", originX: OX, groundY: GROUND, ppm: PPM };
const LINE_N = { x: 0.92, y: 0.25, z: 0.3 };
const TAVI_H = 1.62 * PPM;
const BALL_R = 0.11 * PPM * 1.1;
const GOAL_K = 25; // the knuckleball is struck 25 m out

const KNUCK = simulate({ ...SHOTS.KNUCKLE, duration: 2.2 }, 30);
const K_NET = GOAL_K + 1.4;
const K_STOP = Math.max(1, KNUCK.findIndex((s) => s.pos.x >= K_NET));

/** KNUCKLE until the back net holds it, then it drops (free fall). */
const knuckPos = (fl: number): Vec3 => {
  if (fl <= K_STOP) return sampleAt(KNUCK, Math.max(0, fl)).pos;
  const s = KNUCK[K_STOP].pos;
  const t = (fl - K_STOP) / 30;
  return { x: s.x + 0.25 * Math.exp(-t * 3.5) * Math.sin(t * 12), y: s.y, z: Math.max(0.11, s.z - 0.5 * 9.81 * t * t) };
};

/**
 * The knuckleball's real sideways wobble is only about 8 cm, too small to see. To show the
 * zigzag, the wobble around the ball's average line (a least-squares line through the kick
 * spot) is stretched by `k`. The screen labels it "exaggerated". Height and distance stay true.
 */
const K_SLOPE = (() => {
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i <= K_STOP; i++) {
    sxy += KNUCK[i].pos.x * KNUCK[i].pos.y;
    sxx += KNUCK[i].pos.x * KNUCK[i].pos.x;
  }
  return sxx > 0 ? sxy / sxx : 0;
})();
const wobble = (p: Vec3, k: number): Vec3 => ({ x: p.x, y: K_SLOPE * p.x + (p.y - K_SLOPE * p.x) * k, z: p.z });
const EX_TOP = 20; // top-down inset
const EX_FRONT = 8; // behind-the-kicker view

/** Knuckle side force along the path (SHOTS.KNUCKLE.sideForce): + = pushes left. */
const sideForceAt = (distance: number) => {
  const f = SHOTS.KNUCKLE.sideForce;
  return Math.sin((2 * Math.PI * distance) / f.wavelengthM + f.phase);
};

const SLOW = 0.25; // the spin comparison plays at quarter speed
const RATE_DRIVE = 4; // turns per second (SHOTS.DRIVE_R)
const RATE_KNUCK = 0.9; // turns per second (SHOTS.KNUCKLE)
const RATE_A = 0.06; // turns per second shown before the comparison ("what if the line hardly turns?")
const AX_BACK = { x: 0, y: -1, z: 0 };

const TUFTS = Array.from({ length: 260 }, (_, i) => ({
  x: -300 + random(`tuft-x-${i}`) * 2100,
  y: -500 + random(`tuft-y-${i}`) * 1000,
  w: 10 + random(`tuft-w-${i}`) * 18,
}));

export const S22: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s22");

  // ---------- Beats ----------
  const tWhat = cue("What if the line hardly turns");
  const tHardly = cue("hardly turns");
  const tKnuckle = cue("A knuckleball turns");
  const tOnce = cue("less than once");
  const tAir = cue("The air behind it");
  const tFlag = cue("flaps like a flag");
  // "and the ball zigzags": the recogniser puts "zigzags" about 0.4 s late, so key the clause start.
  const tZig = cue("and the ball");
  const tChalk = cue("Chalk has no idea", -3); // audio onset 10.0 s
  const tNeither = cue("Neither do you");
  const tNail = cue("Nail the drive first");
  const tThen = cue("Then come back", -10); // audio onset 15.0 s (the recogniser says 15.4 s)
  const END = cue.frames;

  // s22 opens on the s21 row, held still: the four answers stay on screen together for about
  // 1.6 s after "float" ends. Only then does the camera push into the fifth, "?" box.
  const rb = recapBeats(useCues("s21"));
  const pushAt = rb.floatEnd - rb.end + 48;
  const pushEnd = pushAt + 26;
  const shotC1 = tAir - 4;
  const kickC = tAir + 10;
  const shotC2 = kickC + 16;
  const shotD = tChalk - 4;
  const kickD = shotD - 8;
  const hitD = kickD + K_STOP;
  const shotE = tNeither - 6;
  const shotF = tNail - 4;
  const shotG = tThen;

  const Z0 = RECAP.endZoom;
  // ---------- A0: the s21 row, held, then the push into box 5 ----------
  if (frame < pushEnd) {
    const u = progress(frame, pushAt, pushEnd - pushAt, EASE.standard);
    const wc = mixCam(RECAP_HOLD, { x: RECAP.slotX[4], y: 540, zoom: Z0 }, u);
    const rowO = 1 - progress(frame, pushAt + 2, 16, EASE.soft);
    return (
      <Stage bg={PITCH.sky}>
        <g transform={camT(wc)}>
          <rect x={-400} y={-400} width={WIDTH + 800} height={HEIGHT + 800} fill={PITCH.sky} />
          <Stars count={RECAP.starCount} maxY={HEIGHT} seed={RECAP.starSeed} opacity={RECAP.starOpacity} />
          <RecapRow frame={frame + rb.end} beats={rb} rowOpacity={rowO} />
        </g>
        <Sfx name="whoosh-long" at={pushAt} volume={0.3} />
      </Stage>
    );
  }

  // ---------- A + B: the fifth box, then drive vs knuckleball ----------
  if (frame < shotC1) {
    const split = progress(frame, tKnuckle - 2, 26, EASE.standard);
    const cam = cameraAt(frame, [
      { f: pushEnd, x: 960, y: 540, zoom: 1.0 },
      { f: tKnuckle - 2, x: 960, y: 540, zoom: 1.02 },
      { f: tKnuckle + 24, x: 960, y: 520, zoom: 1.0 },
      { f: shotC1, x: 960, y: 525, zoom: 1.03 },
    ]);
    // Box 5 starts exactly as the push leaves it, then becomes the right panel.
    const bw0 = RECAP.boxW * Z0;
    const bh0 = RECAP.boxH * Z0;
    const bx = 960 + (1370 - 960) * split;
    const by = 540 + (490 - 540) * split;
    const bw = bw0 + (600 - bw0) * split;
    const bh = bh0 + (700 - bh0) * split;
    const bk = Z0 + (1 - Z0) * split;
    const kBallX = bx;
    const kBallY = 520 + (420 - 520) * split;
    const kR = 190 + (150 - 190) * split;
    // Before the comparison the line is almost still; it ramps to the honest quarter-speed rate as the split starts.
    let kTurns = 0;
    for (let f = tWhat; f < frame; f++) kTurns += (RATE_A + (RATE_KNUCK * SLOW - RATE_A) * progress(f, tKnuckle - 2, 26, EASE.standard)) / 30;
    const kAngle = kTurns * 2 * Math.PI;
    const dAngle = ((frame - tKnuckle) / 30) * 2 * Math.PI * RATE_DRIVE * SLOW;
    const q0 = progress(frame, pushEnd, 16, EASE.standard);
    const qx = 960 + (bx + bw / 2 - 90 - 960) * q0;
    const qy = 540 + (by - bh / 2 + 110 - 540) * q0;
    const qs = Z0 * (1 - 0.55 * q0) * (1 + 0.3 * Math.sin(progress(frame, tHardly, 14, EASE.soft) * Math.PI));
    const qFade = 1 - progress(frame, tKnuckle, 10, EASE.exit);
    const kPop = pop(frame, pushEnd + 4);
    const dPop = pop(frame, tKnuckle + 8);
    const orbit = (cx: number, cy: number, r: number, turns: number, color: string, o: number) => {
      const a = turns * 2 * Math.PI - Math.PI / 2;
      return (
        <g opacity={o}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={PITCH.chalk} strokeWidth={3} opacity={0.25} />
          <circle cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} r={11} fill={color} />
        </g>
      );
    };
    return (
      <Stage bg={PITCH.sky}>
        <g transform={camT(cam)}>
          <rect x={-400} y={-400} width={WIDTH + 800} height={HEIGHT + 800} fill={PITCH.sky} />
          {/* The s21 star field at the s21 end framing, handing over to this scene's stars. */}
          <g transform={camT({ x: RECAP.slotX[4], y: 540, zoom: Z0 })} opacity={1 - split}>
            <Stars count={RECAP.starCount} maxY={HEIGHT} seed={RECAP.starSeed} opacity={RECAP.starOpacity} />
          </g>
          <Stars count={70} maxY={HEIGHT} seed="s22a" opacity={0.5 * split} />
          {/* Left panel: the normal drive. */}
          <ChalkBox x={550 - 300} y={490 - 350} w={600} h={700} at={tKnuckle + 2} />
          {dPop > 0.001 ? (
            <g transform={`translate(550 420) scale(${dPop}) translate(-550 -420)`}>
              {orbit(550, 420, 186, (((frame - tKnuckle) / 30) * RATE_DRIVE * SLOW) % 1, PITCH.light, 1)}
              <Ball cx={550} cy={420} r={150} view={SIDE} axis={AX_BACK} angle={dAngle} lineNormal={LINE_N} />
            </g>
          ) : null}
          <HudValue x={550} y={740} caption="DRIVE" value="≈ 4" unit="turns/s" at={tKnuckle + 14} color={PITCH.light} />
          {/* The fifth box becomes the right panel: the knuckleball. */}
          <ChalkBox x={bx - bw / 2} y={by - bh / 2} w={bw} h={bh} at={-30} dashed k={bk} />
          {kPop > 0.001 ? (
            <g transform={`translate(${kBallX} ${kBallY}) scale(${kPop}) translate(${-kBallX} ${-kBallY})`}>
              {orbit(kBallX, kBallY, kR + 36, kTurns % 1, PITCH.accent, split)}
              <Ball cx={kBallX} cy={kBallY} r={kR} view={SIDE} axis={AX_BACK} angle={kAngle} lineNormal={LINE_N} />
            </g>
          ) : null}
          <HudValue x={1370} y={740} caption="KNUCKLEBALL" value="< 1" unit="turn/s" at={tOnce - 4} color={PITCH.accent} />
          {qFade > 0.001 ? (
            <g transform={`translate(${qx} ${qy}) scale(${qs})`} opacity={qFade}>
              <text y={38} fill={PITCH.chalk} fontFamily={FONTS.title} fontWeight={800} fontSize={120} textAnchor="middle">
                ?
              </text>
            </g>
          ) : null}
          {frame >= tOnce + 12 ? (
            <g transform={`translate(960 ${968 + (1 - popSoft(frame, tOnce + 12)) * 20})`} opacity={popSoft(frame, tOnce + 12)}>
              <text fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={50} textAnchor="middle">
                The line hardly moves.
              </text>
            </g>
          ) : null}
        </g>
        <SlowMoTag at={tKnuckle + 6} until={shotC1 - 2} />
        <Sfx name="pop" at={tHardly} volume={0.35} />
        <Sfx name="chalk" at={tKnuckle + 2} volume={0.25} />
        <Sfx name="air" at={tKnuckle + 8} volume={0.35} />
        <Sfx name="blip" at={tKnuckle + 14} volume={0.3} />
        <Sfx name="air" at={tOnce - 8} volume={0.12} />
        <Sfx name="blip" at={tOnce - 4} volume={0.3} />
        <Sfx name="pop-soft" at={tOnce + 12} volume={0.3} />
      </Stage>
    );
  }

  // ---------- C1: Tavi stabs the knuckleball from 25 m ----------
  if (frame < shotC2) {
    const cam = cameraAt(frame, [
      { f: shotC1, x: X(-0.4), y: GROUND - 62, zoom: 3.5 },
      { f: shotC2, x: X(0.2), y: GROUND - 64, zoom: 3.3 },
    ]);
    const pose: Pose =
      frame < kickC - 6
        ? breathe(POSES.plant, frame, 2, 0.3)
        : frame < kickC
          ? mixPose(POSES.plant, POSES.strike, progress(frame, kickC - 6, 6, EASE.soft))
          : mixPose(POSES.strike, mixPose(POSES.strike, POSES.follow, 0.3), progress(frame, kickC, 8, EASE.enter));
    const hip = frame < kickC ? X(-0.12) : X(-0.1 + 0.12 * progress(frame, kickC, 10, EASE.enter));
    return (
      <Stage bg={PITCH.sky}>
        <SideBackdrop cam={cam} ground={GROUND} refX={X(4)} seed="s22c" />
        <g transform={camT(cam)}>
          <GroundSide groundY={GROUND} vanishX={X(8)} />
          <Player x={hip} groundY={GROUND} h={TAVI_H} pose={pose} face="focus" />
          {frame < kickC ? (
            <Ball cx={X(0)} cy={GROUND - 0.11 * PPM} r={BALL_R} view={SIDE} lineNormal={LINE_N} />
          ) : (
            <>
              <Streak id="s22c1-streak" pts={streakPoints((f) => project(sampleAt(KNUCK, f).pos, SIDE), frame - kickC, 4)} width={BALL_R * 1.4} maxLen={BALL_R * 7} />
              <Flight path={KNUCK} view={SIDE} at={kickC} r={BALL_R} trail={false} lineNormal={LINE_N} />
            </>
          )}
        </g>
        <Sfx name="thump" at={kickC} volume={0.6} />
        <Sfx name="whoosh" at={kickC + 2} volume={0.35} />
      </Stage>
    );
  }

  // ---------- C2: top-down tracking in slow motion: the flapping wake, then the zigzag ----------
  if (frame < shotD) {
    const TOP: View = { kind: "top", originX: 0, originY: 0, ppm: 60 };
    const simF = shotC2 - kickC + (frame - shotC2) * 0.4; // 0.4x slow motion
    const fs = Math.min(simF, K_STOP);
    const st = sampleAt(KNUCK, fs);
    const out = progress(frame, tZig - 4, 30, EASE.camera);
    // The wobble grows to its stretched size as the camera pulls out to show the whole path.
    const ex = 1 + (EX_TOP - 1) * out;
    const bp = project(wobble(knuckPos(simF), ex), TOP);
    // Close on the ball, big enough for full-size Air Crowd particles (radius 11% of the ball).
    const ZT = 8.6;
    const track: Cam = { x: bp.x + 120 / ZT, y: bp.y, zoom: ZT };
    const fit: Cam = { x: 13 * 60, y: -0.2 * 60, zoom: 1.12 };
    const cam = mixCam(track, fit, out);
    const rS = 94 + (20 - 94) * out;
    const rW = rS / cam.zoom;
    const trail = KNUCK.slice(0, Math.floor(fs) + 1).map((q) => project(wobble(q.pos, ex), TOP));
    trail.push(bp);
    // Where the label goes: over the widest left swing of the stretched path (about 21 m).
    const peak = toScreen(cam, 21 * 60, -wobble({ x: 21, y: sampleAt(KNUCK, 36).pos.y, z: 0 }, EX_TOP).y * 60);
    const bs = toScreen(cam, bp.x, bp.y);
    const flap = sideForceAt(st.pos.x);
    const airO = 1 - progress(frame, tZig - 4, 14, EASE.exit);
    return (
      <Stage bg={PITCH.grassDark}>
        <g transform={camT(cam)}>
          <PitchTop view={TOP} goalX={GOAL_K} />
          {TUFTS.map((t, i) => (
            <rect key={i} x={t.x} y={t.y} width={t.w} height={3} rx={1.5} fill={PITCH.grassDark} opacity={0.55} />
          ))}
          {/* Shrink the penalty spot so it does not read as a second ball in the close-up. */}
          <circle cx={(GOAL_K - 11) * 60} cy={0} r={11} fill={PITCH.grass} />
          <circle cx={(GOAL_K - 11) * 60} cy={0} r={3.5} fill={PITCH.chalk} opacity={0.8} />
          <GoalTop view={TOP} goalX={GOAL_K} />
          <line x1={0} y1={0} x2={GOAL_K * 60} y2={0} stroke={PITCH.chalk} strokeWidth={5 / cam.zoom + 1.5} strokeDasharray={`${14 / cam.zoom + 4} ${22 / cam.zoom + 8}`} strokeLinecap="round" opacity={0.55} />
          <path d={pathD(trail)} fill="none" stroke={PITCH.light} strokeWidth={7 / cam.zoom + 2} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
          <circle cx={0} cy={0} r={7} fill={PITCH.chalk} />
          <Ball cx={bp.x} cy={bp.y} r={rW} view={TOP} axis={st.spin} angle={spinAngleAt(KNUCK, fs)} lineNormal={LINE_N} />
        </g>
        {airO > 0.001 ? (
          <path
            d={pathD(
              Array.from({ length: 16 }, (_, k) => {
                const u = k / 15;
                return { x: bs.x - rS * 0.9 - u * rS * 6.5, y: bs.y + sideForceAt(st.pos.x - u * 3.2) * rS * 1.5 * u };
              }),
            )}
            fill="none"
            stroke={PITCH.lightSoft}
            strokeWidth={rS * 0.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.3 * airO * progress(frame, shotC2, 8)}
          />
        ) : null}
        {airO > 0.001 ? (
          <AirFlow cx={bs.x} cy={bs.y} R={rS} spin={0} wake={0.9 * flap} rotate={180} speed={12} spread={rS * 4.2} length={rS * 10} opacity={airO * progress(frame, shotC2, 8)} faces seed="s22air" count={110} />
        ) : null}
        <FlagInset x={1690} y={240} at={tFlag - 4} until={tZig - 2} phase={frame * 0.55} flip={flap} />
        <Label x={peak.x} y={peak.y - 80} text="exaggerated" at={tZig + 18} until={shotD - 4} size={40} bg={PITCH.light} />
        <SlowMoTag at={shotC2 + 2} until={shotD - 4} />
        <Sfx name="air" at={shotC2} volume={0.4} />
        <Sfx name="whoosh-long" at={tFlag - 4} volume={0.2} />
        <Sfx name="pop-soft" at={tFlag - 4} volume={0.3} />
        <Sfx name="whoosh" at={tZig - 4} volume={0.25} />
      </Stage>
    );
  }

  // ---------- D: Chalk has no idea (real time, behind the kicker) ----------
  // The ball jinks left, right, left, right against the goal (wobble stretched, and labelled).
  // Chalk shuffles after each jink a moment late, then dives left as the ball swings back right.
  if (frame < shotE) {
    const view = behindCam(-3, 3050 * (1 + 0.06 * progress(frame, shotD, shotE - shotD, EASE.camera)));
    const fl = frame - kickD;
    const shown = (f: number) => wobble(knuckPos(f), EX_FRONT);
    const bs = project(shown(fl), view);
    const br = Math.max(5, 0.11 * bs.scale * 1.15);
    const streak = streakPoints((f) => {
      const q = project(shown(Math.min(f, K_STOP)), view);
      return q.depth > 0.3 ? q : null;
    }, Math.min(fl, K_STOP), 5);
    const kp = project({ x: GOAL_K, y: 0, z: 0 }, view);
    const L: KeeperPose = { left: 46, right: 38, lean: -12, shift: -0.3, lift: 0, stretch: 0.94 };
    const R: KeeperPose = { left: 38, right: 46, lean: 12, shift: 0.3, lift: 0, stretch: 0.94 };
    const LIE_L: KeeperPose = { left: 150, right: 112, lean: -84, shift: -0.62, lift: -0.3, stretch: 1 };
    const kPose = keeperPoseAt(frame, [
      [shotD, "ready"],
      [kickD + 15, L],
      [kickD + 27, R],
      [kickD + 38, L],
      [kickD + 41, L],
      [kickD + 48, "diveL"],
      [kickD + 56, LIE_L],
    ]);
    const kFace: KeeperFace = frame < kickD + 40 ? "thinking" : "surprised";
    const hitPos = wobble(KNUCK[K_STOP].pos, EX_FRONT);
    const fs = Math.min(fl, K_STOP);
    // His eyes follow the ball.
    const look = Math.max(-1, Math.min(1, (bs.x - kp.x) / (1.2 * kp.scale)));
    return (
      <Stage bg={PITCH.sky}>
        <StadiumPlate lamps={[1, 1, 1, 1]} seed="s22d" />
        <GroundLines view={view} goalX={GOAL_K} opacity={0.35} />
        <NetGoal view={view} goalX={GOAL_K} frame={frame} hit={{ y: hitPos.y, z: hitPos.z, at: hitD }} />
        <Keeper x={kp.x} groundY={kp.y} h={2.1 * kp.scale} pose={kPose} face={kFace} look={look} />
        <Dust x={kp.x - 1.3 * kp.scale} y={kp.y} at={kickD + 56} size={0.9 * kp.scale} seed="lie22" />
        <Streak id="s22d-streak" pts={streak} width={br * 1.6} maxLen={br * 5} opacity={0.6 * (1 - progress(frame, hitD, 6))} />
        <Ball cx={bs.x} cy={bs.y} r={br} view={view} axis={sampleAt(KNUCK, Math.max(0, fs)).spin} angle={spinAngleAt(KNUCK, Math.max(0, fs))} lineNormal={LINE_N} />
        <Label x={70} y={112} text="zigzag exaggerated" at={shotD + 2} until={shotE - 6} size={36} anchor="start" />
        <Sfx name="chalk" at={kickD + 15} volume={0.25} />
        <Sfx name="chalk" at={kickD + 27} volume={0.25} />
        <Sfx name="chalk" at={kickD + 38} volume={0.25} />
        <Sfx name="net" at={hitD} volume={0.5} />
        <Sfx name="thump" at={kickD + 56} volume={0.3} />
      </Stage>
    );
  }

  // ---------- E: neither do you ----------
  // A clear shrug: forearms out with the palms up (one hand forward, one back, as seen from the
  // side), head tipped back, shrug marks at the shoulders. It pops up on "Neither", holds for
  // about 25 frames through "do you", then eases down.
  if (frame < shotF) {
    const cam = cameraAt(frame, [
      { f: shotE, x: X(0.25), y: GROUND - 62, zoom: 4.3 },
      { f: shotF, x: X(0.3), y: GROUND - 63, zoom: 4.5 },
    ]);
    const SHRUG: Pose = { ...POSES.stand, torso: -3, head: -12, nearShoulder: 24, nearElbow: 88, farShoulder: -24, farElbow: -88 };
    const up = pop(frame, tNeither - 2, { stiffness: 240, damping: 13 });
    const down = progress(frame, tNeither + 30, 10, EASE.soft);
    const sh = up * (1 - 0.35 * down);
    const pose = breathe(mixPose(POSES.stand, SHRUG, sh), frame, 5, 0.6 * (1 - sh) + 0.2);
    const hip = X(0.2);
    const J = taviJoints(pose, hip, GROUND, TAVI_H);
    const head = toScreen(cam, J.head.x, J.head.y);
    // Palms tip with the forearm a little, but stay close to flat (palm to the sky).
    const nearTilt = 12 * sh;
    const marks = Math.min(1, up) * (1 - progress(frame, tNeither + 24, 10, EASE.exit));
    return (
      <Stage bg={PITCH.sky}>
        <SideBackdrop cam={cam} ground={GROUND} refX={X(4)} seed="s22e" />
        <g transform={camT(cam)}>
          <GroundSide groundY={GROUND} vanishX={X(8)} />
          {sh > 0.35 ? <PalmUp x={J.farHand.x} y={J.farHand.y} dir={-1} H={TAVI_H} tilt={nearTilt} shade /> : null}
          <Player x={hip} groundY={GROUND} h={TAVI_H} pose={pose} face="neutral" />
          {sh > 0.35 ? <PalmUp x={J.nearHand.x} y={J.nearHand.y} dir={1} H={TAVI_H} tilt={nearTilt} /> : null}
          <ShrugMarks x={J.shoulder.x} y={J.shoulder.y + 0.06 * TAVI_H} H={TAVI_H} t={marks} />
        </g>
        {frame >= tNeither + 2 ? (
          <g transform={`translate(${head.x + 10} ${head.y - 170}) scale(${pop(frame, tNeither + 2)}) rotate(${idle(frame, 2, 1.4, 6)})`}>
            <text y={40} fill={PITCH.chalk} fontFamily={FONTS.title} fontWeight={800} fontSize={120} textAnchor="middle">
              ?
            </text>
          </g>
        ) : null}
        <Sfx name="whoosh" at={tNeither - 2} volume={0.18} />
        <Sfx name="pop-soft" at={tNeither + 2} volume={0.35} />
      </Stage>
    );
  }

  // ---------- F + G: nail the drive first; then come back for the knuckleball ----------
  const ticks = [tNail + 14, tThen + 10, tThen + 18];
  const checklist = <KickChecklist x={1400} y={330} at={shotF + 2} ticks={ticks} />;
  if (frame < shotG) {
    const contact = tNail + 4;
    // "Nail the drive first": the recogniser puts "drive" after "first", but in the audio "drive"
    // starts about 0.5 s after "the". The label is full size on "drive" and stays about 0.7 s.
    const labelAt = cue("the drive") - 1;
    const release = shotG - 6; // hold on the contact so "DEAD CENTRE" can be read
    return (
      <Stage bg={PITCH.sky}>
        <StrikeCloseUp swingAt={shotF + 2} contactAt={contact} releaseAt={release} flight={KNUCK} follow={0.3} speed={0.15} dotAt={contact + 1} label="DEAD CENTRE" labelAt={labelAt} labelSize={52} lineNormal={LINE_N} ballX={640} push={0.04 * progress(frame, shotF, shotG - shotF, EASE.camera)} />
        {checklist}
        <SlowMoTag at={contact} until={shotG - 2} />
        <Sfx name="thump" at={contact} volume={0.5} />
        <Sfx name="tick" at={ticks[0]} volume={0.45} />
        <Sfx name="pop-soft" at={contact + 5} volume={0.3} />
      </Stage>
    );
  }

  const cam = cameraAt(frame, [
    { f: shotG, x: X(1.2), y: GROUND - 96, zoom: 3.9 },
    { f: END, x: X(1.25), y: GROUND - 98, zoom: 4.05 },
  ]);
  const hip = X(0.3);
  const pose = breathe(POSES.stand, frame, 6);
  // The third floodlight (the one in full view) clunks off; s23 starts with it dark.
  const lampOff = progress(frame, END - 14, 6, EASE.exit);
  return (
    <Stage bg={PITCH.sky}>
      <SideBackdrop cam={cam} ground={GROUND} refX={X(4)} seed="s22g" lamps={[1, 1, 1 - lampOff, 1]} />
      <g transform={camT(cam)}>
        <GroundSide groundY={GROUND} vanishX={X(8)} />
        <CarPark x0={X(21)} groundY={GROUND} ppm={PPM} />
        <Player x={hip} groundY={GROUND} h={TAVI_H} pose={pose} face="happy" />
        <Ball cx={X(0.75)} cy={GROUND - 0.11 * PPM} r={BALL_R} view={SIDE} lineNormal={LINE_N} angle={0.2 + idle(frame, 3, 2.2, 0.08)} />
      </g>
      {/* The next level links back to the s07 wall drill: 9 of 10 under the knee-high tape. */}
      <NextLevelCard x={130} y={110} at={tThen + 2} text="9 of 10 drives under the tape" marksAt={tThen + 16} />
      {checklist}
      <Sfx name="pop" at={tThen + 2} volume={0.35} />
      <Sfx name="tick" at={ticks[1]} volume={0.45} />
      <Sfx name="tick" at={ticks[2]} volume={0.45} />
      {[0, 3, 6, 9].map((i) => (
        <Sfx key={i} name="blip" at={tThen + 16 + i * 3} volume={0.12} />
      ))}
      <Sfx name="light-off" at={END - 14} volume={0.4} />
    </Stage>
  );
};
