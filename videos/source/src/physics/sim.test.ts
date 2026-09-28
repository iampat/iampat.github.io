import { describe, expect, it } from "vitest";
import {
  BALL,
  crossingAtX,
  dragForce,
  revPerSec,
  simulate,
  spinPushCoefficient,
  v3,
} from "./sim";

// Targets come from the fact-checked "safe numbers" in research/wf1-result.json.

describe("laces drive", () => {
  it("meets about 3.25 N of air brake at 25 m/s", () => {
    // Laces drive spins about 4 turns per second.
    const f = dragForce(25, revPerSec(4));
    expect(f).toBeGreaterThan(2.9);
    expect(f).toBeLessThan(3.6);
  });

  it("loses about 5-6 m/s over 18 m", () => {
    const path = simulate({ speed: 25, elevationDeg: 6, spin: v3(0, -revPerSec(4), 0), ground: false });
    const at18 = crossingAtX(path, 18)!;
    const speedLoss = 25 - Math.hypot(at18.vel.x, at18.vel.y, at18.vel.z);
    expect(speedLoss).toBeGreaterThan(3.5);
    expect(speedLoss).toBeLessThan(6.5);
  });
});

describe("inside-foot curler (right foot)", () => {
  // Anticlockwise from above = +z spin. Measured spin axes tilt ~63 deg from horizontal,
  // which adds a little backspin.
  const tilt = (63 * Math.PI) / 180;
  const w = revPerSec(8);
  const spin = v3(0, -w * Math.cos(tilt), w * Math.sin(tilt));
  const path = simulate({ speed: 20, elevationDeg: 10, spin, ground: false });
  const at20 = crossingAtX(path, 20)!;

  it("bends right to left", () => {
    expect(at20.pos.y).toBeGreaterThan(0); // +y is left
  });

  it("drifts about 2.5-3 m over 20 m", () => {
    expect(at20.pos.y).toBeGreaterThan(2.2);
    expect(at20.pos.y).toBeLessThan(3.2);
  });

  it("drifts about four times as far at twice the distance", () => {
    const at10 = crossingAtX(path, 10)!;
    const ratio = at20.pos.y / at10.pos.y;
    expect(ratio).toBeGreaterThan(3.4);
    expect(ratio).toBeLessThan(4.6);
  });

  it("takes about one second to travel 20 m", () => {
    expect(at20.t).toBeGreaterThan(0.9);
    expect(at20.t).toBeLessThan(1.3);
  });

  it("loses much more speed than spin", () => {
    const end = path[30]; // 1 s
    const speedLoss = 1 - Math.hypot(end.vel.x, end.vel.y, end.vel.z) / 20;
    const spinLoss = 1 - Math.hypot(end.spin.x, end.spin.y, end.spin.z) / w;
    expect(speedLoss).toBeGreaterThan(0.15);
    expect(spinLoss).toBeLessThan(0.03);
  });
});

describe("chip with backspin", () => {
  // About 50 km/h at 45 deg with 6 turns per second of backspin.
  const path = simulate({ speed: 13.5, elevationDeg: 45, spin: v3(0, -revPerSec(6), 0) });

  it("clears a keeper and drops under a youth bar from about 12-14 m", () => {
    const land = path.find((s) => s.bounces > 0)!;
    expect(land.pos.x).toBeGreaterThan(11);
    expect(land.pos.x).toBeLessThan(16);
    // Hangs about 1.6-2.4 s.
    expect(land.t).toBeGreaterThan(1.5);
    expect(land.t).toBeLessThan(2.4);
  });

  it("rises higher than the same kick with no spin", () => {
    const flat = simulate({ speed: 13.5, elevationDeg: 45 });
    const apex = (p: typeof path) => Math.max(...p.map((s) => s.pos.z));
    const gain = apex(path) - apex(flat);
    expect(gain).toBeGreaterThan(0.2);
    expect(gain).toBeLessThan(1.0);
  });

  it("keeps less forward speed after the bounce than a topspin ball", () => {
    const bounceKeep = (spinY: number) => {
      const p = simulate({ speed: 13.5, elevationDeg: 45, spin: v3(0, spinY, 0) });
      const i = p.findIndex((s) => s.bounces > 0);
      return p[i].vel.x / p[i - 1].vel.x;
    };
    expect(bounceKeep(-revPerSec(6))).toBeLessThan(bounceKeep(revPerSec(6)));
  });
});

describe("volley with topspin", () => {
  it("gets a push of a third to a half of its weight at 90 km/h and 4 turns/s", () => {
    const q = 0.5 * 1.2 * BALL.area * 25 * 25;
    const push = q * spinPushCoefficient(25, revPerSec(4));
    const weight = BALL.mass * 9.81;
    expect(push / weight).toBeGreaterThan(0.3);
    expect(push / weight).toBeLessThan(0.55);
  });

  it("dips up to about a metre lower than with no spin", () => {
    // Verified scenario: 90 km/h, 4 turns per second of topspin, 16 m, knee-height contact.
    const start = v3(0, 0, 0.45);
    const top = simulate({ speed: 25, elevationDeg: 12, start, spin: v3(0, revPerSec(4), 0), ground: false });
    const none = simulate({ speed: 25, elevationDeg: 12, start, ground: false });
    const dz = crossingAtX(none, 16)!.pos.z - crossingAtX(top, 16)!.pos.z;
    expect(dz).toBeGreaterThan(0.6);
    expect(dz).toBeLessThan(1.2);
  });
});

describe("sanity", () => {
  it("with no air, matches a plain throw", () => {
    const p = simulate({ speed: 10, elevationDeg: 45, noAir: true, ground: false, start: v3(0, 0, 0) });
    const t = (2 * 10 * Math.sin(Math.PI / 4)) / 9.81;
    const land = p.find((s) => s.t > 0.1 && s.pos.z <= 0)!;
    expect(Math.abs(land.t - t)).toBeLessThan(0.05);
  });

  it("uses a ball of the right size", () => {
    expect(BALL.radius * 2).toBeCloseTo(0.22, 2);
  });
});
