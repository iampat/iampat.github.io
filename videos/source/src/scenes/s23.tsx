// s23 Ending: half past nine, lights out, Chalk sinks back into the line, the hundredth of a
// second, Tavi walks home with the ball, and the stadium becomes one warm dot in the city.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, cameraAt } from "../kit/Camera";
import { Dust, GroundSide, StandClock, Stars } from "../kit/World";
import { Player, POSES, cyclePose, mixPose, type Pose } from "../kit/Player";
import { Keeper, keeperPoseAt } from "../kit/Keeper";
import { Ball } from "../kit/Ball";
import { GoalSide } from "../kit/Goal";
import { SlowMoTag, TitleCard } from "../kit/Graphics";
import { Sfx } from "../kit/Sfx";
import { SHOTS } from "../physics/shots";
import { simulate } from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, progress } from "../lib/anim";
import { type View } from "../lib/project";
import { HEIGHT, PITCH, WIDTH } from "../theme";
import { DarkPool, LineHalo, SideBackdrop, Stopwatch, breathe, camT, taviJoints, toScreen } from "../kit/ext/s21-s23-bits";
import { StadiumPlate } from "../kit/ext/s21-s23-goal";
import { StrikeCloseUp } from "../kit/ext/s21-s23-closeup";
import { CITY_CENTRE, CityMap } from "../kit/ext/s21-s23-city";

const PPM = 50;
const OX = 400;
const GROUND = 820;
const GOAL_M = 18;
const X = (m: number) => OX + m * PPM;
const SIDE: View = { kind: "side", originX: OX, groundY: GROUND, ppm: PPM };
const LINE_N = { x: 0.92, y: 0.25, z: 0.3 };
const TAVI_H = 1.62 * PPM;
const BALL_R = 0.11 * PPM * 1.1;
const DRIVE = simulate({ ...SHOTS.DRIVE_L, duration: 1 }, 30);
const NIGHT = "#151A3D";

/** Carrying the ball: walking legs with the "hold" arms. */
const carry = (walk: Pose): Pose => ({
  ...walk,
  torso: 4,
  nearShoulder: POSES.hold.nearShoulder - 20,
  nearElbow: POSES.hold.nearElbow + 30,
  farShoulder: POSES.hold.farShoulder - 20,
  farElbow: POSES.hold.farElbow + 30,
});

export const S23: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s23");

  const tHalf = cue("Half past nine");
  const tLights = cue("Lights out");
  const tHund = cue("a hundredth of a second");
  const tFootEnd = cue.end("Your foot gets");
  const tNow = cue("Now you know how to spend it");
  const END = cue.frames;

  // Right to left. Lamp 3 (index 2) went off at the end of s22, so the close open shows it dark.
  const offAt = [tLights + 20, tLights + 14, -999, tLights + 8];
  const lastOff = tLights + 20;
  const shotB = tLights + 32;
  const shotB2 = tHund - 2;
  const shotC = tFootEnd;
  const shotD = tNow + 8;

  // ---------- A: the stand clock moves to half past nine, then the lights go out ----------
  if (frame < shotB) {
    const c = cameraAt(frame, [
      { f: 0, x: 960, y: 405, zoom: 1.95 },
      { f: tLights - 14, x: 960, y: 410, zoom: 1.85 },
      { f: tLights + 16, x: 960, y: 540, zoom: 1.03 },
      { f: shotB, x: 960, y: 540, zoom: 1.0 },
    ]);
    const lamps = offAt.map((t) => 1 - progress(frame, t, 7, EASE.exit));
    const hours = 21 + 22 / 60 + (8 / 60) * progress(frame, tHalf, 24, EASE.standard);
    const out = progress(frame, lastOff, 12, EASE.soft);
    return (
      <Stage bg={PITCH.skyHigh}>
        <g transform={`translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${c.zoom}) translate(${-c.x} ${-c.y})`}>
          <StadiumPlate lamps={lamps} seed="s23a" />
          <Stars count={70} maxY={300} seed="s23a2" opacity={out} />
          <StandClock x={960} y={392} r={40} hours={hours} />
          <rect x={-200} y={-200} width={WIDTH + 400} height={HEIGHT + 400} fill={PITCH.skyHigh} opacity={0.3 * out} />
        </g>
        <Sfx name="tick" at={tHalf + 6} volume={0.3} />
        <Sfx name="tick" at={tHalf + 24} volume={0.35} />
        {[3, 1, 0].map((i) => (
          <Sfx key={i} name="light-off" at={offAt[i]} volume={0.4} />
        ))}
        <Sfx name="subdrop" at={lastOff} volume={0.3} />
      </Stage>
    );
  }

  // ---------- B1: Chalk sinks back into the goal line ----------
  if (frame < shotB2) {
    const cam = cameraAt(frame, [
      { f: shotB, x: X(GOAL_M) - 30, y: GROUND - 85, zoom: 2.9 },
      { f: shotB2, x: X(GOAL_M) - 20, y: GROUND - 80, zoom: 3.05 },
    ]);
    const sink = progress(frame, shotB + 4, 22, EASE.standard);
    const kPose = keeperPoseAt(frame, [
      [shotB, "stand"],
      [shotB + 5, "slump"],
    ]);
    const lineO = progress(frame, shotB + 20, 10);
    return (
      <Stage bg={PITCH.skyHigh}>
        <SideBackdrop cam={cam} ground={GROUND} refX={X(4)} seed="s23b" lamps={[0, 0, 0, 0]} starOpacity={1} />
        <g transform={camT(cam)}>
          <GroundSide groundY={GROUND} vanishX={X(8)} />
          <GoalSide view={SIDE} goalX={GOAL_M} netOpacity={0.25} />
          <Keeper x={X(GOAL_M) - 8} groundY={GROUND} h={2.1 * PPM} pose={kPose} face="flat" rise={1 - sink} look={-0.4} />
          <Dust x={X(GOAL_M) - 8} y={GROUND} at={shotB + 8} size={46} seed="sink23" />
          <rect x={X(GOAL_M) - 8 - 34} y={GROUND - 1.5} width={68} height={4} rx={2} fill={PITCH.chalk} opacity={lineO} />
        </g>
        <DarkPool id="pool-b1" cx={WIDTH / 2} cy={HEIGHT * 0.7} r={900} dark={0.45} pool={0.6} />
        <Sfx name="chalk" at={shotB + 4} volume={0.4} />
      </Stage>
    );
  }

  // ---------- B2: the contact moment flashes once more, 0.01 s ----------
  if (frame < shotC) {
    const contact = shotB2 + 4;
    const flash = progress(frame, contact, 7, EASE.soft);
    return (
      <Stage bg={PITCH.skyHigh}>
        <StrikeCloseUp swingAt={shotB2 - 6} contactAt={contact} releaseAt={contact + 18} flight={DRIVE} follow={0.6} dark={0.3} speed={0.08} lineNormal={LINE_N} ballX={700} push={0.05 * progress(frame, shotB2, shotC - shotB2, EASE.camera)} />
        <Stopwatch x={1460} y={270} at={contact + 3} until={shotC - 8} text="0.01 s" r={120} />
        <SlowMoTag at={contact + 2} until={shotC - 6} />
        {frame >= contact && flash < 1 ? <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={PITCH.chalk} opacity={0.55 * (1 - flash)} /> : null}
        <Sfx name="thump" at={contact} volume={0.45} />
        <Sfx name="thump" at={contact + 9} volume={0.15} />
        <Sfx name="tick" at={contact + 3} volume={0.3} />
      </Stage>
    );
  }

  // ---------- C: Tavi picks up the ball and walks away; a pool of light on the Line ----------
  if (frame < shotD) {
    const cam = cameraAt(frame, [
      { f: shotC, x: X(0.5), y: GROUND - 70, zoom: 3.5 },
      { f: shotD, x: X(-0.2), y: GROUND - 72, zoom: 3.6 },
    ]);
    const bend = shotC + 4;
    const grab = shotC + 17;
    const rise = grab + 12;
    const walkAt = rise + 2;
    const walked = Math.max(0, frame - walkAt) * 0.042; // metres, about 1.3 m/s
    const hip = X(1.2 - walked);
    let pose: Pose;
    if (frame < bend) pose = breathe(POSES.stand, frame, 3);
    else if (frame < grab) pose = mixPose(POSES.stand, POSES.crouch, progress(frame, bend, grab - bend, EASE.soft));
    else if (frame < walkAt) pose = mixPose(POSES.crouch, carry(POSES.stand), progress(frame, grab + 2, rise - grab - 2, EASE.soft));
    // Blend into the walk cycle so the first stride does not jump.
    else pose = mixPose(carry(POSES.stand), carry(cyclePose(frame - walkAt, "walk", 12)), progress(frame, walkAt, 8, EASE.soft));
    const J = taviJoints(pose, hip, GROUND, TAVI_H, true);
    const restBall = { x: X(0.35), y: GROUND - 0.11 * PPM };
    const held = { x: (J.nearHand.x + J.farHand.x) / 2 - BALL_R * 0.9, y: (J.nearHand.y + J.farHand.y) / 2 - BALL_R * 0.4 };
    const lift = progress(frame, grab - 2, 6, EASE.soft);
    const ball = frame < grab - 2 ? restBall : { x: restBall.x + (held.x - restBall.x) * lift, y: restBall.y + (held.y - restBall.y) * lift };
    const bs = toScreen(cam, ball.x, ball.y);
    const glow = progress(frame, tNow, 6, EASE.enter) * (1 - progress(frame, tNow + 10, 14, EASE.soft));
    const angle = frame < grab ? 0 : -0.04 * (frame - grab);
    return (
      <Stage bg={PITCH.skyHigh}>
        <SideBackdrop cam={cam} ground={GROUND} refX={X(4)} seed="s23c" lamps={[0, 0, 0, 0]} />
        <g transform={camT(cam)}>
          <GroundSide groundY={GROUND} vanishX={X(8)} />
          <Player x={hip} groundY={GROUND} h={TAVI_H} pose={pose} flip face="happy" />
          <Ball cx={ball.x} cy={ball.y} r={BALL_R} view={SIDE} axis={{ x: 0, y: -1, z: 0 }} angle={angle} lineNormal={LINE_N} />
          <LineHalo cx={ball.x} cy={ball.y} r={BALL_R} view={SIDE} axis={{ x: 0, y: -1, z: 0 }} angle={angle} lineNormal={LINE_N} amount={0.35 + 0.65 * glow} />
        </g>
        <DarkPool id="pool-c" cx={bs.x} cy={bs.y} r={560 + 60 * glow} dark={0.62} pool={0.95} />
        {glow > 0.01 ? (
          <g opacity={glow}>
            <circle cx={bs.x} cy={bs.y} r={BALL_R * cam.zoom * (1.6 + 1.4 * glow)} fill="none" stroke={PITCH.lightSoft} strokeWidth={5} opacity={0.6} />
          </g>
        ) : null}
        <Sfx name="pop-soft" at={grab} volume={0.25} />
        {[0, 1, 2, 3].map((i) => (
          <Sfx key={i} name="tick" at={walkAt + 4 + i * 12} volume={0.12 - i * 0.025} />
        ))}
        <Sfx name="bell" at={tNow} volume={0.3} />
      </Stage>
    );
  }

  // ---------- D: pull back to the city; the title; fade to night ----------
  const e = progress(frame, shotD, 40, EASE.camera);
  const scale = Math.exp(Math.log(40) * (1 - e));
  const walked = (frame - shotD) * 0.042;
  const ballCity = { x: CITY_CENTRE.x + 34.5 - 1.2 - walked, y: CITY_CENTRE.y + 0.5 };
  const focus = { x: ballCity.x + (CITY_CENTRE.x - ballCity.x) * e, y: ballCity.y + (CITY_CENTRE.y - ballCity.y) * e };
  const fade = progress(frame, END - 12, 12, EASE.soft);
  return (
    <Stage bg={NIGHT}>
      <g transform={`translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${scale}) translate(${-focus.x} ${-focus.y})`}>
        <CityMap dot={ballCity} dotGlow={1} tavi={{ x: ballCity.x + 0.35, y: ballCity.y, dir: 0 }} pxPerUnit={scale} />
      </g>
      <TitleCard text="THREE SPINS AND A LINE" at={shotD + 6} until={END + 30} y={250} size={96} />
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={NIGHT} opacity={fade} />
      <Sfx name="whoosh-long" at={shotD} volume={0.3} />
      <Sfx name="bell" at={shotD + 8} volume={0.35} />
      <Sfx name="tick" at={shotD + 4} volume={0.08} />
      <Sfx name="tick" at={shotD + 16} volume={0.05} />
    </Stage>
  );
};

