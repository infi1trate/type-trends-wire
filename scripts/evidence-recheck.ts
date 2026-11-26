// Y1 · hand-run stored-evidence correction; no model calls. Usage: bun scripts/evidence-recheck.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { buildDossiers } from "../src/lib/evidence/evidence.server";
import { recheckStoredWhyNow } from "../src/lib/evidence/whynow.server";
import { pagedRows } from "../src/lib/paged";
import type { Entry } from "../src/lib/evidence/dossier";
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const read = () => pagedRows((f, t) => db.from("evidence_dossiers").select("signal,name,rise_start,rise_end,entries,counts").order("signal").range(f, t));
const before = await read();
if (before.error) throw new Error("Cannot load dossiers before rebuild");
const built = await buildDossiers({ only: before.data.map(d => d.signal), budgetMs: 170_000, fileNote: false });
if (built.errors.length || built.built !== before.data.length) throw new Error(`Incomplete rebuild: ${JSON.stringify(built)}`);
const after = await read();
if (after.error) throw new Error("Cannot load dossiers after rebuild");
const changes = before.data.flatMap(old => {
  const next = after.data.find(d => d.signal === old.signal);
  if (!next) throw new Error(`Missing rebuilt dossier ${old.signal}`);
  const dropped = (old.entries as unknown as Entry[]).filter(e => !(next.entries as unknown as Entry[]).some(n => n.id === e.id));
  return JSON.stringify(old) === JSON.stringify(next) ? [] : [{ signal: old.signal, dropped: dropped.map(e => ({ id: e.id, drawer: e.drawer })), before_entries: (old.entries as unknown as Entry[]).length, after_entries: (next.entries as unknown as Entry[]).length, rise_before: [old.rise_start, old.rise_end], rise_after: [next.rise_start, next.rise_end] }];
});
const blocks = await recheckStoredWhyNow();
const report = { run_at: new Date().toISOString(), dossiers_rebuilt: built.built, dossiers_changed: changes.length, entries_dropped: changes.reduce((n, c) => n + c.dropped.length, 0), changes, blocks, writer_calls: 0 };
mkdirSync("docs/proof/y1y2/coverage", { recursive: true });
writeFileSync("docs/proof/y1y2/coverage/recheck.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));