// The city at night seen from far above, for the last pull-back in s23. The stadium sits at
// the centre (960, 540) with its lights off, and one warm dot (the ball's Line) stays lit.
// Units: 1 unit = 1 m on the pitch, and = 1 px when the camera scale is 1.

import React from "react";
import { random, useCurrentFrame } from "remotion";
import { PITCH } from "../../theme";
import { Glow } from "../World";

export const CITY_CENTRE = { x: 960, y: 540 };
const PITCH_L = 105;
const PITCH_W = 68;

type Block = { x: number; y: number; w: number; h: number; kind: "house" | "park" | "stadium"; wins: { x: number; y: number; o: number; n: number }[] };

const buildCity = () => {
  const cols: number[] = [];
  const rows: number[] = [];
  let x = -700;
  let i = 0;
  while (x < 2620) {
    cols.push(x);
    x += 80 + random(`cc-${i++}`) * 70;
  }
  let y = -500;
  i = 0;
  while (y < 1580) {
    rows.push(y);
    y += 70 + random(`cr-${i++}`) * 60;
  }
  const road = 14;
  const blocks: Block[] = [];
  const stadium = { x: CITY_CENTRE.x - 110, y: CITY_CENTRE.y - 80, w: 220, h: 160 };
  for (let c = 0; c < cols.length - 1; c++) {
    for (let r = 0; r < rows.length - 1; r++) {
      const bx = cols[c] + road / 2;
      const by = rows[r] + road / 2;
      const bw = cols[c + 1] - cols[c] - road;
      const bh = rows[r + 1] - rows[r] - road;
      // Leave room for the stadium block.
      if (bx < stadium.x + stadium.w + 10 && bx + bw > stadium.x - 10 && by < stadium.y + stadium.h + 10 && by + bh > stadium.y - 10) continue;
      const cy = by + bh / 2;
      const riverMid = 900 + 60 * Math.sin((bx + bw / 2) / 380);
      if (Math.abs(cy - riverMid) < 70) continue;
      const seed = `${c}-${r}`;
      const park = random(`park-${seed}`) < 0.1;
      // A few warm lit windows per block (low density), so the blocks read as houses at night.
      const wins: Block["wins"] = [];
      if (!park) {
        const n = Math.floor((bw * bh) / 520);
        for (let k = 0; k < n; k++) {
          if (random(`w-on-${seed}-${k}`) < 0.9) continue;
          // A short row of 1-3 lit windows (one floor of a house).
          wins.push({
            x: bx + 10 + random(`wx-${seed}-${k}`) * (bw - 34),
            y: by + 10 + random(`wy-${seed}-${k}`) * (bh - 20),
            o: 0.55 + random(`wo-${seed}-${k}`) * 0.3,
            n: 1 + Math.floor(random(`wn-${seed}-${k}`) * 3),
          });
        }
      }
      blocks.push({ x: bx, y: by, w: bw, h: bh, kind: park ? "park" : "house", wins });
    }
  }
  const lamps: { x: number; y: number }[] = [];
  for (const cx of cols) for (let yy = -500; yy < 1580; yy += 44) lamps.push({ x: cx, y: yy });
  for (const ry of rows) for (let xx = -700; xx < 2620; xx += 44) lamps.push({ x: xx, y: ry });
  return { cols, rows, blocks, lamps, stadium };
};

const CITY = buildCity();

/** The city map. `dot` = the warm dot's position (city units), `dotGlow` 0..1, `tavi` = his position. */
export const CityMap: React.FC<{ dot: { x: number; y: number }; dotGlow: number; tavi?: { x: number; y: number; dir: number }; pxPerUnit: number }> = ({
  dot,
  dotGlow,
  tavi,
  pxPerUnit,
}) => {
  const frame = useCurrentFrame();
  const { blocks, lamps, stadium, cols, rows } = CITY;
  const P = { x: CITY_CENTRE.x - PITCH_L / 2, y: CITY_CENTRE.y - PITCH_W / 2 };
  const hair = Math.max(0.12, 1.2 / pxPerUnit);
  // Window size: about 6 px on screen when far away, never smaller than 2.6 units close up.
  const win = Math.max(2.6, 6 / pxPerUnit);
  return (
    <g>
      <rect x={-900} y={-700} width={3700} height={2500} fill="#0B0F29" />
      {/* River. */}
      <path d="M-900,860 C 100,700 480,1010 1000,900 S 2100,700 2800,780 L2800,900 C 2100,830 1500,1060 1000,1020 S 100,860 -900,1010 Z" fill="#101A45" />
      {blocks.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={6} fill={b.kind === "park" ? "#0C3A33" : i % 3 === 0 ? "#1B2150" : PITCH.stands} opacity={b.kind === "park" ? 0.9 : 0.85} />
      ))}
      {/* Warm window lights, a few per block. */}
      {blocks.map((b, i) =>
        b.wins.map((w, k) => (
          <g key={`${i}-${k}`} opacity={w.o * (0.85 + 0.15 * Math.sin(frame / 9 + i + k))} fill={PITCH.light}>
            {Array.from({ length: w.n }, (_, m) => (
              <rect key={m} x={w.x + m * win * 1.7} y={w.y - win / 2} width={win} height={win} rx={win * 0.25} />
            ))}
          </g>
        )),
      )}
      {/* Street lamps: faint, so the stadium dot stays the brightest point. */}
      {lamps.map((l, i) => (
        <circle key={`l${i}`} cx={l.x} cy={l.y} r={1.2} fill={PITCH.light} opacity={0.22} />
      ))}
      {/* Cars: small light pairs moving along a few roads. */}
      {Array.from({ length: 18 }, (_, i) => {
        const vertical = i % 2 === 0;
        const lane = vertical ? cols[(i * 7) % cols.length] : rows[(i * 5) % rows.length];
        const speed = 1.2 + random(`car-s-${i}`) * 1.6;
        const off = random(`car-o-${i}`) * 3000;
        const pos = ((off + frame * speed) % 3200) - 700;
        const cx = vertical ? lane + 3 : pos;
        const cy = vertical ? pos : lane + 3;
        return <circle key={`car${i}`} cx={cx} cy={cy} r={1.8} fill={i % 3 === 0 ? PITCH.accent : PITCH.chalk} opacity={0.8} />;
      })}
      {/* The stadium: dark stands around a dark pitch, lights off. */}
      <rect x={stadium.x} y={stadium.y} width={stadium.w} height={stadium.h} rx={40} fill={PITCH.standsLight} opacity={0.55} />
      <rect x={stadium.x + 14} y={stadium.y + 14} width={stadium.w - 28} height={stadium.h - 28} rx={30} fill={PITCH.stands} />
      <rect x={P.x - 4} y={P.y - 4} width={PITCH_L + 8} height={PITCH_W + 8} rx={3} fill={PITCH.grassDark} />
      {Array.from({ length: 10 }, (_, i) => (i % 2 ? <rect key={`s${i}`} x={P.x + (i * PITCH_L) / 10} y={P.y} width={PITCH_L / 10} height={PITCH_W} fill={PITCH.grass} opacity={0.4} /> : null))}
      <rect x={P.x - 4} y={P.y - 4} width={PITCH_L + 8} height={PITCH_W + 8} rx={3} fill="#0B0F29" opacity={0.45} />
      <g fill="none" stroke={PITCH.chalk} strokeWidth={Math.max(0.12, hair)} opacity={0.4}>
        <rect x={P.x} y={P.y} width={PITCH_L} height={PITCH_W} />
        <line x1={CITY_CENTRE.x} y1={P.y} x2={CITY_CENTRE.x} y2={P.y + PITCH_W} />
        <circle cx={CITY_CENTRE.x} cy={CITY_CENTRE.y} r={9.15} />
        <rect x={P.x + PITCH_L - 16.5} y={CITY_CENTRE.y - 20.16} width={16.5} height={40.32} />
        <rect x={P.x} y={CITY_CENTRE.y - 20.16} width={16.5} height={40.32} />
      </g>
      {/* Four dark floodlight pads at the corners. */}
      {[
        [stadium.x + 22, stadium.y + 22],
        [stadium.x + stadium.w - 22, stadium.y + 22],
        [stadium.x + 22, stadium.y + stadium.h - 22],
        [stadium.x + stadium.w - 22, stadium.y + stadium.h - 22],
      ].map(([x, y], i) => (
        <circle key={`fl${i}`} cx={x} cy={y} r={4} fill={PITCH.standsLight} />
      ))}
      {/* The last warm dot: the ball's Line. Its glow keeps a minimum screen size as we pull back. */}
      <Glow cx={dot.x} cy={dot.y} r={Math.max(3.5, 44 / pxPerUnit) * (1 + 0.08 * Math.sin(frame / 7))} color={PITCH.light} intensity={2 * dotGlow} rings={5} />
      <circle cx={dot.x} cy={dot.y} r={Math.max(0.35, 4.5 / pxPerUnit)} fill={PITCH.lightSoft} opacity={dotGlow} />
      {tavi && pxPerUnit > 3 ? (
        <g transform={`translate(${tavi.x} ${tavi.y}) rotate(${tavi.dir})`} opacity={Math.min(1, (pxPerUnit - 3) / 5)}>
          <ellipse cx={0} cy={0} rx={0.18} ry={0.26} fill={PITCH.teal} />
          <circle cx={0.02} cy={0} r={0.12} fill={PITCH.stands} />
        </g>
      ) : null}
    </g>
  );
};
