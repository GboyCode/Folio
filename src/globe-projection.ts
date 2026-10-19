export type GlobeVector = readonly [number, number, number];

// The flat map uses 1000 units for 360 degrees along both axes.
export function globeVector(position: readonly [number, number]): GlobeVector {
  const longitude = (position[0] / 1000 * 360 - 180) * Math.PI / 180;
  const latitude = (90 - position[1] / 1000 * 360) * Math.PI / 180;
  return [Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude), Math.cos(latitude) * Math.cos(longitude)];
}

export function globeRotation(longitude: number, latitude: number) {
  const cy = Math.cos(longitude), sy = Math.sin(longitude), ct = Math.cos(latitude), st = Math.sin(latitude);
  return ([x,y,z]: GlobeVector): GlobeVector => {
    const depth = x * sy + z * cy;
    return [x * cy - z * sy, y * ct - depth * st, y * st + depth * ct];
  };
}

// A short great-circle route lifted gently above the globe. Endpoints stay on
// the surface; tangent interpolation also remains stable near antipodal points.
export function globeArc(start: GlobeVector, end: GlobeVector, segments = 96): GlobeVector[] {
  const cosine = Math.max(-1, Math.min(1, start.reduce((sum, value, i) => sum + value * end[i], 0)));
  const angle = Math.acos(cosine);
  if (angle < .002) return [];
  let tangent = end.map((value, i) => value - cosine * start[i]);
  let length = Math.hypot(...tangent);
  if (length < 1e-8) {
    const axis = Math.abs(start[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
    const dot = start.reduce((sum, value, i) => sum + value * axis[i], 0);
    tangent = axis.map((value, i) => value - dot * start[i]);
    length = Math.hypot(...tangent);
  }
  const lift = Math.min(.2, .035 + angle * .055);
  return Array.from({ length: segments + 1 }, (_, index) => {
    if (index === 0) return start;
    if (index === segments) return end;
    const t = index / segments, height = 1 + Math.sin(t * Math.PI) * lift;
    return start.map((value, i) => (value * Math.cos(angle * t) + tangent[i] / length * Math.sin(angle * t)) * height) as unknown as GlobeVector;
  });
}

// Elevated far-side arcs can peek around the silhouette, but never through land.
export function globePointVisible([x, y, depth]: GlobeVector) {
  return depth >= 0 || x * x + y * y > 1.002;
}

// Keep the current region until another is clearly nearer the front, avoiding flicker.
export function facingRegion(points:readonly {key:string;depth:number}[],current:string|null) {
  const best=points.reduce<{key:string;depth:number}|undefined>((best,point)=>!best||point.depth>best.depth?point:best,undefined);
  if (!best) return null;
  const previous=points.find(point=>point.key===current);
  if (previous && (best.depth<.08 || best.depth-previous.depth<.1)) return previous.key;
  return best.key;
}
