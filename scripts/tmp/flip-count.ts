import { flipRuns, type FlipIn } from "../../src/lib/flips";
const env = Object.fromEntries((await Bun.file(".env").text()).split("\n").filter(l => l.includes("=")).map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }));
const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const rows: any[] = [];
for (let f = 0; ; f += 1000) {
  const r = await fetch(`${url}/rest/v1/library_events?select=id,domain,before,after,detected_at,effective_at,source&order=id&offset=${f}&limit=1000`, { headers: { apikey: key } });
  const d = await r.json(); if (!Array.isArray(d)) { console.log(d); break; } rows.push(...d); if (d.length < 1000) break;
}
const by = new Map<string, FlipIn[]>();
for (const e of rows) {
  if ((e.source ?? "live") !== "live") continue;
  const b = e.before ?? {}, a = e.after ?? {}, ks = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  if (ks.length !== 1 || typeof b[ks[0]] !== "string" || typeof a[ks[0]] !== "string") continue;
  by.set(e.domain, [...(by.get(e.domain) ?? []), { id: String(e.id), field: ks[0], before: b[ks[0]], after: a[ks[0]], at: e.effective_at ?? e.detected_at }]);
}
const hits = [...by].map(([d, evs]) => [d, flipRuns(evs)] as const).filter(([, r]) => r.length);
console.log("events", rows.length, "brands with a run", hits.length);
for (const [d, r] of hits) console.log(d, r.map(x => `${x.field} ${x.a}<->${x.b} x${x.count}`).join("; "));
