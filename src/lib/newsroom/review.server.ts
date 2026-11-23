// N2 · the desks' I/O inside the product: which stories wait for review, what a reader sees of each (the story page's own model, the
// facts sheet the writer had, each brand's homepage title and sector), the two desks' model calls (the story writer's gateway path and
// cost ledger), the review rows and the door. Called from the story build with the build's loaded input; service-role only.
import beats from "../../../newsroom/beats.md?raw";
import type { BuildInput, Ctx } from "../stories/candidates";
import type { ShareBase } from "../stories/writer-facts";
import type { ReviewIO, PendingStory, ReviewRow, DeskName } from "./review";
import type { ReviewInput, ReviewBrand } from "./standards";
import { currentDeskVersion } from "./golden/versions";
type Stored = import("../stories/edits").StoredStory;

export type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
export type ReviewCtx = { input: BuildInput; ctx: Ctx; bases?: (runId: number, keys: string[], scopes: string[]) => Promise<Map<string, ShareBase>> };
/** Published stories are checked again only for edits made after the desks were switched on. */
export const STANDARDS_SINCE = "2026-11-22T06:00:00Z";
/** N4c · checklist holds this recent are checked again once when the checklist's code changes. */
export const RECHECK_HOLD_DAYS = 7;
const COLS = "id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at";
const dayStart = (now: number) => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const parts = (c: unknown) => { const o = (c && typeof c === "object" ? c : {}) as Record<string, { value?: unknown }>; const size = num(o["size"]?.value), brand = num(o["brand"]?.value), novelty = num(o["novelty"]?.value), relevance = num(o["relevance"]?.value); return { size, brand, novelty, relevance, total: size + brand + novelty + relevance }; };

/** Brands as the desk sees them: tracked now or not, name, sector, and the latest live desktop homepage title and headline. */
export async function brandsFor(domains: string[]): Promise<ReviewBrand[]> {
  if (!domains.length) return [];
  const [{ supabaseAnon }, { brandName }, { nameAppears }] = await Promise.all([import("../mcp/supabase"), import("../brand-names"), import("../name-check")]);
  const db = supabaseAnon(), ds = [...new Set(domains)].slice(0, 40);
  const { data: sites } = await db.from("library_sites").select("domain,name,sector,active").in("domain", ds);
  const caps = await Promise.all(ds.map(d => db.from("library_snapshots").select("title:signals->>title,h1:signals->lexicon->>h1").eq("domain", d).eq("page_type", "home").eq("viewport", "desktop").eq("source", "live").order("id", { ascending: false }).limit(1).maybeSingle().then(r => (r.data ?? null) as { title: string | null; h1: string | null } | null, () => null)));
  return ds.map((d, i) => {
    const s = (sites ?? []).find(x => x.domain === d), c = caps[i], name = brandName(d, s?.name ?? null);
    return { domain: d, name, active: !!s?.active, title: c?.title ?? null, sector: s?.sector ?? null, nameInTitle: !!c && nameAppears([s?.name ?? null, name], d, [c.title, c.h1]) };
  });
}

/** What a reader sees of one story (the story page's own model), its facts sheet, its brands and, for news, today's verdict on its item. */
export async function reviewInput(id: string, r: ReviewCtx | null, o: { asOf?: string; /** N4c · the sheet the build stored (the review pass has no build context) */ sheet?: ReviewInput["sheet"] } = {}): Promise<ReviewInput | null> {
  const [{ loadStoryLead }, { storyById }, { writerFacts }, { factSource }, { canonical }, { newsMatcher, newsVerdict }] = await Promise.all([
    import("../stories/page.server"), import("../stories/read.server"), import("../stories/writer-facts"), import("../stories/build.server"), import("../labels"), import("../stories/candidates"),
  ]);
  const [s, page] = await Promise.all([storyById(id, o.asOf), loadStoryLead(id, o)]);
  if (!s || !page || s.state === "killed") return null;
  const fs = { id: s.id, type: s.type, headline: s.headline, deck: s.deck, facts: s.facts, sector: s.sector, signal_keys: s.signal_keys, domains: s.domains, source_ids: s.source_ids, basis: s.basis, happened_at: s.happened_at, kicker: s.kicker };
  let sheet: ReviewInput["sheet"] = o.sheet ?? null;
  if (r) {
    const keys = [...new Set(s.signal_keys.slice(0, 3).map(canonical))], scopes = [...new Set(["all", ...(s.sector ? [s.sector] : [])])];
    const bases = r.ctx.cur && keys.length && r.bases ? await r.bases(r.ctx.cur.id, keys, scopes).catch(() => new Map<string, ShareBase>()) : new Map<string, ShareBase>();
    sheet = writerFacts(fs, factSource(r.input, r.ctx, bases)).facts;
  }
  const facts = (Array.isArray(s.facts) ? s.facts : []) as { text?: unknown; kind?: unknown; basis?: unknown; href?: unknown }[];
  const rf = facts.filter(f => typeof f.text === "string").map(f => ({ text: String(f.text), kind: typeof f.kind === "string" ? f.kind : null, basis: typeof f.basis === "string" ? f.basis : null, href: typeof f.href === "string" ? f.href : null }));
  let news: ReviewInput["news"] = null;
  if (s.type === "news") {
    const item = (re: RegExp) => rf.find(f => f.kind === "line" && re.test(f.text))?.text.replace(re, "").replace(/”$/, "") ?? null;
    const title = item(/^Item title: “/) ?? s.stored.headline, excerpt = item(/^Item excerpt: “/);
    const sites = r ? r.input.sites.map(x => ({ domain: x.domain, name: x.name })) : (await brandsFor(s.domains)).filter(b => b.active).map(b => ({ domain: b.domain, name: b.name }));
    const headline = r ? [...r.ctx.tiers].filter(([, t]) => t === "headline").map(([k]) => k) : [];
    const v = newsVerdict(newsMatcher(sites, headline), { title, excerpt, url: "", source: s.kicker.split(" · ")[1] ?? "", source_kind: "rss" });
    news = { title, excerpt, domains: v.drop ? [] : v.domains, drop: v.drop };
  }
  let quietEvent: string | null = null;
  const qe = /^quiet:event:(\d+)$/.exec(s.id);
  if (qe) { const { supabaseAnon } = await import("../mcp/supabase"); quietEvent = (await supabaseAnon().from("library_events").select("type").eq("id", Number(qe[1])).maybeSingle()).data?.type ?? null; }
  const lead = "lead" in page ? page.lead : null;
  // N3 · the brands and measures the story cites: its source changes' fields (the ninth checklist item matches open findings on them).
  const evIds = s.source_ids.flatMap(x => /^event:(\d+)$/.exec(x) ? [Number(x.slice(6))] : []).slice(0, 60);
  let cites: { domain: string; measure: string }[] = [];
  if (evIds.length) { const [{ supabaseAnon }, { citesOf }] = await Promise.all([import("../mcp/supabase"), import("./datadesk")]); const { data } = await supabaseAnon().from("library_events").select("domain,before,after").in("id", evIds); cites = citesOf((data ?? []) as { domain: string; before: unknown; after: unknown }[]); }
  // N5 · a published story's newest written text and the sheet stored at or before it (what checklist item 1 compares it with).
  let asWritten: NonNullable<ReviewInput["asWritten"]> | null = null;
  if (s.state === "published") asWritten = (await writtenWith(id).catch(() => null)) ?? null;
  return {
    state: s.state, asWritten,
    id: s.id, number: s.number ?? null, type: s.type, basis: s.basis, kicker: page.kicker, headline: page.headline, deck: page.deck ?? null, body: page.body, howWeKnow: page.howWeKnow,
    numbers: page.census ? page.census.lines.map(l => `${l.name}${l.line ? ` · ${l.line}` : ""}`) : page.facts.map(f => f.text),
    picture: lead ? { kind: lead.kind, items: lead.items.map(x => ({ domain: x.domain, credit: x.credit })), caption: lead.caption } : null,
    facts: rf, sheet, domains: s.domains, brands: await brandsFor(s.domains), news, quietEvent, sourceIds: s.source_ids, written: !!s.written, cites,
  };
}

/** The desk's model call on the story writer's gateway path and cost ledger, recorded in desk_calls (only when a call was made). */
export async function deskCall(db: Admin, desk: DeskName, purpose: "review" | "placement" | "fixture" | "picks" | "chart" | "proposal", req: { system: string; user: string; schema: Record<string, unknown>; schemaName: string; tool: import("../stories/writer.server").GatewayRequest["tool"]; maxTokens: number },
  parse: (raw: unknown) => unknown | null, storyIds: string[], signal: AbortSignal, prompt: import("./golden/versions").DeskPrompt = desk as import("./golden/versions").DeskPrompt,
  /** T2 · a scoring run's candidate model (fixture calls only); the desks' own passes never set it. */
  modelOverride?: import("../ai-models").AiModel): Promise<{ parsed: unknown; call_id: number | null; model: string; cost: number } | null> {
  const [{ gatewayCall, providerCanRun }, { AI_MODELS }] = await Promise.all([import("../stories/writer.server"), import("../ai-models")]);
  // The story writer's models: the writer model, or the text model where the provider cannot run it (as the writer falls back).
  const { STEP_MODELS } = await import("../ai-models");
  // T2 · the standards second reader runs on its own (cheaper) model, which passed its frozen cases; the others stay on the writer's.
  const own = desk === "standards" && providerCanRun(STEP_MODELS.standards) ? STEP_MODELS.standards : null;
  const model = modelOverride && purpose === "fixture" ? modelOverride : own ?? (providerCanRun(AI_MODELS.writer) ? AI_MODELS.writer : AI_MODELS.text);
  const r = await gatewayCall(db, { model, ...req, textMaxTokens: Math.min(req.maxTokens, 2000) }, signal);
  if (!r) return null;
  const parsed = r.raw != null ? parse(r.raw) : null;
  const { data } = await db.from("desk_calls").insert({ desk, purpose, model, usage_id: r.usage_id ?? null, ok: parsed != null, cost: Math.round(r.cost * 1e6) / 1e6, prompt_version: currentDeskVersion(prompt)?.version ?? null, story_ids: storyIds.slice(0, 60),
    answer: (parsed ?? {}) as never, error: parsed == null ? (r.raw == null ? "no answer" : "not the fixed structure") : null }).select("id").single();
  return { parsed, call_id: (data?.id as number | undefined) ?? null, model, cost: r.cost };
}

export function reviewIO(db: Admin, r: ReviewCtx | null, now: () => number = Date.now): ReviewIO {
  const io: ReviewIO = {
    now,
    pending: async () => {
      const [{ applyEdits }, { isPending }] = await Promise.all([import("../stories/edits"), import("./review")]);
      const since = new Date(now() - 3 * 864e5).toISOString();
      const { data, error } = await db.from("stories").select(COLS).eq("status", "held").like("reason", "awaiting review%").gte("created_at", since).order("score", { ascending: false }).limit(60);
      if (error) throw new Error("pending_read_failed");
      const ids = (data ?? []).map(x => x.id);
      if (!ids.length) return [];
      const [e, t] = await Promise.all([db.from("story_edits").select("id,story_id,action,payload,note,at").in("story_id", ids).order("id"), db.from("story_texts").select("story_id").in("story_id", ids)]);
      if (e.error || t.error) throw new Error("pending_inputs_failed");
      const drafted = new Set((t.data ?? []).map(x => x.story_id));
      return (data ?? []).map(x => applyEdits(x as unknown as Stored, (e.data ?? []) as never, now())).filter(isPending).map(x => toPending(x, drafted.has(x.id)));
    },
    rechecks: async () => {
      const { applyEdits } = await import("../stories/edits");
      const since = new Date(Math.max(now() - 48 * 36e5, Date.parse(STANDARDS_SINCE))).toISOString();
      const { data: ed, error } = await db.from("story_edits").select("story_id,at").eq("action", "correct").gte("at", since).limit(200);
      if (error) throw new Error("recheck_edits_failed");
      const ids = [...new Set((ed ?? []).map(x => x.story_id))];
      if (!ids.length) return [];
      const [st, all, rv] = await Promise.all([db.from("stories").select(COLS).in("id", ids), db.from("story_edits").select("id,story_id,action,payload,note,at").in("story_id", ids).order("id"), db.from("story_reviews").select("story_id,at").eq("desk", "standards").in("story_id", ids).order("id", { ascending: false })]);
      if (st.error || all.error || rv.error) throw new Error("recheck_read_failed");
      const lastReview = new Map<string, string>(); for (const x of rv.data ?? []) if (!lastReview.has(x.story_id)) lastReview.set(x.story_id, x.at);
      const lastEdit = new Map<string, string>(); for (const x of ed ?? []) if ((lastEdit.get(x.story_id) ?? "") < x.at) lastEdit.set(x.story_id, x.at);
      return (st.data ?? []).map(x => applyEdits(x as unknown as Stored, (all.data ?? []) as never, now())).filter(x => x.state === "published" && (lastReview.get(x.id) ?? "") < (lastEdit.get(x.id) ?? "")).map(x => toPending(x, true));
    },
    writerOut: async () => {
      const [{ writerIO, providerCanRun }, { AI_MODELS }, { WRITER_PER_DAY }] = await Promise.all([import("../stories/writer.server"), import("../ai-models"), import("../stories/writer")]);
      if (!providerCanRun(AI_MODELS.writer)) return false;
      return (await writerIO(db).used()) >= WRITER_PER_DAY;
    },
    input: async id => r ? reviewInput(id, r) : reviewInput(id, null, { sheet: await storedSheet(db, id) }),
    lastStandards: async ids => {
      const out = new Map<string, { facts_hash: string; verdict: string; second_reader: string | null; at: string; reason?: string | null }>();
      if (!ids.length) return out;
      const { data, error } = await db.from("story_reviews").select("story_id,facts_hash,verdict,second_reader,at,reason").eq("desk", "standards").in("story_id", ids).order("id", { ascending: false });
      if (error) throw new Error("reviews_read_failed");
      for (const x of data ?? []) if (!out.has(x.story_id)) out.set(x.story_id, x);
      return out;
    },
    callsToday: async desk => {
      const { count, error } = await db.from("desk_calls").select("id", { count: "exact", head: true }).eq("desk", desk).neq("purpose", "fixture").gte("at", dayStart(now()));
      if (error) throw new Error("desk_calls_read_failed");
      return count ?? 0;
    },
    secondReader: async (i, signal) => {
      const s = await import("./standards");
      const c = await deskCall(db, "standards", "review", { system: s.STANDARDS_SYSTEM, user: s.standardsUser(i), schema: s.STANDARDS_SCHEMA as unknown as Record<string, unknown>, schemaName: "standards_review", tool: s.STANDARDS_TOOL, maxTokens: 2500 }, raw => s.parseProblems(raw, i), [i.id], signal);
      return c && c.parsed ? { problems: c.parsed as import("./standards").Problem[], call_id: c.call_id } : null;
    },
    chief: async (ci, ids, signal) => {
      const c0 = await import("./chief");
      const c = await deskCall(db, "editor in chief", "placement", { system: c0.CHIEF_SYSTEM, user: c0.chiefUser(ci), schema: c0.CHIEF_SCHEMA as unknown as Record<string, unknown>, schemaName: "chief_front", tool: c0.CHIEF_TOOL, maxTokens: 1500 }, c0.parseChief, ids, signal);
      return c && c.parsed ? { answer: c.parsed as import("./chief").ChiefAnswer, call_id: c.call_id } : null;
    },
    frontDay: async () => frontDay(now()),
    chiefHolds: async ids => {
      const out = new Map<string, { day: string; facts_hash: string }[]>();
      if (!ids.length) return out;
      const { data } = await db.from("story_reviews").select("story_id,facts_hash,at").eq("desk", "editor in chief").eq("verdict", "hold").in("story_id", ids);
      for (const x of data ?? []) out.set(x.story_id, [...(out.get(x.story_id) ?? []), { day: x.at.slice(0, 10), facts_hash: x.facts_hash }]);
      return out;
    },
    reoffers: async () => {
      const [{ applyEdits }, { passHeldBy }] = await Promise.all([import("../stories/edits"), import("./holds")]);
      const { data } = await db.from("story_reviews").select("story_id").eq("desk", "editor in chief").eq("verdict", "hold").gte("at", new Date(now() - 3 * 864e5).toISOString()).limit(100);
      const ids = [...new Set((data ?? []).map(x => x.story_id))];
      if (!ids.length) return [];
      const [st, ed, holds] = await Promise.all([db.from("stories").select(COLS).in("id", ids), db.from("story_edits").select("id,story_id,action,payload,note,at").in("story_id", ids).order("id"), holdReviews(db, ids)]);
      if (st.error || ed.error) return [];
      // Still held, and the hold in force is the editor in chief's own placement call (N5: never a hold made through the door from a
      // desk session or by the owner), and not about a day already past the week.
      return (st.data ?? []).map(x => applyEdits(x as unknown as Stored, (ed.data ?? []) as never, now()))
        .filter(x => x.state === "held" && passHeldBy(x.edits, holds.get(x.id) ?? [], "editor in chief") && now() - Date.parse(x.happened_at) < 3 * 864e5).map(x => toPending(x, true));
    },
    record: async rows => {
      if (!rows.length) return;
      const { data, error } = await db.from("story_reviews").insert(rows.map(toRow) as never).select("id,story_id,desk");
      if (error) throw new Error(`review_insert_failed: ${error.message.slice(0, 80)}`);
      // N4c · every standards review stores the checklist code's fingerprint it was made with.
      const { CHECKLIST_FINGERPRINT } = await import("./checklist-fp.gen");
      const fp = (data ?? []).filter(x => x.desk === "standards").map(x => ({ review_id: x.id, story_id: x.story_id, fingerprint: CHECKLIST_FINGERPRINT }));
      if (fp.length) { const { error: e2 } = await db.from("review_checklists").insert(fp); if (e2) console.error("review fingerprint insert failed", e2.code); }
    },
    // N4c · stories a checklist item held in the last seven days under an earlier checklist, not yet re-checked under this one.
    checklistRechecks: async () => {
      const [{ applyEdits }, { CHECKLIST_FINGERPRINT }, { recheckDue }] = await Promise.all([import("../stories/edits"), import("./checklist-fp.gen"), import("./review")]);
      const since = new Date(now() - RECHECK_HOLD_DAYS * 864e5).toISOString();
      const { data: rv, error } = await db.from("story_reviews").select("id,story_id,verdict,second_reader,at,reason").eq("desk", "standards").gte("at", since).order("id", { ascending: false }).limit(500);
      if (error) throw new Error("recheck_reviews_failed");
      const ids = [...new Set((rv ?? []).map(x => x.story_id))];
      if (!ids.length) return [];
      const { data: fps } = await db.from("review_checklists").select("review_id,fingerprint").in("review_id", (rv ?? []).map(x => x.id));
      const fpOf = new Map((fps ?? []).map(x => [x.review_id, x.fingerprint]));
      const due = recheckDue((rv ?? []).map(x => ({ id: x.id, story_id: x.story_id, verdict: x.verdict, second_reader: x.second_reader, at: x.at, reason: x.reason, fingerprint: fpOf.get(x.id) ?? null })), CHECKLIST_FINGERPRINT);
      if (!due.length) return [];
      const [st, ed, holds, { passHeldBy }] = await Promise.all([db.from("stories").select(COLS).in("id", due), db.from("story_edits").select("id,story_id,action,payload,note,at").in("story_id", due).order("id"), holdReviews(db, due), import("./holds")]);
      if (st.error || ed.error) throw new Error("recheck_read_failed");
      // Still held, by the standards desk's own review (N5: a hold made through the door is never offered to a pass).
      return (st.data ?? []).map(x => applyEdits(x as unknown as Stored, (ed.data ?? []) as never, now()))
        .filter(x => x.state === "held" && passHeldBy(x.edits, holds.get(x.id) ?? [], "standards")).map(x => toPending(x, true));
    },
    door: async (actor, body) => {
      const { deskDoor } = await import("../stories/desk.server");
      // N5 · a hold the pass makes carries the pass's marker, so a hold made through the door from outside is told apart.
      const res = await deskDoor(actor, body, { pass: true });
      const b = (res.body ?? {}) as { reason?: string; error?: string };
      return { ok: res.status < 300, status: res.status, ...(res.status >= 300 ? { reason: b.reason ?? b.error ?? "refused" } : {}) };
    },
    promptVersion: desk => deskVersionNow(desk),
    // N3 · the graphics desk: one picture check per story waiting for review (a recorded choice is reused), through the door.
    picture: async (id, _i, o) => {
      const { data: had } = await db.from("picture_choices").select("kind,verdict,reason").eq("story_id", id).eq("actor", "graphics").order("id", { ascending: false }).limit(5);
      // N4c · a choice is reused, except the rule's picture left standing only because time ran out: that was never a check.
      const real = (had ?? []).find(x => !isTimeFallback(x));
      if (real) return { verdict: real.verdict, reason: real.reason, changed: false };
      // Not enough time for the check: nothing is recorded and the story waits for the next pass.
      if (o.msLeft < DESK_CALL_MS + PICTURE_MARGIN_MS) return { verdict: "wait", reason: "no time for the picture check in this pass", changed: false };
      const g = await import("./graphics.server");
      const run = await g.pictureCheck(db, id, { now: now(), signal: AbortSignal.timeout(Math.min(PICTURE_CALL_MAX_MS, Math.max(5000, o.msLeft - PICTURE_MARGIN_MS))) });
      const d = run.decision;
      // N4c · the door takes each picture as { asset, usable, why }; the desk's answer names them by ref with a problem word (sent as
      // they were, every checked choice was refused and the rule's picture stood).
      const perPicture = (await import("./graphics")).doorPictures(d.per_picture, run.refs);
      const res = await io.door("graphics", { action: "picture", id, choice: d.kind, ...(d.kind === "crop" || d.kind === "pair" ? { assets: d.assets } : {}), reason: d.reason.slice(0, 600), verdict: d.verdict, per_picture: perPicture, ...(run.call_id ? { call: run.call_id } : {}) });
      if (!res.ok) { const fb = { verdict: "fallback", reason: `The rule's picture stands: the choice was refused (${res.reason ?? res.status}).` }; await io.door("graphics", { action: "picture", id, choice: "rule", reason: fb.reason, verdict: "fallback" }).catch(() => null); return { ...fb, changed: false }; }
      // N3b · "change not visible" on a set of first screens is the desk's note on the story, never shown to readers.
      for (const text of d.notes ?? []) await io.door("graphics", { action: "note", subject_kind: "story", subject: id, text }).catch(() => null);
      (await import("../stories/page.server")).forgetPictureChoice(id);
      return { verdict: d.verdict, reason: d.reason, changed: d.kind !== "rule" };
    },
    openFindings: async () => (await import("./datadesk.server")).openFindings(db),
    overruled: async () => {
      const { applyEdits } = await import("../stories/edits");
      const { data } = await db.from("story_reviews").select("story_id,at,second_reader").eq("desk", "standards").eq("second_reader", "overruled").gte("at", new Date(now() - 3 * 864e5).toISOString()).limit(50);
      const ids = [...new Set((data ?? []).map(x => x.story_id))];
      if (!ids.length) return [];
      const [st, ed, placed, holds, { doorHeld }] = await Promise.all([db.from("stories").select(COLS).in("id", ids), db.from("story_edits").select("id,story_id,action,payload,note,at").in("story_id", ids).order("id"), db.from("story_reviews").select("story_id,at").eq("desk", "editor in chief").in("story_id", ids), holdReviews(db, ids), import("./holds")]);
      if (st.error || ed.error || placed.error) return [];
      const overAt = new Map<string, string>(); for (const x of data ?? []) if ((overAt.get(x.story_id) ?? "") < x.at) overAt.set(x.story_id, x.at);
      const lastPlaced = new Map<string, string>(); for (const x of placed.data ?? []) if ((lastPlaced.get(x.story_id) ?? "") < x.at) lastPlaced.set(x.story_id, x.at);
      return (st.data ?? []).map(x => applyEdits(x as unknown as Stored, (ed.data ?? []) as never, now())).filter(x => x.state === "held" && !doorHeld(x.edits, holds.get(x.id) ?? []) && (lastPlaced.get(x.id) ?? "") < (overAt.get(x.id) ?? "")).map(x => toPending(x, true));
    },
    // N5 · how many earlier review passes left each story waiting for time, since its newest standards review (the finish rows' list).
    waits: async ids => waitCounts(db, ids, now()),
  };
  return io;
}
/** N5 · the hold reviews (both desks) of these stories: what tells a review pass's own hold edit from one made through the door. */
async function holdReviews(db: Admin, ids: string[]): Promise<Map<string, { desk: string; verdict: string; at: string }[]>> {
  const out = new Map<string, { desk: string; verdict: string; at: string }[]>();
  if (!ids.length) return out;
  const { data } = await db.from("story_reviews").select("story_id,desk,verdict,at").eq("verdict", "hold").in("story_id", ids.slice(0, 200)).order("id", { ascending: false }).limit(1000);
  for (const x of data ?? []) out.set(x.story_id, [...(out.get(x.story_id) ?? []), { desk: x.desk, verdict: x.verdict, at: x.at }]);
  return out;
}
/** N5 · review-pass finish rows of the last two days that list each story as waiting, after the story's newest standards review. */
export async function waitCounts(db: Admin, ids: string[], now: number): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const [{ waitsOf }, fin, rv] = await Promise.all([import("./holds"),
    db.from("job_runs").select("at,detail").eq("job", "review-passes").eq("phase", "finish").gte("at", new Date(now - 2 * 864e5).toISOString()).order("id", { ascending: false }).limit(1200),
    db.from("story_reviews").select("story_id,at,desk").in("story_id", ids.slice(0, 200)).order("id", { ascending: false }).limit(1000)]);
  const rows = (fin.data ?? []).map(r => ({ at: r.at, waiting: Array.isArray((r.detail as { waiting?: unknown } | null)?.waiting) ? ((r.detail as { waiting: unknown[] }).waiting.filter((x): x is string => typeof x === "string")) : [] }));
  for (const id of ids) {
    // A standards review that passed already: its later waits are for the editor in chief; counting starts from the story's newest
    // review of any desk, so a new verdict starts the count again.
    const since = (rv.data ?? []).find(x => x.story_id === id)?.at ?? null;
    out.set(id, waitsOf(rows, id, since));
  }
  return out;
}
const DESK_CALL_MS = 12_000;
/** N4c · the picture check's call takes at most this long, and leaves this much of the pass for standards and the editor in chief. */
export const PICTURE_CALL_MAX_MS = 15_000, PICTURE_MARGIN_MS = 8_000;
/** The rule's picture left standing because the job tail ran out of time (N3) or the door refused the desk's choice (the N3 answer
 *  shape); not a decision, so never reused. */
export const isTimeFallback = (c: { verdict: string; reason: string }) => c.verdict === "fallback" && /time ran out|the choice was refused/i.test(c.reason);
const deskVersionNow = (desk: DeskName) => currentDeskVersion(desk as import("./golden/versions").DeskPrompt)?.version ?? null;

function toPending(x: { id: string; type: string; basis: string | null; score: number; components: unknown; happened_at: string; created_at: string; domains: string[] }, drafted: boolean): PendingStory {
  return { id: x.id, type: x.type, basis: x.basis, score: x.score, components: parts(x.components), happened_at: x.happened_at, created_at: x.created_at, domains: x.domains, drafted };
}
const toRow = (r: ReviewRow) => ({ story_id: r.story_id, desk: r.desk, verdict: r.verdict, reason: r.reason?.slice(0, 600) ?? null, facts_hash: r.facts_hash, checklist: r.checklist ?? [], problems: r.problems ?? [],
  second_reader: r.second_reader ?? null, placement: r.placement ?? null, basis: r.basis ?? "desk", call_id: r.call_id ?? null, prompt_version: r.prompt_version ?? null });

/** The editor in chief's view of the day, from the stored stories (fresh): whether the lead is open, the last seven days' leads by the
 *  front page's own rule, and each day's remaining slots. */
export async function frontDay(now: number) {
  const [{ deskIndex }, { streamOf }, { pickLead }, { rankScores, leadAllowed }, { slotsFor }] = await Promise.all([import("../stories/read.server"), import("../stories/view"), import("../front/front"), import("../stories/score"), import("./chief")]);
  const all = await deskIndex(), stream = streamOf(all).filter(s => s.type !== "launch");
  const lead = pickLead(stream, "all", now);
  const leadOpen = !lead || (lead.label !== "Today" && lead.label !== "Pinned by the editor");
  const rank = rankScores(stream), days = [...Array(7)].map((_, i) => new Date(now - i * 864e5).toISOString().slice(0, 10));
  const leads = days.flatMap(d => { const xs = stream.filter(s => s.happened_at.slice(0, 10) === d && leadAllowed(s, stream)).sort((a, b) => (rank.get(b.id) ?? b.score) - (rank.get(a.id) ?? a.score)); return xs[0] ? [{ day: d, headline: xs[0].headline, type: xs[0].type }] : []; });
  const slots = new Map(days.map(d => [d, slotsFor(stream.filter(s => s.happened_at.slice(0, 10) === d))] as const));
  return { leadOpen, leads, slots, beats };
}

// N4c · THE STORED SHEETS ------------------------------------------------------------------------------------------------------------
/** The writer's facts sheet for one story from a build's context (what the checklist's first item reads). */
export async function sheetOf(id: string, r: ReviewCtx): Promise<ReviewInput["sheet"]> {
  const [{ storyById }, { writerFacts }, { factSource }, { canonical }] = await Promise.all([import("../stories/read.server"), import("../stories/writer-facts"), import("../stories/build.server"), import("../labels")]);
  const s = await storyById(id);
  if (!s || s.state === "killed") return null;
  const fs = { id: s.id, type: s.type, headline: s.headline, deck: s.deck, facts: s.facts, sector: s.sector, signal_keys: s.signal_keys, domains: s.domains, source_ids: s.source_ids, basis: s.basis, happened_at: s.happened_at, kicker: s.kicker };
  const keys = [...new Set(s.signal_keys.slice(0, 3).map(canonical))], scopes = [...new Set(["all", ...(s.sector ? [s.sector] : [])])];
  const bases = r.ctx.cur && keys.length && r.bases ? await r.bases(r.ctx.cur.id, keys, scopes).catch(() => new Map<string, ShareBase>()) : new Map<string, ShareBase>();
  return writerFacts(fs, factSource(r.input, r.ctx, bases)).facts;
}
/** N5 · a published story's newest written text with the facts sheet stored at or before it was written (service reads). */
export async function writtenWith(id: string): Promise<ReviewInput["asWritten"]> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: t } = await db.from("story_texts").select("created_at,checked,headline,deck,body").eq("story_id", id).order("version", { ascending: false }).limit(1);
  const text = t?.[0]; if (!text) return null;
  const { data: sh } = await db.from("review_sheets").select("sheet").eq("story_id", id).lte("at", new Date(Date.parse(text.created_at) + 5_000).toISOString()).order("id", { ascending: false }).limit(1);
  return { at: text.created_at, checked: !!text.checked, sheet: (sh?.[0]?.sheet ?? null) as ReviewInput["sheet"], text: { headline: text.headline, deck: text.deck, body: text.body ?? [] } };
}
/** The newest stored sheet for a story (null: none stored; the checklist then reads the story's stored facts). */
export async function storedSheet(db: Admin, id: string): Promise<ReviewInput["sheet"]> {
  const { data } = await db.from("review_sheets").select("sheet").eq("story_id", id).order("id", { ascending: false }).limit(1);
  return (data?.[0]?.sheet ?? null) as ReviewInput["sheet"];
}
