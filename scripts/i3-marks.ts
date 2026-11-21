// I3 · one-off pass: judge every live change of the last 14 days with the re-read and measurement-failure rules (reread.ts) and append
// the marks (library_event_marks, insert-only). Nothing is deleted or rewritten; verdict rows are appended only where they differ, as
// every build does. Usage: bun scripts/i3-marks.ts [--dry]
const dry = process.argv.includes("--dry");
const { supabaseAdmin: admin } = await import("../src/integrations/supabase/client.server");
const { supabaseAnon } = await import("../src/lib/mcp/supabase");
const { computeChecks, recordChecks, latestChecks } = await import("../src/lib/integrity.server");
const db = supabaseAnon(), since = new Date(Date.now() - 14 * 864e5).toISOString();
const events: { id: number; domain: string; type: string; before: unknown; after: unknown; detected_at: string; source: string; page_type: string; viewport: string; snapshot_id: number | null; prev_snapshot_id: number | null }[] = [];
for (let f = 0; ; f += 1000) {
  const { data, error } = await db.from("library_events").select("id,domain,type,before,after,detected_at,source,page_type,viewport,snapshot_id,prev_snapshot_id").eq("source", "live").gte("detected_at", since).order("id").range(f, f + 999);
  if (error) throw error; events.push(...(data as never[])); if (!data || data.length < 1000) break;
}
const before = await latestChecks(db, events.map(e => e.id));
const checks = await computeChecks(db, events);
const marked = [...checks].filter(([, c]) => c.marks && Object.keys(c.marks).length);
const byKind: Record<string, number> = {}, byType: Record<string, number> = {}, offTape: { id: number; domain: string; type: string; day: string; kind: string }[] = [];
for (const [id, c] of marked) {
  const e = events.find(x => x.id === id)!;
  for (const m of Object.values(c.marks!)) byKind[m.kind] = (byKind[m.kind] ?? 0) + 1;
  byType[e.type] = (byType[e.type] ?? 0) + 1;
  if (before.get(id)?.verdict === "pass" && c.verdict !== "pass") offTape.push({ id, domain: e.domain, type: e.type, day: e.detected_at.slice(0, 10), kind: c.verdict });
}
const ai = events.filter(e => e.type === "aesthetic_shift" || e.type === "imagery_shift");
const aiRe = ai.filter(e => checks.get(e.id)?.verdict === "reread");
const perDay: Record<string, { ai: number; reread: number }> = {};
for (const e of ai) { const d = e.detected_at.slice(0, 10); perDay[d] ??= { ai: 0, reread: 0 }; perDay[d].ai++; if (checks.get(e.id)?.verdict === "reread") perDay[d].reread++; }
const written = dry ? 0 : await recordChecks(admin as never, checks);
console.log(JSON.stringify({ dry, events: events.length, marked_events: marked.length, byKind, byType, ai_events: ai.length, ai_rereads: aiRe.length, perDay, tape_before: [...before.values()].filter(c => c.verdict === "pass").length, tape_after: [...checks.values()].filter(c => c.verdict === "pass").length, left_tape: offTape.length, offTape, verdict_rows_written: written }, null, 1));
