/** Object coordinates are x, y, z, w; `size` is the 4D circumradius. */
export type Vec4 = [number, number, number, number];
export type Vec3 = [number, number, number];
export type ShapeKind = 'tesseract' | 'hypersphere' | 'simplex' | 'orthoplex';

export interface Slice3D {
  points: Vec3[];
  /** Present only for a hypersphere that intersects the slice. */
  radius?: number;
}

type Edge = [number, number];
type Polytope = { vertices: Vec4[]; edges: Edge[] };

const tesseract: Polytope = {
  vertices: Array.from({ length: 16 }, (_, bits) =>
    Array.from({ length: 4 }, (_, axis) => (bits & (1 << axis) ? 0.5 : -0.5)) as Vec4,
  ),
  edges: [],
};
for (let vertex = 0; vertex < 16; vertex++) {
  for (let axis = 0; axis < 4; axis++) {
    const neighbor = vertex ^ (1 << axis);
    if (vertex < neighbor) tesseract.edges.push([vertex, neighbor]);
  }
}

const orthoplex: Polytope = {
  vertices: Array.from({ length: 8 }, (_, index) => {
    const vertex: Vec4 = [0, 0, 0, 0];
    vertex[Math.floor(index / 2)] = index % 2 === 0 ? 1 : -1;
    return vertex;
  }),
  edges: [],
};
for (let first = 0; first < 8; first++) {
  for (let second = first + 1; second < 8; second++) {
    if (Math.floor(first / 2) !== Math.floor(second / 2)) {
      orthoplex.edges.push([first, second]);
    }
  }
}

// These five unit vectors have pairwise dot product -1/4: a regular 4-simplex.
const a = Math.sqrt(5) / 4;
const simplex: Polytope = {
  vertices: [
    [a, a, a, 0.25],
    [a, -a, -a, 0.25],
    [-a, a, -a, 0.25],
    [-a, -a, a, 0.25],
    [0, 0, 0, -1],
  ],
  edges: [],
};
for (let first = 0; first < 5; first++) {
  for (let second = first + 1; second < 5; second++) {
    simplex.edges.push([first, second]);
  }
}

const polytopes = { tesseract, simplex, orthoplex };

/** Rotate a vector in XW, then YW, then ZW; the input is never mutated. */
export function rotate4D(vertex: Vec4, angles: [number, number, number]): Vec4 {
  const rotated: Vec4 = [...vertex];
  for (let axis = 0; axis < 3; axis++) {
    const cosine = Math.cos(angles[axis]);
    const sine = Math.sin(angles[axis]);
    const previous = rotated[axis];
    rotated[axis] = previous * cosine - rotated[3] * sine;
    rotated[3] = previous * sine + rotated[3] * cosine;
  }
  return rotated;
}

/** Full-solid vertices for bounds and floor support, independent of slicing. */
export function polytopeVertices(
  kind: ShapeKind,
  size: number,
  rotation: [number, number, number],
): Vec4[] {
  if (kind === 'hypersphere') return [];
  return polytopes[kind].vertices.map((vertex) =>
    rotate4D(vertex.map((coordinate) => coordinate * size) as Vec4, rotation),
  );
}

function subtract(left: Vec3, right: Vec3): Vec3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function dot(left: Vec3, right: Vec3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function cross(left: Vec3, right: Vec3): Vec3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

/** ConvexGeometry requires a volumetric hull, not a polygon, line, or point. */
function hasVolume(points: Vec3[], epsilon: number): boolean {
  if (points.length < 4) return false;
  const origin = points[0];
  let line: Vec3 = [0, 0, 0];
  let lineSquared = 0;
  for (const point of points) {
    const vector = subtract(point, origin);
    const squared = dot(vector, vector);
    if (squared > lineSquared) {
      line = vector;
      lineSquared = squared;
    }
  }
  if (lineSquared <= epsilon * epsilon) return false;

  let normal: Vec3 = [0, 0, 0];
  let normalSquared = 0;
  for (const point of points) {
    const candidate = cross(line, subtract(point, origin));
    const squared = dot(candidate, candidate);
    if (squared > normalSquared) {
      normal = candidate;
      normalSquared = squared;
    }
  }
  if (normalSquared <= epsilon * epsilon * lineSquared) return false;
  const threshold = epsilon * Math.sqrt(normalSquared);
  return points.some((point) => Math.abs(dot(normal, subtract(point, origin))) > threshold);
}

/**
 * Intersect a rotated 4D solid with w = wOffset. Returned points are in local
 * 3D coordinates, ready for a convex hull. Rotations act in XW, YW, then ZW.
 * The sphere is rotationally invariant; its tangent slice has radius zero.
 * Numerically degenerate polytopes (within size * 1e-9) return no hull points.
 */
export function sliceShape(
  kind: ShapeKind,
  size: number,
  rotation: [number, number, number],
  wOffset: number,
): Slice3D {
  if (
    !Number.isFinite(size) ||
    size <= 0 ||
    !Number.isFinite(wOffset) ||
    rotation.some((angle) => !Number.isFinite(angle))
  ) {
    return { points: [] };
  }

  if (kind === 'hypersphere') {
    if (Math.abs(wOffset) > size) return { points: [] };
    // Factorization avoids cancellation when approaching a tangent slice.
    return { points: [], radius: Math.sqrt((size - Math.abs(wOffset)) * (size + Math.abs(wOffset))) };
  }

  const polytope = polytopes[kind];
  const vertices = polytopeVertices(kind, size, rotation);
  const epsilon = size * 1e-9;
  const points: Vec3[] = [];
  const add = (point: Vec3): void => {
    if (!points.some((existing) => {
      const difference = subtract(existing, point);
      return dot(difference, difference) <= epsilon * epsilon;
    })) points.push(point);
  };

  for (const [first, second] of polytope.edges) {
    const start = vertices[first];
    const end = vertices[second];
    const startDistance = start[3] - wOffset;
    const endDistance = end[3] - wOffset;
    const startOnPlane = Math.abs(startDistance) <= epsilon;
    const endOnPlane = Math.abs(endDistance) <= epsilon;

    if (startOnPlane) add([start[0], start[1], start[2]]);
    if (endOnPlane) add([end[0], end[1], end[2]]);
    if (startOnPlane || endOnPlane) continue;
    if ((startDistance < 0) === (endDistance < 0)) continue;

    const fraction = startDistance / (startDistance - endDistance);
    add([
      start[0] + (end[0] - start[0]) * fraction,
      start[1] + (end[1] - start[1]) * fraction,
      start[2] + (end[2] - start[2]) * fraction,
    ]);
  }

  return { points: hasVolume(points, epsilon) ? points : [] };
}
