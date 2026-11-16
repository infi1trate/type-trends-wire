import { defineTool } from "@lovable.dev/mcp-js";
import { ToolError } from "@lovable.dev/mcp-js";
import { json, READ } from "./shared";
import { librarySector } from "@/lib/library-payload";

export default defineTool({ name: "sector_report", title: "State of a sector", description: "The quarterly report for one sector, built from stored data: headline signals with stage and share against all sectors (Momentum is all-sector only and reported once as momentum_all_sectors), what is rising only here (and the reverse), white space, counter-moves, leading brands with their latest move, pattern examples and the quarter's stories. No AI text.",
  inputSchema: { sector: librarySector.describe("Library sector key, e.g. fintech.") }, annotations: READ,
  handler: async ({ sector }) => {
    const [{ loadSectorReport }, { SITE_URL }] = await Promise.all([import("@/lib/editions/editions.server"), import("@/lib/site")]);
    const r = await loadSectorReport(sector);
    if (!r) throw new ToolError(`Unknown sector ${sector}.`);
    const abs = (p: string) => `${SITE_URL}${p}`;
    const story = (s: { id: string; type: string; kicker: string; headline: string; at: string; score: number; href: string }) => ({ id: s.id, type: s.type, kicker: s.kicker, headline: s.headline, happened_at: s.at, score: s.score, url: abs(s.href) });
    return json({
      sector: r.sector, title: r.title, quarter: r.quarter.label, as_of: r.as_of, url: abs(r.href), brands_tracked: r.brands, coverage: r.coverage, note: r.note,
      signals: r.signals.map(s => ({ key: s.key, dimension: s.dimension, basis: s.basis, here: s.here, all_sectors: s.all, momentum_all_sectors: s.momentum_all, url: abs(s.href) })),
      rising_here_not_elsewhere: r.contrast.risingHere.map(s => ({ key: s.key, here: s.here, all_sectors: s.all, url: abs(s.href) })),
      rising_elsewhere_not_here: r.contrast.risingElsewhere.map(s => ({ key: s.key, here: s.here, all_sectors: s.all, url: abs(s.href) })),
      white_space: r.whiteSpace.map(story), counter_moves: r.counterMoves.map(story),
      leaders: r.leaders.map(l => ({ domain: l.domain, name: l.name, trendsetter_rank: l.rank, url: abs(l.href), latest_move: l.latest ? { headline: l.latest.headline, happened_at: l.latest.at, url: abs(l.latest.href) } : null })),
      patterns: r.patterns.map(p => ({ key: p.key, examples: p.examples, with_captures: p.withCaptures, url: abs(p.href), sample: p.sample.map(x => ({ domain: x.domain, url: abs(x.href), crop: x.crop ? { url: abs(x.crop.src), captured_at: x.crop.captured_at, section: x.crop.section } : null })) })),
      stories: r.stories.map(story), stories_in_quarter: r.storiesInQuarter,
      basis: r.basis,
      receipts: { source: "Reader forecast run, stored stories and trendsetter ranks; no AI text", method: "trend://methodology#FORECAST" },
    });
  } });
