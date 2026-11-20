// Canonical model ids (Lovable gateway form). Stored in ai_usage/library_tags regardless of provider.
// writer (E2b): the strongest text model the gateway offers this project, used only by the story writer. It is an OpenAI model, so it
// has no Google price or id: under AI_PROVIDER=google the writer step falls straight back to the text model.
export const AI_MODELS = { vision: "google/gemini-3-flash-preview", text: "google/gemini-3.1-flash-lite", writer: "openai/gpt-6.2-astra" } as const;
export type AiModel = (typeof AI_MODELS)[keyof typeof AI_MODELS];
export const AI_PROVIDERS = ["lovable", "google"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];
// Provider-list USD estimates per 1M tokens; not a claim about workspace credit funding.
// lovable: gateway list price (provider price passed through; checked against the gateway models list 2026-11-20). google: Gemini API
// paid tier, Standard (ai.google.dev/gemini-api/docs/pricing, checked 2026-11-14); output price includes thinking tokens.
export const AI_PRICES: Record<AiProvider, Partial<Record<AiModel, { input: number; output: number }>>> = {
  lovable: { [AI_MODELS.vision]: { input: 0.5, output: 3 }, [AI_MODELS.text]: { input: 0.25, output: 1.5 }, [AI_MODELS.writer]: { input: 8, output: 40 } },
  google: { [AI_MODELS.vision]: { input: 0.5, output: 3 }, [AI_MODELS.text]: { input: 0.25, output: 1.5 } },
};
// Google AI Studio ids for the canonical models (canonical minus "google/"). Confirm with
// `bun scripts/ai-parity.ts --models` (models.list) once GEMINI_API_KEY exists; edit here if they differ.
export const GOOGLE_MODEL_IDS: Partial<Record<AiModel, string>> = {
  [AI_MODELS.vision]: "gemini-3-flash-preview",
  [AI_MODELS.text]: "gemini-3.1-flash-lite",
};
/** A model the provider can run (the writer runs only on the Lovable gateway). */
export const providerRuns = (provider: AiProvider, model: AiModel) => AI_PRICES[provider][model] != null;
export const AI_LIMITS = { visionInput: 250000, textInput: 15000, output: 4096, body: 2 * 1024 * 1024, batch: 10, concurrency: 3, textChars: 12000 } as const;
