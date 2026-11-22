// N4 · the proof. Reads and writes go through the door's own code (handleDesk / doorCall) with the editor key check replaced by a stub,
// because the sandbox has no editor key; everything after the key is the live path.
//   bun scripts/n4-proof.ts send <rows.jsonl>       — send one review run's rows as `review` calls (the HTTP body path, pictures included)
//   bun scripts/n4-proof.ts show <run> [<run>]       — the stored rows, the differences, and the budgets/breaches/queue items they made
//   bun scripts/n4-proof.ts health                   — the engineering desk's health run on live data (files and declines bug items)
//   bun scripts/n4-proof.ts design <run> <previous>  — the design review vision call as fixture calls on front, story and brand; filed as tests
import { readFileSync, writeFileSync } from "node:fs";
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { handleDesk, prodDeps } = await import("../src/lib/stories/desk.server");
const [cmd, ...args] = process.argv.slice(2);
const deps = { ...(await prodDeps()), authorize: async () => true, allow: () => true };

if (cmd === "send") {
  const lines = readFileSync(args[0]!, "utf8").trim().split("\n").map(l => JSON.parse(l) as Record<string, unknown>);
  const out: unknown[] = [];
  for (const row of lines) {
    const body = JSON.stringify({ actor: "design review", action: "review", ...row });
    const res = await handleDesk(new Request("http://localhost/api/public/desk", { method: "POST", headers: { "content-type": "application/json", "content-length": String(body.length) }, body }), deps);
    const j = await res.json() as Record<string, unknown>;
    out.push({ page: row["page"], width: row["width"], status: res.status, bytes: body.length, ...j });
    console.log(row["page"], row["width"], res.status, JSON.stringify(j));
  }
  writeFileSync(`/tmp/browser/n4/sent-${String(lines[0]?.["run"])}.json`, JSON.stringify(out, null, 1));
}
if (cmd === "show") {
  const dr = await import("../src/lib/newsroom/design-review");
  const { data } = await db.from("page_reviews").select("id,run,kind,page,width,against,measures,picture_path,picture_bytes,picture_width,picture_height").in("run", args).order("id");
  console.log(JSON.stringify((data ?? []).map(r => ({ id: r.id, run: r.run, kind: r.kind, page: r.page, width: r.width, against: r.against, measured: Object.keys(r.measures as object).length, picture: r.picture_path ? `${r.picture_width}×${r.picture_height} ${Math.round((r.picture_bytes ?? 0) / 1024)} KB` : null }))));
  const { loadReviews } = await import("../src/lib/newsroom/design-review.server");
  const rows = await loadReviews(db, { days: 30 });
  const a = rows.filter(r => r.run === args[0]), b = rows.filter(r => r.run === args[1]);
  console.log("runs", JSON.stringify(dr.runsOf(rows).filter(r => args.includes(r.run))));
  if (b.length) console.log("diff", JSON.stringify(dr.runDiff(a, b)));
  console.log("weekly budgets and breaches (test runs never count)", JSON.stringify(dr.weeklyBreaches(rows)));
  const { count } = await db.from("build_queue").select("id", { count: "exact", head: true }).ilike("ikey", "breach:%");
  console.log("queue items with a breach key", count);
}
if (cmd === "health") {
  const { runHealth } = await import("../src/lib/newsroom/engineering.server");
  const r = await runHealth(db as never, { write: true, force: true });
  console.log(JSON.stringify(r, null, 1));
}
if (cmd === "design") {
  const { runDesignReview } = await import("../src/lib/newsroom/design-review.server");
  const r = await runDesignReview(db as never, { fixture: true, run: args[0]!, previous: args[1]!, pages: ["front", "story", "brand"] });
  writeFileSync("/tmp/browser/n4/design.json", JSON.stringify(r, null, 1));
  const { deskPromptHash } = await import("../src/lib/newsroom/golden/versions");
  writeFileSync("newsroom/scores/design-review-v1.json", JSON.stringify({ desk: "design review", version: "v1", prompt_hash: deskPromptHash("design review"), run_at: new Date().toISOString(), cases: r.pages.length, run: r.run, against: args[1],
    items: [], pages: r.pages.map(p => ({ page: p.page, called: p.called, call_id: p.call_id, observations: p.observations, why: p.why })),
    kept: r.kept.map(k => ({ type: k.type, page: k.page, ...(k.type === "setting" ? { setting: k.setting, from: k.from, to: k.to } : { needs_owner: true }), text: k.text })), dropped: r.dropped.map(d => ({ page: d.page, move: d.obs.move, why: d.why })),
    filed: r.filed, note: "Baseline (N4 proof): fixture calls on the second test review run; filed as tests (test_mark rows and test queue items), so none is a real proposal." }, null, 1) + "\n");
  console.log(JSON.stringify(r, null, 1));
}
process.exit(0);
