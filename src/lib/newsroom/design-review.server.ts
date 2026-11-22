// N4 · the design review desk's I/O: the `review` store behind the door (one appended row per page and width; the picture goes to the
// crops bucket under reviews/, never mixed with brand crops and never served), the runs' reads, and the weekly pass: breaches first
// (code), then one vision call per page (limit nine a day), then the moves code keeps, filed with `propose` and a queue item through the
// door. Nothing here changes a live page. Service role only.
import type { Admin } from "./review.server";
import * as dr from "./design-review";
import type { LivingValues } from "../living/settings";

const dayStart = (now: number) => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
const hex = (u: ArrayBuffer) => [...new Uint8Array(u)].map(b => b.toString(16).padStart(2, "0")).join("");
type Row = { id: number; at: string; run: string; kind: string; page: string; path: string; width: number; against: string | null; measures: unknown; picture_path: string | null };
const toRow = (r: Row): dr.ReviewRow => ({ id: r.id, at: r.at, run: r.run, kind: r.kind as dr.ReviewKind, page: r.page as dr.ReviewPageId, path: r.path, width: r.width, against: r.against, measures: (r.measures ?? {}) as dr.Measures, picture: r.picture_path });

/** The door's store for `review`: one run has one kind; a picture must pass the crops' size rule. */
export async function insertReview(db: Admin, r: { run: string; kind: dr.ReviewKind; page: dr.ReviewPageId; path: string; width: number; against: string | null; measures: dr.Measures; picture: string | null; actor: string }): Promise<{ id: number; picture: string | null } | { refused: string }> {
  const { data: had, error: e1 } = await db.from("page_reviews").select("kind").eq("run", r.run).limit(1);
  if (e1) throw new Error("reviews_read_failed");
  if (had?.[0] && had[0].kind !== r.kind) return { refused: `Run “${r.run}” is a ${had[0].kind} run; one run has one kind.` };
  let pic: { path: string; bytes: number; width: number; height: number } | null = null;
  if (r.picture) {
    let bytes: Uint8Array;
    try { bytes = (await import("../thumbs")).decodeB64(r.picture); } catch { return { refused: "The picture is not base64." }; }
    const c = dr.checkReviewPicture(bytes);
    if (!c.ok) return { refused: c.reason };
    const { CROP_BUCKET } = await import("../crops-ingest.server");
    const path = dr.reviewPicturePath(r.run, r.page, r.width, hex(await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer)).slice(0, 8));
    const up = await db.storage.from(CROP_BUCKET).upload(path, bytes, { contentType: "image/webp", upsert: true });
    if (up.error) throw new Error("review_picture_upload_failed");
    pic = { path, bytes: c.bytes, width: c.width, height: c.height };
  }
  const { data, error } = await db.from("page_reviews").insert({ run: r.run, kind: r.kind, page: r.page, path: r.path, width: r.width, against: r.against, measures: r.measures as never, actor: r.actor,
    picture_path: pic?.path ?? null, picture_bytes: pic?.bytes ?? null, picture_width: pic?.width ?? null, picture_height: pic?.height ?? null }).select("id").single();
  if (error || !data) throw new Error("review_insert_failed");
  return { id: data.id, picture: pic?.path ?? null };
}
/** Review rows of the last `days` days (or of the named runs), oldest first. */
export async function loadReviews(db: Admin, o: { days?: number; runs?: string[] } = {}): Promise<dr.ReviewRow[]> {
  const out: dr.ReviewRow[] = [];
  for (let f = 0; f < 20000; f += 1000) {
    let q = db.from("page_reviews").select("id,at,run,kind,page,path,width,against,measures,picture_path").order("id").range(f, f + 999);
    q = o.runs ? q.in("run", o.runs) : q.gte("at", new Date(Date.now() - (o.days ?? 120) * 864e5).toISOString());
    const { data, error } = await q;
    if (error) throw new Error("reviews_read_failed");
    out.push(...((data ?? []) as Row[]).map(toRow));
    if (!data || data.length < 1000) break;
  }
  return out;
}
async function pictureUrl(db: Admin, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { CROP_BUCKET } = await import("../crops-ingest.server");
  const f = await db.storage.from(CROP_BUCKET).download(path);
  if (f.error || !f.data) return null;
  const u = new Uint8Array(await f.data.arrayBuffer()); let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return `data:image/webp;base64,${btoa(s)}`;
}

export type PageResult = { page: dr.ReviewPageId; called: boolean; call_id: number | null; observations: dr.Observation[] | null; why: string };
export type Filed = { type: "setting" | "layout"; page: string; tied: boolean; text: string; proposal_log: number | null; item: number | null; status: number };
export type DesignRun = { run: string | null; why: string; calls: number; pages: PageResult[]; breaches: dr.Breach[]; bugItems: number[]; declined: number[]; kept: dr.KeptMove[]; dropped: dr.DroppedMove[]; filed: Filed[]; over: string[]; errors: string[] };
const refOf = (run: string, page: string) => `review:${run}:${page}`.slice(0, 200);

/**
 * The weekly pass, once per complete weekly run: breaches first, then one vision call per page while the day's limit and the time allow
 * (a later hourly job picks up the pages left), then, when every page has its answer, the moves are enforced in code and filed. `fixture`
 * runs the named pages of any run (a test run in the proof) with fixture calls that do not count against the limit, and files what
 * survives as tests. Never throws.
 */
export async function runDesignReview(db: Admin, o: { deadline?: number; fixture?: boolean; run?: string; previous?: string; pages?: dr.ReviewPageId[]; live?: LivingValues; now?: number } = {}): Promise<DesignRun> {
  const now = o.now ?? Date.now(), out: DesignRun = { run: null, why: "", calls: 0, pages: [], breaches: [], bugItems: [], declined: [], kept: [], dropped: [], filed: [], over: [], errors: [] };
  try {
    const [{ deskDoor }, { LIVE_VALUES }, { capOf }, { currentDeskVersion }, vision] = await Promise.all([import("../stories/desk.server"), import("../living/editions"), import("./caps"), import("./golden/versions"), import("./vision.server")]);
    const live = o.live ?? LIVE_VALUES, test = !!o.fixture;
    const rows = await loadReviews(db);
    let run: string, prev: string | null;
    if (o.fixture) { if (!o.run) { out.why = "a fixture names its run"; return out; } run = o.run; prev = o.previous ?? null; }
    else {
      const w = dr.weeklyRuns(rows);
      if (!w.newest) { out.why = "no complete weekly review run yet"; return out; }
      run = w.newest.run; prev = w.previous?.run ?? null;
      const { count } = await db.from("desk_log").select("id", { count: "exact", head: true }).eq("actor", "design review").eq("action", "data_run").eq("subject_id", `design review:${run}`);
      if ((count ?? 0) > 0) { out.run = run; out.why = "already reviewed"; return out; }
    }
    out.run = run;
    const runRows = rows.filter(r => r.run === run), prevRows = prev ? rows.filter(r => r.run === prev) : [];
    if (!runRows.length) { out.why = `no rows for run ${run}`; return out; }
    // 1 · breaches first (code). A test run never counts: no budget, no breach, no queue item.
    if (!test && runRows[0]!.kind === "weekly") {
      out.breaches = dr.weeklyBreaches(rows).breaches;
      for (const b of out.breaches.filter(x => x.bug)) {
        const r = await deskDoor("design review", { action: "queue_add", title: `${dr.pageName(b.page)} at ${b.width} px: ${dr.MEASURES[b.measure].what} over budget`.slice(0, 140), why: dr.breachLine(b).slice(0, 600), kind: "bug", expects: "no visible change", source: { kind: "breach", ref: dr.breachKey(b) }, key: dr.breachKey(b) });
        const id = (r.body as { item?: number }).item; if (r.status < 300 && id) out.bugItems.push(id); else if (r.status >= 300) out.errors.push(`breach ${dr.breachKey(b)}: ${r.status}`);
      }
      // A breach item whose breach is gone this week is declined "no longer found".
      const { loadQueueItems } = await import("./engineering.server");
      const keys = new Set(out.breaches.filter(x => x.bug).map(dr.breachKey));
      for (const it of (await loadQueueItems(db)).filter(i => i.desk === "design review" && !i.test && i.ikey?.startsWith("breach:") && i.open && !keys.has(i.ikey))) {
        const r = await deskDoor("engineering", { action: "queue_move", item: it.id, to: "declined", reason: "no longer found" }); if (r.status < 300) out.declined.push(it.id);
      }
    }
    // 2 · one vision call per page (the page's three pictures, its measures with last week's, the register).
    const pages = o.pages ?? dr.REVIEW_PAGE_IDS;
    const cellsNow = dr.cellsOf(runRows), cellsPrev = dr.cellsOf(prevRows);
    const { count: used } = o.fixture ? { count: 0 } : await db.from("desk_calls").select("id", { count: "exact", head: true }).eq("desk", "design review").eq("purpose", "review").gte("at", dayStart(now));
    let left = o.fixture ? pages.length : Math.max(0, capOf("design review", "review") - (used ?? 0));
    for (const page of pages) {
      const ref = refOf(run, page);
      if (!o.fixture) {
        const { data: had } = await db.from("desk_calls").select("id,answer,ok").eq("desk", "design review").eq("purpose", "review").contains("story_ids", [ref]).order("id", { ascending: false }).limit(1);
        const h = had?.[0];
        if (h?.ok) { out.pages.push({ page, called: false, call_id: h.id, observations: dr.parseDesign(h.answer), why: "answered earlier" }); continue; }
      }
      if (left <= 0) { out.pages.push({ page, called: false, call_id: null, observations: null, why: "the day's limit of page reviews is used" }); continue; }
      if (o.deadline && o.deadline - Date.now() < 25_000) { out.pages.push({ page, called: false, call_id: null, observations: null, why: "not enough time left in this job" }); continue; }
      const widths = dr.REVIEW_WIDTHS.map(w => ({ width: w, now: cellsNow.get(`${page}@${w}`)?.measures ?? {}, last: cellsPrev.get(`${page}@${w}`)?.measures ?? null }));
      const images = (await Promise.all(dr.REVIEW_WIDTHS.map(async w => { const u = await pictureUrl(db, cellsNow.get(`${page}@${w}`)?.picture ?? null).catch(() => null); return u ? { label: `width ${w}`, url: u } : null; }))).filter((x): x is { label: string; url: string } => !!x);
      if (images.length < dr.REVIEW_WIDTHS.length) { out.pages.push({ page, called: false, call_id: null, observations: null, why: `only ${images.length} of ${dr.REVIEW_WIDTHS.length} pictures could be read` }); continue; }
      left--;
      const input: dr.DesignInput = { page, path: cellsNow.get(`${page}@1440`)?.path ?? "", widths, register: dr.registerFor(live) };
      const c = await vision.visionCall(db, { desk: "design review", purpose: o.fixture ? "fixture" : "review", system: dr.DESIGN_SYSTEM, tool: dr.DESIGN_TOOL, text: dr.designText(input), images, parse: dr.parseDesign, storyIds: [ref], promptVersion: currentDeskVersion("design review")?.version ?? null, maxTokens: 1500, estimate: { input: 6000, output: 900 }, signal: AbortSignal.timeout(45_000) });
      if (c) out.calls++;
      out.pages.push({ page, called: !!c, call_id: c?.call_id ?? null, observations: c?.parsed ?? null, why: !c ? "the call was not made" : c.parsed ? "answered" : "the answer was not the fixed structure" });
    }
    const waiting = out.pages.filter(p => p.observations === null && p.why !== "the answer was not the fixed structure" && p.why !== "the call was not made" && !p.why.startsWith("only "));
    if (waiting.length && !o.fixture) { out.why = `${waiting.length} pages wait for the next job`; return out; }
    // 3 · the moves, enforced in code; at most five proposals a week, the ones tied to a breach first.
    const breached = new Set(out.breaches.map(b => `${b.page}:${b.measure}`));
    for (const p of out.pages) if (p.observations) { const e = dr.enforceMoves(p.page, p.observations, { live, breached }); out.kept.push(...e.kept); out.dropped.push(...e.dropped); }
    type Cand = { type: "setting" | "layout"; page: dr.ReviewPageId; tied: boolean; text: string; kept?: dr.KeptMove; breach?: dr.Breach };
    const cands: Cand[] = [...out.breaches.filter(b => !b.bug).map(b => ({ ...dr.breachProposal(b) })), ...out.kept.map(k => ({ type: k.type, page: k.page, tied: k.tied, text: dr.moveText(k), kept: k }))];
    let usedWeek = 0;
    if (!test) { const { count } = await db.from("desk_log").select("id", { count: "exact", head: true }).eq("actor", "design review").eq("action", "propose").eq("decision", "proposed").gte("at", new Date(now - 7 * 864e5).toISOString()); usedWeek = count ?? 0; }
    const ranked = dr.rankMoves(cands, usedWeek);
    out.over = ranked.over.map(c => c.text);
    const { insertLog } = await import("./newsroom.server");
    for (const [i, c] of ranked.file.entries()) {
      const r = await deskDoor("design review", { action: "propose", kind: c.type === "setting" ? "design_edition" : "layout", subject: `${c.page}${c.kept?.type === "setting" ? `:${c.kept.setting}` : ""}`, text: c.text });
      const log = (r.body as { log?: number }).log ?? null;
      if (test && log) await insertLog(db, { actor: "design review", action: "test_mark", level: "ships alone", subject_kind: "none", subject_id: `log:${log}`, decision: "done", reason: `Desk log row ${log} is a design review fixture filed as a test (N4 proof), not a real proposal. Marked, not edited.` });
      let item: number | null = null;
      if (log) {
        const k = c.kept;
        const q = await deskDoor("design review", { action: "queue_add", title: `${dr.pageName(c.page)}: ${k?.type === "setting" ? `${(await import("../living/settings")).SETTINGS[k.setting].name} move` : c.breach ? `${dr.MEASURES[c.breach.measure].what} over budget` : "layout move"}`.slice(0, 140),
          why: c.text.slice(0, 600), kind: c.type === "setting" ? "design move" : "layout", expects: c.type === "setting" ? "small" : "layout", source: { kind: "proposal", log }, key: `design:${run}:${c.page}:${i + 1}`.slice(0, 200),
          ...(k?.type === "setting" ? { move: { setting: k.setting, from: k.from, to: k.to } } : {}), ...(test ? { test: true } : {}) });
        item = (q.body as { item?: number }).item ?? null;
      }
      out.filed.push({ type: c.type, page: c.page, tied: c.tied, text: c.text, proposal_log: log, item, status: r.status });
    }
    out.why = `${out.pages.filter(p => p.observations).length} pages answered, ${out.kept.length} moves kept, ${out.dropped.length} dropped, ${out.filed.length} filed${out.over.length ? `, ${out.over.length} over the weekly five` : ""}`;
    await deskDoor("design review", { action: "data_run", run: "design review", ref: `design review:${run}`, summary: `Design review of run ${run}${test ? " (test)" : ""}: ${out.why}.`.slice(0, 600), counts: { calls: out.calls, kept: out.kept.length, dropped: out.dropped.length, filed: out.filed.length, breaches: out.breaches.length } });
  } catch (e) { out.errors.push(e instanceof Error ? e.message.slice(0, 160) : "error"); }
  return out;
}
