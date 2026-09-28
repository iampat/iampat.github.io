import { describe, expect, it } from "vitest";
import {
  CHALK_START,
  DRILLS,
  ENDING_RUN,
  FEINT,
  TOUCHES,
  TURN_TIME,
  chalkAt,
  endingMeet,
  feintBallAfter,
  lookStepMeet,
  passInAt,
  passInPath,
  passInTimeToX,
  ringSeconds,
  rollDistance,
} from "./ep2sims";
import { rollAt } from "./touch";

const near = (a: number, b: number, tol: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
const speed = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);

describe("the pass in", () => {
  it("reaches Tavi's mark after about 2.1 s at about 4.8 m/s", () => {
    const t = passInTimeToX(0);
    near(t, 2.12, 0.03);
    near(passInAt(t).speed, 4.8, 0.05);
  });
  it("is halfway after about 1 s and at -4 m after 1.34 s at 5.43 m/s", () => {
    near(passInTimeToX(-6), 0.98, 0.03);
    const t = passInTimeToX(-4);
    near(t, 1.34, 0.03);
    near(passInAt(t).speed, 5.43, 0.05);
  });
  it("the sampled path agrees with the closed form", () => {
    const p = passInPath();
    near(p[60].pos.x, passInAt(2).x, 0.3);
  });
});

describe("Chalk's chase and the ring", () => {
  it("starts 11 m out and is 2.5 m away when the cold-open pass arrives: about 0.6 s", () => {
    near(Math.hypot(CHALK_START.x, CHALK_START.y), 11.0, 0.05);
    const c = chalkAt(2.12);
    near(c.remaining, 2.5, 0.1);
    near(ringSeconds(c.x, c.y, 0, 0), 0.63, 0.03);
  });
  it("reads about 2.4 s at the ending touch, four times the cold open", () => {
    const m = endingMeet();
    near(m.t, 1.34, 0.03);
    near(m.x, -4.0, 0.1);
    const c = chalkAt(m.t);
    const s = ringSeconds(c.x, c.y, m.x, m.y);
    near(s, 2.4, 0.08);
    expect(s / 0.63).toBeGreaterThan(3.5);
  });
  it("every two metres is about half a second", () => {
    near(ringSeconds(2, 0, 0, 0), 0.5, 0.001);
  });
});

describe("the look step", () => {
  it("meets the ball at about -0.9 m after 1.94 s, with Chalk about 4.1 m away (about 1 s)", () => {
    const m = lookStepMeet();
    near(m.t, 1.94, 0.03);
    near(m.x, -0.88, 0.08);
    near(m.speed, 4.95, 0.05);
    const c = chalkAt(m.t);
    near(Math.hypot(c.x - m.x, c.y), 4.1, 0.15);
    near(ringSeconds(c.x, c.y, m.x, 0), 1.03, 0.05);
  });
});

describe("touches (e = 0.35, a real foot)", () => {
  it("a stiff still foot returns roughly a third of the pass speed", () => {
    const s = TOUCHES.TOUCH_STIFF();
    near(s.x, -1.68, 0.02);
    const g = TOUCHES.STIFF_BOUNCE();
    const frac = speed(g) / 4.8;
    expect(frac).toBeGreaterThan(0.25);
    expect(frac).toBeLessThan(0.4);
    expect(g.x).toBeLessThan(0); // back towards Sam
    expect(g.y).toBeGreaterThan(0); // and off to one side
  });
  it("a foot giving way at about a quarter of the ball speed stops it dead", () => {
    near(speed(TOUCHES.TOUCH_CUSHION(1.25)), 0, 0.05);
    const soft = TOUCHES.TOUCH_CUSHION(1.6);
    near(soft.x, 0.48, 0.03);
    expect(rollDistance(soft.x)).toBeLessThan(0.3);
  });
  it("the touch into space leaves at 3 m/s away from Chalk and rolls about 2 m by the second touch", () => {
    const a = TOUCHES.TOUCH_AWAY();
    near(speed(a), 3.0, 0.05);
    expect(a.y).toBeGreaterThan(2); // to the open side
    near(rollAt(3.0, 0.8).x, 2.14, 0.05);
  });
  it("the back-foot touch goes forward and across at about 1.5 m/s", () => {
    const b = TOUCHES.BACK_FOOT();
    near(speed(b), 1.5, 0.08);
    expect(b.x).toBeGreaterThan(0.5);
    expect(b.y).toBeGreaterThan(1.0);
  });
  it("the ending touch goes almost straight across at about 2.3 m/s", () => {
    const e = TOUCHES.ENDING_TOUCH();
    near(speed(e), 2.26, 0.08);
    expect(Math.abs(e.x)).toBeLessThan(0.4);
    expect(e.y).toBeGreaterThan(2);
  });
  it("the wall rebound is killed by a foot giving at 0.8 m/s", () => {
    near(speed(TOUCHES.WALL_CUSHION()), 0, 0.05);
  });
});

describe("the dead stop vs the touch away, under pressure", () => {
  it("dead stop: Chalk is under a metre away after 0.8 s; touch away: about 2.6 m", () => {
    // From the look-step receive: ball at (-0.88, 0), Chalk 4.1 m away at (3.2, -0.5).
    const chalk = { x: 3.2, y: -0.5 };
    const deadLeft = Math.hypot(chalk.x + 0.88, chalk.y) - 4 * 0.8;
    near(deadLeft, 0.9, 0.1);
    const a = TOUCHES.TOUCH_AWAY();
    const d = rollAt(speed(a), 0.8).x;
    const ball = { x: -0.88 + (a.x / speed(a)) * d, y: (a.y / speed(a)) * d };
    // Chalk runs 3.2 m towards the ball's new spot.
    const toBall = Math.hypot(ball.x - chalk.x, ball.y - chalk.y);
    near(toBall - 3.2, 2.6, 0.3);
  });
});

describe("the turn, the feint, the drills", () => {
  it("a full turn costs 0.6 s, in which Chalk closes 2.4 m", () => {
    near(4 * TURN_TIME, 2.4, 0.01);
    near(ringSeconds(4.1 - 2.4, 0, 0, 0), 0.43, 0.01);
  });
  it("the feint: the ball is about 1.9 m away after 0.7 s and Chalk loses two steps", () => {
    near(feintBallAfter(0.7), 1.9, 0.05);
    near(4 * FEINT.wrongWay, 2, 0.01);
  });
  it("drill passes arrive when the storyboard says", () => {
    const arrive = (d: number, v: number) => {
      let lo = 0;
      let hi = v / 0.8;
      for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2;
        if (rollAt(v, mid).x < d) lo = mid;
        else hi = mid;
      }
      return lo;
    };
    near(arrive(DRILLS.b04.distance, DRILLS.b04.speed), 1.9, 0.1);
    near(arrive(DRILLS.b08.distance, DRILLS.b08.speed), 2.2, 0.1);
    near(arrive(DRILLS.b17.distance, DRILLS.b17.speed), 2.5, 0.1);
    near(rollDistance(DRILLS.boxTouch), 2.5, 0.05);
    near(rollDistance(DRILLS.gateTouch), 3.9, 0.05);
  });
  it("the ending run leaves at 0.2 s at 3.5 m/s", () => {
    expect(ENDING_RUN.leaveAt).toBe(0.2);
    expect(ENDING_RUN.speed).toBe(3.5);
  });
});
