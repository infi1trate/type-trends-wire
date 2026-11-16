import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { MCP_TOOL_COUNT } from "@/lib/site";
import { MCP_TOOL_NAMES } from "@/lib/mcp/tool-names";

// /tools quotes the MCP tool count from the registry list; a hard-coded number drifted once (it said 24 with 26 registered).
describe("/tools MCP tool count", () => {
  const src = readFileSync("src/components/read/ToolsViews.tsx", "utf8");
  it("is derived from the registry list, not typed in", () => {
    expect(MCP_TOOL_COUNT).toBe(MCP_TOOL_NAMES.length);
    expect(src).toContain("${MCP_TOOL_COUNT} read-only tools");
    expect(src).not.toMatch(/\b\d+ read-only tools/);
  });
  it("registry and name list agree on 28 tools", () => {
    const index = readFileSync("src/lib/mcp/index.ts", "utf8");
    const listed = index.match(/tools:\[([^\]]+)\]/)?.[1]?.split(",").map(t => t.trim()).filter(Boolean) ?? [];
    expect(listed).toHaveLength(MCP_TOOL_NAMES.length);
    expect(MCP_TOOL_COUNT).toBe(28);
  });
});
