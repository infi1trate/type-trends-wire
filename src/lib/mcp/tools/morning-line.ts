import { defineTool } from "@lovable.dev/mcp-js";
import { ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { json, READ } from "./shared";

export default defineTool({ name: "morning_line", title: "The Morning Line", description: "The daily edition for one UTC day (today by default): the lead story, up to five more ranked by score with their one-line why, Moving now under the run-gap rule, the opening (best white-space story of the week not used in the last three editions), the figure and what the desk held. Finished days never change.",
  inputSchema: { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("UTC day, YYYY-MM-DD. Defaults to today.") }, annotations: READ,
  handler: async ({ date }) => {
    const [{ loadMorning }, { SITE_URL }, { MORNING_FIRST_DAY }] = await Promise.all([import("@/lib/editions/editions.server"), import("@/lib/site"), import("@/lib/editions/morning")]);
    const m = await loadMorning(date ?? null);
    if (!m) throw new ToolError(`No edition for ${date}. Editions run from ${MORNING_FIRST_DAY} to today (UTC).`);
    const e = m.edition, abs = (p: string) => `${SITE_URL}${p}`;
    const it = (x: NonNullable<typeof e.lead>) => ({ id: x.id, type: x.type, kicker: x.kicker, headline: x.headline, deck: x.deck, happened_at: x.at, sector: x.sector, score: x.score, why: x.why, url: abs(x.href) });
    return json({
      day: e.day, title: e.title, final: e.final, as_of: e.as_of, window: e.window, url: abs(e.href), rss: abs("/morning/rss.xml"),
      count: e.count, thin: e.thin, lead: e.lead ? it(e.lead) : null, more: e.more.map(it),
      moving_now: { comparison: e.moving.pair ? { latest_run: e.moving.pair.latest.id, earlier_run: e.moving.pair.earlier.id, days: e.moving.pair.days } : null, changes: e.moving.items.map(x => ({ ...x, url: abs(`/signals/${encodeURIComponent(x.key)}`) })) },
      opening: e.opening ? it(e.opening) : null,
      figure: e.figure ? (e.figure.kind === "chart" ? { kind: "chart", week: e.figure.week, trait: e.figure.trait, url: abs(e.figure.href), image: abs(`/chart/${e.figure.week}.png`) } : { kind: "signal", key: e.figure.key, url: abs(e.figure.href) }) : null,
      on_the_desk: e.desk.map(d => ({ id: d.id, headline: d.headline, score: d.score, held_because: d.reason, url: abs(d.href) })),
      last_full_edition: e.lastFull ? { day: e.lastFull.day, url: abs(e.lastFull.href), lead: it(e.lastFull.lead) } : null,
      archive: m.archive.slice(0, 14).map(a => ({ day: a.day, count: a.count, lead: a.lead, final: a.final, url: abs(a.href) })),
      receipts: { source: "Stored stories with the editor's edits as of the edition's cut; no AI per request", method: "trend://methodology#STORIES" },
    });
  } });
