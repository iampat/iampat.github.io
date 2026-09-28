import { describe, expect, it } from "vitest";
import { crossingAtX, len, simulate, type BallState, type KickParams } from "./sim";
import { SHOTS, type ShotName } from "./shots";

// Stated outcomes from the storyboard's physics_sim fields. Tolerances: height 0.15 m,
// side 0.25 m, time 0.08 s.
const run = (name: ShotName) => {
  const p: KickParams = SHOTS[name];
  return simulate({ ...p, ground: p.ground ?? false, duration: 4 });
};
const at = (name: ShotName, x: number) => {
  const s = crossingAtX(run(name), x);
  if (!s) throw new Error(`${name} never reaches x = ${x}`);
  return s;
};
const near = (actual: number, expected: number, tol: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);

describe("storyboard shots", () => {
  it("MISS clears the bar by about half a metre", () => {
    const s = at("MISS", 18);
    near(s.pos.z, 3.06, 0.15);
    near(s.t, 1.05, 0.08);
    expect(s.pos.z - 0.11).toBeGreaterThan(2.44 + 0.3);
  });

  it("MISS without spin goes under the bar", () => {
    const s = at("MISS_NOSPIN", 18);
    near(s.pos.z, 1.25, 0.2);
  });

  it("DRIVE_R goes low inside the right post", () => {
    const s = at("DRIVE_R", 18);
    near(s.pos.y, -2.7, 0.25);
    near(s.pos.z, 0.43, 0.15);
    near(s.t, 0.97, 0.08);
  });

  it("DRIVE_L mirrors DRIVE_R", () => {
    const s = at("DRIVE_L", 18);
    near(s.pos.y, 2.7, 0.25);
    near(s.pos.z, 0.43, 0.15);
  });

  it("DRIVE_WALL stays under the knee-height tape", () => {
    const s = at("DRIVE_WALL", 10);
    expect(s.pos.z).toBeGreaterThan(0.11);
    expect(s.pos.z).toBeLessThan(0.45);
  });

  it("TOE_HIT is slower and arrives later", () => {
    const toe = at("TOE_HIT", 18);
    const drive = at("DRIVE_R", 18);
    near(toe.pos.y, -2.7, 0.3);
    near(toe.pos.z, 0.35, 0.2);
    near(toe.t - drive.t, 0.2, 0.08);
  });

  it("CURLER bends back on target, left", () => {
    const path = run("CURLER");
    const s = crossingAtX(path, 20)!;
    near(s.t, 1.3, 0.1);
    near(s.pos.z, 1.1, 0.25);
    // Gap from the launch line (8 deg right) at 20 m along it.
    const launchY = -Math.tan((8 * Math.PI) / 180) * 20;
    near(s.pos.y - launchY, 2.7, 0.35);
    // Clears the 1.8 m wall at 9.15 m.
    expect(crossingAtX(path, 9.15)!.pos.z).toBeGreaterThan(1.9);
  });

  it("CURLER_AIM_MISS bends back towards the middle", () => {
    const s = at("CURLER_AIM_MISS", 20);
    near(s.pos.y, 2.7, 0.35);
    near(s.pos.z, 1.0, 0.25);
  });

  it("DROP reaches knee height at about 20 km/h", () => {
    const path = run("DROP");
    const end = path[path.length - 1];
    near(end.t, 0.57, 0.05);
    near(len(end.vel) * 3.6, 20, 1.5);
  });

  it("VOLLEY dips under the bar; the no-spin ghost goes over", () => {
    const s = at("VOLLEY", 16);
    const g = at("VOLLEY_GHOST", 16);
    near(s.pos.y, -2.8, 0.3);
    near(s.pos.z, 1.81, 0.15);
    near(s.t, 0.98, 0.08);
    expect(s.pos.z).toBeLessThan(2.44 - 0.11);
    near(g.pos.z, 2.78, 0.15);
  });

  it("EASY scores and SMASH flies over at the same angle", () => {
    const e = at("EASY", 16);
    const s = at("SMASH", 16);
    near(e.pos.z, 1.52, 0.15);
    near(e.t, 0.95, 0.08);
    near(s.pos.z, 2.99, 0.15);
    near(s.t, 0.76, 0.08);
  });

  it("BOUNCE_DRILL rises to about a third of a metre (ball bottom)", () => {
    const path = simulate({ ...SHOTS.BOUNCE_DRILL });
    const after = path.filter((p: BallState) => p.bounces > 0);
    near(Math.max(...after.map((p) => p.pos.z)) - 0.11, 0.33, 0.06);
  });

  it("CHIP floats over the rushing keeper and drops under the bar", () => {
    const over = at("CHIP", 6);
    const line = at("CHIP", 14);
    near(over.pos.z, 4.5, 0.25);
    near(line.pos.z, 1.97, 0.2);
    near(line.t, 1.86, 0.1);
    const g = at("CHIP_GHOST", 14);
    near(g.pos.z, 1.08, 0.2);
  });

  it("KNUCKLE wobbles gently and stays in the knuckle speed band", () => {
    const path = run("KNUCKLE");
    const s = crossingAtX(path, 25)!;
    near(s.pos.z, 1.2, 0.2);
    near(s.t, 1.47, 0.1);
    near(len(s.vel), 15.7, 0.8);
    const side = path.filter((p) => p.pos.x <= 25).map((p) => Math.abs(p.pos.y));
    expect(Math.max(...side)).toBeLessThan(0.6);
  });
});
