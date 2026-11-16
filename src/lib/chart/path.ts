// Flattens SVG path data (M, L, H, V, Q, C, Z; absolute or relative) into closed polygons, so the pure-JS rasterizer can draw
// the outlined mark. Winding is kept as drawn: the mark's counters and slits are cut-outs under the nonzero rule. Pure.
export type Poly = [number, number][];
export function flattenPath(d: string, scale = 1, dx = 0, dy = 0, steps = 8): Poly[] {
  const toks = d.match(/[MLHVQCZmlhvqcz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const polys: Poly[] = []; let cur: Poly = [], i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0;
  const num = () => Number(toks[i++]);
  const put = (px: number, py: number) => cur.push([px * scale + dx, py * scale + dy]);
  const close = () => { if (cur.length > 2) polys.push(cur); cur = []; };
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i]!)) cmd = toks[i++]!;
    const rel = cmd === cmd.toLowerCase() && cmd !== "z", ox = rel ? x : 0, oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case "M": close(); x = ox + num(); y = oy + num(); sx = x; sy = y; put(x, y); cmd = rel ? "l" : "L"; break;
      case "L": x = ox + num(); y = oy + num(); put(x, y); break;
      case "H": x = ox + num(); put(x, y); break;
      case "V": y = oy + num(); put(x, y); break;
      case "Q": { const cx = ox + num(), cy = oy + num(), ex = ox + num(), ey = oy + num();
        for (let s = 1; s <= steps; s++) { const t = s / steps, a = (1 - t) ** 2, b = 2 * (1 - t) * t, c = t * t; put(a * x + b * cx + c * ex, a * y + b * cy + c * ey); }
        x = ex; y = ey; break; }
      case "C": { const c1x = ox + num(), c1y = oy + num(), c2x = ox + num(), c2y = oy + num(), ex = ox + num(), ey = oy + num();
        for (let s = 1; s <= steps; s++) { const t = s / steps, u = 1 - t; put(u ** 3 * x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t ** 3 * ex, u ** 3 * y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t ** 3 * ey); }
        x = ex; y = ey; break; }
      case "Z": x = sx; y = sy; close(); break;
      default: i++;
    }
  }
  close();
  return polys;
}
