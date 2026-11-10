import { XMLParser } from "fast-xml-parser";

export type WireItem = { url: string; title: string; source: string; source_kind: "rss" | "hn"; published_at: string; excerpt: string | null; tags: string[] };
export const DAY = 86400000;
export const WIRE_WINDOW_DAYS = 7;
export const WIRE_RETENTION_DAYS = 90;
export const RUN_RETENTION_DAYS = 30;
const TAGS: Record<string, string[]> = {
  type: ["font", "fonts", "typeface", "typefaces", "typography", "type foundry", "foundry", "lettering", "serif", "sans-serif", "monospace", "variable font"],
  color: ["color", "colour", "palette", "pantone", "gradient"],
  brand: ["rebrand", "rebranding", "brand identity", "visual identity", "logo", "logotype", "branding"],
  ui: ["ui", "ux", "interface", "design system", "figma", "component", "usability", "prototype"],
  web: ["css", "website", "web design", "layout", "frontend", "front-end", "html", "landing page"],
  motion: ["motion", "animation", "animated", "3d"],
  ai: ["ai", "generative", "llm", "agent", "agents", "midjourney"],
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TAG_RES = Object.entries(TAGS).map(([t, w]) => [t, new RegExp(`\\b(${w.map(esc).join("|")})\\b`, "i")] as const);
export const tagText = (text: string) => TAG_RES.filter(([, re]) => re.test(text)).map(([t]) => t);
export const isDesignStory = (title: string) => tagText(title).some((x) => x !== "ai" && x !== "web") || /\bdesign(er|ers|ing)?\b/i.test(title);
export function stripHtml(s: unknown, max = 280): string | null {
  if (!s) return null;
  const t = String(s).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "'").replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"').replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t || null;
}
export const FEEDS = [
  { name: "It's Nice That", url: "https://feeds2.feedburner.com/itsnicethat/SlXC" },
  { name: "Dezeen", url: "https://www.dezeen.com/feed/" },
  { name: "Design Milk", url: "http://feeds.feedburner.com/design-milk" },
  { name: "Codrops", url: "http://feeds2.feedburner.com/tympanus" },
  { name: "Smashing Magazine", url: "https://www.smashingmagazine.com/feed/" },
  { name: "Nielsen Norman Group", url: "https://www.nngroup.com/feed/rss/" },
  { name: "UX Collective", url: "https://uxdesign.cc/feed" },
  { name: "Colossal", url: "http://www.thisiscolossal.com/feed/" },
  { name: "designboom", url: "https://www.designboom.com/feed/" },
];
export const HN_QUERIES = ["typeface", "font", "typography", "design system", "figma", "rebrand", "logo", "color palette", "web design", "ui design"];
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });
const arr = <T,>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
const txt = (x: any): string => (x == null ? "" : typeof x === "object" ? String(x["#text"] ?? "") : String(x));
const iso = (d: any) => { const t = Date.parse(txt(d)); return Number.isNaN(t) ? null : new Date(t).toISOString(); };
export function parseFeed(xml: string, source: string): WireItem[] {
  const doc = parser.parse(xml);
  const out: WireItem[] = [];
  const push = (title: string, url: string, date: string | null, body: unknown) => {
    title = stripHtml(title, 300) ?? "";
    if (!title || !/^https?:\/\//.test(url) || !date) return;
    const excerpt = stripHtml(body);
    out.push({ url, title, source, source_kind: "rss", published_at: date, excerpt, tags: tagText(`${title} ${excerpt ?? ""}`) });
  };
  for (const it of arr<any>(doc?.rss?.channel?.item)) push(txt(it.title), txt(it.link).trim(), iso(it.pubDate ?? it["dc:date"]), txt(it.description) || txt(it["content:encoded"]));
  for (const e of arr<any>(doc?.feed?.entry)) {
    const links = arr<any>(e.link);
    const href = (links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0])?.["@_href"] ?? "";
    push(txt(e.title), href, iso(e.published ?? e.updated), txt(e.summary) || txt(e.content));
  }
  return out;
}
export function parseHn(json: any): WireItem[] {
  return arr<any>(json?.hits).filter((h) => h.title && isDesignStory(h.title)).map((h) => ({
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    title: String(h.title), source: "Hacker News", source_kind: "hn" as const,
    published_at: new Date(h.created_at_i * 1000).toISOString(),
    excerpt: `${h.points ?? 0} points · ${h.num_comments ?? 0} comments · https://news.ycombinator.com/item?id=${h.objectID}`,
    tags: tagText(h.title),
  }));
}
export function recentUnique(items: WireItem[], started: Date) {
  const byUrl = new Map<string, WireItem>();
  for (const i of items) if (Date.parse(i.published_at) >= started.getTime() - WIRE_WINDOW_DAYS * DAY) byUrl.set(i.url, i);
  return [...byUrl.values()];
}
export type Font = { family: string; category: string; axes?: unknown[] };
export function snapshotRows(pop: Font[], trend: Font[], date: string) {
  const tr = new Map(trend.map((f, i) => [f.family, i + 1]));
  return pop.map((f, i) => ({ captured_on: date, family: f.family, category: f.category, popularity_rank: i + 1, trending_rank: tr.get(f.family) ?? trend.length + 1, is_variable: Array.isArray(f.axes) && f.axes.length > 0 }));
}