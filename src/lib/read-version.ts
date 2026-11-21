// I3b · the read-version stamp on every AI read: a short hash of the model, the full vision request (system prompt, VISION_PROMPT and
// the answer schema with its label list), the label list itself, and the image recipe. Two reads with the same stamp were made the
// same way, so share series can be split by how pages were read. Pure: Web Crypto only (hosted runtime and tests alike).
import { libraryRequest } from "./ai-prompts";
import { VOCAB } from "./ai-schema";

/** What the crawler sends and how the request labels it (crawler/src/library.js and wayback.js share captureImages). */
export const IMAGE_RECIPE = "fold: first screen, 960w JPEG q70 | sections: up to 4, each two screens apart from the fold, 720w JPEG q65, labelled 'section n, top to bottom' | sections supersede the legacy page strip";
export const READ_VERSION_LENGTH = 12;

export async function readVersion(p: { model: string; request: unknown; vocab: unknown; recipe: string }): Promise<string> {
  const text = JSON.stringify([p.model, p.request, p.vocab, p.recipe]);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...digest].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, READ_VERSION_LENGTH);
}
/** The stamp for a vision read made now with `model` (the per-page context and images are left out: they are the page, not the method). */
export function visionReadVersion(model: string): Promise<string> {
  return readVersion({ model, request: libraryRequest({ kind: "vision", context: "", captured_at: "" }), vocab: VOCAB, recipe: IMAGE_RECIPE });
}
