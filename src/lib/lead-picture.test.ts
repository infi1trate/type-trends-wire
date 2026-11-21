import { describe, expect, it } from "vitest";
import { toCrop, type Crop } from "./crops";
import { leadPicture, leadQuality, leadThumb, pictureRows, CAROUSEL_CAPTION, type LeadPics, type LeadStoryIn } from "./lead-picture";
import type { Thumb } from "./thumbs";
import type { Cover } from "./pictures";

const crop = (domain: string, at: string, o: Partial<{ section: string; width: number; height: number; bytes: number }> = {}): Crop =>
  toCrop({ domain, section: o.section ?? "hero", viewport: "desktop", captured_at: `${at}T06:00:00Z`, first_seen_at: `${at}T06:00:00Z`, last_seen_at: `${at}T06:00:00Z`, path: `${domain}/${o.section ?? "hero"}/${at}-x.webp`, width: o.width ?? 1280, height: o.height ?? 800, bytes: o.bytes ?? 45_000, hash: "h" });
const thumb = (domain: string, at: string): Thumb => ({ domain, captured_at: `${at}T06:00:00Z`, viewport: "desktop", src: `/thumbs/${domain}/${at}-desktop.webp`, srcSet: `/thumbs/${domain}/${at}-desktop-320w.webp 320w`, width: 1280, height: 800, alt: `${domain} homepage`, caption: `${domain} · captured ${at}`, live: `https://${domain}`, terminal: "" });
const card = (domain: string): Cover => ({ kind: "card", domain, src: `/assets/${domain}/card.webp`, width: 1200, height: 630, at: "2026-11-20T00:00:00Z", alt: "card", what: "Social card", credit: `Social card published by ${domain}`, live: `https://${domain}`, report: "/r" });
const pics = (o: Partial<{ heroes: Record<string, Crop>; thumbs: Record<string, Thumb>; cards: Record<string, Cover>; bad: Set<string>; carousel: Set<string>; icons: string[] }> = {}): LeadPics => ({
  okCrop: c => !(o.bad ?? new Set()).has(c.src) && leadQuality({ ...c, bytes: c.bytes ?? null }).ok,
  hero: d => o.heroes?.[d] ?? null, thumb: d => o.thumbs?.[d] ?? null, card: d => o.cards?.[d] ?? null,
  carousel: d => !!o.carousel?.has(d), name: d => d.split(".")[0]!, icon: d => (o.icons?.includes(d) ? { src: `/i/${d}.png`, width: 32, height: 32, at: "2026-11-20" } : null),
});
const story = (o: Partial<LeadStoryIn>): LeadStoryIn => ({ id: "brand:a.com:2026-11-20", type: "move", domains: ["a.com"], happened_at: "2026-11-20T08:00:00Z", ...o });
const lp = (s: Partial<LeadStoryIn>, p: LeadPics = pics()) => leadPicture({ kind: "story", story: story(s) }, p);

describe("lead quality", () => {
  it("rejects near-blank, flat, narrow, opted-out and unmeasured crops", () => {
    const c = { domain: "a.com", width: 1280, height: 800, bytes: 45_000 };
    expect(leadQuality(c).ok).toBe(true);
    expect(leadQuality({ ...c, bytes: 1882 }).ok).toBe(false);
    expect(leadQuality({ ...c, width: 400 }).reason).toMatch(/480/);
    expect(leadQuality(c, { optedOut: new Set(["a.com"]) }).reason).toBe("opted out");
    expect(leadQuality({ ...c, bytes: null }).reason).toBe("not measured");
    expect(leadQuality(c, { stats: { std: 0, top: 1, edges: 0 } }).ok).toBe(false);
    expect(leadQuality(c, { stats: { std: 40, top: 0.5, edges: 0.6 } }).reason).toMatch(/flat/);
    expect(leadQuality({ ...c, bytes: 1882 }, { stats: { std: 40, top: 0.5, edges: 4 } }).ok).toBe(true);
  });
});

describe("leadPicture by subject", () => {
  const before = crop("a.com", "2026-11-14"), after = crop("a.com", "2026-11-20");
  it("a move with both sides is a before/after pair", () => {
    const p = lp({ evidence: { compare: { before, after }, grid: null } });
    expect(p.kind).toBe("pair"); expect(p.rule).toBe("pair"); expect(p.items.map(i => i.role)).toEqual(["before", "after"]);
  });
  it("a flat before crop drops the pair to the after crop alone", () => {
    const p = lp({ evidence: { compare: { before: crop("a.com", "2026-11-14", { bytes: 1500 }), after }, grid: null } });
    expect(p.kind).toBe("single"); expect(p.items[0]!.date).toBe("2026-11-20");
  });
  it("a palette-only change draws measured swatches", () => {
    const p = lp({ fields: ["palette"], palette: { before: ["#111111"], after: ["#ff0000"] }, evidence: { compare: { before, after }, grid: null } });
    expect(p.kind).toBe("swatches"); expect(p.swatches!.after).toEqual(["#ff0000"]);
  });
  it("a roundup is a mosaic of up to four after-crops, preferring the lighter fold thumbnail of the same day", () => {
    const grid = ["a.com", "b.com", "c.com", "d.com", "e.com"].map(d => ({ domain: d, crop: crop(d, "2026-11-20") }));
    const p = lp({ id: "roundup:all:aesthetic:x:2026-11-20", type: "roundup", domains: grid.map(g => g.domain), evidence: { compare: null, grid } }, pics({ thumbs: { "a.com": thumb("a.com", "2026-11-20") } }));
    expect(p.kind).toBe("mosaic"); expect(p.items).toHaveLength(4);
    expect(p.items[0]!.asset.startsWith("thumb:")).toBe(true); expect(p.items[1]!.asset.startsWith("crop:")).toBe(true);
  });
  it("a census shows up to six exact counted headlines", () => {
    const census = Array.from({ length: 8 }, (_, i) => ({ name: `B${i}`, line: `“Agents for ${i}”`, href: `/brands/b${i}.com` }));
    const p = lp({ id: "census:agents:2026-W47", type: "roundup", census });
    expect(p.kind).toBe("words"); expect(p.words).toHaveLength(6); expect(p.words![0]!.line).toBe("“Agents for 0”"); expect(p.words![0]!.domain).toBe("b0.com");
  });
  it("a sale census and a seasonal piece use first screens from the cited dates", () => {
    const heroes = { "a.com": crop("a.com", "2026-11-19"), "b.com": crop("b.com", "2026-11-19"), "c.com": crop("c.com", "2026-10-01") };
    const p = lp({ id: "census:sale:2026-W47", type: "roundup", domains: ["a.com", "b.com", "c.com"], dates: ["2026-11-18"] }, pics({ heroes }));
    expect(p.kind).toBe("mosaic"); expect(p.rule).toBe("seasonal"); expect(p.items.map(i => i.domain)).toEqual(["a.com", "b.com"]);
  });
  it("breakout and white space use the named brands", () => {
    const heroes = { "a.com": crop("a.com", "2026-11-19"), "b.com": crop("b.com", "2026-11-19") };
    expect(lp({ id: "breakout:x", type: "breakout", domains: ["a.com", "b.com"] }, pics({ heroes })).rule).toBe("breakout");
    expect(lp({ id: "white:x", type: "white_space", domains: ["a.com", "b.com"] }, pics({ heroes })).rule).toBe("whiteSpace");
  });
  it("news uses the subject brand's own social card, else its hero crop", () => {
    expect(lp({ id: "news:1", type: "news" }, pics({ cards: { "a.com": card("a.com") }, heroes: { "a.com": after } })).kind).toBe("card");
    const p = lp({ id: "news:1", type: "news" }, pics({ heroes: { "a.com": after } }));
    expect(p.kind).toBe("single"); expect(p.rule).toBe("news");
  });
  it("a study leads with its chart; the Digest keeps its cover", () => {
    expect(leadPicture({ kind: "study", chart: true }, pics()).kind).toBe("chart");
    expect(leadPicture({ kind: "digest", cover: "picture" }, pics()).rule).toBe("digest");
  });
});

describe("fallback chain: crops → social card → chart → marks → none", () => {
  it("walks the chain in order", () => {
    expect(lp({ evidence: null }, pics({ heroes: { "a.com": crop("a.com", "2026-11-20") } })).rule).toBe("fallbackCrops");
    expect(lp({ evidence: null }, pics({ cards: { "a.com": card("a.com") } })).rule).toBe("fallbackCard");
    expect(lp({ evidence: null, chart: true }, pics()).rule).toBe("fallbackChart");
    expect(lp({ evidence: null }, pics({ icons: ["a.com"] })).kind).toBe("marks");
    expect(lp({ evidence: null }, pics()).kind).toBe("none");
  });
  it("never leads with a crop that fails quality, even as fallback", () => {
    const p = lp({ evidence: null }, pics({ heroes: { "a.com": crop("a.com", "2026-11-20", { bytes: 1882 }) }, cards: { "a.com": card("a.com") } }));
    expect(p.kind).toBe("card");
  });
  it("an opted-out brand's crop never leads", () => {
    const c = crop("a.com", "2026-11-20");
    const p = leadPicture({ kind: "story", story: story({ evidence: { compare: null, after: c, grid: null } }) }, { ...pics(), okCrop: x => leadQuality({ ...x, bytes: x.bytes ?? null }, { optedOut: new Set(["a.com"]) }).ok });
    expect(p.kind).toBe("none");
  });
  it("a rotating hero is captioned as one frame", () => {
    const p = lp({ evidence: { compare: null, after: crop("a.com", "2026-11-20"), grid: null } }, pics({ carousel: new Set(["a.com"]) }));
    expect(p.caption).toContain(CAROUSEL_CAPTION);
  });
});

describe("Data view rows and card thumbnail", () => {
  it("lists each picture with its rule and stored object; the card takes the after side", () => {
    const p = lp({ evidence: { compare: { before: crop("a.com", "2026-11-14"), after: crop("a.com", "2026-11-20") }, grid: null } });
    const rows = pictureRows(p);
    expect(rows).toHaveLength(2); expect(rows[0]!.asset).toBe("crop:a.com/hero/2026-11-14-x.webp"); expect(rows[0]!.rule).toMatch(/before and after/);
    expect(leadThumb(p)!.role).toBe("after");
  });
});
