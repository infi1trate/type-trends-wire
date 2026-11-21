import { describe, expect, it } from "vitest";
import { isRedirect } from "@tanstack/react-router";
import { Route as TraitRoute } from "@/routes/trait.$key";
import { Route as LiveRoute } from "@/routes/index";

const run = (route: { options: { beforeLoad?: unknown } }, args: Record<string, unknown>) => {
  try { (route.options.beforeLoad as (a: unknown) => void)(args); return null; } catch (e) { if (isRedirect(e)) return e.options; throw e; }
};

describe("old URLs redirect", () => {
  it("/trait/<key> → /signals/<key>, permanently, sector kept", () => {
    expect(run(TraitRoute, { params: { key: "css:subgrid" }, location: { search: { sector: "fintech" } } })).toMatchObject({ to: "/signals/$key", params: { key: "css:subgrid" }, search: { sector: "fintech" }, statusCode: 301 });
  });
  it("/?panel=… → /terminal with the same view and params", () => {
    // U1: an object view goes straight to the object's one address in its Data view (sector and other params kept).
    expect(run(LiveRoute, { location: { search: { panel: "brief", trait: "css:subgrid", sector: "fintech", alert: "13-breakout" } } })).toMatchObject({ href: "/signals/css%3Asubgrid?sector=fintech&view=data", statusCode: 301 });
    expect(run(LiveRoute, { location: { search: { panel: "rebrands" } } })).toMatchObject({ to: "/terminal", search: { panel: "rebrands" } });
  });
  it("/ and /?sector= stay on Live", () => {
    expect(run(LiveRoute, { location: { search: {} } })).toBeNull();
    expect(run(LiveRoute, { location: { search: { sector: "fintech", page: 1 } } })).toBeNull();
  });
});
