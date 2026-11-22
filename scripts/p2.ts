// P2 proof: `bun scripts/p2.ts sweep` — every story built from forecast run 16 against the like-with-like rule (read only).
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
process.exit(0);
