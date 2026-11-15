// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderCardSvg, cardScene, type CardModel } from "./card";
import { renderScenePng } from "./raster";
import { pickCard, briefCall, parseCardParam, type ForecastLike } from "./model";
import { chartImageResponse } from "./http.server";

const row: ForecastLike = { dimension: "imagery", value: "photography_product", scope: "all", stage: "flat", current_share: 0.2231, momentum: 0.0779, run_id: 9,
  quarters: [{ q: "2021Q1", s: 0.2217, n: 203, c: 0.677 }, { q: "2022Q1", s: 0.1864, n: 220, c: 0.733 }, { q: "2023Q1", s: 0.1905, n: 168, c: 0.56 }, { q: "2024Q1", s: 0.3, n: 9, c: 0.1 }, { q: "2026Q4", s: 0.2231, n: 251, c: 0.837 }],
  proj_q1: 0.218, proj_q1_lo: 0.186, proj_q1_hi: 0.249, proj_q2: 0.219, proj_q2_lo: 0.185, proj_q2_hi: 0.251, proj_q4: 0.22, proj_q4_lo: 0.185, proj_q4_hi: 0.253 };
const brief = { headline: "h", sections: [{ title: "Rising", body: "None.", citations: [] }, { title: "Next wave", body: "Photography-based imagery leads with a 22.3% share. More text.", citations: [{ kind: "spread", id: "x" }, { kind: "forecast", id: "imagery:photography_product:all" }] }] };
const model = pickCard({ week: "2026-W46", run_id: 7, brief, rows: [row], alerts: [], data_through: "2026Q4" })!;

describe("chart of the week", () => {
  it("picks the brief's Next wave forecast citation and its first sentence", () => {
    expect(briefCall(brief)).toEqual({ id: "imagery:photography_product:all", call: "Photography-based imagery leads with a 22.3% share." });
    expect(briefCall({ ...brief, watch: { id: "theme:dark:all", call: "Watch dark." } })).toEqual({ id: "theme:dark:all", call: "Watch dark." });
    expect(model.origin).toBe("call");
    expect(model.series.map(s => s.q)).toEqual(["2021Q1", "2022Q1", "2023Q1", "2026Q4"]);
    expect(model.forecast.map(f => f.q)).toEqual(["2027Q1", "2027Q2", "2027Q4"]);
    expect(model.ticker).toBeUndefined();
    expect(model.label).toBe("Product photography");
    expect(model.n).toBe(251);
  });
  it("falls back to the newest breakout alert when the call has no series", () => {
    const alertRow = { ...row, dimension: "css", value: "anchor-positioning", scope: "studios" };
    const m = pickCard({ week: "2026-W46", run_id: 7, brief: { ...brief, watch: { id: "theme:dark:all", call: "x" } }, rows: [alertRow],
      alerts: [{ title: "BREAKOUT $ANCHOR-POSITIONING +2.3 pts/q in studios", ref: "css:anchor-positioning", url: "https://type-trends-wire.lovable.app/?panel=brief&sector=studios", tags: ["breakout"], published_at: "2026-11-14T00:00:00Z" }], data_through: "2026Q4" })!;
    expect(m.origin).toBe("alert");
    expect(m.scope).toBe("studios");
    expect(m.call).toBe("BREAKOUT $ANCHOR-POSITIONING +2.3 pts/q in studios");
    expect(pickCard({ week: "2026-W46", run_id: 7, brief: { headline: "h", sections: [] }, rows: [], alerts: [], data_through: null })).toBeNull();
  });
  it("never renders $ tickers, even for cards stored before labels", () => {
    const old = { ...model, ticker: "$PHOTOGRAPHY-PRODUCT", label: "AI · IMAGERY: PHOTOGRAPHY PRODUCT", origin: "alert" as const, call: "BREAKOUT $PHOTOGRAPHY-PRODUCT +1.1 pts/q in studios" };
    for (const m of [model, old]) for (const size of ["1200x675", "1080x1350"] as const) {
      const svg = renderCardSvg(m, size);
      expect(svg).not.toMatch(/\$[A-Z][A-Z0-9-]+/);
      expect(svg).toContain("Product photography");
      expect(svg).toContain("[VIBE]");
    }
    expect(renderCardSvg(old, "1200x675")).toContain("BREAKOUT · Product photography [VIBE] +1.1 pts/q · studios");
  });
  it("renders a stable SVG card", () => {
    expect(renderCardSvg(model, "1200x675")).toMatchSnapshot();
    expect(renderCardSvg(model, "1080x1350")).toMatchSnapshot();
  });
  it("rasterizes PNGs at both sizes", async () => {
    for (const [size, w, h] of [["1200x675", 1200, 675], ["1080x1350", 1080, 1350]] as const) {
      const png = await renderScenePng(cardScene(model, size));
      expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      const dv = new DataView(png.buffer, png.byteOffset);
      expect([dv.getUint32(16), dv.getUint32(20)]).toEqual([w, h]);
    }
  });
  it("parses image params", () => {
    expect(parseCardParam("2026-W46")).toEqual({ week: "2026-W46", size: "1200x675" });
    expect(parseCardParam("2026-W46-1080x1350")).toEqual({ week: "2026-W46", size: "1080x1350" });
    expect(parseCardParam("2026-W46-800x600")).toBeNull();
    expect(parseCardParam("latest")).toBeNull();
  });
  it("serves 200 for a stored week and 404 otherwise", async () => {
    const load = async (w: string) => (w === "2026-W46" ? { week: w, run_id: 7, trait: "t", origin: "call" as const, model: model as CardModel, created_at: "2026-11-14T00:00:00Z" } : null);
    const svg = await chartImageResponse("2026-W46", "svg", load);
    expect(svg.status).toBe(200); expect(svg.headers.get("content-type")).toContain("image/svg+xml");
    const png = await chartImageResponse("2026-W46-1080x1350", "png", load);
    expect(png.status).toBe(200); expect(png.headers.get("content-type")).toBe("image/png");
    expect((await chartImageResponse("2026-W45", "png", load)).status).toBe(404);
    expect((await chartImageResponse("nope", "svg", load)).status).toBe(404);
  });
});
