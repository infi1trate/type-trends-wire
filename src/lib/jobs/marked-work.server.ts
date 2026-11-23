// D1 Part 2 · the follow-up worker's first step: what crawler posts marked out of date (marks.ts), done from the newest state, oldest
// mark first, inside its share of the pass. A step that fails leaves its mark open for the next pass. Service role only; never throws.
import { domainOf, markPlan, type Mark } from "./marks";

export type MarkedDeps = {
  open: () => Promise<Mark[]>;
  clear: (m: Mark) => Promise<void>;
  aggregates: () => Promise<void>;
  replay: (domain: string) => Promise<unknown>;
  now?: () => number;
};
const DEPS: MarkedDeps = {
  open: async () => (await import("./marks.server")).openMarks(),
  clear: async m => (await import("./marks.server")).clearMark(m),
  aggregates: async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("refresh_crawl_aggregates");
    if (error) throw new Error("crawl summaries refresh failed");
  },
  replay: async d => (await import("../library-archive.server")).replayArchive(d),
};
export type MarkedResult = { note: string; force: Mark | null; left: number; errors: number };

export async function runMarkedWork(deadline: number, deps: Partial<MarkedDeps> = {}): Promise<MarkedResult> {
  const d = { ...DEPS, ...deps }, now = d.now ?? Date.now, parts: string[] = [];
  let errors = 0, left = 0;
  try {
    const plan = markPlan(await d.open());
    if (plan.aggregates) {
      try { await d.aggregates(); await d.clear(plan.aggregates); parts.push("crawl summaries"); }
      catch { errors++; parts.push("crawl summaries failed (next pass)"); }
    }
    let replayed = 0;
    for (const m of plan.archives) {
      if (deadline - now() < 1_500) break;
      try { await d.replay(domainOf(m)); await d.clear(m); replayed++; } catch { errors++; }
    }
    left = plan.archives.length - replayed;
    if (plan.archives.length) parts.push(`archive replays ${replayed}${left ? `, ${left} next pass` : ""}`);
    if (plan.force) parts.push("forced sweep");
    return { note: parts.join(", ") || "nothing marked", force: plan.force, left, errors };
  } catch { return { note: "marks unreadable", force: null, left, errors: errors + 1 }; }
}
