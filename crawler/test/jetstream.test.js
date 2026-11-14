import { test } from "node:test";
import assert from "node:assert/strict";
import { compileTerms, scorePost, makeTally, firstLink, batches } from "../src/jetstream.js";

const terms = compileTerms([{ term: "Inter", kind: "font" }, { term: "brutalism", kind: "aesthetic" }, { term: "bento grid", kind: "layout" }, { term: "PP Neue Montreal", kind: "font" }, { term: "ab", kind: "generic" }]);
const ev = (text, extra = {}, rkey = "3k") => ({ kind: "commit", did: "did:plc:abc", time_us: 1763078400000000, commit: { operation: "create", collection: "app.bsky.feed.post", rkey, record: { text, langs: ["en"], ...extra } } });

test("terms: fonts case-sensitive, others not, short terms dropped", () => {
  assert.equal(terms.length, 4);
  assert.deepEqual(scorePost({ text: "New landing page set in Inter, very brutalism" }, terms).hits, ["Inter", "brutalism"]);
  assert.deepEqual(scorePost({ text: "an inter-team design review" }, terms).hits, []);
  assert.deepEqual(scorePost({ text: "Typography: PP Neue Montreal + a BENTO GRID" }, terms).hits, ["bento grid", "PP Neue Montreal"]);
});

test("design context, language and replies gate counting", () => {
  assert.equal(scorePost({ text: "Inter Milan won again" }, terms), null);
  assert.equal(scorePost({ text: "font Inter", langs: ["ja"] }, terms), null);
  assert.equal(scorePost({ text: "font Inter", reply: { root: {} } }, terms), null);
  assert.ok(scorePost({ text: "font Inter", langs: [] }, terms));
});

test("fatigue language is counted per term", () => {
  const t = makeTally(terms);
  t.add(ev("honestly brutalism in web design is so played out"));
  t.add(ev("love this brutalism web design"));
  t.add({ kind: "identity" });
  assert.deepEqual(t.counts.brutalism, { n: 2, fatigue: 1 });
  assert.equal(t.sampled_posts, 2); assert.equal(t.design_posts, 2);
});

test("wire items need a term plus a link or two terms; capped", () => {
  const t = makeTally(terms, undefined, 2);
  t.add(ev("design in Inter", {}, "1"));
  t.add(ev("design in Inter", { embed: { $type: "app.bsky.embed.external", external: { uri: "https://studio.example/work" } } }, "2"));
  t.add(ev("Inter and brutalism design", {}, "3"));
  t.add(ev("Inter and brutalism design again", {}, "4"));
  assert.deepEqual(t.items.map((i) => i.url), ["https://bsky.app/profile/did:plc:abc/post/2", "https://bsky.app/profile/did:plc:abc/post/3"]);
  assert.equal(t.items[0].link, "https://studio.example/work");
  assert.equal(t.items[0].source_kind, "bluesky");
  assert.equal(t.items[0].published_at, "2025-11-14T00:00:00.000Z");
});

test("links from facets; batching respects caps", () => {
  assert.equal(firstLink({ facets: [{ features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://a.b/c" }] }] }), "https://a.b/c");
  assert.equal(firstLink({ facets: [{ features: [{ $type: "app.bsky.richtext.facet#link", uri: "javascript:x" }] }] }), null);
  const items = Array.from({ length: 450 }, (_, i) => ({ url: `u${i}`, title: "x".repeat(300) }));
  const b = batches(items);
  assert.deepEqual(b.map((x) => x.length), [200, 200, 50]);
  assert.ok(batches(items, 200, 10_000).every((x) => Buffer.byteLength(JSON.stringify(x)) < 11_000));
});
