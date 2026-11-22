// N3/N4 · one vision call on the AI reads' model under the cost ledger (`desk_vision`), recorded in desk_calls. Shared by the graphics
// desk's picture check and the design review desk's weekly page review. Images are sent in memory only: never stored or logged.
import type { Admin } from "./review.server";

export type VisionRequest<T> = {
  desk: "graphics" | "design review"; purpose: "picture" | "review" | "fixture";
  system: string; tool: { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };
  text: string; images: { label: string; url: string }[]; parse: (raw: unknown) => T | null;
  storyIds: string[]; promptVersion: string | null; maxTokens: number; estimate: { input: number; output: number }; signal: AbortSignal;
};
/** Null when no call was made (the provider cannot run the model, the weekly cap is reached, or the reservation was refused). */
export async function visionCall<T>(db: Admin, r: VisionRequest<T>): Promise<{ parsed: T | null; call_id: number | null; cost: number; model: string } | null> {
  const [{ aiClient, markProvider, ProviderError }, { estimateCost }, { AI_MODELS, providerRuns }, nr] = await Promise.all([import("../ai-provider.server"), import("../ai-budget"), import("../ai-models"), import("./newsroom.server")]);
  const ai = aiClient(), provider = ai.provider, model = AI_MODELS.vision;
  if (!providerRuns(provider, model) || (await nr.capReachedNow(db))) return null;
  const estimate = estimateCost({ provider, model, input_tokens: r.estimate.input, output_tokens: r.estimate.output });
  const res = await db.rpc("ai_reserve", { p_snapshot_id: null as unknown as number, p_kind: "desk_vision", p_model: model, p_estimate: estimate });
  const rv = res.data as { ok?: boolean; id?: number } | null;
  if (res.error || !rv?.ok || typeof rv.id !== "number") return null;
  const uid = rv.id;
  if (!(await markProvider(db, uid, provider))) { await db.rpc("ai_settle", { p_id: uid, p_input: 0, p_output: 0, p_cost: 0, p_ok: false, p_error: "usage_write_failed", p_state: "rejected" }); return null; }
  const content: import("../ai-provider").ContentPart[] = [{ type: "text", text: r.text }];
  for (const im of r.images) { content.push({ type: "text", text: `${im.label}:` }); content.push({ type: "image_url", image_url: { url: im.url } }); }
  let raw: unknown = null, cost = estimate, error: string | null = null;
  try {
    const resp = await ai.complete({ model, max_tokens: r.maxTokens, temperature: 0.1, signal: r.signal, messages: [{ role: "system", content: r.system }, { role: "user", content }], tools: [r.tool], tool_choice: { type: "function", function: { name: r.tool.function.name } } });
    cost = estimateCost({ provider, model, input_tokens: resp.usage.prompt_tokens, output_tokens: resp.usage.completion_tokens });
    raw = resp.tool_call_args ?? resp.text ?? null;
    await db.rpc("ai_settle", { p_id: uid, p_input: resp.usage.prompt_tokens, p_output: resp.usage.completion_tokens, p_cost: cost, p_ok: raw != null, p_error: raw != null ? null as unknown as string : "no_answer", p_state: "done" });
  } catch (e) {
    if (e instanceof ProviderError && e.outcome === "not_started") { await db.rpc("ai_settle", { p_id: uid, p_input: 0, p_output: 0, p_cost: 0, p_ok: false, p_error: `${provider}_${e.code}`, p_state: "rejected" }); return null; }
    error = e instanceof ProviderError ? e.code : "unknown outcome";
    await db.rpc("ai_settle", { p_id: uid, p_input: e instanceof ProviderError && e.usage ? e.usage.prompt_tokens : 0, p_output: e instanceof ProviderError && e.usage ? e.usage.completion_tokens : 0, p_cost: estimate, p_ok: false, p_error: `desk_vision_${error}`.slice(0, 80), p_state: "unknown" });
  }
  const parsed = raw != null ? r.parse(raw) : null;
  const { data } = await db.from("desk_calls").insert({ desk: r.desk, purpose: r.purpose, model, usage_id: uid, ok: parsed != null, cost: Math.round(cost * 1e6) / 1e6, prompt_version: r.promptVersion, story_ids: r.storyIds,
    answer: (parsed ?? {}) as never, error: parsed == null ? (error ?? (raw == null ? "no answer" : "not the fixed structure")) : null }).select("id").single();
  return { parsed, call_id: (data?.id as number | undefined) ?? null, cost, model };
}
