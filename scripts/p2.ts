// P2 proof: `bun scripts/p2.ts sweep` — every story built from forecast run 16 against the like-with-like rule (read only).
// P2b (read only): `crossovers` sweeps every crossover story ever built against the "new to the sector" rule; `crossover-fixture` writes the
// two held media stories' stored quarters for the tests; `quarters-cost` measures the crossover rule's extra read; `gate-fixture` writes
// gate results 1 to 5's stored inputs.
const cmd = process.argv[2];
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const out = (x: unknown) => console.log(JSON.stringify(x, null, 1));
if (cmd === "sweep") {
  const { forecastRunRows } = await import("../src/lib/forecast-rows.server");
  const { readComparable, homepagesRead } = await import("../src/lib/stories/candidates");
  const { data } = await db.from("stories").select("id,type,status,headline,source_ids,sector,signal_keys").contains("source_ids", ["run:16"]).order("id");
  const rows = new Map<number, Map<string, unknown>>();
  const rowsOf = async (id: number) => { if (!rows.has(id)) rows.set(id, new Map((await forecastRunRows(id)).map(r => [`${r.dimension}:${r.value}|${r.scope}`, r]))); return rows.get(id)!; };
  const list = [];
  for (const s of data ?? []) {
    const runs = (s.source_ids as string[]).filter(x => x.startsWith("run:")).map(x => Number(x.slice(4))).sort((a, b) => a - b);
    let verdict = "not covered by the rule (not a stage change or crossover)", detail = "";
    if ((s.type === "crossover" || s.type === "shift") && runs.length >= 2) {
      const [a, b] = [await rowsOf(runs[0]!), await rowsOf(runs.at(-1)!)], scope = s.type === "crossover" ? s.sector ?? "all" : "all";
      const keys = (s.signal_keys as string[]);
      const res = keys.map(k => { const ea = a.get(`${k}|${scope}`) as never, la = b.get(`${k}|${scope}`) as never; return { k, ok: readComparable(ea, la), earlier: homepagesRead(ea), later: homepagesRead(la) }; });
      verdict = res.every(r => r.ok) ? "would still be built" : "would NOT be built: more homepages read, not a change";
      detail = res.map(r => `${r.k} ${scope}: ${r.earlier ?? "?"} read in run ${runs[0]} vs ${r.later ?? "?"} in run ${runs.at(-1)}`).join("; ");
    }
    list.push({ id: s.id, type: s.type, status: s.status, headline: s.headline, verdict, detail });
  }
  out({ count: list.length, stories: list });
}
if (cmd === "fixture") {
  // The stored page reviews of 22 Nov (no pictures, only the measures the gate reads) and gate results 1 to 4's inputs.
  const { loadReviews } = await import("../src/lib/newsroom/design-review.server");
  const keep = ["first_byte_ms", "lcp_ms", "cls", "changed_share", "height_px", "overflow_x", "console_errors", "failed_requests", "small_targets", "low_contrast"];
  const rows = (await loadReviews(db as never, { days: 3 })).filter(r => r.kind !== "test").map(r => ({ id: r.id, at: r.at, run: r.run, kind: r.kind, page: r.page, path: r.path, width: r.width, against: r.against, measures: Object.fromEntries(Object.entries(r.measures).filter(([k]) => keep.includes(k))) }));
  const { data: gates } = await db.from("gate_results").select("id,item_id,commit_sha,tests,before_run,after_run,pass").order("id");
  const { data: items } = await db.from("build_queue").select("id,kind,expects").in("id", (gates ?? []).map(g => g.item_id));
  const { writeFileSync } = await import("node:fs");
  writeFileSync("src/lib/newsroom/fixtures/reviews-2026-11-22.json", JSON.stringify({ note: "Stored page reviews of 22 Nov 2026 (test runs left out; pictures and unread measures dropped) and gate results 1 to 4 with their items.", gates: (gates ?? []).map(g => ({ ...g, item: items?.find(i => i.id === g.item_id) })), rows }));
  out({ rows: rows.length, gates: gates?.length });
}
if (cmd === "crossovers") {
  const { sectorHistory, quarterName } = await import("../src/lib/stories/candidates");
  const { applyEdits } = await import("../src/lib/stories/edits");
  const { data: rows } = await db.from("stories").select("id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at").eq("type", "crossover").order("created_at").order("id");
  const ids = (rows ?? []).map(r => r.id);
  const { data: edits } = await db.from("story_edits").select("id,story_id,action,payload,note,at").in("story_id", ids).order("id");
  const { data: nums } = await db.from("story_numbers").select("story_id,number").in("story_id", ids);
  const num = new Map((nums ?? []).map(n => [n.story_id, n.number]));
  const list = [];
  for (const r of rows ?? []) {
    const m = /^crossover:([^:]+):(.+):([^:]+):(\d+)$/.exec(r.id)!, [dim, value, scope, run] = [m[1]!, m[2]!, m[3]!, Number(m[4])];
    const { data: f } = await db.from("forecasts").select("quarters:evidence->quarters").eq("run_id", run).eq("dimension", dim).eq("value", value).eq("scope", scope).maybeSingle();
    const h = sectorHistory((f as { quarters?: unknown } | null)?.quarters);
    const state = applyEdits(r as never, (edits ?? []).filter(e => e.story_id === r.id) as never, Date.now()).state;
    list.push({ id: r.id, number: num.get(r.id) ?? null, status: state, verdict: h.ok ? "would still be built" : `refused: ${h.reason}`,
      quarter: h.ok ? `up from ${(h.earlier.s * 100).toFixed(1)}% of ${h.earlier.n} in ${quarterName(h.earlier.q)}` : h.quarter ? `${quarterName(h.quarter.q)}: ${(h.quarter.s * 100).toFixed(1)}% of ${h.quarter.n} read` : "no quarter with 15 read" });
  }
  out({ count: list.length, refused: list.filter(l => l.verdict.startsWith("refused")).length, stories: list });
}
if (cmd === "crossover-fixture") {
  const want = [["hero_layout", "split_left_text"], ["tone", "calm"]];
  const rows = [];
  for (const run of [13, 16]) for (const [d, v] of want) {
    const { data } = await db.from("forecasts").select("run_id,dimension,value,scope,status,stage,momentum,current_share,next_wave_score,sample:evidence->quarters->-1,quarters:evidence->quarters").eq("run_id", run).eq("dimension", d!).eq("value", v!).in("scope", ["all", "media"]);
    rows.push(...(data ?? []));
  }
  const { writeFileSync } = await import("node:fs");
  writeFileSync("src/lib/stories/fixtures/crossovers-media-13-16.json", JSON.stringify({ note: "Stored forecast rows (library-wide and media) of runs 13 and 16 for split, text left and calm voice: the two held media crossovers of 22 Nov.", rows }, null, 1));
  out({ rows: rows.length });
}
if (cmd === "quarters-cost") {
  const { forecastRunRows, forecastRowQuarters } = await import("../src/lib/forecast-rows.server");
  const { context, crossoverQuarterNeeds } = await import("../src/lib/stories/candidates");
  const runs = [];
  for (const [id, at] of [[13, "2026-11-15T15:33:42Z"], [16, "2026-11-22T09:30:41Z"]] as const) runs.push({ id, at, rows: (await forecastRunRows(id)).map(x => ({ ...x })) });
  const needs = crossoverQuarterNeeds(context({ now: "2026-11-22T12:00:00Z", runs, events: [], rebrands: [], alerts: [], wire: [], launches: [], sites: [], archive: [], trendsetters: [] }));
  let t = performance.now(); const got = await forecastRowQuarters(16, needs); const ms = performance.now() - t;
  const bytes = JSON.stringify([...got.values()]).length;
  t = performance.now(); const { data: whole } = await db.from("forecasts").select("quarters:evidence->quarters").eq("run_id", 16).range(0, 1999); const wholeMs = performance.now() - t;
  t = performance.now(); const { data: last } = await db.from("forecasts").select("sample:evidence->quarters->-1").eq("run_id", 16).range(0, 1999); const lastMs = performance.now() - t;
  out({ run_rows: runs[1]!.rows.length, rows_needing_quarters: needs.length, extra_read: { rows: got.size, json_bytes: bytes, ms: Math.round(ms) }, if_every_row_carried_quarters: { json_bytes: JSON.stringify(whole).length, ms: Math.round(wholeMs) }, latest_quarter_only: { json_bytes: JSON.stringify(last).length, ms: Math.round(lastMs) } });
}
if (cmd === "gate-fixture") {
  const { loadReviews } = await import("../src/lib/newsroom/design-review.server");
  const keep = ["first_byte_ms", "lcp_ms", "cls", "changed_share", "height_px", "overflow_x", "console_errors", "failed_requests", "small_targets", "low_contrast"];
  const rows = (await loadReviews(db as never, { days: 4 })).filter(r => r.kind !== "test").map(r => ({ id: r.id, at: r.at, run: r.run, kind: r.kind, page: r.page, path: r.path, width: r.width, against: r.against, measures: Object.fromEntries(Object.entries(r.measures).filter(([k]) => keep.includes(k))) }));
  const { data: gates } = await db.from("gate_results").select("id,item_id,commit_sha,tests,before_run,after_run,pass").lte("id", 5).order("id");
  const { data: items } = await db.from("build_queue").select("id,kind,expects").in("id", (gates ?? []).map(g => g.item_id));
  const { writeFileSync } = await import("node:fs");
  writeFileSync("src/lib/newsroom/fixtures/reviews-2026-11-22b.json", JSON.stringify({ note: "Stored page reviews of 22 Nov 2026 up to run p2-after (test runs left out; pictures and unread measures dropped) and gate results 1 to 5 with their items.", gates: (gates ?? []).map(g => ({ ...g, item: items?.find(i => i.id === g.item_id) })), rows }));
  out({ rows: rows.length, gates: gates?.length, runs: [...new Set(rows.map(r => r.run))] });
}
process.exit(0);
