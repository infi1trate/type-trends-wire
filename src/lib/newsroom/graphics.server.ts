// N3 · the graphics desk's I/O: the rule's picture and its alternates for one story, the stored images read in memory for one vision
// call (the AI reads' model, recorded in desk_calls and ai_usage; images are never stored or logged), the choice through the door's
// store, the study chart-form choices, and the share-image check. Service role only; every desk decision goes through the door.
import type { Admin } from "./review.server";
import { alternates, chosenRefs, decidePicture, isSetStory, graphicsText, parseGraphics, GRAPHICS_SYSTEM, GRAPHICS_TOOL, type GraphicsInput, type PictureDecision, type PictureRef } from "./graphics";
import { DESK_CAPS, capOf } from "./caps";
import { currentDeskVersion } from "./golden/versions";

const dayStart = (now: number) => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };

/** The rule's own plan for one story (before any desk choice), as the story page computes it. */
export async function ruleLead(id: string) {
  const [{ storyById }, ps, { isKind, storyPage }] = await Promise.all([import("../stories/read.server"), import("../stories/page.server"), import("../stories/view")]);
  const s = await storyById(id);
  if (!s) return null;
  const type = isKind(s.type) ? s.type : "news", page = storyPage(s, { earlier: [], patterns: [] });
  const [crops, colourEvents] = await Promise.all([ps.evidenceOf(s, type), ps.colourEventsOf(s).catch(() => [])]);
  const plan = await ps.leadOf(s, crops, { colourEvents, census: page.census?.lines ?? null, names: new Map(page.brands.map(b => [b.domain, b.name])), rule: true });
  return { s, plan };
}
/** The rule's pictures and up to three alternates (stored crops of the story's brands that pass the quality gate). */
export async function pictureInput(id: string): Promise<{ g: GraphicsInput; plan: import("../lead-picture").LeadPlan } | null> {
  const r = await ruleLead(id);
  if (!r) return null;
  const [{ cropsFor }, { toCrop }, { leadPics }] = await Promise.all([import("../read.server"), import("../crops"), import("../lead-picture.server")]);
  const [rows, pics] = await Promise.all([cropsFor(r.s.domains).catch(() => []), leadPics()]);
  const alt = alternates(r.plan, rows.map(toCrop), { ok: pics.okCrop, domains: r.s.domains, happened_at: r.s.happened_at });
  return { plan: r.plan, g: { story: { id, headline: r.s.headline, deck: r.s.deck ?? null, caption: r.plan.caption }, chosen: chosenRefs(r.plan), alternates: alt.refs, set: isSetStory(id) } };
}

/** A stored picture's bytes, read in memory only (crops and assets from the crops bucket, fold thumbnails from the thumbnails bucket). */
async function bytesOf(db: Admin, src: string): Promise<Uint8Array | null> {
  const [{ CROP_BUCKET }, { BUCKET }] = await Promise.all([import("../crops-ingest.server"), import("../thumbs-ingest.server")]);
  const m = /^\/(crops|thumbs)\/(.+)$/.exec(src.split("?")[0] ?? "");
  if (!m) return null;
  const f = await db.storage.from(m[1] === "thumbs" ? BUCKET : CROP_BUCKET).download(decodeURIComponent(m[2]!));
  return f.error || !f.data ? null : new Uint8Array(await f.data.arrayBuffer());
}
const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const mime = (u: Uint8Array) => (u[0] === 0x89 && u[1] === 0x50 ? "image/png" : u[0] === 0xff && u[1] === 0xd8 ? "image/jpeg" : "image/webp");

/** One vision call on the AI reads' model under the cost ledger (`desk_vision`), recorded in desk_calls (shared with the design review
 *  desk through vision.server.ts). Null when no call was made. */
export async function visionDeskCall(db: Admin, purpose: "picture" | "fixture", g: GraphicsInput, images: { ref: string; url: string }[], signal: AbortSignal) {
  const { visionCall } = await import("./vision.server");
  const c = await visionCall(db, { desk: "graphics", purpose, system: GRAPHICS_SYSTEM, tool: GRAPHICS_TOOL, text: graphicsText(g), images: images.map(i => ({ label: `ref ${i.ref}`, url: i.url })),
    parse: raw => parseGraphics(raw, [...g.chosen, ...g.alternates].map(x => x.ref)), storyIds: [g.story.id], promptVersion: currentDeskVersion("graphics")?.version ?? null, maxTokens: 1200, estimate: { input: 9000, output: 800 }, signal });
  return c ? { parsed: c.parsed, call_id: c.call_id, cost: c.cost } : null;
}

export type PictureRun = { decision: PictureDecision; call_id: number | null; called: boolean; plan: import("../lead-picture").LeadPlan | null; refs: PictureRef[] };
/**
 * The picture check for one story: nothing to check (no picture items and no alternates) keeps the rule; otherwise one vision call when the
 * limit allows, else the rule's picture stands with the reason. `fixture` calls do not count against the limit. Never throws.
 */
export async function pictureCheck(db: Admin, id: string, o: { now?: number; fixture?: boolean; signal?: AbortSignal; inject?: { g: GraphicsInput; plan: import("../lead-picture").LeadPlan } } = {}): Promise<PictureRun> {
  const now = o.now ?? Date.now();
  try {
    const pi = o.inject ?? (await pictureInput(id));
    if (!pi) return { decision: decidePicture(null, { chosen: [], alternates: [] }, "the story could not be read"), call_id: null, called: false, plan: null, refs: [] };
    const refs = [...pi.g.chosen, ...pi.g.alternates];
    if (!refs.length) return { decision: { ...decidePicture(null, pi.g, "the rule chose no picture of a page, so there is nothing to look at"), verdict: "fallback" }, call_id: null, called: false, plan: pi.plan, refs };
    if (!o.fixture) {
      const { count } = await db.from("desk_calls").select("id", { count: "exact", head: true }).eq("desk", "graphics").eq("purpose", "picture").gte("at", dayStart(now));
      if ((count ?? 0) >= capOf("graphics", "picture")) return { decision: decidePicture(null, pi.g, `the graphics desk's limit of ${DESK_CAPS.graphics} picture checks today is used`), call_id: null, called: false, plan: pi.plan, refs };
    }
    const images = (await Promise.all(refs.map(async r => { const b = await bytesOf(db, r.src).catch(() => null); return b ? { ref: r.ref, url: `data:${mime(b)};base64,${b64(b)}` } : null; }))).filter((x): x is { ref: string; url: string } => !!x);
    if (!images.length) return { decision: decidePicture(null, pi.g, "no stored picture could be read"), call_id: null, called: false, plan: pi.plan, refs };
    const c = await visionDeskCall(db, o.fixture ? "fixture" : "picture", pi.g, images, o.signal ?? AbortSignal.timeout(30_000));
    if (!c) return { decision: decidePicture(null, pi.g, "the call was not made"), call_id: null, called: false, plan: pi.plan, refs };
    return { decision: decidePicture(c.parsed, pi.g, "the call failed"), call_id: c.call_id, called: true, plan: pi.plan, refs };
  } catch (e) {
    return { decision: decidePicture(null, { chosen: [], alternates: [] }, `the check failed (${e instanceof Error ? e.message.slice(0, 60) : "error"})`), call_id: null, called: false, plan: null, refs: [] };
  }
}

// THE DOOR'S STORE -------------------------------------------------------------------------------------------------------------------
/** Refuses a choice the rule would not allow: a crop that is not a stored crop of the story's brands passing the quality gate, or a pair
 *  that is not the rule's own pair (never mixed across dates). Null when the choice may be recorded. */
export async function checkChoice(r: { story_id: string; kind: string; assets: string[] }): Promise<string | null> {
  if (r.kind === "rule" || r.kind === "none") return r.assets.length ? "A rule or no-picture choice names no picture." : null;
  const lead = await ruleLead(r.story_id);
  if (!lead) return "No such story.";
  if (r.kind === "pair") return lead.plan.kind === "pair" && lead.plan.items.map(i => i.asset).join("|") === r.assets.join("|") ? null : "A pair can only be the rule's own before-and-after pair.";
  const many = lead.plan.kind === "mosaic" ? 4 : 1;
  if (!r.assets.length || r.assets.length > many || !r.assets.every(a => a.startsWith("crop:"))) return many > 1 ? "A crop choice for a mosaic names one to four stored crops." : "A crop choice names exactly one stored crop.";
  const [{ cropsFor }, { toCrop }, { leadPics }] = await Promise.all([import("../read.server"), import("../crops"), import("../lead-picture.server")]);
  const [rows, pics] = await Promise.all([cropsFor(lead.s.domains), leadPics()]);
  for (const a of r.assets) {
    const row = rows.find(x => x.path === a.slice(5));
    if (!row) return "Not a stored crop of this story's brands.";
    if (!pics.okCrop(toCrop(row))) return "That crop does not pass the quality gate.";
  }
  return null;
}
export async function insertChoice(db: Admin, r: { story_id: string; actor: string; kind: string; assets: string[]; verdict: string; reason: string; per_picture: unknown[]; call_id: number | null }) {
  const { data, error } = await db.from("picture_choices").insert({ story_id: r.story_id, actor: r.actor, kind: r.kind, assets: r.assets, verdict: r.verdict, reason: r.reason.slice(0, 600), per_picture: r.per_picture as never, call_id: r.call_id }).select("id").single();
  if (error || !data) throw new Error("picture_choice_insert_failed");
  return { id: data.id };
}

// STORED RECORDS ONLY (N4b) -------------------------------------------------------------------------------------------------------------
// The checks never build a study or an issue from raw history: a study or Digest issue without a current stored record fails the check
// for the day instead (computing one reads about 6 MB of capture history per study).
export const NO_RECORD = "no current stored record (the check never builds from raw history)";
type StoredStudy = Extract<import("../data-stories/page.server").DataStoryPage, { kind: "live" }>;
/** A live study's stored page, or why not. */
export async function storedStudy(slug: string): Promise<{ page: StoredStudy } | { error: string }> {
  const [{ readRecord }, { pageKey, usable }] = await Promise.all([import("../records/store.server"), import("../records/records")]);
  const r = await readRecord<import("../data-stories/page.server").DataStoryPage>(pageKey("data-story", slug));
  if (!r || !usable(r, Date.now())) return { error: NO_RECORD };
  if (r.body.kind !== "live") return { error: "not live" };
  if ((r.body.story as { v?: number }).v !== 4) return { error: NO_RECORD };
  return { page: r.body };
}
/** The live studies named by the stored Studies home (never computed). */
export async function storedLiveStudies(): Promise<string[] | null> {
  const [{ readRecord }, { pageKey, usable }] = await Promise.all([import("../records/store.server"), import("../records/records")]);
  const r = await readRecord<{ v?: number; home?: { lead?: { slug: string } | null; series: { studies: { slug: string }[] }[] } }>(pageKey("data-index"));
  if (!r || !usable(r, Date.now()) || r.body.v !== 4 || !r.body.home) return null;
  const h = r.body.home;
  return [...new Set([...(h.lead ? [h.lead.slug] : []), ...h.series.flatMap(x => x.studies.map(y => y.slug))])];
}
export const withTimeout = <T>(p: Promise<T>, ms: number, what: string): Promise<T> =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${what} took over ${ms / 1000} s`)), ms))]);

// STUDY CHART FORMS --------------------------------------------------------------------------------------------------------------------
export type ChartRun = { checked: number; calls: number; choices: { study: string; figure: string; form: string; basis: string; reason: string }[]; proposals: number; errors: string[] };
type ChartBudget = { left: number; allowCall: () => boolean; callMs: number; fixture: boolean; seen: Set<string> };
/** One study's figures from its stored record. `done` is false when a figure waits for a call this pass cannot fit (it resumes next pass). */
export async function chartStudy(db: Admin, slug: string, page: StoredStudy, b: ChartBudget, out: ChartRun): Promise<{ done: boolean; written: number }> {
  const g = await import("./graphics");
  let done = true, written = 0;
  const figs = Object.entries(page.story.figures) as [string, { kind: string; title: string; note: string; xs?: string[]; chart?: string; panels?: unknown[] }][];
  for (const [figure, f] of figs) {
    const shape = g.FIGURE_SHAPE[f.kind]; if (!shape) continue;
    const current = f.kind === "multiples" ? (f.chart ?? "line") : (g.SHAPE_FORMS[shape][0] as string);
    out.checked++;
    if (b.seen.has(`${slug}|${figure}|${shape}`)) continue;
    const fits = g.formsFor(f);
    let answer = null as { form: string; why: string; missing: string } | null, callId: number | null = null;
    if (fits.length > 1 && b.left > 0) {
      if (!b.allowCall()) { done = false; continue; } // no time for a call in this pass: the study resumes in the next one
      b.left--; out.calls++;
      const { deskCall } = await import("./review.server");
      const c = await deskCall(db, "graphics", b.fixture ? "fixture" : "chart", { system: g.CHART_SYSTEM, user: g.chartUser({ study: slug, title: f.title, note: f.note, kind: f.kind, xs: f.xs ?? [], panels: f.panels?.length ?? 0 }, fits), schema: g.CHART_SCHEMA as unknown as Record<string, unknown>, schemaName: "graphics_chart", tool: g.CHART_TOOL, maxTokens: 400 }, g.parseChart, [], AbortSignal.timeout(b.callMs), "graphics chart");
      answer = (c?.parsed as typeof answer) ?? null; callId = c?.call_id ?? null;
    } else if (fits.length > 1) continue; // the limit is used: the figure waits for tomorrow with its own form
    const d = g.decideChart(answer, f, current);
    out.choices.push({ study: slug, figure, form: d.form, basis: d.basis, reason: d.reason });
    b.seen.add(`${slug}|${figure}|${shape}`);
    if (!b.fixture) { const { error } = await db.from("chart_choices").insert({ study: slug, figure, shape, form: d.form, basis: d.basis, reason: d.reason.slice(0, 400), call_id: callId }); if (error) out.errors.push(`chart ${slug}: ${error.message.slice(0, 60)}`); else written++; }
    if (answer?.missing && !b.fixture && out.proposals < 2) {
      const { deskDoor } = await import("../stories/desk.server");
      const r = await deskDoor("graphics", { action: "propose", kind: "format", text: `A chart form the kit does not have, for “${f.title}” in ${slug}: ${answer.missing}. Filed by the graphics desk; nothing new is drawn until it is accepted.`.slice(0, 600), subject: slug });
      if (r.status < 300) out.proposals++;
    }
  }
  return { done, written };
}
/** The figures already chosen (study, figure, shape), and the chart calls left today. */
export async function chartBudget(db: Admin, slugs: string[], now: number, fixture = false) {
  const { data: had } = await db.from("chart_choices").select("study,figure,shape").in("study", slugs).order("id", { ascending: false }).limit(500);
  const { count } = await db.from("desk_calls").select("id", { count: "exact", head: true }).eq("desk", "graphics").eq("purpose", "chart").gte("at", dayStart(now));
  return { seen: new Set((had ?? []).map(x => `${x.study}|${x.figure}|${x.shape}`)), left: fixture ? 2 : Math.max(0, capOf("graphics", "chart") - (count ?? 0)) };
}
/**
 * Each live study's figures (stored records only): the table in graphics.ts says which forms fit; where only one fits it is recorded as
 * such, where more fit one call chooses (limit two a day) and code refuses a form the data does not fit. A form that does not exist is
 * filed with `propose`. A figure whose shape already has a choice is skipped. Used by scripts and fixtures; the daily run is the
 * scheduled pass (passes.server.ts). Never throws.
 */
export async function chartDesk(db: Admin, o: { now?: number; fixture?: boolean; slugs?: string[] } = {}): Promise<ChartRun> {
  const out: ChartRun = { checked: 0, calls: 0, choices: [], proposals: 0, errors: [] }, now = o.now ?? Date.now();
  try {
    const slugs = o.slugs ?? (await storedLiveStudies()) ?? [];
    const bud = await chartBudget(db, slugs, now, o.fixture);
    const b: ChartBudget = { ...bud, allowCall: () => true, callMs: 25_000, fixture: !!o.fixture };
    for (const slug of slugs) {
      const r = await withTimeout(storedStudy(slug), 5000, "the stored study").catch(e => ({ error: e instanceof Error ? e.message : "error" }));
      if ("error" in r) { if (r.error !== "not live") out.errors.push(`chart ${slug}: ${r.error}`); continue; }
      await chartStudy(db, slug, r.page, b, out);
    }
  } catch (e) { out.errors.push(e instanceof Error ? e.message.slice(0, 120) : "error"); }
  return out;
}

// SHARE IMAGES --------------------------------------------------------------------------------------------------------------------------
/** Every published story, live study (from the stored Studies home) and closed Digest issue: the day's plan. Read once a day. */
export async function shareTargets(): Promise<import("./graphics").ShareTarget[]> {
  const [{ storyIndex }, { streamOf }, digest] = await Promise.all([import("../stories/read.server"), import("../stories/view"), import("../digest/digest.server")]);
  const out: import("./graphics").ShareTarget[] = [];
  for (const s of streamOf(await storyIndex())) out.push({ kind: "story", id: s.id, path: `/share/story/${s.id}.png` });
  for (const slug of (await storedLiveStudies()) ?? []) out.push({ kind: "study", id: slug, path: `/data/${slug}.png` });
  for (const w of await digest.latestIssueWeeks(60).catch(() => [] as string[])) out.push({ kind: "digest", id: w, path: `/digest/${w}.png` });
  return out;
}
export const targetKey = (t: Pick<import("./graphics").ShareTarget, "kind" | "id">) => `${t.kind}:${t.id}`;
export function targetOf(key: string): import("./graphics").ShareTarget | null {
  const m = /^(story|study|digest):(.+)$/.exec(key); if (!m) return null;
  const kind = m[1] as "story" | "study" | "digest", id = m[2]!;
  return { kind, id, path: kind === "story" ? `/share/story/${id}.png` : kind === "study" ? `/data/${id}.png` : `/digest/${id}.png` };
}
/** One share image built as the share routes draw it, from stored rows and records only (a story's own rows; a study's or issue's
 *  record). Throws with the reason when it cannot be built. Returns the PNG's size. */
export async function buildShareStored(t: import("./graphics").ShareTarget): Promise<number> {
  const { respond } = await import("../digest/og.server");
  let res: Response;
  if (t.kind === "story") {
    const [{ storyById }, { storyCardOf }, { shareScene }] = await Promise.all([import("../stories/read.server"), import("../share/share.server"), import("../share/scene")]);
    const s = await storyById(t.id);
    if (!s || s.state !== "published") throw new Error("not published now");
    const c = storyCardOf(s);
    res = await respond(shareScene(c), "png", `${c.kicker}: ${c.title}`);
  } else if (t.kind === "study") {
    const r = await storedStudy(t.id);
    if ("error" in r) throw new Error(r.error);
    const { dataStoryOgScene } = await import("../data-stories/og");
    res = await respond(dataStoryOgScene({ ...r.page.story, headline: r.page.story.text.headline }), "png", r.page.story.text.headline);
  } else {
    const [{ readRecord }, { pageKey, usable }, { editionOgScene }, { ISSUE_V }] = await Promise.all([import("../records/store.server"), import("../records/records"), import("../digest/og"), import("../digest/digest.server")]);
    const r = await readRecord<import("../digest/edition").Edition & { v?: number }>(pageKey("digest", t.id));
    if (!r || !usable(r, Date.now()) || r.body?.v !== ISSUE_V) throw new Error(NO_RECORD);
    res = await respond(editionOgScene(r.body), "png", r.body.text.headline);
  }
  if (res.status !== 200) throw new Error(`status ${res.status}`);
  const b = new Uint8Array(await res.arrayBuffer());
  if (b.length < 1000) throw new Error("empty image");
  return b.length;
}
/** Every target at once (scripts only; the daily run is the scheduled pass). Stored records only, five seconds an image. Never throws. */
export async function shareCheck(db: Admin, o: { write?: boolean; deadline?: number } = {}) {
  const g = await import("./graphics");
  const results: import("./graphics").ShareResult[] = [];
  try {
    for (const [n, t] of (await shareTargets()).entries()) {
      if (o.deadline && Date.now() > o.deadline) { results.push({ kind: "story", id: "(time)", path: "", ok: false, rebuilt: false, error: `${n} checked, the rest not reached: time ran out` }); break; }
      try { await withTimeout(buildShareStored(t), 5000, "the image"); results.push({ ...t, ok: true, rebuilt: false, error: null }); }
      catch (e) { results.push({ ...t, ok: false, rebuilt: false, error: (e instanceof Error ? e.message : "error").slice(0, 120) }); }
    }
  } catch (e) { results.push({ kind: "story", id: "(list)", path: "", ok: false, rebuilt: false, error: e instanceof Error ? e.message.slice(0, 120) : "error" }); }
  const sum = g.shareSummary(results);
  if (o.write !== false) await db.from("share_checks").insert({ checked: sum.checked, rebuilt: sum.rebuilt, failures: sum.failures as never });
  return sum;
}
