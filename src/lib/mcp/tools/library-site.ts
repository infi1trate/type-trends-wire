import { defineTool } from "@lovable.dev/mcp-js";
import { libraryDomain } from "@/lib/library-payload";
import { fingerprint } from "@/lib/library";
import { librarySite } from "@/lib/library-store.server";
import { json, READ } from "./shared";
export default defineTool({ name: "library_site", title: "Library site fingerprint", description: "Latest design fingerprint, snapshot metadata and last 20 change events for a tracked domain; excludes skeleton and private text. Each trait or signal keeps its stable key and adds a plain-English label, a dimension (FONT, COLOR, LAYOUT or VIBE) and, where staged, stage_label (Emerging, Rising, Peaking, Fading or Steady).", inputSchema: { domain: libraryDomain }, annotations: READ,
  handler: async ({ domain }) => { const data = await librarySite(domain); if (!data) return { ...json({ error: "Domain not in library" }), isError: true };
    const latest = [...new Map([...data.snapshots].reverse().map(s => [`${s.page_type}:${s.viewport}`, s])).values()];
    return json({ site: data.site, fingerprint: fingerprint(data.snapshots.find(s => s.page_type === "home" && s.viewport === "desktop" && s.source === "live")?.signals), snapshots: latest.map(s => ({ id: s.id, page_type: s.page_type, viewport: s.viewport, source: s.source, captured_at: s.captured_at, url: s.url })), events: data.events.slice(0, 20), receipts: { source: "DSGN Library crawler", method: "trend://methodology", as_of: data.site.last_snapshot_at } });
  } });