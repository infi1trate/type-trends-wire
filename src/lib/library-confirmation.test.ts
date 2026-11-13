import { expect, it } from "vitest";
import { advance, extractFields, equalField, normalizeFont, deltaE76, frameworks, type Baseline, type Pending } from "./library-diff";
const context = { page_type: "home", viewport: "desktop", sector: "ai" };
function replay(values: Record<string, unknown>[], ctx = context) {
  let baseline: Baseline | null = null, pending: Pending = {};
  const events = [];
  for (const [i, signals] of values.entries()) {
    const result = advance(baseline, pending, { signals, snapshot_id: i + 1, captured_at: `2026-11-${String(i + 1).padStart(2, "0")}T00:00:00Z`, context: ctx });
    baseline = result.baseline; pending = result.pending; events.push(...result.events);
  }
  return { baseline, pending, events };
}
const theme = (t: string) => ({ color: { theme: t } });
const font = (family: string, extra = {}) => ({ type: { rendered: { h1: { family, webfont: true, ...extra } } } });
it("first capture initializes baseline without events", () => { const r = replay([theme("light")]); expect(r.events).toEqual([]); expect(r.baseline?.snapshot_id).toBe(1); });
it("A B A flicker clears pending without events", () => { const r = replay([theme("light"), theme("dark"), theme("light")]); expect(r.events).toEqual([]); expect(r.pending).toEqual({}); });
it("A B B confirms once with candidate effective date and baseline snapshot", () => { const r = replay([theme("light"), theme("dark"), theme("dark"), theme("dark")]); expect(r.events).toMatchObject([{ type: "theme_flip", effective_at: "2026-11-02T00:00:00Z", prev_snapshot_id: 1, before: { theme: "light" }, after: { theme: "dark" } }]); expect(r.events).toHaveLength(1); });
it("A B C C confirms A to C only", () => { const r = replay([theme("light"), theme("dark"), theme("other"), theme("other")]); expect(r.events).toHaveLength(1); expect(r.events[0]).toMatchObject({ before: { theme: "light" }, after: { theme: "other" }, effective_at: "2026-11-03T00:00:00Z" }); });
it("pending stores first seen snapshot and display values", () => { expect(replay([font("Inter"), font("Söhne")]).pending['h1']).toMatchObject({ first_seen_snapshot_id: 2, from: { family: "Inter" }, to: { family: "Söhne" } }); });
it.each(["Syndicat Grotesk", "SyndicatGrotesk", "Syndicat Grotesk Webfont", "SyndicatGrotesk Pro Variable"])("normalizes equivalent font %s", name => expect(normalizeFont(name)).toBe("syndicatgrotesk"));
it("Basiersquare Webfont and Basiersquare stay silent", () => expect(replay([font("Basiersquare Webfont"), font("Basiersquare"), font("Basiersquare")]).events).toEqual([]));
it.each([["__styreneA_403256", "styrenea", "Styrene A"], ["__fkGrotesk_716da7", "fkgrotesk", "Fk Grotesk"], ["__Inter_Fallback_aaf875", "inter", "Inter"]])("normalizes Next.js family %s without live events", (raw, key, clean) => {
 expect(normalizeFont(raw)).toBe(key);
 expect(replay([font(raw), font(clean), font(clean)]).events).toEqual([]);
 expect(replay([font(raw), font(clean)]).pending).toEqual({});
});
it.each([{ substituted: true }, { webfont: false }])("ignores fallback captures %o", extra => { const r = replay([font("ABC"), font("Liberation Sans", extra), font("Liberation Sans", extra)]); expect(r.events).toEqual([]); expect(r.pending).toEqual({}); });
it("fallback interruption breaks consecutive captures", () => expect(replay([font("Inter"), font("Söhne"), font("Arial", { substituted: true }), font("Söhne")]).events).toEqual([]));
it("mobile only extracts theme and fonts", () => { const fields = extractFields({ ...theme("dark"), ...font("Inter"), color: { theme: "dark", accent: "#ff0000", palette: ["#ff0000"] }, layout: { hero_media: "video" }, prices: ["$29"], nav: [], tech: { next: true }, lexicon: { h1: "Hello" } }, { ...context, viewport: "mobile" }); expect(Object.keys(fields).sort()).toEqual(["h1", "theme"]); });
it("media sector never compares rotating headlines", () => expect(extractFields({ lexicon: { h1: "Breaking news" } }, { ...context, sector: "media" })['headline']).toBeUndefined());
it.each(["cookie", "privacy", "consent", "subscribe", "sign in", "log in", "404", "not found", "access denied", "just a moment"])("ignores blocked headline %s", h1 => expect(extractFields({ lexicon: { h1 } }, context)['headline']).toBeUndefined());
it("invalid prior headline cannot trigger pivot", () => expect(equalField("headline", "Your Privacy Choices", "Build something great")).toBe(true));
it("headline only compares desktop home", () => expect(extractFields({ lexicon: { h1: "New pricing" } }, { ...context, page_type: "pricing" })['headline']).toBeUndefined());
it("accent delta strictly above 25 and palette replacement threshold 3", () => { expect(deltaE76("#000000", "#3b3b3b")).toBeLessThan(25); expect(equalField("accent", "#000000", "#3b3b3b")).toBe(true); expect(equalField("accent", "#000000", "#404040")).toBe(false); expect(equalField("palette", ["#000000"], ["#ffffff", "#ff0000"])).toBe(true); expect(equalField("palette", ["#000000"], ["#ffffff", "#ff0000", "#00ff00"])).toBe(false); });
it("missing price arrays never trigger pricing events", () => { const pricing = { ...context, page_type: "pricing" }; expect(replay([{ content_hash: "a" }, { prices: ["$29 per seat"] }, { prices: ["$39 per seat"] }], pricing).events).toEqual([]); expect(replay([{ prices: ["$29 per seat"] }, {}, { prices: ["$39 per seat"] }], pricing).events).toEqual([]); });
it("prices are set compared and summaries capped at four added/removed", () => { expect(equalField("prices", ["$29", "$39"], ["$39", "$29", "$29"])).toBe(true); const old = { prices: ["$1", "$2", "$3", "$4", "$5"] }, next = { prices: ["$6", "$7", "$8", "$9", "$99"] }; const r = replay([old, next, next], { ...context, page_type: "pricing" }); expect(r.events[0]?.summary).toBe("prices added: $6, $7, $8, $9; removed: $1, $2, $3, $4"); });
it("height and count noise are never comparable", () => expect(extractFields({ layout: { page_height_vh: 500, cta_count: 100, nav_links: 20 }, composition: { text_chars: 50000 } }, context)).toEqual({}));
it("redesign requires three distinct confirmed types on home desktop", () => { const a = { ...theme("light"), ...font("Inter"), tech: { next: false } }, b = { ...theme("dark"), ...font("Söhne"), tech: { next: true } }; expect(replay([a, b]).events).toEqual([]); expect(replay([a, b, b]).events.map(e => e.type)).toEqual(["type_change", "theme_flip", "stack_change", "redesign"]); expect(replay([a, b, b], { ...context, viewport: "mobile" }).events.map(e => e.type)).toEqual(["type_change", "theme_flip"]); });
it.each(frameworks)("confirms framework %s only after repeat", flag => { expect(replay([{ tech: { [flag]: false } }, { tech: { [flag]: true } }]).events).toEqual([]); expect(replay([{ tech: { [flag]: false } }, { tech: { [flag]: true } }, { tech: { [flag]: true } }]).events.map(e => e.type)).toEqual(["stack_change"]); });