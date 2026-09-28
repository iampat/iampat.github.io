// s15 The instep is a tennis racket (X-ray). The shin and foot morph into a racket, the laces
// become the strings. Toes down: the face tilts forward, but the launch still leaves about
// 23 degrees up. Pull out on "tilts forward": the path peaks above bar height and dips under it,
// inside the cone of take-off angles that score ("aim high, it falls"). On "Lean" the green idea
// steps back and the close-up inset opens: the face opens to about 35 degrees (pink) and the
// ball sails over the bar. Ends back on the X-ray contact.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, cameraAt } from "../kit/Camera";
import { Player, mixPose, solve, type Pose } from "../kit/Player";
import { XRayLeg } from "../kit/XRay";
import { Ball } from "../kit/Ball";
import { Flight } from "../kit/Flight";
import { Glow } from "../kit/World";
import { Label } from "../kit/Graphics";
import { Sfx } from "../kit/Sfx";
import { SHOTS } from "../physics/shots";
import { sampleAt, simulate, type BallState } from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, clamp01, idle, keys, lerp, pop, progress, visible } from "../lib/anim";
import { HEIGHT, WIDTH, XRAY } from "../theme";
import { pathD, project, type View } from "../lib/project";
import { Racket, XGoalSide, lacesBall, toScreen, worldT, type Cam } from "../kit/ext/s13-s15-volley";

// X-ray side-view world.
const PPMX = 95;
const OXX = 330; // kick spot (world px)
const GX = 900; // ground (world px)
const GOAL = 16;
const H = 1.62 * PPMX;
const BR = 0.11 * PPMX;
const BALL0 = { x: OXX, y: GX - 0.4 * PPMX }; // the ball at contact, 0.4 m up
const XV: View = { kind: "side", originX: OXX, groundY: GX, ppm: PPMX };
const LINE_N = { x: 0.3, y: 0.9, z: 0.3 };

// Launch angles (degrees above level): closed face (toes down) and open face (leaning back).
const PHI_CLOSED = SHOTS.VOLLEY.elevationDeg; // 23
const PHI_OPEN = 35;
const VOLLEY = simulate({ ...SHOTS.VOLLEY, duration: 1.4 }, 30);
const OPEN = simulate({ ...SHOTS.VOLLEY, elevationDeg: PHI_OPEN, duration: 1.6 }, 30); // storyboard: same speed at 35 deg (drawing only)
const crossIdx = (path: typeof VOLLEY, x: number) => {
  const i = path.findIndex((s) => s.pos.x >= x);
  return i < 0 ? path.length - 1 : i;
};
const V_IN_NET = crossIdx(VOLLEY, GOAL + 0.5);
const O_OUT = crossIdx(OPEN, GOAL + 3.2);
// Take-off angles that score with this volley's forward spin (sim sweep of SHOTS.VOLLEY: about 17 to 25 degrees).
const CONE_LO = 17;
const CONE_HI = 25;

const FAR2 = { farHip: 18, farKnee: 4, farAnkle: 104 };
const XP = {
  closed: { torso: 16, head: 16, nearHip: 102, nearKnee: 94, nearAnkle: 165, ...FAR2, nearShoulder: -45, nearElbow: 30, farShoulder: 55, farElbow: 40 },
  neutral: { torso: 12, head: 14, nearHip: 100, nearKnee: 86, nearAnkle: 164, ...FAR2, nearShoulder: -45, nearElbow: 30, farShoulder: 55, farElbow: 40 },
  open: { torso: -16, head: -12, nearHip: 90, nearKnee: 60, nearAnkle: 175, ...FAR2, nearShoulder: -75, nearElbow: 20, farShoulder: 75, farElbow: 30 },
} satisfies Record<string, Pose>;
const poseForPhi = (phi: number): Pose =>
  phi <= 30 ? mixPose(XP.closed, XP.neutral, clamp01((phi - PHI_CLOSED) / (30 - PHI_CLOSED))) : mixPose(XP.neutral, XP.open, clamp01((phi - 30) / (PHI_OPEN - 30)));

const rad = (d: number) => (d * Math.PI) / 180;

/** Racket geometry relative to the hip for a pose, face angle and morph amount. */
const racketGeo = (pose: Pose, phi: number, grow: number) => {
  const j = solve(pose, H);
  const dir = { x: Math.sin(rad(phi)), y: Math.cos(rad(phi)) };
  const n = { x: dir.y, y: -dir.x };
  const a = H * (0.065 + 0.05 * grow);
  const along = 0.03 * H + a * 0.62;
  const c = { x: j.na.x + dir.x * along, y: j.na.y + dir.y * along };
  const off = BR + 0.009 * H;
  const onRacket = { x: c.x + n.x * off, y: c.y + n.y * off };
  const lb = lacesBall(pose, H, BR);
  const ball = { x: lerp(lb.x, onRacket.x, grow), y: lerp(lb.y, onRacket.y, grow) };
  return { j, dir, n, ball };
};

/** Zoom between two cameras while the anchor point glides on screen (no empty frames mid-zoom). */
const anchoredCam = (t: number, a: Cam, b: Cam, anchor: { x: number; y: number }): Cam => {
  const zoom = Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), t));
  const sa = toScreen(a, anchor);
  const sb = toScreen(b, anchor);
  const sx = lerp(sa.x, sb.x, t);
  const sy = lerp(sa.y, sb.y, t);
  return { x: anchor.x - (sx - WIDTH / 2) / zoom, y: anchor.y - (sy - HEIGHT / 2) / zoom, zoom };
};

/** A launch arrow with a dashed level line and an angle arc (no numbers), in screen space. */
const LaunchArrow: React.FC<{ bx: number; by: number; r: number; phi: number; len: number; grow: number; color: string; width: number }> = ({ bx, by, r, phi, len, grow, color, width }) => {
  const d = { x: Math.cos(rad(phi)), y: -Math.sin(rad(phi)) };
  const end = { x: bx + d.x * (r + len * grow), y: by + d.y * (r + len * grow) };
  const start = { x: bx + d.x * r * 1.1, y: by + d.y * r * 1.1 };
  const ang = Math.atan2(d.y, d.x);
  const head = width * 3.1;
  const arcR = len * 0.55;
  const arcEnd = { x: bx + Math.cos(rad(phi)) * arcR, y: by - Math.sin(rad(phi)) * arcR };
  return (
    <g>
      <line x1={bx + r * 1.2} y1={by} x2={bx + len * 0.95} y2={by} stroke={XRAY.bone} strokeWidth={4} strokeDasharray="10 10" strokeLinecap="round" opacity={0.55} />
      <path d={`M${bx + arcR},${by} A${arcR},${arcR} 0 0 0 ${arcEnd.x},${arcEnd.y}`} fill="none" stroke={color} strokeWidth={4} opacity={0.75 * grow} />
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path
        d={`M${end.x + Math.cos(ang) * head * 0.6},${end.y + Math.sin(ang) * head * 0.6} L${end.x + Math.cos(ang + 2.5) * head},${end.y + Math.sin(ang + 2.5) * head} L${end.x + Math.cos(ang - 2.5) * head},${end.y + Math.sin(ang - 2.5) * head} Z`}
        fill={color}
        stroke={color}
        strokeWidth={4}
        strokeLinejoin="round"
      />
    </g>
  );
};

/**
 * A flight trail drawn to stand out on the X-ray grid: a soft wide glow under a solid line.
 * `px` is the line width in screen pixels (the stroke is divided by the camera zoom).
 */
const GlowTrail: React.FC<{ path: BallState[]; view: View; at: number; frame: number; maxF: number; color: string; zoom: number; px?: number; opacity?: number }> = ({
  path,
  view,
  at,
  frame,
  maxF,
  color,
  zoom,
  px = 5,
  opacity = 1,
}) => {
  const f = Math.min(Math.max(0, frame - at), maxF);
  if (f <= 0) return null;
  const pts = path.slice(0, Math.min(path.length, Math.floor(f) + 1)).map((q) => project(q.pos, view));
  pts.push(project(sampleAt(path, f).pos, view));
  const d = pathD(pts);
  const w = px / zoom;
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={opacity}>
      <path d={d} stroke={color} strokeWidth={w * 4.4} opacity={0.12} />
      <path d={d} stroke={color} strokeWidth={w * 2.4} opacity={0.22} />
      <path d={d} stroke={color} strokeWidth={w} />
    </g>
  );
};

export const S15: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s15");

  // ---------- Beats ----------
  const tInstep = cue("Your instep");
  const tRacket = cue("tennis racket");
  const tToes = cue("Toes down");
  const tTilts = cue("it tilts forward");
  const tLean = cue("Lean back");
  const tFlies = cue("the ball flies over");
  const end = cue.frames;

  const morphAt = tRacket - 8;
  const unmorph = end - 24;
  const grow = pop(frame, morphAt, { stiffness: 150, damping: 15 }) * (1 - progress(frame, unmorph, 16, EASE.standard));
  const strings = progress(frame, morphAt + 4, 14, EASE.enter) * (1 - progress(frame, unmorph, 12));
  const handle = progress(frame, morphAt + 6, 14, EASE.enter) * (1 - progress(frame, unmorph, 12));
  // Pull out on "tilts": the cone, the dipping path and "aim high, it falls" all land on
  // "tilts forward", before "Lean back" starts.
  const pullOut = tTilts + 2;
  const pullDur = 24;
  const kick1 = pullOut + 8; // the ball dips under the bar about 24 frames later (end of "forward")
  const kick2 = tLean + 27; // on "and the ball flies over"

  // Face angle: neutral, then toes down (closed), then leaning back (open), then back to closed.
  // The toes-down tilt runs through "down, and it tilts", finishing as the pull-out starts.
  const phi = keys(frame, [tToes + 6, tTilts + 6, tLean + 2, tLean + 22, end - 28, end - 10], [30, PHI_CLOSED, PHI_CLOSED, PHI_OPEN, PHI_OPEN, PHI_CLOSED], EASE.standard);
  const basePose = poseForPhi(phi);
  const geo = racketGeo(basePose, phi, grow);
  // Keep the ball on its launch spot: move Tavi so the face meets it.
  const hipX = BALL0.x - geo.ball.x;
  const hipYNeed = BALL0.y - geo.ball.y;
  const lift = (GX - geo.j.lowest - hipYNeed) / H;
  const pose: Pose = { ...basePose, lift, torso: basePose.torso + idle(frame, 3, 3, 0.8) };
  const hipY = GX - geo.j.lowest - lift * H;
  const ankle = { x: hipX + geo.j.na.x, y: hipY + geo.j.na.y };
  const knee = { x: hipX + geo.j.nk.x, y: hipY + geo.j.nk.y };
  const toe = { x: hipX + geo.j.nToe.x, y: hipY + geo.j.nToe.y };

  // ---------- Camera ----------
  const focus = { x: BALL0.x - 0.3 * PPMX, y: GX - 0.8 * PPMX };
  const wide = { x: 988, y: GX - 318 };
  const closeA: Cam = { x: focus.x + 4, y: focus.y - 2, zoom: 6.6 };
  const wideA: Cam = { x: wide.x, y: wide.y, zoom: 1.0 };
  const wideB: Cam = { x: wide.x + 4, y: wide.y - 4, zoom: 1.015 };
  const endCam: Cam = { x: BALL0.x - 0.15 * PPMX, y: BALL0.y - 0.2 * PPMX, zoom: 6.4 };
  const zoomBack = end - 22;
  let cam: Cam;
  if (frame < pullOut) {
    const c = cameraAt(frame, [
      { f: 0, x: BALL0.x - 0.12 * PPMX, y: BALL0.y - 0.1 * PPMX, zoom: 9.5 },
      { f: 26, x: focus.x, y: focus.y, zoom: 6.2 },
      { f: pullOut, x: closeA.x, y: closeA.y, zoom: closeA.zoom },
    ]);
    cam = { x: c.x, y: c.y, zoom: c.zoom };
  } else if (frame < pullOut + pullDur) {
    cam = anchoredCam(progress(frame, pullOut, pullDur, EASE.camera), closeA, wideA, BALL0);
  } else if (frame < zoomBack) {
    const t = progress(frame, pullOut + pullDur, zoomBack - pullOut - pullDur, EASE.soft);
    cam = { x: lerp(wideA.x, wideB.x, t), y: lerp(wideA.y, wideB.y, t), zoom: lerp(wideA.zoom, wideB.zoom, t) };
  } else {
    cam = anchoredCam(progress(frame, zoomBack, end - zoomBack, EASE.camera), wideB, endCam, BALL0);
  }
  const S = (p: { x: number; y: number }) => toScreen(cam, p);

  // ---------- Balls and flights ----------
  const flight1On = frame >= kick1;
  const returnAt = kick2 - 16;
  const backAt = end - 22;
  const restScale = !flight1On ? 1 : frame >= backAt ? pop(frame, backAt) : frame >= returnAt && frame < kick2 ? pop(frame, returnAt) : 0;
  const v1 = { ...XV, originX: BALL0.x, groundY: BALL0.y + 0.4 * PPMX } as View;
  // On "Lean" the green idea steps back so the pink one leads (the balls stay full orange).
  const leanDim = 1 - 0.6 * progress(frame, tLean - 2, 10, EASE.standard);
  const path2Fade = 1 - progress(frame, end - 20, 12);

  // ---------- Cone of angles that score ----------
  const coneT = progress(frame, kick1 + 2, 14, EASE.enter) * (1 - progress(frame, end - 22, 10, EASE.exit));
  const coneLen = GOAL * PPMX * coneT;
  const cp = (deg: number) => ({ x: BALL0.x + coneLen, y: BALL0.y - Math.tan(rad(deg)) * coneLen });
  const cLo = cp(CONE_LO);
  const cHi = cp(CONE_HI);
  const barLine = visible(frame, pullOut + 8, tFlies + 20, 14, 10);
  const barY = GX - 2.44 * PPMX;

  // Lace lines on the boot before the morph.
  const lacesGlow = visible(frame, tInstep, morphAt + 14, 10, 8);
  const fdir = { x: toe.x - ankle.x, y: toe.y - ankle.y };
  const fl = Math.hypot(fdir.x, fdir.y) || 1;
  const fu = { x: fdir.x / fl, y: fdir.y / fl };
  const fn = { x: fu.y, y: -fu.x };
  const maskR = H * 0.1 * clamp01(grow * 1.6);
  const footMask = { x: ankle.x + fdir.x * 0.58, y: ankle.y + fdir.y * 0.58 };
  const footAng = (Math.atan2(fdir.y, fdir.x) * 180) / Math.PI;

  // ---------- The X-ray figure (drawn in the main view and again in the inset) ----------
  const figure = (id: string, vx0: number, vy0: number, vx1: number, vy1: number) => (
    <g>
      <defs>
        <mask id={`s15-foot-${id}`}>
          <rect x={vx0 - 10} y={vy0 - 10} width={vx1 - vx0 + 20} height={vy1 - vy0 + 20} fill="#fff" />
          <ellipse cx={footMask.x} cy={footMask.y} rx={Math.max(0.01, maskR)} ry={Math.max(0.01, maskR * 0.62)} transform={`rotate(${footAng} ${footMask.x} ${footMask.y})`} fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#s15-foot-${id})`}>
        <Player x={hipX} groundY={GX} h={H} pose={pose} ghost />
        <XRayLeg x={hipX} y={hipY} h={H} pose={pose} highlight={grow < 0.1 ? ["foot"] : []} highlightAmount={lacesGlow} />
      </g>
      {lacesGlow > 0.001
        ? [0.3, 0.45, 0.6, 0.75].map((t, i) => {
            const p = { x: ankle.x + fdir.x * t + fn.x * H * 0.035, y: ankle.y + fdir.y * t + fn.y * H * 0.035 };
            const w = H * 0.022;
            return <line key={i} x1={p.x - fu.x * w} y1={p.y - fu.y * w} x2={p.x + fu.x * w} y2={p.y + fu.y * w} stroke={XRAY.lime} strokeWidth={H * 0.009} strokeLinecap="round" opacity={lacesGlow} />;
          })
        : null}
      <Racket ankle={ankle} knee={knee} dir={geo.dir} h={H} grow={grow} strings={strings} handle={handle} id={`s15-${id}`} />
      {restScale > 0.001 ? (
        <g transform={`translate(${BALL0.x} ${BALL0.y}) scale(${restScale}) translate(${-BALL0.x} ${-BALL0.y})`}>
          <Ball cx={BALL0.x} cy={BALL0.y} r={BR} view={XV} axis={{ x: 0, y: 1, z: 0 }} angle={0.4} lineNormal={LINE_N} />
        </g>
      ) : null}
    </g>
  );

  // World grid (moves with the camera).
  const grid = (cm: Cam, w: number, h: number, key: string) => {
    const step = 0.5 * PPMX;
    const out: React.ReactNode[] = [];
    const ax0 = cm.x - w / 2 / cm.zoom;
    const ax1 = cm.x + w / 2 / cm.zoom;
    const ay0 = cm.y - h / 2 / cm.zoom;
    const ay1 = cm.y + h / 2 / cm.zoom;
    for (let gx = Math.floor((ax0 - OXX) / step) * step + OXX; gx <= ax1; gx += step) out.push(<line key={`${key}x${gx}`} x1={gx} y1={ay0} x2={gx} y2={ay1} />);
    for (let gy = Math.floor((ay0 - GX) / step) * step + GX; gy <= ay1; gy += step) out.push(<line key={`${key}y${gy}`} x1={ax0} y1={gy} x2={ax1} y2={gy} />);
    return {
      x0: ax0,
      x1: ax1,
      y0: ay0,
      y1: ay1,
      node: (
        <g>
          <g stroke={XRAY.grid} strokeWidth={2 / cm.zoom}>{out}</g>
          <rect x={ax0} y={GX} width={ax1 - ax0} height={Math.max(0, ay1 - GX) + 10} fill={XRAY.grid} opacity={0.35} />
          <line x1={ax0} y1={GX} x2={ax1} y2={GX} stroke={XRAY.tissue} strokeWidth={Math.max(3 / cm.zoom, 1.2)} />
        </g>
      ),
    };
  };
  const g = grid(cam, WIDTH, HEIGHT, "m");

  // ---------- Screen-space helpers ----------
  const bS = S(BALL0);
  const rS = BR * cam.zoom;
  // The launch arrow shows from "Toes down" and turns with the face. It stays on the ball through
  // the pull-out (shorter), so the real path picks up where it points.
  const arrow1 = visible(frame, tToes + 2, kick1 + 4, 12, 8);
  const arrowGrow = progress(frame, tToes + 2, 12, EASE.enter);
  const arrowLen = lerp(360, 240, progress(frame, pullOut, pullDur, EASE.camera));
  const arrowTip = { x: bS.x + Math.cos(rad(phi)) * (rS + arrowLen), y: bS.y - Math.sin(rad(phi)) * (rS + arrowLen) };
  const flash1 = frame >= kick1 && frame < kick1 + 8 ? 1 - (frame - kick1) / 8 : 0;

  // Inset for "lean back": a close-up bubble of the contact.
  const insetS = pop(frame, tLean - 3, { stiffness: 170, damping: 16 }) * (1 - progress(frame, end - 24, 9, EASE.exit));
  const IC = { x: 470, y: 330 };
  const IR = 250;
  const icam: Cam = { x: BALL0.x - 0.34 * PPMX, y: GX - 0.86 * PPMX, zoom: 2.3 };
  const ig = grid(icam, IR * 2, IR * 2, "i");
  const iBall = { x: IR * 0 + (BALL0.x - icam.x) * icam.zoom, y: (BALL0.y - icam.y) * icam.zoom };
  const insetArrowCol = XRAY.pink; // the inset is the lean-back idea: pink from "Lean"
  const flash2 = frame >= kick2 && frame < kick2 + 8 ? 1 - (frame - kick2) / 8 : 0;

  // "laces = strings" sits beside the racket face. Racket centre as in Racket (s13-s15-volley).
  const lacesAt = tRacket + 2;
  const lacesTag = visible(frame, lacesAt + 2, tToes - 2, 8, 8) * strings;
  const rkA = H * (0.065 + 0.05 * grow);
  const strS = S({ x: ankle.x + geo.dir.x * (H * 0.03 + rkA), y: ankle.y + geo.dir.y * (H * 0.03 + rkA) });
  const lacesLbl = { x: strS.x + 190, y: strS.y + 70 };

  return (
    <Stage bg={XRAY.bg}>
      <g transform={worldT(cam)}>
        {g.node}
        <XGoalSide view={XV} goalX={GOAL} />
        {/* Bar height guide while the path dips under it. */}
        <line x1={OXX + 6 * PPMX} y1={barY} x2={OXX + GOAL * PPMX} y2={barY} stroke={XRAY.bone} strokeWidth={2.2 / Math.min(cam.zoom, 1.4)} strokeDasharray="6 10" opacity={0.45 * barLine} />
        {/* Cone of take-off angles that score. */}
        {coneT > 0.001 ? (
          <g opacity={leanDim}>
            <path d={`M${BALL0.x},${BALL0.y} L${cLo.x},${cLo.y} L${cHi.x},${cHi.y} Z`} fill={XRAY.lime} opacity={0.13} />
            <line x1={BALL0.x} y1={BALL0.y} x2={cLo.x} y2={cLo.y} stroke={XRAY.lime} strokeWidth={2.5} opacity={0.6} strokeDasharray="10 8" />
            <line x1={BALL0.x} y1={BALL0.y} x2={cHi.x} y2={cHi.y} stroke={XRAY.lime} strokeWidth={2.5} opacity={0.6} strokeDasharray="10 8" />
          </g>
        ) : null}
        {figure("m", g.x0, g.y0, g.x1, g.y1)}
        {/* Scoring path: a bright lime line with a soft glow. The ball stays full orange. */}
        {flight1On ? (
          <g opacity={1 - progress(frame, end - 22, 12)}>
            <GlowTrail path={VOLLEY} view={v1} at={kick1} frame={frame} maxF={V_IN_NET} color={XRAY.lime} zoom={cam.zoom} px={5} opacity={leanDim} />
            <Flight path={VOLLEY} view={v1} at={kick1} r={BR * 1.3} maxT={V_IN_NET / 30} trail={false} lineNormal={LINE_N} />
          </g>
        ) : null}
        {frame >= kick2 ? (
          <g opacity={path2Fade}>
            <GlowTrail path={OPEN} view={v1} at={kick2} frame={frame} maxF={O_OUT} color={XRAY.pink} zoom={cam.zoom} px={5} />
            <Flight path={OPEN} view={v1} at={kick2} r={BR * 1.3} maxT={O_OUT / 30} trail={false} lineNormal={LINE_N} />
          </g>
        ) : null}
      </g>

      {flash1 > 0 ? <Glow cx={bS.x} cy={bS.y} r={Math.max(40, rS * 3)} color={XRAY.bone} intensity={flash1 * 1.5} rings={4} /> : null}
      {flash2 > 0 ? <Glow cx={bS.x} cy={bS.y} r={40} color={XRAY.pink} intensity={flash2 * 1.5} rings={4} /> : null}

      {/* Close-up launch arrow (toes down: still about 23 degrees up). */}
      {arrow1 > 0.001 ? (
        <g opacity={arrow1}>
          <LaunchArrow bx={bS.x} by={bS.y} r={rS} phi={phi} len={arrowLen} grow={arrowGrow} color={XRAY.lime} width={12} />
        </g>
      ) : null}

      {/* Inset: leaning back opens the face. */}
      {insetS > 0.001 ? (
        <g transform={`translate(${IC.x} ${IC.y}) scale(${insetS})`}>
          <defs>
            <clipPath id="s15-inset">
              <circle r={IR} />
            </clipPath>
          </defs>
          <circle r={IR + 10} fill={insetArrowCol} />
          <circle r={IR} fill={XRAY.bg} />
          <g clipPath="url(#s15-inset)">
            <g transform={`scale(${icam.zoom}) translate(${-icam.x} ${-icam.y})`}>
              {ig.node}
              {figure("i", ig.x0, ig.y0, ig.x1, ig.y1)}
            </g>
            <LaunchArrow bx={iBall.x} by={iBall.y} r={BR * icam.zoom} phi={frame < tLean + 2 ? PHI_CLOSED : phi} len={122} grow={progress(frame, tLean, 10, EASE.enter)} color={insetArrowCol} width={9} />
          </g>
        </g>
      ) : null}

      {/* Labels */}
      {/* "laces = strings": next to the racket strings, with a short leader line. */}
      {lacesTag > 0.001 ? (
        <g opacity={lacesTag} stroke={XRAY.lime} strokeLinecap="round">
          <line x1={strS.x} y1={strS.y} x2={lacesLbl.x - 14} y2={lacesLbl.y} strokeWidth={5} />
          <circle cx={strS.x} cy={strS.y} r={9} fill={XRAY.lime} stroke="none" />
        </g>
      ) : null}
      <Label x={lacesLbl.x} y={lacesLbl.y} text="laces = strings" at={lacesAt} until={tToes - 2} size={56} anchor="start" bg={XRAY.lime} color={XRAY.bg} />
      <Label x={bS.x + 330} y={bS.y + 150} text="toes down" at={tToes + 4} until={pullOut} size={48} bg={XRAY.bone} color={XRAY.bg} />
      <Label x={arrowTip.x + 30} y={arrowTip.y - 8} text="still up" at={tToes + 18} until={kick1 - 3} size={48} anchor="start" bg={XRAY.lime} color={XRAY.bg} />
      <Label x={S({ x: OXX + 8.2 * PPMX, y: 0 }).x} y={S({ x: 0, y: GX - 5.6 * PPMX }).y} text="aim high, it falls" at={kick1 + 2} until={tLean - 2} size={48} bg={XRAY.lime} color={XRAY.bg} />
      <Label x={IC.x} y={IC.y + IR - 4} text="lean back" at={tLean + 2} until={end - 26} size={48} bg={XRAY.pink} color={XRAY.bg} />
      <Label x={S({ x: OXX + 12.2 * PPMX, y: 0 }).x} y={S({ x: 0, y: GX - 6.6 * PPMX }).y} text="over the bar" at={kick2 + 20} until={end - 16} size={44} bg={XRAY.pink} color={XRAY.bg} />

      {/* Fade in from the pitch close-up (s14 ends on a dark X-ray tint). */}
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={XRAY.bg} opacity={0.7 * (1 - progress(frame, 0, 12, EASE.soft))} />

      {/* SFX */}
      <Sfx name="blip" at={tInstep + 2} volume={0.3} />
      <Sfx name="pop-soft" at={morphAt} volume={0.5} />
      <Sfx name="clang" at={morphAt + 6} volume={0.18} />
      <Sfx name="whoosh" at={tToes + 4} volume={0.3} />
      <Sfx name="pop" at={tTilts} volume={0.3} />
      <Sfx name="whoosh-long" at={pullOut} volume={0.3} />
      <Sfx name="thump" at={kick1} volume={0.45} />
      <Sfx name="blip" at={kick1 + 6} volume={0.3} />
      <Sfx name="net" at={kick1 + crossIdx(VOLLEY, GOAL)} volume={0.35} />
      <Sfx name="pop" at={tLean - 4} volume={0.3} />
      <Sfx name="whoosh" at={tLean + 2} volume={0.3} />
      <Sfx name="thump" at={kick2} volume={0.45} />
      <Sfx name="whoosh-long" at={kick2 + 4} volume={0.35} />
      <Sfx name="subdrop" at={end - 22} volume={0.4} />
    </Stage>
  );
};
