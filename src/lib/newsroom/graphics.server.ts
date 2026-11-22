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

/** One vision call on the AI reads' model under the cost ledger (`desk_vision`), recorded in desk_calls. Null when no call was made. */
export async function visionDeskCall(db: Admin, purpose: "picture" | "fixture", g: GraphicsInput, images: { ref: string; url: string }[], signal: AbortSignal) {
  const [{ aiClient, markProvider, ProviderError }, { estimateCost }, { AI_MODELS, providerRuns }, nr] = await Promise.all([import("../ai-provider.server"), import("../ai-budget"), import("../ai-models"), import("./newsroom.server")]);
  const ai = aiClient(), provider = ai.provider, model = AI_MODELS.vision;
  if (!providerRuns(provider, model) || (await nr.capReachedNow(db))) return null;
  const estimate = estimateCost({ provider, model, input_tokens: 9000, output_tokens: 800 });
  const res = await db.rpc("ai_reserve", { p_snapshot_id: null as unknown as number, p_kind: "desk_vision", p_model: model, p_estimate: estimate });
  const rv = res.data as { ok?: boolean; id?: number } | null;
  if (res.error || !rv?.ok || typeof rv.id !== "number") return null;
  const uid = rv.id;
  if (!(await markProvider(db, uid, provider))) { await db.rpc("ai_settle", { p_id: uid, p_input: 0, p_output: 0, p_cost: 0, p_ok: false, p_error: "usage_write_failed", p_state: "rejected" }); return null; }
  const content: import("../ai-provider").ContentPart[] = [{ type: "text", text: graphicsText(g) }];
  for (const im of images) { content.push({ type: "text", text: `ref ${im.ref}:` }); content.push({ type: "image_url", image_url: { url: im.url } }); }
  let raw: unknown = null, cost = estimate, error: string | null = null;
  try {
    const resp = await ai.complete({ model, max_tokens: 1200, temperature: 0.1, signal, messages: [{ role: "system", content: GRAPHICS_SYSTEM }, { role: "user", content }], tools: [GRAPHICS_TOOL], tool_choice: { type: "function", function: { name: GRAPHICS_TOOL.function.name } } });
    cost = estimateCost({ provider, model, input_tokens: resp.usage.prompt_tokens, output_tokens: resp.usage.completion_tokens });
    raw = resp.tool_call_args ?? resp.text ?? null;
    await db.rpc("ai_settle", { p_id: uid, p_input: resp.usage.prompt_tokens, p_output: resp.usage.completion_tokens, p_cost: cost, p_ok: raw != null, p_error: raw != null ? null as unknown as string : "no_answer", p_state: "done" });
  } catch (e) {
    if (e instanceof ProviderError && e.outcome === "not_started") { await db.rpc("ai_settle", { p_id: uid, p_input: 0, p_output: 0, p_cost: 0, p_ok: false, p_error: `${provider}_${e.code}`, p_state: "rejected" }); return null; }
    error = e instanceof ProviderError ? e.code : "unknown outcome";
    await db.rpc("ai_settle", { p_id: uid, p_input: e instanceof ProviderError && e.usage ? e.usage.prompt_tokens : 0, p_output: e instanceof ProviderError && e.usage ? e.usage.completion_tokens : 0, p_cost: estimate, p_ok: false, p_error: `desk_vision_${error}`.slice(0, 80), p_state: "unknown" });
  }
  const parsed = raw != null ? parseGraphics(raw, [...g.chosen, ...g.alternates].map(x => x.ref)) : null;
  const { data } = await db.from("desk_calls").insert({ desk: "graphics", purpose, model, usage_id: uid, ok: parsed != null, cost: Math.round(cost * 1e6) / 1e6, prompt_version: currentDeskVersion("graphics")?.version ?? null, story_ids: [g.story.id],
    answer: (parsed ?? {}) as never, error: parsed == null ? (error ?? (raw == null ? "no answer" : "not the fixed structure")) : null }).select("id").single();
  return { parsed, call_id: (data?.id as number | undefined) ?? null, cost };
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

// STUDY CHART FORMS --------------------------------------------------------------------------------------------------------------------
export type ChartRun = { checked: number; calls: number; choices: { study: string; figure: string; form: string; basis: string; reason: string }[]; proposals: number; errors: string[] };
/**
 * Each live or drafted study's figures: the table in graphics.ts says which forms fit; where only one fits it is recorded as such, where
 * more fit one call chooses (limit two a day) and code refuses a form the data does not fit. A form that does not exist is filed with
 * `propose`. A figure whose shape and current form already have a choice is skipped. Never throws.
 */
export async function chartDesk(db: Admin, o: { now?: number; fixture?: boolean; slugs?: string[] } = {}): Promise<ChartRun> {
  const out: ChartRun = { checked: 0, calls: 0, choices: [], proposals: 0, errors: [] }, now = o.now ?? Date.now();
  try {
    const g = await import("./graphics");
    const [{ DATA_STORIES }, { loadDataStory }] = await Promise.all([import("../data-stories/registry"), import("../data-stories/page.server")]);
    const slugs = o.slugs ?? DATA_STORIES.map(s => s.slug);
    const { data: had } = await db.from("chart_choices").select("study,figure,shape,form,basis").in("study", slugs).order("id", { ascending: false }).limit(500);
    const seen = new Set((had ?? []).map(x => `${x.study}|${x.figure}|${x.shape}`));
    const { count } = await db.from("desk_calls").select("id", { count: "exact", head: true }).eq("desk", "graphics").eq("purpose", "chart").gte("at", dayStart(now));
    let left = o.fixture ? 2 : Math.max(0, capOf("graphics", "chart") - (count ?? 0));
    for (const slug of slugs) {
      const rec = await loadDataStory(slug).catch(() => null);
      if (!rec || rec.kind !== "live") continue;
      const figs = Object.entries(rec.story.figures) as [string, { kind: string; title: string; note: string; xs?: string[]; chart?: string; panels?: unknown[] }][];
      for (const [figure, f] of figs) {
        const shape = g.FIGURE_SHAPE[f.kind]; if (!shape) continue;
        const current = f.kind === "multiples" ? (f.chart ?? "line") : (g.SHAPE_FORMS[shape][0] as string);
        out.checked++;
        if (seen.has(`${slug}|${figure}|${shape}`)) continue;
        const fits = g.formsFor(f);
        let answer = null as { form: string; why: string; missing: string } | null, callId: number | null = null;
        if (fits.length > 1 && left > 0) {
          left--; out.calls++;
          const { deskCall } = await import("./review.server");
          const c = await deskCall(db, "graphics", o.fixture ? "fixture" : "chart", { system: g.CHART_SYSTEM, user: g.chartUser({ study: slug, title: f.title, note: f.note, kind: f.kind, xs: f.xs ?? [], panels: f.panels?.length ?? 0 }, fits), schema: g.CHART_SCHEMA as unknown as Record<string, unknown>, schemaName: "graphics_chart", tool: g.CHART_TOOL, maxTokens: 400 }, g.parseChart, [], AbortSignal.timeout(25_000), "graphics chart");
          answer = (c?.parsed as typeof answer) ?? null; callId = c?.call_id ?? null;
        } else if (fits.length > 1) continue; // the limit is used: the figure waits for tomorrow with its own form
        const d = g.decideChart(answer, f, current);
        out.choices.push({ study: slug, figure, form: d.form, basis: d.basis, reason: d.reason });
        if (!o.fixture) { const { error } = await db.from("chart_choices").insert({ study: slug, figure, shape, form: d.form, basis: d.basis, reason: d.reason.slice(0, 400), call_id: callId }); if (error) out.errors.push(`chart ${slug}: ${error.message.slice(0, 60)}`); }
        if (answer?.missing && !o.fixture && out.proposals < 2) {
          const { deskDoor } = await import("../stories/desk.server");
          const r = await deskDoor("graphics", { action: "propose", kind: "format", text: `A chart form the kit does not have, for “${f.title}” in ${slug}: ${answer.missing}. Filed by the graphics desk; nothing new is drawn until it is accepted.`.slice(0, 600), subject: slug });
          if (r.status < 300) out.proposals++;
        }
      }
    }
  } catch (e) { out.errors.push(e instanceof Error ? e.message.slice(0, 120) : "error"); }
  return out;
}

// SHARE IMAGES --------------------------------------------------------------------------------------------------------------------------
/** Every published story, live study and Digest issue: its share image must build (rendered as the share routes render it). A failure is
 *  built once more (a rebuild); what still fails is stored and listed on /desk. Code only, no model. Never throws. */
export async function shareCheck(db: Admin, o: { write?: boolean; deadline?: number } = {}) {
  const g = await import("./graphics");
  const targets: import("./graphics").ShareTarget[] = [];
  const results: import("./graphics").ShareResult[] = [];
  try {
    const [{ storyIndex }, { streamOf }, { loadDataIndex }, digest] = await Promise.all([import("../stories/read.server"), import("../stories/view"), import("../data-stories/page.server"), import("../digest/digest.server")]);
    for (const s of streamOf(await storyIndex())) targets.push({ kind: "story", id: s.id, path: `/share/story/${s.id}.png` });
    const home = await loadDataIndex().catch(() => null);
    const live = home ? [...new Map([...(home.home.lead ? [home.home.lead] : []), ...home.home.series.flatMap(x => x.studies)].map(x => [x.slug, x])).values()] : [];
    for (const s of live) targets.push({ kind: "study", id: s.slug, path: `/data/${s.slug}.png` });
    const weeks = await digest.latestIssueWeeks(60).catch(() => [] as string[]);
    for (const w of weeks) targets.push({ kind: "digest", id: w, path: `/digest/${w}.png` });
    const build = async (t: import("./graphics").ShareTarget) => {
      const r = t.kind === "story" ? await (await import("../share/share.server")).shareImage("story", t.id, "png")
        : t.kind === "study" ? await (await import("../data-stories/share.server")).dataStoryImage(t.id)
        : await (await import("../digest/og.server")).issueImage(`${t.id}.png`);
      if (r.status !== 200) throw new Error(`status ${r.status}`);
      const b = new Uint8Array(await r.arrayBuffer());
      if (b.length < 1000) throw new Error("empty image");
    };
    for (const [n, t] of targets.entries()) {
      // A run that would outlast the job stops and says how many it did not reach; tomorrow's run starts again from the top.
      if (o.deadline && Date.now() > o.deadline) { results.push({ kind: "story", id: "(time)", path: "", ok: false, rebuilt: false, error: `${targets.length - n} not checked: time ran out` }); break; }
      try { await build(t); results.push({ ...t, ok: true, rebuilt: false, error: null }); }
      catch (e1) { try { await build(t); results.push({ ...t, ok: true, rebuilt: true, error: null }); } catch (e2) { results.push({ ...t, ok: false, rebuilt: false, error: (e2 instanceof Error ? e2.message : String(e2 ?? e1)).slice(0, 120) }); } }
    }
  } catch (e) { results.push({ kind: "story", id: "(list)", path: "", ok: false, rebuilt: false, error: e instanceof Error ? e.message.slice(0, 120) : "error" }); }
  const sum = g.shareSummary(results);
  if (o.write !== false) await db.from("share_checks").insert({ checked: sum.checked, rebuilt: sum.rebuilt, failures: sum.failures as never });
  return sum;
}
