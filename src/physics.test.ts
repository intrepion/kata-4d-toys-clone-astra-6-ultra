import { describe, expect, it } from 'vitest';
import { polytopeVertices } from './geometry4d';
import { createBody, createPreset, getBodyBounds, stepPhysics } from './physics';

describe('four-dimensional toy dynamics', () => {
  it('falls under gravity and comes to rest on the floor', () => {
    const ball = createBody('hypersphere', 1, '#fff', [0, 4, 0, 0]);
    stepPhysics([ball], 1 / 30, true);
    expect(ball.position[1]).toBeLessThan(4);
    expect(ball.velocity[1]).toBeLessThan(0);
    for (let frame = 0; frame < 900; frame++) stepPhysics([ball], 1 / 60, true);
    expect(ball.position[1]).toBeCloseTo(ball.size, 5);
    expect(ball.velocity[1]).toBe(0);
  });

  it('preserves a stationary floating body with gravity disabled', () => {
    const ball = createBody('hypersphere', 1, '#fff', [0, 3, 0, 0]);
    for (let frame = 0; frame < 120; frame++) stepPhysics([ball], 1 / 60, false);
    expect(ball.position).toEqual([0, 3, 0, 0]);
  });

  it('distinguishes objects separated only along the fourth dimension', () => {
    const a = createBody('hypersphere', 1, '#fff', [0, 2, 0, -0.75]);
    const b = createBody('hypersphere', 2, '#fff', [0, 2, 0, 0.75]);
    a.size = b.size = 0.5;
    stepPhysics([a, b], 1 / 60, false);
    expect(a.position).toEqual([0, 2, 0, -0.75]);
    expect(b.position).toEqual([0, 2, 0, 0.75]);

    a.position[3] = -0.4;
    b.position[3] = 0.4;
    a.velocity[3] = 1;
    b.velocity[3] = -1;
    stepPhysics([a, b], 1 / 60, false);
    expect(a.velocity[3]).toBeLessThan(0);
    expect(b.velocity[3]).toBeGreaterThan(0);
    expect(a.position[0]).toBe(0);
    expect(b.position[0]).toBe(0);
  });

  it('keeps a grabbed object fixed while it pushes other toys away', () => {
    const held = createBody('hypersphere', 1, '#fff', [0, 2, 0, 0]);
    const moving = createBody('hypersphere', 2, '#fff', [0.8, 2, 0, 0]);
    held.size = moving.size = 0.5;
    held.locked = true;
    moving.velocity[0] = -2;
    stepPhysics([held, moving], 1 / 30, true);
    expect(held.position).toEqual([0, 2, 0, 0]);
    expect(moving.position[0]).toBeGreaterThan(0.98);
    expect(moving.velocity[0]).toBeGreaterThan(0);
  });

  it('handles coincident bodies and maintains finite bounded states over time', () => {
    const bodies = createPreset('ballpit');
    bodies[1].position = [...bodies[0].position];
    bodies[0].velocity = [17, -12, 15, 18];
    for (let frame = 0; frame < 1500; frame++) stepPhysics(bodies, 1 / 60, true);
    for (const body of bodies) {
      expect([...body.position, ...body.velocity, ...body.rotation].every(Number.isFinite)).toBe(true);
      expect(Math.abs(body.position[0])).toBeLessThanOrEqual(5 - body.size + 1e-8);
      expect(Math.abs(body.position[2])).toBeLessThanOrEqual(4 - body.size + 1e-8);
      expect(Math.abs(body.position[3])).toBeLessThanOrEqual(3 - body.size + 1e-8);
      expect(body.position[1]).toBeGreaterThanOrEqual(body.size - 1e-8);
    }
  });

  it('bounds a long frame and ignores invalid time intervals', () => {
    const body = createBody('hypersphere', 1, '#fff', [0, 4, 0, 0]);
    stepPhysics([body], Number.NaN, true);
    stepPhysics([body], -1, true);
    expect(body.position).toEqual([0, 4, 0, 0]);
    stepPhysics([body], 120, true);
    expect(body.position[1]).toBeGreaterThan(3.9);
    expect(body.position[1]).toBeLessThan(4);
  });

  it('uses the same bounds for direct manipulation and physics, including rotated floor support', () => {
    for (const kind of ['tesseract', 'hypersphere', 'simplex', 'orthoplex'] as const) {
      const body = createBody(kind, 1, '#fff');
      body.rotation = [1.1, 0.7, -0.4];
      const bounds = getBodyBounds(body);
      body.position = [bounds.x, bounds.yMin, -bounds.z, bounds.w];
      const placed = [...body.position];
      stepPhysics([body], 1 / 60, false);
      expect(body.position).toEqual(placed);

      body.position = [100, -2, -100, 100];
      stepPhysics([body], 1 / 60, false);
      expect(body.position).toEqual(placed);
      if (kind === 'hypersphere') {
        expect(bounds).toEqual({ x: 4.05, z: 3.05, w: 2.05, yMin: 0.95 });
      } else {
        const worldVertices = polytopeVertices(kind, body.size, body.rotation).map(vertex => vertex[1] + body.position[1]);
        expect(Math.min(...worldVertices)).toBeCloseTo(0, 10);
        expect(worldVertices.every(y => y >= -1e-10)).toBe(true);
      }
    }
  });

  it('creates independent resettable presets with unique object identifiers', () => {
    for (const name of ['playground', 'tower', 'ballpit', 'orbit'] as const) {
      const first = createPreset(name);
      const second = createPreset(name);
      expect(first.length).toBeGreaterThanOrEqual(6);
      expect(new Set(first.map(body => body.id)).size).toBe(first.length);
      first[0].position[0] = 100;
      expect(second[0].position[0]).not.toBe(100);
    }
  });
});
