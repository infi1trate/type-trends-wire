// I3 · store each measured crop's lead quality (crop_quality). Derived rows only; upsert by path. Usage: bun scripts/i3-crop-quality.ts stats.json [--dry]
import { readFileSync } from "node:fs";
import { leadQuality } from "../src/lib/lead-picture";

type Stat = { domain: string; path: string; width: number; height: number; bytes: number; std: number; top: number; edges: number; bpp: number };
const [file, flag] = process.argv.slice(2);
const stats = JSON.parse(readFileSync(file!, "utf8")) as Stat[];
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const opted = new Set(((await db.from("thumb_optouts").select("domain")).data ?? []).map(r => r.domain as string));
const rows = stats.map(s => { const q = leadQuality(s, { stats: s, optedOut: opted }); return { path: s.path, lead_ok: q.ok, reason: q.reason, luma_std: s.std, top_share: s.top, edge_mean: s.edges, bytes_per_px: s.bpp, method: "pixels" }; });
const by = new Map<string, number>(); for (const r of rows) by.set(r.reason ?? "ok", (by.get(r.reason ?? "ok") ?? 0) + 1);
console.log(JSON.stringify({ rows: rows.length, reasons: Object.fromEntries(by) }));
if (flag !== "--dry") for (let i = 0; i < rows.length; i += 500) { const r = await db.from("crop_quality").upsert(rows.slice(i, i + 500), { onConflict: "path" }); if (r.error) throw new Error(r.error.message); }
console.log(flag === "--dry" ? "dry" : "stored");
