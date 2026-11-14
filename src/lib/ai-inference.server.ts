import { z } from "zod";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { AI_MODELS, AI_LIMITS, type AiProvider } from "./ai-models";
import { estimateCost } from "./ai-budget";
import { cleanTags, normalizeExtraction, type ExtractionKind } from "./ai-schema";
import { libraryRequest } from "./ai-prompts";
import { aiClient, markProvider, ProviderError, type CompleteResult, type Usage } from "./ai-provider.server";
export class AiFailure extends Error { constructor(public code: string, public pause = false, public http = 503, public validation?: string) { super(code); } }
const reservationSchema = z.object({ ok: z.boolean(), id: z.number().optional(), code: z.string().optional() });
/** Provider error → worker failure. Denials, unknown outcomes and missing models pause the worker; 429 backs off. */
export function providerFailure(error: ProviderError): AiFailure {
  if (error.code === "missing_function_call") return new AiFailure("invalid_structured_output");
  if (error.code === "refusal") return new AiFailure("provider_refusal", true);
  if (error.code === "usage_unknown") return new AiFailure("usage_unknown", true);
  if (error.outcome === "not_started" && (error.code === "provider_not_configured" || error.code === "provider_invalid")) return new AiFailure(error.code, true);
  const status = error.httpStatus;
  const denied = status === 401 || status === 403;
  return new AiFailure(status === 402 ? "workspace_credits" : denied ? "provider_or_policy_denied" : status === 429 ? "rate_limited" : error.outcome === "unknown" ? "unknown_outcome" : error.code === "provider_model_unavailable" ? "provider_model_unavailable" : "gateway_failed", status === 402 || denied || status === 404 || error.outcome === "unknown", status === 429 ? 429 : 503);
}
export async function inferAI(input: { snapshot_id: number; kind: "vision" | ExtractionKind; context: string; captured_at: string; images?: string[]; imageLabels?: string[]; signal?: AbortSignal; validationError?: string }) {
 const model = input.kind === "vision" ? AI_MODELS.vision : AI_MODELS.text;
 let ai: ReturnType<typeof aiClient>;
 // Fail closed before reserving: a misconfigured provider must never charge or fall back.
 try { ai = aiClient(); } catch (e) { throw e instanceof ProviderError ? providerFailure(e) : e; }
 const provider: AiProvider = ai.provider;
 const estimate = estimateCost({ provider, model, input_tokens: input.kind === "vision" ? AI_LIMITS.visionInput : AI_LIMITS.textInput, output_tokens: AI_LIMITS.output });
 const { data, error } = await db.rpc("ai_reserve", { p_snapshot_id: input.snapshot_id, p_kind: input.kind, p_model: model, p_estimate: estimate });
 if (error) throw new AiFailure("reservation_failed");
 const reservation = reservationSchema.parse(data);
 if (!reservation.ok || reservation.id === undefined) throw new AiFailure(reservation.code ?? "budget_exhausted", false, 429);
 const uid = reservation.id;
 if (!await markProvider(db, uid, provider)) {
  await db.rpc("ai_settle", { p_id: uid, p_input: 0, p_output: 0, p_cost: 0, p_ok: false, p_error: "usage_write_failed", p_state: "rejected" });
  throw new AiFailure("usage_write_failed", true);
 }
 let accounted = false;
 const settleUsage = async (usage: Usage) => {
  const cost = estimateCost({ provider, model, input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens });
  const settled = await db.rpc("ai_settle", { p_id: uid, p_input: usage.prompt_tokens, p_output: usage.completion_tokens, p_cost: cost, p_ok: false, p_error: "validation_pending", p_state: "done" });
  if (settled.error) throw new AiFailure("usage_write_failed", true);
  accounted = true;
 };
 try {
  let response: CompleteResult;
  try { response = await ai.complete({ model, max_tokens: AI_LIMITS.output, temperature: 0, ...libraryRequest(input), ...(input.signal ? { signal: input.signal } : {}) }); }
  catch (e) { if (e instanceof ProviderError && e.usage) await settleUsage(e.usage); throw e; }
  await settleUsage(response.usage);
  if (response.tool_call_args === undefined) throw new AiFailure("invalid_structured_output");
  const raw: unknown = JSON.parse(response.tool_call_args);
  const result = input.kind === "vision" ? cleanTags(raw) : normalizeExtraction(input.kind, raw, input.captured_at);
  const success = await db.from("ai_usage").update({ ok: true, error: null }).eq("id", uid);
  if (success.error) throw new AiFailure("usage_write_failed", true);
  return { model, provider, data: result };
 } catch (error) {
  let failure = error instanceof AiFailure ? error : new AiFailure("invalid_structured_output",false,503,error instanceof z.ZodError?error.issues.map(i=>`${i.path.join('.')}: ${i.code}`).join('; ').slice(0,1000):"Malformed JSON or schema output");
  if (error instanceof ProviderError) failure = providerFailure(error);
  if(input.signal?.aborted && !(error instanceof ProviderError && (error.httpStatus===402||error.httpStatus===403||error.httpStatus===401))) failure=new AiFailure("run_deadline");
  if (!accounted) {
   // Reserve the full estimate for all ambiguous failures; do not log provider bodies.
   await db.rpc("ai_settle", { p_id: uid, p_input: 0, p_output: 0, p_cost: estimate, p_ok: false, p_error: failure.code, p_state: "unknown" });
  } else await db.from("ai_usage").update({ ok: false, error: failure.code }).eq("id", uid);
  throw failure;
 }
}
