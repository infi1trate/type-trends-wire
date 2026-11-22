// N3 · the proof: fixture calls (purpose "fixture", not against the daily limits) and code runs on live data.
//   bun scripts/n3-proof.ts news        — replay the wire for 19, 20 and 21 Nov (one call per day)
//   bun scripts/n3-proof.ts graphics    — the picture check on the ten N2 golden stories, then five failed-gate crops shown as chosen (one call)
//   bun scripts/n3-proof.ts data        — the daily checks once on live data (no model), findings stored
//   bun scripts/n3-proof.ts backtest    — the backtest for the newest forecast old enough to score (no model)
// Results go to stdout and newsroom/scores/<desk>-v1.json (news, graphics) with the prompt hash they were made with.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { deskPromptHash } = await import("../src/lib/newsroom/golden/versions");
const MAX = Number(process.env["N3_MAX_CALLS"] ?? 0), LEDGER = "/tmp/n3/calls.json";
let calls = existsSync(LEDGER) ? (JSON.parse(readFileSync(LEDGER, "utf8")).calls as number) : 0;
const guard = () => { if (calls >= MAX) throw new Error(`call ceiling of ${MAX} reached`); calls++; writeFileSync(LEDGER, JSON.stringify({ calls })); };
const what = process.argv[2];

if (what === "news") {
  const N = await import("../src/lib/newsroom/news.server"), P = await import("../src/lib/newsroom/news");
  const days = ["2026-11-19", "2026-11-20", "2026-11-21"], out: unknown[] = [];
  const m = await N.matcherNow();
  for (const d of days) {
    const now = Date.parse(`${d}T23:59:00Z`);
    guard();
    const r = await N.runNewsDesk(db as never, { now, fixture: true, deadline: Date.now() + 90_000 });
    const { items } = await N.newsInputs(db as never, now);
    const byId = new Map(items.map(i => [i.id, i]));
    const picks = r.picked.map(p => ({ item: p.item, outlet: byId.get(p.item)?.source ?? "", title: byId.get(p.item)?.title ?? "", subject: p.subject, line: p.line, brand: p.domain }));
    const dropped = r.dropped.map(x => ({ item: x.id, line: x.line, reasons: x.reasons, title: byId.get(x.id)?.title ?? "" }));
    const mother = items.filter(i => /mother design/i.test(`${i.title} ${i.excerpt ?? ""}`)).map(i => ({ item: i.id, title: i.title, tag: P.brandTag(m, { title: P.clean(i.title), excerpt: P.clean(i.excerpt) || null, url: i.url, outlet: i.source }) }));
    out.push({ day: d, candidates: r.candidates, why: r.why, call_id: r.call_id, picks, dropped, mother });
    console.log(JSON.stringify({ day: d, candidates: r.candidates, why: r.why, picks, dropped, mother }, null, 1));
  }
  writeFileSync("newsroom/scores/news-v1.json", JSON.stringify({ desk: "news", version: "v1", prompt_hash: deskPromptHash("news"), run_at: new Date().toISOString(), days: (out as { day: string; picks: unknown[]; mother: { tag: string | null }[] }[]).map(x => ({ ...x, within_rules: x.mother.every(y => y.tag !== "motherlondon.com") })) }, null, 1) + "\n");
}

if (what === "graphics") {
  const G = await import("../src/lib/newsroom/graphics.server"), GP = await import("../src/lib/newsroom/graphics");
  const fx = JSON.parse(readFileSync("src/lib/newsroom/__fixtures__/standards-cases.json", "utf8")) as { cases: { number: number; id: string }[] };
  const items: unknown[] = [];
  for (const c of fx.cases) {
    const pi = await G.pictureInput(c.id);
    const refs = pi ? [...pi.g.chosen, ...pi.g.alternates] : [];
    if (!pi || !refs.length) { items.push({ number: c.number, id: c.id, called: false, decision: pi ? GP.decidePicture(null, pi.g, "the rule chose no picture of a page") : null, plan: pi?.plan.kind ?? null, right: true }); console.log(`No. ${c.number}: no picture of a page (${pi?.plan.kind ?? "unreadable"}); no call`); continue; }
    guard();
    const r = await G.pictureCheck(db as never, c.id, { fixture: true, inject: pi });
    items.push({ number: c.number, id: c.id, called: r.called, plan: pi.plan.kind, chosen: pi.g.chosen.map(x => x.label), alternates: pi.g.alternates.map(x => x.label), decision: r.decision, right: r.called });
    console.log(`No. ${c.number} (${pi.plan.kind}, ${pi.g.chosen.length} chosen, ${pi.g.alternates.length} alternates): ${r.decision.verdict} ${r.decision.kind} — ${r.decision.reason}\n   per picture: ${r.decision.per_picture.map(p => `${p.ref} ${p.usable ? "usable" : `not usable (${p.problem})`}: ${p.why}`).join(" | ")}${r.decision.ignored.length ? `\n   ignored: ${r.decision.ignored.join("; ")}` : ""}`);
  }
  // Five stored crops that fail the quality gate, shown as one story's chosen pictures (one call).
  const { data: bad } = await db.from("crop_quality").select("path,lead_ok").eq("lead_ok", false).order("path").limit(400);
  const paths = (bad ?? []).map(b => b.path);
  const { data: rows } = await db.from("site_crops").select("domain,section,path,captured_at,width,height,bytes").in("path", paths.slice(0, 200)).limit(200);
  const seen = new Set<string>(), five = (rows ?? []).filter(r => { if (seen.has(r.domain)) return false; seen.add(r.domain); return true; }).slice(0, 5);
  const refs = five.map((r, n) => ({ ref: `c${n + 1}`, asset: `crop:${r.path}`, src: `/crops/${r.path}`, domain: r.domain, section: r.section, date: String(r.captured_at).slice(0, 10), role: null, label: `${r.section} · ${r.domain} · ${String(r.captured_at).slice(0, 10)}` }));
  const g = { story: { id: "fixture:failed-crops", headline: "The first screens of five brands' homepages", deck: "Each picture shows a brand's homepage as captured.", caption: "First screens of five tracked homepages." }, chosen: refs, alternates: [], failing: refs.map(r => r.asset) };
  guard();
  const r = await G.pictureCheck(db as never, "fixture:failed-crops", { fixture: true, inject: { g, plan: { kind: "mosaic", items: [], caption: g.story.caption } as never } });
  const usableBack = r.decision.assets.some(a => g.failing.includes(a));
  console.log(`Failed crops (${five.map(f => `${f.domain}/${f.section}`).join(", ")}): ${r.decision.verdict} ${r.decision.kind} — ${r.decision.reason}\n   per picture: ${r.decision.per_picture.map(p => `${p.ref} ${p.usable ? "usable" : `not usable (${p.problem})`}: ${p.why}`).join(" | ")}\n   ignored: ${r.decision.ignored.join("; ") || "none"}\n   a failed crop came back usable: ${usableBack}`);
  items.push({ number: 0, id: "fixture:failed-crops", called: r.called, crops: five.map(f => f.path), decision: r.decision, right: !usableBack });
  const file = "newsroom/scores/graphics-v1.json";
  writeFileSync(file, JSON.stringify({ desk: "graphics", version: "v1", prompt_hash: deskPromptHash("graphics"), run_at: new Date().toISOString(), items }, null, 1) + "\n");
}

if (what === "data") {
  const D = await import("../src/lib/newsroom/datadesk.server");
  const r = await D.runDataChecks(db as never, { write: true, force: true });
  console.log(JSON.stringify({ why: r.why, counts: r.counts, opened: r.opened, closed: r.closed, errors: r.errors }, null, 1));
  const by = new Map<string, typeof r.findings>();
  for (const f of r.findings) by.set(f.kind, [...(by.get(f.kind) ?? []), f]);
  for (const [k, fs] of by) { console.log(`\n## ${k}: ${fs.length}`); for (const f of fs.slice(0, 10)) console.log(`- ${f.subject} · ${f.measure ?? ""} · expected ${f.expected ?? "–"} · found ${f.found ?? "–"} · receipt ${JSON.stringify(f.receipt).slice(0, 300)}`); }
  writeFileSync("/tmp/n3/data.json", JSON.stringify(r, null, 1));
}

if (what === "backtest") {
  const D = await import("../src/lib/newsroom/datadesk.server");
  console.log(JSON.stringify(await D.runBacktest(db as never, { write: true }), null, 1).slice(0, 4000));
}
console.log("model calls in the N3 proof so far:", calls);
process.exit(0);
