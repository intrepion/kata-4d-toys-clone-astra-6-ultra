import { polytopeVertices, type ShapeKind, type Vec4 } from './geometry4d';

export interface ToyBody {
  id: number;
  kind: ShapeKind;
  color: string;
  position: Vec4;
  velocity: Vec4;
  rotation: [number, number, number];
  angularVelocity: [number, number, number];
  size: number;
  locked?: boolean;
}

type Preset = 'playground' | 'tower' | 'ballpit' | 'orbit';
const COLORS = ['#ef806e', '#ecc568', '#ac98da', '#73bcb2', '#78aadd', '#dc9cad', '#ecaa71'];
const GRAVITY = 9.8;
const MAX_STEP = 1 / 120;
const TAU = Math.PI * 2;

/** Simplified 4D spherical collision volumes, rather than exact polytope contacts. */
function collisionRadius(body: ToyBody): number {
  const scale: Record<ShapeKind, number> = {
    tesseract: 0.5,
    hypersphere: 1,
    simplex: 0.63,
    orthoplex: 0.7,
  };
  return body.size * scale[body.kind];
}

function supportHeight(body: ToyBody): number {
  if (body.kind === 'hypersphere') return body.size;
  const vertices = polytopeVertices(body.kind, body.size, body.rotation);
  return -Math.min(...vertices.map(vertex => vertex[1]));
}

/** Center-coordinate limits shared by simulation and direct object manipulation. */
export function getBodyBounds(body: ToyBody): { x: number; z: number; w: number; yMin: number } {
  const radius = collisionRadius(body);
  return {
    x: Math.max(0.05, 5 - radius),
    z: Math.max(0.05, 4 - radius),
    w: Math.max(0.05, 3 - radius),
    yMin: supportHeight(body),
  };
}

function confine(body: ToyBody, dt: number, bounds: ReturnType<typeof getBodyBounds>): void {
  if (body.locked) return;
  for (const [axis, limit] of [[0, bounds.x], [2, bounds.z], [3, bounds.w]] as const) {
    if (body.position[axis] < -limit) {
      body.position[axis] = -limit;
      body.velocity[axis] = Math.abs(body.velocity[axis]) * 0.52;
    } else if (body.position[axis] > limit) {
      body.position[axis] = limit;
      body.velocity[axis] = -Math.abs(body.velocity[axis]) * 0.52;
    }
  }
  if (body.position[1] <= bounds.yMin) {
    body.position[1] = bounds.yMin;
    if (body.velocity[1] < 0) {
      body.velocity[1] = body.velocity[1] < -0.85 ? -body.velocity[1] * 0.36 : 0;
    }
    const friction = Math.exp(-4 * dt);
    for (const axis of [0, 2, 3] as const) body.velocity[axis] *= friction;
    for (let axis = 0; axis < 3; axis++) body.angularVelocity[axis] *= Math.exp(-3 * dt);
  }
}

function collide(a: ToyBody, b: ToyBody): void {
  if (a.locked && b.locked) return;
  const normal: Vec4 = [0, 0, 0, 0];
  let distanceSquared = 0;
  for (let axis = 0; axis < 4; axis++) {
    normal[axis] = b.position[axis] - a.position[axis];
    distanceSquared += normal[axis] ** 2;
  }
  const contactDistance = collisionRadius(a) + collisionRadius(b);
  if (distanceSquared >= contactDistance ** 2) return;

  const distance = Math.sqrt(distanceSquared);
  if (distance > 1e-7) {
    for (let axis = 0; axis < 4; axis++) normal[axis] /= distance;
  } else {
    // Coincident toys need a deterministic direction instead of division by zero.
    normal[0] = a.id <= b.id ? 1 : -1;
  }
  const inverseA = a.locked ? 0 : 1 / Math.max(0.2, a.size ** 4);
  const inverseB = b.locked ? 0 : 1 / Math.max(0.2, b.size ** 4);
  const inverseTotal = inverseA + inverseB;
  const correction = Math.max(0, contactDistance - distance - 0.001) * 0.86 / inverseTotal;
  let normalVelocity = 0;
  for (let axis = 0; axis < 4; axis++) {
    a.position[axis] -= normal[axis] * correction * inverseA;
    b.position[axis] += normal[axis] * correction * inverseB;
    normalVelocity += (b.velocity[axis] - a.velocity[axis]) * normal[axis];
  }
  if (normalVelocity >= 0) return;

  const restitution = normalVelocity < -0.8 ? 0.46 : 0;
  const impulse = -(1 + restitution) * normalVelocity / inverseTotal;
  for (let axis = 0; axis < 4; axis++) {
    a.velocity[axis] -= normal[axis] * impulse * inverseA;
    b.velocity[axis] += normal[axis] * impulse * inverseB;
  }
}

/** Advance a bounded 4D toy world. dt is in seconds; a tab resume cannot cause a giant step. */
export function stepPhysics(bodies: ToyBody[], dt: number, gravity: boolean): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const elapsed = Math.min(dt, 0.1);
  const steps = Math.ceil(elapsed / MAX_STEP);
  const h = elapsed / steps;
  const damping = Math.exp(-0.14 * h);
  const bodyBounds = new Map<ToyBody, ReturnType<typeof getBodyBounds>>();
  for (let step = 0; step < steps; step++) {
    for (const body of bodies) {
      if (body.locked) continue;
      if (gravity) body.velocity[1] -= GRAVITY * h;
      const speed = Math.hypot(...body.velocity);
      const speedScale = speed > 20 ? 20 / speed : 1;
      for (let axis = 0; axis < 4; axis++) {
        body.velocity[axis] *= damping * speedScale;
        body.position[axis] += body.velocity[axis] * h;
      }
      for (let axis = 0; axis < 3; axis++) {
        body.rotation[axis] = (body.rotation[axis] + body.angularVelocity[axis] * h) % TAU;
      }
      const bounds = getBodyBounds(body);
      bodyBounds.set(body, bounds);
      confine(body, h, bounds);
    }
    // Iterative contacts keep a stack from sinking through the floor.
    for (let iteration = 0; iteration < 4; iteration++) {
      for (let a = 0; a < bodies.length; a++) {
        for (let b = a + 1; b < bodies.length; b++) collide(bodies[a], bodies[b]);
      }
      for (const body of bodies) {
        if (!body.locked) confine(body, 0, bodyBounds.get(body)!);
      }
    }
  }
}

export function createBody(kind: ShapeKind, id: number, color: string, position?: Vec4): ToyBody {
  return {
    id,
    kind,
    color,
    position: position ? [...position] : [0, 3.6, 0, 0],
    velocity: [0, 0, 0, 0],
    rotation: [0, 0, 0],
    angularVelocity: [0, 0, 0],
    size: kind === 'tesseract' ? 1.4 : kind === 'simplex' ? 1.2 : 0.95,
  };
}

export function createPreset(preset: Preset): ToyBody[] {
  const bodies: ToyBody[] = [];
  function add(kind: ShapeKind, x: number, z: number, w: number, size: number, y?: number): ToyBody {
    const body = createBody(kind, bodies.length + 1, COLORS[bodies.length % COLORS.length], [x, 0, z, w]);
    body.size = size;
    body.position[1] = y ?? supportHeight(body);
    bodies.push(body);
    return body;
  }

  if (preset === 'playground') {
    add('tesseract', -2.9, -1.45, -0.12, 1.6);
    add('hypersphere', -0.05, -1.5, 0.08, 1.03);
    add('simplex', 2.75, -1.05, 0.14, 1.48);
    add('orthoplex', -0.8, 1.6, -0.15, 1.03);
    add('tesseract', 2.2, 1.6, 0.2, 1.35);
    add('hypersphere', -3.3, 1.5, 0.3, 0.74);
    add('hypersphere', 1.05, 0.2, -0.38, 0.59);
  } else if (preset === 'tower') {
    for (let level = 0; level < 5; level++) add('tesseract', -0.8, -0.25, 0, 1.42, 0.71 + level * 1.42);
    add('hypersphere', 2.15, 0.7, 0.15, 1);
    add('orthoplex', -3, 1.6, -0.1, 0.9);
  } else if (preset === 'ballpit') {
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 4; column++) {
        const body = add('hypersphere', (column - 1.5) * 1.65, (row - 1) * 1.8, ((column + row) % 3 - 1) * 0.35, 0.66 + ((column + row) % 3) * 0.055, 1.2 + row * 0.6);
        body.velocity[3] = (column % 2 ? 1 : -1) * 0.45;
      }
    }
  } else {
    const kinds: ShapeKind[] = ['tesseract', 'hypersphere', 'simplex', 'orthoplex'];
    for (let index = 0; index < 8; index++) {
      const angle = index * TAU / 8;
      const body = add(kinds[index % kinds.length], Math.cos(angle) * 2.8, Math.sin(angle) * 2, Math.sin(angle * 2) * 1.1, index % 4 === 0 ? 1.1 : 0.7, 2.4 + Math.cos(angle * 2) * 0.5);
      body.velocity = [-Math.sin(angle) * 1.25, Math.sin(angle * 2) * 0.25, Math.cos(angle), Math.cos(angle * 2) * 0.8];
      body.angularVelocity = [0.1, 0.08, -0.12];
    }
  }
  return bodies;
}
