// s05 X-ray split screen: the floppy ankle (a hammer with a loose head) against the locked ankle,
// the middle of the laces (that's your instep), the toe hit that is 15% slower, and Chalk saving it.
// It opens on the picture s04 ends on, and ends by pulling back out of the boot onto the side-on pitch of s06.
import React from "react";
import { Easing, useCurrentFrame } from "remotion";
import { Stage } from "../kit/Camera";
import { AnkleLock, XRayGrid } from "../kit/XRay";
import { Ball } from "../kit/Ball";
import { Label, WordCard } from "../kit/Graphics";
import { KPOSES, keeperPoseAt, type KeeperPose } from "../kit/Keeper";
import { POSES, mixPose, type Pose } from "../kit/Player";
import { Glow } from "../kit/World";
import { Sfx } from "../kit/Sfx";
import { SHOTS, GOAL_DISTANCE } from "../physics/shots";
import { simulate, crossingAtX } from "../physics/sim";
import { sceneTiming, useCues } from "../lib/timing";
import { EASE, clamp01, idle, lerp, pop, progress, visible } from "../lib/anim";
import { BACKGROUND, CAST, FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../theme";
import { FlatArrow, HammerLeg, LeakPuffs, SaveInset, SpeedBar, footFrame, type P } from "../kit/ext/s04-s05-parts";
import {
  BACKP5,
  BALL5,
  BALL_R5,
  CONTACT5,
  CardFootIcon,
  HIP5,
  LACES_S,
  LH,
  LINE_N,
  MotesAt,
  PITCH_END,
  PPM5,
  PitchEnd,
  TOE_S,
  dangleAt,
  pitchAnkle,
  rightAnkleAt,
} from "../kit/ext/s04-s05-split";

const ARROW = 200; // ball-speed arrow length for a locked-ankle hit (pixels)
// Kicking machine: a locked ankle gave about 4% more ball speed than a springy one.
const LOOSE_K = 0.96;
const HALF_VIEW = { kind: "side" as const, originX: 0, groundY: 0, ppm: PPM5 };

const GOAL_X = GOAL_DISTANCE.TOE_HIT ?? 18;
const TOE = simulate({ ...SHOTS.TOE_HIT, duration: 1.6 }, 30);
const DRIVE = simulate({ ...SHOTS.DRIVE_R, duration: 1.6 }, 30);
const TOE_CROSS = Math.round((crossingAtX(TOE, GOAL_X)?.t ?? 1.17) * 30);
// Chalk's low dive to his left (screen right): the mitten reaches the ball's crossing point.
const SAVE: KeeperPose = { left: 180, right: 165, lean: 90, shift: 0.6, lift: -0.2, stretch: 1.06 };
// Tavi on the pitch at the end, as s06 opens (standing, the kicking leg a little back).
const REST_S06: Pose = { torso: 7, head: 6, nearHip: -14, nearKnee: 40, nearAnkle: 118, farHip: 4, farKnee: 12, farAnkle: 92, nearShoulder: -18, nearElbow: 25, farShoulder: 40, farElbow: 22 };
const STRIKE_P: Pose = { ...POSES.strike, nearHip: 20, nearKnee: 30, nearAnkle: 150 };

const easeSwing = Easing.bezier(0.55, 0, 1, 0.7);

// Hammer head size: at the contact pose its striking face (square across the shin) just touches the ball.
const HEAD_HALF = (() => {
  const ff = footFrame(CONTACT5, LH, HIP5.x, HIP5.y);
  const sl = Math.hypot(ff.ankle.x - ff.knee.x, ff.ankle.y - ff.knee.y);
  const hd = { x: (ff.ankle.x - ff.knee.x) / sl, y: (ff.ankle.y - ff.knee.y) / sl };
  const pf = { x: hd.y, y: -hd.x };
  return (BALL5.x - ff.ankle.x) * pf.x + (BALL5.y - ff.ankle.y) * pf.y - BALL_R5;
})();

// Word timing guard. On this take whisper drifted: the timeline puts the last words after the end of the
// audio (17.2 s in a 15.7 s file), up to 1.6 s late. While the timeline shows that drift, the cues use word
// starts measured from the audio (loudness gaps and whisper on short cuts), in seconds of audio.
const MEASURED: Record<string, number> = {
  "A floppy ankle": 0.47,
  hammer: 2.03,
  "loose head": 2.9,
  "hit leaks": 4.63,
  "leaks away": 4.9,
  "toes down": 6.5,
  "ankle locked": 7.5,
  locked: 8.07,
  "Hit with the middle": 9.13,
  "middle of your laces": 9.53,
  "That's your instep": 10.77,
  instep: 11.03,
  "Hit near your toes": 12.37,
  "your toes": 12.8,
  "and it's about": 13.2,
  "fifteen percent": 14.27,
  slower: 14.97,
};
const MEASURED_END = 15.33; // last word ends
const useS05Cues = () => {
  const cue = useCues("s05");
  const t = sceneTiming("s05");
  const words = t.words ?? [];
  const drift = words.length > 0 && words[words.length - 1].end > t.durationInSeconds + 0.2;
  const at = (phrase: string) => {
    const f = cue(phrase); // still throws if the phrase leaves the narration
    const m = MEASURED[phrase];
    return drift && m !== undefined ? Math.round(cue.lead + m * 30) : f;
  };
  const audioEnd = drift ? Math.round(cue.lead + MEASURED_END * 30) : cue.wordEnd("slower");
  return { at, audioEnd, frames: cue.frames };
};

export const S05: React.FC = () => {
  const frame = useCurrentFrame();
  const { at: c, audioEnd } = useS05Cues();

  // ---------- Beats ----------
  const tFloppy = c("A floppy ankle");
  const tHammer = c("hammer");
  const tLoose = c("loose head");
  const tHit = c("hit leaks");
  const tLeaks = c("leaks away");
  const tToes = c("toes down");
  const tAnkleL = c("ankle locked");
  const tLocked = c("locked");
  const tMiddle = c("middle of your laces");
  const tThats = c("That's your instep");
  const tInstep = c("instep");
  const tNear = c("Hit near your toes");
  const tYourToes = c("your toes");
  const tAbout = c("and it's about");
  const tFifteen = c("fifteen percent");

  // Both hammers hit their balls together on "hit": the loose head flops, the solid one hits clean.
  const cL = tHit;
  const mergeAt = tLocked + 28; // in the pause after "locked"
  const MERGE = 24;
  const cardUntil = tInstep + 60;
  const insetAt = cardUntil + 6;
  const kick = tAbout + 4;
  const catchFrame = kick + TOE_CROSS;
  const T0 = audioEnd - 2; // pull back out of the boot
  const T1 = T0 + 20;

  // ---------- Left: the floppy ankle ----------
  const swingL = easeSwing(clamp01((frame - (cL - 14)) / 14));
  const fold = frame < cL ? 0 : 1 - Math.exp(-(frame - cL) / 4) * Math.cos((frame - cL) / 3.2);
  const dangle = dangleAt(frame) * (1 + 1.2 * progress(frame, tLoose, 12)) * (1 - progress(frame, cL - 14, 10));
  const poseL: Pose = { ...mixPose(BACKP5, CONTACT5, swingL), nearAnkle: 150 + dangle + 26 * fold };
  // The shin turns into the handle and the foot into the head. The loose head wobbles on its pin and flops on impact.
  const morph = progress(frame, tHammer - 2, 16, EASE.standard);
  const hinge = progress(frame, tHammer + 8, 12, EASE.enter);
  const flopL = 2.4 * dangle + 42 * fold;
  const ffL = footFrame({ ...CONTACT5, nearAnkle: 150 }, LH, HIP5.x, HIP5.y);
  const ffLnow = footFrame(poseL, LH, HIP5.x, HIP5.y);
  const ballL: P = { x: ffL.at(LACES_S).x + ffL.n.x * (BALL_R5 + ffL.t), y: ffL.at(LACES_S).y + ffL.n.y * (BALL_R5 + ffL.t) };
  const ballLnow: P = frame >= cL ? { x: ballL.x + Math.min(10, (frame - cL) * 0.6), y: ballL.y } : BALL5;

  // ---------- Right: the locked ankle ----------
  const toesDown = progress(frame, tToes + 2, 14, EASE.standard);
  const rightAnkleBack = lerp(rightAnkleAt(frame), 150, toesDown);
  const swingR = swingL;
  const poseR: Pose = { ...mixPose(BACKP5, CONTACT5, swingR), nearAnkle: rightAnkleBack };
  // A solid hammer from "hammer" to "toes down", then it turns back into the foot (the head tips into toes down).
  const morphR = progress(frame, tHammer + 4, 16, EASE.standard) * (1 - progress(frame, tToes + 2, 14, EASE.standard));
  const flashR = frame >= cL && frame < cL + 10 ? 1 - (frame - cL) / 10 : 0;
  const lockPop = pop(frame, tAnkleL + 2, { stiffness: 260, damping: 14 });
  const locked = progress(frame, tLocked, 5, EASE.enter);
  const oneGlow = progress(frame, tLocked + 4, 10) * (0.8 + 0.2 * Math.sin(frame / 6));
  const ffR = footFrame(poseR, LH, HIP5.x, HIP5.y);
  // After the merge the contact slides from the laces to the toes.
  const slide = progress(frame, tNear, 22, EASE.standard);
  const sContact = lerp(LACES_S, TOE_S, slide);
  const ffC = footFrame(CONTACT5, LH, HIP5.x, HIP5.y);
  const contactPt = ffC.at(sContact);
  const ballR: P = { x: contactPt.x + ffC.n.x * (BALL_R5 + ffC.t), y: contactPt.y + ffC.n.y * (BALL_R5 + ffC.t) };

  // ---------- Split and merge ----------
  const m = progress(frame, mergeAt, MERGE, EASE.standard);
  const D = lerp(WIDTH / 2, -40, m);
  // Right-half content: split place -> centred close-up -> moved left for the save inset.
  const post = { tx: 131, ty: -350, s: 1.3 };
  const later = { tx: -15, ty: -300, s: 1.24 };
  const shiftLater = progress(frame, insetAt - 10, 24, EASE.camera);
  const drift = progress(frame, mergeAt + MERGE, T0 - mergeAt - MERGE, EASE.soft);
  const rs = lerp(1, lerp(post.s, later.s, shiftLater) + 0.03 * drift, m);
  const rtx = lerp(WIDTH / 2, lerp(post.tx, later.tx, shiftLater) - 12 * drift, m);
  const rty = lerp(0, lerp(post.ty, later.ty, shiftLater), m);
  const toScreenR = (p: P): P => ({ x: rtx + p.x * rs, y: rty + p.y * rs });

  // Arrows.
  const arrowL = visible(frame, cL + 2, mergeAt, 4, 8);
  const arrowRgrow = progress(frame, cL + 2, 12, EASE.enter);
  const arrowRfade = 1 - progress(frame, T0 - 6, 8, EASE.exit);
  const speedK = 1 - 0.15 * progress(frame, tFifteen, 16, EASE.standard);

  // Laces band, the laces zone, the contact dot.
  const band = visible(frame, tMiddle, tNear + 8, 12, 10);
  const lacesGlow = visible(frame, tThats, tNear + 4, 12, 10);
  const dot = visible(frame, tMiddle + 4, T0 - 6, 10, 8);

  // Chalk.
  const reach = keeperPoseAt(frame, [
    [kick, "ready"],
    [kick + 12, "ready"],
    [catchFrame, SAVE],
    [catchFrame + 20, SAVE],
  ]);
  const kFace = frame >= catchFrame + 4 ? "smug" : frame >= kick + 8 ? "surprised" : "flat";
  const kLook = frame >= kick ? clamp01((frame - kick) / 20) : idle(frame, 1, 3, 0.2);

  // ---------- Pull back out of the boot (to the side-on pitch of s06) ----------
  const u = progress(frame, T0, T1 - T0, EASE.camera);
  const pitchPose = mixPose(STRIKE_P, REST_S06, progress(frame, T0 + 2, T1 - T0 - 2, EASE.standard));
  const pAnkle = pitchAnkle(pitchPose, PITCH_END.CAM);
  const xAnkle = toScreenR(ffC.ankle);
  const K = (LH * rs) / (1.62 * PITCH_END.PPM * PITCH_END.CAM.zoom);
  const kNow = Math.exp(Math.log(K) * (1 - u));
  const pNow: P = { x: lerp(xAnkle.x, pAnkle.x, u), y: lerp(xAnkle.y, pAnkle.y, u) };
  // Short cross-fade, so the x-ray boot and the pitch boot do not double up.
  const xrayOp = 1 - progress(frame, T0 + 1, 5, EASE.soft);
  const pitchOp = progress(frame, T0 - 1, 5, EASE.soft);
  const xBallOut = 1 - progress(frame, T0 - 2, 4, EASE.exit); // the x-ray ball leaves first (no second ball)
  const lockOut = 1 - progress(frame, T0 - 10, 8, EASE.exit);
  const xrayT = frame >= T0 ? `translate(${pNow.x} ${pNow.y}) scale(${kNow / K}) translate(${-xAnkle.x} ${-xAnkle.y})` : undefined;

  const halfBg = (side: "L" | "R", op: number) => (
    <rect x={side === "L" ? 0 : D} y={0} width={side === "L" ? Math.max(0, D) : WIDTH - D} height={HEIGHT} fill={side === "L" ? XRAY.pink : XRAY.lime} opacity={op} />
  );

  const sizeLock = LH * 0.03 * 2.6;
  const lockX = ffR.ankle.x - LH * 0.03 * 1.7 - sizeLock;
  const lockY = ffR.ankle.y - sizeLock * 0.4;
  const lacesS = toScreenR(ffC.at(LACES_S));
  const toesS = toScreenR(ffC.at(TOE_S));

  return (
    <Stage bg={BACKGROUND["X-ray Physics"]}>
      <g opacity={xrayOp}>
        <XRayGrid />
        {halfBg("L", 0.035)}
        {halfBg("R", 0.035 * progress(frame, tLocked, 12))}
        <defs>
          <clipPath id="s05-left">
            <rect x={0} y={0} width={Math.max(0, D)} height={HEIGHT} />
          </clipPath>
          <clipPath id="s05-right">
            <rect x={D} y={0} width={WIDTH - D} height={HEIGHT} />
          </clipPath>
        </defs>

        {/* ---------- Left half: the floppy ankle ---------- */}
        {D > 0 ? (
          <g clipPath="url(#s05-left)">
            <g transform={`translate(${D - WIDTH / 2} 0)`}>
              <HammerLeg x={HIP5.x} y={HIP5.y} h={LH} pose={poseL} morph={morph} hinge={hinge} kind="loose" flop={flopL} headHalf={HEAD_HALF} />
              <Ball cx={ballLnow.x} cy={ballLnow.y} r={BALL_R5} view={HALF_VIEW} lineNormal={LINE_N} />
              <LeakPuffs x={ffLnow.ankle.x} y={ffLnow.ankle.y} at={cL + 2} size={72} seed="s05leak" count={9} dir={215} />
              <LeakPuffs x={ffLnow.ankle.x} y={ffLnow.ankle.y} at={tLeaks + 4} size={56} seed="s05leak2" count={6} dir={245} />
              {arrowL > 0.001 ? (
                <g opacity={arrowL}>
                  <FlatArrow x={ballL.x + BALL_R5 + 22} y={ballL.y} len={ARROW} color={PITCH.chalk} width={16} opacity={0.6 * progress(frame, cL + 12, 8)} outline />
                  <FlatArrow x={ballL.x + BALL_R5 + 22} y={ballL.y} len={ARROW * LOOSE_K * progress(frame, cL + 2, 12, EASE.enter)} color={CAST.ball} width={16} />
                  <text x={ballL.x + BALL_R5 + 22} y={ballL.y + 66} fill={XRAY.bone} opacity={0.8} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} letterSpacing={2}>
                    BALL SPEED
                  </text>
                </g>
              ) : null}
              <Label x={WIDTH / 4} y={110} text="FLOPPY ANKLE" at={tFloppy + 4} size={44} bg={XRAY.pink} color={XRAY.bg} />
            </g>
          </g>
        ) : null}

        {/* ---------- Right half: the locked ankle, then the close-up ---------- */}
        <g clipPath="url(#s05-right)">
          <g transform={xrayT}>
            <g transform={`translate(${rtx} ${rty}) scale(${rs})`}>
              {oneGlow > 0.001 ? (
                <>
                  <polyline
                    points={`${ffR.knee.x},${ffR.knee.y} ${ffR.ankle.x},${ffR.ankle.y} ${ffR.toe.x},${ffR.toe.y}`}
                    fill="none"
                    stroke={XRAY.lime}
                    strokeWidth={LH * 0.12}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.2 * oneGlow}
                  />
                  <polyline
                    points={`${ffR.knee.x},${ffR.knee.y} ${ffR.ankle.x},${ffR.ankle.y} ${ffR.toe.x},${ffR.toe.y}`}
                    fill="none"
                    stroke={XRAY.lime}
                    strokeWidth={LH * 0.05}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.45 * oneGlow}
                  />
                </>
              ) : null}
              <HammerLeg x={HIP5.x} y={HIP5.y} h={LH} pose={poseR} morph={morphR} hinge={0} kind="solid" headHalf={HEAD_HALF} flash={flashR} />
              {/* "That's your instep": the whole laces zone glows under the green band. */}
              {lacesGlow > 0.001 ? (
                <g opacity={lacesGlow}>
                  <line
                    x1={ffC.at(0.18).x + ffC.n.x * ffC.t * 0.5}
                    y1={ffC.at(0.18).y + ffC.n.y * ffC.t * 0.5}
                    x2={ffC.at(0.74).x + ffC.n.x * ffC.t * 0.5}
                    y2={ffC.at(0.74).y + ffC.n.y * ffC.t * 0.5}
                    stroke={XRAY.lime}
                    strokeWidth={ffC.t * 2.6}
                    strokeLinecap="round"
                    opacity={0.22 + 0.06 * Math.sin(frame / 5)}
                  />
                  <line
                    x1={ffC.at(0.18).x + ffC.n.x * ffC.t * 0.9}
                    y1={ffC.at(0.18).y + ffC.n.y * ffC.t * 0.9}
                    x2={ffC.at(0.74).x + ffC.n.x * ffC.t * 0.9}
                    y2={ffC.at(0.74).y + ffC.n.y * ffC.t * 0.9}
                    stroke={XRAY.lime}
                    strokeWidth={10}
                    strokeLinecap="round"
                    opacity={0.9}
                  />
                </g>
              ) : null}
              {band > 0.001 ? (
                <g opacity={band}>
                  <Glow cx={ffC.at(LACES_S).x} cy={ffC.at(LACES_S).y} r={90} color={XRAY.lime} intensity={1.2} rings={4} />
                  <line
                    x1={ffC.at(LACES_S).x - ffC.n.x * ffC.t * 1.1}
                    y1={ffC.at(LACES_S).y - ffC.n.y * ffC.t * 1.1}
                    x2={ffC.at(LACES_S).x + ffC.n.x * ffC.t * 1.1}
                    y2={ffC.at(LACES_S).y + ffC.n.y * ffC.t * 1.1}
                    stroke={XRAY.lime}
                    strokeWidth={ffC.L * 0.16}
                    strokeLinecap="round"
                  />
                </g>
              ) : null}
              {/* The lock snaps onto the ankle. */}
              {lockPop * lockOut > 0.001 ? (
                <g opacity={lockOut} transform={`translate(${lockX + sizeLock / 2} ${lockY + sizeLock * 0.4}) scale(${lockPop}) translate(${-lockX - sizeLock / 2} ${-lockY - sizeLock * 0.4})`}>
                  <AnkleLock x={lockX + sizeLock / 2} y={lockY} size={sizeLock} locked={locked} />
                </g>
              ) : null}
              <g opacity={xBallOut}>
                <Ball cx={ballR.x} cy={ballR.y} r={BALL_R5} view={HALF_VIEW} lineNormal={LINE_N} />
              </g>
              {dot > 0.001 ? (
                <g opacity={dot}>
                  <circle cx={contactPt.x + ffC.n.x * ffC.t} cy={contactPt.y + ffC.n.y * ffC.t} r={20} fill={slide > 0.5 ? XRAY.pink : XRAY.lime} />
                  <circle
                    cx={contactPt.x + ffC.n.x * ffC.t}
                    cy={contactPt.y + ffC.n.y * ffC.t}
                    r={32}
                    fill="none"
                    stroke={slide > 0.5 ? XRAY.pink : XRAY.lime}
                    strokeWidth={5}
                    opacity={0.6 + 0.4 * Math.sin(frame / 4)}
                  />
                </g>
              ) : null}
              {arrowRgrow > 0.001 && arrowRfade > 0.001 ? (
                <g opacity={arrowRfade}>
                  <FlatArrow x={ballR.x + BALL_R5 + 22} y={ballR.y} len={ARROW * speedK * arrowRgrow} color={CAST.ball} width={16} />
                  <text x={ballR.x + BALL_R5 + 22} y={ballR.y + 66} fill={XRAY.bone} opacity={0.8 * (1 - m)} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} letterSpacing={2}>
                    BALL SPEED
                  </text>
                </g>
              ) : null}
            </g>
          </g>
          {/* Right-half labels (screen space, they leave when the halves merge). */}
          <g opacity={1 - progress(frame, mergeAt, 8, EASE.exit)}>
            <Label x={D + WIDTH / 4} y={110} text="LOCKED" at={tFloppy + 8} until={tToes} size={44} bg={XRAY.lime} color={XRAY.bg} />
            <Label x={D + 270} y={110} text="TOES DOWN" at={tToes + 4} size={44} bg={XRAY.lime} color={XRAY.bg} />
            <Label x={D + 660} y={110} text="ANKLE LOCKED" at={tAnkleL + 4} size={44} bg={XRAY.lime} color={XRAY.bg} />
          </g>
        </g>

        {/* Divider. */}
        {D > -20 ? <line x1={D} y1={0} x2={D} y2={HEIGHT} stroke={PITCH.chalk} strokeWidth={8} strokeLinecap="round" /> : null}

        {/* ---------- After the merge ---------- */}
        <Label x={lacesS.x - 150} y={lacesS.y + 10} text="MIDDLE OF LACES" anchor="end" at={tMiddle + 4} until={tNear} size={40} bg={XRAY.lime} color={XRAY.bg} />
        {band > 0.001 ? (
          <line
            x1={lacesS.x - 140}
            y1={lacesS.y + 10}
            x2={lacesS.x - 70}
            y2={lacesS.y + 4}
            stroke={XRAY.lime}
            strokeWidth={5}
            strokeLinecap="round"
            opacity={band * progress(frame, tMiddle + 4, 8) * (1 - progress(frame, tNear, 8, EASE.exit))}
          />
        ) : null}
        <WordCard term="instep" meaning="the laces part of your foot, not the inside" at={tInstep} until={cardUntil} x={WIDTH - 60} y={70} />
        <CardFootIcon frame={frame} term="instep" meaning="the laces part of your foot, not the inside" at={tInstep} until={cardUntil} x={WIDTH - 60} y={70} crossAt={tInstep + 16} />
        <Label x={toesS.x - 150} y={toesS.y + 30} text="NEAR THE TOES" anchor="end" at={tYourToes} until={T0 - 6} size={40} bg={XRAY.pink} color={XRAY.bg} />

        <g
          transform={`translate(${1080 + 390} ${70 + 235}) scale(${1 + 0.06 * progress(frame, kick, T0 - kick, EASE.camera)}) translate(${-1080 - 390} ${-70 - 235})`}
        >
          <SaveInset
            x={1080}
            y={70}
            w={780}
            h={470}
            at={insetAt}
            until={T0 - 6}
            kick={kick}
            slow={TOE}
            fast={DRIVE}
            goalX={GOAL_X}
            keeperPose={frame >= kick ? reach : KPOSES.ready}
            keeperFace={kFace}
            keeperLook={kLook}
            catchFrame={catchFrame}
            lineNormal={LINE_N}
          />
        </g>

        <MotesAt frame={frame} seed="s05" />
      </g>

      {/* ---------- The side-on pitch (s06 opens here) ---------- */}
      {frame >= T0 ? <PitchEnd cam={PITCH_END.CAM} k={kNow} from={pAnkle} to={pNow} pose={pitchPose} opacity={pitchOp} /> : null}

      {/* The speed bar stays on top until the pitch has settled. */}
      <SpeedBar x={250} y={930} w={620} at={tNear + 18} dropAt={tFifteen} value={0.85} caption="BALL SPEED" dropLabel="−15% (toe hit)" until={T1 - 8} />

      {/* ---------- Sound ---------- */}
      <Sfx name="pop" at={tFloppy + 4} volume={0.3} />
      <Sfx name="chalk" at={tHammer} volume={0.35} />
      <Sfx name="chalk" at={tLoose} volume={0.3} />
      <Sfx name="pop-soft" at={tFloppy + 8} volume={0.25} />
      <Sfx name="whoosh" at={cL - 14} volume={0.35} />
      <Sfx name="thump" at={cL} volume={0.55} />
      <Sfx name="tick" at={cL} volume={0.35} />
      <Sfx name="stamp" at={cL + 1} volume={0.2} />
      <Sfx name="air" at={cL + 2} volume={0.3} dur={40} />
      <Sfx name="pop-soft" at={tToes + 4} volume={0.3} />
      <Sfx name="pop-soft" at={tAnkleL + 4} volume={0.25} />
      <Sfx name="tick" at={tLocked} volume={0.5} />
      <Sfx name="stamp" at={tLocked} volume={0.25} />
      <Sfx name="whoosh" at={mergeAt} volume={0.25} />
      <Sfx name="pop-soft" at={tMiddle + 4} volume={0.3} />
      <Sfx name="pop" at={tInstep} volume={0.35} />
      <Sfx name="blip" at={tInstep + 16} volume={0.25} />
      <Sfx name="blip" at={tNear} volume={0.25} />
      <Sfx name="pop-soft" at={insetAt} volume={0.3} />
      <Sfx name="thump" at={kick} volume={0.35} />
      <Sfx name="net" at={kick + 31} volume={0.25} />
      <Sfx name="clang" at={catchFrame} volume={0.2} />
      <Sfx name="thump" at={catchFrame} volume={0.45} />
      <Sfx name="subdrop" at={tFifteen} volume={0.3} />
      <Sfx name="whoosh-long" at={T0} volume={0.3} />
    </Stage>
  );
};
