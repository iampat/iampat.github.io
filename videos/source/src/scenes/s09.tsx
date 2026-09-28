// s09 Inside-foot contact (X-ray): "New kick, new rule." The rule card flips from the laces to the
// inside of the foot. Toes up, but the ankle stays locked: a firm, flat face. Hit just right of centre.
// Wrap your foot around the ball, out to the right (one sweep, ultra slow motion). Left-footed? Flip it.
// The diagram then clears, so s10 opens on the ball alone. The short hold (the contact slides further
// out, more spin, less speed) plays only when the timeline gives s09 a tail for it (see s09Beats).
import React from "react";
import { useCurrentFrame } from "remotion";
import { cameraAt, Stage, type CamKey } from "../kit/Camera";
import { XRayGrid, XRayLeg } from "../kit/XRay";
import { POSES } from "../kit/Player";
import { Ball } from "../kit/Ball";
import { Arrow, Label, SlowMoTag } from "../kit/Graphics";
import { Sfx } from "../kit/Sfx";
import {
  AimFlag,
  ArcArrow,
  CODA_UI,
  CURL_D,
  CurlerDiagram,
  EffortBar,
  placeFoot,
  RuleCard,
  s09Beats,
  summaryState,
  WorldGrid,
  XRayFootTop,
} from "../kit/ext/s08-s10-parts";
import { sceneTiming, useCues } from "../lib/timing";
import { EASE, idle, pop, progress } from "../lib/anim";
import type { View } from "../lib/project";
import { FONTS, HEIGHT, WIDTH, XRAY } from "../theme";

const { C, R, FL, PHI0, LAUNCH, FLAG_D, LINE_N } = CURL_D;
const TOP: View = { kind: "topUp", originX: 0, originY: 0, ppm: 1 };
const BEHIND: View = { kind: "persp", cam: { x: -3, y: 0, z: 0.11 }, yawDeg: 0, focal: 1000, cx: 960, cy: 540 };
const SLOW = 1 / 40; // ultra slow motion

export const S09: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s09");

  // Beats, keyed to the exact words.
  const tNew = cue("New kick");
  const tRule = cue("new rule");
  const tInside = cue("Inside of your foot");
  const tThisTime = cue("This time");
  const tToes = cue("toes up");
  const tLocked = cue("locked");
  const tFirm = cue("firm");
  const tFlat = cue("flat face");
  const tHit = cue("Hit just right of centre");
  const tRight = cue("right of centre");
  const tWrap = cue("Wrap your foot");
  const tOutRight = cue("out to the right");
  const B = s09Beats(cue);

  const footIn = tRule + 14; // the X-ray foot shot fades in
  const behindIn = tHit - 6;
  const wipeIn = tWrap - 4;
  const sumIn = B.sumIn;
  const XF = 8; // cross-fade frames
  // A frame count that runs across the s08 cut (for the rule card's idle bob).
  const gFrame = sceneTiming("s09").startFrame + frame;

  // ================= 0: the rule card flips from laces to inside =================
  const renderCard = () => {
    const flip = progress(frame, tRule - 4, 14, EASE.standard);
    const out = progress(frame, footIn, 10, EASE.exit);
    return (
      <g>
        <XRayGrid />
        <RuleCard x={960} y={500 - 60 * out} s={1 - out} flip={flip} t={gFrame} />
      </g>
    );
  };

  // ================= A: the X-ray foot from above, and the side inset =================
  const renderFoot = () => {
    const keysA: CamKey[] = [
      { f: footIn, x: 1000, y: 640, zoom: 1.3 },
      { f: tToes + 16, x: 1230, y: 560, zoom: 1.12 },
      { f: behindIn + XF, x: 1240, y: 552, zoom: 1.15 },
    ];
    const cam = cameraAt(frame, keysA);
    const build = progress(frame, footIn - 6, 44, EASE.soft);
    // The glow and its label pop on the word "inside". The ball and the shin are there before it,
    // so the foot never sits alone on the grid.
    const glow = progress(frame, tInside - 2, 10, EASE.enter) * (1 - 0.55 * progress(frame, tFirm, 10));
    const plate = progress(frame, tFirm - 2, 12, EASE.back);
    const ballO = progress(frame, footIn + 8, 14, EASE.enter);
    const foot = placeFoot(PHI0);
    const worldT = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;

    // Inset (screen space): side view of the lower leg. Toes lift and turn out a little, the ankle locks.
    const insetIn = progress(frame, tThisTime - 2, 14, EASE.enter);
    const insetOut = progress(frame, behindIn - 6, 8, EASE.exit);
    const insetS = pop(frame, tThisTime - 2, { stiffness: 170, damping: 15 }) * (1 - insetOut);
    const toesUp = progress(frame, tToes + 2, 16, EASE.standard);
    const turn = 0.12 + 0.2 * toesUp;
    const lock = progress(frame, tLocked, 6, EASE.enter);
    const pose = { ...POSES.inside, nearAnkle: 114 - 38 * toesUp };
    const IX = 1235;
    const IY = 140;
    const IW = 590;
    const IH = 790;
    const legX = IX + 250;
    const legY = IY - 230 + idle(frame, 1, 3, 3);
    // Where the foot is in the inset (same solver as the leg), for the plate.
    const hLeg = 1500;
    const rad = (d: number) => (d * Math.PI) / 180;
    const knee = { x: legX + Math.sin(rad(pose.nearHip)) * 0.245 * hLeg, y: legY + Math.cos(rad(pose.nearHip)) * 0.245 * hLeg };
    const sa = pose.nearHip - pose.nearKnee;
    const ank = { x: knee.x + Math.sin(rad(sa)) * 0.235 * hLeg, y: knee.y + Math.cos(rad(sa)) * 0.235 * hLeg };
    const fa = sa + (180 - pose.nearAnkle);
    const fLen = 0.13 * hLeg * (1 - 0.55 * turn);
    const toe = { x: ank.x + Math.sin(rad(fa)) * fLen, y: ank.y + Math.cos(rad(fa)) * fLen };
    return (
      <g>
        <g transform={worldT}>
          <WorldGrid cx={cam.x} cy={cam.y} zoom={cam.zoom} />
          <g opacity={ballO}>
            <Ball cx={C.x} cy={C.y} r={R} view={TOP} axis={{ x: 0, y: 0, z: 1 }} angle={0.15 * idle(frame, 2, 4, 1)} lineNormal={LINE_N} showBack />
          </g>
          <XRayFootTop x={foot.x} y={foot.y} angle={foot.angle} L={FL} build={build} glow={glow} plate={plate} frame={frame} shin />
          <Label x={foot.P.x + 10} y={foot.P.y + 250} text="inside of the foot" at={tInside} until={tFirm - 8} size={38} bg={XRAY.lime} color={XRAY.bg} />
          <Label x={foot.P.x + 10} y={foot.P.y + 250} text="firm, flat face" at={tFirm + 2} until={behindIn - 4} size={38} bg={XRAY.lime} color={XRAY.bg} />
        </g>
        {insetIn > 0.001 && insetOut < 0.999 ? (
          <g transform={`translate(${IX + IW / 2} ${IY + IH / 2}) scale(${insetS}) translate(${-IX - IW / 2} ${-IY - IH / 2})`}>
            <defs>
              <clipPath id="s09-inset">
                <rect x={IX} y={IY} width={IW} height={IH} rx={44} />
              </clipPath>
            </defs>
            <rect x={IX} y={IY} width={IW} height={IH} rx={44} fill="#0A2C38" />
            <g clipPath="url(#s09-inset)">
              <XRayGrid opacity={0.35} step={60} />
              <XRayLeg x={legX} y={legY} h={hLeg} pose={pose} ankleLock={lock} footTurn={turn} />
              {plate > 0.001 ? (
                <line
                  x1={ank.x + (toe.x - ank.x) * 0.1}
                  y1={ank.y + (toe.y - ank.y) * 0.1 + 26}
                  x2={ank.x + (toe.x - ank.x) * (0.1 + 0.85 * Math.min(1, plate))}
                  y2={ank.y + (toe.y - ank.y) * (0.1 + 0.85 * Math.min(1, plate)) + 26}
                  stroke={XRAY.lime}
                  strokeWidth={16}
                  strokeLinecap="round"
                />
              ) : null}
              {/* Toes-up hint arrow. */}
              <ArcArrow
                cx={ank.x}
                cy={ank.y}
                r={fLen + 40}
                a0={90 - (sa + 180 - 114) - 4}
                a1={90 - (sa + 180 - pose.nearAnkle) + 4}
                t={toesUp}
                color={XRAY.lime}
                width={9}
                opacity={1 - progress(frame, tLocked + 16, 10)}
              />
            </g>
            <text x={IX + 36} y={IY + 62} fill={XRAY.bone} opacity={0.75} fontFamily={FONTS.hud} fontWeight={700} fontSize={34} letterSpacing={4}>
              SIDE VIEW
            </text>
            <Label x={IX + IW / 2} y={IY + IH - 150} text="toes up" at={tToes + 6} size={38} bg={XRAY.bone} color={XRAY.bg} />
            <Label x={IX + IW / 2} y={IY + IH - 70} text="ankle locked" at={tLocked + 2} size={38} bg={XRAY.lime} color={XRAY.bg} />
          </g>
        ) : null}
      </g>
    );
  };

  // ================= B: the ball from behind, split in two =================
  const renderBehind = () => {
    const zoom = 1 + 0.05 * progress(frame, behindIn, wipeIn + XF - behindIn, EASE.camera);
    const bx = 960;
    const by = 520;
    const r = 300;
    const split = progress(frame, tHit + 2, 12, EASE.standard);
    const half = progress(frame, tRight - 2, 12, EASE.enter);
    const dotS = pop(frame, tRight + 4, { stiffness: 260, damping: 14 });
    const dot = { x: bx + 0.26 * r, y: by + 0.1 * r };
    const pulse = 0.5 + 0.5 * Math.sin(frame / 4);
    return (
      <g>
        <XRayGrid />
        <g transform={`translate(960 540) scale(${zoom}) translate(-960 -540)`}>
          <defs>
            <clipPath id="s09-right">
              <rect x={bx} y={by - r * 1.5} width={r * 1.5} height={r * 3} />
            </clipPath>
          </defs>
          {half > 0.001 ? <circle cx={bx} cy={by} r={r * 1.12} fill={XRAY.bg} /> : null}
          {half > 0.001 ? (
            <g clipPath="url(#s09-right)">
              {[1.34, 1.24, 1.14].map((k, i) => (
                <circle key={i} cx={bx} cy={by} r={r * k} fill={XRAY.lime} opacity={(0.08 + 0.03 * pulse) * half} />
              ))}
            </g>
          ) : null}
          <Ball cx={bx} cy={by} r={r} view={BEHIND} axis={{ x: 1, y: 0, z: 0 }} angle={0.06 * idle(frame, 1, 4, 1)} lineNormal={LINE_N} />
          {half > 0.001 ? (
            <g clipPath="url(#s09-right)">
              <circle cx={bx} cy={by} r={r - 7} fill="none" stroke={XRAY.lime} strokeWidth={14} opacity={half} />
            </g>
          ) : null}
          {split > 0.001 ? (
            <line x1={bx} y1={by - r - 40} x2={bx} y2={by - r - 40 + (2 * r + 80) * split} stroke={XRAY.bone} strokeWidth={8} strokeDasharray="22 16" strokeLinecap="round" />
          ) : null}
          {dotS > 0.001 ? (
            <g transform={`translate(${dot.x} ${dot.y}) scale(${dotS})`}>
              <circle r={42 + 8 * pulse} fill="none" stroke={XRAY.lime} strokeWidth={8} opacity={0.9} />
              <circle r={20} fill={XRAY.bone} />
            </g>
          ) : null}
          <Arrow x1={dot.x + 330} y1={dot.y + 230} x2={dot.x + 70} y2={dot.y + 50} at={tRight + 8} until={wipeIn} color={XRAY.lime} width={12} curve={0.15} />
          <Label x={dot.x + 420} y={dot.y + 290} text="just right of centre" at={tRight + 6} until={wipeIn} size={40} bg={XRAY.lime} color={XRAY.bg} />
        </g>
        <text x={70} y={100} fill={XRAY.bone} opacity={0.75 * progress(frame, behindIn, 10)} fontFamily={FONTS.hud} fontWeight={700} fontSize={34} letterSpacing={4}>
          FROM BEHIND
        </text>
      </g>
    );
  };

  // ================= C: one sweep, in ultra slow motion =================
  // One thing at a time: the sweep arrow (the foot), then the ball leaves with one spin ring,
  // on a dotted track through the aim-off flag. The camera follows, then eases to a stop, so the
  // ball flies out of the top of the frame before the summary builds (never two balls at once).
  const contactLen = Math.round(0.01 / SLOW / (1 / 30)); // about 10 ms of contact at 1/40 speed = 12 frames
  const releaseAt = tOutRight; // the ball leaves on "out to the right"
  const contactAt = releaseAt - contactLen; // squash around the inner arch during "around the ball"
  const slowAt = contactAt - 8; // slow motion starts
  const vBall = 25; // px per frame at 1/40 speed (19 m/s)
  const wSpin = 0.037; // rad per frame at 1/40 speed (7 turns per second)
  const S0 = -150; // foot start, px back along the sweep path
  const FLAG_SIZE = 140;
  const flagAt = tWrap + 8; // the aim-off flag lands (with the sweep arrow, before the foot moves)
  const wipeOut = sumIn - 6; // the wipe clears before the summary fades in
  /** Ball distance along the launch line (pushed during contact, then constant speed). */
  const ballDisp = (f: number) => {
    const tc = f - contactAt;
    if (tc <= 0) return 0;
    const t1 = Math.min(tc, contactLen);
    return (vBall * t1 * t1) / (2 * contactLen) + Math.max(0, tc - contactLen) * vBall;
  };

  const renderWipe = () => {
    const base = placeFoot(PHI0);
    // Foot along the sweep path (one way only).
    const tf = frame - slowAt;
    let slide = S0 + idle(frame, 3, 2, 4);
    if (tf > 0) {
      const ramp = Math.min(tf, 6);
      const d0 = (25 * (ramp * ramp)) / 12; // eases up to full speed over 6 frames
      slide = S0 + d0 + Math.max(0, tf - 6) * 25;
    }
    // Ball: pushed during contact, then flies off along the launch line, turning.
    const tc = frame - contactAt;
    const disp = ballDisp(frame);
    let angle = 0;
    let squash = 1;
    if (tc > 0) {
      const t1 = Math.min(tc, contactLen);
      angle = (wSpin * t1 * t1) / (2 * contactLen) + Math.max(0, tc - contactLen) * wSpin;
      squash = tc < contactLen ? 1 - 0.14 * Math.sin((Math.PI * tc) / contactLen) : 1;
    }
    const ball = { x: C.x + LAUNCH.x * disp, y: C.y + LAUNCH.y * disp };
    // During contact the foot rides with the ball; after release it slows down and falls behind.
    let foot = placeFoot(PHI0, slide);
    if (tc > 0) {
      const t1 = Math.min(tc, contactLen);
      const afterC = Math.min(Math.max(0, tc - contactLen), 28);
      const ride = (vBall * t1 * t1) / (2 * contactLen);
      const along = t1 * 6 + 20 * afterC - 0.35 * afterC * afterC;
      foot = { ...base, x: base.x + LAUNCH.x * ride + base.w.x * along, y: base.y + LAUNCH.y * ride + base.w.y * along };
    }
    // Camera follows the ball after contact, then slows to a stop (smooth, no snap).
    const follow = progress(frame, contactAt, 20, EASE.soft);
    const T0 = releaseAt + 8;
    const D = 16;
    const u = Math.min(Math.max(0, frame - T0), D);
    const camDisp = frame <= T0 ? disp : ballDisp(T0) + vBall * (u - (u * u) / (2 * D));
    const camBase = { x: 930, y: 475, zoom: 0.94 };
    const cam = {
      x: camBase.x + LAUNCH.x * camDisp * 0.85 * follow,
      y: camBase.y + LAUNCH.y * camDisp * 0.85 * follow,
      zoom: camBase.zoom + 0.05 * progress(frame, wipeIn, 30, EASE.camera),
    };
    const worldT = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;
    const nAng = (Math.atan2(base.n.y, base.n.x) * 180) / Math.PI;
    const pathAt = tWrap + 4;
    const pathT = progress(frame, pathAt, 16, EASE.enter);
    const pathO = 1 - progress(frame, releaseAt - 4, 8); // the sweep arrow leaves as the ball does
    const flagS = pop(frame, flagAt, { stiffness: 200, damping: 14 });
    const flag = { x: C.x + LAUNCH.x * FLAG_D, y: C.y + LAUNCH.y * FLAG_D };
    const dotO = 1 - progress(frame, contactAt, 4);
    // One spin ring, anticlockwise from above: the back of the ball goes right, the front goes left.
    const ringT = progress(frame, releaseAt - 2, 14, EASE.enter);
    const trailO = 0.6 * progress(frame, releaseAt, 6);
    const a0 = { x: base.P.x - base.w.x * 240, y: base.P.y - base.w.y * 240 };
    const a1 = { x: base.P.x + base.w.x * 250, y: base.P.y + base.w.y * 250 };
    // Travelling chevrons on the sweep path: it moves one way only.
    const chevrons = pathT > 0.99 && pathO > 0.01 && tc < contactLen
      ? [0, 1, 2].map((i) => {
          const uu = ((frame - pathAt - 16) / 26 + i / 3) % 1;
          const px = a0.x + (a1.x - a0.x) * (0.1 + 0.75 * uu);
          const py = a0.y + (a1.y - a0.y) * (0.1 + 0.75 * uu);
          const ang = (Math.atan2(a1.y - a0.y, a1.x - a0.x) * 180) / Math.PI;
          const o = Math.sin(Math.PI * uu) * pathO;
          return <path key={i} d="M-14,-16 L6,0 L-14,16" transform={`translate(${px} ${py}) rotate(${ang})`} fill="none" stroke={XRAY.bg} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" opacity={o} />;
        })
      : null;
    return (
      <g>
        <g transform={worldT}>
          <WorldGrid cx={cam.x} cy={cam.y} zoom={cam.zoom} />
          {/* Dotted track behind the flying ball: it heads out through the aim-off flag. */}
          {tc > contactLen && trailO > 0.001 ? (
            <line x1={C.x} y1={C.y} x2={ball.x} y2={ball.y} stroke={XRAY.bone} strokeWidth={9} strokeDasharray="1 24" strokeLinecap="round" opacity={trailO} />
          ) : null}
          <AimFlag x={flag.x} y={flag.y} size={FLAG_SIZE} s={flagS} frame={frame} />
          {/* The pill touches the tip of the flag. */}
          <Label
            x={flag.x + FLAG_SIZE * 0.6 - 6}
            y={flag.y - FLAG_SIZE * 0.84}
            anchor="start"
            text="aim here"
            at={flagAt + 2}
            until={releaseAt - 6}
            size={44}
            bg={XRAY.bone}
            color={XRAY.bg}
          />
          <g transform={`translate(${ball.x} ${ball.y}) rotate(${nAng}) scale(${squash} ${1 / squash}) rotate(${-nAng}) translate(${-ball.x} ${-ball.y})`}>
            <Ball cx={ball.x} cy={ball.y} r={R} view={TOP} axis={{ x: 0, y: 0, z: 1 }} angle={angle} lineNormal={LINE_N} showBack />
          </g>
          {/* The sweep path: forward and to the right, one way. */}
          <g opacity={pathO}>
            <Arrow x1={a0.x} y1={a0.y} x2={a1.x} y2={a1.y} at={pathAt} dur={16} color={XRAY.lime} width={14} curve={-0.12} />
            {chevrons}
          </g>
          {dotO > 0.001 && pathT > 0 ? <circle cx={base.P.x} cy={base.P.y} r={14} fill={XRAY.bone} opacity={dotO} /> : null}
          <XRayFootTop x={foot.x} y={foot.y} angle={foot.angle} L={FL} glow={0.5} plate={1} frame={frame} shin />
          <ArcArrow cx={ball.x} cy={ball.y} r={R + 44} a0={160} a1={-140} t={ringT} width={14} />
        </g>
        {/* The tag is at full opacity by the time the flag lands. */}
        <SlowMoTag at={flagAt - 4} until={wipeOut} label="ULTRA SLOW MOTION" />
      </g>
    );
  };

  // ================= D: the summary diagram, flip for the left foot, then (if there is room) the short hold =================
  const sumCam = CURL_D.CAM;
  const sumT = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${sumCam.zoom}) translate(${-sumCam.x} ${-sumCam.y})`;
  const renderSummaryGrid = () => (
    <g transform={sumT}>
      <WorldGrid cx={sumCam.x} cy={sumCam.y} zoom={sumCam.zoom} />
    </g>
  );
  const renderSummary = () => {
    const st = summaryState(frame, B);
    // The parts fade in; the ball pops in at full orange (never a see-through ball).
    const partsIn = progress(frame, sumIn, XF, EASE.soft);
    const ballS = pop(frame, sumIn, { stiffness: 220, damping: 16 });
    return (
      <g>
        <g transform={sumT}>
          <CurlerDiagram st={st} frame={frame} out={st.outO * partsIn} ballS={ballS} />
        </g>
        <Label x={330} y={120} text="left-footed?" at={B.tLeft + 2} until={B.unmirrorAt + 4} size={40} bg={XRAY.bone} color={XRAY.bg} />
        {B.coda ? (
          <g>
            <EffortBar x={CODA_UI.barX} y={CODA_UI.barY} w={CODA_UI.barW} spinFrac={0.3 + 0.38 * st.spinK} opacity={st.barO} />
            <Label x={CODA_UI.labelX} y={CODA_UI.labelY} text="more spin, less speed" at={B.labelAt} until={B.outAt} size={40} bg={XRAY.lime} color={XRAY.bg} />
          </g>
        ) : null}
      </g>
    );
  };

  const oA = progress(frame, footIn, XF, EASE.soft);
  const oB = progress(frame, behindIn, XF, EASE.soft);
  const oC = progress(frame, wipeIn, XF, EASE.soft) * (1 - progress(frame, wipeOut, 6, EASE.exit));
  return (
    <Stage bg={XRAY.bg}>
      {frame < footIn + XF ? renderCard() : null}
      {frame >= footIn && frame < behindIn + XF ? <g opacity={oA}>{renderFoot()}</g> : null}
      {frame >= behindIn && frame < wipeIn + XF ? <g opacity={oB}>{renderBehind()}</g> : null}
      {/* The summary grid sits under the wipe while it clears, so the grid never blinks. */}
      {frame >= wipeOut ? renderSummaryGrid() : null}
      {frame >= wipeIn && frame < sumIn ? <g opacity={oC}>{renderWipe()}</g> : null}
      {frame >= sumIn ? renderSummary() : null}
      {/* SFX */}
      <Sfx name="air" at={0} volume={0.12} dur={60} />
      <Sfx name="pop-soft" at={tNew} volume={0.25} />
      <Sfx name="whoosh" at={tRule - 4} volume={0.35} />
      <Sfx name="tick" at={tRule + 4} volume={0.35} />
      <Sfx name="whoosh" at={footIn} volume={0.2} />
      <Sfx name="blip" at={tInside} volume={0.3} />
      <Sfx name="pop-soft" at={tThisTime - 2} volume={0.3} />
      <Sfx name="whoosh" at={tToes} volume={0.2} />
      <Sfx name="stamp" at={tLocked} volume={0.35} />
      <Sfx name="tick" at={tLocked + 2} volume={0.4} />
      <Sfx name="pop" at={tFirm} volume={0.3} />
      <Sfx name="pop-soft" at={tFlat} volume={0.2} />
      <Sfx name="whoosh" at={behindIn - 4} volume={0.3} />
      <Sfx name="bell" at={tRight - 2} volume={0.25} />
      <Sfx name="pop" at={tRight + 4} volume={0.3} />
      <Sfx name="whoosh" at={wipeIn - 4} volume={0.25} />
      <Sfx name="whoosh" at={tWrap + 4} volume={0.35} />
      <Sfx name="pop-soft" at={flagAt} volume={0.3} />
      <Sfx name="subdrop" at={flagAt - 4} volume={0.25} />
      <Sfx name="thump" at={contactAt} volume={0.45} />
      <Sfx name="whoosh-long" at={releaseAt} volume={0.3} />
      <Sfx name="pop" at={B.tLeft} volume={0.3} />
      <Sfx name="whoosh" at={B.mirrorAt} volume={0.35} />
      <Sfx name="whoosh" at={B.unmirrorAt} volume={0.3} />
      {B.coda ? <Sfx name="tick" at={B.codaAt} volume={0.35} /> : null}
      {B.coda ? <Sfx name="pop" at={B.labelAt} volume={0.3} /> : null}
    </Stage>
  );
};
