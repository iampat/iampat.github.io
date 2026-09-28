// b04 Ch1 Look: what a scan is. b03 ends by tilting down from its title to the grass (horizon at y 704); b04
// dissolves from that frame into the floodlit pitch with the same horizon, and chalk writes the card. One wide
// side view holds Sam with the ball at
// the left edge, Tavi in the middle and Chalk at the right edge. Tavi looks over her shoulder (12 frames out
// and back), a round close-up of her face shows the look, the slow replay (with a stopwatch) and the "yes,
// that one" nod. The scan word card, a polaroid pops out of her head, click and back, the eyes inset, "where's
// Chalk?" in the polaroid, then the pro timeline (three looks in the 10 s before the ball, played 5x fast).
// The last polaroid flips to the X-ray grid and grows into b05.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, cameraAt, type CamKey } from "../../kit/Camera";
import { Floodlight, GroundSide, Sky, Stands, Stars } from "../../kit/World";
import { Player, POSES, mixPose, SAM_COLORS, type Pose } from "../../kit/Player";
import { Keeper, KPOSES } from "../../kit/Keeper";
import { Ball } from "../../kit/Ball";
import { GoalSide } from "../../kit/Goal";
import { Arrow, ChapterCard, Label, SlowMoTag } from "../../kit/Graphics";
import { Snapshot } from "../../kit/Snapshot";
import { TopField } from "../../kit/Field";
import { TopPlayer } from "../../kit/TopPlayer";
import { Sfx } from "../../kit/Sfx";
import { trim } from "../../kit/ep2";
import { DRILLS } from "../../physics/ep2sims";
import { rollAt } from "../../physics/touch";
import { useCues } from "../../lib/timing";
import { EASE, clamp01, idle, lerp, pop, progress, visible } from "../../lib/anim";
import type { View } from "../../lib/project";
import { FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import { EyesInset, GhostToken, MiniPolaroid, RoundInset, SecondsReadout, SpedUpTag, TopSnapPhoto, WordCardWide, turnPulse } from "../../kit/ext/ep2-b04-b05-parts";

// Side-view world: Tavi's mark at OX, Sam 12 m to the left, Chalk 10.9 m to the right, the goal further right.
const PPM = 60;
const OX = 900;
const GROUND = 800;
const X = (m: number) => OX + m * PPM;
const SIDE: View = { kind: "side", originX: OX, groundY: GROUND, ppm: PPM };
const SAM_M = -12;
const CHALK_M = 10.9;
const GOAL_M = 18;
const TAVI_H = 1.62 * PPM;
const KEEPER_H = 2.1 * PPM;
const TOWERS = [-300, 500, 1300, 2100, 2900];
const REF_X = X(0);

// The wide side camera: Sam (and the ball) at the left edge, Chalk at the right edge. The grass line sits where
// b03's exit tilt lands it (y 704), so the two frames share a horizon.
const ZOOM = 1.3;
const CAM_X = X(-0.55);
const GROUND_ON_SCREEN = 704;
const CAM_Y = GROUND - (GROUND_ON_SCREEN - HEIGHT / 2) / ZOOM;
const DISSOLVE = 10;

// The round close-up of Tavi's face (face about 140 px) and its stopwatch.
const FACE_INSET = { x: 1560, y: 290, r: 160, k: 7.5 };
const READOUT = { x: 1560, y: 552 };

// Pro timeline: 10 s before the ball; DRILLS.b04 = 8 m at 5 m/s leaves so that it arrives at 10 s.
const PASS = DRILLS.b04;
const PASS_ROLL_S = (PASS.speed - Math.sqrt(PASS.speed * PASS.speed - 2 * 0.8 * PASS.distance)) / 0.8; // about 1.9 s
const PASS_LEAVE_S = 10 - PASS_ROLL_S;
const LOOKS_S = [1, 4, 8.5];
const SWEEP = 60; // the 10 s timeline plays in 60 frames (2 s): exactly 5x fast
const LOOK_FRAMES = 10; // each pro look is a 10-frame head turn on screen, whatever the timeline speed

const SCAN_LINES = ["a quick look over your shoulder, away from the ball,", "to see where the defender and the space are, then back"];

/** Photo inside the big polaroid: Tavi's view toward the goal side. Chalk far away, free grass, the goal. */
const GoalSidePhoto: React.FC<{ w: number; h: number; frame: number; circleAt: number; labelAt: number }> = ({ w, h, frame, circleAt, labelAt }) => {
  const groundY = h * 0.62;
  const cx = w * 0.52;
  const cy = groundY - 17;
  const r = 30;
  const draw = progress(frame, circleAt, 14, EASE.soft);
  const soft = 0.5 * progress(frame, circleAt + 6, 10);
  const tickT = progress(frame, labelAt, 12, EASE.enter);
  return (
    <g>
      <rect width={w} height={h} fill={PITCH.sky} />
      <circle cx={w * 0.86} cy={h * 0.1} r={h * 0.16} fill={PITCH.lightSoft} opacity={0.25} />
      <circle cx={w * 0.86} cy={h * 0.1} r={h * 0.07} fill={PITCH.lightSoft} opacity={0.6} />
      <rect y={groundY} width={w} height={h - groundY} fill={PITCH.grass} />
      {[0.1, 0.42, 0.74].map((t) => (
        <path key={t} d={`M${w * t},${groundY} L${w * (t + 0.14)},${groundY} L${w * (t + 0.2)},${h} L${w * (t - 0.02)},${h} Z`} fill={PITCH.grassDark} opacity={0.55} />
      ))}
      <rect y={groundY - 2} width={w} height={4} fill={PITCH.grassLight} />
      {/* The goal, far right. */}
      <rect x={w * 0.8} y={groundY - 40} width={4} height={42} fill={PITCH.chalk} />
      <rect x={w * 0.97} y={groundY - 40} width={4} height={42} fill={PITCH.chalk} />
      <rect x={w * 0.8} y={groundY - 42} width={w * 0.17 + 4} height={4} fill={PITCH.chalk} />
      {[0.84, 0.88, 0.92].map((t) => (
        <line key={t} x1={w * t} y1={groundY - 38} x2={w * t} y2={groundY} stroke={PITCH.chalk} strokeWidth={1} opacity={0.35} />
      ))}
      {/* Chalk, small: he waits on his mark. */}
      <Keeper x={cx} groundY={groundY} h={34} pose={{ ...KPOSES.stand, stretch: 1 + idle(frame, 7, 2.6, 0.01) }} face="flat" flip look={0.4} />
      {/* Everything but Chalk goes soft. */}
      <path d={`M0,0 H${w} V${h} H0 Z M${cx - r},${cy} a${r},${r} 0 1 0 ${2 * r},0 a${r},${r} 0 1 0 ${-2 * r},0`} fillRule="evenodd" fill={PITCH.skyHigh} opacity={soft} />
      {/* The chalk circle draws around him. */}
      {draw > 0.002 ? (
        <path d={`M${cx},${cy - r} a${r},${r} 0 1 1 0,${2 * r} a${r},${r} 0 1 1 0,${-2 * r}`} fill="none" stroke={PITCH.chalk} strokeWidth={3} strokeLinecap="round" {...trim(draw)} />
      ) : null}
      {/* Distance tick from her side of the photo to his feet (no number: the narration says none). */}
      {tickT > 0.002 ? (
        <g opacity={tickT}>
          <line x1={6} y1={groundY + 9} x2={6 + (cx - 6 - r * 0.6) * tickT} y2={groundY + 9} stroke={PITCH.light} strokeWidth={2.5} strokeDasharray="5 4" strokeLinecap="round" />
          {[0.25, 0.5, 0.75].map((t) => (
            <line key={t} x1={6 + (cx - 6 - r * 0.6) * t} y1={groundY + 5} x2={6 + (cx - 6 - r * 0.6) * t} y2={groundY + 13} stroke={PITCH.light} strokeWidth={2} opacity={tickT > t ? 1 : 0} />
          ))}
        </g>
      ) : null}
      <Label x={cx} y={h - 20} text="CHALK" at={labelAt} size={14} bg={PITCH.chalk} color={PITCH.sky} />
    </g>
  );
};

/** Background inside the face close-up: the stands behind her head and a floodlight glow. */
const FaceInsetBg: React.FC<{ r: number }> = ({ r }) => (
  <g>
    <rect x={-r} y={-r} width={2 * r} height={2 * r} fill={PITCH.sky} />
    {[0.1, 0.34, 0.58, 0.82].map((t) => (
      <rect key={t} x={-r} y={-r + t * 2 * r} width={2 * r} height={r * 0.16} fill={PITCH.stands} opacity={0.7} />
    ))}
    <circle cx={r * 0.62} cy={-r * 0.7} r={r * 0.34} fill={PITCH.lightSoft} opacity={0.12} />
    <circle cx={r * 0.62} cy={-r * 0.7} r={r * 0.18} fill={PITCH.lightSoft} opacity={0.18} />
  </g>
);

export const B04: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b04");

  // Beats, keyed to the words.
  const tLook = cue("look");
  const tBefore = cue("Before the ball comes");
  const tScan = cue("a scan");
  const tSnapWord = cue("snapshot");
  const tClick = cue("Click");
  const tEyes = cue("Your eyes barely stop");
  const tQuestion = cue("One question");
  const tWhere = cue("where's Chalk");
  const tChalk = cue("Chalk");
  const end = cue.frames;

  const CARD_AT = DISSOLVE; // the chalk writes the card once b03's frame has dissolved
  const cardUntil = tLook - 5;
  const insetAt = tLook - 3;
  const turn1 = tLook + 3;
  const slowTagAt = tBefore + 4;
  const slowStart = tBefore + 10;
  const SLOW_DUR = 48; // 12 frames at a quarter speed
  const slowEnd = slowStart + SLOW_DUR;
  const slowTagUntil = slowEnd + 10;
  const cardAt = tScan;
  const nodAt = tScan + 2;
  const NOD = 18;
  const insetUntil = nodAt + NOD + 4;
  const cardOff = tEyes - 10;
  const snapTurn = tSnapWord - 6;
  const snapAt = tSnapWord;
  const clickAt = tClick;
  const eyesAt = tEyes;
  const eyesTurn = tEyes + 6;
  const eyesUntil = tQuestion - 6;
  const zoomAt = tQuestion;
  const circleAt = tWhere;
  const labelAt = tChalk - 5;
  // The map comes in the pause after "Chalk", so the pro timeline gets about 2.9 s before b05.
  const mapCut = tChalk + 15;
  const sweepStart = mapCut + 4;
  const lookFrame = (s: number) => sweepStart + (s / 10) * SWEEP;
  const passLeaveF = lookFrame(PASS_LEAVE_S);
  // The third polaroid holds for 19 frames at full size before it flips.
  const flipStart = Math.round(lookFrame(LOOKS_S[2])) + 19;

  const sfx = (
    <>
      <Sfx name="chalk" at={CARD_AT} volume={0.45} />
      <Sfx name="pop-soft" at={insetAt} volume={0.25} />
      <Sfx name="whoosh" at={turn1} volume={0.22} />
      <Sfx name="tick" at={turn1 + 5} volume={0.3} />
      <Sfx name="subdrop" at={slowTagAt} volume={0.3} />
      {[12, 24, 36, 48].map((d) => (
        <Sfx key={d} name="tick" at={slowStart + d} volume={0.18} />
      ))}
      <Sfx name="pop" at={cardAt} volume={0.35} />
      <Sfx name="bell" at={cardAt} volume={0.3} />
      <Sfx name="whoosh" at={snapTurn} volume={0.2} />
      <Sfx name="tick" at={snapAt} volume={0.45} />
      <Sfx name="pop-soft" at={snapAt + 2} volume={0.3} />
      <Sfx name="whoosh" at={clickAt} volume={0.2} />
      <Sfx name="tick" at={clickAt + 5} volume={0.45} />
      <Sfx name="pop-soft" at={eyesAt} volume={0.3} />
      <Sfx name="whoosh" at={eyesTurn} volume={0.22} />
      <Sfx name="whoosh" at={zoomAt} volume={0.25} />
      <Sfx name="chalk" at={circleAt} volume={0.45} />
      <Sfx name="pop" at={labelAt} volume={0.3} />
      <Sfx name="whoosh" at={mapCut - 3} volume={0.35} />
      <Sfx name="pop-soft" at={mapCut + 2} volume={0.3} />
      {LOOKS_S.map((s) => (
        <Sfx key={s} name="tick" at={Math.round(lookFrame(s))} volume={0.4} />
      ))}
      <Sfx name="thump" at={Math.round(passLeaveF)} volume={0.35} />
      <Sfx name="pop-soft" at={Math.round(lookFrame(10))} volume={0.3} />
      <Sfx name="whoosh-long" at={flipStart} volume={0.35} />
    </>
  );

  // ---------- Shot B: the pro timeline (map) ----------
  if (frame >= mapCut) {
    const tl = clamp01((frame - sweepStart) / SWEEP) * 10; // timeline seconds, 0..10
    const TL_X0 = 260;
    const TL_X1 = 1660;
    const TL_Y = 780;
    const PXS = (TL_X1 - TL_X0) / 10;
    const PXM = 44; // px per metre in the token row
    const rowY = 440;
    const ghostX = 1320;
    const samX = ghostX - PASS.distance * PXM;
    // A direct cut: the pitch is there on the first map frame; the token row pops and the timeline draws on.
    const rowPop = pop(frame, mapCut, { stiffness: 200, damping: 15 });
    const rowMid = (samX + ghostX) / 2;
    const bob = idle(frame, 11, 3.2, 2);
    const lineT = progress(frame, mapCut + 1, 16, EASE.standard);
    const ballRoll = tl > PASS_LEAVE_S ? rollAt(PASS.speed, tl - PASS_LEAVE_S, 0.8).x : 0;
    const ballX = samX + 30 + Math.min(PASS.distance, ballRoll) * PXM;
    // Each look: the head turns out and back over a fixed 10 frames of screen time, centred on its second.
    const look = LOOKS_S.reduce((acc, s) => acc + turnPulse(frame, lookFrame(s) - LOOK_FRAMES / 2, LOOK_FRAMES), 0);
    const headX = TL_X0 + tl * PXS;
    const fl = progress(frame, flipStart, 6, EASE.standard);
    const grow = progress(frame, flipStart + 4, end - flipStart - 4, EASE.standard);
    const mapView: View = { kind: "top", originX: 300, originY: 540, ppm: 22 };
    return (
      <Stage bg={PITCH.sky}>
        <TopField view={mapView} x0={-14} x1={80} y0={-26} y1={26} lineOpacity={0.5} />
        <rect width={WIDTH} height={HEIGHT} fill={PITCH.skyHigh} opacity={0.5} />
        <g>
          {/* Caption: the population and the rate. */}
          <Label x={960} y={120} text="Premier League pros: about 3 looks in 10 s" at={mapCut + 2} size={40} bg={PITCH.chalk} color={PITCH.sky} />
          {/* The 10 s chalk timeline. */}
          <line x1={TL_X0} y1={TL_Y} x2={TL_X0 + (TL_X1 - TL_X0) * lineT} y2={TL_Y} stroke={PITCH.chalk} strokeWidth={6} strokeLinecap="round" opacity={0.9} />
          {Array.from({ length: 11 }, (_, i) => {
            const x = TL_X0 + i * PXS;
            const on = lineT * 10 >= i - 0.01 ? 1 : 0;
            const big = i === 0 || i === 10;
            return <line key={i} x1={x} y1={TL_Y - (big ? 22 : 12)} x2={x} y2={TL_Y + (big ? 22 : 12)} stroke={PITCH.chalk} strokeWidth={big ? 6 : 4} strokeLinecap="round" opacity={0.9 * on} />;
          })}
          <text x={TL_X0} y={TL_Y + 66} fill={PITCH.chalk} opacity={0.85 * progress(frame, mapCut + 4, 10)} fontFamily={FONTS.mono} fontWeight={500} fontSize={32} textAnchor="middle">
            10 s before
          </text>
          <text x={TL_X1} y={TL_Y + 66} fill={PITCH.chalk} opacity={0.85 * progress(frame, mapCut + 12, 10)} fontFamily={FONTS.mono} fontWeight={500} fontSize={32} textAnchor="middle">
            the ball arrives
          </text>
          {/* The clock is sped up: say so. */}
          <SpedUpTag x={960} y={TL_Y + 56} text="5x speed" at={sweepStart - 2} until={flipStart} />
          {/* Playhead. */}
          {tl > 0 && tl < 10 ? (
            <g>
              <line x1={headX} y1={TL_Y - 60} x2={headX} y2={TL_Y + 30} stroke={XRAY.lime} strokeWidth={4} strokeLinecap="round" opacity={0.7} />
              <circle cx={headX} cy={TL_Y} r={12} fill={XRAY.lime} />
            </g>
          ) : null}
          {/* Token row: Sam passes to the grey pro. Pops in on the cut; both tokens breathe. */}
          <g transform={`translate(${rowMid} ${rowY}) scale(${rowPop}) translate(${-rowMid} ${-rowY})`}>
            <g transform={`translate(0 ${bob})`}>
              <TopPlayer x={samX} y={rowY} kind="sam" size={80} facing={0} label="Sam" />
            </g>
            <g transform={`translate(0 ${-bob})`}>
              <GhostToken x={ghostX} y={rowY} size={80} facing={180} look={130 * clamp01(look)} />
              <text x={ghostX} y={rowY - 70} fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={34} textAnchor="middle" opacity={0.9}>
                a pro
              </text>
            </g>
            <Ball cx={ballX} cy={rowY} r={14} view={mapView} axis={{ x: 0, y: 1, z: 0 }} angle={ballRoll * 3} />
          </g>
          {/* Three looks, one polaroid each, with a leader down to its second. */}
          {LOOKS_S.map((s, i) => {
            const x = TL_X0 + s * PXS;
            const at = Math.round(lookFrame(s));
            const last = i === LOOKS_S.length - 1;
            const cx = last ? lerp(x, WIDTH / 2, grow) : x;
            const cy = last ? lerp(640, HEIGHT / 2, grow) : 640;
            const scale = last ? lerp(1, 13.6, grow) : 1;
            return (
              <g key={s}>
                {frame >= at && !(last && fl > 0.5) ? <line x1={x} y1={TL_Y - 22} x2={x} y2={710} stroke={PITCH.chalk} strokeWidth={3} strokeDasharray="6 6" opacity={0.6 * progress(frame, at, 8)} /> : null}
                <MiniPolaroid x={cx} y={cy} w={130} h={88} at={at} tilt={i % 2 ? 6 : -6} flip={last ? fl : 0} scale={scale}>
                  <TopSnapPhoto w={130} h={88} chalk={[0.86 - i * 0.16, 0.34 + i * 0.1]} space={[0.5, 0.7]} />
                </MiniPolaroid>
              </g>
            );
          })}
        </g>
        {sfx}
      </Stage>
    );
  }

  // ---------- Shot A: the wide side view ----------
  const keys: CamKey[] = [
    { f: 0, x: CAM_X, y: CAM_Y, zoom: ZOOM },
    // A slow 3% creep so no hold is ever still; Sam and Chalk stay inside the frame edges.
    { f: mapCut, x: CAM_X + 4, y: CAM_Y - 3, zoom: ZOOM * 1.03 },
  ];
  const cam = cameraAt(frame, keys);
  const horizonY = HEIGHT / 2 + (GROUND - cam.y) * cam.zoom;
  const worldT = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;
  const layerT = (pan: number, grow: number) =>
    `translate(${WIDTH / 2} ${horizonY}) scale(${1 + (cam.zoom - 1) * grow}) translate(${-WIDTH / 2 - (cam.x - REF_X) * pan} ${-GROUND})`;
  const toScreen = (wx: number, wy: number) => ({ x: WIDTH / 2 + (wx - cam.x) * cam.zoom, y: HEIGHT / 2 + (wy - cam.y) * cam.zoom });

  // The slow replay also slows the idle motion of everyone on the pitch.
  const wf = frame < slowStart ? frame : frame < slowEnd ? slowStart + (frame - slowStart) / 4 : frame - (SLOW_DUR * 3) / 4;

  // Tavi: waits for the pass facing Sam (left), and turns her head over her shoulder toward the goal side.
  const slowTurn = turnPulse(frame, slowStart, SLOW_DUR);
  const headTurn = clamp01(turnPulse(frame, turn1) + slowTurn + turnPulse(frame, snapTurn) + turnPulse(frame, clickAt) + turnPulse(frame, eyesTurn));
  // "Yes, that one": two quick 12-degree nods with a happy face.
  const nodT = (frame - nodAt) / NOD;
  const nod = nodT > 0 && nodT < 1 ? 12 * Math.abs(Math.sin(2 * Math.PI * nodT)) : 0;
  const base = mixPose(POSES.receiveReady, POSES.lookBack, headTurn);
  const pose: Pose = {
    ...base,
    torso: base.torso + idle(wf, 1, 2.8, 1.2),
    head: base.head + nod,
    nearShoulder: base.nearShoulder + idle(wf, 3, 3.1, 2),
    farShoulder: base.farShoulder - idle(wf, 3, 3.1, 2),
    lift: (base.lift ?? 0) + 0.004 * (1 + idle(wf, 2, 2.8, 1)),
  };
  const face = frame >= nodAt && frame < nodAt + NOD + 8 ? "happy" : headTurn > 0.15 || (frame >= slowStart && frame < slowEnd) ? "focus" : "neutral";
  const headWorld = { x: X(0) - 3, y: GROUND - 1.03 * TAVI_H };
  const faceFocus = { x: headWorld.x, y: headWorld.y + 5 };
  const head = toScreen(headWorld.x, headWorld.y);
  const ballWorld = { x: X(SAM_M + 0.4), y: GROUND - 0.11 * PPM };
  const ballScreen = toScreen(ballWorld.x, ballWorld.y);
  const tavi = <Player x={X(0)} groundY={GROUND} h={TAVI_H} pose={pose} face={face} flip headTurn={headTurn} />;

  // Sam waits with the ball at his feet. Chalk waits on his mark, 10.9 m away.
  const samPose: Pose = { ...POSES.stand, torso: POSES.stand.torso + idle(wf, 4, 3.3, 1), farShoulder: POSES.stand.farShoulder + idle(wf, 6, 3.3, 3) };
  const kPose = { ...KPOSES.stand, stretch: 1 + idle(wf, 5, 2.6, 0.006), lean: idle(wf, 8, 3.4, 0.8) };

  // The slow replay: stopwatch seconds and the arc from the ball over her shoulder.
  const slowSeconds = 0.4 * clamp01((frame - slowStart) / SLOW_DUR);

  // The big polaroid: pops out of her head, hangs and wobbles, then zooms for "where's Chalk?" (clear of Tavi and Chalk).
  const fly = progress(frame, snapAt, 16, EASE.standard);
  const zoomP = progress(frame, zoomAt, 20, EASE.standard);
  const wob = (start: number) => (frame >= start ? 9 * Math.sin((frame - start) / 2.4) * Math.exp(-(frame - start) / 16) : 0);
  const px = lerp(lerp(head.x + 40, 1400, fly), 1370, zoomP);
  const py = lerp(lerp(head.y - 60, 340, fly), 420, zoomP);
  const pk = lerp(1, 2.3, zoomP);
  const tilt = -7 * (1 - 0.7 * zoomP) + wob(snapAt) + wob(clickAt + 5) + idle(frame, 9, 4.5, 0.8);
  const reflash = frame >= clickAt + 5 ? Math.max(0, 1 - (frame - clickAt - 5) / 5) : 0;

  // The opening: b03's last frame (its sky, its stars moved up by its tilt, its grass at y 704) dissolves out.
  const overO = 1 - progress(frame, 0, DISSOLVE, EASE.soft);

  // Chapter card ring icon (lime), with the card's own fade. The whole card sits 110 px higher, clear of Tavi.
  const CARD_LIFT = 110;
  const cardO = visible(frame, CARD_AT, cardUntil, 10, 10);

  return (
    <Stage bg={PITCH.sky}>
      <Sky />
      <Stars count={80} maxY={horizonY - 260} seed="b04" />
      <g transform={layerT(0.2, 0.05)}>
        <g transform={`translate(${WIDTH / 2} 0) scale(2.2 1) translate(${-WIDTH / 2} 0)`}>
          <Stands baseY={GROUND} lit={1} />
        </g>
        {TOWERS.map((x) => (
          <Floodlight key={x} x={x} baseY={GROUND - 20} height={470} on={1} beam flip={x > 1000} />
        ))}
      </g>
      <g transform={worldT}>
        <GroundSide groundY={GROUND} vanishX={X(4)} />
        <GoalSide view={SIDE} goalX={GOAL_M} />
        {/* Chalk's mark: a small chalk ring on the grass. */}
        <ellipse cx={X(CHALK_M)} cy={GROUND + 2} rx={0.45 * PPM} ry={0.12 * PPM} fill="none" stroke={PITCH.chalk} strokeWidth={3} opacity={0.5} />
        <Keeper x={X(CHALK_M)} groundY={GROUND} h={KEEPER_H} pose={kPose} face="flat" flip look={0.4} />
        <Player x={X(SAM_M)} groundY={GROUND} h={TAVI_H} pose={samPose} colors={SAM_COLORS} />
        <Ball cx={ballWorld.x} cy={ballWorld.y} r={0.11 * PPM} view={SIDE} />
        {tavi}
      </g>

      {/* The opening: b03's last frame, dissolving into the pitch (same horizon). */}
      {overO > 0.001 ? (
        <g opacity={overO}>
          <rect x={-20} y={-20} width={WIDTH + 40} height={HEIGHT + 40} fill={PITCH.skyHigh} />
          <g transform="translate(0 -380)">
            <Stars count={150} maxY={HEIGHT} seed="b03" />
          </g>
          <GroundSide groundY={GROUND_ON_SCREEN} />
        </g>
      ) : null}

      {/* Chapter card, with a lime ring icon beside the title. */}
      <g transform={`translate(0 ${-CARD_LIFT})`}>
        <ChapterCard number={1} title="LOOK" subtitle="buy time before the ball" at={CARD_AT} until={cardUntil} />
        {cardO > 0.001 ? (
          <g opacity={cardO} transform={`translate(560 ${HEIGHT / 2 - 22})`}>
            <circle r={46} fill={XRAY.lime} opacity={0.12} />
            <circle r={46} fill="none" stroke={XRAY.lime} strokeWidth={6} />
            <circle r={44} fill="none" stroke={XRAY.lime} strokeWidth={2} strokeDasharray="6 5" opacity={0.6} />
            <circle r={8} fill={PITCH.chalk} />
          </g>
        ) : null}
      </g>

      {/* The face close-up: the real look, the slow replay and the nod, with a leader to her head. */}
      <RoundInset
        id="b04-face"
        cx={FACE_INSET.x}
        cy={FACE_INSET.y + idle(frame, 12, 4, 3)}
        r={FACE_INSET.r}
        at={insetAt}
        until={insetUntil}
        focus={faceFocus}
        k={FACE_INSET.k}
        leader={{ x: head.x, y: head.y, r: 16 }}
        bg={<FaceInsetBg r={FACE_INSET.r} />}
      >
        {tavi}
      </RoundInset>

      {/* The slow replay: tag, the arc from the ball over her shoulder, and the stopwatch under the close-up. */}
      <SlowMoTag at={slowTagAt} until={slowTagUntil} />
      <Arrow x1={ballScreen.x + 10} y1={ballScreen.y - 14} x2={head.x + 100} y2={head.y - 16} at={slowStart} until={slowEnd + 8} dur={SLOW_DUR - 8} color={PITCH.light} width={6} curve={0.3} />
      <SecondsReadout x={READOUT.x} y={READOUT.y} seconds={slowSeconds} caption="pro midfielders, Norway" at={slowStart - 4} until={slowEnd + 12} />

      <WordCardWide term="scan" lines={SCAN_LINES} at={cardAt} until={cardOff} />

      {/* The polaroid out of her head. */}
      <g transform={`translate(${px} ${py}) scale(${pk}) translate(${-px} ${-py})`}>
        <Snapshot x={px} y={py} w={240} h={160} at={snapAt} tilt={tilt}>
          <GoalSidePhoto w={240} h={160} frame={frame} circleAt={circleAt} labelAt={labelAt} />
          <rect width={240} height={160} fill="#FFFFFF" opacity={reflash} />
        </Snapshot>
      </g>

      <EyesInset x={80} y={110} w={480} h={230} at={eyesAt} until={eyesUntil} sweepAt={eyesTurn} dir={1} leader={{ x: head.x, y: head.y, r: 16 }} />
      {sfx}
    </Stage>
  );
};
