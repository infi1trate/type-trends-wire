// Y2 · the "Why now" writer's I/O (service role): the existing writer through the budget-guarded gateway call under its own ledger kind
// ("why_now"), fed only the dossier entries, their timing and the signal's stored numbers; the standards desk's rule checks run on the
// answer and the row is stored as passed or refused (a refused block is never shown). It refuses to run until the writer's current
// version has a passing golden score (golden/versions.ts), so no call is made from an unscored prompt.
import { WHY_KIND, WHY_SCHEMA, WHY_SYSTEM, checkWhyNow, parseWhy, whyUser, type Figure, type WhyNow } from "./whynow";
import { pagedRows } from "../paged";
import type { Entry } from "./dossier";

export async function writeWhyNow(kind: "signal" | "study" | "story", id: string, signal: string, figures: Figure[]): Promise<{ status: "passed" | "refused" | "skipped"; reason?: string; failures?: string[] }> {
  const [{ currentVersion }, { supabaseAdmin: db }, { gatewayCall }, { AI_MODELS }] = await Promise.all([import("../newsroom/golden/versions"), import("@/integrations/supabase/client.server"), import("../stories/writer.server"), import("../ai-models")]);
  if (!currentVersion("why")) return { status: "skipped", reason: "the Why-now writer has no passing golden score yet" };
  const d = await db.from("evidence_dossiers").select("name,entries,built_at").eq("signal", signal).maybeSingle();
  if (!d.data) return { status: "skipped", reason: "no dossier" };
  const entries = (d.data.entries as unknown as Entry[]).filter(e => e.phase === "before" || e.phase === "during");
  if (!entries.some(e => e.link)) return { status: "skipped", reason: "no dated, linked entry before or during the rise" };
  const tool = { type: "function" as const, function: { name: "emit_why_now", description: "Return the Why now block.", parameters: WHY_SCHEMA as unknown as Record<string, unknown> } };
  const r = await gatewayCall(db, { model: AI_MODELS.writer, system: WHY_SYSTEM, user: whyUser(d.data.name, entries, figures), schema: WHY_SCHEMA as unknown as Record<string, unknown>, schemaName: WHY_KIND, tool, maxTokens: 900, kind: WHY_KIND }, AbortSignal.timeout(40_000));
  if (!r) return { status: "skipped", reason: "no call (cap, budget or provider)" };
  const all = d.data.entries as unknown as Entry[], block = parseWhy(r.raw, all, figures), failures = block ? checkWhyNow(block, all, figures) : ["unreadable answer"];
  const status = failures.length ? "refused" : "passed";
  await db.from("why_now_blocks").insert({ subject_kind: kind, subject_id: id, status, block: (block ?? {}) as never, failures, dossier_at: d.data.built_at, model: AI_MODELS.writer });
  return { status, failures };
}

/** Hand-run correction only: recheck every historical block, not just the newest passed row.
 * Updating failures in place prevents the anonymous newest-passed reader falling back to stale older output.
 * No writer, no ledger reservation, and no schema change. */
export async function recheckStoredWhyNow() {
  const [{ supabaseAdmin: db }, { DATA_STORIES }, { latestSignals }] = await Promise.all([
    import("@/integrations/supabase/client.server"), import("../data-stories/registry"), import("../signals.server"),
  ]);
  const [blocks, dossiers, { signals }] = await Promise.all([
    pagedRows((f, t) => db.from("why_now_blocks").select("id,subject_kind,subject_id,status,block").order("id").range(f, t)),
    pagedRows((f, t) => db.from("evidence_dossiers").select("signal,entries,built_at").order("signal").range(f, t)),
    latestSignals("all"),
  ]);
  if (blocks.error || dossiers.error) throw new Error("Cannot load blocks or dossiers for standards recheck");
  const bySignal = new Map(dossiers.data.map(d => [d.signal, d]));
  const out = [];
  for (const row of blocks.data) {
    let signal = row.subject_kind === "signal" ? row.subject_id : "";
    if (row.subject_kind === "study") signal = DATA_STORIES.find(s => s.slug === row.subject_id)?.params.signal ?? "";
    if (row.subject_kind === "story") {
      const story = await db.from("stories").select("signal_keys").eq("id", row.subject_id).limit(1).maybeSingle();
      if (story.error) throw new Error("Cannot resolve story signal");
      signal = story.data?.signal_keys?.[0] ?? "";
    }
    const dossier = bySignal.get(signal), s = signals.find(s => s.key === signal);
    const figures: Figure[] = s ? [
      { id: "share", text: s.share == null ? "not measured" : `${s.share * 100}% of homepages` },
      ...(s.momentum != null ? [{ id: "momentum", text: `${s.momentum * 100} points a quarter` }] : []),
    ] : [];
    const b = row.block as unknown as WhyNow;
    const failures = !b || !Array.isArray(b.known) || !Array.isArray(b.likely) || !Array.isArray(b.read)
      ? ["unreadable stored block"] : checkWhyNow(b, (dossier?.entries ?? []) as unknown as Entry[], figures);
    // Rechecking may withdraw a row, never silently republish an already refused row.
    const status = failures.length ? "refused" : row.status;
    const w = await db.from("why_now_blocks").update({ status, failures, dossier_at: dossier?.built_at ?? null }).eq("id", row.id);
    if (w.error) throw new Error(`Standards recheck write failed for block ${row.id}`);
    out.push({ id: row.id, signal, subject: row.subject_id, before: row.status, after: status, failures });
  }
  return out;
}
