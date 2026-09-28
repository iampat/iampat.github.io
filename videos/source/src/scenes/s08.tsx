// s08 Chapter 2 opens: "Problem two." Chalk builds a wall and guards the near post.
// You need a ball that starts wide and bends back: you need sideways spin.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, cameraAt, type CamKey } from "../kit/Camera";
import { Dust, Floodlight, GroundSide, PitchTop, Sky, Stands, Stars } from "../kit/World";
import { Keeper, keeperPoseAt, KPOSES, type KeeperPose } from "../kit/Keeper";
import { Ball } from "../kit/Ball";
import { GoalFront, GoalSide } from "../kit/Goal";
import { ChapterCard, Label } from "../kit/Graphics";
import { XRayGrid } from "../kit/XRay";
import { Sfx } from "../kit/Sfx";
import { ArcArrow, Cross, GhostBall, GrassDetail, LightBulb, RuleCard } from "../kit/ext/s08-s10-parts";
import { SHOTS } from "../physics/shots";
import { simulate } from "../physics/sim";
import { sceneTiming, useCues } from "../lib/timing";
import { EASE, clamp01, idle, pop, progress } from "../lib/anim";
import { pathD, project, type View } from "../lib/project";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../theme";

// ---- Side-view world (same as the cold open) ----
const PPM = 50;
const OX = 400;
const GROUND = 820;
const GOAL_M = 18;
const X = (m: number) => OX + m * PPM;
const SIDE: View = { kind: "side", originX: OX, groundY: GROUND, ppm: PPM };
const KX = X(GOAL_M) - 8;
const KH = 2.1 * PPM;

// ---- Free-kick map: a high camera behind the ball looks towards goal (like a TV free-kick graphic). ----
// Metres: x towards goal, y = left, z = up. Screen left = the kicker's left.
const GL = 18.5; // goal line, metres from the ball
const GC = -4.5; // goal centre (the ball is in the left channel)
const FAR_POST = GC - 3.66;
const NEAR_POST = GC + 3.66;
const TARGET = { x: GL, y: FAR_POST + 0.7 }; // just inside the far post
const TH = Math.atan2(TARGET.y, TARGET.x); // target line angle on the ground
const DIST = Math.hypot(TARGET.x, TARGET.y); // about 20 m
const CAM3 = { x: -9, y: -2, z: 10 };
const MAPV: View = { kind: "persp", cam: CAM3, yawDeg: -9, pitchDeg: -30, focal: 1250, cx: 960, cy: 470 };
const GOALV: View = { ...MAPV, cam: { ...CAM3, y: CAM3.y - GC } }; // goal-centred frame for GoalFront
const M3 = (x: number, y: number, z = 0) => project({ x, y, z }, MAPV);
const M = (x: number, y: number) => M3(x, y, 0);
const rotT = (x: number, y: number, a = TH) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });

// The CURLER flight (target line = its x axis), turned onto the map.
const CURL = simulate({ ...SHOTS.CURLER, ground: false, stopAtX: DIST + 1.3 }, 30);
const CURL_PTS = CURL.map((s) => {
  const r = rotT(s.pos.x, s.pos.y);
  const p = M3(r.x, r.y, s.pos.z);
  return { x: p.x, y: p.y };
});
const CURL_GND = CURL.map((s) => {
  const r = rotT(s.pos.x, s.pos.y);
  const p = M(r.x, r.y);
  return { x: p.x, y: p.y };
});
// The launch line: 8 degrees right of the target line ("starts wide").
const LAUNCH_A = TH + ((SHOTS.CURLER.azimuthDeg ?? 0) * Math.PI) / 180;
const LAUNCH_LEN = (GL + 0.3) / Math.cos(LAUNCH_A);
const LAUNCH_END = M(LAUNCH_LEN * Math.cos(LAUNCH_A), LAUNCH_LEN * Math.sin(LAUNCH_A));

// The wall: 9.15 m from the ball, across the line to the near half of the goal.
const AIM = { x: GL, y: -3.0 };
const AIM_A = Math.atan2(AIM.y, AIM.x);
const WALL_C = { x: 9.15 * Math.cos(AIM_A), y: 9.15 * Math.sin(AIM_A) };
const PERP = { x: -Math.sin(AIM_A), y: Math.cos(AIM_A) }; // points left
const WALL_OFFS = [1.1, 0.37, -0.37, -1.1];
const WALL = WALL_OFFS.map((o) => ({ x: WALL_C.x + PERP.x * o, y: WALL_C.y + PERP.y * o }));
const MARK_A = { x: WALL_C.x + PERP.x * 1.55, y: WALL_C.y + PERP.y * 1.55 };
const MARK_B = { x: WALL_C.x - PERP.x * 1.55, y: WALL_C.y - PERP.y * 1.55 };
const HIT = { x: WALL_C.x - 0.35 * Math.cos(AIM_A), y: WALL_C.y - 0.35 * Math.sin(AIM_A) };
const GUARD = { x: GL - 0.6, y: NEAR_POST - 1.1 };
const REACH_M = 2.8;

const LINE_N = { x: 0.92, y: 0.25, z: 0.3 };
// The close-up ball (shot C) on screen at its first frame: the dive ends exactly there.
const CLOSE_ZOOM0 = 1.12;
const CLOSE_R = 230 * CLOSE_ZOOM0;
const CLOSE_C = { x: 960, y: 540 + (520 - 540) * CLOSE_ZOOM0 };
const TOP_UNIT: View = { kind: "topUp", originX: 0, originY: 0, ppm: 1 };

const lerpPt = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** The pitch seen from the high camera: mowing stripes and chalk lines, all projected. */
const PitchPersp: React.FC = () => {
  const poly = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${M(x, y).x.toFixed(1)},${M(x, y).y.toFixed(1)}`).join(" ");
  const stripes: React.ReactNode[] = [];
  for (let k = -6; k <= 5; k++) {
    const x0 = GL - 5 * (k + 1);
    const x1 = GL - 5 * k;
    const a = Math.max(-4, x0);
    if (x1 <= a) continue;
    stripes.push(<path key={k} d={`${poly([[a, -45], [x1, -45], [x1, 40], [a, 40]])} Z`} fill={k % 2 === 0 ? PITCH.grass : PITCH.grassDark} />);
  }
  const g = (y: number) => GC + y; // goal-centred y -> world y
  const arc: [number, number][] = [];
  for (let d = -53; d <= 53; d += 3) {
    const t = (d * Math.PI) / 180;
    arc.push([GL - 11 - 9.15 * Math.cos(t), g(9.15 * Math.sin(t))]);
  }
  const spot = M(GL - 11, GC);
  return (
    <g>
      <path d={`${poly([[-4, -45], [60, -45], [60, 40], [-4, 40]])} Z`} fill={PITCH.grassDark} />
      {stripes}
      <g fill="none" stroke={PITCH.chalk} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" opacity={0.6}>
        <path d={poly([[GL, -45], [GL, 40]])} />
        <path d={poly([[GL, g(20.16)], [GL - 16.5, g(20.16)], [GL - 16.5, g(-20.16)], [GL, g(-20.16)]])} />
        <path d={poly([[GL, g(9.16)], [GL - 5.5, g(9.16)], [GL - 5.5, g(-9.16)], [GL, g(-9.16)]])} />
        <path d={poly(arc)} />
      </g>
      <ellipse cx={spot.x} cy={spot.y} rx={6} ry={3.5} fill={PITCH.chalk} opacity={0.6} />
    </g>
  );
};

export const S08: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s08");

  // Beats (scene frames), keyed to the exact words.
  const tProblem = cue("Problem two");
  const tTwo = cue("two");
  const tWall = cue("He builds a wall");
  const tBuilds = cue("builds");
  const tWallWord = cue("wall");
  const tGuards = cue("guards");
  const tNear = cue("near post");
  const tPost = cue("post");
  const tNeed = cue("You need a ball");
  const tWide = cue("starts wide");
  const tAndBends = cue("and bends back");
  const tSpin = cue("You need sideways spin");
  const tSideways = cue("sideways");
  const end = cue.frames;

  const mapIn = tWall - 4; // cross-fade from the side view to the map
  const diveAt = tSpin - 8; // the camera dives into the ball
  const closeIn = tSpin + 6; // cross-fade from the map ball to the close-up ball (same size and place)
  const irisAt = end - 12; // hand-off to s09

  // ================= Shot A: Chalk at the goal, the chapter card on the grass =================
  const renderSide = () => {
    const keysA: CamKey[] = [
      { f: 0, x: KX - 105, y: GROUND + 19, zoom: 2.1 },
      { f: mapIn + 8, x: KX - 96, y: GROUND + 14, zoom: 2.2 },
    ];
    const cam = cameraAt(frame, keysA);
    const horizonY = HEIGHT / 2 + (GROUND - cam.y) * cam.zoom;
    const bgScale = 1 + (cam.zoom - 1) * 0.05;
    const tapAt = tProblem + 2;
    const bulbAt = tTwo;
    const kPose = keeperPoseAt(frame, [
      [tapAt - 6, "stand"],
      [tapAt, "tapHead"],
      [tapAt + 5, { ...KPOSES.tapHead, right: 150 }],
      [tapAt + 10, "tapHead"],
      [tapAt + 15, { ...KPOSES.tapHead, right: 150 }],
      [bulbAt, "tapHead"],
      [bulbAt + 10, "wide"],
      [bulbAt + 18, { ...KPOSES.stand, left: 30, right: 30 }],
    ]);
    const kFace = frame >= bulbAt ? "smug" : frame >= tapAt - 8 ? "thinking" : "flat";
    const bulbS = pop(frame, bulbAt, { stiffness: 260, damping: 13 });
    const worldT = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;
    return (
      <g>
        <Sky />
        <Stars count={90} maxY={Math.max(0, horizonY - 200)} seed="s08a" />
        <g transform={`translate(${WIDTH / 2} ${horizonY}) scale(${bgScale}) translate(${-WIDTH / 2 - (cam.x - X(4)) * 0.04} ${-GROUND})`}>
          <Stands baseY={GROUND} lit={1} />
          {[180, 720, 1220, 1760].map((x, i) => (
            <Floodlight key={i} x={x} baseY={GROUND - 20} height={470} on={1} />
          ))}
        </g>
        <g transform={worldT}>
          <GroundSide groundY={GROUND} vanishX={X(8)} />
          <GrassDetail x={X(9)} y={GROUND + 14} w={X(28) - X(9)} h={420} count={170} seed="s08side" />
          <GoalSide view={SIDE} goalX={GOAL_M} />
          <Keeper x={KX} groundY={GROUND} h={KH} pose={kPose} face={kFace} look={frame < bulbAt ? idle(frame, 1, 3, 0.3) : 0.2} />
          <Dust x={KX - 12} y={GROUND - KH * 0.98} at={tapAt + 2} size={16} seed="tap1" />
          <Dust x={KX - 12} y={GROUND - KH * 0.98} at={tapAt + 12} size={14} seed="tap2" />
          <LightBulb x={KX + 6} y={GROUND - KH - 40 + idle(frame, 3, 1.6, 2)} size={30} s={bulbS} glow={0.6 + 0.4 * progress(frame, bulbAt, 8)} frame={frame} />
          <Dust x={KX + 6} y={GROUND - KH - 40} at={bulbAt} size={20} seed="bulb" color={PITCH.lightSoft} />
        </g>
      </g>
    );
  };

  // ================= Shot B: the free-kick map =================
  const renderMap = () => {
    const ballP = M3(0, 0, 0.11);
    const ballC = { x: ballP.x, y: ballP.y - 10 };
    const keysB: CamKey[] = [
      { f: mapIn, x: 736, y: 536, zoom: 1.32 },
      { f: tGuards, x: 744, y: 532, zoom: 1.28 },
      { f: tNeed, x: 868, y: 500, zoom: 1.1 },
      { f: diveAt, x: 876, y: 497, zoom: 1.12 },
    ];
    let cam: { x: number; y: number; zoom: number } = cameraAt(frame, keysB);
    if (frame > diveAt) {
      // Dive into the ball: the zoom grows evenly and the ball glides to the close-up spot, never off screen.
      const c0 = cameraAt(diveAt, keysB);
      const e = progress(frame, diveAt, closeIn - 1 - diveAt, EASE.camera);
      const z = c0.zoom * Math.pow(CLOSE_R / 22 / c0.zoom, e);
      const s0 = { x: WIDTH / 2 + (ballC.x - c0.x) * c0.zoom, y: HEIGHT / 2 + (ballC.y - c0.y) * c0.zoom };
      const sx = s0.x + (CLOSE_C.x - s0.x) * e;
      const sy = s0.y + (CLOSE_C.y - s0.y) * e;
      cam = { x: ballC.x - (sx - WIDTH / 2) / z, y: ballC.y - (sy - HEIGHT / 2) / z, zoom: z };
    }

    // Chalk: drags one toe along the wall line, then hops to the near post.
    const dragT = progress(frame, tBuilds, 20, EASE.soft);
    const hopAt = tGuards;
    const hopT = progress(frame, hopAt, 22, EASE.standard);
    const chalkM = frame < hopAt ? lerpPt(MARK_A, MARK_B, dragT) : lerpPt(MARK_B, GUARD, hopT);
    const hopLift = frame >= hopAt && frame < hopAt + 22 ? Math.abs(Math.sin(((frame - hopAt) / 22) * Math.PI * 4)) * 0.35 : 0;
    const chalkFoot = M3(chalkM.x, chalkM.y, hopLift);
    const chalkScale = M(chalkM.x, chalkM.y).scale;
    const chalkH = 2.1 * chalkScale * 1.3;
    const kPose: KeeperPose =
      frame < hopAt
        ? keeperPoseAt(frame, [
            [mapIn, { ...KPOSES.stand, left: 30, right: 30 }],
            [tBuilds, { ...KPOSES.stand, lean: 8 }],
            [tBuilds + 20, { ...KPOSES.stand, lean: 8 }],
            [tBuilds + 26, "stand"],
          ])
        : keeperPoseAt(frame, [
            [hopAt, "stand"],
            [hopAt + 4, { ...KPOSES.ready, lean: -6 }],
            [hopAt + 20, { ...KPOSES.ready, lean: -6 }],
            [hopAt + 28, "ready"],
            [tAndBends, "ready"],
            [tAndBends + 10, { ...KPOSES.ready, left: 70, right: 30, lean: 6 }],
          ]);
    const kFace = frame >= tAndBends + 6 ? "surprised" : frame >= hopAt + 18 ? "smug" : frame < tBuilds ? "smug" : "flat";
    // The idea bulb from shot A rides over his head for a moment.
    const bulbO = 1 - progress(frame, tBuilds + 4, 10, EASE.exit);

    // Wall defenders rise out of the chalk mark.
    const riseAt = (i: number) => tWallWord + i * 5;
    const markFade = 1 - progress(frame, riseAt(1), 16);

    // Reach bubble, dashed straight path, the snap.
    const bubbleS = pop(frame, tNear, { stiffness: 160, damping: 14 });
    const dashAt = tPost;
    const snapAt = dashAt + 14;
    const dashT = progress(frame, dashAt, 14, EASE.enter);
    const snapT = progress(frame, snapAt, 14, EASE.exit);
    const crossS = pop(frame, snapAt, { stiffness: 300, damping: 14 }) * (1 - progress(frame, tNeed + 16, 8, EASE.exit));

    // Curler preview: the ghost ball rides the dotted path in real time (1 sample per frame).
    const curlAt = tWide - 14;
    const curlF = frame - curlAt;
    const shown = Math.max(0, Math.min(CURL_PTS.length, Math.floor(curlF) + 1));
    const launchT = progress(frame, curlAt, 16, EASE.enter);
    const at = (pts: { x: number; y: number }[]) => {
      const idx = Math.min(pts.length - 1, Math.max(0, curlF));
      const i0 = Math.floor(idx);
      const f = idx - i0;
      const a0 = pts[i0];
      const a1 = pts[Math.min(pts.length - 1, i0 + 1)];
      return { x: a0.x + (a1.x - a0.x) * f, y: a0.y + (a1.y - a0.y) * f };
    };
    const ghost = at(CURL_PTS);
    const ghostG = at(CURL_GND);
    const ghostR = Math.max(9, 0.11 * 2 * M(0, 0).scale * (1 - 0.45 * clamp01(curlF / CURL_PTS.length)));
    const ghostO = curlF >= 0 ? 1 - progress(frame, curlAt + CURL_PTS.length + 10, 10) : 0;
    const farGlow = progress(frame, tAndBends, 10) * (1 - progress(frame, diveAt, 8));
    const ballPulse = progress(frame, tNeed + 8, 8) * (1 - progress(frame, curlAt + 4, 8));
    const zoomOut = 1 - progress(frame, diveAt, 6); // map graphics fade while the camera dives in

    const P = (m: { x: number; y: number }) => M(m.x, m.y);
    const gnd = M(0, 0);
    const hitP = P(HIT);
    const aimP = P(AIM);
    const dashEnd = lerpPt(gnd, hitP, dashT);
    const snapD = snapT * 12;

    // Figures sorted by depth (farther = drawn first).
    type Fig = { d: number; node: React.ReactNode };
    const figs: Fig[] = [];
    WALL.forEach((w, i) => {
      const p = P(w);
      const r = Math.min(1.06, pop(frame, riseAt(i), { stiffness: 170, damping: 12 }));
      if (r <= 0.001) return;
      figs.push({
        d: p.depth,
        node: (
          <Keeper
            key={`w${i}`}
            x={p.x}
            groundY={p.y}
            h={1.85 * p.scale * 1.15}
            pose={{ ...KPOSES.crossed, lean: idle(frame, i, 2.6, 1.5) }}
            face={frame > tNear + 4 ? "smug" : "flat"}
            rise={r}
            look={frame >= curlAt ? 0.6 : idle(frame, i + 4, 3, 0.4)}
          />
        ),
      });
    });
    figs.push({
      d: M(chalkM.x, chalkM.y).depth,
      node: (
        <g key="chalk">
          <Keeper x={chalkFoot.x} groundY={chalkFoot.y} h={chalkH} pose={kPose} face={kFace} look={frame >= curlAt ? 0.5 : idle(frame, 2, 3, 0.4)} />
          {bulbO > 0.001 ? (
            <g opacity={bulbO}>
              <LightBulb x={chalkFoot.x + 4} y={chalkFoot.y - chalkH - 30 + idle(frame, 3, 1.6, 2)} size={chalkH * 0.26} s={1} glow={1} frame={frame} />
            </g>
          ) : null}
        </g>
      ),
    });
    figs.sort((a, b) => b.d - a.d);

    const worldT = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;
    const markA = P(MARK_A);
    const markB = P(MARK_B);
    const markTip = lerpPt(markA, markB, dragT);
    // Reach bubble: a circle on the grass, cut flat at the goal line.
    const bubble = Array.from({ length: 49 }, (_, i) => {
      const a = (i / 48) * Math.PI * 2;
      const rr = REACH_M * bubbleS;
      return P({ x: Math.min(GL, GUARD.x + Math.cos(a) * rr), y: GUARD.y + Math.sin(a) * rr });
    });
    const farPost = M(GL, FAR_POST);
    const labelS = 36;
    const labelsOut = diveAt;
    return (
      <g transform={worldT}>
        <PitchPersp />
        <GrassDetail x={-600} y={120} w={3100} h={1300} count={220} seed="s08map" pool={{ cx: 860, cy: 420, r: 1100 }} />
        <GoalFront view={GOALV} goalX={GL} />
        {/* Reach bubble around Chalk. */}
        {bubbleS > 0.001 ? (
          <g opacity={zoomOut}>
            <path d={`${pathD(bubble)} Z`} fill={PITCH.chalk} opacity={0.16} />
            <path d={`${pathD(bubble)} Z`} fill="none" stroke={PITCH.chalk} strokeWidth={3.5} strokeDasharray="12 10" opacity={0.7} />
          </g>
        ) : null}
        {/* Far-post glow when the curve lands. */}
        {farGlow > 0.001 ? <ellipse cx={farPost.x} cy={farPost.y - 30} rx={70 + 6 * Math.sin(frame / 4)} ry={56} fill={PITCH.light} opacity={0.22 * farGlow} /> : null}
        {/* The chalk mark for the wall. */}
        {dragT > 0.001 && markFade > 0.001 ? (
          <line x1={markA.x} y1={markA.y} x2={markTip.x} y2={markTip.y} stroke={PITCH.chalk} strokeWidth={7} strokeLinecap="round" opacity={markFade} />
        ) : null}
        {/* Dashed straight path on the grass: hits the wall and snaps. */}
        {dashT > 0.001 && snapT < 0.999 ? (
          <g opacity={1 - snapT}>
            <line x1={gnd.x - (frame >= snapAt ? snapD : 0)} y1={gnd.y} x2={dashEnd.x - (frame >= snapAt ? snapD * 2 : 0)} y2={dashEnd.y + (frame >= snapAt ? snapD : 0)} stroke={frame >= snapAt ? CAST.mistake : PITCH.chalk} strokeWidth={7} strokeDasharray="20 14" strokeLinecap="round" />
            {frame >= snapAt ? (
              <line x1={hitP.x + snapD} y1={hitP.y - snapD} x2={hitP.x + (aimP.x - hitP.x) * 0.15 + snapD * 2} y2={hitP.y + (aimP.y - hitP.y) * 0.15 - snapD} stroke={CAST.mistake} strokeWidth={6} strokeDasharray="16 12" strokeLinecap="round" />
            ) : null}
          </g>
        ) : null}
        {/* Launch line on the grass: where the curler starts heading (outside the far post). */}
        {launchT > 0.001 ? (
          <line
            x1={gnd.x}
            y1={gnd.y}
            x2={gnd.x + (LAUNCH_END.x - gnd.x) * launchT}
            y2={gnd.y + (LAUNCH_END.y - gnd.y) * launchT}
            stroke={PITCH.chalk}
            strokeWidth={5}
            strokeDasharray="10 14"
            strokeLinecap="round"
            opacity={0.8 * zoomOut}
          />
        ) : null}
        {/* The curler preview: its shadow on the grass and the dotted flight. */}
        {shown > 1 ? (
          <g opacity={zoomOut}>
            <path d={pathD([...CURL_PTS.slice(0, shown), ...(curlF < CURL_PTS.length ? [ghost] : [])])} fill="none" stroke={PITCH.lightSoft} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
            <path d={pathD([...CURL_GND.slice(0, shown), ...(curlF < CURL_GND.length ? [ghostG] : [])])} fill="none" stroke={PITCH.light} strokeWidth={9} strokeDasharray="1 17" strokeLinecap="round" />
          </g>
        ) : null}
        {/* The real ball on its spot. */}
        {ballPulse > 0.001 ? (
          <ellipse cx={gnd.x} cy={gnd.y} rx={26 + 40 * (((frame - tNeed) % 18) / 18)} ry={(26 + 40 * (((frame - tNeed) % 18) / 18)) * 0.55} fill="none" stroke={PITCH.light} strokeWidth={5} opacity={ballPulse * (1 - ((frame - tNeed) % 18) / 18)} />
        ) : null}
        <ellipse cx={gnd.x + 6} cy={gnd.y + 2} rx={22} ry={9} fill="#0B3F31" opacity={0.5} />
        <Ball cx={ballC.x} cy={ballC.y} r={22} view={MAPV} lineNormal={LINE_N} axis={{ x: 0, y: 0, z: 1 }} angle={0} />
        {/* Figures. */}
        <g opacity={zoomOut}>{figs.map((f) => f.node)}</g>
        {ghostO > 0.001 ? (
          <g>
            <ellipse cx={ghostG.x} cy={ghostG.y} rx={ghostR * 0.9} ry={ghostR * 0.4} fill="#0B3F31" opacity={0.5 * ghostO} />
            <GhostBall x={ghost.x} y={ghost.y} r={ghostR} opacity={0.95 * ghostO} color={PITCH.light} />
          </g>
        ) : null}
        <Dust x={markA.x} y={markA.y} at={tBuilds} size={30} seed="m-in" />
        <Dust x={markB.x} y={markB.y} at={hopAt} size={26} seed="m-hop" />
        <Dust x={P(GUARD).x} y={P(GUARD).y} at={hopAt + 22} size={22} seed="m-land" />
        {WALL.map((w, i) => (
          <Dust key={i} x={P(w).x} y={P(w).y} at={riseAt(i)} size={24} seed={`wall${i}`} />
        ))}
        <Cross x={hitP.x} y={hitP.y - 14} size={46} s={crossS} />
        {/* Labels (world pixels; the camera is near zoom 1.2-1.3 when they show). */}
        <Label x={markA.x - 150} y={markA.y - 70} text="wall" at={tWallWord + 10} until={tNear + 6} size={labelS} />
        <Label x={LAUNCH_END.x + 150} y={LAUNCH_END.y + 90} text="starts wide" at={tWide} until={labelsOut} size={labelS} />
        <Label x={farPost.x - 30} y={farPost.y - 128} text="bends back" at={tAndBends + 2} until={labelsOut} size={labelS} bg={PITCH.light} />
      </g>
    );
  };

  // ================= Shot C: top-view close-up, sideways spin =================
  const renderClose = () => {
    const t0 = closeIn;
    const push = progress(frame, t0, end - t0, EASE.camera);
    const zoom = CLOSE_ZOOM0 - 0.12 * progress(frame, t0, 14, EASE.enter) + 0.06 * push;
    const r = 230;
    const cx = 960;
    const cy = 520;
    const spinA = Math.max(0, frame - t0) * 0.1; // anticlockwise from above
    const arcT = progress(frame, tSideways - 6, 16, EASE.enter);
    const view: View = { kind: "topUp", originX: 960, originY: 540, ppm: 90 };
    return (
      <g transform={`translate(960 540) scale(${zoom}) translate(-960 -540)`}>
        <rect x={-400} y={-400} width={WIDTH + 800} height={HEIGHT + 800} fill={PITCH.grassDark} />
        <PitchTop view={view} goalX={40} chalkOpacity={0} />
        <circle cx={cx + 26} cy={cy + 30} r={r} fill="#0B3F31" opacity={0.6} />
        <Ball cx={cx} cy={cy} r={r} view={TOP_UNIT} axis={{ x: 0, y: 0, z: 1 }} angle={spinA} lineNormal={LINE_N} />
        <ArcArrow cx={cx} cy={cy} r={r + 60} a0={-50} a1={-130} t={arcT} color={XRAY.lime} width={16} />
        <ArcArrow cx={cx} cy={cy} r={r + 60} a0={130} a1={50} t={arcT} color={XRAY.lime} width={16} />
        <Label x={cx} y={cy + r + 150} text="sideways spin" at={tSideways + 4} size={52} bg={XRAY.lime} color={PITCH.sky} />
        {/* Which way is the goal: up. */}
        <g opacity={progress(frame, closeIn + 6, 12, EASE.enter)} transform={`translate(${cx - 520} ${cy + 40 - 20 * progress(frame, closeIn + 6, 14, EASE.enter)})`}>
          <line x1={0} y1={160} x2={0} y2={-120} stroke={PITCH.chalk} strokeWidth={10} strokeDasharray="4 22" strokeLinecap="round" opacity={0.8} />
          <path d="M-34,-100 L0,-150 L34,-100" fill="none" stroke={PITCH.chalk} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
          <text x={0} y={-180} fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={40} textAnchor="middle">
            to goal
          </text>
        </g>
      </g>
    );
  };

  // ---- Compose with short cross-fades (no hard cuts). ----
  const mapO = progress(frame, mapIn, 8, EASE.soft);
  const closeO = progress(frame, closeIn - 3, 4, EASE.soft);
  const showSide = frame < mapIn + 8;
  const showMap = frame >= mapIn && frame < closeIn + 2;
  const showClose = frame >= closeIn - 4;
  // The iris opens fast (decelerating), so it never sits as a small dark disc on the ball.
  const IRIS_C = { x: 1000, y: 790 };
  const IRIS_R = 1400; // reaches past the far corner of the frame
  const irisT = progress(frame, irisAt, 12, EASE.enter);
  const irisR = IRIS_R * irisT;
  // s07 ends on flat grass: the ring opens and the card is written from the very first frame.
  const openT = progress(frame, 0, 15, EASE.standard);
  const OPEN_C = { x: WIDTH / 2, y: 710 };
  const openR = Math.max(0.01, 1270 * openT);
  // A frame count that runs on into s09, so the rule card bobs without a jump at the cut.
  const gFrame = sceneTiming("s08").startFrame + frame;
  return (
    <Stage bg={PITCH.sky}>
      {showSide ? renderSide() : null}
      {showMap ? <g opacity={mapO}>{renderMap()}</g> : null}
      {showClose ? <g opacity={closeO}>{renderClose()}</g> : null}
      {/* s07 ends with its net-ripple wipe filling the frame with grass. The same grass opens out here,
          behind a chalk ring, while the chapter card is written on it. */}
      {openT < 0.999 ? (
        <g>
          <path
            d={`M-10,-10 H${WIDTH + 10} V${HEIGHT + 10} H-10 Z M${OPEN_C.x + openR},${OPEN_C.y} A${openR},${openR} 0 1 0 ${OPEN_C.x - openR},${OPEN_C.y} A${openR},${openR} 0 1 0 ${OPEN_C.x + openR},${OPEN_C.y} Z`}
            fill={PITCH.grassDark}
            fillRule="evenodd"
          />
          {openR > 2 ? <circle cx={OPEN_C.x} cy={OPEN_C.y} r={openR} fill="none" stroke={PITCH.chalk} strokeWidth={14} opacity={0.85 * (1 - openT)} /> : null}
        </g>
      ) : null}
      {/* The card sits on the grass, below Chalk. */}
      <g transform="translate(0 170)">
        <ChapterCard number={2} title="THE CURLER" subtitle="sideways spin" at={-2} until={tTwo - 2} />
      </g>
      {/* Hand-off to s09: an X-ray iris opens from the back of the ball (where the boot strikes)
          and shows the rule card that s09 opens on. */}
      {frame >= irisAt && irisR > 1 ? (
        <g>
          <defs>
            <clipPath id="s08-iris">
              <circle cx={IRIS_C.x} cy={IRIS_C.y} r={irisR} />
            </clipPath>
          </defs>
          <g clipPath="url(#s08-iris)">
            <XRayGrid />
            <RuleCard x={960} y={500} s={progress(frame, irisAt + 1, 10, EASE.enter)} flip={0} t={gFrame} />
          </g>
          {/* A lime lens rim, so the opening reads as an X-ray iris and not as a hole in the ball. */}
          <circle cx={IRIS_C.x} cy={IRIS_C.y} r={irisR} fill="none" stroke={XRAY.lime} strokeWidth={22} opacity={0.9} />
          <circle cx={IRIS_C.x} cy={IRIS_C.y} r={Math.max(1, irisR - 22)} fill="none" stroke={XRAY.bone} strokeWidth={6} opacity={0.5} />
        </g>
      ) : null}
      {/* SFX */}
      <Sfx name="chalk" at={0} volume={0.5} />
      <Sfx name="chalk" at={10} volume={0.4} />
      <Sfx name="tick" at={tProblem + 4} volume={0.4} />
      <Sfx name="tick" at={tProblem + 14} volume={0.4} />
      <Sfx name="bell" at={tTwo} volume={0.35} />
      <Sfx name="whoosh" at={mapIn - 4} volume={0.35} />
      <Sfx name="chalk" at={tBuilds} volume={0.5} />
      <Sfx name="chalk" at={tBuilds + 10} volume={0.45} />
      {[0, 1, 2, 3].map((i) => (
        <Sfx key={i} name="pop-soft" at={tWallWord + i * 5} volume={0.4} />
      ))}
      {[0, 6, 12, 18].map((d) => (
        <Sfx key={d} name="tick" at={tGuards + d} volume={0.35} />
      ))}
      <Sfx name="pop" at={tNear} volume={0.3} />
      <Sfx name="stamp" at={tPost + 14} volume={0.4} />
      <Sfx name="alarm" at={tPost + 15} volume={0.2} />
      <Sfx name="pop-soft" at={tNeed + 8} volume={0.3} />
      <Sfx name="whoosh" at={tWide - 14} volume={0.3} />
      <Sfx name="pop" at={tWide} volume={0.3} />
      <Sfx name="pop" at={tAndBends + 2} volume={0.3} />
      <Sfx name="whoosh" at={diveAt} volume={0.35} />
      <Sfx name="air" at={closeIn} volume={0.2} dur={50} />
      <Sfx name="pop-soft" at={tSideways - 6} volume={0.35} />
      <Sfx name="pop" at={tSideways + 4} volume={0.3} />
      <Sfx name="whoosh" at={irisAt - 2} volume={0.3} />
    </Stage>
  );
};
