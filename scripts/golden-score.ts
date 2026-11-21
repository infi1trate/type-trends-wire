// N1 · Part 5: score the frozen writing set and write a score file for the writer's current version.
//   bun scripts/golden-score.ts --frozen            scores the frozen approved texts (no model call): the baseline.
//   bun scripts/golden-score.ts --live --writer story   HAND-RUN ONLY. Calls the story writer once per frozen story (its frozen facts),
//       scores what comes back and writes newsroom/scores/story-<version>.json. It refuses when the weekly cap is reached, when today's
//       story-writer allowance cannot cover every call, or when the current prompt has no entry in VERSIONS. Nothing is stored in the
//       database except the cost ledger rows every writer call makes.
import { readFileSync, writeFileSync } from "node:fs";
import { scoreSet, type WritingSet } from "../src/lib/newsroom/golden/score";
import { currentVersion, promptHash, writerModels } from "../src/lib/newsroom/golden/versions";
const has = (k: string) => process.argv.includes(k);
const set = JSON.parse(readFileSync("src/lib/newsroom/golden/__fixtures__/writing-set.json", "utf8")) as WritingSet;
const v = currentVersion("story");
if (!v) { console.error(`refused: the story prompt's fingerprint ${promptHash("story")} has no entry in VERSIONS; add one first.`); process.exit(1); }
if (has("--frozen")) {
  const s = scoreSet(set);
  writeFileSync(v.score_file, JSON.stringify({ writer: "story", version: v.version, prompt_hash: v.prompt_hash, models: writerModels(), template: v.template, source: "frozen approved texts (no model call)", frozen_at: set.frozen_at, scored_at: new Date().toISOString(), ...s }, null, 1) + "\n");
  console.log(JSON.stringify({ file: v.score_file, mean: s.mean, passed: s.passed, total: s.total }));
  process.exit(0);
}
if (!has("--live") || process.argv[process.argv.indexOf("--writer") + 1] !== "story") { console.error("usage: --frozen | --live --writer story"); process.exit(1); }
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { spendStatus } = await import("../src/lib/newsroom/newsroom.server");
const { capReached } = await import("../src/lib/newsroom/spend");
if (capReached(await spendStatus(db))) { console.error("refused: the weekly spend cap is reached."); process.exit(1); }
const { writerIO } = await import("../src/lib/stories/writer.server");
const { WRITER_PER_DAY, parseWritten } = await import("../src/lib/stories/writer");
const { AI_MODELS } = await import("../src/lib/ai-models");
const io = writerIO(db), used = await io.used();
if (used + set.items.length > WRITER_PER_DAY) { console.error(`refused: ${used} of ${WRITER_PER_DAY} story-writer calls are used today; the set needs ${set.items.length}.`); process.exit(1); }
if (!io.runs(AI_MODELS.writer)) { console.error("refused: the configured provider cannot run the writer model."); process.exit(1); }
const texts = new Map<string, ReturnType<typeof parseWritten> & object>();
let cost = 0;
for (const i of set.items) {
  const r = await io.call(AI_MODELS.writer, i.facts, [], AbortSignal.timeout(90_000));
  cost += r?.cost ?? 0;
  const t = r ? parseWritten(r.raw) : null; if (t) texts.set(i.id, t);
}
const s = scoreSet(set, texts);
const file = v.score_file.replace(/\.json$/, `-live-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(file, JSON.stringify({ writer: "story", version: v.version, prompt_hash: v.prompt_hash, models: writerModels(), template: v.template, source: "live writer calls on the frozen facts", scored_at: new Date().toISOString(), cost_usd: Math.round(cost * 1e6) / 1e6, unanswered: set.items.length - texts.size, ...s }, null, 1) + "\n");
console.log(JSON.stringify({ file, mean: s.mean, passed: s.passed, total: s.total, cost }));
process.exit(0);
