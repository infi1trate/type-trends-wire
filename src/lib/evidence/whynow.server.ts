// Y2 · the "Why now" writer's I/O (service role): the existing writer through the budget-guarded gateway call under its own ledger kind
// ("why_now"), fed only the dossier entries, their timing and the signal's stored numbers; the standards desk's rule checks run on the
// answer and the row is stored as passed or refused (a refused block is never shown). It refuses to run until the writer's current
// version has a passing golden score (golden/versions.ts), so no call is made from an unscored prompt.
import { WHY_KIND, WHY_SCHEMA, WHY_SYSTEM, checkWhyNow, parseWhy, whyUser, type Figure } from "./whynow";
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
