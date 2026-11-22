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

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
export type ReviewCtx = { input: BuildInput; ctx: Ctx; bases?: (runId: number, keys: string[], scopes: string[]) => Promise<Map<string, ShareBase>> };
/** Published stories are checked again only for edits made after the desks were switched on. */
export const STANDARDS_SINCE = "2026-11-22T06:00:00Z";
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
export async function reviewInput(id: string, r: ReviewCtx | null, o: { asOf?: string } = {}): Promise<ReviewInput | null> {
  const [{ loadStoryLead }, { storyById }, { writerFacts }, { factSource }, { canonical }, { newsMatcher, newsVerdict }] = await Promise.all([
    import("../stories/page.server"), import("../stories/read.server"), import("../stories/writer-facts"), import("../stories/build.server"), import("../labels"), import("../stories/candidates"),
  ]);
  const [s, page] = await Promise.all([storyById(id, o.asOf), loadStoryLead(id, o)]);
  if (!s || !page || s.state === "killed") return null;
  const fs = { id: s.id, type: s.type, headline: s.headline, deck: s.deck, facts: s.facts, sector: s.sector, signal_keys: s.signal_keys, domains: s.domains, source_ids: s.source_ids, basis: s.basis, happened_at: s.happened_at, kicker: s.kicker };
  let sheet: ReviewInput["sheet"] = null;
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
  return {
    id: s.id, number: s.number ?? null, type: s.type, basis: s.basis, kicker: page.kicker, headline: page.headline, deck: page.deck ?? null, body: page.body, howWeKnow: page.howWeKnow,
    numbers: page.census ? page.census.lines.map(l => `${l.name}${l.line ? ` · ${l.line}` : ""}`) : page.facts.map(f => f.text),
    picture: lead ? { kind: lead.kind, items: lead.items.map(x => ({ domain: x.domain, credit: x.credit })), caption: lead.caption } : null,
    facts: rf, sheet, domains: s.domains, brands: await brandsFor(s.domains), news, quietEvent, sourceIds: s.source_ids, written: !!s.written,
  };
}

/** The desk's model call on the story writer's gateway path and cost ledger, recorded in desk_calls (only when a call was made). */
export async function deskCall(db: Admin, desk: DeskName, purpose: "review" | "placement" | "fixture", req: { system: string; user: string; schema: Record<string, unknown>; schemaName: string; tool: import("../stories/writer.server").GatewayRequest["tool"]; maxTokens: number },
  parse: (raw: unknown) => unknown | null, storyIds: string[], signal: AbortSignal): Promise<{ parsed: unknown; call_id: number | null; model: string; cost: number } | null> {
  const [{ gatewayCall, providerCanRun }, { AI_MODELS }] = await Promise.all([import("../stories/writer.server"), import("../ai-models")]);
  // The story writer's models: the writer model, or the text model where the provider cannot run it (as the writer falls back).
  const model = providerCanRun(AI_MODELS.writer) ? AI_MODELS.writer : AI_MODELS.text;
  const r = await gatewayCall(db, { model, ...req, textMaxTokens: Math.min(req.maxTokens, 2000) }, signal);
  if (!r) return null;
  const parsed = r.raw != null ? parse(r.raw) : null;
  const { data } = await db.from("desk_calls").insert({ desk, purpose, model, usage_id: r.usage_id ?? null, ok: parsed != null, cost: Math.round(r.cost * 1e6) / 1e6, prompt_version: currentDeskVersion(desk)?.version ?? null, story_ids: storyIds.slice(0, 60),
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
    input: id => reviewInput(id, r),
    lastStandards: async ids => {
      const out = new Map<string, { facts_hash: string; verdict: string; second_reader: string | null; at: string }>();
      if (!ids.length) return out;
      const { data, error } = await db.from("story_reviews").select("story_id,facts_hash,verdict,second_reader,at").eq("desk", "standards").in("story_id", ids).order("id", { ascending: false });
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
      const { applyEdits } = await import("../stories/edits");
      const { data } = await db.from("story_reviews").select("story_id").eq("desk", "editor in chief").eq("verdict", "hold").gte("at", new Date(now() - 3 * 864e5).toISOString()).limit(100);
      const ids = [...new Set((data ?? []).map(x => x.story_id))];
      if (!ids.length) return [];
      const [st, ed] = await Promise.all([db.from("stories").select(COLS).in("id", ids), db.from("story_edits").select("id,story_id,action,payload,note,at").in("story_id", ids).order("id")]);
      if (st.error || ed.error) return [];
      // Still held, by the editor in chief's own hold (its last edit), and not about a day already past the week.
      return (st.data ?? []).map(x => applyEdits(x as unknown as Stored, (ed.data ?? []) as never, now()))
        .filter(x => x.state === "held" && (x.edits.at(-1)?.payload?.["desk"] === "editor in chief") && now() - Date.parse(x.happened_at) < 3 * 864e5).map(x => toPending(x, true));
    },
    record: async rows => {
      if (!rows.length) return;
      const { error } = await db.from("story_reviews").insert(rows.map(toRow) as never);
      if (error) throw new Error(`review_insert_failed: ${error.message.slice(0, 80)}`);
    },
    door: async (actor, body) => {
      const { deskDoor } = await import("../stories/desk.server");
      const res = await deskDoor(actor, body);
      const b = (res.body ?? {}) as { reason?: string; error?: string };
      return { ok: res.status < 300, status: res.status, ...(res.status >= 300 ? { reason: b.reason ?? b.error ?? "refused" } : {}) };
    },
    promptVersion: desk => deskVersionNow(desk),
  };
  return io;
}
const deskVersionNow = (desk: DeskName) => currentDeskVersion(desk)?.version ?? null;

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
