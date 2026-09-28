// b06 Two looks, one map. Map view of the cold-open mark: Sam passes, Tavi scans on the kick frame and
// again at halfway, each scan takes a snapshot that flies over the thought bubble and lands as a chalk dot;
// then eyes on the ball, the Chalk dot pulses, the space patch appears, the fog clears into a tiny map and
// the ring rides with her. The narration is three times longer than the pass, so the world freezes while
// each snapshot is read and the physics stays on PASS_IN and CHALK_CHASE. It opens on a match cut from b05's
// X-ray head (with its lime ring) into Tavi's token, and the thought bubble grows for the map payoff.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, Camera, type CamKey } from "../../kit/Camera";
import { Snapshot, ThoughtBubble, UnknownFog } from "../../kit/Snapshot";
import { TimeBubble } from "../../kit/TimeBubble";
import { Label, Stamp } from "../../kit/Graphics";
import { Sfx } from "../../kit/Sfx";
import { useCues } from "../../lib/timing";
import { EASE, idle, lerp, progress } from "../../lib/anim";
import { PITCH, XRAY } from "../../theme";
import { SAM, chalkAt, passInAt, ringSeconds } from "../../physics/ep2sims";
import {
  CHALK_BEARING,
  CamFlash,
  ChalkPhoto,
  EyeIcon,
  MARK,
  MiniMap,
  PassWorld,
  S,
  TOKEN,
  XRayMatchCut,
  clockAt,
  frameAtTau,
  scanLook,
  type SpeedKey,
} from "../../kit/ext/ep2-b06-b08-map";

const TAVI_FACING = 180; // facing Sam, back to the goal
/** The scan: over her left shoulder until the narrow sharp wedge sits right on Chalk (he runs straight at her mark). */
const SCAN_DEG = CHALK_BEARING - TAVI_FACING;
const BUBBLE = { x: 700, y: 330, w: 440, h: 270 };
/** The grown bubble for "Where's Chalk? Where's the space? They build a map": 1.6 times, centred here. */
const GROW = { k: 1.6, x: 660, y: 318 };
const SLOTS = [
  { x: 600, y: 95, tilt: -7 },
  { x: 800, y: 95, tilt: 5 },
];
const SNAP_START = { x: MARK.x + 170, y: MARK.y - 110 };

export const B06: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b06");

  // Beats.
  const tSo = cue("So look early");
  const tFoot = cue("foot");
  const tHalf = cue("Halfway");
  const tThen = cue("Then eyes");
  const tEyes = cue("eyes on the ball");
  const tWhere = cue("Where's Chalk");
  const tChalk = cue("Chalk");
  const tSpace = cue("Where's the space");
  const tSpaceW = cue("space");
  const tBuild = cue("They build");
  const tHead = cue("head");
  const tYou = cue("You know");

  // The pass clock: real time through each scan, frozen while a snapshot is read, slow at the end.
  const K = tFoot + 4;
  const keysA: SpeedKey[] = [
    [K, 1],
    [K + 15, 1],
    [K + 19, 0],
    [tHalf + 3, 0],
    [tHalf + 7, 1],
  ];
  // Scan 2 freezes at the middle of its hold (the sharp wedge on Chalk) and turns back on "Then eyes".
  const HOLD2 = 1.045;
  const f2 = tHalf + 7 + Math.max(0, Math.round((HOLD2 - clockAt(tHalf + 7, keysA)) * 30 - 2));
  const keys: SpeedKey[] = [
    ...keysA,
    [f2, 1],
    [f2 + 4, 0],
    [tThen - 4, 0],
    [tThen, 1],
    [tEyes - 4, 1],
    [tEyes, 0],
    [tYou, 0],
    [tYou + 6, 0.2],
  ];
  const tau = clockAt(frame, keys);
  const snap1 = Math.round(frameAtTau(0.3, keys));
  // The second snapshot fires inside the look's hold, just before the clock stops there.
  const snap2 = Math.round(frameAtTau(Math.min(1.05, clockAt(f2 + 4, keys) - 0.004), keys));
  const eyesBack = Math.round(frameAtTau(1.2, keys));
  const dot1At = snap1 + 19;
  const dot2At = snap2 + 17;
  const arrowAt = dot2At + 4;
  const fogClear = tBuild + 4;
  const mapAt = tBuild + 8;
  // The bubble grows for the map (from "Chalk" to "You know"), then shrinks back as the ring appears.
  const growT = progress(frame, tChalk, 18, EASE.standard) - progress(frame, tYou - 4, 16, EASE.standard);
  const G = 1 + (GROW.k - 1) * growT;
  const bub = { x: lerp(BUBBLE.x, GROW.x, growT), y: lerp(BUBBLE.y, GROW.y, growT), w: BUBBLE.w * G, h: BUBBLE.h * G };
  const bump = Math.min(bub.w, bub.h) * 0.22;
  const inner = { w: bub.w - bump, h: bub.h - bump };
  const polaroidsO = 1 - progress(frame, tChalk, 10, EASE.exit);

  // World state from the sim.
  const kicked = frame >= K;
  const ballX = kicked ? passInAt(tau).x : SAM.x;
  const chalk = chalkAt(tau);
  const look = kicked ? scanLook(tau, 0.1, 0.5, SCAN_DEG) + scanLook(tau, 0.9, 1.2, SCAN_DEG) : 0;
  const headAngle = TAVI_FACING + look;
  const tq = S(0, 0);
  const cq = S(chalk.x, chalk.y);
  const toChalk = (Math.atan2(cq.y - tq.y, cq.x - tq.x) * 180) / Math.PI;
  const dAng = Math.abs((((headAngle - toChalk) % 360) + 540) % 360 - 180);
  const chalkSeen = dAng < 100;
  const samKick = progress(frame, K - 8, 8, EASE.enter) * (1 - progress(frame, K + 2, 12, EASE.standard));
  const ballQ = S(ballX, 0);
  const ringS = ringSeconds(chalk.x, chalk.y, 0, 0);

  // Camera: a slow push towards the thought bubble while the world is frozen, back out for the ring.
  const cam: CamKey[] = [
    { f: 0, x: 960, y: 540, zoom: 1 },
    { f: tEyes, x: 960, y: 540, zoom: 1 },
    { f: tWhere + 10, x: 900, y: 470, zoom: 1.08 },
    { f: tHead, x: 900, y: 470, zoom: 1.08 },
    { f: tYou + 14, x: 960, y: 540, zoom: 1 },
  ];

  /** A polaroid that pops by Tavi's head, then flies over the bubble to its slot. */
  const polaroid = (i: number, at: number, children: React.ReactNode) => {
    const slot = SLOTS[i];
    const fly = progress(frame, at + 10, 16, EASE.standard);
    const bounce = 1 + 0.12 * Math.sin(Math.PI * progress(frame, tWhere + i * 3, 14, EASE.soft));
    // A small arc: the polaroid rises as it crosses the bubble.
    const arc = Math.sin(Math.PI * fly) * -70;
    const x = lerp(SNAP_START.x, slot.x, fly);
    const y = lerp(SNAP_START.y, slot.y, fly) + arc;
    const k = lerp(1, 0.6, fly) * bounce;
    const tilt = lerp(-6, slot.tilt, fly);
    return (
      <g key={i} transform={`translate(${x} ${y}) scale(${k})`}>
        <Snapshot x={0} y={0} at={at} tilt={tilt}>
          {children}
        </Snapshot>
      </g>
    );
  };

  const fogO = 1 - progress(frame, fogClear, 20, EASE.standard);
  const tokenR = TOKEN.tavi / 2;

  return (
    <Stage bg={PITCH.grassDark}>
      <Camera keys={cam}>
        <PassWorld
          frame={frame}
          tau={tau}
          tavi={{ x: 0, y: 0, facing: TAVI_FACING, look }}
          ball={{ x: ballX, y: 0 }}
          rolled={ballX - SAM.x}
          fan={{ darken: true }}
          samKick={samKick}
          darkEyes={!chalkSeen}
          labels
        >
          {/* Halfway mark on the grass. */}
          {(() => {
            const h = S(-6, 0);
            const o = progress(frame, tHalf, 10, EASE.enter) * (1 - progress(frame, tThen, 8, EASE.exit));
            if (o <= 0.001) return null;
            return (
              <g opacity={o}>
                <line x1={h.x} y1={h.y - 26 * o} x2={h.x} y2={h.y + 26 * o} stroke={PITCH.chalk} strokeWidth={6} strokeLinecap="round" />
                <Label x={h.x} y={h.y + 68} text="halfway" at={tHalf + 2} until={tThen} size={32} />
              </g>
            );
          })()}
          {/* Eyes on the ball: two thin lime lines from her token to the ball, and the eye icon riding on it. */}
          {frame >= eyesBack ? (
            <g opacity={progress(frame, eyesBack, 8)}>
              {[-7, 7].map((dy) => (
                <line key={dy} x1={tq.x - 34} y1={tq.y + dy} x2={ballQ.x + 18} y2={ballQ.y + dy * 0.4} stroke={XRAY.lime} strokeWidth={3} strokeDasharray="6 10" strokeLinecap="round" opacity={0.7} />
              ))}
            </g>
          ) : null}
        </PassWorld>
        {frame >= eyesBack ? <EyeIcon x={ballQ.x} y={ballQ.y - 44} at={eyesBack + 4} frame={frame} size={26} /> : null}
        {frame >= eyesBack ? <Label x={ballQ.x} y={MARK.y + 96} text="eyes on the ball for the touch" at={tEyes + 8} until={tSpace + 12} size={32} bg={XRAY.lime} color={PITCH.sky} /> : null}
        {/* The ring rides with her once the map is built. */}
        {frame >= tYou ? <TimeBubble x={tq.x} y={tq.y} seconds={ringS} at={tYou} pxPerSecond={110} minRadius={50} fontSize={38} /> : null}
        {/* The map in her head: fog, then dots, then the tiny map. */}
        <ThoughtBubble x={bub.x} y={bub.y} w={bub.w} h={bub.h} hx={tq.x - 10} hy={tq.y - 26} at={tSo}>
          <MiniMap
            w={inner.w}
            h={inner.h}
            frame={frame}
            dots={[
              { ...chalkAt(0.3), at: dot1At },
              { ...chalkAt(1.05), at: dot2At },
            ]}
            arrowAt={arrowAt}
            pulseAt={tChalk}
            spaceAt={tSpaceW}
            mapAt={mapAt}
            ballX={passInAt(1.3).x}
            scale={1.3 * G}
            fog={fogO > 0.01 ? <UnknownFog w={inner.w} h={inner.h} opacity={fogO} /> : null}
          />
        </ThoughtBubble>
        {/* Snapshots: one per scan. They give way when the bubble grows (their dots are in the map by then). */}
        {polaroidsO > 0.001 ? (
          <g opacity={polaroidsO}>
            {polaroid(0, snap1, <ChalkPhoto facing={200 + idle(frame, 1, 3, 2)} />)}
            {polaroid(1, snap2, <ChalkPhoto arrow stride={0.3} facing={195} />)}
          </g>
        ) : null}
        <CamFlash at={snap1} frame={frame} />
        <CamFlash at={snap2} frame={frame} />
      </Camera>

      {/* HUD (screen space): the cue labels the first look only, and goes before "Halfway". */}
      <Stamp kind="CUE" x={1660} y={120} at={K} until={tHalf - 8} rotate={-5} />
      <Label x={1660} y={205} text="ball leaves, head goes" at={K + 3} until={tHalf - 8} size={32} bg={PITCH.accent} color={PITCH.sky} />

      {/* The match cut from b05: the X-ray head and its ring become Tavi's token. */}
      <XRayMatchCut frame={frame} to={tq} tokenR={tokenR} />

      {/* Sound. */}
      <Sfx name="whoosh" at={0} volume={0.18} />
      <Sfx name="pop-soft" at={tSo} volume={0.3} />
      <Sfx name="thump" at={K} volume={0.5} />
      <Sfx name="whoosh-long" at={K + 2} volume={0.18} />
      <Sfx name="tick" at={snap1} volume={0.5} />
      <Sfx name="stamp" at={K + 1} volume={0.4} />
      <Sfx name="pop-soft" at={dot1At} volume={0.35} />
      <Sfx name="pop-soft" at={tHalf} volume={0.3} />
      <Sfx name="tick" at={snap2} volume={0.5} />
      <Sfx name="pop-soft" at={dot2At} volume={0.35} />
      <Sfx name="chalk" at={arrowAt} volume={0.3} />
      <Sfx name="tick" at={eyesBack + 4} volume={0.35} />
      <Sfx name="blip" at={tChalk} volume={0.3} />
      <Sfx name="whoosh" at={tChalk + 2} volume={0.15} />
      <Sfx name="pop-soft" at={tSpaceW} volume={0.35} />
      <Sfx name="air" at={fogClear} volume={0.3} />
      <Sfx name="pop-soft" at={mapAt + 4} volume={0.25} />
      <Sfx name="pop-soft" at={mapAt + 9} volume={0.2} />
      <Sfx name="bell" at={tYou} volume={0.4} />
      <Sfx name="whoosh-long" at={tYou + 6} volume={0.15} />
    </Stage>
  );
};
