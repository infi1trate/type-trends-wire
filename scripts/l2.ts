// L2 proof: `bun scripts/l2.ts rewrite <storyId>|package-fresh <week> [base]|digest <week>|dating <number...>|wire-steps|registry`.
// The package row made here is marked as a test; the rewrite is one story-writer call through the normal path and check.
const cmd = process.argv[2];
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const out = (x: unknown) => console.log(JSON.stringify(x, null, 1));
if (cmd === "rewrite") {
  const id = process.argv[3]!;
  const { loadInput, factSource, BUILD_DAYS } = await import("../src/lib/stories/build.server");
  const { allCandidates } = await import("../src/lib/stories/candidates");
  const { writerFacts } = await import("../src/lib/stories/writer-facts");
  const { writeStories, writerIO } = await import("../src/lib/stories/writer.server");
  const { applyEdits } = await import("../src/lib/stories/edits");
  const { checkText, sheetLinesOf, flatShareFailures } = await import("../src/lib/stories/writer");
  const input = await loadInput({ days: BUILD_DAYS + 7, allRuns: false, realRunIds: [] });
  const { ctx } = allCandidates(input), src = factSource(input, ctx);
  const cols = "id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at";
  const [{ data: st }, { data: ed }] = await Promise.all([db.from("stories").select(cols).eq("id", id).single(), db.from("story_edits").select("id,story_id,action,payload,note,at").eq("story_id", id).order("id")]);
  const s = applyEdits(st as never, (ed ?? []) as never, Date.now());
  const story = { id: s.id, type: s.type, headline: s.headline, deck: s.deck, facts: s.facts, sector: s.sector, signal_keys: s.signal_keys, domains: s.domains, source_ids: s.source_ids, basis: s.basis, happened_at: s.happened_at, kicker: s.kicker };
  const job = { story, ...writerFacts(story, src) };
  const { data: old } = await db.from("story_texts").select("headline,deck,body,checked,created_at").eq("story_id", id).eq("checked", true).order("created_at", { ascending: false }).limit(1);
  const o = old?.[0] as { deck: string; body: string[] } | undefined;
  out({ before: o, before_flat: o ? flatShareFailures([o.deck, ...(o.body ?? [])].join("\n"), sheetLinesOf(job.facts)) : null, sheet_numbers: job.facts.numbers.map(n => n.text) });
  void checkText;
  const r = await writeStories([job], writerIO(db as never), { names: src.known }, { deadline: Date.now() + 120_000, perBuild: 1 });
  if (process.argv.includes("--facts-out")) (await import("node:fs")).writeFileSync("/tmp/l2-facts.json", JSON.stringify(job.facts));
  out({ ...Object.fromEntries(Object.entries(r).filter(([k]) => k !== "rows")), rows: r.rows.map(x => ({ headline: x.headline, deck: x.deck, body: x.body, how_we_know: x.how_we_know, checked: x.checked, attempts: x.attempts, model: x.model, cost: x.cost, log: x.log })) });
}
if (cmd === "package-fresh") {
  const { runPackageCheck } = await import("../src/lib/newsroom/publisher.server");
  out(await runPackageCheck(db as never, { test: true, fresh: true, week: process.argv[3]!, base: process.argv[4] ?? "https://slug.global" }));
}
if (cmd === "digest") {
  // The issue as it would publish from today's rows (the week has not closed, so the text shown is the code's fallback; the writer
  // writes the argument on Monday from the same parts).
  const { editionRows } = await import("../src/lib/digest/digest.server");
  const { editionParts } = await import("../src/lib/digest/edition");
  const w = process.argv[3]!, rows = await editionRows(w), p = rows ? editionParts(rows) : null;
  if (!p) { out({ week: w, issue: null }); process.exit(0); }
  const pic = (q: unknown) => { const x = q as { kind: string; plan?: { kind: string; items: { domain: string }[] } } | null; return !x ? null : x.kind === "lead" ? `lead ${x.plan!.kind}: ${x.plan!.items.map(i => i.domain).join(", ")}` : x.kind; };
  out({ week: w, number: p.base.number, cover: p.base.cover, fallback_headline: p.fallback.headline, chart: p.base.chart ? { caption: p.base.chart.caption, href: (p.base.chart as { href?: string }).href ?? null } : null,
    pictures_available: p.base.picturesAvailable ?? null, rows: p.base.rows.map(r => ({ ...Object.fromEntries(Object.entries(r).filter(([k]) => ["number", "subject", "kind", "headline", "href"].includes(k))), picture: pic((r as { picture?: unknown }).picture ?? null) })) });
}
if (cmd === "dating") {
  const { storyById } = await import("../src/lib/stories/read.server");
  const { storyDating, loadStoryLead } = await import("../src/lib/stories/page.server");
  for (const n of process.argv.slice(3).map(Number)) {
    const { data } = await db.from("story_numbers").select("story_id").eq("number", n).single();
    const s = await storyById(data!.story_id); if (!s) continue;
    const d = await storyDating(s), l = await loadStoryLead(s.id) as { facts: { text: string; asOf?: string }[]; numbersUpdate: string | null } | null;
    out({ number: n, id: s.id, as_of_iso: d.asOf, lines: l?.facts.map(f => `${f.text}${f.asOf ? ` · ${f.asOf}` : ""}`), update: l?.numbersUpdate ?? null });
  }
}
