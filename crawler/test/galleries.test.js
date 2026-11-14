import { test } from "node:test";
import assert from "node:assert/strict";
import { featuredDomain, extractFeatured, GALLERIES } from "../src/galleries.js";
import { mergeCurated } from "../src/crawl.js";

test("featured links: keep sites, drop gallery chrome, sponsors and socials", () => {
  const hrefs = [
    "https://land-book.com/websites/123", "https://www.titan.com/?ref=landbook", "https://titan.com/about",
    "https://twitter.com/landbook", "https://try.webflow.com/x", "https://mobbin.com", "https://app.framer.link/a",
    "https://studio-x.webflow.io/", "https://shop.example.co.uk/x", "https://pxf.io/abc", "mailto:hi@x.com", "javascript:void(0)",
  ];
  assert.deepEqual(extractFeatured(hrefs, "https://land-book.com/?page=2"), ["titan.com", "studio-x.webflow.io", "example.co.uk"]);
  assert.equal(featuredDomain("https://sub.land-book.com/x", "land-book.com"), null);
});

test("gallery list: no Godly, every gallery has listing urls", () => {
  assert.equal(GALLERIES.some((g) => g.slug === "godly"), false);
  for (const g of GALLERIES) assert.ok(g.urls.length >= 1 && g.urls.every((u) => u.startsWith("https://")), g.slug);
});

test("mergeCurated: galleries + terminal candidates, disjoint from other indexes, most-featured first", () => {
  const found = new Map([["a.com", new Set(["landbook"])], ["b.studio", new Set(["landbook", "cssda"])], ["linear.app", new Set(["onepagelove"])]]);
  const candidates = [{ domain: "www.a.com", sources: ["arena"] }, { domain: "new.example.io", sources: ["producthunt"] }, { domain: "x.vercel.app", sources: ["arena"] }];
  const out = mergeCurated(found, candidates, new Set(["linear.app"]));
  assert.deepEqual(out, [
    { domain: "a.com", galleries: ["landbook", "arena"] },
    { domain: "b.studio", galleries: ["landbook", "cssda"] },
    { domain: "example.io", galleries: ["producthunt"] },
    { domain: "x.vercel.app", galleries: ["arena"] },
  ]);
});
