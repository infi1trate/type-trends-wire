// N3 · /desk's News, Graphics and Data panels and the matching memory facts: today's picks and drops, pictures the graphics desk
// changed, stories with no usable picture, share-image failures, open findings by kind, the backtest score and this week's proposals,
// each desk's calls against its limits. Reads only (service role, behind the editor key).
import type { Admin } from "./review.server";
import { DESK_LIMITS } from "./caps";

const dayStart = (now: number) => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
/** desk_log rows written as tests while building the desks (marked by an appended `test_mark` row; never edited or deleted). */
export async function testRefs(db: Admin): Promise<string[]> {
  const { data } = await db.from("desk_log").select("subject_id").eq("action", "test_mark").limit(200);
  return (data ?? []).flatMap(x => (x.subject_id ? [x.subject_id] : []));
}
export async function n3Panels(db: Admin, now = Date.now()) {
  const today = dayStart(now), week = new Date(now - 7 * 864e5).toISOString();
  const [calls, picks, drops, pictures, share, backtests, proposals, pitches, findings, tests] = await Promise.all([
    db.from("desk_calls").select("desk,purpose").gte("at", today).neq("purpose", "fixture").limit(500),
    db.from("wire_picks").select("id,at,item_id,subject,line,domain,actor").gte("at", today).order("at", { ascending: false }).limit(20),
    db.from("wire_pick_drops").select("id,at,pick_id,actor,reason").gte("at", week).order("at", { ascending: false }).limit(20),
    db.from("picture_choices").select("id,at,story_id,actor,kind,verdict,reason").gte("at", week).order("id", { ascending: false }).limit(60),
    db.from("share_checks").select("at,checked,rebuilt,failures").order("id", { ascending: false }).limit(1),
    db.from("forecast_backtests").select("at,run_id,scored_run_id,days,calls,right_calls,mean_miss").order("id", { ascending: false }).limit(8),
    db.from("desk_log").select("at,action,reason,subject_id").eq("actor", "data").in("action", ["propose", "pitch"]).gte("at", week).order("at", { ascending: false }).limit(10),
    db.from("desk_log").select("at,reason").eq("actor", "news").eq("action", "pitch").gte("at", week).order("at", { ascending: false }).limit(10),
    (await import("./datadesk.server")).openFindings(db).catch(() => []),
    testRefs(db).catch(() => []),
  ]);
  const used = new Map<string, number>(); for (const c of calls.data ?? []) used.set(`${c.desk}|${c.purpose}`, (used.get(`${c.desk}|${c.purpose}`) ?? 0) + 1);
  const limits = DESK_LIMITS.filter(l => l.desk === "news" || l.desk === "graphics" || l.desk === "data").map(l => ({ desk: l.desk, what: l.what, cap: l.cap, used: used.get(`${l.desk}|${l.purpose}`) ?? 0 }));
  const items = (picks.data ?? []).map(p => p.item_id);
  const { data: wi } = items.length ? await db.from("wire_items").select("id,title,url,source").in("id", items) : { data: [] };
  const byItem = new Map((wi ?? []).map(w => [w.id, w]));
  const dropped = new Map((drops.data ?? []).map(d => [d.pick_id, d]));
  const storyIds = [...new Set((pictures.data ?? []).map(p => p.story_id))];
  const { data: heads } = storyIds.length ? await db.from("stories").select("id,headline").in("id", storyIds) : { data: [] };
  const head = new Map((heads ?? []).map(h => [h.id, h]));
  const pics = (pictures.data ?? []).map(p => ({ ...p, headline: head.get(p.story_id)?.headline ?? p.story_id, number: null as number | null }));
  const byKind: Record<string, number> = {}; for (const f of findings) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
  const bt = backtests.data ?? [];
  return {
    limits,
    news: { picks: (picks.data ?? []).map(p => ({ ...p, title: byItem.get(p.item_id)?.title ?? "", url: byItem.get(p.item_id)?.url ?? "", outlet: byItem.get(p.item_id)?.source ?? "", dropped: dropped.get(p.id)?.reason ?? null })), drops: drops.data ?? [], pitches: pitches.data ?? [] },
    graphics: { changed: pics.filter(p => p.verdict === "alternate" || (p.actor !== "graphics" && p.kind !== "rule")), none: pics.filter(p => p.kind === "none"), fallbacks: pics.filter(p => p.verdict === "fallback").length, kept: pics.filter(p => p.verdict === "keep").length, share: share.data?.[0] ?? null },
    data: { byKind, newest: findings.slice(0, 10).map(f => ({ id: f.id, at: f.at, kind: f.kind, subject: f.subject, text: [f.measure, f.expected ? `expected ${f.expected}` : null, f.found ? `found ${f.found}` : null].filter(Boolean).join(" · ") })), open: findings.length, backtest: bt[0] ? { ...bt[0], line: `${bt[0].right_calls} of ${bt[0].calls} calls right on forecast run ${bt[0].scored_run_id} (${Math.round(Number(bt[0].days))} days), mean miss ${bt[0].mean_miss == null ? "–" : Number(bt[0].mean_miss).toFixed(2)} points` } : null, running: bt.length ? { calls: bt.reduce((s, b) => s + b.calls, 0), right: bt.reduce((s, b) => s + b.right_calls, 0) } : null, proposals: proposals.data ?? [] },
    tests,
  };
}
