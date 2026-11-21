import { describe, expect, it } from "vitest";
import { eventMarks, lookDiffers, MARK_REASON, rereadLine, sameLookAndContent, validMonthly } from "./reread";
import { applyMarks, checkEvent, splitChecked, type Capture, type Check } from "./integrity";
import { extractFields } from "./library-diff";

const look: Record<string, unknown> = { h1: { family: "Inter", webfont: true, substituted: false }, body: { family: "Inter", webfont: true, substituted: false }, theme: "light", accent: "#ff0000", palette: ["#ffffff", "#000000"], hero_media: "image", h1_align: "left", grid_max_cols: 3 };
const cap = (id: number, at: string, extra: Record<string, unknown> = {}): Capture => ({ id, at, source: "h1", fields: { ...look, ...extra } });

describe("I3 · an AI re-read is not a change", () => {
  const before = ["minimalism", "swiss grid style"], after = ["editorial", "minimalism"];
  const caps = [cap(1, "2026-11-19T00:00:00Z", { aesthetic: before }), cap(2, "2026-11-19T12:00:00Z", { aesthetic: before }), cap(3, "2026-11-20T06:00:00Z", { aesthetic: after, headline: "New words" }), cap(4, "2026-11-21T06:00:00Z", { aesthetic: after })];
  const ev = { id: 9, type: "aesthetic_shift", before: { aesthetic: before }, after: { aesthetic: after }, detected_at: "2026-11-20T06:00:00Z", snapshot_id: 3, prev_snapshot_id: 2 };
  it("labels changed, no measured look field did: a re-read (a new headline alone is not enough)", () => {
    expect(eventMarks(ev, caps)).toEqual({ aesthetic: { kind: "reread", reason: MARK_REASON.sameLook } });
    const c = checkEvent(ev, caps);
    expect(c.verdict).toBe("reread");
    expect(c.base?.verdict).toBe("pass");
    const split = splitChecked([ev], new Map([[9, c]]));
    expect(split.tape).toEqual([]); expect(split.unconfirmed).toEqual([]); expect(split.rereads.map(r => r.id)).toEqual([9]);
  });
  it("labels changed and the accent moved between the same two captures: it counts (integrity still applies)", () => {
    const moved = caps.map(c => c.id >= 3 ? { ...c, fields: { ...c.fields, accent: "#0000ff" } } : c);
    expect(eventMarks(ev, moved)).toEqual({});
    expect(checkEvent(ev, moved).verdict).toBe("pass");
  });
  it("the pair is the labels' own transition, not an older AI baseline (a palette change days before does not count)", () => {
    const older = [cap(0, "2026-11-11T00:00:00Z", { aesthetic: before, palette: ["#232323", "#060606", "#b2b2b2"] }), ...caps];
    const c = checkEvent({ ...ev, prev_snapshot_id: 0 }, older);
    expect(c.fields["aesthetic"]?.lastBefore).toBe("2026-11-19T12:00:00Z");
    expect(c.verdict).toBe("reread");
  });
  it("without both captures there is no proof of a look change: a re-read", () => {
    expect(eventMarks({ ...ev, prev_snapshot_id: 99 }, caps)["aesthetic"]?.kind).toBe("reread");
  });
  it("a substituted fallback font is not a look change", () => {
    expect(lookDiffers({ h1: { family: "Inter" } }, { h1: { family: "Arial", substituted: true } })).toBe(false);
    expect(lookDiffers({ h1: { family: "Inter" } }, { h1: { family: "Söhne" } })).toBe(true);
  });
  it("a mixed change keeps its measured part and drops the re-read part", () => {
    const mixed = { ...ev, before: { aesthetic: before, palette: ["#ffffff", "#000000"] }, after: { aesthetic: after, palette: ["#ffffff", "#000000"] } };
    const base: Check = { verdict: "pass", pass: ["aesthetic", "palette"], fields: {} };
    const c = applyMarks(base, { aesthetic: { kind: "reread", reason: MARK_REASON.sameLook } });
    expect(c.verdict).toBe("pass"); expect(c.pass).toEqual(["palette"]);
    expect(splitChecked([mixed], new Map([[9, c]])).tape[0]?.after).toEqual({ palette: ["#ffffff", "#000000"] });
  });
  it("the Data view line", () => expect(rereadLine("21 Nov 2026")).toBe("Re-read on 21 Nov 2026. No measured change."));
});

describe("I3 · tag intake reuse", () => {
  const f = { ...look };
  it("same look and content hash: reuse", () => expect(sameLookAndContent({ fields: f, content_hash: "a" }, { fields: { ...f }, content_hash: "a" })).toBe(true));
  it("content hash differs: read again", () => expect(sameLookAndContent({ fields: f, content_hash: "a" }, { fields: f, content_hash: "b" })).toBe(false));
  it("a look field differs: read again", () => expect(sameLookAndContent({ fields: f, content_hash: "a" }, { fields: { ...f, theme: "dark" }, content_hash: "a" })).toBe(false));
  it("no content hash: read again", () => expect(sameLookAndContent({ fields: f, content_hash: null }, { fields: f, content_hash: null })).toBe(false));
});

describe("I3 · 0.5 measurement failures", () => {
  it("0 grid columns is no grid detected, never a reading", () => {
    expect(extractFields({ layout: { grid_max_cols: 0 } }, { page_type: "home", viewport: "desktop", sector: "ai" })["grid_max_cols"]).toBeUndefined();
    expect(extractFields({ layout: { grid_max_cols: 4 } }, { page_type: "home", viewport: "desktop", sector: "ai" })["grid_max_cols"]).toBe(4);
    expect(eventMarks({ type: "layout_change", before: { grid_max_cols: 4 }, after: { grid_max_cols: 0 } }, [])).toEqual({ grid_max_cols: { kind: "not_measured", reason: MARK_REASON.noGrid } });
  });
  it("a monthly price below one cent or with more than two decimals is not a price", () => {
    expect(validMonthly(0.0020833333333333333)).toBe(false);
    expect(validMonthly(12.345)).toBe(false);
    expect(validMonthly(0.004)).toBe(false);
    expect(validMonthly(20)).toBe(true); expect(validMonthly(9.99)).toBe(true); expect(validMonthly(null)).toBe(true);
    expect(eventMarks({ type: "pricing_change", before: { ai_pricing: { cheapest_paid_monthly: 0.0020833 } }, after: { ai_pricing: { cheapest_paid_monthly: 20 } } }, [])["ai_pricing"]?.kind).toBe("not_measured");
    expect(extractFields({ ai_pricing: { cheapest_paid_monthly: 0.0020833 } }, { page_type: "pricing", viewport: "desktop", sector: "fintech" })["ai_pricing"]).toBeUndefined();
  });
  it("a valid price change is judged as usual", () => expect(eventMarks({ type: "pricing_change", before: { ai_pricing: { cheapest_paid_monthly: 10 } }, after: { ai_pricing: { cheapest_paid_monthly: 12 } } }, [])).toEqual({}));
});
