// b17 Shape practice. The board opens out of b16's ink. Three cue chips on top. Left panel (map),
// centred while it is alone: the classic mistake, facing the passer with room to turn (dark half
// behind her, lime room, Chalk waving from the dark), then the fix: side-on before the pass, and the
// pass arrives on the back foot. The left panel then moves over and the right panel (map) comes in:
// the two-gate drill. Sam calls LEFT, she looks and opens (the "open" arc lands with the turn), the
// pass leaves, she scans while it travels, back foot, one touch through the gate, pass back. Notes
// under each panel, the safety line and the easy-passes line on the strip, the ring icon pops lime.
// The board slides away onto the exact shot b18 opens on (its camera, Tavi, the ball and Chalk),
// and the floodlights flicker once.
import React from "react";
import { Freeze, useCurrentFrame } from "remotion";
import { GroundSide } from "../../kit/World";
import { Player, POSES } from "../../kit/Player";
import { Keeper, KPOSES, type KeeperPose } from "../../kit/Keeper";
import { Ball } from "../../kit/Ball";
import { TopPlayer, angleTo } from "../../kit/TopPlayer";
import { VisionFan } from "../../kit/Vision";
import { TopField } from "../../kit/Field";
import { TimeBubble } from "../../kit/TimeBubble";
import { Arrow, Bubble, Label, PracticeBoard, Stamp, Text } from "../../kit/Graphics";
import { Stage } from "../../kit/Camera";
import { Sfx } from "../../kit/Sfx";
import { NightBackdrop, breathe, camT } from "../../kit/ext/ep2-b18-b19-world";
import { useCues } from "../../lib/timing";
import { EASE, clamp01, idle, keys, lerp, progress, visible } from "../../lib/anim";
import { project, type View } from "../../lib/project";
import { CAST, PITCH, WIDTH, HEIGHT, XRAY } from "../../theme";
import { v3 } from "../../physics/sim";
import { DRILLS, FOOT_E } from "../../physics/ep2sims";
import { firstTouch, rollAt, rollDistance } from "../../physics/touch";
import { ChalkWaver, Chips, ClipPanel, Gate, RoomPatch } from "../../kit/ext/ep2-b16-b17-parts";

const BOARD_BG = "#10263A";
const BOARD = { x: 80, y: 70, w: WIDTH - 160, h: HEIGHT - 140, rx: 48 };
const PANEL_W = 810;
const PANEL_H = 460;
const PANEL_Y = 275;
const LEFT_X = 120;
const RIGHT_X = 990;
/** While the left panel is alone on the board it sits in the middle. */
const LEFT_SHIFT = (WIDTH - PANEL_W) / 2 - LEFT_X;

// Left panel (mistake and fix): Tavi's mark at the panel centre, Sam 10 m to the left.
const L_VIEW: View = { kind: "top", originX: 500, originY: 232, ppm: 40 };
const L_CHALK = { x: 6.5, y: -2.7 };
const L_SAM = { x: -10.4, y: 0 };
const L_BALL0 = { x: -10, y: 0 };
/** The fix pass: 10 m at 5 m/s arrives at 3 m/s; the back-foot touch on that ball (FOOT_E, toes open). */
const L_PASS = { speed: 5, dist: 10 };
const L_ARRIVE = 2.5;
const L_OUT = firstTouch({ ballVel: v3(3, 0, 0), footVel: v3(0.8, 0.4, 0), normal: v3(-0.5, 0.87, 0), e: FOOT_E, grip: 0.9 });
const L_OUT_SPEED = Math.hypot(L_OUT.x, L_OUT.y);
const L_OUT_DIR = { x: L_OUT.x / L_OUT_SPEED, y: L_OUT.y / L_OUT_SPEED };

// Right panel (drill): DRILL_PASSES 10 m at 5 m/s (arrives in 2.5 s at 3 m/s); the gate touch at
// 2.5 m/s toward the called gate, 3 m behind and 2 m to the side; it would roll 3.9 m, through the
// gate (3.6 m); she meets it 2.6 s after the touch, 3.8 m out and almost stopped, and passes back.
const R_VIEW: View = { kind: "top", originX: 520, originY: 235, ppm: 46 };
const R_SAM = { x: -10.4, y: 0 };
const R_BALL0 = { x: -10, y: 0 };
const R_ARRIVE = 2.5;
const GATE_LEFT = { x: 3, y: -2 }; // Tavi's left when she faces Sam: -y, down the screen
const GATE_RIGHT = { x: 3, y: 2 };
/** Half the gate mouth: 1.6 m gates keep a clear 2.4 m gap between the two, so they read as two gates. */
const GATE_HALF = 0.8;
const GATE_D = Math.hypot(GATE_LEFT.x, GATE_LEFT.y);
const GATE_DIR = { x: GATE_LEFT.x / GATE_D, y: GATE_LEFT.y / GATE_D };
const GATE_STOP = rollDistance(DRILLS.gateTouch);
const PASS_BACK_DT = 2.6;
const PB_ROLL = Math.min(GATE_STOP, rollAt(DRILLS.gateTouch, PASS_BACK_DT).x);
const STOP_PT = { x: GATE_DIR.x * PB_ROLL, y: GATE_DIR.y * PB_ROLL };
const BACK_D = Math.hypot(R_SAM.x - STOP_PT.x, R_SAM.y - STOP_PT.y);
const BACK_DIR = { x: (R_SAM.x - STOP_PT.x) / BACK_D, y: (R_SAM.y - STOP_PT.y) / BACK_D };
const BACK_SPEED = 6;

// b18's opening shot (b18.tsx, frame 0): the night pitch behind the board is that exact shot, so the
// board slides away onto the frame b18 starts on.
const NEXT = { ppm: 50, ox: 960, ground: 820 };
const nx = (m: number) => NEXT.ox + m * NEXT.ppm;
const NEXT_SIDE: View = { kind: "side", originX: NEXT.ox, groundY: NEXT.ground, ppm: NEXT.ppm };
const NEXT_CAM = { x: nx(3.6), y: NEXT.ground - 95, zoom: 2.0 };
const NEXT_BALL_R = 0.11 * NEXT.ppm;

const smooth = (u: number) => u * u * (3 - 2 * u);
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;
/** Screen angle from a to b in pitch metres (screen y is -pitch y). */
const facingTo = (a: { x: number; y: number }, b: { x: number; y: number }) => angleTo(a.x, -a.y, b.x, -b.y);

export const B17: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b17");

  const tMistake = cue("Classic mistake");
  const tFacing = cue("facing the passer");
  const tRoom = cue("with room to turn");
  const tFix = cue("Fix");
  const tSideOn = cue("side-on");
  const tBefore = cue("before the pass");
  const tGates = cue("Two gates behind you");
  const tCalls = cue("Sam calls a gate");
  const tPasses = cue("then passes");
  const tOpenEnd = cue.wordEnd("Open to that gate");
  const tBackFoot = cue("Back foot");
  const tPassBack = cue("pass back");
  const tEasy = cue("Easy passes first");

  // Left panel clock.
  const lTurn = tSideOn;
  const lLeave = tBefore + 3;
  const lTouch = lLeave + Math.round(L_ARRIVE * 30);
  // Right panel clock: the call, the look, the quarter turn, then the pass leaves on "passes", so the
  // back-foot touch lands on "Back foot". She scans the gate once while the ball travels.
  const rCall = tCalls + 2;
  const rLookAt = tCalls + 12;
  const rTurn = tCalls + 24;
  const rLeave = Math.max(rTurn + 16, tPasses);
  const rScan = rLeave + 14;
  const rTouch = rLeave + Math.round(R_ARRIVE * 30);
  const rFollow = rTouch + 10;
  const rPassBack = rTouch + Math.round(PASS_BACK_DT * 30);
  // The board holds to the last moment: its 9-frame exit ends on the scene's last frame.
  const boardOut = cue.frames - 10;
  const flickAt = boardOut;
  // The strip: the safety line first (it is not narrated), then the easy-passes line on its words.
  const safetyAt = tPassBack;
  const easyAt = tEasy - 4;
  const ringAt = tEasy + 4;

  const sfx = (
    <>
      <Sfx name="whoosh" at={0} volume={0.35} />
      <Sfx name="pop-soft" at={14} volume={0.25} />
      <Sfx name="pop-soft" at={22} volume={0.25} />
      <Sfx name="pop-soft" at={30} volume={0.25} />
      <Sfx name="stamp" at={tMistake} volume={0.5} />
      <Sfx name="pop-soft" at={tFacing} volume={0.3} />
      <Sfx name="pop-soft" at={tRoom} volume={0.3} />
      <Sfx name="blip" at={tRoom + 14} volume={0.3} />
      <Sfx name="stamp" at={tFix} volume={0.5} />
      <Sfx name="whoosh" at={lTurn} volume={0.3} />
      <Sfx name="thump" at={lLeave} volume={0.3} />
      <Sfx name="whoosh" at={tGates - 16} volume={0.2} />
      <Sfx name="thump" at={lTouch} volume={0.3} />
      <Sfx name="stamp" at={tGates} volume={0.5} />
      <Sfx name="pop" at={tGates + 8} volume={0.3} />
      <Sfx name="pop" at={tGates + 16} volume={0.3} />
      <Sfx name="pop" at={rCall} volume={0.35} />
      <Sfx name="tick" at={rLookAt} volume={0.4} />
      <Sfx name="whoosh" at={rTurn} volume={0.3} />
      <Sfx name="chalk" at={rTurn + 2} volume={0.3} />
      <Sfx name="thump" at={rLeave} volume={0.35} />
      <Sfx name="tick" at={rScan} volume={0.35} />
      <Sfx name="thump" at={rTouch} volume={0.35} />
      <Sfx name="thump" at={rPassBack} volume={0.3} />
      <Sfx name="pop-soft" at={tBackFoot + 16} volume={0.2} />
      <Sfx name="pop-soft" at={safetyAt} volume={0.25} />
      <Sfx name="pop-soft" at={easyAt} volume={0.3} />
      <Sfx name="blip" at={ringAt} volume={0.35} />
      <Sfx name="whoosh" at={boardOut} volume={0.35} />
      <Sfx name="light-on" at={flickAt} volume={0.3} />
      <Sfx name="light-off" at={flickAt + 2} volume={0.3} />
      <Sfx name="light-on" at={flickAt + 4} volume={0.35} />
    </>
  );

  // ---------- The night pitch behind the board: b18's opening shot ----------
  // b18's clock runs on under the board (b17's last frame is b18's frame -1), so the idle loops join.
  const fb = frame - cue.frames;
  const taviPose = breathe(POSES.receiveReady, fb, 1);
  const chalkPose: KeeperPose = { ...KPOSES.stand, stretch: 1 + idle(fb, 5, 2.6, 0.008), lean: idle(fb, 6, 3.1, 1.5) };
  // Behind the board the pitch sits dim (a dark wash, under the board), so the lamps do not pull the
  // eye off the notes. As the board goes the floodlights come up with one flicker: on, off, on.
  const DIM = 0.45;
  const lights = frame < flickAt ? DIM : frame < flickAt + 2 ? 1 : frame < flickAt + 4 ? DIM : 1;
  const backdrop = <NightBackdrop cam={NEXT_CAM} ground={NEXT.ground} refX={nx(0)} seed="b18" clockHours={21.3} />;

  // ---------- Left panel state ----------
  const leftDx = LEFT_SHIFT * (1 - progress(frame, tGates - 18, 16, EASE.standard));
  const lFacing = keys(frame, [lTurn, lTurn + 16], [180, 270]);
  let lBall: { x: number; y: number };
  if (frame < lLeave) lBall = L_BALL0;
  else if (frame < lTouch) lBall = { x: L_BALL0.x + rollAt(L_PASS.speed, (frame - lLeave) / 30).x, y: 0 };
  else {
    const r = rollAt(L_OUT_SPEED, (frame - lTouch) / 30).x;
    lBall = { x: L_OUT_DIR.x * r, y: L_OUT_DIR.y * r };
  }
  const lLookRaw = wrap(facingTo({ x: 0, y: 0 }, lBall) - lFacing);
  const lLook = Math.hypot(lBall.x, lBall.y) < 0.25 ? 0 : Math.max(-40, Math.min(40, lLookRaw));
  const LP = (x: number, y: number) => project({ x, y, z: 0 }, L_VIEW);
  const lTavi = LP(0, 0);
  const lSam = LP(L_SAM.x, L_SAM.y);
  const lBallS = LP(lBall.x, lBall.y);
  const lRoom = LP(3.6, 0);
  const lChalk = LP(L_CHALK.x, L_CHALK.y);
  const lSamKick = frame >= lLeave - 6 && frame < lLeave + 4 ? Math.sin(((frame - (lLeave - 6)) / 10) * Math.PI) : 0;
  const chestT = progress(frame, tFacing, 12, EASE.enter) * (1 - progress(frame, tFix - 2, 8, EASE.exit));

  // ---------- Right panel state ----------
  const rShow = progress(frame, tGates - 2, 12, EASE.enter);
  const rFacingBase = keys(frame, [rTurn, rTurn + 14], [180, 90]);
  let rBall: { x: number; y: number };
  let rTavi = { x: 0, y: 0 };
  let rFacing = rFacingBase;
  if (frame < rLeave) rBall = R_BALL0;
  else if (frame < rTouch) rBall = { x: R_BALL0.x + rollAt(DRILLS.b17.speed, (frame - rLeave) / 30).x, y: 0 };
  else if (frame < rPassBack) {
    const r = rollAt(DRILLS.gateTouch, (frame - rTouch) / 30).x;
    rBall = { x: GATE_DIR.x * r, y: GATE_DIR.y * r };
  } else {
    const r = rollAt(BACK_SPEED, (frame - rPassBack) / 30).x;
    rBall = { x: STOP_PT.x + BACK_DIR.x * r, y: STOP_PT.y + BACK_DIR.y * r };
  }
  // She follows the touch and stands behind the ball to pass it back.
  const standPt = { x: STOP_PT.x - BACK_DIR.x * 0.4, y: STOP_PT.y - BACK_DIR.y * 0.4 };
  const followT = smooth(clamp01((frame - rFollow) / (rPassBack - 6 - rFollow)));
  if (frame >= rFollow) rTavi = { x: standPt.x * followT, y: standPt.y * followT };
  const stride = frame >= rFollow && frame < rPassBack - 6 ? ((frame - rFollow) / 16) % 1 : undefined;
  if (frame >= rFollow) {
    const toBall = facingTo(rTavi, rBall);
    const toSam = facingTo(STOP_PT, R_SAM);
    const turnBack = smooth(clamp01((frame - (rPassBack - 12)) / 10));
    rFacing = frame < rPassBack - 12 ? toBall : toBall + wrap(toSam - toBall) * turnBack;
  }
  let rLook = 0;
  if (frame >= rLookAt && frame < rLookAt + 12) rLook = -100 * Math.sin(((frame - rLookAt) / 12) * Math.PI);
  else if (frame >= rTurn && frame < rFollow) {
    const raw = wrap(facingTo(rTavi, rBall) - rFacing);
    rLook = Math.hypot(rBall.x - rTavi.x, rBall.y - rTavi.y) < 0.25 ? 0 : Math.max(-90, Math.min(90, raw));
    // A scan while the ball travels: the head flicks to the called gate and back (about 0.4 s).
    if (frame >= rScan && frame < rScan + 12) {
      const toGate = Math.max(-100, Math.min(100, wrap(facingTo(rTavi, GATE_LEFT) - rFacing)));
      rLook += (toGate - rLook) * Math.sin(((frame - rScan) / 12) * Math.PI);
    }
  }
  const RP = (x: number, y: number) => project({ x, y, z: 0 }, R_VIEW);
  const rTaviS = RP(rTavi.x, rTavi.y);
  const rMark = RP(0, 0);
  const rSam = RP(R_SAM.x, R_SAM.y);
  const rBallS = RP(rBall.x, rBall.y);
  const gL1 = RP(GATE_LEFT.x, GATE_LEFT.y + GATE_HALF);
  const gL2 = RP(GATE_LEFT.x, GATE_LEFT.y - GATE_HALF);
  const gR1 = RP(GATE_RIGHT.x, GATE_RIGHT.y + GATE_HALF);
  const gR2 = RP(GATE_RIGHT.x, GATE_RIGHT.y - GATE_HALF);
  const rSamKick = frame >= rLeave - 6 && frame < rLeave + 4 ? Math.sin(((frame - (rLeave - 6)) / 10) * Math.PI) : 0;
  const gateLit = progress(frame, rCall + 4, 8);
  // "open" lands with the turn, before the pass leaves, and stays up through "Open to that gate".
  const openArc = visible(frame, rTurn - 2, tOpenEnd + 2, 10, 8);

  // ---------- The ink from b16 shrinks into the board ----------
  const inkT = progress(frame, 0, 14, EASE.standard);
  const inkFade = 1 - progress(frame, 12, 8);
  const ink = {
    x: lerp(0, BOARD.x, inkT),
    y: lerp(0, BOARD.y, inkT),
    w: lerp(WIDTH, BOARD.w, inkT),
    h: lerp(HEIGHT, BOARD.h, inkT),
    rx: lerp(0, BOARD.rx, inkT),
  };
  const boardShow = progress(frame, 6, 10);

  return (
    <Stage bg={PITCH.sky}>
      {/* From the flicker on, the far layers hold b18's frame 0 (its beam dust and stars), so the cut is exact. */}
      {frame >= flickAt ? <Freeze frame={0}>{backdrop}</Freeze> : backdrop}
      <g transform={camT(NEXT_CAM)}>
        <GroundSide groundY={NEXT.ground} vanishX={nx(8)} />
        <Player x={nx(0)} groundY={NEXT.ground} h={1.62 * NEXT.ppm} pose={taviPose} face="focus" />
        <Ball cx={nx(0.45)} cy={NEXT.ground - NEXT_BALL_R} r={NEXT_BALL_R} view={NEXT_SIDE} axis={{ x: 0, y: -1, z: 0 }} angle={0} />
        <Keeper x={nx(7.2)} groundY={NEXT.ground} h={2.1 * NEXT.ppm} pose={chalkPose} face="flat" look={0.8} flip />
      </g>
      {lights < 1 ? <rect width={WIDTH} height={HEIGHT} fill="#050A18" opacity={0.7 * (1 - lights)} /> : null}

      <g opacity={boardShow}>
        <PracticeBoard at={-30} until={boardOut}>
          <Chips
            centerX={WIDTH / 2}
            y={215}
            items={[
              { text: "Chest between passer and goal", at: 14, activeAt: tFix },
              { text: "Let it run to the back foot, toes open", at: 22, activeAt: tBackFoot },
              { text: "Look while it travels", at: 30, activeAt: rScan },
            ]}
          />

          {/* Left panel: the mistake, then the fix. Centred until the drill comes in. */}
          <g transform={`translate(${leftDx} 0)`}>
            <ClipPanel x={LEFT_X} y={PANEL_Y} w={PANEL_W} h={PANEL_H} id="b17-left">
              <TopField view={L_VIEW} x0={-16} x1={12} y0={-8} y1={8} lines={false} />
              <ChalkWaver x={lChalk.x} y={lChalk.y} facing={angleTo(lChalk.x, lChalk.y, lTavi.x, lTavi.y)} size={50} waveAt={tRoom + 12} waveFor={44} opacity={0.62} />
              <VisionFan x={lTavi.x} y={lTavi.y} facing={lFacing} wideDeg={200} sharpDeg={5} radius={270} at={tMistake + 3} darkenOutside={{ x: 0, y: 0, w: PANEL_W, h: PANEL_H }} />
              <RoomPatch x={lRoom.x} y={lRoom.y} rx={72} ry={52} at={tRoom} dim={frame < tFix ? 1 : 0.55} />
              {chestT > 0.001 ? (
                <line x1={lTavi.x} y1={lTavi.y} x2={lTavi.x + (lBallS.x - lTavi.x) * chestT} y2={lTavi.y + (lBallS.y - lTavi.y) * chestT} stroke={CAST.mistake} strokeWidth={5} strokeDasharray="12 10" strokeLinecap="round" opacity={0.9} />
              ) : null}
              <TopPlayer x={lSam.x + lSamKick * 6} y={lSam.y + idle(frame, 4, 3, 1.2)} kind="sam" facing={0} size={50} />
              <TopPlayer x={lTavi.x} y={lTavi.y + idle(frame, 5, 3.1, 0.8)} kind="tavi" facing={lFacing} look={lLook} size={52} />
              <Ball cx={lBallS.x} cy={lBallS.y} r={9} view={L_VIEW} patches={false} axis={{ x: 0, y: 1, z: 0 }} angle={(lBall.x + 10) / 0.11} />
              <Label x={lRoom.x} y={lRoom.y - 92} text="room to turn" at={tRoom + 5} until={tFix} size={32} bg={XRAY.lime} color={PITCH.sky} />
              <Label x={PANEL_W - 130} y={58} text="goal" at={lTurn + 18} size={32} bg={PITCH.chalk} color={PITCH.sky} />
              <Arrow x1={PANEL_W - 66} y1={58} x2={PANEL_W - 22} y2={58} at={lTurn + 22} dur={8} color={XRAY.lime} width={6} />
            </ClipPanel>
            <Stamp kind="MISTAKE" x={LEFT_X + 150} y={PANEL_Y + 60} at={tMistake} until={tFix - 2} />
            <Stamp kind="FIX" x={LEFT_X + 110} y={PANEL_Y + 60} at={tFix} />
            {/* The left notes land with "room to turn" and Chalk's wave, so the board fills early. */}
            <Text x={LEFT_X + 10} y={786} text="Room behind? Half-turn." at={tRoom + 6} size={32} anchor="start" color={XRAY.lime} />
            <Text x={LEFT_X + 10} y={828} text="Chalk on your back? Stay straight on," at={tRoom + 18} size={32} anchor="start" />
            <Text x={LEFT_X + 10} y={870} text="keep him off the ball, pass back." at={tRoom + 30} size={32} anchor="start" />
          </g>

          {/* Right panel: the two-gate drill, hidden until "Two gates behind you". */}
          {rShow > 0.001 ? (
            <g transform={`translate(${(1 - rShow) * 60} 0)`} opacity={rShow}>
              <ClipPanel x={RIGHT_X} y={PANEL_Y} w={PANEL_W} h={PANEL_H} id="b17-right">
                <TopField view={R_VIEW} x0={-16} x1={12} y0={-8} y1={8} lines={false} />
                <Gate a={gL1} b={gL2} at={tGates + 8} lit={gateLit} r={13} />
                <Gate a={gR1} b={gR2} at={tGates + 16} r={13} />
                {frame >= rTouch ? (
                  <line x1={rMark.x} y1={rMark.y} x2={rBallS.x} y2={rBallS.y} stroke={XRAY.lime} strokeWidth={4} strokeDasharray="8 8" opacity={0.55 * (frame < rPassBack ? 1 : 1 - progress(frame, rPassBack, 10))} />
                ) : null}
                <TopPlayer x={rSam.x + rSamKick * 6} y={rSam.y + idle(frame, 6, 3, 1.2)} kind="sam" facing={0} size={50} />
                <TopPlayer x={rTaviS.x} y={rTaviS.y + (stride === undefined ? idle(frame, 7, 3.3, 0.8) : 0)} kind="tavi" facing={rFacing} look={rLook} size={52} stride={stride} />
                <Ball cx={rBallS.x} cy={rBallS.y} r={9} view={R_VIEW} patches={false} axis={{ x: 0, y: 1, z: 0 }} angle={(rBall.x + 10 + Math.abs(rBall.y)) / 0.11} />
                <Bubble x={rSam.x + 104} y={rSam.y - 96} tx={rSam.x + 12} ty={rSam.y - 28} text="LEFT!" at={rCall} until={rLeave - 4} size={38} />
                {openArc > 0.001 ? (
                  <g opacity={openArc}>
                    <Arrow x1={rMark.x - 52} y1={rMark.y} x2={rMark.x} y2={rMark.y + 52} at={rTurn - 2} dur={12} color={XRAY.lime} width={6} curve={-0.5} />
                    <Label x={rMark.x - 120} y={rMark.y + 96} text="open" at={rTurn + 2} size={32} bg={XRAY.lime} color={PITCH.sky} />
                  </g>
                ) : null}
              </ClipPanel>
            </g>
          ) : null}
          <Stamp kind="DRILL" x={RIGHT_X + 120} y={PANEL_Y + 60} at={tGates} />

          {/* Notes under the drill: they land while the drill clip plays. */}
          <Text x={RIGHT_X + 10} y={786} text="Ten each way, then swap." at={tBackFoot + 16} size={32} anchor="start" />
          <Text x={RIGHT_X + 10} y={828} text="Level 2: Sam calls as the ball leaves." at={tBackFoot + 28} size={32} anchor="start" />
          <Text x={RIGHT_X + 10} y={870} text="No friend? A wall: rebound on the back foot." at={tBackFoot + 40} size={32} anchor="start" />

          {/* The strip: the safety line, easy passes first, and the ring icon between the two lines. */}
          <Text x={LEFT_X + 10} y={930} text="Flat markers, not tall cones. Clear lane behind the gates. No tackles." at={safetyAt} size={32} anchor="start" color={PITCH.light} />
          <Text x={LEFT_X + 10} y={974} text="Easy passes first. Add pace when every touch goes through the gate." at={easyAt} size={32} anchor="start" color={PITCH.lightSoft} />
          <TimeBubble x={1330} y={942} seconds={2.4} pxPerSecond={12} minRadius={26} maxRadius={32} showNumber={false} at={ringAt} />
          {frame >= ringAt ? <circle cx={1330} cy={942} r={9 * clamp01((frame - ringAt) / 6)} fill={XRAY.lime} /> : null}
          <Label x={1386} y={942} text="turn already done" at={ringAt + 4} size={32} anchor="start" bg={XRAY.lime} color={PITCH.sky} />
        </PracticeBoard>
      </g>

      {/* b16's ink, shrinking into the board shape, then fading into it. */}
      {inkFade > 0.001 ? <rect x={ink.x} y={ink.y} width={ink.w} height={ink.h} rx={ink.rx} fill={BOARD_BG} opacity={inkFade} /> : null}
      {sfx}
    </Stage>
  );
};
