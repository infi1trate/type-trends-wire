import { describe, expect, it } from "vitest";
import { rssXml, xmlEscape, RSS_HEADERS } from "./rss";
import { issueHead, traitHead } from "./meta";
import { issueModel } from "./issue";
import { traitModel } from "./trait";
import { fixture } from "./__fixtures__/issue-w46";
import { traitFixture } from "./__fixtures__/trait";

/** Tiny well-formedness check: balanced tags, one root, no stray ampersands. */
function wellFormed(xml: string) {
  const body = xml.replace(/^<\?xml[^>]*\?>\s*/, ""), stack: string[] = [];
  if (/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(body)) return false;
  for (const m of body.matchAll(/<(\/?)([A-Za-z][\w:.-]*)[^>]*?(\/?)>/g)) {
    const [, close, name, self] = m;
    if (self) continue;
    if (close) { if (stack.pop() !== name) return false; } else stack.push(name!);
  }
  return stack.length === 0 && /^<rss[\s>]/.test(body);
}

describe("RSS", () => {
  const items = Array.from({ length: 23 }, (_, i) => ({ week: `2027-W${String(i + 1).padStart(2, "0")}`, number: i + 9, headline: `Issue & <${i}>`, standfirst: "Grids get \"smarter\".", dates: "x" }));
  const xml = rssXml(items);
  it("is well-formed RSS 2.0 with required channel and item fields, newest 20", () => {
    expect(wellFormed(xml)).toBe(true);
    expect(xml).toContain('<rss version="2.0"');
    for (const tag of ["title", "link", "description"]) expect(xml).toMatch(new RegExp(`<channel><title>[^<]+</title>[\\s\\S]*<${tag}>`));
    expect(xml.match(/<item>/g)).toHaveLength(20);
    expect(xml.indexOf("2027-W23")).toBeLessThan(xml.indexOf("2027-W22"));
    expect(xml).toContain("<link>https://type-trends-wire.lovable.app/digest/2027-W23</link>");
    expect(xml).toContain('<atom:link href="https://type-trends-wire.lovable.app/digest/rss.xml" rel="self" type="application/rss+xml"/>');
    expect(xml).toMatch(/<pubDate>Sun, \d\d \w{3} 2027/);
  });
  it("escapes markup and serves the RSS content type", () => {
    expect(xmlEscape("a & <b>")).toBe("a &amp; &lt;b&gt;");
    expect(RSS_HEADERS["Content-Type"]).toBe("application/rss+xml; charset=utf-8");
  });
});

const get = (meta: { title?: string; name?: string; property?: string; content?: string }[], k: string) => meta.find(m => m.property === k || m.name === k)?.content;
describe("share cards", () => {
  it("issue pages carry og/twitter tags with an absolute 1200×630 image, canonical and RSS alternate", () => {
    const issue = issueModel(fixture())!, head = issueHead(issue, "/digest/2026-W46");
    expect(head.meta[0]).toEqual({ title: "Subgrid Momentum, Dropbox Pivots, and the End of Maximalism — The Digest No. 1" });
    expect(get(head.meta, "og:image")).toBe("https://type-trends-wire.lovable.app/digest/2026-W46.png");
    expect([get(head.meta, "og:image:width"), get(head.meta, "og:image:height")]).toEqual(["1200", "630"]);
    expect(get(head.meta, "og:url")).toBe("https://type-trends-wire.lovable.app/digest/2026-W46");
    expect(get(head.meta, "twitter:card")).toBe("summary_large_image");
    expect(get(head.meta, "twitter:image")).toBe(get(head.meta, "og:image"));
    expect(get(head.meta, "og:description")).toMatch(/^Subgrid usage/);
    expect(head.links).toEqual(expect.arrayContaining([{ rel: "canonical", href: "https://type-trends-wire.lovable.app/digest/2026-W46" }, expect.objectContaining({ rel: "alternate", type: "application/rss+xml" })]));
  });
  it("trait pages reuse the trait's chart card as og:image", () => {
    const head = traitHead(traitModel(traitFixture())!);
    expect(get(head.meta, "og:title")).toBe("Subgrid layouts [LAYOUT] — signal · DSGN/TERMINAL");
    expect(get(head.meta, "og:image")).toBe("https://type-trends-wire.lovable.app/trait/css%3Asubgrid.png");
    expect(get(head.meta, "twitter:card")).toBe("summary_large_image");
    expect(head.links[0]).toEqual({ rel: "canonical", href: "https://type-trends-wire.lovable.app/signals/css%3Asubgrid" });
  });
});
