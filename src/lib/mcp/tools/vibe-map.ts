import { defineTool } from "@lovable.dev/mcp-js";
import { librarySector } from "@/lib/library-payload";
import { ToolError } from "@lovable.dev/mcp-js";
import { json, READ } from "./shared";
export default defineTool({ name: "vibe_map", title: "Vibe map", description: "Tag-space clusters of library sites (closed-vocabulary AI tags, PCA + k-means) with names, member domains, top tags and momentum vs the archive. Each trait or signal keeps its stable key and adds a plain-English label, a dimension (FONT, COLOR, LAYOUT or VIBE), basis (measured or ai), tier (headline, supporting or archive), momentum_index (0–100 percentile of the stored next-wave score among headline + supporting signals), confidence (High, Medium or Low, with confidence_reason) and, where staged, stage_label (Emerging, Rising, Peaking, Fading or Steady).",
  inputSchema: { sector: librarySector.optional() }, annotations: READ,
  handler: async ({ sector }) => {
    const { vibeMap } = await import("@/lib/vibe.server");
    const m = await vibeMap(sector);
    if (!m) throw new ToolError("Vibe map not computed yet; it is built with the weekly forecast.");
    const pts = m.points.filter(p => !sector || p.sector === sector);
    return json({ quarter: m.quarter, n_sites: m.n, sector: sector ?? "all", axes: m.axes.map(a => ({ label: a.label, negative: a.negative, positive: a.positive, explained: a.explained })),
      clusters: m.clusters.map(c => { const members = pts.filter(p => p.cluster === c.id); return { ...c, members_in_scope: members.length, members: members.map(p => p.domain) }; }),
      receipts: { n_tagged_sites: m.n, tags_data_through: m.data_through, k: m.k, silhouette: m.silhouette, momentum_base_quarter: m.base_quarter, run_id: m.run_id, computed_at: m.computed_at, method: "trend://methodology#VIBE MAP", note: "Tag-space similarity, not visual similarity." } });
  } });
