import { it } from "vitest";
import { brandModel } from "@/lib/brand-page";
import { auditFixture } from "@/lib/agency/test-fixtures";
it("x", () => {
  const sk = (n: number) => ({ skeleton: [{ kind: "heading", x: 0, y: 0, w: 100 + n, h: 40 }], page: { w: 1280, h: 900 } });
  const caps = [["2025-12-01", 1], ["2026-02-01", 2], ["2026-09-01", 3], ["2026-10-05", 4]].map(([at, id]) => ({ id: id as number, captured_at: `${at}T00:00:00Z`, source: "live", page: { w: 1280, h: 900 }, color: null, skeleton: [{ kind: "heading", x: 0, y: 0, w: 200, h: 40 }], h1: null, body: null, h1_size: null, whitespace: null, hero: null, radius: null, archive_url: null }));
  void sk;
  const b = brandModel({ domain: "vercel.com", audit: { ...auditFixture(), domains: ["vercel.com"] }, events: auditFixture().events, peers: [], tiers: [], captures: caps });
  console.log(JSON.stringify({ identity: b.identity, timeline: b.timeline.map(m => ({ at: m.at, kind: m.kind, text: m.text, pair: !!m.pair, ps: m.pairShared, basis: m.basis })), empty: brandModel({ domain: "vercel.com", audit: { ...auditFixture(), domains: ["vercel.com"] }, events: [], peers: [], tiers: [] }).timeline }, null, 1));
});
