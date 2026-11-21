// N1 · Part 5: freeze the writing set. For each published story whose current written text passed the check and has not been corrected
// or retired since, and for each published study with a checked text, store its facts sheet (rebuilt from what is stored now) and its
// approved text as a fixture. Reads only; no model call. Usage: bun scripts/n1-freeze-writing-set.ts [--out path]
import { writeFileSync } from "node:fs";
const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const OUT = arg("--out") ?? "src/lib/newsroom/golden/__fixtures__/writing-set.json";
const { loadInput, factSource, shareBases } = await import("../src/lib/stories/build.server");
const { allCandidates } = await import("../src/lib/stories/candidates");
const { writerFacts } = await import("../src/lib/stories/writer-facts");
const { checkText } = await import("../src/lib/stories/writer");
const { applyEdits } = await import("../src/lib/stories/edits");
const { canonical } = await import("../src/lib/labels");
const { studyJobs } = await import("../src/lib/data-stories/page.server");
const { checkStudyText } = await import("../src/lib/data-stories/writer");
const { DATA_STORIES } = await import("../src/lib/data-stories/registry");
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const all = async <T,>(q: (f: number, t: number) => PromiseLike<{ data: T[] | null; error: unknown }>) => { const out: T[] = []; for (let f = 0; ; f += 1000) { const { data, error } = await q(f, f + 999); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 1000) return out; } };
const nums = await all<{ story_id: string; number: number }>((f, t) => db.from("story_numbers").select("story_id,number").order("number").range(f, t));
const ids = nums.map(n => n.story_id);
const cols = "id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at";
const stories = (await db.from("stories").select(cols).in("id", ids)).data ?? [];
const edits = (await db.from("story_edits").select("id,story_id,action,payload,note,at").in("story_id", ids).order("id")).data ?? [];
const texts = (await db.from("story_texts").select("id,story_id,version,headline,deck,body,how_we_know,model,checked,created_at").in("story_id", ids).order("version")).data ?? [];
type T = (typeof texts)[number];
const chosen: { id: string; number: number; text: T; shown: ReturnType<typeof applyEdits> }[] = [], left: { number: number; id: string; why: string }[] = [];
for (const n of nums) {
  const s = stories.find(x => x.id === n.story_id); if (!s) continue;
  const v = applyEdits(s as never, edits.filter(e => e.story_id === s.id) as never, Date.now());
  const last = texts.filter(t => t.story_id === s.id).at(-1);
  if (v.state !== "published") { if (last?.checked) left.push({ number: n.number, id: s.id, why: v.state === "killed" ? `retired or killed: ${v.killReason ?? ""}`.slice(0, 120) : v.state }); continue; }
  if (!last || !last.checked) { left.push({ number: n.number, id: s.id, why: last ? "newest text did not pass the check (template)" : "no written text" }); continue; }
  if (v.correctedAt && v.correctedAt > last.created_at) { left.push({ number: n.number, id: s.id, why: "corrected after its newest written text" }); continue; }
  chosen.push({ id: s.id, number: n.number, text: last, shown: v });
}
// Facts as the writer saw them: the build's own window, read as of the minute the newest text was written (one read per distinct time).
const DAYS = Number(arg("--days") ?? 14);
const inputs = new Map<string, Awaited<ReturnType<typeof loadInput>>>();
const { confirmedInput } = await import("../src/lib/stories/editor");
for (const t of new Set(chosen.map(c => c.text.created_at.slice(0, 16)))) inputs.set(t, confirmedInput(await loadInput({ days: DAYS, allRuns: false, realRunIds: [], now: Date.parse(`${t}:00Z`) + 60_000 })).input);
const input = [...inputs.values()].at(-1)!;
const { ctx } = allCandidates(input);
const fs = chosen.map(c => ({ id: c.shown.id, type: c.shown.type, headline: c.shown.headline, deck: c.shown.deck, facts: c.shown.facts, sector: c.shown.sector, signal_keys: c.shown.signal_keys, domains: c.shown.domains, source_ids: c.shown.source_ids, basis: c.shown.basis, happened_at: c.shown.happened_at, kicker: c.shown.kicker }));
const keys = [...new Set(fs.flatMap(st => st.signal_keys.slice(0, 3).map(canonical)))], scopes = [...new Set(["all", ...fs.map(st => st.sector).filter((x): x is string => !!x)])];
const bases = ctx.cur && keys.length ? await shareBases(ctx.cur.id, keys, scopes) : new Map();
const known = { names: factSource(input, ctx, bases).known };
const storyItems = chosen.map((c, i) => {
  const inp = inputs.get(c.text.created_at.slice(0, 16))!, src = factSource(inp, allCandidates(inp).ctx, bases);
  const { facts } = writerFacts(fs[i]!, src), text = { headline: c.text.headline, deck: c.text.deck, body: c.text.body ?? [], how_we_know: c.text.how_we_know };
  return { kind: "story" as const, id: c.id, number: c.number, model: c.text.model, written_at: c.text.created_at, facts, text, check_now: checkText(text, facts, known, { requireBody: true }) };
});
const { jobs, known: sk } = await studyJobs();
const live = new Set(DATA_STORIES.filter(d => d.status === "live").map(d => d.slug));
const st = (await db.from("study_texts").select("slug,facts_hash,headline,deck,opening,scenes,use_text,model,checked_at,created_at").not("checked_at", "is", null).order("created_at")).data ?? [];
const studyItems = jobs.filter(j => live.has(j.slug)).flatMap(j => {
  const t = st.filter(x => x.slug === j.slug && x.facts_hash === j.hash).at(-1);
  if (!t) { left.push({ number: j.sheet.number, id: `study:${j.slug}`, why: "no checked text for its current facts sheet" }); return []; }
  const text = { headline: t.headline, deck: t.deck, opening: t.opening, scenes: t.scenes as never, use: t.use_text ?? "" };
  return [{ kind: "study" as const, id: `study:${j.slug}`, number: j.sheet.number, model: t.model, written_at: t.created_at, facts: j.sheet, text, check_now: checkStudyText(text as never, j.sheet, sk) }];
});
const out = { frozen_at: new Date().toISOString(), known: { stories: known.names, studies: sk.names }, items: [...storyItems, ...studyItems] };
writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ out: OUT, bytes: JSON.stringify(out).length, items: out.items.map(x => ({ id: x.id, number: x.number, kind: x.kind, model: x.model, failures: x.check_now })), left }, null, 1));
process.exit(0);
