// Pure provider layer: selection, Gemini API request mapping and response parsing (no network, no env reads).
// The server adapters in ai-provider.server.ts call these, so tests cover the exact wire format.
import { GOOGLE_MODEL_IDS, type AiModel, type AiProvider } from "./ai-models";

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type ChatMessage = { role: "system" | "user"; content: string | ContentPart[] };
export type ForcedTool = { type: "function"; function: { name: string; description?: string; parameters: Record<string, unknown> } };
export type CompleteInput = {
  model: AiModel;
  messages: ChatMessage[];
  tools?: ForcedTool[];
  tool_choice?: { type: "function"; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  /** Structured output for models that refuse forced tools on this route (the writer); the JSON arrives as the message text. */
  response_format?: { type: "json_schema"; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } };
  signal?: AbortSignal;
};
export type Usage = { prompt_tokens: number; completion_tokens: number };
export type CompleteResult = { tool_call_args?: string; text?: string; usage: Usage; provider: AiProvider; model: string };
export type ProviderOutcome = "not_started" | "failed" | "unknown";

/** One error type for both adapters. `usage` is set when the provider billed the call (refusal, missing tool call). */
export class ProviderError extends Error {
  readonly code: string; readonly provider: AiProvider | null; readonly outcome: ProviderOutcome; readonly httpStatus?: number; readonly usage?: Usage;
  constructor(code: string, o: { provider: AiProvider | null; outcome: ProviderOutcome; httpStatus?: number; usage?: Usage; message?: string }) {
    super(o.message ?? code);
    this.name = "ProviderError"; this.code = code; this.provider = o.provider; this.outcome = o.outcome;
    if (o.httpStatus !== undefined) this.httpStatus = o.httpStatus;
    if (o.usage) this.usage = o.usage;
  }
}

/** AI_PROVIDER selects the adapter (default lovable). google requires GEMINI_API_KEY and fails closed without it:
 *  budget accounting must match the provider that actually ran, so there is never a silent fallback. */
export function selectProvider(env: Record<string, string | undefined>): { provider: AiProvider; key?: string } {
  const raw = (env["AI_PROVIDER"] ?? "").trim().toLowerCase() || "lovable";
  if (raw === "lovable") return { provider: "lovable" };
  if (raw === "google") {
    const key = env["GEMINI_API_KEY"]?.trim();
    if (!key) throw new ProviderError("provider_not_configured", { provider: "google", outcome: "not_started", message: "AI_PROVIDER=google but GEMINI_API_KEY is not set; refusing to fall back to the Lovable gateway" });
    return { provider: "google", key };
  }
  throw new ProviderError("provider_invalid", { provider: null, outcome: "not_started", message: "AI_PROVIDER must be 'lovable' or 'google'" });
}

/** Non-throwing label for receipts (model card, methodology). */
export function providerLabel(env: Record<string, string | undefined>): AiProvider | "misconfigured" {
  try { return selectProvider(env).provider; } catch { return "misconfigured"; }
}

export function googleModelId(model: AiModel): string {
  return GOOGLE_MODEL_IDS[model] ?? model.replace(/^google\//, "");
}

export function parseDataUrl(url: string): { mimeType: string; data: string } {
  const m = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(url);
  if (!m) throw new ProviderError("unsupported_image", { provider: "google", outcome: "not_started", message: "Images must be base64 data URLs" });
  return { mimeType: m[1]!.toLowerCase(), data: m[2]! };
}

function forcedTool(input: CompleteInput): ForcedTool | null {
  if (!input.tools?.length) return null;
  if (input.tools.length !== 1 || !input.tool_choice || input.tool_choice.function.name !== input.tools[0]!.function.name)
    throw new ProviderError("unsupported_tools", { provider: null, outcome: "not_started", message: "Exactly one forced function tool is supported" });
  return input.tools[0]!;
}

function systemText(content: ChatMessage["content"]): string {
  if (typeof content === "string") return content;
  return content.map(p => { if (p.type !== "text") throw new ProviderError("unsupported_image", { provider: "google", outcome: "not_started", message: "System messages are text only" }); return p.text; }).join("\n");
}

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
export type GeminiRequest = {
  contents: { role: "user"; parts: GeminiPart[] }[];
  systemInstruction?: { parts: { text: string }[] };
  tools?: { functionDeclarations: { name: string; description?: string; parameters: Record<string, unknown> }[] }[];
  toolConfig?: { functionCallingConfig: { mode: "ANY"; allowedFunctionNames: string[] } };
  generationConfig: { temperature?: number; maxOutputTokens?: number };
};

/** system → systemInstruction; user text/data-URL images → parts; forced tool → functionDeclarations + mode ANY. */
export function toGeminiRequest(input: CompleteInput): GeminiRequest {
  const system = input.messages.filter(m => m.role === "system").map(m => systemText(m.content)).filter(Boolean).join("\n\n");
  const contents = input.messages.filter(m => m.role === "user").map(m => ({
    role: "user" as const,
    parts: (typeof m.content === "string" ? [{ type: "text", text: m.content } as ContentPart] : m.content).map((p): GeminiPart => p.type === "text" ? { text: p.text } : { inlineData: parseDataUrl(p.image_url.url) }),
  }));
  const req: GeminiRequest = { contents, generationConfig: {} };
  if (input.temperature !== undefined) req.generationConfig.temperature = input.temperature;
  if (input.max_tokens !== undefined) req.generationConfig.maxOutputTokens = input.max_tokens;
  if (system) req.systemInstruction = { parts: [{ text: system }] };
  const tool = forcedTool(input);
  if (tool) {
    req.tools = [{ functionDeclarations: [{ name: tool.function.name, ...(tool.function.description ? { description: tool.function.description } : {}), parameters: tool.function.parameters }] }];
    req.toolConfig = { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [tool.function.name] } };
  }
  return req;
}

const REFUSAL_FINISH = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY"]);
type GeminiResponse = {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean; functionCall?: { name?: string; args?: unknown } }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  promptFeedback?: { blockReason?: string };
};

/** Usage = promptTokenCount / candidatesTokenCount + thoughtsTokenCount (thinking is billed as output). */
export function parseGeminiResponse(json: unknown, toolName: string | null, model: string): CompleteResult {
  const r = (json && typeof json === "object" ? json : {}) as GeminiResponse;
  const um = r.usageMetadata;
  if (!um || typeof um.promptTokenCount !== "number") throw new ProviderError("usage_unknown", { provider: "google", outcome: "unknown" });
  const usage: Usage = { prompt_tokens: um.promptTokenCount, completion_tokens: (um.candidatesTokenCount ?? 0) + (um.thoughtsTokenCount ?? 0) };
  const cand = r.candidates?.[0];
  if (r.promptFeedback?.blockReason || !cand || (cand.finishReason && REFUSAL_FINISH.has(cand.finishReason))) throw new ProviderError("refusal", { provider: "google", outcome: "failed", usage });
  const parts = cand.content?.parts ?? [];
  const text = parts.filter(p => typeof p.text === "string" && !p.thought).map(p => p.text).join("") || undefined;
  const result: CompleteResult = { usage, provider: "google", model, ...(text ? { text } : {}) };
  if (toolName) {
    const call = parts.find(p => p.functionCall?.name === toolName)?.functionCall;
    if (!call) throw new ProviderError("missing_function_call", { provider: "google", outcome: "failed", usage });
    result.tool_call_args = JSON.stringify(call.args ?? {});
  }
  return result;
}

/** HTTP status → error. Bodies are never read into errors or logs (they can echo request content). */
export function googleHttpError(status: number): ProviderError {
  const o = { provider: "google" as const, httpStatus: status };
  if (status === 400) return new ProviderError("provider_bad_request", { ...o, outcome: "failed" });
  if (status === 401 || status === 403) return new ProviderError("provider_or_policy_denied", { ...o, outcome: "failed" });
  if (status === 404) return new ProviderError("provider_model_unavailable", { ...o, outcome: "failed" });
  if (status === 429) return new ProviderError("rate_limited", { ...o, outcome: "failed" });
  if (status === 500 || status === 503) return new ProviderError("provider_unavailable", { ...o, outcome: "failed" });
  return new ProviderError("unknown_outcome", { ...o, outcome: "unknown" });
}

type OpenAiStyle = { usage?: { prompt_tokens?: number; completion_tokens?: number } | null; choices?: { message?: { content?: unknown; refusal?: unknown; tool_calls?: { type?: string; function?: { name?: string; arguments?: string } }[] } }[] };
/** Lovable gateway (chat-completions) response → CompleteResult; same checks and order as before the switch. */
export function parseChatCompletion(json: unknown, toolName: string | null, model: string): CompleteResult {
  const r = (json && typeof json === "object" ? json : {}) as OpenAiStyle;
  const u = r.usage;
  if (!u || typeof u.prompt_tokens !== "number" || typeof u.completion_tokens !== "number") throw new ProviderError("usage_unknown", { provider: "lovable", outcome: "unknown" });
  const usage: Usage = { prompt_tokens: u.prompt_tokens, completion_tokens: u.completion_tokens };
  const message = r.choices?.[0]?.message;
  if (message?.refusal) throw new ProviderError("refusal", { provider: "lovable", outcome: "failed", usage });
  const text = typeof message?.content === "string" && message.content ? message.content : undefined;
  const result: CompleteResult = { usage, provider: "lovable", model, ...(text ? { text } : {}) };
  if (toolName) {
    const call = message?.tool_calls?.find(t => t.type === "function" && t.function?.name === toolName);
    if (!call?.function || typeof call.function.arguments !== "string") throw new ProviderError("missing_function_call", { provider: "lovable", outcome: "failed", usage });
    result.tool_call_args = call.function.arguments;
  }
  return result;
}
