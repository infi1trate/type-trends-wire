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
import { NEWS_SCHEMA, NEWS_SYSTEM } from "../news";
import { CHART_SCHEMA, CHART_SYSTEM, GRAPHICS_SCHEMA, GRAPHICS_SYSTEM } from "../graphics";
import { PROPOSAL_SCHEMA, PROPOSAL_SYSTEM } from "../datadesk";
import { DESIGN_SCHEMA, DESIGN_SYSTEM } from "../design-review";
import { PUBLISHER_SCHEMA, PUBLISHER_SYSTEM } from "../publisher";
import { SCOUT_SCHEMA, SCOUT_SYSTEM } from "../scout";

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
// N3 adds the news desk's picks, the graphics desk's picture check (the AI reads' vision model) and chart choice, and the data desk's
// weekly proposal, under the same rule.
// N4 adds the design review desk's weekly page review (the vision model); N5 the publisher's social drafts and the scout's candidates.
export const DESK_PROMPTS = ["standards", "editor in chief", "news", "graphics", "graphics chart", "data", "design review", "publisher", "scout"] as const;
export type DeskPrompt = (typeof DESK_PROMPTS)[number];
const DESK_PARTS: Record<DeskPrompt, { system: string; schema: unknown; models?: () => string[] }> = {
  standards: { system: STANDARDS_SYSTEM, schema: STANDARDS_SCHEMA }, "editor in chief": { system: CHIEF_SYSTEM, schema: CHIEF_SCHEMA },
  news: { system: NEWS_SYSTEM, schema: NEWS_SCHEMA }, graphics: { system: GRAPHICS_SYSTEM, schema: GRAPHICS_SCHEMA, models: () => [AI_MODELS.vision] },
  "graphics chart": { system: CHART_SYSTEM, schema: CHART_SCHEMA }, data: { system: PROPOSAL_SYSTEM, schema: PROPOSAL_SCHEMA },
  "design review": { system: DESIGN_SYSTEM, schema: DESIGN_SCHEMA, models: () => [AI_MODELS.vision] },
  publisher: { system: PUBLISHER_SYSTEM, schema: PUBLISHER_SCHEMA }, scout: { system: SCOUT_SYSTEM, schema: SCOUT_SCHEMA },
};
export const deskModels = (d: DeskPrompt) => DESK_PARTS[d].models?.() ?? writerModels();
export const deskPromptHash = (d: DeskPrompt) => fnv(JSON.stringify([DESK_PARTS[d].system, DESK_PARTS[d].schema, deskModels(d)]));
export type DeskVersion = { desk: DeskPrompt; version: string; prompt_hash: string; models: string[]; score_file: string; note: string };
export const DESK_VERSIONS: readonly DeskVersion[] = [
  { desk: "standards", version: "v1", prompt_hash: "aff6f787", models: ["openai/gpt-6.2-astra", "google/gemini-3.1-flash-lite"], score_file: "newsroom/scores/standards-v1.json", note: "Baseline (N2 Part 6): held the four must-hold stories, but also blocked all six must-pass stories, mostly on picture capture dates, How we know and stage words." },
  { desk: "standards", version: "v2", prompt_hash: "d95f228d", models: ["openai/gpt-6.2-astra", "google/gemini-3.1-flash-lite"], score_file: "newsroom/scores/standards-v2.json", note: "Tuned once: captions, How we know and stage words are records, and a blocker is defined. Run on Nos. 42, 88 and 89 (all passed) within the 16-call ceiling; not re-run on the other seven." },
  { desk: "standards", version: "v3", prompt_hash: "b14b95c3", models: ["openai/gpt-6.2-astra", "google/gemini-3.1-flash-lite"], score_file: "newsroom/scores/standards-v3.json", note: "N3: v2 re-run on the seven cases held No. 43 (must pass) on a ranking its stored facts carry. Tuned once (a claim a FACTS line states is supported) and the stored facts now go with the sheet; run on Nos. 43, 77, 45 and 92 (all right; 77, 45 and 92 before the stored-facts change). Not re-run on the other six within the 30-call proof ceiling." },
  { desk: "editor in chief", version: "v1", prompt_hash: "74a028af", models: ["openai/gpt-6.2-astra", "google/gemini-3.1-flash-lite"], score_file: "newsroom/scores/chief-v1.json", note: "Baseline (N2 Part 6): replayed 19, 20 and 21 Nov; on 20 Nov it chose a weekly piece to lead, which the rules refused." },
  { desk: "news", version: "v1", prompt_hash: "34175f15", models: ["openai/gpt-6.2-astra", "google/gemini-3.1-flash-lite"], score_file: "newsroom/scores/news-v1.json", note: "Baseline (N3 proof): replayed 19, 20 and 21 Nov, one pick a day, none dropped by the line check; the Mother Design item stays untagged." },
  { desk: "news", version: "v2", prompt_hash: "24e2d43c", models: ["openai/gpt-6.2-astra", "google/gemini-3.1-flash-lite"], score_file: "newsroom/scores/news-v2.json", note: "N4c: the beat (brand identity, websites and digital products, type, design tools and the trade; architecture, interiors, furniture, objects, fashion, art and exhibitions out) in the prompt and in code. Replayed the last 72 hours (20, 21, 22 Nov) as three fixture calls: one pick each time: the Nielsen Norman AI-design study on 20 and 21 Nov (kept by the code after its word list took in users) and the Design Museum posters on 22 Nov (dropped by the code as a museum item); nothing naming a rebrand, typeface, website redesign or design tool was passed over." },
  { desk: "graphics", version: "v1", prompt_hash: "800fb210", models: ["google/gemini-3-flash-preview"], score_file: "newsroom/scores/graphics-v1.json", note: "Baseline (N3 proof): the ten N2 golden stories and five failed-gate crops in one call; no failed crop came back usable." },
  { desk: "graphics chart", version: "v1", prompt_hash: "0811aa29", models: ["openai/gpt-6.2-astra", "google/gemini-3.1-flash-lite"], score_file: "newsroom/scores/graphics-chart-v1.json", note: "Baseline, not yet run (see the score file)." },
  { desk: "design review", version: "v1", prompt_hash: "2161424a", models: ["google/gemini-3-flash-preview"], score_file: "newsroom/scores/design-review-v1.json", note: "Baseline (N4 proof): three pages (front, story, brand) of the second test review run, as fixture calls; what code kept and dropped is in the score file." },
  { desk: "data", version: "v1", prompt_hash: "43d08926", models: ["openai/gpt-6.2-astra", "google/gemini-3.1-flash-lite"], score_file: "newsroom/scores/data-v1.json", note: "Baseline, not yet run (see the score file)." },
  { desk: "publisher", version: "v1", prompt_hash: "82e9010a", models: ["openai/gpt-6.2-astra", "google/gemini-3.1-flash-lite"], score_file: "newsroom/scores/publisher-v1.json", note: "Baseline (N5 proof): one fixture drafts call on Digest No. 1; three Digest drafts kept, none dropped." },
  { desk: "scout", version: "v1", prompt_hash: "61622a61", models: ["openai/gpt-6.2-astra", "google/gemini-3.1-flash-lite"], score_file: "newsroom/scores/scout-v1.json", note: "Baseline (N5 proof): one fixture candidates call on the seven days to 22 Nov; nine kept, one dropped (already tracked)." },
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
