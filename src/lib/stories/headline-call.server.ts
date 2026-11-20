// Headline calls with I/O: read stored calls, make the missing ones (rule pass, then the text model inside the AI budget), store them
// insert-only in headline_calls. Model calls reserve under the story-line purpose (the usage ledger's kinds are a fixed list) with the
// event's snapshot id, so the per-day story-line count (which reads rows without a snapshot) is not used up. Never throws.
import type { EventRow } from "../agency/changes";
import { brandName } from "../brand-names";
import { callHeadline, ruleCall, headlineCallPrompt, headlineOf, HEADLINE_CALL_SYSTEM, HEADLINE_CALL_TOOL, HEADLINE_CALLS_PER_BUILD, type HeadlineCall } from "./headline-call";
import { WHY_KIND } from "./why";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
export type CallRow = { event_id: number; domain: string; before_text: string | null; after_text: string | null; call: HeadlineCall["call"]; reason: string; source: "rule" | "model"; model: string | null };
export type CallMap = Record<number, Pick<HeadlineCall, "call" | "reason"> & { source?: HeadlineCall["source"] }>;

export async function storedCalls(db: { from: Admin["from"] }, ids: number[]): Promise<CallMap> {
  const out: CallMap = {};
  for (let i = 0; i < ids.length; i += 200) {
    // Insert-only: the newest row for an event is the call (a re-checked rule or a desk decision supersedes older rows).
    const { data, error } = await db.from("headline_calls").select("event_id,call,reason,source,created_at,id").in("event_id", ids.slice(i, i + 200)).order("created_at").order("id");
    if (error) throw error;
    for (const r of data ?? []) out[r.event_id] = { call: r.call as HeadlineCall["call"], reason: r.reason, source: r.source as HeadlineCall["source"] };
  }
  return out;
}

/** One model call inside the budget: reserve, call, settle. Returns the tool arguments, or null when the budget or the call fails. */
async function ask(admin: Admin, e: EventRow, signal: AbortSignal): Promise<unknown> {
  const { aiClient, markProvider, ProviderError } = await import("../ai-provider.server");
  const { AI_MODELS } = await import("../ai-models"), { estimateCost } = await import("../ai-budget");
  const ai = aiClient(), provider = ai.provider, model = AI_MODELS.text;
  const estimate = estimateCost({ provider, model, input_tokens: 800, output_tokens: 120 });
  const res = await admin.rpc("ai_reserve", { p_snapshot_id: (e.snapshot_id ?? null) as unknown as number, p_kind: WHY_KIND, p_model: model, p_estimate: estimate });
  const r = res.data as { ok?: boolean; id?: number } | null;
  if (res.error || !r?.ok || typeof r.id !== "number") return null;
  const uid = r.id;
  if (!await markProvider(admin, uid, provider)) { await admin.rpc("ai_settle", { p_id: uid, p_input: 0, p_output: 0, p_cost: 0, p_ok: false, p_error: "usage_write_failed", p_state: "rejected" }); return null; }
  try {
    const resp = await ai.complete({ model, max_tokens: 160, temperature: 0, signal, messages: [{ role: "system", content: HEADLINE_CALL_SYSTEM }, { role: "user", content: [{ type: "text", text: headlineCallPrompt({ brand: brandName(e.domain), sector: e.sector ?? null, before: headlineOf(e.before), after: headlineOf(e.after) }) }] }], tools: [HEADLINE_CALL_TOOL], tool_choice: { type: "function", function: { name: "emit_call" } } });
    const u = resp.usage, cost = estimateCost({ provider, model, input_tokens: u.prompt_tokens, output_tokens: u.completion_tokens });
    await admin.rpc("ai_settle", { p_id: uid, p_input: u.prompt_tokens, p_output: u.completion_tokens, p_cost: cost, p_ok: !!resp.tool_call_args, p_error: (resp.tool_call_args ? null : "no_call") as unknown as string, p_state: "done" });
    return resp.tool_call_args ?? null;
  } catch (err) {
    if (err instanceof ProviderError && err.usage) { await admin.rpc("ai_settle", { p_id: uid, p_input: err.usage.prompt_tokens, p_output: err.usage.completion_tokens, p_cost: estimateCost({ provider, model, input_tokens: err.usage.prompt_tokens, output_tokens: err.usage.completion_tokens }), p_ok: false, p_error: `${provider}_${err.code}`, p_state: "done" }); return null; }
    await admin.rpc("ai_settle", { p_id: uid, p_input: 0, p_output: 0, p_cost: estimate, p_ok: false, p_error: "call_unknown_outcome", p_state: "unknown" });
    return null;
  }
}

/**
 * Calls for these headline changes: stored ones, then new rule calls (all stored), then at most `limit` model calls before the deadline
 * (answers stored; failures are returned as unclear for this build and asked again next time). Never throws.
 */
export async function headlineCalls(admin: Admin, events: EventRow[], o: { limit?: number; deadline: number; recheckRules?: boolean }): Promise<CallMap> {
  const pivots = events.filter(e => e.type === "message_pivot");
  let have: CallMap = {};
  try { have = await storedCalls(admin, pivots.map(e => e.id)); } catch { return {}; }
  // Maintenance only: a stored call is made again when the rule pass (which always runs first) now answers differently.
  const stale = (e: EventRow) => {
    const h = have[e.id]; if (!o.recheckRules || !h) return false;
    const r = ruleCall(headlineOf(e.before), headlineOf(e.after), brandName(e.domain));
    return h.source === "rule" ? !r || r.call !== h.call || r.reason !== h.reason : !!r;
  };
  const todo = pivots.filter(e => !have[e.id] || stale(e)), rows: CallRow[] = [], out: CallMap = { ...have };
  const { AI_MODELS } = await import("../ai-models");
  let asked = 0;
  for (const e of todo) {
    const before = headlineOf(e.before), after = headlineOf(e.after);
    const left = o.deadline - Date.now();
    const canAsk = asked < (o.limit ?? HEADLINE_CALLS_PER_BUILD) && left > 4000;
    const c = await callHeadline(before, after, () => { if (!canAsk) return Promise.resolve(undefined); asked++; return ask(admin, e, AbortSignal.timeout(Math.min(15_000, left - 2000))); }, AI_MODELS.text, brandName(e.domain));
    if (c.source === "model" && !canAsk) continue; // not asked yet: no call this build
    out[e.id] = { call: c.call, reason: c.reason };
    if (!c.failed) rows.push({ event_id: e.id, domain: e.domain, before_text: before, after_text: after, call: c.call, reason: c.reason, source: c.source, model: c.model ?? null });
  }
  if (rows.length) { const { error } = await admin.from("headline_calls").insert(rows as never); if (error) console.warn("headline calls not stored", error.code); }
  return out;
}
