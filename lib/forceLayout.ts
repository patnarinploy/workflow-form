// Tiny deterministic force-directed layout (Fruchterman–Reingold style).
// Kept in-house so the overview map needs no extra dependency. Produces static
// node positions; React Flow then handles zoom/pan/drag on top.

export type Pt = { x: number; y: number };

type Link = { source: string; target: string; weight?: number };

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function forceLayout(
  ids: string[],
  links: Link[],
  opts: {
    width: number;
    height: number;
    groupOf?: (id: string) => string;
    seed?: number;
    iterations?: number;
  }
): Record<string, Pt> {
  const { width, height, groupOf, seed = 1, iterations = 320 } = opts;
  const n = ids.length;
  if (n === 0) return {};
  const rand = mulberry32(seed);

  const area = width * height;
  const k = Math.sqrt(area / n) * 0.8; // ideal edge length

  const pos: Record<string, Pt> = {};
  const idx = new Map(ids.map((id, i) => [id, i]));
  ids.forEach((id, i) => {
    // seed on a jittered circle so re-layout (new seed) reshuffles
    const ang = (i / n) * Math.PI * 2 + rand() * 0.6;
    const r = (Math.min(width, height) / 2) * (0.35 + rand() * 0.5);
    pos[id] = { x: width / 2 + Math.cos(ang) * r, y: height / 2 + Math.sin(ang) * r };
  });

  // group centroids for mild cohesion
  const groupOfId = (id: string) => (groupOf ? groupOf(id) : "");
  const linkW = links.map((l) => l.weight ?? 1);

  let temp = Math.min(width, height) * 0.12;
  const cool = temp / (iterations + 1);

  const disp: Pt[] = ids.map(() => ({ x: 0, y: 0 }));

  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) disp[i].x = disp[i].y = 0;

    // repulsion (all pairs)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pos[ids[i]];
        const b = pos[ids[j]];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.hypot(dx, dy) || 0.01;
        if (dist < 0.01) {
          dx = (rand() - 0.5) * 0.1;
          dy = (rand() - 0.5) * 0.1;
          dist = 0.01;
        }
        const rep = (k * k) / dist;
        const ux = (dx / dist) * rep;
        const uy = (dy / dist) * rep;
        disp[i].x += ux;
        disp[i].y += uy;
        disp[j].x -= ux;
        disp[j].y -= uy;
      }
    }

    // attraction along links
    links.forEach((l, li) => {
      const si = idx.get(l.source);
      const ti = idx.get(l.target);
      if (si == null || ti == null || si === ti) return;
      const a = pos[l.source];
      const b = pos[l.target];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const attr = ((dist * dist) / k) * (0.5 + 0.5 * Math.min(2, linkW[li]));
      const ux = (dx / dist) * attr;
      const uy = (dy / dist) * attr;
      disp[si].x -= ux;
      disp[si].y -= uy;
      disp[ti].x += ux;
      disp[ti].y += uy;
    });

    // mild same-group cohesion toward group centroid
    if (groupOf) {
      const cen = new Map<string, { x: number; y: number; c: number }>();
      for (const id of ids) {
        const g = groupOfId(id);
        const e = cen.get(g) ?? { x: 0, y: 0, c: 0 };
        e.x += pos[id].x;
        e.y += pos[id].y;
        e.c += 1;
        cen.set(g, e);
      }
      for (let i = 0; i < n; i++) {
        const g = groupOfId(ids[i]);
        const e = cen.get(g)!;
        const cx = e.x / e.c;
        const cy = e.y / e.c;
        disp[i].x += (cx - pos[ids[i]].x) * 0.06;
        disp[i].y += (cy - pos[ids[i]].y) * 0.06;
      }
    }

    // apply with temperature limiting + gentle centering
    for (let i = 0; i < n; i++) {
      const d = disp[i];
      const len = Math.hypot(d.x, d.y) || 0.01;
      const p = pos[ids[i]];
      p.x += (d.x / len) * Math.min(len, temp);
      p.y += (d.y / len) * Math.min(len, temp);
      p.x += (width / 2 - p.x) * 0.01;
      p.y += (height / 2 - p.y) * 0.01;
    }
    temp = Math.max(temp - cool, 1);
  }

  // normalize to fit the box with padding
  const pad = 60;
  const xs = ids.map((id) => pos[id].x);
  const ys = ids.map((id) => pos[id].y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = (width - pad * 2) / Math.max(1, maxX - minX);
  const sy = (height - pad * 2) / Math.max(1, maxY - minY);
  const s = Math.min(sx, sy);
  const out: Record<string, Pt> = {};
  for (const id of ids) {
    out[id] = { x: pad + (pos[id].x - minX) * s, y: pad + (pos[id].y - minY) * s };
  }
  return out;
}
