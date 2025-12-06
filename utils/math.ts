import { Vector2 } from '../types';

export const add = (v1: Vector2, v2: Vector2): Vector2 => ({ x: v1.x + v2.x, y: v1.y + v2.y });
export const sub = (v1: Vector2, v2: Vector2): Vector2 => ({ x: v1.x - v2.x, y: v1.y - v2.y });
export const mult = (v: Vector2, s: number): Vector2 => ({ x: v.x * s, y: v.y * s });
export const dot = (v1: Vector2, v2: Vector2): number => v1.x * v2.x + v1.y * v2.y;
export const mag = (v: Vector2): number => Math.sqrt(v.x * v.x + v.y * v.y);
export const distSq = (v1: Vector2, v2: Vector2): number => {
    const dx = v1.x - v2.x;
    const dy = v1.y - v2.y;
    return dx * dx + dy * dy;
};
export const normalize = (v: Vector2): Vector2 => {
  const m = mag(v);
  return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
};
export const dist = (v1: Vector2, v2: Vector2): number => mag(sub(v1, v2));

export const rotatePoint = (point: Vector2, center: Vector2, angle: number): Vector2 => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + (dx * cos - dy * sin),
    y: center.y + (dx * sin + dy * cos),
  };
};

// Distance from point P to line segment AB
export const distToSegment = (p: Vector2, a: Vector2, b: Vector2): { dist: number, closest: Vector2, normal: Vector2 } => {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const abLenSq = dot(ab, ab);
  
  if (abLenSq === 0) return { dist: dist(p, a), closest: a, normal: { x: 0, y: -1 } };

  // Projection of P onto AB, clamped between 0 and 1
  const t = Math.max(0, Math.min(1, dot(ap, ab) / abLenSq));
  
  const closest = add(a, mult(ab, t));
  const distance = dist(p, closest);
  
  // Calculate normal (pointing 'inward' relative to the polygon logic usually, 
  // but here we just need a perpendicular vector from segment to point)
  let normal = normalize(sub(p, closest));
  
  // Fallback normal if directly on line
  if (normal.x === 0 && normal.y === 0) {
      normal = normalize({ x: -ab.y, y: ab.x });
  }

  return { dist: distance, closest, normal };
};