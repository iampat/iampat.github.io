import { describe, expect, it } from "vitest";
import { bubbleSeconds, chaseDistance, firstTouch, reboundFraction, rollAt, rollDistance, rollPass, timeToArrive } from "./touch";
import { v3 } from "./sim";

describe("first touch", () => {
  it("a firm still foot bounces the ball back at about e times its speed", () => {
    expect(reboundFraction(10, 0, 0.6)).toBeCloseTo(0.6, 2);
  });

  it("a foot that gives way at half the ball's speed cuts the rebound to a fifth", () => {
    // v_out = v_foot - e (v_ball - v_foot): 10 m/s ball, foot moving back at 5 m/s, e 0.6
    // -> rebound 5 - 0.6*5 = 2 m/s relative to the ground... the ball moves back at 2 m/s? No:
    // foot back at -5, ball at -10: rel = -5, out = -5 + 3 = -2: the ball keeps moving at 2 m/s
    // in its own direction, so it stays in front of the foot instead of bouncing away.
    const out = firstTouch({ ballVel: v3(-10, 0, 0), footVel: v3(-5, 0, 0), normal: v3(1, 0, 0), e: 0.6 });
    expect(out.x).toBeCloseTo(-2, 5);
    expect(Math.abs(out.x) / 10).toBeLessThanOrEqual(0.2);
  });

  it("a foot moving into the ball sends it back faster than it came", () => {
    const out = firstTouch({ ballVel: v3(-10, 0, 0), footVel: v3(4, 0, 0), normal: v3(1, 0, 0), e: 0.6 });
    expect(out.x).toBeGreaterThan(10);
  });

  it("an angled foot redirects the ball (touch into space)", () => {
    // Ball coming along -x; foot face turned 45 degrees sends it off sideways.
    const n = v3(Math.SQRT1_2, Math.SQRT1_2, 0);
    const out = firstTouch({ ballVel: v3(-8, 0, 0), footVel: v3(-1.5, -1.5, 0), normal: n, e: 0.6, grip: 0.8 });
    expect(out.y).toBeGreaterThan(0.5); // pushed to +y
    expect(Math.hypot(out.x, out.y)).toBeLessThan(8); // and slower than it arrived
  });
});

describe("ground passes", () => {
  it("a 10 m/s pass rolls about 60 m on short grass before stopping, so it needs a touch", () => {
    expect(rollDistance(10)).toBeGreaterThan(50);
  });

  it("a 2 m/s first touch rolls about 2.5 m and stops", () => {
    const d = rollDistance(2);
    expect(d).toBeGreaterThan(2);
    expect(d).toBeLessThan(3.2);
    expect(rollAt(2, 5).v).toBe(0);
  });

  it("the rolling sim agrees with the closed form", () => {
    const path = rollPass(6, 0);
    const at2s = path[60];
    const closed = rollAt(6, 2);
    expect(Math.abs(at2s.pos.x - closed.x)).toBeLessThan(0.4);
    expect(at2s.pos.z).toBeCloseTo(0.11, 1);
  });
});

describe("time", () => {
  it("each metre of space is about a fifth of a second against a 6 m/s defender", () => {
    const perMetre = timeToArrive(1, 6, 0) ;
    expect(perMetre).toBeCloseTo(1 / 6, 3);
    expect(timeToArrive(3, 6) - timeToArrive(0, 6)).toBeCloseTo(0.5, 3);
  });
});

describe("the chase", () => {
  it("2.5 m away reads about 0.6 s, 9.6 m reads 2.4 s", () => {
    expect(bubbleSeconds(2.5)).toBeCloseTo(0.625, 3);
    expect(bubbleSeconds(9.6)).toBeCloseTo(2.4, 3);
  });
  it("every two metres is about half a second", () => {
    expect(bubbleSeconds(2)).toBeCloseTo(0.5, 3);
  });
  it("a defender 6 m away arrives in 1.5 s and stays there", () => {
    expect(chaseDistance(0, 6)).toBe(6);
    expect(chaseDistance(1.5, 6)).toBeCloseTo(0, 6);
    expect(chaseDistance(3, 6)).toBe(0);
    expect(chaseDistance(1, 6, 4, 0.3)).toBeCloseTo(3.2, 6);
  });
});
