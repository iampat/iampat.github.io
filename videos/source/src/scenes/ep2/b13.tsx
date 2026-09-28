// b13 SHAPE: half a circle of sight. Chapter card, then a close map view on Tavi's token: chalk
// footprints and a chest arrow (your stance), arms out wide, the wide fan of the eyes (200 degrees:
// its edges pass just behind the hands, and it runs out to the horizon), a chalk half circle with the
// two lime slivers the fan pokes past it, the sharp 5 degree wedge with a thumb inset, then the blur: grain, Chalk jogging across the fan's edge as a grey blob that pings, grey
// shirts floating over both blobs, and the sharp wedge landing on one: white, Chalk. The look comes
// back, the stance marks and the grain fade, Chalk jogs on towards his mark, and b14 continues that jog.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, cameraAt, type CamKey } from "../../kit/Camera";
import { Ball } from "../../kit/Ball";
import { TopPlayer } from "../../kit/TopPlayer";
import { VisionFan } from "../../kit/Vision";
import { ChapterCard, Label } from "../../kit/Graphics";
import { Sfx } from "../../kit/Sfx";
import {
  ArmsOut,
  BLUR_GREY,
  Blob,
  BlurGrain,
  CAM_B13_END,
  CHALK_B13_JOG,
  ChestArrow,
  DarkHalf,
  Eyebrow,
  Flash,
  Footprints,
  HANDOFF_PING,
  HANDOFF_TAIL,
  HalfCircle,
  M,
  MAP_VIEW,
  MapField,
  Overhang,
  Ping,
  SHARP_DEG,
  Shirt,
  TOKEN,
  ThumbInset,
  WIDE_DEG,
  angleDeg,
  angleDiff,
  camTransform,
  chalkHandoff,
  fanLit,
  halfAngleDeg,
  sharpness,
  toScreen,
} from "../../kit/ext/ep2-b13-b15-map";
import { CHASE_SPEED } from "../../physics/touch";
import { useCues } from "../../lib/timing";
import { EASE, clamp01, idle, pop, progress, visible } from "../../lib/anim";
import { CAST, PITCH } from "../../theme";

const TAVI = M(0, 0);
const FACING = 180; // chest to Sam, back to the goal
const BALL = M(-2.2, 0); // resting two strides in front of her, on her line of sight
const SAM = M(-12, 3); // Sam waits a little off the passing line tonight
const ARM_R = TOKEN * 1.62; // her hands: the half circle and the "bit more" slivers sit at this radius
const FAR_R = 1300; // the fan runs past every frame edge: the hands mark its angle, not how far she sees
// Chalk's jog for the movement ping: 6 m at 4 m/s along y = -6.5, from the dark into the dim fan.
const JOG_FRAMES = Math.round((CHALK_B13_JOG.metres / CHASE_SPEED) * 30);

export const B13: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b13");

  const tStand = cue("stand");
  const tHow = cue("How you stand");
  const tWide = cue("wide");
  const tArms = cue("Arms out wide");
  const tSee = cue("You see everything");
  const tHands = cue("hands");
  const tBit = cue("A bit more than a half circle");
  const tMore = cue("more");
  const tSharp = cue("Sharp only");
  const tThumb = cue("thumbnail");
  const tRest = cue("The rest");
  const tBlur = cue("blur");
  const tCatch = cue("It catches movement");
  const tNot = cue("not whose shirt");

  // Beats.
  const cardUntil = tHow - 12;
  // He starts on "It catches", so he is inside the fan and pinging on "movement".
  const jogStart = tCatch;
  const jogEnd = jogStart + JOG_FRAMES;
  const shirtAt = tNot - 6; // two grey shirts float over the two blobs
  const swingAt = tNot + 2; // the eyes swing onto Chalk's blob on "not"
  const resolveAt = swingAt + 10; // it turns white on "whose": Chalk, held through "shirt"
  const jog2At = cue.frames - HANDOFF_TAIL; // he jogs on towards his mark; b14 continues
  const backAt = jog2At - 4; // the look comes back (a look is a snapshot, not a stare)
  const pullStart = tRest - 10;

  // Camera: close on the token, then out to show the fan's edge, Sam behind and the goal ahead.
  const keys: CamKey[] = [
    { f: 0, x: TAVI.x - 42, y: TAVI.y - 4, zoom: 3.4 },
    { f: pullStart, x: TAVI.x - 32, y: TAVI.y - 4, zoom: 3.6 },
    { f: tCatch + 12, x: 850, y: 590, zoom: 1.5 },
    { f: tNot, x: 850, y: 590, zoom: 1.5 },
    { f: cue.frames, ...CAM_B13_END },
  ];
  const cam = cameraAt(frame, keys);

  // Chalk: still in the dark, the jog across the fan's edge, a rest, then the jog on to his mark.
  const jogT = clamp01((frame - jogStart) / JOG_FRAMES);
  const chalkSim = frame < jog2At ? { x: CHALK_B13_JOG.from.x - CHALK_B13_JOG.metres * jogT, y: CHALK_B13_JOG.from.y } : chalkHandoff((frame - jog2At) / 30);
  const chalk = M(chalkSim.x, chalkSim.y);
  const toChalk = angleDeg(TAVI, chalk);
  const chalkMoving = (frame >= jogStart && frame < jogEnd) || frame >= jog2At;

  // The eyes: body facing Sam; the head swings onto Chalk's blob at the end, then comes back, so the
  // last frame matches the start of b14.
  const lookAmt = progress(frame, swingAt, 10, EASE.standard) * (1 - progress(frame, backAt, 10, EASE.standard));
  const look = angleDiff(FACING, toChalk) * lookAmt;
  const eyes = FACING + look;
  const sharpDeg = SHARP_DEG * (0.6 + 0.4 * pop(frame, tSharp, { stiffness: 200, damping: 14 })) * progress(frame, tSharp, 6, EASE.enter);

  // The fan: out to the horizon from the start (the angle is the point, not the distance).
  const fanR = FAR_R;
  const dark = 0.62 * progress(frame, tSee + 4, 22, EASE.standard);
  const halfCircleOpacity = 1 - progress(frame, tRest, 8, EASE.exit);
  // The "bit more": two lime slivers past the half circle, one pulse on "more".
  const overT = progress(frame, tMore - 4, 14, EASE.enter);
  const overPulse = Math.max(0, Math.sin(clamp01((frame - tMore) / 16) * Math.PI));

  // What the eyes make of Chalk: nothing in the dark, a grey blob in the fan, himself under the wedge.
  const chalkLit = fanLit(eyes, toChalk);
  const chalkDist = Math.hypot(chalk.x - TAVI.x, chalk.y - TAVI.y);
  const chalkSharp = frame >= resolveAt ? sharpness(eyes, toChalk, SHARP_DEG, 3, halfAngleDeg(chalkDist, TOKEN * 0.5)) : 0;
  const pingFrames = [jogStart + 22, jogStart + 33, jog2At + HANDOFF_PING];

  // The stance marks and the grain leave before the cut: b14 opens on the plain fan and the dark half.
  const outro = 1 - progress(frame, cue.frames - 18, 12, EASE.exit);
  const grainOn = progress(frame, tBlur, 14, EASE.enter) * outro;
  const shirtsOut = 1 - progress(frame, backAt + 4, 8, EASE.exit);
  const shirtLift = TOKEN * 1.05;
  const chalkLabel = toScreen(cam, chalk);

  return (
    <Stage bg={PITCH.grassDark}>
      <g transform={camTransform(cam)}>
        <MapField />
        {/* What the eyes cover: the fan, and the dark behind it. */}
        <DarkHalf x={TAVI.x} y={TAVI.y} facing={eyes} opacity={dark} />
        <VisionFan x={TAVI.x} y={TAVI.y} facing={eyes} wideDeg={WIDE_DEG} sharpDeg={sharpDeg} radius={fanR} at={tSee} />
        <BlurGrain x={TAVI.x} y={TAVI.y} facing={eyes} rMin={TOKEN * 0.9} rMax={Math.min(fanR, 760)} opacity={grainOn} sharpDeg={sharpDeg} />
        <Overhang x={TAVI.x} y={TAVI.y} facing={FACING} r={ARM_R * 1.12} t={overT} pulse={overPulse} opacity={halfCircleOpacity} />
        <HalfCircle x={TAVI.x} y={TAVI.y} facing={FACING} r={ARM_R} t={progress(frame, tBit - 4, 20, EASE.soft)} opacity={halfCircleOpacity} />
        {/* Sam waits in the dim fan: a shape, no shirt. */}
        <Blob x={SAM.x} y={SAM.y} facing={angleDeg(SAM, TAVI)} opacity={0.9} />
        {/* Chalk: a grey blob that pings while it moves inside the fan; himself only under the sharp wedge. */}
        <Blob x={chalk.x} y={chalk.y} facing={angleDeg(chalk, TAVI)} opacity={0.95 * chalkLit * (1 - chalkSharp)} wobble={chalkMoving ? 1 : 0} />
        {chalkSharp > 0.001 ? (
          <g opacity={chalkSharp}>
            <TopPlayer x={chalk.x} y={chalk.y} kind="chalk" facing={angleDeg(chalk, TAVI)} size={TOKEN} stride={chalkMoving ? frame / 7 : undefined} />
            <Eyebrow x={chalk.x} y={chalk.y} facing={angleDeg(chalk, TAVI)} />
          </g>
        ) : null}
        {pingFrames.map((f) => (chalkLit > 0.5 && chalkSharp < 0.5 ? <Ping key={f} x={chalk.x} y={chalk.y} at={f} /> : null))}
        <Flash x={chalk.x} y={chalk.y} at={resolveAt} r={TOKEN * 0.9} />
        {/* Two shirts float over the two shapes, both grey, until the wedge lands on one. */}
        <g opacity={shirtsOut}>
          <Shirt x={SAM.x} y={SAM.y - shirtLift + idle(frame, 3, 2.4, 3)} size={62} color={BLUR_GREY} at={shirtAt} rotate={-10} />
          <Shirt x={chalk.x} y={chalk.y - shirtLift + idle(frame, 5, 2.4, 3)} size={62} color={BLUR_GREY} at={shirtAt + 5} rotate={8} opacity={1 - chalkSharp} />
          <Shirt x={chalk.x} y={chalk.y - shirtLift + idle(frame, 5, 2.4, 3)} size={62} color={CAST.keeper} at={shirtAt + 5} rotate={8} opacity={chalkSharp} />
        </g>
        {/* Tavi: footprints, the token, arms, chest arrow, ball. */}
        <g opacity={outro}>
          <Footprints x={TAVI.x} y={TAVI.y} facing={FACING} t={progress(frame, tStand - 4, 18, EASE.soft)} />
        </g>
        <Ball cx={BALL.x} cy={BALL.y} r={8} view={MAP_VIEW} showLine={false} />
        <g opacity={outro}>
          <ArmsOut x={TAVI.x} y={TAVI.y} facing={FACING} t={progress(frame, tWide - 6, 16, EASE.soft)} />
        </g>
        <TopPlayer x={TAVI.x} y={TAVI.y} kind="tavi" facing={FACING + idle(frame, 1, 3.2, 1.2)} look={look} size={TOKEN} />
        <g opacity={outro}>
          <ChestArrow x={TAVI.x} y={TAVI.y} facing={FACING} t={progress(frame, tStand + 8, 16, EASE.soft)} />
        </g>
      </g>

      {/* Screen-space graphics. */}
      <Label x={960} y={992} text="not team shape: your stance" at={tHow + 6} until={tSee - 6} size={34} />
      <Label x={1360} y={300} text="try it" at={tArms + 14} until={tHands + 4} size={34} bg={PITCH.light} />
      <ThumbInset x={1180} y={560} at={tThumb - 8} until={tRest + 2} />
      {/* The label leaves as the look comes back, so it never names a grey blob. */}
      {frame >= resolveAt ? <Label x={chalkLabel.x + 96} y={chalkLabel.y + 4} text="Chalk" at={resolveAt + 2} until={backAt - 4} size={32} /> : null}
      {/* The card sits over a dimmed map and a solid band, so the token does not show through the letters. */}
      <rect x={0} y={0} width={1920} height={1080} fill={PITCH.skyHigh} opacity={0.45 * visible(frame, 0, cardUntil, 10, 10)} />
      <rect x={0} y={1080 * 0.34} width={1920} height={1080 * 0.32} fill={PITCH.sky} opacity={0.9 * visible(frame, 0, cardUntil, 10, 10)} />
      <ChapterCard number={3} title="SHAPE" subtitle="buy time with your body" at={0} until={cardUntil} />

      <Sfx name="chalk" at={2} volume={0.45} />
      <Sfx name="chalk" at={tStand - 2} volume={0.4} />
      <Sfx name="chalk" at={tStand + 7} volume={0.35} />
      <Sfx name="chalk" at={tStand + 16} volume={0.3} />
      <Sfx name="chalk" at={tWide - 4} volume={0.4} />
      <Sfx name="chalk" at={tWide + 4} volume={0.35} />
      <Sfx name="pop-soft" at={tArms + 14} volume={0.3} />
      <Sfx name="air" at={tSee} volume={0.3} />
      <Sfx name="chalk" at={tBit + 4} volume={0.45} />
      <Sfx name="tick" at={tSharp + 2} volume={0.45} />
      <Sfx name="pop" at={tThumb + 2} volume={0.35} />
      <Sfx name="air" at={tBlur} volume={0.22} />
      <Sfx name="whoosh" at={pullStart} volume={0.28} />
      <Sfx name="blip" at={pingFrames[0]} volume={0.4} />
      <Sfx name="blip" at={pingFrames[1]} volume={0.35} />
      <Sfx name="pop-soft" at={shirtAt} volume={0.3} />
      <Sfx name="pop-soft" at={shirtAt + 5} volume={0.3} />
      <Sfx name="whoosh" at={swingAt} volume={0.2} />
      <Sfx name="tick" at={resolveAt} volume={0.5} />
      <Sfx name="blip" at={pingFrames[2]} volume={0.3} />
    </Stage>
  );
};
