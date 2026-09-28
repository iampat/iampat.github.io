// Ball flight simulation. Every ball path in the video comes from here, so the
// curves, dips and floats on screen match what real balls do.
//
// Axes: x = forward (towards goal), y = left, z = up. Units: SI (m, s, kg).
// Spin is an angular velocity vector in rad/s (right-hand rule):
//   +z  anticlockwise seen from above -> bends left (right-footer's inside curler)
//   +y  topspin                       -> dips
//   -y  backspin                      -> floats
//
// Coefficients come from the fact-checked research (research/wf1-result.json):
//   drag coefficient ~0.43 at low speed, ~0.2 at high speed, rises with spin
//   (Asai 2007, Carre 2002; 3.25 N at 25 m/s for a laces drive)
//   side-force coefficient ~0.1 at spin ratio 0.1 (Asai 2007), ~0.24-0.27 for curlers and
//   chips (Asai 2020, Goff & Carre), levelling off near 0.3
//   spin decays ~2% per second in flight (Bray & Kerwin)

export type Vec3 = { x: number; y: number; z: number };

export const BALL = {
  mass: 0.43, // kg
  radius: 0.11, // m
  area: Math.PI * 0.11 * 0.11, // m^2
};
export const AIR_DENSITY = 1.2; // kg/m^3
export const GRAVITY = 9.81; // m/s^2

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const scale = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);
const cross = (a: Vec3, b: Vec3): Vec3 =>
  v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const len = (a: Vec3) => Math.hypot(a.x, a.y, a.z);

export const revPerSec = (rps: number) => rps * 2 * Math.PI;
export const kmh = (ms: number) => ms * 3.6;

/** Spin ratio: how fast the ball's surface turns compared with how fast it flies. */
export const spinRatio = (speed: number, spinRate: number) =>
  speed > 0.01 ? (spinRate * BALL.radius) / speed : 0;

/** Drag coefficient: high below ~17 m/s, low above, and higher with more spin. */
export const dragCoefficient = (speed: number, spinRate: number) => {
  const smooth = 0.2 + 0.23 / (1 + Math.exp((speed - 17) / 2.5));
  return smooth + 0.15 * Math.min(spinRatio(speed, spinRate), 1);
};

/** Side-force (spin push) coefficient. */
export const spinPushCoefficient = (speed: number, spinRate: number) =>
  0.3 * Math.tanh(spinRatio(speed, spinRate) / 0.25);

export const dragForce = (speed: number, spinRate: number) =>
  0.5 * AIR_DENSITY * BALL.area * dragCoefficient(speed, spinRate) * speed * speed;

export type BallState = {
  t: number;
  pos: Vec3;
  vel: Vec3;
  spin: Vec3;
  /** Number of ground contacts so far. */
  bounces: number;
  onGround: boolean;
};

export type KickParams = {
  /** Launch speed in m/s. */
  speed: number;
  /** Launch angle above the ground, degrees. */
  elevationDeg: number;
  /** Direction in the ground plane, degrees. 0 = straight +x, positive = to the left. */
  azimuthDeg?: number;
  /** Spin vector in rad/s (see axis notes at the top). */
  spin?: Vec3;
  /** Start position (ball centre). Defaults to resting on the ground at the origin. */
  start?: Vec3;
  /** Seconds to simulate. Default 4. */
  duration?: number;
  /** Turn off the air for "no air" comparisons. */
  noAir?: boolean;
  /** Stop when the ball crosses this x (for example the goal line). */
  stopAtX?: number;
  /** Simulate ground bounces and rolling. Default true. */
  ground?: boolean;
  /** Bounce restitution (vertical), turf ~0.6. */
  restitution?: number;
  /** Ball-turf friction during a bounce. */
  friction?: number;
  /** Fixed drag coefficient (storyboard shots use 0.25 / 0.27 / 0.43). Default: speed-dependent model. */
  cd?: number;
  /** Spin-push coefficient model: "kit" (default, tanh fit) or "sqrt" (min(0.35, 0.5*sqrt(ratio))), or a fixed number. */
  cl?: "kit" | "sqrt" | number;
  /** Turn the spin push off (the ball still carries its spin for drawing). */
  spinPush?: boolean;
  /** Knuckleball wobble: a sideways force that follows a sine along the path. */
  sideForce?: { peakN: number; wavelengthM: number; phase: number };
  /** Stop when the ball falls to this height (for a dropped ball). */
  stopAtZ?: number;
  /** Rolling deceleration on the grass, m/s^2. Default 0.7. */
  rollDecel?: number;
};

const SPIN_DECAY_PER_S = 0.02;
const ROLL_DECEL = 0.7; // m/s^2, ball rolling on grass
const HOLLOW_I = (2 / 3) * BALL.mass * BALL.radius * BALL.radius;

type AirOptions = {
  noAir: boolean;
  cd?: number;
  cl: "kit" | "sqrt" | number;
  spinPush: boolean;
  sideForce?: { peakN: number; wavelengthM: number; phase: number };
};

const clOf = (model: AirOptions["cl"], speed: number, spinRate: number) =>
  typeof model === "number"
    ? model
    : model === "sqrt"
      ? Math.min(0.35, 0.5 * Math.sqrt(spinRatio(speed, spinRate)))
      : spinPushCoefficient(speed, spinRate);

const acceleration = (vel: Vec3, spin: Vec3, o: AirOptions, distance: number): Vec3 => {
  const g = v3(0, 0, -GRAVITY);
  if (o.noAir) return g;
  const speed = len(vel);
  if (speed < 1e-6) return g;
  const spinRate = len(spin);
  const q = 0.5 * AIR_DENSITY * BALL.area * speed * speed;
  const cd = o.cd ?? dragCoefficient(speed, spinRate);
  const drag = scale(vel, (-q * cd) / speed / BALL.mass);
  let push = v3();
  if (o.spinPush && spinRate > 1e-6) {
    const dir = cross(spin, vel); // spin x velocity
    const dirLen = len(dir);
    if (dirLen > 1e-9) {
      push = scale(dir, (q * clOf(o.cl, speed, spinRate)) / dirLen / BALL.mass);
    }
  }
  if (o.sideForce) {
    // Horizontal direction at right angles to the flight (to the left of travel).
    const hl = Math.hypot(vel.x, vel.y) || 1;
    const side = v3(-vel.y / hl, vel.x / hl, 0);
    const f = o.sideForce.peakN * Math.sin((2 * Math.PI * distance) / o.sideForce.wavelengthM + o.sideForce.phase);
    push = add(push, scale(side, f / BALL.mass));
  }
  return add(add(g, drag), push);
};

/** One bounce: vertical restitution plus a friction impulse at the contact point. */
const bounce = (s: BallState, e: number, mu: number): BallState => {
  const vz = s.vel.z;
  const vzOut = -e * vz;
  // Velocity of the contact point (bottom of the ball) in the ground plane.
  const rc = v3(0, 0, -BALL.radius);
  const contact = add(s.vel, cross(s.spin, rc));
  const slip = Math.hypot(contact.x, contact.y);
  let vel = v3(s.vel.x, s.vel.y, vzOut);
  let spin = s.spin;
  if (slip > 1e-6) {
    // Largest impulse friction can give, and the impulse that stops the slip (rolling).
    const jMax = mu * BALL.mass * (1 + e) * Math.abs(vz);
    const jRoll = slip / (1 / BALL.mass + (BALL.radius * BALL.radius) / HOLLOW_I);
    const j = Math.min(jMax, jRoll);
    const J = v3((-contact.x / slip) * j, (-contact.y / slip) * j, 0);
    vel = add(vel, scale(J, 1 / BALL.mass));
    spin = add(spin, scale(cross(rc, J), 1 / HOLLOW_I));
  }
  return { ...s, vel, spin, bounces: s.bounces + 1 };
};

/**
 * Simulate a kick and sample the state at a fixed frame rate.
 * Returns one state per frame, starting at t = 0.
 */
export const simulate = (p: KickParams, fps = 30): BallState[] => {
  const dt = 1 / 480;
  const duration = p.duration ?? 4;
  const az = ((p.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = (p.elevationDeg * Math.PI) / 180;
  const e = p.restitution ?? 0.6;
  const mu = p.friction ?? 0.5;
  const useGround = p.ground ?? true;
  const noAir = p.noAir ?? false;
  const air: AirOptions = { noAir, cd: p.cd, cl: p.cl ?? "kit", spinPush: p.spinPush ?? true, sideForce: p.sideForce };
  let distance = 0;

  let s: BallState = {
    t: 0,
    pos: p.start ?? v3(0, 0, BALL.radius),
    vel: v3(
      p.speed * Math.cos(el) * Math.cos(az),
      p.speed * Math.cos(el) * Math.sin(az),
      p.speed * Math.sin(el),
    ),
    spin: p.spin ?? v3(),
    bounces: 0,
    onGround: false,
  };

  const out: BallState[] = [];
  let nextSample = 0;
  const sampleStep = 1 / fps;
  let stopped = false;

  while (s.t <= duration + 1e-9) {
    while (s.t >= nextSample - 1e-9) {
      out.push({ ...s, pos: { ...s.pos }, vel: { ...s.vel }, spin: { ...s.spin } });
      nextSample += sampleStep;
    }
    if (stopped) {
      s = { ...s, t: s.t + dt };
      continue;
    }

    if (s.onGround) {
      // Rolling: slow down, spin matches rolling.
      const hs = Math.hypot(s.vel.x, s.vel.y);
      const newHs = Math.max(0, hs - (p.rollDecel ?? ROLL_DECEL) * dt);
      const f = hs > 1e-6 ? newHs / hs : 0;
      const vel = v3(s.vel.x * f, s.vel.y * f, 0);
      const spin = v3(-vel.y / BALL.radius, vel.x / BALL.radius, s.spin.z * 0.99);
      s = { ...s, t: s.t + dt, vel, spin, pos: add(s.pos, scale(vel, dt)) };
      if (newHs === 0) stopped = true;
    } else {
      // RK4 on position and velocity. Spin decays slowly and is held fixed over a step.
      const w = s.spin;
      const a1 = acceleration(s.vel, w, air, distance);
      const v2 = add(s.vel, scale(a1, dt / 2));
      const a2 = acceleration(v2, w, air, distance);
      const v3_ = add(s.vel, scale(a2, dt / 2));
      const a3 = acceleration(v3_, w, air, distance);
      const v4 = add(s.vel, scale(a3, dt));
      const a4 = acceleration(v4, w, air, distance);
      const vel = add(s.vel, scale(add(add(a1, scale(a2, 2)), add(scale(a3, 2), a4)), dt / 6));
      const pos = add(s.pos, scale(add(add(s.vel, scale(v2, 2)), add(scale(v3_, 2), v4)), dt / 6));
      const spin = noAir ? w : scale(w, Math.exp(-SPIN_DECAY_PER_S * dt));
      distance += len(vel) * dt;
      s = { ...s, t: s.t + dt, pos, vel, spin };

      if (useGround && s.pos.z < BALL.radius && s.vel.z < 0) {
        s = { ...s, pos: { ...s.pos, z: BALL.radius } };
        s = bounce(s, e, mu);
        if (Math.abs(s.vel.z) < 0.6) {
          s = { ...s, vel: { ...s.vel, z: 0 }, onGround: true };
        }
      }
    }

    if (p.stopAtX !== undefined && s.pos.x >= p.stopAtX) {
      out.push({ ...s });
      break;
    }
    if (p.stopAtZ !== undefined && s.vel.z < 0 && s.pos.z <= p.stopAtZ) {
      out.push({ ...s });
      break;
    }
  }
  return out;
};

/** Linear interpolation of the sampled path at any (fractional) frame. */
export const sampleAt = (path: BallState[], frame: number): BallState => {
  if (path.length === 0) throw new Error("empty path");
  if (frame <= 0) return path[0];
  if (frame >= path.length - 1) return path[path.length - 1];
  const i = Math.floor(frame);
  const f = frame - i;
  const a = path[i];
  const b = path[i + 1];
  const mix = (u: Vec3, v: Vec3) => v3(u.x + (v.x - u.x) * f, u.y + (v.y - u.y) * f, u.z + (v.z - u.z) * f);
  return { ...a, t: a.t + (b.t - a.t) * f, pos: mix(a.pos, b.pos), vel: mix(a.vel, b.vel), spin: mix(a.spin, b.spin) };
};

/** First state where the ball reaches x >= target, interpolated. */
export const crossingAtX = (path: BallState[], x: number): BallState | undefined => {
  for (let i = 1; i < path.length; i++) {
    if (path[i - 1].pos.x < x && path[i].pos.x >= x) {
      const f = (x - path[i - 1].pos.x) / (path[i].pos.x - path[i - 1].pos.x);
      return sampleAt(path, i - 1 + f);
    }
  }
  return undefined;
};

/** Total spin angle (radians) the ball has turned through by a given frame. */
export const spinAngleAt = (path: BallState[], frame: number, fps = 30): number => {
  let angle = 0;
  const end = Math.min(Math.floor(frame), path.length - 1);
  for (let i = 0; i < end; i++) angle += len(path[i].spin) / fps;
  if (end < path.length - 1) angle += (len(path[end].spin) / fps) * (frame - end);
  return angle;
};
