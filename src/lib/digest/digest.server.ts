// Digest + explainer loaders: anonymous SELECT-only reads. E5 · an issue is assembled from the story engine's published stories of one
// closed ISO week as they stand when it is read (pure edition.ts + writer.ts); finished weeks are stored page records the story build
// and the digest writer rewrite, so a page never computes on its first byte unless its record is missing or older than the E5 shape.
import { supabaseAnon } from "../mcp/supabase";
import { DIGEST_FIRST_WEEK } from "../site";
import { issueNumber, weekRange } from "./week";
import { traitModel, type TraitRows } from "./trait";
import type { ThumbRow } from "../thumbs";
import { basis, canonical, explainerPath, label, stageName } from "../labels";
import { traitDefinition } from "./copy";
import { evidenceKeys, tierFor } from "../tiers";
import { readerRunId } from "../real-runs";
import { storedBy } from "../records/store.server";
import { pageKey } from "../records/records";
import { briefEventDomains, closedWeeks, editionParts, fiveRows, weekStories, archiveRows, type Edition, type EditionRows, type EditionStory, type Picture, type RetiredStory } from "./edition";
import { issueOf } from "./writer";
import type { StoredCall } from "../ledger/ledger";
import { withdrewChange } from "./withdrawn";
type Db = ReturnType<typeof supabaseAnon>;
async function pages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 500) {
  const out: T[] = [];
  for (let from = 0; ; from += size) { const { data, error } = await page(from, from + size - 1); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < size) break; }
  return out;
}
const must = <T,>(r: { data: T; error: unknown }) => { if (r.error) throw r.error; return r.data; };

import { everPublished } from "../stories/edits";
type Rec = import("../stories/view").StoryRecord;
const factList = (v: unknown): { text: string; kind: string | null }[] => (Array.isArray(v) ? v.flatMap(f => typeof f === "string" ? [{ text: f, kind: null }] : f && typeof f === "object" && typeof (f as { text?: unknown }).text === "string" ? [{ text: (f as { text: string }).text, kind: typeof (f as { kind?: unknown }).kind === "string" ? (f as { kind: string }).kind : null }] : []) : []);
export const editionStory = (s: Rec): EditionStory & { source_ids: string[] } => ({ id: s.id, number: s.number ?? null, type: s.type, basis: s.basis, score: s.score, happened_at: s.happened_at, created_at: s.created_at,
  kicker: s.kicker, headline: s.headline, deck: s.deck, body: s.written?.body ?? (s.why_line ? [s.why_line] : []), domains: s.domains, sector: s.sector, signal_keys: s.signal_keys, facts: factList(s.facts), source_ids: s.source_ids });
/** A story that ran and was later retired with its change withdrawn (withdrawn.ts), with when the editor retired it. */
// N2: a story reviewed by the desks is stored as held and runs through a restore edit, so "ran" reads the edits too.
export const retiredOf = (s: Rec): RetiredStory | null => (s.state === "killed" && everPublished(s) && withdrewChange(s)
  ? { id: s.id, number: s.number ?? null, domains: s.domains, happened_at: s.happened_at, retired_at: s.edits.filter(e => e.action === "kill").at(-1)?.at ?? null } : null);

async function pictureOf(s: EditionStory & { source_ids: string[] }): Promise<Picture | null> {
  const { evidenceOf } = await import("../stories/page.server");
  const ev = await evidenceOf(s, s.type).catch(() => null);
  if (!ev) return leadPictureOf(s.id);
  if (ev.compare) return { kind: "pair", before: ev.compare.before, after: ev.compare.after };
  if (ev.after) return { kind: "one", crop: ev.after };
  const g = ev.grid?.find(x => x.crop)?.crop;
  return g ? { kind: "one", crop: g } : leadPictureOf(s.id);
}
/** L2 · why Digest No. 1 had no pictures: its three stories were breakouts (signal stories) with no capture of their own change, and the
 *  issue only read captures. They do have a lead picture on their pages (a mosaic of brands' first screens), so the issue carries that. */
async function leadPictureOf(id: string): Promise<Picture | null> {
  const [{ loadStoryLead }, { leadAsPicture }] = await Promise.all([import("../stories/page.server"), import("./edition")]);
  const l = await loadStoryLead(id).catch(() => null);
  return leadAsPicture((l as { lead?: import("../lead-picture").LeadPlan | null } | null)?.lead ?? null);
}
/** The week's live changes split by the integrity rule: confirmed (passed) and seen once (still unconfirmed). */
async function weekCounts(db: Db, startIso: string, endIso: string): Promise<{ confirmed: number; unconfirmed: number }> {
  const events = await pages<{ id: number; domain: string | null; type: string; before: unknown; after: unknown; source: string | null }>((f, t) => db.from("library_event_feed").select("id,domain,type,before,after,source").eq("source", "live").gte("detected_at", startIso).lt("detected_at", endIso).order("id").range(f, t) as never, 1000);
  const [{ latestChecks }, { splitChecked }] = await Promise.all([import("../integrity.server"), import("../integrity")]);
  events.splice(0, events.length, ...(await (await import("../active-sites.server")).panelRowsOnly(events))); // R2a-2 · panel brands only
  const checks = await latestChecks(db, events.map(e => e.id));
  const split = splitChecked(events, checks);
  return { confirmed: split.tape.length, unconfirmed: split.unconfirmed.length };
}
/** Everything one closed week's issue is assembled from, or null when the week is not an issue week. */
export async function editionRows(week: string): Promise<EditionRows | null> {
  const range = weekRange(week);
  if (!range || issueNumber(week) === null) return null;
  const db = supabaseAnon();
  const [{ storyIndex }, { streamOf }] = await Promise.all([import("../stories/read.server"), import("../stories/view")]);
  const all = await storyIndex();
  const stories = streamOf(all).map(editionStory), retired = all.map(retiredOf).filter((x): x is RetiredStory => !!x);
  const rows = fiveRows(weekStories(week, stories));
  const [pictures, series, counts, brands, calls, texts, study, brief] = await Promise.all([
    Promise.all(rows.map(async r => [r.id, await pictureOf(r)] as const)).then(x => Object.fromEntries(x)),
    import("../front/front.server").then(async ({ quarterSeries }) => { const { wellCovered } = await import("../kit"); const keys = new Set(rows.flatMap(r => r.signal_keys));
      return Object.fromEntries((await quarterSeries()).filter(x => keys.has(x.key)).map(x => [x.key, x.quarters.filter(wellCovered).map(p => ({ q: p.q, s: p.s as number, n: p.n }))])); }).catch(() => ({})),
    weekCounts(db, range.startIso, range.endIso),
    db.from("library_sites").select("domain", { count: "exact", head: true }).eq("active", true).lt("added_at", range.endIso),
    pages<StoredCall>((f, t) => db.from("forecast_calls").select("made_at,resolved_at,outcome,trait,stage_at_call,target_quarter").lt("made_at", range.endIso).order("id").range(f, t) as never),
    db.from("digest_texts").select("week,facts_hash,headline,deck,argument,changes,chart_caption,use_text,model,passed,checked_at,created_at").eq("week", week).order("created_at", { ascending: false }).limit(20).then(r => (r.error ? [] : r.data ?? [])),
    import("../data-stories/page.server").then(m => m.storedStudyShelf()).then(x => x?.[0] ? { href: x[0].href, headline: x[0].headline } : null).catch(() => null),
    db.from("weekly_briefs").select("brief").eq("week", week).maybeSingle().then(must),
  ]);
  if (brands.error) throw brands.error;
  const { ledgerSummary, asOf } = await import("../ledger/ledger"), ledger = ledgerSummary(asOf(calls, range.endIso));
  return { week, stories, retired, briefDomains: brief ? briefEventDomains(brief.brief) : null, pictures, series, texts: texts as EditionRows["texts"], study,
    numbers: { brands: brands.count ?? null, ...counts, ledger: { rate: ledger.rate, hits: ledger.hits, resolved: ledger.resolved } } };
}
/** The issue a reader sees for one closed week, or null when that week has no published story. */
export async function computeIssue(week: string | null): Promise<Edition | null> {
  if (!week || !finishedWeek(week)) return null;
  const rows = await editionRows(week);
  return rows ? issueOf(rows)?.edition ?? null : null;
}
/** The writer's view: the issue's parts, sheet and fingerprint (service code only). */
export async function issueJob(week: string) {
  const rows = await editionRows(week);
  const p = rows ? editionParts(rows) : null, r = rows ? issueOf(rows) : null;
  return p && r ? { parts: p, sheet: r.sheet, edition: r.edition } : null;
}
export const ISSUE_V = 5;
const isEdition = (x: unknown): x is Edition => !!x && typeof x === "object" && (x as { v?: unknown }).v === ISSUE_V;
const issueRecord = storedBy((week: string) => pageKey("digest", week), (week: string) => computeIssue(week));
export const finishedWeek = (week: string, now = Date.now()) => { const r = weekRange(week); return !!r && Date.parse(r.endIso) <= now; };
/** The newest closed issue weeks, newest first (records the sweeper keeps). A week with no published story has no issue. */
export async function latestIssueWeeks(n = 4): Promise<string[]> { return closedWeeks(Date.now(), DIGEST_FIRST_WEEK).slice(0, n); }
/** One closed week's issue from its record (a record from before E5 is ignored and the issue computed). */
export async function storedIssue(week: string): Promise<Edition | null> {
  if (!finishedWeek(week)) return null;
  const r = await issueRecord(week).catch(() => null);
  return isEdition(r) ? r : computeIssue(week);
}
/** /digest: the newest closed week that has an issue; /digest/<week>: that week, only once it has closed. */
export async function loadIssue(week: string | null): Promise<Edition | null> {
  if (week) return storedIssue(week);
  for (const w of (await latestIssueWeeks(8))) { const e = await storedIssue(w); if (e) return e; }
  return null;
}
/** /digest/archive: one row per issue, newest first, by its written headline. */
export async function loadArchive(limit = 60) {
  const weeks = await latestIssueWeeks(limit), issues = (await Promise.all(weeks.map(w => storedIssue(w).catch(() => null)))).filter((x): x is Edition => !!x);
  return archiveRows(issues.map(i => ({ week: i.week, number: i.number, dates: i.dates, headline: i.text.headline })));
}
const TCOLS = "dimension,value,scope,status,stage,current_share,momentum,next_wave_score,components,quarters:evidence->quarters,lead_sites:evidence->sites,proj_q1,proj_q1_lo,proj_q1_hi,proj_q2,proj_q2_lo,proj_q2_hi,proj_q4,proj_q4_lo,proj_q4_hi,run_id,computed_at";
export async function traitRows(rawKey: string): Promise<TraitRows | null> {
  const key = canonical(rawKey), i = key.indexOf(":");
  if (i <= 0) return null;
  const dimension = key.slice(0, i), value = key.slice(i + 1);
  const db = supabaseAnon();
  // I1 · Part 0: three round trips instead of seven in a row. First everything that needs only the key (the shared stored inputs
  // name the reader run), then the run's rows, then the lead sites' thumbnails.
  const [{ latestSignals }, { siteTraitIndex }, { storyIndex }, { storiesAbout }] = await Promise.all([import("../signals.server"), import("../read.server"), import("../stories/read.server"), import("../stories/view")]);
  const noSignals = { snap: { run_id: null as number | null }, tiers: new Map(), signals: [] as Awaited<ReturnType<typeof latestSignals>>["signals"] };
  const [sig, sites, calls, index, stories] = await Promise.all([
    latestSignals("all").catch(() => noSignals),
    pages<{ domain: string; sector: string; name: string | null }>((f, t) => db.from("library_sites").select("domain,sector,name").order("domain").range(f, t) as never),
    db.from("forecast_calls").select("*").eq("trait", key).order("made_at", { ascending: false }).order("id", { ascending: false }).limit(24).then(must),
    siteTraitIndex().catch(() => []),
    storyIndex().then(all => storiesAbout(all, { signal: key, limit: 5 })).catch(() => []),
  ]);
  const runId = sig.snap.run_id ?? await readerRunId(db);
  const [rows, peers, card] = await Promise.all([
    db.from("forecasts").select(TCOLS).eq("run_id", runId).eq("dimension", dimension).eq("value", value).order("scope").then(must),
    pages<{ dimension: string; value: string; stage: string | null; current_share: number | null; momentum: number | null }>((f, t) => db.from("forecasts").select("dimension,value,stage,current_share,momentum").eq("run_id", runId).eq("scope", "all").order("dimension").order("value").range(f, t) as never),
    db.from("forecast_runs").select("data_through:model_card->>data_through").eq("id", runId).maybeSingle().then(must),
  ]);
  if (!rows?.length) return null;
  const domains = [...new Set(rows.flatMap(r => (((r as { lead_sites?: { domain: string }[] | null }).lead_sites) ?? []).map(s => s.domain)))].slice(0, 40);
  const thumbs = domains.length ? await db.from("site_thumbs").select("domain,captured_at,viewport,path,width,height,bytes,variants").in("domain", domains).then(must) : [];
  // Tier, Momentum, Confidence and evidence from the latest stored run (same pure code as the terminal).
  const { tiers, signals } = sig;
  const byKey = new Map(signals.map(s => [s.key, s]));
  const evidence = evidenceKeys(key).map(k => { const l = label(k), x = byKey.get(k); return { key: k, name: l.name, dimension: l.dimension, basis: basis(k), tier: tierFor(tiers, k), stage: x?.stage ?? null, share: x?.share ?? null, href: explainerPath(k) }; });
  // Brands showing it now and recent stories naming it (shared Read-mode caches; never fail the page).
  const showing = index.filter(s => s.traits.includes(key)).sort((a, b) => (b.captured ?? "").localeCompare(a.captured ?? "") || a.domain.localeCompare(b.domain)).map(s => ({ domain: s.domain, name: s.name, sector: s.sector }));
  return { key, showing, stories, signal: byKey.get(key) ?? null, tier: tiers.get(key) ?? null, evidence, headline: tiers.size ? [...tiers.values()].filter(t => t.tier === "headline").map(t => t.key) : null, rows: rows as unknown as TraitRows["rows"], peers, sites, thumbs: (thumbs ?? []) as ThumbRow[], data_through: (card as { data_through: string | null } | null)?.data_through ?? null, calls: (calls ?? []) as unknown as StoredCall[] };
}
export async function loadTrait(key: string) { const rows = await traitRows(key); return rows ? traitModel(rows) : null; }
/** P1, critical for /signals/<key>: what the head and the title need, from the stored signals snapshot alone (the same reader run
 * as the full page), or null when the run has no all-sector row for the key (404). Examples, peers, calls and stories are deferred. */
export async function loadTraitHead(rawKey: string) {
  const key = canonical(rawKey), i = key.indexOf(":");
  if (i <= 0) return null;
  const { latestSignals } = await import("../signals.server");
  const { snap, tiers } = await latestSignals("all");
  const all = snap.rows.find(r => r.scope === "all" && r.dimension === key.slice(0, i) && r.value === key.slice(i + 1));
  if (!all) return null;
  const l = label(key);
  return { key, name: l.name, dimension: l.dimension, basis: basis(key), stage: stageName(all.stage), tier: tiers.get(key)?.tier ?? null, share: all.current_share, momentum: all.momentum, definition: traitDefinition(key) };
}
