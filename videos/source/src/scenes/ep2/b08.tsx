// b08 LOOK practice. The board rises over the frozen map from b07. Three cue chips on top. Panel A (side
// view): the classic mistake, eyes glued to the ball while Chalk creeps in behind her, the pink ring only
// when she looks up (0.3 s); then the fix, the same pass with the head turning on the kick frame and a
// polaroid per scan. Panel B (top-down): the colour-call drill, DRILL_PASSES 10 m at 5.5 m/s in slow
// motion: Sam calls WHITE, she looks back, calls RIGHT at 0.8 s with the ball short of halfway, a tally
// (early call counts; a ghost rep with the call after halfway does not), one step to meet the ball. Notes
// and the safety line below (the safety line from the drill's start). The board holds to the last frame.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, Camera, type CamKey } from "../../kit/Camera";
import { Dust } from "../../kit/World";
import { Player, SAM_COLORS, poseAt, solve, type Pose } from "../../kit/Player";
import { Keeper, keeperPoseAt } from "../../kit/Keeper";
import { Ball } from "../../kit/Ball";
import { TopPlayer } from "../../kit/TopPlayer";
import { TopField } from "../../kit/Field";
import { Snapshot } from "../../kit/Snapshot";
import { TimeBubble } from "../../kit/TimeBubble";
import { Bubble, Label, PracticeBoard, Stamp } from "../../kit/Graphics";
import { Sfx } from "../../kit/Sfx";
import { useCues } from "../../lib/timing";
import { EASE, clamp01, idle, popSoft, progress, visible } from "../../lib/anim";
import { type View } from "../../lib/project";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import { DRILLS, SAM, chalkAt, lookStepMeet, passInAt, passInTimeToX, ringSeconds, LOOK_STEP } from "../../physics/ep2sims";
import { rollAt } from "../../physics/touch";
import { CamFlash, ChalkPhoto, ChalkX, EyeIcon, Footprint, PassWorld, S, scanLook } from "../../kit/ext/ep2-b06-b08-map";
import { ConeTop, CueChips, NoteLine, RingIcon, SafetyLine, SlowPill, TallyRow } from "../../kit/ext/ep2-b06-b08-parts";

// ---------- Board layout ----------
const PA = { x: 130, y: 240, w: 1660, h: 280 };
const PB = { x: 130, y: 536, w: 1660, h: 314 };
const GA = PA.y + 250; // ground line of the side view
const A_PPM = 100;
const TAVI_X = 1450; // her hip (sim x = 0)
const SIDE: View = { kind: "side", originX: TAVI_X, groundY: GA, ppm: A_PPM };
const AX = (m: number) => TAVI_X + m * A_PPM;
const H_T = 1.62 * A_PPM;
const H_K = 2.1 * A_PPM;
const BALL_A = 13;
const LINE_N = { x: 0.92, y: 0.25, z: 0.3 };
// Drill panel (top view): Sam on the left, Tavi 10 m right, cones 5 m behind her, 2 m each side.
const B_PPM = 62;
const B_ORIGIN = { x: 250, y: PB.y + PB.h / 2 };
const DRILL_VIEW: View = { kind: "top", originX: B_ORIGIN.x, originY: B_ORIGIN.y, ppm: B_PPM };
const BX = (m: number) => B_ORIGIN.x + m * B_PPM;
const BY = (m: number) => B_ORIGIN.y - m * B_PPM;
const DRILL = DRILLS.b08;
const CONE_BACK = 5;
const CONE_SIDE = 2;
const SLOW = 0.27;
const NOTE_X = 150;
/** The tally sits on a dark pill in the empty pitch right of the cones, under the DRILL stamp. */
const TALLY_X = 1300;
const TALLY_Y = 690;
/** The ghost rep's lane: a little below the real pass line, so the two balls never overlap. */
const GHOST_LANE = -0.75;
const MEET = lookStepMeet();
/** Mistake panel: Chalk pulls up this far in front of her dead-stopped ball (metres from her mark). */
const CHALK_STOP = 1.0;
/** Seconds of his run to that stop (11 m to the mark, 4 m/s). */
const CHALK_STOP_T = (11 - CHALK_STOP) / 4;

/** Seconds a rolling pass (rollAt) needs to cover `d` metres. */
const timeToRoll = (speed: number, d: number) => {
  let lo = 0;
  let hi = 6;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (rollAt(speed, mid).x < d) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

/** Head centre of a Player, for eye-lines (side view, hip at x). */
const headOf = (pose: Pose, H: number, x: number, groundY: number, flip: boolean) => {
  const j = solve(pose, H);
  const dy = groundY - j.lowest - (pose.lift ?? 0) * H;
  return { x: x + (flip ? -j.headC.x : j.headC.x), y: j.headC.y + dy, r: j.headR };
};

/** Time when the drill pass meets Tavi, who steps towards it at 2 m/s from 1.5 s. */
const drillMeet = (() => {
  let lo = LOOK_STEP.leaveAt;
  let hi = 4;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const tavi = DRILL.distance - (mid - LOOK_STEP.leaveAt) * LOOK_STEP.speed;
    if (rollAt(DRILL.speed, mid).x < tavi) lo = mid;
    else hi = mid;
  }
  const t = (lo + hi) / 2;
  return { t, x: DRILL.distance - (t - LOOK_STEP.leaveAt) * LOOK_STEP.speed };
})();

export const B08: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b08");

  // Beats.
  const tMistake = cue("mistake");
  const tFix = cue("Fix");
  const tFoot = cue("foot");
  const tHead = cue("head goes");
  const tTwo = cue("Two coloured cones");
  const tCones = cue("cones");
  const tBehind = cue("behind you");
  const tCalls = cue("calls one");
  const tLookBack = cue("Look back");
  const tShout = cue("shout");
  const tCall = cue("call");
  const tDoesnt = cue("Doesn't count");
  const tSlow = cue("Slow passes first");
  const tLate = cue("Late call");
  const END = cue.frames;

  // ---------- Panel A: the mistake, then the fix ----------
  const KA1 = 16;
  const tauA1 = Math.max(0, (frame - KA1) / 30);
  const arrive1 = passInTimeToX(-0.35);
  const lookUp = KA1 + Math.round((arrive1 + 0.28) * 30); // she looks up about 0.3 s after the dead stop
  // The fix crossfades over the mistake around the FIX stamp (no empty panel between them).
  const mistakeOut = 1 - progress(frame, tFix - 4, 7, EASE.exit);
  const fixIn = progress(frame, tFix - 3, 9, EASE.enter);
  const KA2 = tFoot;
  const dimAt = tTwo;
  const tauA2 = Math.max(0, (Math.min(frame, dimAt) - KA2) / 30);
  const dimA = 1 - 0.5 * progress(frame, dimAt, 12, EASE.standard);

  // ---------- Panel B: the drill ----------
  const KB = tCalls - 2;
  const tauBRaw = Math.max(0, ((frame - KB) * SLOW) / 30);
  const tauB = Math.min(tauBRaw, drillMeet.t);
  const meetB = KB + Math.round((drillMeet.t * 30) / SLOW);
  const fAt = (t: number) => KB + Math.round((t * 30) / SLOW);
  const snapB = fAt(0.3);
  const callAt = fAt(0.8);
  const stepAt = fAt(LOOK_STEP.leaveAt);
  const kickedB = frame >= KB;
  const taviBx = tauB >= LOOK_STEP.leaveAt ? Math.max(drillMeet.x, DRILL.distance - (tauB - LOOK_STEP.leaveAt) * LOOK_STEP.speed) : DRILL.distance;
  const ballBx = kickedB ? Math.min(rollAt(DRILL.speed, tauB).x, taviBx - 0.7) : 0.4;
  const lookB = kickedB ? scanLook(tauB, 0.1, 0.5, -120) : 0;
  const samKickB = progress(frame, KB - 8, 8, EASE.enter) * (1 - progress(frame, KB + 2, 12, EASE.standard));
  // The ghost rep for "Late call? Doesn't count.": the same pass at real speed, the call only after halfway.
  const gK = tLate - 11;
  const gHalf = gK + Math.round(timeToRoll(DRILL.speed, DRILL.distance / 2) * 30);
  const gCall = gHalf + 3;
  const gT = Math.max(0, (frame - gK) / 30);
  const ghostX = rollAt(DRILL.speed, gT).x;
  const ghostO = frame < gK ? 0 : 0.55 * progress(frame, gK, 4) * (1 - progress(frame, tDoesnt + 6, 10, EASE.exit));

  // ---------- Notes: one row changes at a time, each new line 8+ frames after the last one's exit ----------
  const noteTwo = { at: tBehind + 4, until: callAt + 10 };
  const noteCall = { at: noteTwo.until + 10, until: tSlow - 12 };
  const noteSlow = tSlow - 3;
  const noteSwap = { at: tLookBack + 10, until: tCall - 12 };
  const noteWall = noteSwap.until + 10;
  const safetyAt = tTwo + 12;
  // The population caption sits on the dimmed fix panel once the fix is done: one coaching sentence.
  const captionAt = KA2 + 38;

  // Backdrop: the frozen end of b07 (the same camera), dimmed under the board. As the board rises the map
  // drifts right so Sam's token slides behind the board's left edge, and the name tags fade.
  const backCam: CamKey[] = [
    { f: 0, x: 980, y: 612, zoom: 1.16 },
    { f: 26, x: 912, y: 612, zoom: 1.16 },
  ];
  const backLabels = 0.9 * (1 - progress(frame, 0, 12, EASE.standard));
  // The held map keeps b07's clock, so its idle motion carries on through the cut without a jump.
  const heldF = frame + useCues("b07").frames;
  const chalkEnd = chalkAt(MEET.t);
  const tqEnd = S(MEET.x, 0);
  const bqEnd = S(MEET.x - 0.75, 0);
  const markEnd = S(0, 0);
  const stepEnd = S(-0.5, -0.15);

  return (
    <Stage bg={PITCH.grassDark}>
      {/* The last frame of b07, held: the same world, mark, footprint, eye and ring, so the cut is seamless. */}
      <Camera keys={backCam}>
        <PassWorld frame={heldF} tau={MEET.t} tavi={{ x: MEET.x, y: 0, facing: 180, look: 0 }} ball={{ x: MEET.x - 0.75, y: 0 }} rolled={MEET.x - SAM.x} fan={{ darken: false, radius: 700, at: -20 }} labels labelOpacity={backLabels}>
          <ChalkX x={markEnd.x} y={markEnd.y} />
          <Footprint x={stepEnd.x} y={stepEnd.y} angle={180} />
          {[-7, 7].map((dy) => (
            <line key={dy} x1={tqEnd.x - 34} y1={tqEnd.y + dy} x2={bqEnd.x + 18} y2={bqEnd.y + dy * 0.4} stroke={XRAY.lime} strokeWidth={3} strokeDasharray="6 10" strokeLinecap="round" opacity={0.7} />
          ))}
        </PassWorld>
        <EyeIcon x={bqEnd.x} y={bqEnd.y - 44} at={heldF - frame - 120} frame={heldF} size={24} />
        <TimeBubble x={tqEnd.x} y={tqEnd.y} seconds={ringSeconds(chalkEnd.x, chalkEnd.y, MEET.x, 0)} at={-120} pxPerSecond={95} minRadius={40} maxRadius={270} fontSize={38} />
      </Camera>
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={PITCH.skyHigh} opacity={0.35 * progress(frame, 0, 12)} />

      {/* The board holds to the last frame, so the frozen map never comes back before the cut to b09. */}
      <PracticeBoard at={0} until={END + 30}>
        <defs>
          <clipPath id="b08-pa">
            <rect x={PA.x} y={PA.y} width={PA.w} height={PA.h} rx={36} />
          </clipPath>
          <clipPath id="b08-pb">
            <rect x={PB.x} y={PB.y} width={PB.w} height={PB.h} rx={36} />
          </clipPath>
        </defs>
        <CueChips frame={frame} y={200} at={6} cues={["Ball leaves, head goes", "Look again halfway", "Snapshot, not a stare"]} lit={[KA2 + 11, KA2 + 35, KA2 + 13]} />
        {/* The board's ring: pink with the mistake's ring, lime on the early call (with the tally tick). */}
        <RingIcon x={1752} y={200} at={lookUp + 2} limeAt={callAt + 6} frame={frame} size={1.45} />

        {/* ---------- Panel A ---------- */}
        <g opacity={dimA}>
          <rect x={PA.x} y={PA.y} width={PA.w} height={PA.h} rx={36} fill="#16324B" />
          <g clipPath="url(#b08-pa)">
            <rect x={PA.x} y={GA} width={PA.w} height={PA.y + PA.h - GA} fill={PITCH.grassDark} />
            <rect x={PA.x} y={GA - 3} width={PA.w} height={6} fill={PITCH.grassLight} opacity={0.6} />
            <MistakeStrip frame={frame} K={KA1} tau={tauA1} lookUp={lookUp} opacity={mistakeOut} arrive={arrive1} />
            <FixStrip frame={frame} K={KA2} tau={tauA2} opacity={fixIn} frozen={frame >= dimAt} />
          </g>
          <Stamp kind="MISTAKE" x={960} y={290} at={tMistake} until={tFix - 6} />
          <Stamp kind="FIX" x={960} y={290} at={tFix} />
        </g>
        {/* Population caption, on the fix panel once the fix is done (it stays bright when the panel dims). */}
        {(() => {
          const o = visible(frame, captionAt, undefined, 12);
          if (o <= 0.001) return null;
          const lines = [
            { t: "One coaching sentence:", c: PITCH.chalk },
            { t: "about a quarter more looks", c: XRAY.lime },
            { t: "elite youth women, 4v4", c: PITCH.lightSoft },
          ];
          return (
            <g opacity={o} transform={`translate(${(1 - o) * -20} 0)`}>
              <rect x={372} y={318} width={500} height={146} rx={26} fill={PITCH.skyHigh} opacity={0.9} />
              {lines.map((l, i) => (
                <text key={i} x={398} y={362 + i * 42} fill={l.c} fontFamily={FONTS.label} fontWeight={800} fontSize={i === 2 ? 32 : 34}>
                  {l.t}
                </text>
              ))}
            </g>
          );
        })()}

        {/* ---------- Panel B: the drill pitch waits dimmed under the mistake and the fix, then lights up. ---------- */}
        {(() => {
          const lit = progress(frame, tTwo - 2, 10, EASE.enter);
          return (
          <g opacity={0.45 + 0.55 * lit}>
            <rect x={PB.x} y={PB.y} width={PB.w} height={PB.h} rx={36} fill="#16324B" />
            <g clipPath="url(#b08-pb)">
              <TopField view={DRILL_VIEW} x0={-3} x1={27.5} y0={-4} y1={4} lines={false} stripeM={2.5} />
              <rect x={PB.x} y={PB.y} width={PB.w} height={PB.h} fill={PITCH.skyHigh} opacity={0.35 * (1 - lit)} />
              {/* Halfway mark, its label tucked at the bottom left of the line. */}
              {(() => {
                const t = progress(frame, tShout + 4, 12, EASE.enter);
                if (t <= 0.001) return null;
                const x = BX(DRILL.distance / 2);
                return (
                  <g>
                    <line x1={x} y1={BY(2.3)} x2={x} y2={BY(2.3) + (BY(-2.3) - BY(2.3)) * t} stroke={PITCH.chalk} strokeWidth={6} strokeDasharray="14 12" strokeLinecap="round" opacity={0.85} />
                    <Label x={x - 100} y={BY(-1.95)} text="halfway" at={tShout + 10} size={32} />
                  </g>
                );
              })()}
              {/* Cones behind her: white on her right (up), orange on her left (down). */}
              <ConeTop x={BX(DRILL.distance + CONE_BACK)} y={BY(CONE_SIDE)} color={PITCH.chalk} at={tCones} frame={frame} />
              <ConeTop x={BX(DRILL.distance + CONE_BACK)} y={BY(-CONE_SIDE)} color={PITCH.accent} at={tBehind} frame={frame} />
              {/* Her mark and the one step. */}
              {frame >= stepAt ? <Footprint x={BX(DRILL.distance - 0.4)} y={BY(-0.1)} angle={180} scale={popSoft(frame, stepAt) * 0.9} /> : null}
              {/* Sam and Tavi wait on the drill pitch from the start. */}
              <g transform={`translate(${BX(-0.5 + 0.3 * samKickB)} ${BY(0)}) scale(${popSoft(frame, 10)})`}>
                <TopPlayer x={0} y={0} size={54} kind="sam" facing={idle(frame, 2, 4, 2)} />
              </g>
              {kickedB ? (
                <g>
                  <ellipse cx={BX(ballBx) + 2} cy={BY(0) + 3} rx={14} ry={11} fill="#000" opacity={0.22} />
                  <Ball cx={BX(ballBx)} cy={BY(0)} r={13} view={DRILL_VIEW} axis={{ x: 0, y: -1, z: 0 }} angle={ballBx / 0.11} lineNormal={{ x: 0.3, y: 0.2, z: 0.93 }} />
                </g>
              ) : (
                <Ball cx={BX(0.4)} cy={BY(0)} r={13} view={DRILL_VIEW} lineNormal={{ x: 0.3, y: 0.2, z: 0.93 }} angle={idle(frame, 1, 3, 0.2)} />
              )}
              <g transform={`translate(${BX(taviBx)} ${BY(0)}) scale(${popSoft(frame, 14) * (1 + idle(frame, 1, 2.8, 0.012))})`}>
                <TopPlayer x={0} y={0} size={58} kind="tavi" facing={180} look={lookB} cone={{ angleDeg: 200, radius: 260, opacity: 0.1 }} />
              </g>
              {/* The snapshot of the white cone: by her head, on the white cone's side, short of the cone. */}
              <g transform={`translate(${BX(taviBx) + 180} ${BY(1.5)})`}>
                <Snapshot x={0} y={0} w={150} h={100} at={snapB} until={tCall - 4} tilt={-6}>
                  <ChalkPhoto w={150} h={100} cone={PITCH.chalk} />
                </Snapshot>
              </g>
              <CamFlash at={snapB} frame={frame} strength={0.3} />
              {/* Calls: Sam's from below him, hers from the passer's side of her head. */}
              <Bubble x={BX(1.6)} y={BY(-1.9)} tx={BX(0.1)} ty={BY(-0.6)} text="WHITE!" at={KB + 2} until={tLookBack + 10} size={40} />
              <Bubble x={BX(taviBx) - 150} y={BY(1.7)} tx={BX(taviBx) - 20} ty={BY(0.5)} text="RIGHT!" at={callAt} until={tCall - 4} size={40} />
              {/* The ghost rep: the same pass at real speed, a faint ball past halfway, then a late, greyed call. */}
              {ghostO > 0.001 ? (
                <g opacity={ghostO}>
                  <line x1={BX(0.4)} y1={BY(GHOST_LANE)} x2={BX(ghostX) - 16} y2={BY(GHOST_LANE)} stroke={PITCH.chalk} strokeWidth={3} strokeDasharray="6 10" strokeLinecap="round" opacity={0.7} />
                  <circle cx={BX(ghostX)} cy={BY(GHOST_LANE)} r={13} fill={PITCH.lightSoft} />
                  <circle cx={BX(ghostX)} cy={BY(GHOST_LANE)} r={13} fill="none" stroke={PITCH.chalk} strokeWidth={3} />
                </g>
              ) : null}
              <g opacity={0.6}>
                <Bubble x={BX(taviBx) - 110} y={BY(-1.85)} tx={BX(taviBx) - 22} ty={BY(-0.5)} text="RIGHT!" at={gCall} until={tDoesnt + 12} size={40} />
              </g>
            </g>
            <SlowPill x={PB.x + 20} y={PB.y + 16} at={KB} frame={frame} />
            <Stamp kind="DRILL" x={1690} y={PB.y + 54} at={tTwo} />
            {/* Tally, on a dark pill: the early call counts, the late one does not. */}
            {(() => {
              const s = popSoft(frame, callAt + 4);
              if (s <= 0.001) return null;
              // One row high for the early call, two once the late call joins it.
              const h = 76 + 56 * Math.min(1, popSoft(frame, tCall - 2));
              return <rect x={TALLY_X - 40} y={TALLY_Y - 44} width={500} height={h} rx={30} fill={PITCH.skyHigh} opacity={0.88 * Math.min(1, s)} />;
            })()}
            <TallyRow frame={frame} x={TALLY_X} y={TALLY_Y} text="called before halfway" at={callAt + 6} kind="tick" />
            <TallyRow frame={frame} x={TALLY_X} y={TALLY_Y + 56} text="called after halfway" at={tCall} kind="cross" markAt={tDoesnt} />
          </g>
          );
        })()}

        {/* ---------- Notes ---------- */}
        <NoteLine frame={frame} x={NOTE_X} y={896} text="Two cones 5 m behind you, 2 m each side." at={noteTwo.at} until={noteTwo.until} dot={PITCH.light} />
        <NoteLine frame={frame} x={NOTE_X} y={896} text="Call it, then step to meet the ball. Never wait for it." at={noteCall.at} until={noteCall.until} dot={XRAY.lime} />
        <NoteLine frame={frame} x={NOTE_X} y={896} text="Slow passes first. Add pace only when the call is always early." at={noteSlow} dot={PITCH.light} />
        <NoteLine frame={frame} x={NOTE_X} y={942} text="Swap the cones every few passes. Ten looks over each shoulder, then swap roles." at={noteSwap.at} until={noteSwap.until} size={34} color={PITCH.lightSoft} />
        <NoteLine frame={frame} x={NOTE_X} y={942} text="No friend? Wall pass: look back on the kick, call one thing you see behind you." at={noteWall} size={34} color={PITCH.lightSoft} />
        <SafetyLine frame={frame} x={NOTE_X} y={992} text="Flat grass, away from roads and parked cars. Jog and pass easy for 5 minutes first." at={safetyAt} />
      </PracticeBoard>

      {/* Sound. */}
      <Sfx name="whoosh" at={0} volume={0.35} />
      <Sfx name="pop-soft" at={8} volume={0.25} />
      <Sfx name="thump" at={KA1} volume={0.35} />
      <Sfx name="stamp" at={tMistake} volume={0.45} />
      {Array.from({ length: 4 }, (_, i) => (
        <Sfx key={`c${i}`} name="chalk" at={KA1 + 60 + i * 8} volume={0.18} dur={20} />
      ))}
      <Sfx name="thump" at={KA1 + Math.round(arrive1 * 30)} volume={0.3} />
      <Sfx name="alarm" at={lookUp + 2} volume={0.28} />
      <Sfx name="stamp" at={tFix} volume={0.45} />
      <Sfx name="thump" at={KA2} volume={0.35} />
      <Sfx name="tick" at={KA2 + 9} volume={0.45} />
      <Sfx name="tick" at={KA2 + 32} volume={0.4} />
      <Sfx name="pop" at={tHead} volume={0.25} />
      <Sfx name="stamp" at={tTwo} volume={0.45} />
      <Sfx name="pop-soft" at={safetyAt} volume={0.2} />
      <Sfx name="pop" at={tCones} volume={0.35} />
      <Sfx name="pop" at={tBehind} volume={0.35} />
      <Sfx name="thump" at={KB} volume={0.4} />
      <Sfx name="pop" at={KB + 2} volume={0.35} />
      <Sfx name="tick" at={snapB} volume={0.5} />
      <Sfx name="pop" at={callAt} volume={0.4} />
      <Sfx name="tick" at={callAt + 8} volume={0.35} />
      <Sfx name="blip" at={callAt + 7} volume={0.25} />
      <Sfx name="chalk" at={tShout + 4} volume={0.3} />
      <Sfx name="pop-soft" at={tCall} volume={0.3} />
      <Sfx name="whoosh" at={gK} volume={0.15} />
      <Sfx name="pop-soft" at={gCall} volume={0.2} />
      <Sfx name="blip" at={tDoesnt} volume={0.35} />
      <Sfx name="pop-soft" at={stepAt} volume={0.35} />
      <Sfx name="thump" at={meetB} volume={0.4} />
      <Sfx name="pop-soft" at={noteWall} volume={0.2} />
      <Sfx name="pop-soft" at={noteSlow} volume={0.3} />
    </Stage>
  );
};

/** Panel A, the mistake: eyes glued to the ball, Chalk creeps in, the pink ring only when she looks up. */
const MistakeStrip: React.FC<{ frame: number; K: number; tau: number; lookUp: number; opacity: number; arrive: number }> = ({ frame, K, tau, lookUp, opacity, arrive }) => {
  if (opacity <= 0.001) return null;
  const arriveF = K + Math.round(arrive * 30);
  const ballX = frame < K ? SAM.x : Math.max(passInAt(tau).x, -0.35) > -0.35 ? passInAt(tau).x : -0.35;
  const bx = Math.min(passInAt(tau).x, -0.35);
  const ball = { x: AX(frame < K ? SAM.x : bx), y: GA - BALL_A };
  void ballX;
  const samPose = poseAt(frame, [
    [K - 14, "receiveReady"],
    [K - 5, "plant"],
    [K, "passInside"],
    [K + 12, "stand"],
  ]);
  const taviPoseRaw = poseAt(frame, [
    [arriveF - 6, "receiveReady"],
    [arriveF, "receiveSoft"],
    [lookUp, "receiveSoft"],
    [lookUp + 8, "lookBack"],
  ]);
  const taviPose: Pose = { ...taviPoseRaw, torso: taviPoseRaw.torso + idle(frame, 3, 3, 0.8) };
  const headTurn = progress(frame, lookUp, 8, EASE.standard);
  const head = headOf(taviPose, H_T, TAVI_X, GA, true);
  // Chalk runs his usual line and pulls up a metre in front of her (never on top of her).
  const chalk = chalkAt(Math.min(tau, CHALK_STOP_T));
  const chalkX = AX(chalk.x);
  const arrivedF = K + Math.round(CHALK_STOP_T * 30);
  const running = frame < arrivedF;
  const cycle = Math.floor(frame / 5) % 2 === 0 ? "runA" : "runB";
  const kPose = keeperPoseAt(frame, [
    [arrivedF - 6, running ? cycle : "runA"],
    [arrivedF + 2, "puffed"],
    [arrivedF + 12, "stand"],
  ]);
  const kPoseNow = running ? keeperPoseAt(frame, [[frame - 3, cycle], [frame + 3, cycle === "runA" ? "runB" : "runA"]]) : kPose;
  const eyesOnBall = frame >= K && frame < lookUp;
  const ringS = ringSeconds(chalk.x, chalk.y, bx, 0);
  const ringVisible = frame >= lookUp + 2;
  return (
    <g opacity={opacity}>
      <Player x={AX(SAM.x)} groundY={GA} h={H_T} pose={samPose} colors={SAM_COLORS} footTurn={frame >= K - 5 && frame < K + 8 ? 1 : 0} />
      {chalk.x < 4 ? (
        <>
          <Keeper x={chalkX} groundY={GA} h={H_K} pose={kPoseNow} face={running ? "flat" : "smug"} flip look={-0.6} />
          {running ? <Dust x={chalkX + 20} y={GA} at={Math.floor(frame / 10) * 10} size={26} seed={`k${Math.floor(frame / 10)}`} /> : null}
        </>
      ) : null}
      <Ball cx={ball.x} cy={ball.y} r={BALL_A} view={SIDE} axis={{ x: 0, y: -1, z: 0 }} angle={(bx - SAM.x) / 0.11} lineNormal={LINE_N} />
      <Player x={TAVI_X} groundY={GA} h={H_T} pose={taviPose} face={frame >= lookUp + 4 ? "wince" : "focus"} flip headTurn={headTurn} />
      {/* Two dotted eye-lines glued to the ball. */}
      {eyesOnBall ? (
        <g opacity={progress(frame, K, 6)}>
          {[-5, 5].map((d) => (
            <line key={d} x1={head.x - head.r * 0.5} y1={head.y + d} x2={ball.x + 8} y2={ball.y - 4 + d * 0.3} stroke={CAST.mistake} strokeWidth={3} strokeDasharray="5 9" strokeLinecap="round" opacity={0.85} />
          ))}
        </g>
      ) : null}
      {ringVisible ? (
        <>
          <TimeBubble x={ball.x + 20} y={GA - 4} seconds={Math.max(0, ringS)} at={lookUp + 2} squash={0.36} showNumber={false} pxPerSecond={220} minRadius={70} alarm />
          <Label x={TAVI_X - 185} y={PA.y + 62} text={`${Math.max(0, ringS).toFixed(1)} s`} at={lookUp + 2} size={34} bg={CAST.mistake} color={PITCH.chalk} font={FONTS.mono} />
        </>
      ) : null}
    </g>
  );
};

/** Panel A, the fix: the same pass, the head goes on the kick frame, a polaroid per scan, eyes back at 1.2 s. */
const FixStrip: React.FC<{ frame: number; K: number; tau: number; opacity: number; frozen: boolean }> = ({ frame, K, tau, opacity, frozen }) => {
  if (opacity <= 0.001) return null;
  const bx = frame < K ? SAM.x : passInAt(tau).x;
  const ball = { x: AX(bx), y: GA - BALL_A };
  const samPose = poseAt(frame, [
    [K - 14, "receiveReady"],
    [K - 5, "plant"],
    [K, "passInside"],
    [K + 12, "stand"],
  ]);
  const raw = poseAt(frame, [[K - 20, "stand"], [K - 8, "receiveReady"]]);
  const taviPose: Pose = { ...raw, torso: raw.torso + idle(frame, 3, 3, 0.8) };
  const headTurn = clamp01(scanLook(tau, 0.1, 0.5, 1) + scanLook(tau, 0.9, 1.2, 1));
  const head = headOf(taviPose, H_T, TAVI_X, GA, true);
  const snap1 = K + 9;
  const snap2 = K + 32;
  const eyesBack = K + 36;
  const chalk = chalkAt(tau);
  const cycle = Math.floor(frame / 5) % 2 === 0 ? "runA" : "runB";
  const kPose = frozen ? keeperPoseAt(0, [[0, "runA"]]) : keeperPoseAt(frame, [[frame - 3, cycle], [frame + 3, cycle === "runA" ? "runB" : "runA"]]);
  return (
    <g opacity={opacity}>
      <Player x={AX(SAM.x)} groundY={GA} h={H_T} pose={samPose} colors={SAM_COLORS} footTurn={frame >= K - 5 && frame < K + 8 ? 1 : 0} />
      {chalk.x < 4 ? <Keeper x={AX(chalk.x)} groundY={GA} h={H_K} pose={kPose} face="flat" flip look={-0.6} /> : null}
      <Ball cx={ball.x} cy={ball.y} r={BALL_A} view={SIDE} axis={{ x: 0, y: -1, z: 0 }} angle={(bx - SAM.x) / 0.11} lineNormal={LINE_N} />
      <Player x={TAVI_X} groundY={GA} h={H_T} pose={taviPose} face="focus" flip headTurn={headTurn} />
      {frame >= eyesBack ? (
        <g opacity={progress(frame, eyesBack, 6)}>
          {[-5, 5].map((d) => (
            <line key={d} x1={head.x - head.r * 0.5} y1={head.y + d} x2={ball.x + 8} y2={ball.y - 4 + d * 0.3} stroke={XRAY.lime} strokeWidth={3} strokeDasharray="5 9" strokeLinecap="round" opacity={0.85} />
          ))}
        </g>
      ) : null}
      {/* A polaroid per scan, by her head. */}
      <g transform={`translate(${TAVI_X - 150} ${PA.y + 100})`}>
        <Snapshot x={0} y={0} w={150} h={100} at={snap1} until={snap2 - 2} tilt={-7}>
          <ChalkPhoto w={150} h={100} facing={200} />
        </Snapshot>
        <Snapshot x={0} y={0} w={150} h={100} at={snap2} until={frozen ? undefined : undefined} tilt={5}>
          <ChalkPhoto w={150} h={100} arrow stride={0.3} facing={195} />
        </Snapshot>
      </g>
      <CamFlash at={snap1} frame={frame} strength={0.25} />
      <CamFlash at={snap2} frame={frame} strength={0.25} />
    </g>
  );
};
