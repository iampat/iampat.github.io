// Thumbnail concept B for "Three Spins and a Line" (1280x720). Owned by one builder agent.
// "THREE SPINS": three orange balls in a row, each with its white Line and a spin arrow
// (slow backspin, sideways, forward topspin), over three small flight paths from SHOTS
// (low drive, curl, dip). Tavi follows through on the left. Drawn at 1920x1080 in a viewBox.
import React from "react";
import { AbsoluteFill } from "remotion";
import { CAST, FONTS, PITCH } from "../../theme";
import { Ball } from "../../kit/Ball";
import { Player, POSES, solve, type Pose } from "../../kit/Player";
import { GroundSide, Stars } from "../../kit/World";
import { simulate, type BallState } from "../../physics/sim";
import { SHOTS } from "../../physics/shots";
import { pathD, type View } from "../../lib/project";

const W = 1920;
const H = 1080;

// Balls: seen from the side and a little above, so the sideways ring shows as an ellipse.
const PITCH_DEG = 22;
const VIEW: View = { kind: "persp", cam: { x: 0, y: 0, z: 0 }, yawDeg: 90, pitchDeg: -PITCH_DEG, focal: 1, cx: 0, cy: 0 };
const SIDE: View = { kind: "side", originX: 0, groundY: 0, ppm: 1 };

const R = 146;
const ROW_Y = 552;
const COLS = [850, 1262, 1674];
const PATH_BASE = 905;
const ICON_W = 300;
const GROUND_Y = PATH_BASE + 14;

const COLORS = [PITCH.light, PITCH.teal, CAST.mistake];

const PATH_DRIVE = simulate({ ...SHOTS.DRIVE_L, duration: 1.2 }, 60);
const PATH_CURL = simulate({ ...SHOTS.CURLER, duration: 1.6 }, 60).filter((q) => q.pos.x <= 20.01);
const PATH_VOLLEY = simulate({ ...SHOTS.VOLLEY, duration: 1.3 }, 60);

type Pt = { x: number; y: number };

/** A fat curved arrow on a circle round (cx, cy). Angles in degrees, SVG sense (y down). */
const ArcArrow: React.FC<{ cx: number; cy: number; r: number; from: number; to: number; color: string; width: number }> = ({ cx, cy, r, from, to, color, width }) => {
  const a0 = (from * Math.PI) / 180;
  const a1 = (to * Math.PI) / 180;
  const dir = to > from ? 1 : -1;
  const p = (a: number) => ({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  const s = p(a0);
  const headL = width * 2.1;
  const aBase = a1 - (dir * headL * 0.55) / r;
  const e = p(aBase + (dir * 4) / r);
  const tip = p(a1 + (dir * headL * 0.45) / r);
  const large = Math.abs(aBase - a0) > Math.PI ? 1 : 0;
  const tx = -Math.sin(a1) * dir;
  const ty = Math.cos(a1) * dir;
  const nx = -ty;
  const ny = tx;
  const base = p(aBase);
  const hw = width * 1.3;
  return (
    <g>
      <path d={`M${s.x},${s.y} A${r},${r} 0 ${large} ${dir > 0 ? 1 : 0} ${e.x},${e.y}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path
        d={`M${tip.x + tx * 2},${tip.y + ty * 2} L${base.x + nx * hw},${base.y + ny * hw} L${base.x - nx * hw},${base.y - ny * hw} Z`}
        fill={color}
        stroke={color}
        strokeWidth={width * 0.45}
        strokeLinejoin="round"
      />
    </g>
  );
};

/** Sideways spin: a flat ring round the ball. "back" is drawn before the ball, "front" (with the head) after it. */
const RingArrow: React.FC<{ cx: number; cy: number; rx: number; ry: number; color: string; width: number; part: "back" | "front" }> = ({ cx, cy, rx, ry, color, width, part }) => {
  const pt = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  };
  const arc = (d0: number, d1: number) => pathD(Array.from({ length: 41 }, (_, i) => pt(d0 + ((d1 - d0) * i) / 40)));
  if (part === "back") {
    return <path d={arc(340, 200)} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" opacity={0.5} />;
  }
  // Front half: the near side of the ball moves right (anticlockwise seen from above).
  const e = pt(22);
  const tip = pt(2);
  const dx = tip.x - e.x;
  const dy = tip.y - e.y;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  const hw = width * 1.3;
  return (
    <g>
      <path d={arc(165, 26)} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path
        d={`M${tip.x + (dx / L) * 8},${tip.y + (dy / L) * 8} L${e.x + nx * hw},${e.y + ny * hw} L${e.x - nx * hw},${e.y - ny * hw} Z`}
        fill={color}
        stroke={color}
        strokeWidth={width * 0.45}
        strokeLinejoin="round"
      />
    </g>
  );
};

/** Side-view icon points: true distances along, heights stretched by zs so the shape reads small. */
const sideIcon = (path: BallState[], cx: number, stopX: number, zs: number): Pt[] => {
  const s = ICON_W / stopX;
  return path.filter((q) => q.pos.x <= stopX + 0.01).map((q) => ({ x: cx - ICON_W / 2 + q.pos.x * s, y: PATH_BASE - q.pos.z * s * zs }));
};

/** The curler from above, drawn along a line that climbs to the right: along = towards goal, sideways stretched. */
const CURL_TILT = (24 * Math.PI) / 180;
const curlFrame = (cx: number) => {
  const s = ICON_W / 20;
  const d = { x: Math.cos(CURL_TILT), y: -Math.sin(CURL_TILT) };
  const l = { x: -Math.sin(CURL_TILT), y: -Math.cos(CURL_TILT) };
  const o = { x: cx - (ICON_W / 2) * Math.cos(CURL_TILT), y: PATH_BASE - 26 };
  const map = (fx: number, fy: number) => ({ x: o.x + d.x * fx * s + l.x * fy * s * 7, y: o.y + d.y * fx * s + l.y * fy * s * 7 });
  return { map, d, l, s };
};
const curlIcon = (cx: number): Pt[] => {
  const { map } = curlFrame(cx);
  return PATH_CURL.map((q) => map(q.pos.x, q.pos.y));
};

const Path: React.FC<{ pts: Pt[]; color: string }> = ({ pts, color }) => {
  const tip = pts[pts.length - 1];
  return (
    <g>
      <circle cx={pts[0].x} cy={pts[0].y} r={12} fill={PITCH.chalk} />
      <path d={pathD(pts)} fill="none" stroke={color} strokeWidth={19} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={tip.x} cy={tip.y} r={21} fill={CAST.ball} />
    </g>
  );
};

/** Side-view goal post and bar at the end of an icon. */
const PostBar: React.FC<{ x: number; barY: number }> = ({ x, barY }) => (
  <g stroke={PITCH.chalk} strokeLinecap="round" opacity={0.8}>
    <line x1={x} y1={PATH_BASE + 12} x2={x} y2={barY} strokeWidth={10} />
    <line x1={x} y1={barY} x2={x + 28} y2={barY + 13} strokeWidth={8} />
  </g>
);

const Icons: React.FC = () => {
  const zs = 2.3;
  const drive = sideIcon(PATH_DRIVE, COLS[0], 18, 1.8);
  const curl = curlIcon(COLS[1]);
  const dip = sideIcon(PATH_VOLLEY, COLS[2], 16, zs);
  const dTip = drive[drive.length - 1];
  const cf = curlFrame(COLS[1]);
  const c0 = cf.map(0, 0);
  const c1 = cf.map(20.6, 0);
  // The goal mouth, square to the kick line, where the curler crosses it.
  const cg = cf.map(20.6, PATH_CURL[PATH_CURL.length - 1].pos.y);
  const gw = 46;
  return (
    <g>
      {/* Drive: low and hard. */}
      <PostBar x={COLS[0] + ICON_W / 2 + 8} barY={PATH_BASE - 2.44 * (ICON_W / 18) * 1.8} />
      {[0, 1].map((i) => (
        <line key={i} x1={dTip.x - 70 - i * 30} y1={dTip.y - 34 - i * 22} x2={dTip.x - 140 - i * 30} y2={dTip.y - 34 - i * 22} stroke={COLORS[0]} strokeWidth={12} strokeLinecap="round" opacity={0.8} />
      ))}
      <Path pts={drive} color={COLORS[0]} />
      {/* Curl, from above: the straight line for comparison, then the bend into the goal mouth. */}
      <line x1={c0.x} y1={c0.y} x2={c1.x} y2={c1.y} stroke={PITCH.chalk} strokeWidth={6} strokeDasharray="2 16" strokeLinecap="round" opacity={0.5} />
      <line
        x1={cg.x + cf.l.x * gw + cf.d.x * 14}
        y1={cg.y + cf.l.y * gw + cf.d.y * 14}
        x2={cg.x - cf.l.x * gw + cf.d.x * 14}
        y2={cg.y - cf.l.y * gw + cf.d.y * 14}
        stroke={PITCH.chalk}
        strokeWidth={10}
        strokeLinecap="round"
        opacity={0.8}
      />
      <Path pts={curl} color={COLORS[1]} />
      {/* Dip: up, then down under the bar. */}
      <PostBar x={COLS[2] + ICON_W / 2 + 8} barY={PATH_BASE - 2.44 * (ICON_W / 16) * zs} />
      <Path pts={dip} color={COLORS[2]} />
    </g>
  );
};

/** Tavi after the strike, with short chalk whoosh lines behind the kicking boot. */
const Tavi: React.FC<{ x: number; groundY: number; h: number; pose: Pose }> = ({ x, groundY, h, pose }) => {
  const j = solve(pose, h);
  const dy = groundY - j.lowest - (pose.lift ?? 0) * h;
  const hip = { x, y: dy };
  const toe = { x: x + j.nToe.x, y: j.nToe.y + dy };
  const a1 = Math.atan2(toe.y - hip.y, toe.x - hip.x);
  const reach = Math.hypot(toe.x - hip.x, toe.y - hip.y);
  const whoosh = [0.92, 0.78, 0.64].map((k, i) => {
    const rr = reach * k;
    const pts = Array.from({ length: 16 }, (_, n) => {
      const a = a1 + (0.12 + (n / 15) * (0.75 - i * 0.12));
      return { x: hip.x + Math.cos(a) * rr, y: hip.y + Math.sin(a) * rr };
    });
    return <path key={i} d={pathD(pts)} fill="none" stroke={PITCH.chalk} strokeWidth={11 - i * 2} strokeLinecap="round" opacity={0.6 - i * 0.15} />;
  });
  return (
    <g>
      {whoosh}
      <Player x={x} groundY={groundY} h={h} pose={pose} face="focus" />
    </g>
  );
};

export const ThumbB: React.FC = () => {
  const arrowW = 22;
  const ringRy = R * 1.42 * Math.sin((PITCH_DEG * Math.PI) / 180) * 1.3;
  return (
    <AbsoluteFill style={{ backgroundColor: PITCH.skyHigh }}>
      <svg width={1280} height={720} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="tb-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={PITCH.skyHigh} />
            <stop offset="0.7" stopColor={PITCH.sky} />
            <stop offset="1" stopColor="#1E2552" />
          </linearGradient>
          <radialGradient id="tb-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={PITCH.lightSoft} stopOpacity={0.26} />
            <stop offset="0.55" stopColor={PITCH.lightSoft} stopOpacity={0.07} />
            <stop offset="1" stopColor={PITCH.lightSoft} stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect x={0} y={0} width={W} height={H} fill="url(#tb-sky)" />
        <Stars count={50} seed="thumbB" maxY={650} opacity={0.45} />
        {/* Floodlight wash behind the row. */}
        <ellipse cx={COLS[1]} cy={ROW_Y + 40} rx={880} ry={620} fill="url(#tb-glow)" />
        <GroundSide groundY={GROUND_Y} vanishX={640} />

        <Tavi x={330} groundY={1045} h={700} pose={POSES.follow} />

        <Icons />

        {/* 1: slow backspin (the drive). */}
        <Ball cx={COLS[0]} cy={ROW_Y} r={R} view={SIDE} axis={{ x: 0, y: -1, z: 0 }} lineNormal={{ x: 0.9, y: -0.28, z: -0.34 }} />
        <ArcArrow cx={COLS[0]} cy={ROW_Y} r={R * 1.28} from={-45} to={-128} color={COLORS[0]} width={arrowW} />

        {/* 2: sideways (the curler). The ring's far half goes behind the ball. */}
        <RingArrow cx={COLS[1]} cy={ROW_Y} rx={R * 1.42} ry={ringRy} color={COLORS[1]} width={arrowW} part="back" />
        <Ball cx={COLS[1]} cy={ROW_Y} r={R} view={VIEW} axis={{ x: 0, y: 0, z: 1 }} lineNormal={{ x: 0, y: 0, z: 1 }} />
        <RingArrow cx={COLS[1]} cy={ROW_Y} rx={R * 1.42} ry={ringRy} color={COLORS[1]} width={arrowW} part="front" />

        {/* 3: forward topspin (the volley). */}
        <Ball cx={COLS[2]} cy={ROW_Y} r={R} view={SIDE} axis={{ x: 0, y: 1, z: 0 }} lineNormal={{ x: 0.9, y: -0.28, z: 0.34 }} />
        <ArcArrow cx={COLS[2]} cy={ROW_Y} r={R * 1.28} from={-150} to={-32} color={COLORS[2]} width={arrowW} />

        {/* Title with a hard offset shadow. */}
        <g fontFamily={FONTS.title} fontWeight={800} fontSize={178} textAnchor="middle" letterSpacing={2}>
          <text x={W / 2 + 7} y={222 + 9} fill="#080B22">
            3 KICKS. 3 SPINS.
          </text>
          <text x={W / 2} y={222} fill={PITCH.chalk}>
            <tspan fill={CAST.ball}>3</tspan> KICKS. <tspan fill={CAST.ball}>3</tspan> SPINS.
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
