/** Methodology sections with stable anchors (`m-<slug>`), built from the same text the MCP methodology resource serves. Pure. */
import { METHODOLOGY } from "./mcp/analysis";
import { METHODOLOGY as BAND_RULES } from "./bands";

export type MethodSection = { id: string; title: string; lines: string[] };
const slug = (t: string) => t.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const CRAWLER_NOTES = [
  "Mainstream: Chrome UX Report top origins. Vanguard: curated design-forward studios and startups plus Show HN launches. Language comparisons default to English; ALL includes every language. Shares use all successful sites within the selected language scope.",
  "Desktop homepage first viewport, 1440×900. Robots.txt respected; adult and gambling sites filtered. Rendered fonts measured via Chromium. Derived data only; the crawl itself stores no screenshots (Digest thumbnails are separate small crops, see Thumbnails). Weekly Sunday 03:23 UTC.",
];

export function methodologySections(): MethodSection[] {
  const out: MethodSection[] = [], by = new Map<string, MethodSection>();
  const push = (title: string, line: string) => {
    const id = `m-${slug(title)}`;
    let s = by.get(id);
    if (!s) { s = { id, title: title.toUpperCase(), lines: [] }; by.set(id, s); out.push(s); }
    s.lines.push(line);
  };
  for (const line of METHODOLOGY.split("\n")) {
    if (BAND_RULES.includes(line) && !line.startsWith("FORECAST") || line.startsWith("BASELINE also")) { push("Type bands", line); continue; }
    const m = /^([A-Za-z][A-Za-z .&-]*?)(?: \([^)]*\))?: (.*)$/.exec(line);
    if (m && m[1]!.length <= 28) push(m[1]!, m[2]!); else push("Notes", line);
  }
  for (const n of CRAWLER_NOTES) push("Crawler", n);
  return out;
}
export const METHOD_IDS = () => new Set(methodologySections().map(s => s.id));
