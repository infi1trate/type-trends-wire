// N2 · the copy desk's weekly sweep, run after a story build when time is left: every published story page and live study, linted with
// the copy desk's rules; each page with failing lines is recorded through the door as `copy desk`, then one closing summary for the
// week. It fixes nothing. Resumes in a later build when time runs out (pages already recorded this week are skipped).
import { storyLines, studyLines, sweepPage, type PageLints } from "./sweep";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
const WEEK_PAGE = "(week)";

export async function runCopySweep(db: Admin, deadline: number, now: () => number = Date.now): Promise<{ swept: number; failing: number; done: boolean } | null> {
  const [{ etWeekStart }, { deskDoor }] = await Promise.all([import("./spend"), import("../stories/desk.server")]);
  const since = etWeekStart(now());
  const { data: logged, error } = await db.from("desk_log").select("subject_id").eq("actor", "copy desk").eq("action", "copy_sweep").eq("decision", "done").gte("at", since).limit(500);
  if (error) return null;
  const seen = new Set((logged ?? []).map(r => r.subject_id));
  if (seen.has(WEEK_PAGE)) return { swept: 0, failing: 0, done: true };
  const [{ storyById }, { loadStoryLead }, { loadDataStory }, { liveNow }, { dataInput }] = await Promise.all([import("../stories/read.server"), import("../stories/page.server"), import("../data-stories/page.server"), import("../data-stories/build"), import("../data-stories/data.server")]);
  const { data: rows } = await db.from("stories").select("id").eq("status", "published").order("happened_at", { ascending: false }).limit(400);
  const pages: { page: string; load: () => Promise<PageLints | null> }[] = (rows ?? []).map(r => ({ page: `/stories/${r.id}`, load: async () => {
    const s = await storyById(r.id).catch(() => null); if (!s || s.state !== "published") return null;
    const p = await loadStoryLead(r.id).catch(() => null); return p ? sweepPage(`/stories/${r.id}`, "story", storyLines(p as never)) : null;
  } }));
  const live = await dataInput().then(liveNow).catch(() => []);
  for (const e of live) pages.push({ page: `/data/${e.slug}`, load: async () => { const p = await loadDataStory(e.slug).catch(() => null); return p?.kind === "live" ? sweepPage(`/data/${e.slug}`, "study", studyLines(p.story)) : null; } });
  let swept = 0, failing = 0;
  for (const p of pages) {
    if (now() > deadline) return { swept, failing, done: false };
    if (seen.has(p.page)) { failing++; continue; }
    const r = await p.load(); if (!r) continue; swept++;
    if (!r.fails.length) continue;
    failing++;
    await deskDoor("copy desk", { action: "copy_sweep", page: r.page, kind: r.kind, summary: `${r.fails.length} ${r.fails.length === 1 ? "line fails" : "lines fail"} the copy lints on ${r.page}`.slice(0, 300),
      lines: r.fails.slice(0, 15).map(f => ({ lint: f.id, line: f.line.slice(0, 200), where: f.where.slice(0, 80) })) }).catch(() => null);
  }
  await deskDoor("copy desk", { action: "copy_sweep", page: WEEK_PAGE, kind: "week", lines: [], summary: `Swept ${swept} pages this week; ${failing} with lines that fail the copy lints.` }).catch(() => null);
  return { swept, failing, done: true };
}
