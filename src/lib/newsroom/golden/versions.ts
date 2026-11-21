// N1 · writer versions. A version is the writer's prompt (system text and output schema), its models and its template version. The
// prompt part is a fingerprint computed from the code, so changing a prompt or a model changes it; the template version is bumped by
// hand when a facts-built text changes. Every current fingerprint must be listed in VERSIONS with a score file in newsroom/scores/
// whose score passes the gate against the baseline (versions.test.ts fails the build otherwise). Pure.
import { AI_MODELS } from "../../ai-models";
import { WRITER_SCHEMA, WRITER_SYSTEM } from "../../stories/writer";
import { STUDY_SCHEMA, STUDY_SYSTEM } from "../../data-stories/writer";
import { DIGEST_SCHEMA, DIGEST_SYSTEM } from "../../digest/writer";

export const WRITERS = ["story", "study", "digest"] as const;
export type Writer = (typeof WRITERS)[number];
/** Bump when that writer's facts-built (template) text changes. */
export const TEMPLATE_VERSIONS: Record<Writer, string> = { story: "t1", study: "t1", digest: "t1" };
const PARTS: Record<Writer, { system: string; schema: unknown }> = {
  story: { system: WRITER_SYSTEM, schema: WRITER_SCHEMA }, study: { system: STUDY_SYSTEM, schema: STUDY_SCHEMA }, digest: { system: DIGEST_SYSTEM, schema: DIGEST_SCHEMA },
};
/** The writer model, then the fallback text model (both writers' calls go through one gateway path). */
export const writerModels = () => [AI_MODELS.writer, AI_MODELS.text];
/** FNV-1a 32-bit over the text, hex (a fingerprint, not a secret). */
export function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}
export const promptHash = (w: Writer) => fnv(JSON.stringify([PARTS[w].system, PARTS[w].schema, writerModels()]));
export type VersionEntry = { writer: Writer; version: string; prompt_hash: string; models: string[]; template: string; score_file: string; note: string };
/** The recorded versions, oldest first. Add one (with its score file) whenever a prompt, model or template changes. */
export const VERSIONS: readonly VersionEntry[] = [
  { writer: "story", version: "v1", prompt_hash: "4f5cbcfb", models: ["openai/gpt-6.2-astra", "google/gemini-3.1-flash-lite"], template: "t1", score_file: "newsroom/scores/story-v1.json", note: "Baseline (N1): the prompt that wrote the frozen texts." },
  { writer: "study", version: "v1", prompt_hash: "e60d3efd", models: ["openai/gpt-6.2-astra", "google/gemini-3.1-flash-lite"], template: "t1", score_file: "newsroom/scores/study-v1.json", note: "Baseline (N1): no frozen study text yet (every shown study text was written for an earlier facts sheet)." },
  { writer: "digest", version: "v1", prompt_hash: "0afd9fce", models: ["openai/gpt-6.2-astra", "google/gemini-3.1-flash-lite"], template: "t1", score_file: "newsroom/scores/digest-v1.json", note: "Baseline (N1): no frozen Digest text yet (the frozen set holds stories only)." },
];
export const currentVersion = (w: Writer) => {
  const h = promptHash(w), t = TEMPLATE_VERSIONS[w];
  return VERSIONS.find(v => v.writer === w && v.prompt_hash === h && v.template === t) ?? null;
};
