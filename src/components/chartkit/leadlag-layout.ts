// B2 · LEAD AND LAG (pure, proposed form "lead-lag"): the vanguard's share and everyone else's on one axis, the gap between them filled
// (green where the vanguard is ahead, pink where it is behind), and the lag measured: for the latest level the rest have reached, how
// many quarters earlier the vanguard first reached it; or an open bracket ("not yet") at a level the vanguard holds and the rest never
// reached. A quarter where fewer than 15 vanguard brands were read is drawn dotted.
export const LEAD_FLOOR = 15;
export type LeadRow = { quarter: string; van_n: number; van_yes: number; rest_n: number; rest_yes: number };
export type LeadPoint = { quarter: string; v: number | null; r: number | null; vn: number; rn: number; thin: boolean };
export type Lag =
  | { kind: "ahead" | "behind" | "level"; level: number; vanAt: string | null; restAt: string; quarters: number; /** the vanguard was already there in the first quarter read: the lag is a floor */ atLeast?: boolean }
  | { kind: "not-yet"; level: number; vanAt: string; restAt: null; quarters: null };
const qi = (q: string) => { const m = /^(\d{4})Q([1-4])$/.exec(q); return m ? Number(m[1]) * 4 + Number(m[2]) - 1 : NaN; };
export const quartersBetween = (a: string, b: string) => qi(b) - qi(a);

export function leadPoints(rows: readonly LeadRow[]): LeadPoint[] {
  return [...rows].sort((a, b) => qi(a.quarter) - qi(b.quarter)).map(x => ({ quarter: x.quarter, v: x.van_n ? x.van_yes / x.van_n : null, r: x.rest_n >= LEAD_FLOOR ? x.rest_yes / x.rest_n : null, vn: x.van_n, rn: x.rest_n, thin: x.van_n < LEAD_FLOOR }));
}
/** The measured lag (null with no rest reading). Ties within half a point count as reached. */
export function lagOf(ps: readonly LeadPoint[]): Lag | null {
  const eps = 0.005, rest = ps.filter(p => p.r != null), van = ps.filter(p => p.v != null && !p.thin);
  const last = rest.at(-1);
  if (!last) return null;
  const level = last.r!, restAt = rest.find(p => p.r! >= level - eps)!.quarter, vanAt = van.find(p => p.v! >= level - eps)?.quarter ?? null;
  const restMax = Math.max(...rest.map(p => p.r!)), vanLast = van.at(-1);
  if (vanLast && vanLast.v! > restMax + 0.02) {
    const at = van.find(p => p.v! >= vanLast.v! - eps)!.quarter;
    return { kind: "not-yet", level: vanLast.v!, vanAt: at, restAt: null, quarters: null };
  }
  if (!vanAt) return { kind: "behind", level, vanAt: null, restAt, quarters: 0 };
  const q = quartersBetween(vanAt, restAt);
  const atLeast = q > 0 && vanAt === van[0]!.quarter && vanAt === ps[0]!.quarter;
  return { kind: q > 0 ? "ahead" : q < 0 ? "behind" : "level", level, vanAt, restAt, quarters: Math.abs(q), ...(atLeast ? { atLeast } : {}) };
}
export const lagText = (l: Lag | null) => !l ? "No reading for everyone else yet" : l.kind === "not-yet" ? "not yet" : l.kind === "level" ? "level" :
  l.kind === "behind" && l.vanAt == null ? "the vanguard has not reached it" : `${l.atLeast ? "at least " : ""}${l.quarters} quarter${l.quarters === 1 ? "" : "s"} ${l.kind}`;
/** Fill polygons between the two lines, split where they cross; `ahead` true where the vanguard is above. xs and ys in chart pixels. */
export function gapAreas(pts: readonly { x: number; v: number; r: number }[]): { ahead: boolean; points: [number, number][] }[] {
  const out: { ahead: boolean; points: [number, number][] }[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!, b = pts[i + 1]!, da = a.v - a.r, db = b.v - b.r;
    // pixel y grows downward: the vanguard "ahead" is a smaller y, so compare in value space via the caller's v/r in pixels inverted
    if (da === 0 && db === 0) continue;
    if (da * db < 0) {
      const t = da / (da - db), x = a.x + t * (b.x - a.x), y = a.v + t * (b.v - a.v);
      out.push({ ahead: da < 0, points: [[a.x, a.v], [x, y], [a.x, a.r]] }, { ahead: db < 0, points: [[x, y], [b.x, b.v], [b.x, b.r]] });
    } else out.push({ ahead: (da || db) < 0, points: [[a.x, a.v], [b.x, b.v], [b.x, b.r], [a.x, a.r]] });
  }
  return out;
}
/** The readout: "Vanguard 41% · Everyone else 12% · gap 29 points · Q3 2026". */
export const leadLine = (p: LeadPoint, when: string) => [p.v != null ? `Vanguard ${Math.round(p.v * 100)}%` : "Vanguard not read", p.r != null ? `Everyone else ${Math.round(p.r * 100)}%` : "Everyone else not read",
  p.v != null && p.r != null ? `gap ${Math.round(Math.abs(p.v - p.r) * 100)} points` : null, when, p.thin ? `${p.vn} vanguard brands read` : null].filter(Boolean).join(" · ");
/** Signal pages show "Where it leads" only with at least this many quarters where both groups were read. */
export const LEAD_MIN_QUARTERS = 4;
