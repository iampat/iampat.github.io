// b02 The ring: the same spot from above. Rewind to the kick frame, the time bubble pops around Tavi (2.8 s),
// the pass replays and the ring shrinks as Chalk jogs (freeze at 1.5 s), the jog rule on a moving track, a ghost
// sprinter from the same spot with a grey ring that shrinks faster, then the arrival frame: 2.5 m, just over
// half a second, one heartbeat. Remember this ring (a pink glow: the ring reads panic).
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage } from "../../kit/Camera";
import { TopField } from "../../kit/Field";
import { TopPlayer, angleTo } from "../../kit/TopPlayer";
import { TimeBubble } from "../../kit/TimeBubble";
import { Ball } from "../../kit/Ball";
import { Glow } from "../../kit/World";
import { Sfx } from "../../kit/Sfx";
import { CHALK_START, chalkAt, passInAt, passInTimeToX, ringSeconds } from "../../physics/ep2sims";
import { CHASE_SPEED } from "../../physics/touch";
import { useCues } from "../../lib/timing";
import { EASE, clamp01, idle, keys, lerp, pop, progress } from "../../lib/anim";
import type { View } from "../../lib/project";
import { CAST, HEIGHT, PITCH, WIDTH } from "../../theme";
import { ChalkHeart, ChalkQuestion, ChapterIcon, FreezeMarks, JogRule, MetreLine, TokenName } from "../../kit/ext/ep2-b01-b03-graphics";
import { RewindTag } from "../../kit/ext/s02-s03-hud";

// Map: pitch metres around Tavi's mark; x to the right (towards the goal), +y up the screen.
const PPM = 62;
const OXS = 991;
const OYS = 560;
const W = (x: number, y: number) => ({ x: OXS + x * PPM, y: OYS - y * PPM });
const LOCAL: View = { kind: "top", originX: OXS, originY: OYS, ppm: PPM };
/** Where this spot lies on the pitch: 18 m from the goal line (x = 105), 14 m left of centre. */
const PITCH_X0 = 105 - 18;
const PITCH_Y0 = 14;
const FIELD: View = { kind: "top", originX: OXS - PITCH_X0 * PPM, originY: OYS + PITCH_Y0 * PPM, ppm: PPM };
const T_ARRIVE = passInTimeToX(0);
const FREEZE_T = 1.5;
const SPRINT = 7; // ghost speed, picture only
const GHOST_OFF = 0.9; // the ghost sprints on a line beside Chalk's, 0.9 m to his left (up the screen)
const TAVI_TOKEN = { x: 0.3, y: 0 }; // token centre: the ball meets her feet at the mark (0, 0)
const GREY = "#8D94AD";
const smooth = (t: number) => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};

export const B02: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b02");

  // Beats.
  const tRingWord = cue("ring");
  const tCounts = cue("It counts the seconds");
  const tJog = cue("if he keeps coming at a jog");
  const tSprint = cue("Sprinting shrinks the numbers");
  const tNot = cue("not the fixes");
  const tWhen = cue("When the pass arrived");
  const tJust = cue("just over half a second");
  const tHeart = cue("One heartbeat");
  const tHeartW = cue("heartbeat");
  const tRemember = cue("Remember this ring");
  const END = cue.frames;

  // Replay clock (sim seconds): real speed, a freeze at 1.5 s, resume, freeze at the arrival.
  const rewindA = 6;
  const rewindB = 26;
  const kick1 = tCounts + 3;
  const freeze1 = kick1 + Math.round(FREEZE_T * 30);
  const resumeAt = tWhen + 2;
  const freeze2 = resumeAt + Math.round((T_ARRIVE - FREEZE_T) * 30);
  const simT = (f: number) => (f < kick1 ? 0 : f < freeze1 ? (f - kick1) / 30 : f < resumeAt ? FREEZE_T : Math.min(T_ARRIVE, FREEZE_T + (f - resumeAt) / 30));
  const t = simT(frame);
  const moving = (frame >= kick1 && frame < freeze1) || (frame >= resumeAt && frame < freeze2);
  // The ghost sprints on "shrinks"; the three fixes pop on "not the fixes".
  const ghostAt = tSprint + 6;
  const ghostOut = tNot + 18;
  const iconsAt = tNot - 10;
  const iconsOut = tWhen - 12;
  const fillAt = END - 20;
  const tReaches = cue("reaches the ball");

  // Camera: the question mark close, then out to the map.
  const cz = keys(frame, [0, 40], [1.65, 1], EASE.camera);
  const cx = keys(frame, [0, 40], [W(0, 0).x, WIDTH / 2], EASE.camera);
  const cy = keys(frame, [0, 40], [W(0, 0).y, HEIGHT / 2], EASE.camera);
  const camT = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cz}) translate(${-cx} ${-cy})`;

  // Rewind: everyone slides back to the kick frame.
  const rw = smooth(progress(frame, rewindA, rewindB - rewindA, EASE.standard));
  const chalkNow = chalkAt(t);
  const chalkM = frame < rewindB ? { x: lerp(-1.85, CHALK_START.x, rw), y: lerp(-0.6, CHALK_START.y, rw) } : { x: chalkNow.x, y: chalkNow.y };
  const taviM = frame < rewindB ? { x: lerp(-0.15 + TAVI_TOKEN.x, TAVI_TOKEN.x, rw), y: 0 } : TAVI_TOKEN;
  const ballM = frame < rewindB ? { x: lerp(7.5, -12, rw), y: lerp(0.4, 0, rw) } : { x: passInAt(t).x, y: 0 };
  const tavi = W(taviM.x, taviM.y);
  const chalk = W(chalkM.x, chalkM.y);
  const sam = W(-12.55, 0);
  const ball = W(ballM.x, ballM.y);
  const ballAngle = (ballM.x + 12) / 0.11;

  // The ring: seconds until Chalk reaches the mark, where the ball arrives.
  const ringChalk = frame < rewindB ? CHALK_START : chalkNow;
  const seconds = ringSeconds(ringChalk.x, ringChalk.y, 0, 0);
  const metres = seconds * CHASE_SPEED;
  const ringR = Math.min(260, Math.max(40, seconds * 80));
  const toTavi = { x: tavi.x - chalk.x, y: tavi.y - chalk.y };
  const dist = Math.hypot(toTavi.x, toTavi.y) || 1;
  const lineEnd = { x: tavi.x - (toTavi.x / dist) * (ringR + 6), y: tavi.y - (toTavi.y / dist) * (ringR + 6) };

  // Ghost sprinter and its grey ring. He starts beside the frozen jogging Chalk (5 m out), so both rings start
  // equal. The grey ring uses the same rule as the real one (metres left / 4), so it shrinks faster because
  // the sprinter closes faster. It never drops under the ring's minimum, so it stays larger than Tavi's token.
  const frozenChalk = chalkAt(FREEZE_T);
  const gd = { x: -frozenChalk.x, y: -frozenChalk.y };
  const gl = Math.hypot(gd.x, gd.y);
  const ghostRun = frame >= ghostAt ? Math.min(gl, (SPRINT * (frame - ghostAt)) / 30) : 0;
  const ghostM = { x: frozenChalk.x + (gd.x / gl) * ghostRun, y: frozenChalk.y + (gd.y / gl) * ghostRun + GHOST_OFF };
  const ghost = W(ghostM.x, ghostM.y);
  const ghostStart = W(frozenChalk.x, frozenChalk.y + GHOST_OFF);
  const ghostOpacity = frame < ghostAt ? 0 : progress(frame, ghostAt, 5, EASE.enter) * (1 - progress(frame, ghostOut, 12, EASE.exit));
  const ghostR = Math.max(40, ((gl - ghostRun) / CHASE_SPEED) * 80);

  // Where the ball will meet Tavi (the mark): the ring counts Chalk's metres to this spot.
  const mark = W(0, 0);
  const markOn = progress(frame, kick1 + 6, 10, EASE.enter) * (1 - progress(frame, freeze2 - 3, 5, EASE.exit));
  const tagOut = tJog + 18;
  const tagOn = progress(frame, tReaches, 8, EASE.enter) * (1 - progress(frame, tagOut, 8, EASE.exit));

  // Highlights.
  const revealGlow = frame >= tJust ? (1 - progress(frame, tJust, 40)) * 1.6 : 0;
  const rememberDim = progress(frame, tRemember, 14, EASE.standard);
  // The ring reads 0.6 s here, so its glow is pink (panic), never lime.
  const rememberGlow = frame >= tRemember ? 0.6 + 1.2 * (1 - progress(frame, tRemember, 30)) : 0;
  const fill = progress(frame, fillAt, END - fillAt, EASE.standard);
  const qFade = 1 - progress(frame, 8, 14, EASE.exit);
  const darkT = 0.34 * progress(frame, 0, 1) * (1 - 0.5 * progress(frame, tCounts, 20));

  return (
    <Stage bg={PITCH.grassDark}>
      <g transform={camT}>
        <TopField view={FIELD} x0={PITCH_X0 - 22} x1={107} y0={PITCH_Y0 - 13} y1={PITCH_Y0 + 13} lineOpacity={0.55} />
        {/* The half of the pitch behind Tavi is dark: she faces Sam. */}
        <defs>
          <linearGradient id="b02-dark" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={PITCH.skyHigh} stopOpacity={0} />
            <stop offset="0.06" stopColor={PITCH.skyHigh} stopOpacity={1} />
            <stop offset="1" stopColor={PITCH.skyHigh} stopOpacity={1} />
          </linearGradient>
        </defs>
        <rect x={W(0.6, 0).x} y={-400} width={WIDTH + 400} height={HEIGHT + 800} fill="url(#b02-dark)" opacity={darkT} />
        {qFade > 0.001 ? <ChalkQuestion x={W(-0.7, 0).x} y={W(0, 0).y + 6} at={-24} size={74} opacity={qFade} /> : null}

        {/* Ghost sprinter and his grey ring (no digits): sprinting shrinks the numbers, not the fixes. */}
        {ghostOpacity > 0.001 ? (
          <g opacity={ghostOpacity}>
            <circle cx={tavi.x} cy={tavi.y} r={ghostR} fill={GREY} opacity={0.12} />
            <circle cx={tavi.x} cy={tavi.y} r={ghostR} fill="none" stroke={GREY} strokeWidth={7} strokeDasharray="16 10" />
            {/* The sprint line he has covered, so the ghost reads as a runner and not a smudge. */}
            <line x1={ghostStart.x} y1={ghostStart.y} x2={ghost.x} y2={ghost.y} stroke={GREY} strokeWidth={4} strokeDasharray="3 12" strokeLinecap="round" opacity={0.9} />
            <TopPlayer x={ghost.x} y={ghost.y} kind="chalk" size={48} facing={angleTo(ghost.x, ghost.y, tavi.x, tavi.y)} stride={((frame - ghostAt) / 5) % 1} opacity={0.8} />
          </g>
        ) : null}

        {/* Tokens (Tavi and the ball draw above the glows, further down). */}
        <TopPlayer x={sam.x} y={sam.y} kind="sam" size={48} facing={0} look={idle(frame, 3, 4, 3)} />
        <TopPlayer x={chalk.x} y={chalk.y} kind="chalk" size={50} facing={angleTo(chalk.x, chalk.y, tavi.x, tavi.y)} stride={moving || frame < rewindB ? (t * 3 + frame * 0.002) % 1 : 0.25} />
        <TokenName x={sam.x} y={sam.y - 46} text="SAM" at={rewindB + 2} />
        <TokenName x={chalk.x} y={chalk.y - 50} text="CHALK" at={rewindB + 6} until={tSprint - 6} />
        {/* The comparison: the frozen jogger and the ghost that sprints from the same spot, labelled side by side. */}
        <TokenName x={ghostStart.x + 98} y={ghostStart.y + 10} text="SPRINT" at={ghostAt} until={ghostOut} size={26} color="#C9CEDD" pill />
        <TokenName x={chalk.x + 70} y={chalk.y + 10} text="JOG" at={tSprint + 2} until={tWhen - 10} size={26} pill />

        {/* Dotted line from Chalk to the ring, with the metres left (the tag hangs under the line). */}
        <MetreLine a={{ x: chalk.x - (toTavi.x / dist) * 30, y: chalk.y - (toTavi.y / dist) * 30 }} b={lineEnd} metres={metres} at={kick1} until={fillAt - 4} below />

        {/* The three fixes stay lit under both rings while the ghost sprints. */}
        {(["look", "touch", "shape"] as const).map((k, i) => (
          <ChapterIcon
            key={k}
            x={tavi.x - 120 + i * 120}
            y={tavi.y + 182}
            r={40}
            kind={k}
            appear={pop(frame, iconsAt + i * 4) * (1 - progress(frame, iconsOut, 10, EASE.exit))}
            morph={1}
            lit={0.9 * progress(frame, iconsAt + 8, 12) * (1 - progress(frame, iconsOut, 10))}
          />
        ))}
      </g>

      {/* "Remember this ring": everything else dims 20%. */}
      {rememberDim > 0.001 ? <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={PITCH.skyHigh} opacity={0.22 * rememberDim} /> : null}

      <g transform={camT}>
        {revealGlow > 0.01 ? <Glow cx={tavi.x} cy={tavi.y} r={ringR * 2.6} color={CAST.mistake} intensity={revealGlow} rings={4} /> : null}
        {rememberGlow > 0.01 ? <Glow cx={tavi.x} cy={tavi.y} r={ringR * 3.2} color={CAST.mistake} intensity={rememberGlow} rings={5} /> : null}
        {/* The ball's path to the mark and a ghost ball where it will meet Tavi: the ring counts Chalk's metres to it. */}
        {markOn > 0.001 ? (
          <g opacity={markOn}>
            {ball.x + 16 < mark.x - 14 ? (
              <line x1={ball.x + 16} y1={ball.y} x2={mark.x - 14} y2={mark.y} stroke={PITCH.chalk} strokeWidth={3} strokeDasharray="2 11" strokeLinecap="round" opacity={0.5} />
            ) : null}
            <circle cx={mark.x} cy={mark.y} r={11} fill={PITCH.chalk} opacity={0.2} />
            <circle cx={mark.x} cy={mark.y} r={11} fill="none" stroke={PITCH.chalk} strokeWidth={2.5} strokeDasharray="4 3.5" />
          </g>
        ) : null}
        <Ball cx={ball.x} cy={ball.y} r={10} view={LOCAL} axis={{ x: 0, y: 1, z: 0 }} angle={ballAngle} />
        {/* Tavi above the glows, so the pink glow never tints her token. */}
        <TopPlayer x={tavi.x} y={tavi.y} kind="tavi" size={48} facing={180} look={idle(frame, 1, 3.4, 2.5)} />
        {tagOn > 0.001 ? (
          <line x1={mark.x} y1={mark.y + 16} x2={mark.x} y2={tavi.y + ringR + 12} stroke={PITCH.chalk} strokeWidth={3} strokeDasharray="2 8" strokeLinecap="round" opacity={0.7 * tagOn} />
        ) : null}
        <TokenName x={mark.x} y={tavi.y + ringR + 44} text="ball arrives" at={tReaches - 4} until={tagOut} size={24} pill />
        <TimeBubble x={tavi.x} y={tavi.y} seconds={seconds} pxPerSecond={80} minRadius={40} maxRadius={260} at={tRingWord} fontSize={40} alarm={frame >= tJust && frame < tJust + 40} />
        <ChalkHeart x={tavi.x + 180} y={tavi.y - 70} at={tHeart} beat={tHeartW} until={tRemember - 6} size={44} />
      </g>

      <JogRule x={80} y={852} at={tJog} until={tWhen - 8} />
      <FreezeMarks at={freeze1} until={resumeAt - 2} />
      <FreezeMarks at={freeze2} until={tRemember - 4} color={CAST.mistake} />
      <RewindTag at={2} until={rewindB} />

      {/* The ring's glow spreads into the night sky: the title scene opens on it. */}
      {fill > 0.001 ? <circle cx={WIDTH / 2 + (tavi.x - WIDTH / 2) * cz} cy={HEIGHT / 2 + (tavi.y - HEIGHT / 2) * cz} r={20 + 1500 * fill} fill={PITCH.skyHigh} /> : null}

      <Sfx name="whoosh-long" at={rewindA - 2} volume={0.3} />
      <Sfx name="bell" at={tRingWord} volume={0.45} />
      <Sfx name="pop" at={tRingWord} volume={0.3} />
      <Sfx name="thump" at={kick1} volume={0.35} />
      {[15, 30, 45].map((k) => (
        <Sfx key={`t${k}`} name="tick" at={kick1 + k} volume={0.22} />
      ))}
      <Sfx name="tick" at={freeze1} volume={0.45} />
      <Sfx name="pop-soft" at={tJog} volume={0.3} />
      <Sfx name="whoosh" at={ghostAt} volume={0.25} />
      {/* Fast footsteps for the 5 m sprint (about 21 frames at 7 m/s). */}
      {[2, 7, 12, 17].map((k) => (
        <Sfx key={`g${k}`} name="chalk" at={ghostAt + k} volume={0.14} />
      ))}
      {[0, 4, 8].map((k) => (
        <Sfx key={`i${k}`} name="pop-soft" at={iconsAt + k} volume={0.28} />
      ))}
      <Sfx name="blip" at={tNot} volume={0.25} />
      <Sfx name="tick" at={resumeAt + 15} volume={0.22} />
      <Sfx name="tick" at={freeze2} volume={0.5} />
      <Sfx name="alarm" at={tJust + 2} volume={0.3} />
      <Sfx name="pop-soft" at={tHeart} volume={0.3} />
      <Sfx name="thump" at={tHeartW} volume={0.5} />
      <Sfx name="bell" at={tRemember} volume={0.4} />
      <Sfx name="whoosh-long" at={fillAt - 2} volume={0.3} />
    </Stage>
  );
};
