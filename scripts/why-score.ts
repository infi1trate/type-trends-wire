// Y2 · HAND-RUN ONLY. Scores the "Why now" writer: (1) the ten frozen examples through the standards desk's checks (3 pass, 7 refuse,
// no model call); (2) three live writer calls on the frozen dossier under the "why_now" ledger kind, each must pass the same checks.
// Writes newsroom/scores/why-<hash>.json. Bar: 10/10 frozen and 3/3 live. Usage: bun scripts/why-score.ts
import { writeFileSync, readFileSync } from "node:fs";
import { WHY_KIND, WHY_SCHEMA, WHY_SYSTEM, checkWhyNow, parseWhy, whyUser, type WhyNow, type Figure } from "../src/lib/evidence/whynow";
import type { Entry } from "../src/lib/evidence/dossier";
import { promptHash, writerModels } from "../src/lib/newsroom/golden/versions";
const set = JSON.parse(readFileSync("src/lib/evidence/__fixtures__/why-now-set.json", "utf8")) as { dossier: Entry[]; figures: Figure[]; cases: { id: string; block: WhyNow; expect?: string; persons?: string[] }[] };
const frozen = set.cases.map(c => { const f = checkWhyNow(c.block, set.dossier, set.figures, c.persons ?? []); const want = c.id.startsWith("pass") ? "pass" : "refuse"; return { id: c.id, want, got: f.length ? "refuse" : "pass", failures: f }; });
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { gatewayCall } = await import("../src/lib/stories/writer.server");
const { AI_MODELS } = await import("../src/lib/ai-models");
const entries = set.dossier.filter(e => e.phase === "before" || e.phase === "during");
const tool = { type: "function" as const, function: { name: "emit_why_now", description: "Return the Why now block.", parameters: WHY_SCHEMA as unknown as Record<string, unknown> } };
const live: { n: number; passed: boolean; failures: string[]; block: WhyNow | null }[] = [];
let cost = 0;
for (let n = 1; n <= 3; n++) {
  const r = await gatewayCall(db, { model: AI_MODELS.writer, system: WHY_SYSTEM, user: whyUser("Entry animations", entries, set.figures), schema: WHY_SCHEMA as unknown as Record<string, unknown>, schemaName: WHY_KIND, tool, maxTokens: 900, kind: WHY_KIND }, AbortSignal.timeout(60_000));
  if (!r) { console.error("refused: no call (cap, budget or provider)"); process.exit(1); }
  cost += (r as { cost?: number }).cost ?? 0;
  const b = parseWhy(r.raw, set.dossier, set.figures), f = b ? checkWhyNow(b, set.dossier, set.figures) : ["unreadable answer"];
  live.push({ n, passed: !f.length, failures: f, block: b });
}
const fOk = frozen.filter(x => x.want === x.got).length, lOk = live.filter(x => x.passed).length;
const h = promptHash("why"), file = `newsroom/scores/why-${h}.json`;
writeFileSync(file, JSON.stringify({ writer: "why", prompt_hash: h, models: writerModels(), template: "t1", source: "frozen examples through the checks + 3 live calls on the frozen dossier", scored_at: new Date().toISOString(), cost_usd: Math.round(cost * 1e6) / 1e6, frozen: { passed: fOk, total: frozen.length, cases: frozen }, live: { passed: lOk, total: live.length, calls: live }, passed: fOk === frozen.length && lOk === live.length }, null, 1) + "\n");
console.log(JSON.stringify({ file, frozen: `${fOk}/${frozen.length}`, live: `${lOk}/${live.length}`, cost, bad: [...frozen.filter(x => x.want !== x.got), ...live.filter(x => !x.passed)] }));
process.exit(0);
