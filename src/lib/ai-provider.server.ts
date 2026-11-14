// The single model-call entry point for library vision/text, the weekly brief and public taste inference.
// AI_PROVIDER=lovable (default): Lovable AI gateway. AI_PROVIDER=google: Gemini API with GEMINI_API_KEY.
import { generateChatCompletion, GatewayError } from "@lovable.dev/ai-gateway";
import type { AiProvider } from "./ai-models";
import { selectProvider, toGeminiRequest, parseGeminiResponse, parseChatCompletion, googleHttpError, googleModelId, ProviderError, type CompleteInput, type CompleteResult } from "./ai-provider";
export { ProviderError, type CompleteInput, type CompleteResult, type Usage } from "./ai-provider";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Resolve the provider once (before any budget reservation) so the reservation, the price table and the call agree. */
export function aiClient(): { provider: AiProvider; complete: (input: CompleteInput) => Promise<CompleteResult> } {
  const sel = selectProvider(process.env);
  if (sel.provider === "google") { const key = sel.key!; return { provider: "google", complete: input => completeGoogle(input, key) }; }
  return { provider: "lovable", complete: completeLovable };
}

async function completeLovable(input: CompleteInput): Promise<CompleteResult> {
  const { signal, ...payload } = input;
  let response: unknown;
  try {
    response = await generateChatCompletion(payload as Parameters<typeof generateChatCompletion>[0], signal ? { signal } : undefined);
  } catch (e) {
    if (e instanceof GatewayError) throw new ProviderError(e.outcome === "unknown" ? "unknown_outcome" : "gateway_failed", { provider: "lovable", outcome: e.outcome, ...(e.httpStatus !== undefined ? { httpStatus: e.httpStatus } : {}) });
    throw e;
  }
  return parseChatCompletion(response, input.tool_choice?.function.name ?? null, input.model);
}

export async function completeGoogle(input: CompleteInput, key: string): Promise<CompleteResult> {
  const model = googleModelId(input.model);
  const body = JSON.stringify(toGeminiRequest(input));
  let res: Response;
  try {
    // Key in the x-goog-api-key header only, never in the URL.
    res = await fetch(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body, ...(input.signal ? { signal: input.signal } : {}) });
  } catch {
    throw new ProviderError("unknown_outcome", { provider: "google", outcome: "unknown" });
  }
  if (!res.ok) { await res.body?.cancel().catch(() => {}); throw googleHttpError(res.status); }
  let json: unknown;
  try { json = await res.json(); } catch { throw new ProviderError("unknown_outcome", { provider: "google", outcome: "unknown" }); }
  return parseGeminiResponse(json, input.tool_choice?.function.name ?? null, model);
}

/** ai_usage.provider for a fresh reservation; returns false if the receipt could not be written. */
type Db = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
export async function markProvider(db: Db, id: number, provider: AiProvider): Promise<boolean> {
  const r = await db.from("ai_usage").update({ provider }).eq("id", id);
  return !r.error;
}
