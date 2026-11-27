// The writer's I/O (E2b): budget-guarded model calls under the cost ledger, the daily and per-build limits, and insert-only versions in
// story_texts. The orchestration takes injected I/O so tests run it in memory; a failure here never fails a build or delays a story.
import { AI_MODELS, providerRuns } from "../ai-models";
import { retryGuard } from "../ai-retries";
import { rewriteFactFailures } from "./voice-guide";
import type { FactStory } from "./writer-facts";
import { WRITER_KIND, WRITER_MAX_TOKENS, WRITER_PER_BUILD, WRITER_PER_DAY, WRITER_SCHEMA, WRITER_SYSTEM, WRITER_TOOL, parseWritten, writeWithFallback, writerUser, type Known, type WriterFacts, type WrittenText } from "./writer";

export type TextInsert = { story_id: string; version: number; headline: string; deck: string; body: string[]; how_we_know: string; model: string; cost: number; checked: boolean; attempts: number; failures: string[] };
export type WriterIO = {
  /** Calls to the writer model made today (UTC), from the cost ledger. */
  used: () => Promise<number>;
  /** Whether the configured provider can run this model (the writer runs only on the Lovable gateway). */
  runs: (model: string) => boolean;
  call: (model: string, facts: WriterFacts, failures: string[], signal: AbortSignal) => Promise<{ raw: unknown; cost: number; refused?: boolean } | null>;
  /** Highest stored version per story (any row, checked or not). */
  versions: (ids: string[]) => Promise<Map<string, number>>;
  insert: (rows: TextInsert[]) => Promise<number>;
};
export type WriteJob = { story: FactStory; facts: WriterFacts; template: WrittenText };
export type WriteResult = { written: number; checked: number; calls: number; rows: (TextInsert & { log: { model: string; failures: string[] }[] })[]; skipped: number };
/** A stored version tried the writer when the writer made it or the writer failed twice before the fallback (three calls). */
// T2 · D: a template stored after the writers gave no usable answer (the one structured retry spent, or a refusal) has been tried too,
// so the next build does not call again for the same facts; a correction or a rewrite request still makes it owed.
export const triedWriter = (row: { model: string; attempts: number; failures?: string[] | null }) => row.model === AI_MODELS.writer || row.attempts >= 3 || (row.model === "template" && (row.failures ?? []).includes("no usable answer"));
/** Leave this long before the deadline unused: a call is not started without it. */
export const WRITER_CALL_MIN_MS = 15_000;
export const WRITER_CONCURRENCY = 2;

/** Write each story in order while the limits and the deadline allow; insert one version per story that got at least one call. */
export async function writeStories(jobs: WriteJob[], io: WriterIO, known: Known, o: { deadline: number; perBuild?: number; now?: () => number }): Promise<WriteResult> {
  const clock = o.now ?? Date.now, perBuild = Math.min(o.perBuild ?? WRITER_PER_BUILD, WRITER_PER_BUILD);
  const usedToday = await io.used().catch(() => WRITER_PER_DAY);
  let writerCalls = 0, calls = 0, skipped = 0;
  const canCall = (model: string) => {
    if (!io.runs(model) || o.deadline - clock() < WRITER_CALL_MIN_MS) return false;
    if (model === AI_MODELS.writer) { if (writerCalls >= perBuild || usedToday + writerCalls >= WRITER_PER_DAY) return false; writerCalls++; }
    calls++;
    return true;
  };
  const versions = await io.versions(jobs.map(j => j.story.id)).catch(() => new Map<string, number>());
  const rows: WriteResult["rows"] = [];
  const queue = [...jobs];
  const worker = async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      // Out of writer calls (or time) while the provider can run the writer: the story waits for the next build with its template text.
      // The text model is the fallback for a writer that failed, not for a writer that ran out of calls.
      if (o.deadline - clock() < WRITER_CALL_MIN_MS || (io.runs(AI_MODELS.writer) && (writerCalls >= perBuild || usedToday + writerCalls >= WRITER_PER_DAY))) { skipped++; continue; }
      const g = retryGuard("writer", parseWritten);
      const prev = j.story.previous, extra = prev ? (t: WrittenText) => rewriteFactFailures(prev, t, [...j.facts.brands.map(b => b.name), ...(known.names ?? [])], j.facts) : undefined;
      const r = await writeWithFallback(j.facts, j.template, known, (model, failures) => g.call(io.call(model, j.facts, failures, AbortSignal.timeout(Math.max(1000, o.deadline - clock())))), m => g.open() && canCall(m), extra);
      if (!r.attempts) { skipped++; continue; }
      const t = r.text;
      rows.push({ story_id: j.story.id, version: (versions.get(j.story.id) ?? 0) + 1, headline: t.headline, deck: t.deck, body: t.body, how_we_know: t.how_we_know, model: r.model, cost: Math.round(r.cost * 1e6) / 1e6, checked: r.checked, attempts: r.attempts, failures: r.failures.slice(0, 12), log: r.log });
    }
  };
  await Promise.all(Array.from({ length: Math.min(WRITER_CONCURRENCY, jobs.length) }, worker));
  const written = rows.length ? await io.insert(rows.map(({ log: _l, ...x }) => x)).catch(() => 0) : 0;
  return { written, checked: rows.filter(r => r.checked).length, calls, rows, skipped };
}

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
const dayStart = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
/** Writer calls made today: the writer model under the writer's ledger purpose (health shows it; it includes the study writer's calls). */
export async function writerUsedToday(db: Pick<Admin, "from">): Promise<number> {
  const { count, error } = await db.from("ai_usage").select("id", { count: "exact", head: true }).eq("kind", WRITER_KIND).eq("model", AI_MODELS.writer).is("snapshot_id", null).neq("state", "rejected").gte("created_at", dayStart());
  if (error) throw new Error("writer_usage_failed");
  return count ?? 0;
}
/** N2 · writer-model calls the desks made today (UTC), every purpose. A failed read counts none, so the desks' calls stay in the story
 *  writer's count and it never over-spends because a count could not be read. */
export async function deskWriterCallsToday(db: Pick<Admin, "from">): Promise<number> {
  const { count, error } = await db.from("desk_calls").select("id", { count: "exact", head: true }).eq("model", AI_MODELS.writer).gte("at", dayStart());
  if (error) return 0;
  return count ?? 0;
}
export type GatewayRequest = { model: string; system: string; user: string; schema: Record<string, unknown>; schemaName: string; tool: { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };
  /** Writer-model output cap; the text model is capped at `textMaxTokens` (default 1500). */ maxTokens: number; textMaxTokens?: number;
  /** Y2 · the ledger kind (default the story writer's); "why_now" keeps the Why-now block's spend apart. */ kind?: string };
/**
 * One budget-guarded call on the configured provider (the story writer's and the study writer's): reserve under the writer's ledger
 * purpose, call once (the writer model with a strict JSON schema, the text model with one forced tool call), settle; unknown outcomes are
 * charged in full and never replayed. Null when the call was not made.
 */
export async function gatewayCall(admin: Admin, req: GatewayRequest, signal: AbortSignal): Promise<{ raw: unknown; cost: number; usage_id?: number; refused?: boolean } | null> {
  const { aiClient, markProvider, ProviderError } = await import("../ai-provider.server");
  const { estimateCost } = await import("../ai-budget");
  const ai = aiClient(), provider = ai.provider, m = req.model as typeof AI_MODELS.writer | typeof AI_MODELS.text;
  if (!providerRuns(provider, m)) return null;
  // N1 · the owner's weekly cap: while it is reached no writer call is made (the template text stands) and the refusal is logged.
  if (await capRefused(admin, req.schemaName)) return null;
  const writer = m === AI_MODELS.writer, estimate = estimateCost({ provider, model: m, input_tokens: 6000, output_tokens: writer ? 2500 : 1200 });
  const res = await admin.rpc("ai_reserve", { p_snapshot_id: null as unknown as number, p_kind: req.kind ?? WRITER_KIND, p_model: m, p_estimate: estimate });
  const r = res.data as { ok?: boolean; id?: number } | null;
  if (res.error || !r?.ok || typeof r.id !== "number") return null;
  const uid = r.id;
  if (!await markProvider(admin, uid, provider)) { await admin.rpc("ai_settle", { p_id: uid, p_input: 0, p_output: 0, p_cost: 0, p_ok: false, p_error: "usage_write_failed", p_state: "rejected" }); return null; }
  const messages = [{ role: "system" as const, content: req.system }, { role: "user" as const, content: req.user }];
  try {
    // T2 · an OpenAI model answers through a strict JSON schema (its function tools refuse the gateway's reasoning setting).
    const strictJson = writer || m.startsWith("openai/");
    const resp = await ai.complete(strictJson
      ? { model: m, max_tokens: req.maxTokens, signal, messages, response_format: { type: "json_schema", json_schema: { name: req.schemaName, strict: true, schema: req.schema } } }
      : { model: m, max_tokens: req.textMaxTokens ?? 1500, temperature: 0.3, signal, messages, tools: [req.tool], tool_choice: { type: "function", function: { name: req.tool.function.name } } });
    const u = resp.usage, cost = estimateCost({ provider, model: m, input_tokens: u.prompt_tokens, output_tokens: u.completion_tokens });
    const raw = resp.tool_call_args ?? resp.text ?? null;
    await admin.rpc("ai_settle", { p_id: uid, p_input: u.prompt_tokens, p_output: u.completion_tokens, p_cost: cost, p_ok: raw != null, p_error: raw != null ? null as unknown as string : "no_text", p_state: "done" });
    return { raw, cost, usage_id: uid };
  } catch (e) {
    if (e instanceof ProviderError && e.usage) { const cost = estimateCost({ provider, model: m, input_tokens: e.usage.prompt_tokens, output_tokens: e.usage.completion_tokens }); await admin.rpc("ai_settle", { p_id: uid, p_input: e.usage.prompt_tokens, p_output: e.usage.completion_tokens, p_cost: cost, p_ok: false, p_error: `${provider}_${e.code}`, p_state: "done" }); return { raw: null, cost, usage_id: uid, ...(e.code === "refusal" ? { refused: true } : {}) }; }
    if (e instanceof ProviderError && e.code === "refusal") { await admin.rpc("ai_settle", { p_id: uid, p_input: 0, p_output: 0, p_cost: estimate, p_ok: false, p_error: `${provider}_refusal`, p_state: "unknown" }); return { raw: null, cost: estimate, usage_id: uid, refused: true }; }
    if (e instanceof ProviderError && e.outcome === "not_started") { await admin.rpc("ai_settle", { p_id: uid, p_input: 0, p_output: 0, p_cost: 0, p_ok: false, p_error: `${provider}_${e.code}`, p_state: "rejected" }); return null; }
    await admin.rpc("ai_settle", { p_id: uid, p_input: 0, p_output: 0, p_cost: estimate, p_ok: false, p_error: "writer_unknown_outcome", p_state: "unknown" });
    return { raw: null, cost: estimate, usage_id: uid };
  }
}
let capLoggedAt = 0;
/** True when the weekly cap is reached; logs one refusal per ten minutes per isolate to the desk log. */
async function capRefused(admin: Admin, schemaName: string): Promise<boolean> {
  const nr = await import("../newsroom/newsroom.server");
  if (!(await nr.capReachedNow(admin))) return false;
  if (Date.now() - capLoggedAt > 10 * 60_000) {
    capLoggedAt = Date.now();
    const actor = schemaName.startsWith("study") ? "study writer" : schemaName.startsWith("digest") ? "digest writer" : schemaName.startsWith("standards") ? "standards" : schemaName.startsWith("chief") ? "editor in chief" : "story writer";
    await nr.insertLog(admin, { actor, action: "write", level: "ships alone", subject_kind: "week", subject_id: null, decision: "refused", reason: "The weekly spend cap is reached; the writer waits until Monday (Eastern time) and the facts-built text stands." }).catch(() => {});
  }
  return true;
}
/** Whether the configured provider can run this model (the writers run only on the Lovable gateway). */
export const providerCanRun = (model: string) => { try { const sel = (process.env["AI_PROVIDER"] ?? "").trim().toLowerCase() || "lovable"; return providerRuns(sel === "google" ? "google" : "lovable", model as never); } catch { return false; } };
/** The real I/O: reserve under the ledger, call once, settle; unknown outcomes are charged in full and never replayed. */
export function writerIO(admin: Admin): WriterIO {
  return {
    // E4: study calls share the ledger purpose and model, so the study writer's own writer calls today are taken out of the story count.
    // N2: the desks' calls on the writer model (standards, editor in chief, fixture runs) share the purpose too and are taken out.
    used: async () => { const [all, studies, digests, desks] = await Promise.all([writerUsedToday(admin), import("../data-stories/writer.server").then(m => m.studyWriterCallsToday(admin)).catch(() => 0), import("../digest/writer.server").then(m => m.digestWriterCallsToday(admin)).catch(() => 0), deskWriterCallsToday(admin)]); return Math.max(0, all - studies - digests - desks); },
    runs: providerCanRun,
    call: (model, facts, failures, signal) => gatewayCall(admin, { model, system: WRITER_SYSTEM, user: writerUser(facts, failures), schema: WRITER_SCHEMA as unknown as Record<string, unknown>, schemaName: "story_text", tool: WRITER_TOOL, maxTokens: WRITER_MAX_TOKENS }, signal),
    versions: async ids => {
      const out = new Map<string, number>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await admin.from("story_texts").select("story_id,version").in("story_id", ids.slice(i, i + 200));
        if (error) throw new Error("story_texts_read_failed");
        for (const r of data ?? []) out.set(r.story_id, Math.max(out.get(r.story_id) ?? 0, r.version));
      }
      return out;
    },
    insert: async rows => {
      const { data, error } = await admin.from("story_texts").upsert(rows as never, { onConflict: "story_id,version", ignoreDuplicates: true }).select("id");
      if (error) throw new Error("story_texts_insert_failed");
      return data?.length ?? 0;
    },
  };
}
