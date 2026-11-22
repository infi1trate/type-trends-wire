// N1 · writer versions. A version is the writer's prompt (system text and output schema), its models and its template version. The
// prompt part is a fingerprint computed from the code, so changing a prompt or a model changes it; the template version is bumped by
// hand when a facts-built text changes. Every current fingerprint must be listed in VERSIONS with a score file in newsroom/scores/
// whose score passes the gate against the baseline (versions.test.ts fails the build otherwise). Pure.
import { AI_MODELS } from "../../ai-models";
import { WRITER_SCHEMA, WRITER_SYSTEM } from "../../stories/writer";
import { STUDY_SCHEMA, STUDY_SYSTEM } from "../../data-stories/writer";
import { DIGEST_SCHEMA, DIGEST_SYSTEM } from "../../digest/writer";
import { STANDARDS_SCHEMA, STANDARDS_SYSTEM } from "../standards";
import { CHIEF_SCHEMA, CHIEF_SYSTEM } from "../chief";

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

// N2 · THE DESKS' PROMPTS under the same rule: the standards second reader and the editor in chief. A desk's version is its prompt
// (system text and output schema) and its models; its score file is the Part 6 fixture run (must-hold cases held, must-pass cases
// passed, the editor's three replayed days). A changed prompt fails the build until a new version is recorded with a score file whose
// result is no worse than the baseline's (deskGatePasses).
export const DESK_PROMPTS = ["standards", "editor in chief"] as const;
export type DeskPrompt = (typeof DESK_PROMPTS)[number];
const DESK_PARTS: Record<DeskPrompt, { system: string; schema: unknown }> = { standards: { system: STANDARDS_SYSTEM, schema: STANDARDS_SCHEMA }, "editor in chief": { system: CHIEF_SYSTEM, schema: CHIEF_SCHEMA } };
export const deskPromptHash = (d: DeskPrompt) => fnv(JSON.stringify([DESK_PARTS[d].system, DESK_PARTS[d].schema, writerModels()]));
export type DeskVersion = { desk: DeskPrompt; version: string; prompt_hash: string; models: string[]; score_file: string; note: string };
export const DESK_VERSIONS: readonly DeskVersion[] = [
  { desk: "standards", version: "v1", prompt_hash: "aff6f787", models: ["openai/gpt-6.2-astra", "google/gemini-3.1-flash-lite"], score_file: "newsroom/scores/standards-v1.json", note: "Baseline (N2 Part 6): held the four must-hold stories, but also blocked all six must-pass stories, mostly on picture capture dates, How we know and stage words." },
  { desk: "standards", version: "v2", prompt_hash: "d95f228d", models: ["openai/gpt-6.2-astra", "google/gemini-3.1-flash-lite"], score_file: "newsroom/scores/standards-v2.json", note: "Tuned once: captions, How we know and stage words are records, and a blocker is defined. Run on Nos. 42, 88 and 89 (all passed) within the 16-call ceiling; not re-run on the other seven." },
  { desk: "editor in chief", version: "v1", prompt_hash: "74a028af", models: ["openai/gpt-6.2-astra", "google/gemini-3.1-flash-lite"], score_file: "newsroom/scores/chief-v1.json", note: "Baseline (N2 Part 6): replayed 19, 20 and 21 Nov; on 20 Nov it chose a weekly piece to lead, which the rules refused." },
];
export const currentDeskVersion = (d: DeskPrompt) => DESK_VERSIONS.find(v => v.desk === d && v.prompt_hash === deskPromptHash(d)) ?? null;
/** A desk score file's cases: for standards, whether each frozen story got its expected verdict (the checklist and the second reader
 *  together); for the editor in chief, whether each replayed day's answer kept within the rules. */
export type DeskScore = { cases: { key: string; right: boolean }[] };
export const deskScoreOf = (file: { items?: { number: number; right: boolean }[]; days?: { day: string; within_rules: boolean }[] }): DeskScore =>
  ({ cases: [...(file.items ?? []).map(x => ({ key: `No. ${x.number}`, right: x.right })), ...(file.days ?? []).map(x => ({ key: x.day, right: x.within_rules }))] });
/** A new desk version passes when no case the baseline got right goes wrong (over the cases both ran), and it ran at least one case. */
export function deskGatePasses(baseline: DeskScore, candidate: DeskScore): { ok: boolean; reasons: string[] } {
  const base = new Map(baseline.cases.map(c => [c.key, c.right])), reasons: string[] = [];
  if (!candidate.cases.length) reasons.push("the new version ran no case");
  for (const c of candidate.cases) if (base.get(c.key) === true && !c.right) reasons.push(`${c.key} was right in the baseline and is now wrong`);
  return { ok: !reasons.length, reasons };
}
