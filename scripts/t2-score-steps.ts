// T2 · C: score a cheaper candidate model on each story step's frozen set, at the present pass mark, and write the score files.
//   bun scripts/t2-score-steps.ts <model> [writer] [standards] [chief]
// The writer: the six frozen stories (gatePasses against story-v1: mean no lower, no passing text now failing). The standards second
// reader: the cases the current version (standards-v3) ran (deskGatePasses: none right before is wrong now). The editor in chief: the
// three replayed days (deskGatePasses against chief-v1). Every call is reserved and settled in ai_usage; desk calls are recorded in
// desk_calls as fixtures. At most MAX_CALLS calls per run (a ledger in /tmp counts across runs).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { deskCall } = await import("../src/lib/newsroom/review.server");
const S = await import("../src/lib/newsroom/standards");
const C = await import("../src/lib/newsroom/chief");
const V = await import("../src/lib/newsroom/golden/versions");
const { scoreSet, gatePasses } = await import("../src/lib/newsroom/golden/score");
const MAX_CALLS = 60, LEDGER = "/tmp/t2-score-calls.json";
let calls = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")).calls as number : 0;
const guard = () => { if (calls >= MAX_CALLS) throw new Error(`call ceiling of ${MAX_CALLS} reached`); calls++; writeFileSync(LEDGER, JSON.stringify({ calls })); };
const [model, ...steps] = process.argv.slice(2) as [import("../src/lib/ai-models").AiModel, ...string[]];
const day = new Date().toISOString().slice(0, 10), slug = model.split("/")[1];
const out: Record<string, unknown> = {};

if (steps.includes("writer")) {
  const { writerIO } = await import("../src/lib/stories/writer.server");
  const { parseWritten } = await import("../src/lib/stories/writer");
  const set = JSON.parse(readFileSync("src/lib/newsroom/golden/__fixtures__/writing-set.json", "utf8"));
  const base = JSON.parse(readFileSync("newsroom/scores/story-v1.json", "utf8"));
  const io = writerIO(db as never), texts = new Map();
  let cost = 0, tokens = 0;
  for (const i of set.items) { guard(); const r = await io.call(model, i.facts, [], AbortSignal.timeout(90_000)); cost += r?.cost ?? 0; const t = r ? parseWritten(r.raw) : null; if (t) texts.set(i.id, t); }
  const s = scoreSet(set, texts), g = gatePasses(base, s);
  const file = `newsroom/scores/story-${slug}-${day}.json`;
  writeFileSync(file, JSON.stringify({ writer: "story", candidate_model: model, against: "story-v1", source: "live calls on the frozen facts (no fallback)", scored_at: new Date().toISOString(), cost_usd: Math.round(cost * 1e6) / 1e6, unanswered: set.items.length - texts.size, gate: g, ...s }, null, 1) + "\n");
  out["writer"] = { file, mean: s.mean, passed: s.passed, total: s.total, gate: g.ok, reasons: g.reasons.slice(0, 4), unanswered: set.items.length - texts.size, cost, tokens };
}
if (steps.includes("standards")) {
  const fx = JSON.parse(readFileSync("src/lib/newsroom/__fixtures__/standards-cases.json", "utf8"));
  const base = JSON.parse(readFileSync("newsroom/scores/standards-v3.json", "utf8"));
  const ran = new Set((base.items as { number: number }[]).map(x => x.number));
  const items: { number: number; key: string; right: boolean; verdict: string; expect: string; second_reader: string }[] = [];
  let cost = 0;
  for (const c of fx.cases as { number: number; expect: "hold" | "pass"; id: string; input: import("../src/lib/newsroom/standards").ReviewInput }[]) {
    if (!ran.has(c.number)) continue;
    const list = S.checklist(c.input), fails = S.failed(list);
    guard();
    const r = await deskCall(db as never, "standards", "fixture", { system: S.STANDARDS_SYSTEM, user: S.standardsUser(c.input), schema: S.STANDARDS_SCHEMA as unknown as Record<string, unknown>, schemaName: "standards_review", tool: S.STANDARDS_TOOL, maxTokens: 2500 }, raw => S.parseProblems(raw, c.input), [c.id], AbortSignal.timeout(90_000), "standards", model);
    cost += r?.cost ?? 0;
    const problems = (r?.parsed ?? null) as import("../src/lib/newsroom/standards").Problem[] | null;
    const reader = problems == null ? "no answer" : S.blockers(problems).length ? "hold" : "pass";
    const verdict = fails.length ? "hold" : reader === "hold" ? "hold" : "pass";
    items.push({ number: c.number, key: `No. ${c.number}`, right: verdict === c.expect, verdict, expect: c.expect, second_reader: reader });
  }
  const baseCases = (base.items as { number: number; right: boolean }[]).map(x => ({ key: `No. ${x.number}`, right: x.right }));
  const g = V.deskGatePasses({ cases: baseCases } as never, { cases: items } as never);
  const file = `newsroom/scores/standards-${slug}-${day}.json`;
  writeFileSync(file, JSON.stringify({ desk: "standards", candidate_model: model, against: "standards-v3", run_at: new Date().toISOString(), cost_usd: Math.round(cost * 1e6) / 1e6, cases: items.length, correct: items.filter(x => x.right).length, wrong: items.filter(x => !x.right).map(x => x.key), gate: g, items }, null, 1) + "\n");
  out["standards"] = { file, correct: items.filter(x => x.right).length, of: items.length, gate: g.ok, reasons: g.reasons, cost };
}
if (steps.includes("chief")) {
  const fx = JSON.parse(readFileSync("src/lib/newsroom/__fixtures__/chief-days.json", "utf8"));
  const base = JSON.parse(readFileSync("newsroom/scores/chief-v1.json", "utf8"));
  const beats = readFileSync("newsroom/beats.md", "utf8");
  const days: { day: string; key: string; right: boolean }[] = [];
  let cost = 0;
  for (const d of fx.days as { day: string; input: import("../src/lib/newsroom/chief").ChiefInput; actual: { lead: string | null; order: string[] } }[]) {
    const ci = { ...d.input, beats };
    guard();
    const r = await deskCall(db as never, "editor in chief", "fixture", { system: C.CHIEF_SYSTEM, user: C.chiefUser(ci), schema: C.CHIEF_SCHEMA as unknown as Record<string, unknown>, schemaName: "chief_front", tool: C.CHIEF_TOOL, maxTokens: 1500 }, C.parseChief, ci.stories.map(s => s.id), AbortSignal.timeout(90_000), "editor in chief", model);
    cost += r?.cost ?? 0;
    const answer = (r?.parsed ?? null) as import("../src/lib/newsroom/chief").ChiefAnswer | null;
    const enforced = C.enforceChief(answer, ci.stories.map(s => ({ ...s, day: d.day })), d.actual.order, ci.slots, { leadOpen: ci.lead_open, today: d.day });
    days.push({ day: d.day, key: d.day, right: !!answer && !enforced.ignored.length });
  }
  const g = V.deskGatePasses({ cases: (base.days as { day: string; within_rules: boolean }[]).map(x => ({ key: x.day, right: x.within_rules })) } as never, { cases: days } as never);
  const file = `newsroom/scores/chief-${slug}-${day}.json`;
  writeFileSync(file, JSON.stringify({ desk: "editor in chief", candidate_model: model, against: "chief-v1", run_at: new Date().toISOString(), cost_usd: Math.round(cost * 1e6) / 1e6, cases: days.length, correct: days.filter(x => x.right).length, wrong: days.filter(x => !x.right).map(x => x.key), gate: g, days }, null, 1) + "\n");
  out["chief"] = { file, correct: days.filter(x => x.right).length, of: days.length, gate: g.ok, reasons: g.reasons, cost };
}
console.log(JSON.stringify({ model, calls_so_far: calls, ...out }, null, 1));
process.exit(0);
