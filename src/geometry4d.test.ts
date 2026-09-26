import { describe, expect, it } from 'vitest';
import { sliceShape, type ShapeKind, type Vec3 } from './geometry4d';

const origin: [number, number, number] = [0, 0, 0];
const kinds: ShapeKind[] = ['tesseract', 'hypersphere', 'simplex', 'orthoplex'];

function expectPoint(points: Vec3[], wanted: Vec3): void {
  expect(points.some((point) => point.every((value, axis) => Math.abs(value - wanted[axis]) < 1e-8))).toBe(true);
}

describe('4D cross sections', () => {
  it('cuts the center of an axis-aligned tesseract into a cube', () => {
    const { points } = sliceShape('tesseract', 2, origin, 0);
    expect(points).toHaveLength(8);
    for (const x of [-1, 1]) {
      for (const y of [-1, 1]) {
        for (const z of [-1, 1]) expectPoint(points, [x, y, z]);
      }
    }
    expect(sliceShape('tesseract', 2, origin, 0.8).points).toEqual(points);
  });

  it('preserves a full boundary cell and removes slices beyond it', () => {
    expect(sliceShape('tesseract', 2, origin, 1).points).toHaveLength(8);
    expect(sliceShape('tesseract', 2, origin, -1).points).toHaveLength(8);
    expect(sliceShape('tesseract', 2, origin, 1.001).points).toEqual([]);
  });

  it('uses the analytical radius for a hypersphere and distinguishes absence from tangency', () => {
    expect(sliceShape('hypersphere', 5, origin, 3)).toEqual({ points: [], radius: 4 });
    expect(sliceShape('hypersphere', 5, [0.2, 0.7, -0.4], -3)).toEqual({ points: [], radius: 4 });
    expect(sliceShape('hypersphere', 5, origin, 5)).toEqual({ points: [], radius: 0 });
    expect(sliceShape('hypersphere', 5, origin, 5.001)).toEqual({ points: [] });
  });

  it('cuts a 16-cell into an octahedron without duplicate vertices', () => {
    const { points } = sliceShape('orthoplex', 2, origin, 0);
    expect(points).toHaveLength(6);
    for (let axis = 0; axis < 3; axis++) {
      for (const direction of [-1, 1]) {
        const wanted: Vec3 = [0, 0, 0];
        wanted[axis] = 2 * direction;
        expectPoint(points, wanted);
      }
    }
    const smaller = sliceShape('orthoplex', 2, origin, 1).points;
    expect(smaller).toHaveLength(6);
    for (const point of points) expectPoint(smaller, point.map((value) => value / 2) as Vec3);
    expect(sliceShape('orthoplex', 2, origin, 2).points).toEqual([]);
  });

  it('cuts a regular 4-simplex into a regular tetrahedron', () => {
    const points = sliceShape('simplex', 1, origin, 0).points;
    expect(points).toHaveLength(4);
    const edgeLengths: number[] = [];
    for (let first = 0; first < points.length; first++) {
      expect(Math.hypot(...points[first])).toBeCloseTo(Math.sqrt(0.6), 10);
      for (let second = first + 1; second < points.length; second++) {
        edgeLengths.push(Math.hypot(...points[first].map((value, axis) => value - points[second][axis])));
      }
    }
    for (const length of edgeLengths) expect(length).toBeCloseTo(Math.sqrt(1.6), 10);
    expect(sliceShape('simplex', 1, origin, -1).points).toEqual([]);
    expect(sliceShape('simplex', 1, origin, 0.25).points).toHaveLength(4);
  });

  it('changes tesseract width while rotating through the fourth dimension', () => {
    const size = 2;
    const offset = 1 / Math.sqrt(2);
    const points = sliceShape('tesseract', size, [Math.PI / 4, 0, 0], offset).points;
    expect(points).toHaveLength(8);
    for (const x of [-offset, offset]) {
      for (const y of [-1, 1]) {
        for (const z of [-1, 1]) expectPoint(points, [x, y, z]);
      }
    }
    // At the extreme W support, the remaining square has no 3D volume.
    expect(sliceShape('tesseract', size, [Math.PI / 4, 0, 0], Math.sqrt(2)).points).toEqual([]);
  });

  it('retains central symmetry and circumradius through three nontrivial rotations', () => {
    for (const kind of ['tesseract', 'orthoplex'] as const) {
      const points = sliceShape(kind, 2, [0.37, -0.53, 0.81], 0).points;
      expect(points.length).toBeGreaterThanOrEqual(6);
      for (const point of points) {
        expectPoint(points, point.map((value) => -value) as Vec3);
        expect(Math.hypot(...point)).toBeLessThanOrEqual(2 + 1e-10);
      }
    }
  });

  it('scales rotated slices consistently', () => {
    const rotation: [number, number, number] = [0.37, -0.53, 0.81];
    for (const kind of ['tesseract', 'simplex', 'orthoplex'] as const) {
      const small = sliceShape(kind, 1, rotation, 0.2).points;
      const large = sliceShape(kind, 3, rotation, 0.6).points;
      expect(small.length).toBeGreaterThanOrEqual(4);
      expect(large).toHaveLength(small.length);
      for (const point of small) expectPoint(large, point.map((value) => value * 3) as Vec3);
    }
  });

  it('returns an empty slice for invalid and out-of-bounds inputs', () => {
    for (const kind of kinds) {
      expect(sliceShape(kind, 1, [0.37, -0.53, 0.81], 2)).toEqual({ points: [] });
      expect(sliceShape(kind, 0, origin, 0)).toEqual({ points: [] });
      expect(sliceShape(kind, -1, origin, 0)).toEqual({ points: [] });
      expect(sliceShape(kind, Infinity, origin, 0)).toEqual({ points: [] });
      expect(sliceShape(kind, 1, [NaN, 0, 0], 0)).toEqual({ points: [] });
      expect(sliceShape(kind, 1, origin, NaN)).toEqual({ points: [] });
    }
  });
});
