// Provider-list USD estimates, per 1M tokens; not a claim about workspace credit funding.
export const AI_MODELS = { vision: "google/gemini-3-flash-preview", text: "google/gemini-3.1-flash-lite" } as const;
export const AI_PRICES = {
  [AI_MODELS.vision]: { input: 0.5, output: 3 },
  [AI_MODELS.text]: { input: 0.25, output: 1.5 },
} as const;
export const AI_LIMITS = { visionInput: 100000, textInput: 15000, output: 4096, body: 2 * 1024 * 1024, batch: 10, concurrency: 3, textChars: 12000 } as const;
// Fail closed: zero provider retention does not establish omission from gateway payload logs.
export const VISION_IMAGE_PRIVACY_VERIFIED = false;