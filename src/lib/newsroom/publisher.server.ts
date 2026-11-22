// N5 · the publisher's I/O: load the newest published Digest issue, fetch what the package check needs, store one row per check run
// (a failure files a `bug` queue item through the door), make the week's drafts call only after a passing check, and store drafts,
// owner statuses and audience weeks. Rules are pure in publisher.ts. There is no posting code here and none may be added.
import type { Admin } from "./review.server";
import * as p from "./publisher";
import { SITE_URL } from "../site";

const FETCH_MS = 8_000, CONCURRENCY = 6;
async function get(url: string, o: { body?: boolean; signal?: AbortSignal | undefined } = {}): Promise<p.Fetched & { redirected: boolean; final: string }> {
  try {
    const r = await fetch(url, { redirect: "follow", signal: o.signal ? AbortSignal.any([o.signal, AbortSignal.timeout(FETCH_MS)]) : AbortSignal.timeout(FETCH_MS), headers: { "user-agent": "slug-publisher/1 (package check)" } });
    const buf = new Uint8Array(await r.arrayBuffer());
    return { status: r.status, type: r.headers.get("content-type"), bytes: buf.byteLength, ...(o.body ? { body: new TextDecoder().decode(buf) } : {}), redirected: r.redirected, final: r.url };
  } catch { return { status: 0, type: null, bytes: 0, redirected: false, final: url }; }
}
async function pooled<T, R>(xs: readonly T[], f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(xs.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, xs.length) }, async () => { while (i < xs.length) { const k = i++; out[k] = await f(xs[k]!); } }));
  return out;
}
export type PackageRun = { row: number | null; week: string | null; number: number | null; pass: boolean; items: p.PackageItem[]; queue: number | null; redirects: number; why: string };
/** The package check on the newest published Digest issue (or a named week). `base` is the site to fetch (the live site by default).
 *  `test` stores the row as a test and files nothing. */
export async function runPackageCheck(db: Admin, o: { week?: string; base?: string; test?: boolean; now?: number; signal?: AbortSignal } = {}): Promise<PackageRun> {
  const now = o.now ?? Date.now(), base = (o.base ?? SITE_URL).replace(/\/$/, "");
  const [{ loadIssue, finishedWeek }, { storyRaw }, { morningArchive }] = await Promise.all([import("../digest/digest.server"), import("../stories/read.server"), import("../editions/morning")]);
  const e = await loadIssue(o.week ?? null);
  if (!e) return { row: null, week: o.week ?? null, number: null, pass: false, items: [], queue: null, redirects: 0, why: "no published Digest issue" };
  const links = p.issueLinks({ week: e.week, cover: e.cover, rows: e.rows, chart: e.chart ? { storyId: e.chart.storyId, number: e.chart.number } : null, numbers: e.numbers, corrections: e.corrections, keep: e.keep });
  const coverHref = e.cover.number != null ? `/stories/no/${e.cover.number}` : `/stories/${encodeURIComponent(e.cover.id)}`;
  const morningNewest = morningArchive(await storyRaw(), now).find(x => x.final)?.day ?? null;
  const [share, digestRss, morningRss, checked] = await Promise.all([
    get(`${base}/digest/${e.week}.png`, { signal: o.signal }), get(`${base}/digest/rss.xml`, { body: true, signal: o.signal }), get(`${base}/morning/rss.xml`, { body: true, signal: o.signal }),
    pooled(links, async path => { const r = await get(`${base}${path}`, { signal: o.signal }); return { path, status: r.status, redirected: r.redirected, final: r.final }; }),
  ]);
  const cover = checked.find(l => l.path === coverHref) ?? null;
  const items = p.packageChecks({
    now, closed: finishedWeek(e.week, now),
    issue: { week: e.week, number: e.number, words: e.words, rows: e.rows.map(r => ({ href: r.href, picture: !!r.picture })), chart: e.chart ? { href: e.chart.number != null ? `/stories/no/${e.chart.number}` : `/stories/${encodeURIComponent(e.chart.storyId)}` } : null, cover: { id: e.cover.id, href: coverHref, subject: e.cover.subject }, links },
    share, cover: cover ? { status: cover.status } : null, digestRss, morningRss, morningNewest,
    links: checked.map(l => ({ path: l.path, status: l.status === 200 && new URL(l.final).origin === new URL(base).origin ? 200 : l.status === 200 ? 0 : l.status })),
  });
  const pass = p.packagePassed(items), redirects = checked.filter(l => l.redirected).length;
  const { data, error } = await db.from("package_checks").insert({ week: e.week, issue: e.number, pass, checks: items as never, test: o.test ?? false }).select("id").single();
  if (error) throw new Error("package_insert_failed");
  let queue: number | null = null;
  if (!pass && !o.test) {
    const { deskDoor } = await import("../stories/desk.server");
    const r = await deskDoor("publisher", { action: "queue_add", title: p.packageBugTitle(e.week, items), why: p.packageBugWhy(items), kind: "bug", expects: "no visible change", key: `package:${e.week}` });
    queue = ((r.body as { item?: number }).item) ?? null;
  }
  return { row: data.id, week: e.week, number: e.number, pass, items, queue, redirects, why: pass ? "passed" : `${items.filter(x => !x.ok).length} failed` };
}

/** The drafts sheet: the issue's own words and numbers, and up to three of the week's stories the editor in chief led with. */
export async function draftSheet(db: Admin, week: string): Promise<p.DraftSheet | null> {
  const [{ loadIssue }, { weekRange }] = await Promise.all([import("../digest/digest.server"), import("../digest/week")]);
  const e = await loadIssue(week), r = weekRange(week);
  if (!e || !r) return null;
  const digest: p.DraftSheet["digest"] = { kind: "digest", link: p.digestLink(week), headline: e.text.headline, deck: e.text.deck,
    facts: [e.text.headline, e.text.deck, ...e.text.argument, ...e.rows.map(x => `${x.headline}. ${x.sentence}`), ...e.numbers.map(n => n.text), ...(e.chart?.caption ? [e.chart.caption] : [])] };
  const { data: leads } = await db.from("story_reviews").select("story_id,at,verdict,placement,basis").eq("desk", "editor in chief").eq("basis", "desk").or("verdict.eq.lead,placement.eq.1").gte("at", r.startIso).lt("at", r.endIso).order("at", { ascending: false }).limit(40);
  const ids = [...new Set((leads ?? []).map(x => x.story_id))];
  const stories: p.DraftSheet["stories"] = [];
  if (ids.length) {
    const idx = await (await import("../stories/read.server")).storyIndex();
    for (const id of ids) {
      const x = idx.find(r => r.id === id); if (!x || x.state !== "published" || x.number == null) continue;
      const w = x.written ?? null, facts = Array.isArray(x.facts) ? (x.facts as unknown[]).flatMap(f => (f && typeof f === "object" && typeof (f as { text?: unknown }).text === "string" ? [String((f as { text: string }).text)] : [])) : [];
      const headline = w?.headline ?? x.headline, deck = w?.deck ?? x.deck ?? null;
      stories.push({ kind: "story", id, number: x.number, link: p.storyLink(x.number), headline, deck, facts: [headline, ...(deck ? [deck] : []), ...(w?.body ?? []), ...facts] });
      if (stories.length >= p.STORY_DRAFTS) break;
    }
  }
  return { week, digest, stories };
}
export type DraftsRun = { ran: boolean; why: string; call_id: number | null; kept: (p.KeptDraft & { id: number })[]; dropped: p.DroppedDraft[]; cost: number };
/** The week's drafts call, only after a passing package check for that issue. `fixture` records the call as a fixture and stores no
 *  drafts (the proof). */
export async function runDrafts(db: Admin, o: { week: string; checkId: number; fixture?: boolean; signal?: AbortSignal; /** proof only, with fixture: run on a failed check */ anyCheck?: boolean }): Promise<DraftsRun> {
  const out: DraftsRun = { ran: false, why: "", call_id: null, kept: [], dropped: [], cost: 0 };
  const { data: chk } = await db.from("package_checks").select("id,week,pass").eq("id", o.checkId).maybeSingle();
  if (!chk || chk.week !== o.week || (!chk.pass && !(o.fixture && o.anyCheck))) { out.why = "no passing package check for this issue"; return out; }
  const sheet = await draftSheet(db, o.week); if (!sheet) { out.why = "no issue"; return out; }
  const { weeklyCall } = await import("./weekly-call.server");
  const c = await weeklyCall(db, "publisher", o.fixture ? "fixture" : "drafts", o.week, { system: p.PUBLISHER_SYSTEM, user: p.publisherUser(sheet), schema: p.PUBLISHER_SCHEMA as unknown as Record<string, unknown>, schemaName: "social_drafts", tool: p.PUBLISHER_TOOL, maxTokens: 1500 }, p.parseDrafts, o.signal ?? AbortSignal.timeout(40_000), "publisher");
  if ("refused" in c) { out.why = c.refused; return out; }
  out.ran = true; out.call_id = c.call_id; out.cost = c.cost;
  if (!c.parsed) { out.why = "call failed: not the fixed structure"; return out; }
  const e = p.enforceDrafts(c.parsed as p.DraftAnswer, sheet);
  out.dropped = e.dropped;
  if (o.fixture) { out.kept = e.kept.map((k, i) => ({ ...k, id: -(i + 1) })); out.why = `${e.kept.length} kept, ${e.dropped.length} dropped (fixture: nothing stored)`; return out; }
  for (const k of e.kept) {
    const { data, error } = await db.from("social_drafts").insert({ week: o.week, check_id: o.checkId, call_id: c.call_id, target: k.target, story_id: k.story_id, body: k.body, link: k.link }).select("id").single();
    if (!error && data) out.kept.push({ ...k, id: data.id });
  }
  out.why = `${out.kept.length} kept, ${e.dropped.length} dropped`;
  return out;
}

export async function insertDraftStatus(db: Admin, r: { draft: number; status: string; reason: string | null }): Promise<{ status: string } | { refused: string } | null> {
  const [{ data: d }, { data: st }] = await Promise.all([db.from("social_drafts").select("id,test").eq("id", r.draft).maybeSingle(), db.from("social_draft_statuses").select("status").eq("draft_id", r.draft).order("id")]);
  if (!d) return null;
  const why = p.draftMoveProblem(p.draftStatusOf(st ?? []), r.status as p.DraftStatus);
  if (why) return { refused: why };
  const { error } = await db.from("social_draft_statuses").insert({ draft_id: r.draft, status: r.status, actor: "owner", reason: r.reason });
  if (error) throw new Error("draft_status_insert_failed");
  return { status: r.status };
}
export async function insertAudience(db: Admin, r: p.AudienceInput & { actor: string }): Promise<{ id: number; replaces: number | null }> {
  const { data: prior } = await db.from("audience_weeks").select("id").eq("week", r.week).eq("test", r.test).order("id", { ascending: false }).limit(1);
  const { data, error } = await db.from("audience_weeks").insert({ week: r.week, visitors: r.visitors, pageviews: r.pageviews, top: r.top as never, sources: r.sources as never, actor: r.actor === "owner" ? "owner" : "publisher", test: r.test }).select("id").single();
  if (error || !data) throw new Error("audience_insert_failed");
  return { id: data.id, replaces: prior?.[0]?.id ?? null };
}

/** The /desk Publisher panel and the memory: the newest package check, this week's drafts with status, the audience numbers against the
 *  week before and the five most-read stories, the calls used. */
export async function publisherPanel(db: Admin, now = Date.now()) {
  const { isoWeek } = await import("../digest/week");
  const [{ data: checks }, { data: drafts }, { data: aud }, { data: calls }] = await Promise.all([
    db.from("package_checks").select("id,at,week,issue,pass,checks,test").order("id", { ascending: false }).limit(4),
    db.from("social_drafts").select("id,at,week,target,story_id,body,link,test").order("id", { ascending: false }).limit(24),
    db.from("audience_weeks").select("id,at,week,visitors,pageviews,top,sources,test").order("id", { ascending: false }).limit(40),
    db.from("desk_calls_weekly").select("id,at,purpose,ok,cost").eq("desk", "publisher").gte("at", new Date(now - 7 * 864e5).toISOString()),
  ]);
  const ids = (drafts ?? []).map(d => d.id);
  const { data: st } = ids.length ? await db.from("social_draft_statuses").select("draft_id,status,at,reason").in("draft_id", ids).order("id") : { data: [] };
  const check = (checks ?? []).find(c => !c.test) ?? checks?.[0] ?? null;
  const week = check?.week ?? isoWeek(new Date(now - 7 * 864e5));
  const rows = (aud ?? []) as unknown as p.AudienceRow[], cur = p.audienceFor(rows, week), prev = p.audienceFor(rows, p.weekBefore(week));
  const stories = (cur?.top ?? []).filter(t => t.path.startsWith("/stories/")).sort((a, b) => b.views - a.views).slice(0, 5);
  const today = new Date(now); today.setUTCHours(0, 0, 0, 0);
  return {
    check: check ? { id: check.id, at: check.at, week: check.week, issue: check.issue, pass: check.pass, test: check.test, items: check.checks as unknown as p.PackageItem[] } : null,
    drafts: (drafts ?? []).filter(d => d.week === week || !check).map(d => ({ ...d, status: p.draftStatusOf((st ?? []).filter(s => s.draft_id === d.id)) })),
    audience: { week, current: cur, previous: prev, stories },
    calls: { today: (calls ?? []).filter(c => c.purpose === "drafts" && c.at >= today.toISOString()).length, week: (calls ?? []).filter(c => c.purpose === "drafts").length, fixtures_week: (calls ?? []).filter(c => c.purpose === "fixture").length, cap: 2, usd_week: Math.round((calls ?? []).reduce((s, c) => s + Number(c.cost ?? 0), 0) * 1e4) / 1e4 },
  };
}
