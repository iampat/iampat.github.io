// s10 The Air Crowd (X-ray, top view, the ball flies up the screen). Air rushes past the ball like a crowd.
// The spinning ball grabs the air and flings it to one side. Throw air one way, get shoved the other way
// (skateboard inset, then the spin push next to the weight). That's the Magnus effect: the spin push.
import React from "react";
import { random, useCurrentFrame } from "remotion";
import { Stage, cameraAt, type CamKey } from "../kit/Camera";
import { AirFlow, spinPushDir } from "../kit/AirFlow";
import { Ball } from "../kit/Ball";
import { Keeper, KPOSES } from "../kit/Keeper";
import { Arrow, Label, WordCard } from "../kit/Graphics";
import { Sfx } from "../kit/Sfx";
import { ArcArrow, CURL_D, ForceArrow, Puff, s09Beats, SkateInset, summarySpin, summaryState, Swirl, WorldGrid } from "../kit/ext/s08-s10-parts";
import { SHOTS } from "../physics/shots";
import { AIR_DENSITY, BALL, GRAVITY, len, spinRatio } from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, idle, pop, progress } from "../lib/anim";
import type { View } from "../lib/project";
import { FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../theme";

const LINE_N = CURL_D.LINE_N;
const TOP: View = { kind: "topUp", originX: 0, originY: 0, ppm: 1 };
const BX = 960;
const BY = 540;
const R = 150;
const PUSH = spinPushDir(1, 90); // anticlockwise spin, ball flying up the screen -> push to the left

// s09 ends on its ball alone (the summary diagram clears before the cut). s10 opens on the same ball:
// the s09 world maps onto this one around the ball (scale K), and the first camera key puts the ball
// where s09 left it. Nothing else carries over, so the Air Crowd starts clean.
const K = R / CURL_D.R;
const S09_BALL_SCREEN = {
  x: WIDTH / 2 + (CURL_D.C.x - CURL_D.CAM.x) * CURL_D.CAM.zoom,
  y: HEIGHT / 2 + (CURL_D.C.y - CURL_D.CAM.y) * CURL_D.CAM.zoom,
};
const Z0 = CURL_D.CAM.zoom / K;
const CAM0 = { x: BX - (S09_BALL_SCREEN.x - WIDTH / 2) / Z0, y: BY - (S09_BALL_SCREEN.y - HEIGHT / 2) / Z0, zoom: Z0 };
const S09_MAP = `translate(${BX} ${BY}) scale(${K}) translate(${-CURL_D.C.x} ${-CURL_D.C.y})`;

// Spin push vs weight at launch for the CURLER (same model as the sim: cl = min(0.35, 0.5 * sqrt(spin ratio))).
const V0 = SHOTS.CURLER.speed;
const W0 = SHOTS.CURLER.spin ? len(SHOTS.CURLER.spin) : 0;
const PUSH_N = 0.5 * AIR_DENSITY * BALL.area * V0 * V0 * Math.min(0.35, 0.5 * Math.sqrt(spinRatio(V0, W0)));
const PUSH_RATIO = PUSH_N / (BALL.mass * GRAVITY); // about 0.49: half the weight

const TERM = "Magnus effect";
const MEANING = "the spin push: air shoves a spinning ball sideways, up or down";

export const S10: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s10");
  const B9 = s09Beats(useCues("s09"));

  // Beats, keyed to the exact words.
  const tAir = cue("Air rushes past the ball");
  const tCrowd = cue("like a crowd");
  const tSpinning = cue("spinning");
  const tGrabs = cue("grabs the air");
  const tFlings = cue("flings it");
  const tThrow = cue("Throw air one way");
  const tOneWay = cue("one way");
  const tShoved = cue("shoved");
  const tOther = cue("the other way");
  const tThats = cue("That's the Magnus effect");
  const tMagnus = cue("Magnus effect");
  const tSpinPush = cue("spin push");
  const end = cue.frames;

  // Camera: starts on the s09 framing, settles on the crowd, a slight pull back at the end.
  const keys: CamKey[] = [
    { f: 0, ...CAM0 },
    { f: tCrowd - 20, x: BX, y: BY + 8, zoom: 1.0 },
    { f: tShoved, x: BX + 8, y: BY + 12, zoom: 1.03 },
    { f: end, x: BX + 16, y: BY + 16, zoom: 0.97 },
  ];
  const cam = cameraAt(frame, keys);
  const worldT = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;

  // The ball keeps its spin across the cut, then spins up on "spinning" (to 0.06 rad per frame).
  const k9 = summaryState(B9.end, B9).spinK;
  let spinUp = 0;
  for (let f = 0; f < frame; f++) spinUp += 0.03 * (1 - k9) * progress(f, tSpinning - 14, 18, EASE.soft);
  const spinAngle = summarySpin(B9.end + frame, B9) + spinUp;

  // The crowd: no grab first, then the spinning ball grabs it (cross-fade between two flows).
  const spinMix = progress(frame, tGrabs - 6, 18, EASE.soft);
  // The ball gets shoved to the left.
  const nudge = 40 * progress(frame, tShoved, 34, EASE.standard);
  const bx = BX + PUSH.x * nudge;
  const by = BY + PUSH.y * nudge;
  const dim = 1 - 0.35 * progress(frame, tThats, 20, EASE.soft);

  // Spin ring and lime spin arrows.
  const ringO = progress(frame, tSpinning - 2, 12, EASE.enter);
  const arcT = progress(frame, tSpinning, 16, EASE.enter);
  const arcO = 1 - progress(frame, tThats, 10, EASE.exit);
  // Hug side (left) and early-leave side (right).
  const hugO = progress(frame, tGrabs, 12, EASE.enter) * (1 - progress(frame, tThrow - 6, 10, EASE.exit));
  const leaveO = progress(frame, tGrabs + 8, 12, EASE.enter) * (1 - progress(frame, tThrow - 6, 10, EASE.exit));

  // Pink bump puffs on the right, upstream of the widest point.
  const puffs: React.ReactNode[] = [];
  const puffStart = tGrabs + 8;
  const puffEnd = tShoved;
  for (let k = 0; k < 40; k++) {
    const born = puffStart + k * 6;
    if (born > puffEnd) break;
    const t = (frame - born) / 16;
    if (t <= 0 || t >= 1) continue;
    const a = ((-70 + random(`pf-a-${k}`) * 62) * Math.PI) / 180;
    const rr = R * (1.08 + random(`pf-r-${k}`) * 0.12);
    puffs.push(<Puff key={k} x={bx + Math.cos(a) * rr} y={by + Math.sin(a) * rr} r={20 + random(`pf-s-${k}`) * 10} t={t} seed={`pf${k}`} />);
  }
  // Swirls: break away early on the right and drift down and to the right with the wake.
  const swirls: React.ReactNode[] = [];
  for (let k = 0; k < 30; k++) {
    const born = tGrabs + 14 + k * 10;
    if (born > end - 20) break;
    const t = frame - born;
    if (t < 0 || t > 60) continue;
    const sx = bx + R * 1.02 + t * 2.6 + random(`sw-x-${k}`) * 20;
    const sy = by - 10 + t * 7.2;
    const o = Math.min(1, t / 8) * (1 - t / 60) * dim;
    swirls.push(<Swirl key={k} x={sx} y={sy} r={20 + t * 0.6} angle={t * 9} opacity={o} />);
  }

  // Arrows: the air flung right, the ball shoved left.
  const airT = progress(frame, tFlings, 16, EASE.enter);
  const airO = 1 - progress(frame, tThats + 2, 10, EASE.exit);
  const pushLen = 175 * progress(frame, tShoved - 2, 14, EASE.back);

  // Weight vs spin push panel (screen space): the push arrow is PUSH_RATIO of the weight arrow.
  const PX = 1290;
  const PY = 330;
  const PW = 350;
  const PH = 480;
  const panelS = pop(frame, tOther - 2, { stiffness: 170, damping: 15 });
  const WLEN = 250;
  const weightLen = WLEN * progress(frame, tOther + 2, 14, EASE.back);
  const sideLen = WLEN * PUSH_RATIO * progress(frame, tOther + 10, 14, EASE.back);

  // Chalk pops up at the bottom-right edge and squints at the arrows.
  const chalkS = pop(frame, tThats + 4, { stiffness: 180, damping: 13 });

  // The word card, with three tiny arrows: sideways, up, down.
  const cardUntil = end + 30; // holds to the end of the scene (2.5 s)
  const cardW = Math.max(TERM.length * 36, MEANING.length * 19, 260) + 90;
  const cardS = pop(frame, tMagnus) * (1 - progress(frame, cardUntil, 8, EASE.exit));

  return (
    <Stage bg={XRAY.bg}>
      <g transform={worldT}>
        {/* Grid in s09 units, so it lines up with s09's last frame. */}
        <g transform={S09_MAP}>
          <WorldGrid cx={CURL_D.C.x + (cam.x - BX) / K} cy={CURL_D.C.y + (cam.y - BY) / K} zoom={cam.zoom * K} />
        </g>
        <g opacity={dim}>
          {spinMix < 0.999 ? (
            <AirFlow cx={bx} cy={by} R={R} spin={0} wake={0} rotate={90} count={170} speed={9} spread={R * 5.4} at={2} seed="s10" opacity={1 - spinMix} />
          ) : null}
          {spinMix > 0.001 ? <AirFlow cx={bx} cy={by} R={R} spin={1} rotate={90} count={170} speed={9} spread={R * 5.4} at={2} seed="s10" opacity={spinMix} /> : null}
          {/* Hug side glow (left). */}
          {hugO > 0.001 ? (
            <path
              d={`M${bx + Math.cos((110 * Math.PI) / 180) * R * 1.2},${by + Math.sin((110 * Math.PI) / 180) * R * 1.2} A${R * 1.2},${R * 1.2} 0 0 1 ${bx + Math.cos((250 * Math.PI) / 180) * R * 1.2},${by + Math.sin((250 * Math.PI) / 180) * R * 1.2}`}
              fill="none"
              stroke={XRAY.lime}
              strokeWidth={R * 0.34}
              strokeLinecap="round"
              opacity={0.22 * hugO}
            />
          ) : null}
          {/* Early-leave side glow (right, upstream of the widest point). */}
          {leaveO > 0.001 ? (
            <path
              d={`M${bx + Math.cos((-80 * Math.PI) / 180) * R * 1.2},${by + Math.sin((-80 * Math.PI) / 180) * R * 1.2} A${R * 1.2},${R * 1.2} 0 0 1 ${bx + Math.cos((10 * Math.PI) / 180) * R * 1.2},${by + Math.sin((10 * Math.PI) / 180) * R * 1.2}`}
              fill="none"
              stroke={XRAY.pink}
              strokeWidth={R * 0.3}
              strokeLinecap="round"
              opacity={0.2 * leaveO}
            />
          ) : null}
          {swirls}
          {/* A thin ring of air turning with the ball. */}
          {ringO > 0.001
            ? Array.from({ length: 14 }, (_, i) => {
                const a = (i / 14) * Math.PI * 2 - spinAngle;
                return <circle key={i} cx={bx + Math.cos(a) * R * 1.12} cy={by + Math.sin(a) * R * 1.12} r={7} fill={XRAY.air} opacity={0.9 * ringO} />;
              })
            : null}
          {/* The grabbed air on the left wraps far round the back. */}
          <Arrow x1={bx - 250} y1={by - 290} x2={bx + 60} y2={by + 330} at={tGrabs + 2} until={tThrow - 6} color={XRAY.lime} width={11} curve={-0.42} dur={18} />
        </g>
        <Ball cx={bx} cy={by} r={R} view={TOP} axis={{ x: 0, y: 0, z: 1 }} angle={spinAngle} lineNormal={LINE_N} showBack />
        <g opacity={dim}>{puffs}</g>
        <ArcArrow cx={bx} cy={by} r={R + 58} a0={-40} a1={-140} t={arcT} opacity={arcO} width={15} />
        {/* The air is flung to the right: a big air arrow on the wake. */}
        {airT > 0.001 && airO > 0.001 ? (
          <g opacity={airO}>
            <Arrow x1={bx + 70} y1={by + 190} x2={bx + 70 + 245 * airT} y2={by + 190 + 285 * airT} at={tFlings} dur={1} color={XRAY.air} width={30} curve={0.08} />
          </g>
        ) : null}
        <Label x={bx + 410} y={by + 395} text="air" at={tFlings + 10} until={tThats + 2} size={44} bg={XRAY.air} color={XRAY.bg} />
        {/* The ball is shoved the other way: the spin push. */}
        <ForceArrow x={bx - R - 18} y={by} angle={180} len={pushLen} color={XRAY.ball} width={28} />
        <Label x={bx - R - 165} y={by - 80} text="spin push" at={tSpinPush} size={44} bg={XRAY.ball} color={XRAY.bg} />
      </g>

      <SkateInset x={70} y={620} w={560} h={400} at={tThrow - 6} throwAt={tOneWay + 6} until={tThats + 4} />

      {/* Weight vs spin push: two arrows, no digits. */}
      {panelS > 0.001 ? (
        <g transform={`translate(${PX + PW / 2} ${PY + PH / 2}) scale(${panelS}) translate(${-PX - PW / 2} ${-PY - PH / 2})`}>
          <rect x={PX} y={PY} width={PW} height={PH} rx={40} fill="#0A2C38" opacity={0.94} />
          <g transform={`translate(${PX + 215} ${PY + 90})`}>
            <circle r={36} fill={XRAY.ball} />
            <circle cx={7} cy={7} r={29} fill="#D95A22" opacity={0.35} />
            <ForceArrow x={0} y={44} angle={90} len={weightLen} color={XRAY.bone} width={22} />
            <ForceArrow x={-44} y={0} angle={180} len={sideLen} color={XRAY.ball} width={22} />
            <text x={0} y={WLEN + 116} fill={XRAY.bone} fontFamily={FONTS.label} fontWeight={800} fontSize={40} textAnchor="middle" opacity={progress(frame, tOther + 8, 10)}>
              weight
            </text>
          </g>
        </g>
      ) : null}

      {/* Chalk squints at the arrows. */}
      {chalkS > 0.001 ? (
        <Keeper x={1800} groundY={1190 + (1 - Math.min(1, chalkS)) * 300} h={430} pose={{ ...KPOSES.crossed, lean: -8 + idle(frame, 1, 2, 1.5) }} face="annoyed" look={-1} />
      ) : null}

      <WordCard term={TERM} meaning={MEANING} at={tMagnus} until={cardUntil} />
      {cardS > 0.001 ? (
        <g transform={`translate(${WIDTH - 60} 90) scale(${cardS}) translate(${-cardW} 0)`}>
          <g transform={`translate(${cardW - 112} 80)`}>
            {[
              { a: 180, l: 56, at: tMagnus + 10 },
              { a: -90, l: 40, at: tMagnus + 14 },
              { a: 90, l: 40, at: tMagnus + 18 },
            ].map((d, i) => (
              <ForceArrow key={i} x={Math.cos((d.a * Math.PI) / 180) * 14} y={Math.sin((d.a * Math.PI) / 180) * 14} angle={d.a} len={d.l * Math.min(1.1, pop(frame, d.at, { stiffness: 220, damping: 14 }))} color={XRAY.ball} width={11} />
            ))}
            <circle r={12} fill={PITCH.sky} opacity={progress(frame, tMagnus + 8, 6)} />
          </g>
        </g>
      ) : null}

      {/* SFX */}
      <Sfx name="air" at={tAir} volume={0.3} dur={120} />
      <Sfx name="air" at={tGrabs - 20} volume={0.2} dur={120} />
      <Sfx name="pop-soft" at={tSpinning} volume={0.35} />
      {[8, 22, 36, 50].map((d) => (
        <Sfx key={d} name="pop-soft" at={tGrabs + d} volume={0.22} />
      ))}
      <Sfx name="whoosh" at={tFlings} volume={0.4} />
      <Sfx name="pop-soft" at={tThrow - 6} volume={0.3} />
      <Sfx name="whoosh" at={tOneWay + 6} volume={0.3} />
      <Sfx name="whoosh-long" at={tOneWay + 8} volume={0.2} />
      <Sfx name="pop" at={tShoved - 2} volume={0.3} />
      <Sfx name="pop" at={tOther - 2} volume={0.28} />
      <Sfx name="chalk" at={tThats + 4} volume={0.4} />
      <Sfx name="bell" at={tMagnus} volume={0.3} />
      <Sfx name="pop-soft" at={tMagnus + 12} volume={0.25} />
      <Sfx name="pop" at={tSpinPush} volume={0.3} />
    </Stage>
  );
};
