import { defineTool } from "@lovable.dev/mcp-js";
import { libraryDomain } from "@/lib/library-payload";
import { fingerprint } from "@/lib/library";
import { librarySite } from "@/lib/library-store.server";
import { json, READ } from "./shared";
import { BRAND_NAME } from "@/lib/brand";
import { SITE_URL } from "@/lib/site";
export default defineTool({ name: "library_site", title: "Library site fingerprint", description: "Latest design fingerprint, snapshot metadata and last 20 change events for a tracked domain; excludes skeleton and private text. Each trait or signal keeps its stable key and adds a plain-English label, a dimension (FONT, COLOR, LAYOUT or VIBE), basis (measured or ai), tier (headline, supporting or archive), momentum_index (0–100 percentile of the stored next-wave score among headline + supporting signals), confidence (High, Medium or Low, with confidence_reason) and, where staged, stage_label (Emerging, Rising, Peaking, Fading or Steady). `similar` lists up to six tracked brands with the most measured headline signals in common (Jaccard overlap at least 60% and two shared signals), each with the signals it shares.", inputSchema: { domain: libraryDomain }, annotations: READ,
  handler: async ({ domain }) => { const data = await librarySite(domain); if (!data) return { ...json({ error: "Domain not in library" }), isError: true };
    const latest = [...new Map([...data.snapshots].reverse().map(s => [`${s.page_type}:${s.viewport}`, s])).values()];
    const { similarFor } = await import("@/lib/read.server");
    const sim = await similarFor(domain).catch(() => null);
    const similar = sim ? { line: sim.line, enough: sim.enough, brands: sim.items.map(b => ({ domain: b.domain, name: b.name, sector: b.sector, same_sector: b.sameSector, overlap: Math.round(b.overlap * 100) / 100, shared: b.shared, url: `${SITE_URL}${b.href}` })) } : null;
    return json({ site: data.site, similar, fingerprint: fingerprint(data.snapshots.find(s => s.page_type === "home" && s.viewport === "desktop" && s.source === "live")?.signals), snapshots: latest.map(s => ({ id: s.id, page_type: s.page_type, viewport: s.viewport, source: s.source, captured_at: s.captured_at, url: s.url })), events: data.events.slice(0, 20), receipts: { source: `${BRAND_NAME} library crawler`, method: "trend://methodology", as_of: data.site.last_snapshot_at } });
  } });