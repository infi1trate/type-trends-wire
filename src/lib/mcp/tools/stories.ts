import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { librarySector } from "@/lib/library-payload";
import { STORY_KINDS } from "@/lib/stories/types";
import { json, READ } from "./shared";
import { BRAND_NAME } from "../../brand";

export const STORIES_TOOL_MAX = 50;
export default defineTool({ name: "stories", title: "Stories", description: `Published ${BRAND_NAME} stories, newest first: what the product judged newsworthy from its own data (brand moves, rebrands, stage shifts, breakouts, first sightings, crossovers, counter-moves, white space, roundups, news naming a tracked brand). Each story has a type, headline, deck, facts with receipts (basis measured or ai), an optional why-it-matters line (basis ai, validated against the facts) or the deterministic so-what (basis measured), the newsworthiness score with its four components, and urls. Signals in signal_keys keep their stable key and add a plain-English label.`,
  inputSchema: {
    type: z.enum(STORY_KINDS).optional().describe("Only this story type."),
    sector: librarySector.optional(), signal: z.string().min(3).max(120).optional().describe("Trait key, e.g. headline:serif."),
    domain: z.string().min(3).max(253).optional().describe("A tracked brand's domain."),
    since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("ISO date; only stories that happened on or after it."),
    limit: z.number().int().min(1).max(STORIES_TOOL_MAX).default(20),
  }, annotations: READ,
  handler: async ({ type, sector, signal, domain, since, limit }) => {
    const [{ storyIndex }, { streamOf, storyPath, soWhatOf, isKind }, { SITE_URL }, { canonical }] = await Promise.all([import("@/lib/stories/read.server"), import("@/lib/stories/view"), import("@/lib/site"), import("@/lib/labels")]);
    const key = signal ? canonical(signal) : null, d = domain?.toLowerCase() ?? null;
    const rows = streamOf(await storyIndex()).filter(s => s.type !== "launch" && (!type || s.type === type) && (!sector || s.sector === sector) && (!key || s.signal_keys.includes(key)) && (!d || s.domains.includes(d)) && (!since || s.happened_at >= `${since}T00:00:00Z`));
    return json({ matched: rows.length, stories: rows.slice(0, limit).map(s => ({
      id: s.id, type: s.type, kicker: s.kicker, headline: s.headline, deck: s.deck, happened_at: s.happened_at, sector: s.sector, corrected_at: s.correctedAt,
      facts: s.facts, why_it_matters: s.why_line ? { text: s.why_line, basis: "ai", model: s.why_model, written_at: s.why_at } : { text: soWhatOf({ type: isKind(s.type) ? s.type : "news", signalKeys: s.signal_keys }), basis: "measured" },
      score: s.score, components: s.components, why_ran: s.why_ran, signal_keys: s.signal_keys, domains: s.domains,
      url: `${SITE_URL}${storyPath(s.id)}`, brand_urls: s.domains.map(x => `${SITE_URL}/brands/${encodeURIComponent(x)}`), signal_urls: s.signal_keys.map(k => `${SITE_URL}/signals/${encodeURIComponent(k)}`),
    })), receipts: { source: `${BRAND_NAME} story engine (stored stories with the editor's edits applied)`, method: "trend://methodology#STORIES" } });
  } });
