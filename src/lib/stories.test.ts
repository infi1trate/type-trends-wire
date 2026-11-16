import { describe, expect, it } from "vitest";
import { fromAlert, fromEvent, fromRebrand, fromStageChange, fromWire, storyStream, STORIES_PER_PAGE, type Story } from "./stories";
import { label } from "./labels";

const TICKER = /\$[A-Z][A-Z0-9-]+/;
const alert = { title: "BREAKOUT $SUBGRID +4.8 pts/q in fintech", url: "https://type-trends-wire.lovable.app/?panel=brief&trait=css%3Asubgrid&sector=fintech&alert=13-breakout", published_at: "2026-11-15T15:34:00Z", ref: "css:subgrid" };

describe("story adapters", () => {
  it("ids are stable across calls", () => {
    expect(fromAlert(alert).id).toBe(fromAlert({ ...alert }).id);
    expect(fromAlert(alert).id).toBe("alert:/?panel=brief&trait=css%3Asubgrid&sector=fintech&alert=13-breakout");
    expect(fromStageChange({ trait: "css:subgrid", from: "emerging", to: "accelerating", share: 0.12 }, 15, "2026-11-15T00:00:00Z").id).toBe("shift:css:subgrid:15");
    expect(fromWire({ id: 9, title: "x", url: "https://e.com", source: "Dezeen", published_at: "2026-11-15T00:00:00Z" }).id).toBe("wire:9");
    expect(fromRebrand({ domain: "linear.app", sector: "dev-tools", name: "Linear", confirmed_at: "2026-11-10T00:00:00Z", read: "Moved to a serif.", reasons: ["font"] } as never).id).toBe("rebrand:linear.app:2026-11-10T00:00:00Z");
  });
  it("alerts read as plain sentences named by labels.ts, never $ tickers", () => {
    const s = fromAlert(alert);
    expect(s).toMatchObject({ type: "breakout", sector: "fintech", signalKeys: ["css:subgrid"], evidence: "/signals/css%3Asubgrid" });
    expect(s.headline).toBe(`${label("css:subgrid").name} is breaking out in Fintech`);
    expect(`${s.kicker} ${s.headline} ${s.deck}`).not.toMatch(TICKER);
  });
  it("stage changes say the move in words", () => {
    const s = fromStageChange({ trait: "css:subgrid", from: "emerging", to: "accelerating", share: 0.12 }, 15, "2026-11-15T00:00:00Z");
    expect(s.type).toBe("shift");
    expect(s.headline).toContain(label("css:subgrid").name);
    expect(s.headline).toMatch(/Emerging to Rising/);
  });
  it("library events become brand moves linking to the brand page", () => {
    const s = fromEvent({ id: 5, domain: "vercel.com", type: "theme_flip", before: { theme: "dark" }, after: { theme: "light" }, detected_at: "2026-11-01T00:00:00Z" } as never);
    expect(s).toMatchObject({ id: "event:5", type: "move", domains: ["vercel.com"] });
    expect(s.evidence).toContain("vercel.com");
  });
});

describe("story stream", () => {
  const mk = (id: string, at: string, o: Partial<Story> = {}): Story => ({ id, type: "news", kicker: "News", headline: id, at, sector: null, signalKeys: [], domains: [], evidence: "/", basis: null, ...o });
  it("keeps only headline-tier signal stories, newest first, de-duplicated", () => {
    const all = [mk("a", "2026-11-10"), mk("b", "2026-11-12", { signalKeys: ["css:subgrid"], type: "shift" }), mk("c", "2026-11-14", { signalKeys: ["theme:dark"], type: "shift" }), mk("a", "2026-11-10"), mk("d", "2026-11-13")];
    const s = storyStream(all, { headline: new Set(["css:subgrid"]) });
    expect(s.lead?.id).toBe("b");
    expect(s.stories.map(x => x.id)).toEqual(["d", "a"]);
  });
  it("ranks the lens sector first", () => {
    const all = [mk("x", "2026-11-14"), mk("y", "2026-11-10", { sector: "fintech" })];
    expect(storyStream(all, { sector: "fintech" }).lead?.id).toBe("y");
  });
  it("pages 30 at a time", () => {
    const all = Array.from({ length: 70 }, (_, i) => mk(`n${String(i).padStart(2, "0")}`, `2026-11-${String(1 + (i % 28)).padStart(2, "0")}T${String(i % 24).padStart(2, "0")}:00:00Z`));
    const p0 = storyStream(all), p2 = storyStream(all, { page: 2 });
    expect(STORIES_PER_PAGE).toBe(30);
    expect(p0.stories).toHaveLength(30);
    expect(p0.pages).toBe(3);
    expect(p2.stories).toHaveLength(9);
    expect(storyStream(all, { page: 99 }).page).toBe(2);
  });
});
