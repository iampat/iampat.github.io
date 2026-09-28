// s14 The timing window. It starts on s13's frozen frame: the dot grid dissolves into dust that
// falls with the ball. Take 1: the ball keeps falling while Tavi swings, and a ghost ball marks
// where it was when the last whip started (the gap is wider than the ball). Rewind. Take 2: a
// disc lands beside the drop spot (a small arrow on its toes points at the goal) and Tavi plants
// early. The swing starts early, while the ball is still well above knee height, and contact
// happens on the knee-height line with the knee over the ball. Ends by zooming into the shin
// and foot (to X-ray).
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, cameraAt, type CamKey } from "../kit/Camera";
import { Dust, Glow } from "../kit/World";
import { Player, mixPose, cyclePose, solve, type Pose } from "../kit/Player";
import { Ball } from "../kit/Ball";
import { Arrow, Label } from "../kit/Graphics";
import { Sfx } from "../kit/Sfx";
import { sampleAt } from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, clamp01, idle, pop, progress, visible } from "../lib/anim";
import { PITCH, XRAY } from "../theme";
import {
  BALL_R,
  ClockIcon,
  DC,
  DROP,
  DROP_X_M,
  D_WHIP,
  GROUND,
  GhostBall,
  PLANT_HIP_M,
  PitchBackdrop,
  S13_END_CAM,
  S14_RESUME,
  SIDE,
  SwapTag,
  TAVI_H,
  VBracket,
  VPOSE,
  X,
  Z,
  hipY,
  s13Timing,
  take1PlantT,
  toScreen,
  volleyAt,
  warp,
  type Cam,
} from "../kit/ext/s13-s15-volley";
import { REPLAY_CROSS, VolleyDots } from "../kit/ext/s13-s15-dots";

const LINE_N = { x: 0.92, y: 0.25, z: 0.3 };

// The standing foot on the plant pose (world pixels): the disc goes here.
const PJ = solve(VPOSE.plant, TAVI_H);
const FOOT_X = X(PLANT_HIP_M) + (PJ.fa.x + PJ.fToe.x) / 2;
const TOE_X = X(PLANT_HIP_M) + PJ.fToe.x;
const KNEE_Z = DROP[DC].pos.z; // knee height: the contact line

/**
 * Take 2 ball time: held at the top, then a slow fall that reaches the whip-start sample at
 * `whipF`, then slows further so contact lands on `contactF`. Returns d (DROP samples).
 */
const take2Time = (frame: number, fallF: number, whipF: number, contactF: number) => {
  const shape = (f: number, a: number, b: number) => {
    if (f < fallF) return 0;
    if (f < fallF + 8) return a * ((f - fallF) / 8);
    if (f < whipF - 6) return a;
    if (f < whipF + 6) return a + (b - a) * ((f - (whipF - 6)) / 12);
    return b;
  };
  const integ = (upto: number, a: number, b: number) => warp(upto, fallF, (f) => shape(f, a, b));
  // d is linear in (a, b): solve d(whipF) = D_WHIP and d(contactF) = DC.
  const A1 = integ(whipF, 1, 0);
  const B1 = integ(whipF, 0, 1);
  const A2 = integ(contactF, 1, 0);
  const B2 = integ(contactF, 0, 1);
  const det = A1 * B2 - A2 * B1;
  const a = (D_WHIP * B2 - DC * B1) / det;
  const b = (A1 * DC - A2 * D_WHIP) / det;
  return Math.min(DC, Math.max(0, integ(frame, a, b)));
};

export const S14: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s14");
  const cue13 = useCues("s13");
  const tm13 = s13Timing(cue13);
  const d0 = tm13.dropEnd; // where s13 left the ball
  const idle0 = tm13.W(cue13.frames); // s13's breathing phase on its last frame
  const f13 = cue13.frames + frame; // the s13 clock, for the dot grid

  // ---------- Beats ----------
  const tKeeps = cue("The ball keeps falling");
  const tFoot = cue("standing foot");
  const tEarly = cue("early"); // the first "early" (standing foot early)
  const tBeside = cue("beside where it will drop");
  const tStart = cue("Start your swing early");
  const tSwingEarly = cue("swing early");
  const tHit = cue("Hit it at knee height");
  const tKnee = cue("knee height or lower");
  const tSpeechEnd = cue.wordEnd("or lower");
  const end = cue.frames;

  // ---------- Ball time ----------
  // Take 1: from s13's frozen frame, slow motion (0.25x) until contact. Time starts again when
  // the dot grid dissolves (S14_RESUME), so the dust falls with the ball.
  const speed1 = (f: number) => 0.003 + 0.247 * progress(f, S14_RESUME, 10, EASE.soft);
  let contact1 = 60;
  let whip1 = 50;
  {
    let dd = d0;
    let seenWhip = false;
    for (let f = 0; f < 200; f++) {
      dd += speed1(f + 0.5);
      if (!seenWhip && dd >= D_WHIP) {
        whip1 = f + 1;
        seenWhip = true;
      }
      if (dd >= DC) {
        contact1 = f + 1;
        break;
      }
    }
  }
  const rewindAt = Math.max(contact1 + 30, tFoot - 22);
  const rewindDur = 14;
  const rewindEnd = rewindAt + rewindDur;
  // Take 2: hold at the top, fall from "beside where it will drop", whip starts on "swing early",
  // contact on "knee".
  const fall2 = tBeside + 12;
  const whip2 = tSwingEarly + 9;
  const contact2 = tKnee;
  const plant2 = tFoot + 8; // the plant step onto the disc (real time)

  let d: number;
  let take2 = false;
  if (frame < contact1) d = Math.min(DC, d0 + warp(frame, 0, speed1));
  else if (frame < rewindAt) d = DC;
  else if (frame < rewindEnd) d = DC * (1 - progress(frame, rewindAt, rewindDur, EASE.soft));
  else {
    take2 = true;
    d = take2Time(frame, fall2, whip2, contact2);
  }
  const rewinding = frame >= rewindAt && frame < rewindEnd;
  const bz = sampleAt(DROP, d).pos.z;
  const ballW = { x: X(DROP_X_M), y: Z(bz) };
  const atContact = d >= DC - 0.001;

  // ---------- Tavi ----------
  // Take 1 is planted from the start (s13 ends on the plant). The rewind steps back to the set stance.
  const plantT = take2 ? progress(frame, plant2, 20, EASE.standard) : rewinding ? take1PlantT(d) : 1;
  const v = volleyAt(d, plantT);
  const breathe = idle(idle0 + frame * (atContact ? 0.05 : 0.3), 1, 3, 1.2);
  let pose: Pose = { ...v.pose, torso: v.pose.torso + breathe };
  // The plant step onto the disc: a little walk blend.
  if (take2 && plantT > 0 && plantT < 1) pose = mixPose(pose, { ...cyclePose(frame - plant2, "walk", 10), head: pose.head, torso: pose.torso }, 0.35 * Math.sin(Math.PI * plantT));
  if (rewinding && d < 7) pose = mixPose(pose, { ...cyclePose(-frame, "walk", 5), head: pose.head, torso: pose.torso }, 0.2);
  const hip = v.hip;

  // ---------- Camera ----------
  // One framing for both takes (no camera move at the rewind).
  const take2Cam: Cam = { x: X(DROP_X_M - 0.1), y: Z(1.0), zoom: 5.0 };
  const contactCam: Cam = { x: X(DROP_X_M - 0.12), y: Z(0.42), zoom: 12 };
  const zoomIn = tSpeechEnd - 10;
  const keysC: CamKey[] = [
    // Hold s13's last framing until the dot grid dissolves, so the ball never slides under it.
    { f: S14_RESUME, x: S13_END_CAM.x, y: S13_END_CAM.y, zoom: S13_END_CAM.zoom },
    { f: S14_RESUME + 34, x: take2Cam.x, y: take2Cam.y, zoom: take2Cam.zoom },
    { f: zoomIn, x: take2Cam.x - 4, y: take2Cam.y + 4, zoom: take2Cam.zoom * 1.06 },
    { f: end, x: contactCam.x, y: contactCam.y, zoom: contactCam.zoom },
  ];
  const c = cameraAt(frame, keysC);
  const cam: Cam = { x: c.x, y: c.y, zoom: c.zoom };
  const S = (p: { x: number; y: number }) => toScreen(cam, p);
  const BR = BALL_R * 1.08; // same drawn size as in s13
  const rS = BR * cam.zoom;

  // ---------- Graphics positions (screen) ----------
  const ballS = S(ballW);
  const ghostS = S({ x: X(DROP_X_M), y: Z(sampleAt(DROP, D_WHIP).pos.z) });
  const contactS = S({ x: X(DROP_X_M), y: Z(KNEE_Z) });
  const groundS = S({ x: 0, y: GROUND }).y;
  const ghost1 = !take2 && frame < rewindAt + 2 ? pop(frame, whip1, { stiffness: 260, damping: 16 }) : 0;
  const take1Labels = contact1 + 3;
  const ghost2 = take2 ? pop(frame, Math.ceil(whip2), { stiffness: 260, damping: 16 }) : 0;
  const dropLine = take2 ? visible(frame, tBeside + 2, tHit, 14, 10) : 0;
  const kneeLine = take2 ? visible(frame, tStart, end - 12, 14, 8) : 0;
  const kneeGlow = take2 ? progress(frame, tHit - 2, 12, EASE.enter) : 0;
  const discLand = pop(frame, tFoot + 2, { stiffness: 200, damping: 13 });
  const disc = take2 ? discLand * (1 - progress(frame, end - 14, 10, EASE.exit)) : 0;
  const discS = S({ x: FOOT_X, y: GROUND });
  const toeS = S({ x: TOE_X, y: GROUND });
  const plantF = plant2 + 16;
  const discGlow = take2 ? clamp01(1 - Math.abs(frame - plantF) / 10) : 0;
  const xray = 0.85 * progress(frame, end - 14, 14, EASE.soft);
  const flash1 = frame >= contact1 && frame < contact1 + 10 ? 1 - (frame - contact1) / 10 : 0;
  const flash2 = frame >= contact2 && frame < contact2 + 10 ? 1 - (frame - contact2) / 10 : 0;
  const labelX = contactS.x + rS + 96;
  const labelsOut = tSpeechEnd - 4;

  // s13's chalk arrow (ball to laces), fading out as the dots dissolve.
  const j = solve(pose, TAVI_H);
  const hy = hipY(pose, TAVI_H, GROUND);
  const lacesS = S({ x: X(hip) + j.na.x + (j.nToe.x - j.na.x) * 0.5, y: hy + j.na.y + (j.nToe.y - j.na.y) * 0.5 });
  const rS13 = rS;
  const ad = { x: lacesS.x - ballS.x, y: lacesS.y - ballS.y };
  const al = Math.hypot(ad.x, ad.y) || 1;

  return (
    <Stage bg={PITCH.sky}>
      <PitchBackdrop cam={cam} seed="s13">
        {/* Disc beside the drop spot (where the standing foot goes). It drops in and lands. */}
        {disc > 0.001 ? (
          <g transform={`translate(${FOOT_X} ${GROUND - 1.2 - (1 - Math.min(1, discLand)) * 30}) scale(${Math.min(1.15, disc)})`}>
            <ellipse rx={0.24 * 55} ry={0.06 * 55} fill={PITCH.light} opacity={0.9} />
            <ellipse rx={0.24 * 55 * (1 + 0.5 * discGlow)} ry={0.06 * 55 * (1 + 0.5 * discGlow)} fill="none" stroke={PITCH.lightSoft} strokeWidth={0.8} opacity={discGlow} />
          </g>
        ) : null}
        {take2 ? <Dust x={FOOT_X} y={GROUND} at={tFoot + 7} size={9} seed="s14-disc" /> : null}
        {take2 ? <Dust x={FOOT_X} y={GROUND} at={plantF} size={10} seed="s14-plant" /> : null}
        <Player x={X(hip)} groundY={GROUND} h={TAVI_H} pose={pose} face="focus" />
        <Ball cx={ballW.x} cy={ballW.y} r={BR} view={SIDE} axis={{ x: 0, y: -1, z: 0 }} angle={-3.6 - d * 0.05} lineNormal={LINE_N} squash={atContact ? 0.9 : 1} />
      </PitchBackdrop>

      {/* s13 hand-off: the chalk arrow and the dot grid dissolve. */}
      <g opacity={1 - progress(frame, S14_RESUME, 8, EASE.exit)}>
        <Arrow
          x1={ballS.x + (ad.x / al) * (rS13 + 16)}
          y1={ballS.y + (ad.y / al) * (rS13 + 16)}
          x2={lacesS.x - (ad.x / al) * 26}
          y2={lacesS.y - (ad.y / al) * 26}
          at={-40}
          color={PITCH.chalk}
          width={9}
          curve={0.42}
        />
      </g>
      <VolleyDots f={f13} offset={cue13.frames} t={tm13.dots} />

      {/* Contact flashes. */}
      {flash1 > 0 ? <Glow cx={contactS.x} cy={contactS.y} r={rS * 3.2} color={PITCH.lightSoft} intensity={flash1 * 1.6} rings={4} /> : null}
      {flash2 > 0 ? <Glow cx={contactS.x} cy={contactS.y} r={rS * 3.2} color={PITCH.lightSoft} intensity={flash2 * 1.6} rings={4} /> : null}

      {/* Take 1: ghost where the swing's last whip started, the ball at contact, the gap. */}
      {ghost1 > 0.001 ? (
        <g opacity={1 - progress(frame, rewindAt - 2, 6, EASE.exit)}>
          <g transform={`translate(${ghostS.x} ${ghostS.y}) scale(${ghost1}) translate(${-ghostS.x} ${-ghostS.y})`}>
            <GhostBall cx={ghostS.x} cy={ghostS.y} r={rS} />
          </g>
          <VBracket x={contactS.x + rS + 44} y1={ghostS.y} y2={contactS.y} t={progress(frame, take1Labels, 10, EASE.enter)} side={-1} width={7} tick={20} />
          <Label x={labelX} y={ghostS.y} text="swing starts" at={take1Labels + 3} until={rewindAt - 4} size={44} anchor="start" />
          <Label x={labelX} y={contactS.y + 16} text="contact" at={take1Labels + 7} until={rewindAt - 4} size={44} anchor="start" bg={PITCH.accent} color={PITCH.skyHigh} />
        </g>
      ) : null}

      {/* Take 2: the drop line and the spot. */}
      {dropLine > 0.001 ? (
        <g opacity={dropLine}>
          <line x1={ballS.x} y1={ballS.y + rS + 10} x2={ballS.x} y2={groundS - 6} stroke={PITCH.chalk} strokeWidth={5} strokeDasharray="4 16" strokeLinecap="round" opacity={0.7} />
          <g transform={`translate(${ballS.x} ${groundS + 8})`} stroke={PITCH.chalk} strokeWidth={7} strokeLinecap="round">
            <line x1={-16} y1={-8} x2={16} y2={8} />
            <line x1={-16} y1={8} x2={16} y2={-8} />
          </g>
        </g>
      ) : null}
      {/* The small arrow on the disc's toes, pointing at the goal. */}
      {take2 ? (
        <Arrow x1={toeS.x + 6} y1={groundS - 10} x2={toeS.x + 96} y2={groundS - 10} at={tFoot + 12} until={tBeside - 2} dur={10} color={PITCH.light} width={7} />
      ) : null}
      {take2 ? <ClockIcon x={discS.x - 470} y={discS.y + 118} r={34} at={tEarly} until={tStart - 4} word="early" size={44} /> : null}
      {take2 ? <Label x={discS.x - 60} y={discS.y + 118} text="standing foot" at={tFoot + 6} until={tStart - 4} size={44} anchor="start" /> : null}

      {/* The knee-height line: faint from "Start your swing", glowing from "Hit it". */}
      {kneeLine > 0.001 ? (
        <g opacity={kneeLine}>
          <line
            x1={contactS.x - 560}
            y1={contactS.y}
            x2={contactS.x + 330}
            y2={contactS.y}
            stroke={kneeGlow > 0.5 ? PITCH.light : PITCH.chalk}
            strokeWidth={4 + 3 * kneeGlow}
            strokeDasharray="14 12"
            strokeLinecap="round"
            opacity={0.45 + 0.5 * kneeGlow}
          />
          {kneeGlow > 0.01 ? <line x1={contactS.x - 560} y1={contactS.y} x2={contactS.x + 330} y2={contactS.y} stroke={PITCH.light} strokeWidth={16} strokeLinecap="round" opacity={0.16 * kneeGlow * (1 - 0.5 * progress(frame, tHit + 14, 20))} /> : null}
        </g>
      ) : null}
      {ghost2 > 0.001 ? (
        <g opacity={1 - progress(frame, labelsOut, 8, EASE.exit)}>
          <g transform={`translate(${ghostS.x} ${ghostS.y}) scale(${ghost2}) translate(${-ghostS.x} ${-ghostS.y})`}>
            <GhostBall cx={ghostS.x} cy={ghostS.y} r={rS} />
          </g>
          <VBracket x={contactS.x + rS + 44} y1={ghostS.y} y2={contactS.y} t={progress(frame, whip2 + 2, 10, EASE.enter)} side={-1} width={7} tick={20} />
        </g>
      ) : null}
      {take2 ? <Label x={labelX} y={ghostS.y - 4} text="swing starts" at={Math.ceil(whip2) + 4} until={labelsOut} size={44} anchor="start" bg={PITCH.accent} color={PITCH.skyHigh} /> : null}
      {take2 ? <Label x={labelX} y={contactS.y + 62} text="knee height or lower" at={tKnee + 4} until={labelsOut} size={44} anchor="start" bg={PITCH.light} color={PITCH.skyHigh} /> : null}

      {/* One HUD tag, carried over from s13. The word swaps hard (never two words in the pill). */}
      <SwapTag
        steps={[
          { at: -30, label: "SLOW MOTION" },
          { at: rewindAt, label: "REWIND" },
          { at: rewindEnd + 2, label: "SLOW MOTION" },
        ]}
        until={end - 16}
      />

      {/* Into the X-ray view for s15. */}
      <rect x={0} y={0} width={1920} height={1080} fill={XRAY.bg} opacity={xray} />

      {/* SFX */}
      {tm13.dots.replayAt + REPLAY_CROSS >= cue13.frames ? <Sfx name="net" at={tm13.dots.replayAt + REPLAY_CROSS - cue13.frames} volume={0.22} /> : null}
      <Sfx name="whoosh" at={tm13.dots.dissolveAt - cue13.frames} volume={0.22} />
      <Sfx name="whoosh-long" at={tKeeps} volume={0.3} />
      <Sfx name="whoosh" at={whip1 - 2} volume={0.4} />
      <Sfx name="thump" at={contact1} volume={0.4} />
      <Sfx name="whoosh" at={rewindAt} volume={0.35} />
      <Sfx name="pop" at={tFoot + 2} volume={0.35} />
      <Sfx name="thump" at={tFoot + 7} volume={0.2} />
      <Sfx name="tick" at={tEarly} volume={0.4} />
      <Sfx name="tick" at={tEarly + 8} volume={0.3} />
      <Sfx name="thump" at={plantF} volume={0.25} />
      <Sfx name="chalk" at={tBeside + 2} volume={0.35} />
      <Sfx name="tick" at={tStart} volume={0.3} />
      <Sfx name="whoosh" at={Math.round(whip2) - 2} volume={0.45} />
      <Sfx name="blip" at={tHit} volume={0.3} />
      <Sfx name="thump" at={contact2} volume={0.5} />
      <Sfx name="subdrop" at={end - 22} volume={0.4} />
    </Stage>
  );
};
