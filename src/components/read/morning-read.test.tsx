// Phase E0b · Morning Line Read rows carry no score (the terminal's Morning panel keeps it).
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MorningView, type MorningData } from "./EditionsViews";
import { morningEdition, type MorningRaw } from "@/lib/editions/morning";
import type { StoredStory } from "@/lib/stories/edits";

const story = (id: string, score: number, h: number): StoredStory => ({ id, type: "move", status: "published", reason: "ran", score, components: {}, why_ran: "", kicker: "Move", headline: `Headline ${id}`, deck: `Deck ${id}`,
  facts: [], why_line: null, why_model: null, why_at: null, sector: "fintech", signal_keys: [], domains: [], evidence: [], source_ids: [], basis: "measured", happened_at: `2026-11-18T${String(h).padStart(2, "0")}:00:00Z`, created_at: `2026-11-18T${String(h).padStart(2, "0")}:00:00Z` });

describe("Morning Line on the Read side", () => {
  it("rows, the lead and the desk print no score", async () => {
    const raw: MorningRaw = { edits: [], lines: [], stories: [story("a", 87, 1), story("b", 73, 2), story("c", 64, 3), { ...story("held", 41, 4), status: "held", reason: "below the threshold" }] };
    const edition = morningEdition(raw, "2026-11-18", Date.parse("2026-11-20T09:00:00Z"), { moving: { pair: null, items: [] }, charts: [] });
    expect(edition.lead?.score).toBe(87); // the model keeps the score for the terminal
    const d = { edition: { ...edition, figure: null }, archive: [], today: "2026-11-20" } as unknown as MorningData;
    const root = createRootRoute({ component: () => createElement(MorningView, { d }) });
    const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ["/morning/2026-11-18"] }) });
    await router.load();
    const html = renderToString(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(RouterProvider, { router } as never)));
    expect(html).toContain("Headline a"); expect(html).toMatch(/Held: (<!-- -->)?below the threshold/);
    expect(html).not.toMatch(/score\s*(<!-- -->)?\s*\d/i);
  });
});
