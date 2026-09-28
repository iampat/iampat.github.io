// b15 SHAPE: the half-turn. Map view: Tavi's token turns a quarter so her chest points across the
// pitch (+y), the fan swings with her: Sam sits at one edge, the goal at the other. WordCard at the
// first use of "half-turn"; the coach's old cue as a faded bubble with a lime "?"; two eye icons;
// Chalk jogs in on the goal side (8 m to 5 m) as a grey blob that pings; one short look resolves him
// (Snapshot); two arcs compare the head turns from straight on and from side-on. Then the camera
// drops into the side view that b16 opens on: Tavi side-on, looking back at Sam.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, cameraAt, type CamKey } from "../../kit/Camera";
import { Ball } from "../../kit/Ball";
import { TopPlayer } from "../../kit/TopPlayer";
import { VisionFan } from "../../kit/Vision";
import { Snapshot } from "../../kit/Snapshot";
import { Player, POSES, type Pose } from "../../kit/Player";
import { Arrow, Bubble, Label, Text, WordCard } from "../../kit/Graphics";
import { Sfx } from "../../kit/Sfx";
import {
  ArcArrow,
  Blob,
  BlurGrain,
  CAM_B14_END,
  ChestArrow,
  DarkHalf,
  EyeIcon,
  Eyebrow,
  FanEdgeDim,
  Flash,
  GOAL_M,
  M,
  MAP_VIEW,
  MapField,
  Ping,
  SHARP_DEG,
  SIDE_GROUND,
  SIDE_PPM,
  SideWorld,
  TOKEN,
  WIDE_DEG,
  angleDeg,
  angleDiff,
  camTransform,
  halfAngleDeg,
  sharpness,
  sideX,
  toScreen,
  type Cam,
} from "../../kit/ext/ep2-b13-b15-map";
import { CHASE_SPEED } from "../../physics/touch";
import { lookStepMeet } from "../../physics/ep2sims";
import { useCues } from "../../lib/timing";
import { EASE, clamp01, idle, lerp, progress } from "../../lib/anim";
import { HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";

/** 0 -> 1 -> 0 over `dur` frames from `at`: a one-off pulse. */
const bump = (frame: number, at: number, dur = 12) => Math.sin(clamp01((frame - at) / dur) * Math.PI);

const MEET = lookStepMeet();
const TAVI = M(MEET.x, 0);
const SAM = M(-12, 0);
const GOAL = M(GOAL_M, 0);
const BALL = { x: TAVI.x - TOKEN * 0.34, y: TAVI.y }; // at her front foot from b14, on the Sam side
const FACE_SAM = 180;
const SIDE_ON = 270; // chest across the pitch, towards +y
// Chalk's jog on the goal side, inside the last few degrees of the fan: 8 m to 5 m at 4 m/s (0.75 s).
const JOG_FROM = { x: MEET.x + 8, y: -0.7 };
const JOG_TO = { x: MEET.x + 5, y: -0.7 };
const JOG_FRAMES = Math.round(((JOG_FROM.x - JOG_TO.x) / CHASE_SPEED) * 30);
const TERM = "half-turn";
const MEANING = "side-on to the passer: passer on one side, goal on the other, every look a small turn";

// The side view at the end: the framing b16 opens on (Tavi's hips at the LOOK_STEP receive).
const SIDE_TAVI_X = sideX(MEET.x);
const SIDE_CAM_END: Cam = { x: SIDE_TAVI_X + 20, y: SIDE_GROUND - 105, zoom: 2.3 };
const SIDE_CAM_IN: Cam = { x: SIDE_TAVI_X + 20, y: SIDE_GROUND - 120, zoom: 2.5 };

export const B15: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b15");

  const tStand = cue("stand");
  const tHalfTurn = cue("The half-turn");
  const tOld = cue("Old cue");
  const tNew = cue("new reason");
  const tSam = cue("Sam in the corner");
  const tOneEye = cue("one eye");
  const tGoalOther = cue("the goal in the other");
  const tCatches = cue("catches movement");
  const tLookWord = cue("look tells");
  const tEvery = cue("Every look");
  const tEveryLook = cue("look is now");
  const tSmall = cue("small turn");
  const tCut = cue.wordEnd("small turn");

  // Beats.
  const turnAt = tStand;
  const jogStart = tCatches - 2;
  const lookOut = tLookWord;
  const lookHold = lookOut + 8;
  const lookBack = lookHold + 8;
  const snapAt = lookHold + 2;
  // Both arcs hold for over a second after "small turn" is drawn; then the push and the drop to the side view.
  const longAt = tEvery;
  const shortAt = tEveryLook + 7;
  const dropAt = tCut + 4;
  const sideAt = dropAt + 8;

  // Body: the quarter turn; head: one short look at Chalk and back.
  const facing = lerp(FACE_SAM, SIDE_ON, progress(frame, turnAt, 30, EASE.standard));
  const chalkSim = { x: lerp(JOG_FROM.x, JOG_TO.x, clamp01((frame - jogStart) / JOG_FRAMES)), y: JOG_FROM.y };
  const chalk = M(chalkSim.x, chalkSim.y);
  const toChalk = angleDeg(TAVI, chalk);
  const lookAmt = progress(frame, lookOut, 8, EASE.standard) * (1 - progress(frame, lookBack, 10, EASE.standard));
  const look = angleDiff(SIDE_ON, toChalk) * lookAmt;
  const eyes = facing + look;

  const samSharp = sharpness(eyes, angleDeg(TAVI, SAM), SHARP_DEG, 3, halfAngleDeg(Math.hypot(SAM.x - TAVI.x, SAM.y - TAVI.y), TOKEN * 0.5));
  const chalkDist = Math.hypot(chalk.x - TAVI.x, chalk.y - TAVI.y);
  const chalkSharp = frame >= snapAt ? sharpness(eyes, toChalk, SHARP_DEG, 3, halfAngleDeg(chalkDist, TOKEN * 0.5)) : 0;
  const moving = frame >= jogStart && frame < jogStart + JOG_FRAMES;
  // A faint shape at 8 m until he moves: the side of the eye only wakes up to movement.
  const chalkOpacity = lerp(0.3 * progress(frame, 0, 20, EASE.enter), 0.95, progress(frame, jogStart, 6, EASE.enter));
  const pingFrames = [jogStart + 3, jogStart + 13, jogStart + 23];

  // Camera: in close for the quarter turn (Sam still at the left edge), out wide on "Sam in the corner"
  // for the two eye icons, then a fast push before the drop.
  const keys: CamKey[] = [
    { f: 0, ...CAM_B14_END },
    { f: turnAt + 24, x: TAVI.x - 60, y: TAVI.y - 10, zoom: 2.2 },
    { f: tSam - 30, x: TAVI.x - 52, y: TAVI.y - 12, zoom: 2.28 },
    { f: tSam + 6, x: 1130, y: 548, zoom: 1.45 },
    { f: dropAt, x: 1130, y: 548, zoom: 1.45 },
    { f: sideAt, x: TAVI.x, y: TAVI.y, zoom: 2.6 },
  ];
  const cam = cameraAt(frame, keys);
  // The chest arrow shows the body turn; it leaves before the camera pulls out.
  const chestT = progress(frame, turnAt - 4, 14, EASE.soft) * (1 - progress(frame, tSam - 34, 10, EASE.exit));
  // The corner of the eye is dim and grainy on both sides (Sam's side and the goal side).
  const blurOn = progress(frame, turnAt, 30, EASE.standard);

  // Arcs: the head turn to the goal side from straight on (a half circle) and from side-on (a quarter).
  const longT = progress(frame, longAt, 22, EASE.soft);
  const shortT = progress(frame, shortAt, 16, EASE.soft);
  const glow = 0.6 + 0.4 * Math.sin(frame / 4) + 1.2 * bump(frame, tSmall, 16);
  const arcEnd = toChalk < 180 ? toChalk + 360 : toChalk;
  const longR = TOKEN * 1.8;
  const shortR = TOKEN * 2.5;
  const labelAt = (deg: number, r: number) => ({ x: TAVI.x + Math.cos((deg * Math.PI) / 180) * r, y: TAVI.y + Math.sin((deg * Math.PI) / 180) * r });
  const longLbl = labelAt(212, longR + 22);
  const shortLbl = labelAt(322, shortR + 30);

  // Chalk's blob on screen, and the polaroid below and to the right of it.
  const chalkScreen = toScreen(cam, chalk);
  const snapPos = { x: chalkScreen.x + 200, y: chalkScreen.y + 230 };

  // The rewind arrow from b14 fades as she turns.
  const hintOpacity = 1 - progress(frame, turnAt, 10, EASE.exit);
  const arrowR = TOKEN * 1.35;
  const a0 = (205 * Math.PI) / 180;
  const a1 = (258 * Math.PI) / 180;

  const sfx = (
    <>
      <Sfx name="whoosh" at={turnAt} volume={0.25} />
      <Sfx name="air" at={turnAt + 4} volume={0.22} />
      <Sfx name="pop" at={tHalfTurn} volume={0.4} />
      <Sfx name="pop" at={tOld} volume={0.3} />
      <Sfx name="blip" at={tNew} volume={0.35} />
      <Sfx name="pop-soft" at={tOneEye} volume={0.35} />
      <Sfx name="pop-soft" at={tGoalOther + 8} volume={0.35} />
      <Sfx name="blip" at={pingFrames[0]} volume={0.4} />
      <Sfx name="blip" at={pingFrames[1]} volume={0.35} />
      <Sfx name="tick" at={lookOut} volume={0.45} />
      <Sfx name="pop" at={snapAt} volume={0.4} />
      <Sfx name="chalk" at={longAt} volume={0.4} />
      <Sfx name="chalk" at={shortAt} volume={0.4} />
      <Sfx name="bell" at={tSmall + 2} volume={0.28} />
      <Sfx name="whoosh-long" at={dropAt} volume={0.35} />
    </>
  );

  // ---------- The drop: side view, Tavi side-on and looking back at Sam, as b16 opens ----------
  if (frame >= sideAt) {
    const inT = progress(frame, sideAt, 12, EASE.enter);
    const sideCam: Cam = { x: lerp(SIDE_CAM_IN.x, SIDE_CAM_END.x, inT), y: lerp(SIDE_CAM_IN.y, SIDE_CAM_END.y, inT), zoom: lerp(SIDE_CAM_IN.zoom, SIDE_CAM_END.zoom, inT) };
    const base: Pose = POSES.receiveReady;
    const pose: Pose = { ...base, torso: base.torso + idle(frame, 1, 3.2, 1.2), lift: (base.lift ?? 0) + 0.004 * (1 + idle(frame, 2, 3.2)) };
    return (
      <Stage bg={PITCH.sky}>
        <SideWorld cam={sideCam} seed="b15">
          <Player x={SIDE_TAVI_X} groundY={SIDE_GROUND} h={1.62 * SIDE_PPM} pose={pose} face="focus" headTurn={0.85} />
        </SideWorld>
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={PITCH.skyHigh} opacity={0.5 * (1 - progress(frame, sideAt, 8, EASE.enter))} />
        {sfx}
      </Stage>
    );
  }

  return (
    <Stage bg={PITCH.grassDark}>
      <g transform={camTransform(cam)}>
        <MapField />
        <DarkHalf x={TAVI.x} y={TAVI.y} facing={eyes} opacity={0.68} />
        <VisionFan x={TAVI.x} y={TAVI.y} facing={eyes} wideDeg={WIDE_DEG} sharpDeg={SHARP_DEG} radius={1400} at={-20} />
        <FanEdgeDim x={TAVI.x} y={TAVI.y} facing={eyes} edgeDeg={20} opacity={0.42 * blurOn} />
        <BlurGrain x={TAVI.x} y={TAVI.y} facing={eyes} rMin={TOKEN * 0.9} rMax={760} opacity={0.55 * blurOn} sharpDeg={SHARP_DEG} seed="b15grain" />
        {/* Sam: sharp only while the eyes are on him; the goal end sits in the dim edge too. */}
        <Blob x={SAM.x} y={SAM.y} facing={angleDeg(SAM, TAVI)} opacity={1 - samSharp} />
        <g opacity={samSharp}>
          <TopPlayer x={SAM.x} y={SAM.y} kind="sam" facing={angleDeg(SAM, TAVI)} size={TOKEN} />
        </g>
        <EyeIcon x={SAM.x} y={SAM.y - TOKEN * 1.2} size={46} at={tOneEye} until={tEveryLook} />
        <EyeIcon x={GOAL.x - 10} y={GOAL.y - 150} size={46} at={tGoalOther + 8} until={tEveryLook} />
        {/* Chalk on the goal side: a grey blob that pings while it moves, Chalk himself after the look. */}
        <Blob x={chalk.x} y={chalk.y} facing={angleDeg(chalk, TAVI)} opacity={chalkOpacity * (1 - chalkSharp)} wobble={moving ? 1 : 0} />
        <g opacity={chalkSharp}>
          <TopPlayer x={chalk.x} y={chalk.y} kind="chalk" facing={angleDeg(chalk, TAVI)} size={TOKEN} stride={moving ? frame / 7 : undefined} />
          <Eyebrow x={chalk.x} y={chalk.y} facing={angleDeg(chalk, TAVI)} />
        </g>
        {pingFrames.map((f) => (
          <Ping key={f} x={chalk.x} y={chalk.y} at={f} />
        ))}
        <Flash x={chalk.x} y={chalk.y} at={snapAt} r={TOKEN * 0.9} />
        {/* Tavi, the ball at her front foot, the rewind hint from b14. */}
        <Ball cx={BALL.x} cy={BALL.y} r={8} view={MAP_VIEW} showLine={false} />
        <TopPlayer x={TAVI.x} y={TAVI.y} kind="tavi" facing={facing + idle(frame, 1, 3.2, 1)} look={look} size={TOKEN} />
        <ChestArrow x={TAVI.x} y={TAVI.y} facing={facing} t={chestT} />
        {hintOpacity > 0.001 ? (
          <g opacity={hintOpacity}>
            <Arrow
              x1={TAVI.x + Math.cos(a0) * arrowR}
              y1={TAVI.y + Math.sin(a0) * arrowR}
              x2={TAVI.x + Math.cos(a1) * arrowR}
              y2={TAVI.y + Math.sin(a1) * arrowR}
              at={-20}
              dur={10}
              color={PITCH.chalk}
              width={5}
              curve={-0.22}
            />
          </g>
        ) : null}
        {/* Every look is now a small turn: the long arc from straight on (inside), the short arc from side-on (outside, lime). */}
        <ArcArrow x={TAVI.x} y={TAVI.y} r={longR} a0={180} a1={arcEnd} t={longT} color={PITCH.chalk} width={5} dashed />
        <ArcArrow x={TAVI.x} y={TAVI.y} r={shortR} a0={270} a1={arcEnd} t={shortT} color={XRAY.lime} width={7} glow={glow} />
        <Text x={longLbl.x} y={longLbl.y + 8} text="straight on" at={longAt + 14} size={26} color={PITCH.chalk} anchor="end" />
        <Text x={shortLbl.x} y={shortLbl.y + 8} text="side-on" at={shortAt + 10} size={26} color={XRAY.lime} anchor="start" />
      </g>

      {/* Screen-space graphics. */}
      <WordCard term={TERM} meaning={MEANING} at={tHalfTurn} until={tSam - 8} />
      <g opacity={0.78}>
        <Bubble x={400} y={900} tx={150} ty={1060} text="HALF-TURN!" at={tOld} until={tSam - 6} size={44} />
      </g>
      <Label x={640} y={900} text="?" at={tNew} until={tSam - 6} size={46} bg={XRAY.lime} />
      {/* The polaroid lands in the dark just below Chalk's blob, tied to it by a chalk leader line. */}
      {frame >= snapAt ? (
        <line
          x1={chalkScreen.x + 20}
          y1={chalkScreen.y + 30}
          x2={snapPos.x - 96}
          y2={snapPos.y - 80}
          stroke={PITCH.chalk}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="10 8"
          opacity={0.85 * progress(frame, snapAt + 4, 8, EASE.enter) * (1 - progress(frame, dropAt, 6, EASE.exit))}
        />
      ) : null}
      <Snapshot x={snapPos.x} y={snapPos.y} at={snapAt} until={dropAt} tilt={-7}>
        <rect width={220} height={150} fill={PITCH.grass} />
        <rect x={0} y={60} width={220} height={30} fill={PITCH.grassDark} />
        <TopPlayer x={110} y={78} kind="chalk" facing={200} size={62} />
        <Eyebrow x={110} y={78} facing={200} size={62} />
      </Snapshot>
      <Label x={snapPos.x} y={snapPos.y + 122} text="Chalk" at={snapAt + 6} until={dropAt} size={32} />

      {sfx}
    </Stage>
  );
};
