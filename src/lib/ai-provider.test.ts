// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { selectProvider, toGeminiRequest, parseGeminiResponse, parseChatCompletion, googleHttpError, googleModelId, ProviderError, providerLabel, type CompleteInput } from "./ai-provider";
import { AI_MODELS } from "./ai-models";
import { estimateCost } from "./ai-budget";

const tool = { type: "function" as const, function: { name: "emit_result", description: "Return evidence", parameters: { type: "object", properties: { a: { type: "string" } }, required: ["a"] } } };
const input: CompleteInput = {
  model: AI_MODELS.vision, temperature: 0, max_tokens: 4096,
  messages: [{ role: "system", content: "SYSTEM RULES" }, { role: "user", content: [{ type: "text", text: "context" }, { type: "text", text: "fold" }, { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } }] }],
  tools: [tool], tool_choice: { type: "function", function: { name: "emit_result" } },
};

describe("provider selection", () => {
  it("defaults to lovable", () => expect(selectProvider({})).toEqual({ provider: "lovable" }));
  it("selects google with a key", () => expect(selectProvider({ AI_PROVIDER: "google", GEMINI_API_KEY: "k" })).toEqual({ provider: "google", key: "k" }));
  it("fails closed when google has no key (no lovable fallback)", () => {
    expect(() => selectProvider({ AI_PROVIDER: "google" })).toThrow(ProviderError);
    try { selectProvider({ AI_PROVIDER: "google", GEMINI_API_KEY: " " }); } catch (e) { expect((e as ProviderError).code).toBe("provider_not_configured"); expect((e as ProviderError).outcome).toBe("not_started"); }
  });
  it("rejects unknown providers", () => expect(() => selectProvider({ AI_PROVIDER: "openai" })).toThrow("AI_PROVIDER must be"));
  it("labels a misconfigured provider for receipts", () => expect(providerLabel({ AI_PROVIDER: "google" })).toBe("misconfigured"));
  it("strips the google/ prefix for AI Studio ids", () => { expect(googleModelId(AI_MODELS.vision)).toBe("gemini-3-flash-preview"); expect(googleModelId(AI_MODELS.text)).toBe("gemini-3.1-flash-lite"); });
});

describe("Gemini request mapping", () => {
  const req = toGeminiRequest(input);
  it("maps system to systemInstruction", () => expect(req.systemInstruction).toEqual({ parts: [{ text: "SYSTEM RULES" }] }));
  it("maps user text and data-URL images in order", () => expect(req.contents).toEqual([{ role: "user", parts: [{ text: "context" }, { text: "fold" }, { inlineData: { mimeType: "image/jpeg", data: "QUJD" } }] }]));
  it("forces the single tool with mode ANY", () => {
    expect(req.tools).toEqual([{ functionDeclarations: [{ name: "emit_result", description: "Return evidence", parameters: tool.function.parameters }] }]);
    expect(req.toolConfig).toEqual({ functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["emit_result"] } });
  });
  it("maps temperature and max_tokens", () => expect(req.generationConfig).toEqual({ temperature: 0, maxOutputTokens: 4096 }));
  it("never puts a key in the request body", () => expect(JSON.stringify(req)).not.toMatch(/key/i));
  it("rejects non-data image URLs before any call", () => expect(() => toGeminiRequest({ ...input, messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "https://example.com/a.jpg" } }] }] })).toThrow("base64 data URLs"));
  it("rejects more than one tool", () => expect(() => toGeminiRequest({ ...input, tools: [tool, tool] })).toThrow("Exactly one"));
});

describe("Gemini response parsing", () => {
  const ok = { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "thinking", thought: true }, { functionCall: { name: "emit_result", args: { a: "x" } } }] } }], usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 80, thoughtsTokenCount: 300 } };
  it("returns tool args and counts thoughts tokens as output", () => expect(parseGeminiResponse(ok, "emit_result", "gemini-3-flash-preview")).toEqual({ tool_call_args: '{"a":"x"}', usage: { prompt_tokens: 1200, completion_tokens: 380 }, provider: "google", model: "gemini-3-flash-preview" }));
  it("works without thoughtsTokenCount", () => expect(parseGeminiResponse({ ...ok, usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }, "emit_result", "m").usage).toEqual({ prompt_tokens: 10, completion_tokens: 5 }));
  it("throws missing_function_call with billed usage", () => {
    const e = (() => { try { parseGeminiResponse({ candidates: [{ content: { parts: [{ text: "no call" }] } }], usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 3 } }, "emit_result", "m"); } catch (x) { return x as ProviderError; } return undefined; })();
    expect(e?.code).toBe("missing_function_call"); expect(e?.usage).toEqual({ prompt_tokens: 9, completion_tokens: 3 });
  });
  it("treats safety blocks as refusals", () => expect(() => parseGeminiResponse({ promptFeedback: { blockReason: "SAFETY" }, usageMetadata: { promptTokenCount: 4 } }, "emit_result", "m")).toThrow("refusal"));
  it("throws usage_unknown without usageMetadata", () => expect(() => parseGeminiResponse({ candidates: [] }, "emit_result", "m")).toThrow("usage_unknown"));
  it("maps HTTP statuses", () => {
    expect(googleHttpError(429).code).toBe("rate_limited");
    expect(googleHttpError(403).code).toBe("provider_or_policy_denied");
    expect(googleHttpError(504).outcome).toBe("unknown");
    expect(googleHttpError(503).outcome).toBe("failed");
  });
});

describe("Lovable response parsing (unchanged path)", () => {
  it("reads tool call arguments and usage", () => expect(parseChatCompletion({ usage: { prompt_tokens: 5, completion_tokens: 6 }, choices: [{ message: { tool_calls: [{ type: "function", function: { name: "emit_result", arguments: '{"a":1}' } }] } }] }, "emit_result", AI_MODELS.text)).toEqual({ tool_call_args: '{"a":1}', usage: { prompt_tokens: 5, completion_tokens: 6 }, provider: "lovable", model: AI_MODELS.text }));
  it("throws missing_function_call with usage", () => expect(() => parseChatCompletion({ usage: { prompt_tokens: 5, completion_tokens: 6 }, choices: [{ message: {} }] }, "emit_result", "m")).toThrow("missing_function_call"));
});

describe("per-provider prices", () => {
  it("google paid tier: vision $0.50/$3.00 per million", () => expect(estimateCost({ provider: "google", model: AI_MODELS.vision, input_tokens: 1e6, output_tokens: 1e6 })).toBe(3.5));
  it("google paid tier: text $0.25/$1.50 per million", () => expect(estimateCost({ provider: "google", model: AI_MODELS.text, input_tokens: 1e6, output_tokens: 1e6 })).toBe(1.75));
});

describe("Google adapter transport", () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
  afterEach(() => vi.unstubAllGlobals());
  it("sends the key only in x-goog-api-key and hits generateContent", async () => {
    vi.doMock("@lovable.dev/ai-gateway", () => ({ generateChatCompletion: vi.fn(), GatewayError: class extends Error {} }));
    const { completeGoogle } = await import("./ai-provider.server");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ functionCall: { name: "emit_result", args: { a: "x" } } }] } }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } }), { status: 200 }));
    const out = await completeGoogle(input, "secret-key");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent");
    expect(String(url)).not.toContain("secret-key");
    expect((init as RequestInit).headers).toEqual({ "content-type": "application/json", "x-goog-api-key": "secret-key" });
    expect(out.provider).toBe("google");
  });
});
