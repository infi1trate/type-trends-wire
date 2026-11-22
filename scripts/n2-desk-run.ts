// N2 · Part 6: run the live desk prompts once on the frozen fixtures (at most 16 model calls in all), and write the score files.
//   bun scripts/n2-desk-run.ts standards [numbers...]   — the second reader on the ten frozen cases (or the numbers given)
//   bun scripts/n2-desk-run.ts chief                    — the editor in chief on 19, 20 and 21 Nov
// Calls go through the story writer's gateway path and cost ledger, recorded in desk_calls with purpose "fixture" (not against the
// daily caps). Results are written to newsroom/scores/<desk>-<version>.json with the prompt hash they were made with.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { deskCall } = await import("../src/lib/newsroom/review.server");
const S = await import("../src/lib/newsroom/standards");
const C = await import("../src/lib/newsroom/chief");
const { deskPromptHash } = await import("../src/lib/newsroom/golden/versions");
const MAX_CALLS = 16, LEDGER = "/tmp/n2-desk-calls.json";
const spent = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")).calls as number : 0;
let calls = spent;
const guard = () => { if (calls >= MAX_CALLS) throw new Error(`call ceiling of ${MAX_CALLS} reached`); calls++; writeFileSync(LEDGER, JSON.stringify({ calls })); };
const [desk, ...only] = process.argv.slice(2);
const version = process.env["DESK_VERSION"] ?? "v1";

if (desk === "standards") {
  const fx = JSON.parse(readFileSync("src/lib/newsroom/__fixtures__/standards-cases.json", "utf8"));
  const file = `newsroom/scores/standards-${version}.json`;
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { items: [] };
  const items = new Map<number, unknown>(prev.items.map((x: { number: number }) => [x.number, x]));
  for (const c of fx.cases as { number: number; expect: "hold" | "pass"; id: string; input: import("../src/lib/newsroom/standards").ReviewInput }[]) {
    if (only.length && !only.includes(String(c.number))) continue;
    const list = S.checklist(c.input), fails = S.failed(list);
    guard();
    const r = await deskCall(db as never, "standards", "fixture", { system: S.STANDARDS_SYSTEM, user: S.standardsUser(c.input), schema: S.STANDARDS_SCHEMA as unknown as Record<string, unknown>, schemaName: "standards_review", tool: S.STANDARDS_TOOL, maxTokens: 2500 }, raw => S.parseProblems(raw, c.input), [c.id], AbortSignal.timeout(90_000));
    const problems = (r?.parsed ?? null) as import("../src/lib/newsroom/standards").Problem[] | null;
    const reader = problems == null ? "no answer" : S.blockers(problems).length ? "hold" : "pass";
    const verdict = fails.length ? "hold" : reader === "hold" ? "hold" : "pass";
    items.set(c.number, { number: c.number, id: c.id, expect: c.expect, verdict, right: verdict === c.expect, checklist: list, checklist_verdict: fails.length ? "hold" : "pass", second_reader: reader, problems, model: r?.model ?? null, cost: r?.cost ?? 0 });
    console.log(`No. ${c.number} expect ${c.expect}: checklist ${fails.length ? "hold" : "pass"}, second reader ${reader}${problems ? ` (${problems.map(p => `${p.severity}/${p.kind}: ${p.why}`).join(" | ")})` : ""}`);
  }
  const all = [...items.values()] as { number: number; right: boolean }[];
  writeFileSync(file, JSON.stringify({ desk: "standards", version, prompt_hash: deskPromptHash("standards"), run_at: new Date().toISOString(), cases: all.length, correct: all.filter(x => x.right).length, wrong: all.filter(x => !x.right).map(x => `No. ${x.number}`), items: all.sort((a, b) => a.number - b.number) }, null, 1) + "\n");
}
if (desk === "chief") {
  const fx = JSON.parse(readFileSync("src/lib/newsroom/__fixtures__/chief-days.json", "utf8"));
  const beats = readFileSync("newsroom/beats.md", "utf8");
  const days = [];
  for (const d of fx.days as { day: string; input: import("../src/lib/newsroom/chief").ChiefInput; actual: { lead: string | null; order: string[] } }[]) {
    if (only.length && !only.includes(d.day)) continue;
    const ci = { ...d.input, beats };
    guard();
    const r = await deskCall(db as never, "editor in chief", "fixture", { system: C.CHIEF_SYSTEM, user: C.chiefUser(ci), schema: C.CHIEF_SCHEMA as unknown as Record<string, unknown>, schemaName: "chief_front", tool: C.CHIEF_TOOL, maxTokens: 1500 }, C.parseChief, ci.stories.map(s => s.id), AbortSignal.timeout(90_000));
    const answer = (r?.parsed ?? null) as import("../src/lib/newsroom/chief").ChiefAnswer | null;
    const enforced = C.enforceChief(answer, ci.stories.map(s => ({ ...s, day: d.day })), d.actual.order, ci.slots, { leadOpen: ci.lead_open, today: d.day });
    days.push({ day: d.day, answer, enforced, actual: d.actual, within_rules: !!answer && !enforced.ignored.length, model: r?.model ?? null, cost: r?.cost ?? 0 });
    console.log(d.day, JSON.stringify({ answer, enforced, actual: d.actual }).slice(0, 3000));
  }
  const file = `newsroom/scores/chief-${version}.json`;
  writeFileSync(file, JSON.stringify({ desk: "editor in chief", version, prompt_hash: deskPromptHash("editor in chief"), run_at: new Date().toISOString(), cases: days.length, correct: days.filter(x => x.within_rules).length, wrong: days.filter(x => !x.within_rules).map(x => x.day), days }, null, 1) + "\n");
}
console.log("model calls so far in Part 6:", calls);
process.exit(0);
