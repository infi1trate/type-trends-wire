// @vitest-environment node
import { describe, expect, it } from "vitest";
import { json } from "./tools/shared";
import { setSignalIndex } from "./signal-index";

const out = (v: unknown) => JSON.parse(json(v).content[0]!.text);

describe("MCP object URLs", () => {
  it("explainer_url points at /signals/<key>", () => {
    setSignalIndex([], new Map());
    expect(out({ trait: "css:subgrid" }).explainer_url).toBe("https://type-trends-wire.lovable.app/signals/css%3Asubgrid");
  });
  it("every returned site carries brand_url, nested too", () => {
    const o = out({ sites: [{ domain: "linear.app", sector: "dev-tools" }], site: { domain: "vercel.com" } });
    expect(o.sites[0].brand_url).toBe("https://type-trends-wire.lovable.app/brands/linear.app");
    expect(o.site.brand_url).toBe("https://type-trends-wire.lovable.app/brands/vercel.com");
  });
  it("does not invent brand URLs for non-domains or overwrite existing ones", () => {
    expect(out({ domain: "not a domain" }).brand_url).toBeUndefined();
    expect(out({ domain: "linear.app", brand_url: "x" }).brand_url).toBe("x");
  });
});
