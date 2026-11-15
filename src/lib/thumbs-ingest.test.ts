// @vitest-environment node
import { describe, expect, it } from "vitest";
import { handleThumbIngest, handleThumbOptout, type ThumbStore } from "./thumbs-ingest.server";
import type { ThumbRow } from "./thumbs";
import { webp, png, b64 } from "./__fixtures__/webp";

const SECRET = "test-only-secret";
function memory(opts: { active?: string[]; optouts?: string[] } = {}) {
  const objects = new Map<string, number>(), rows: (ThumbRow & { id: number })[] = [], optouts = new Set(opts.optouts ?? []), active = new Set(opts.active ?? ["vercel.com", "linear.app"]);
  let id = 0;
  const store: ThumbStore = {
    async authenticate(r) { return r.headers.get("x-crawl-secret") === SECRET; },
    async activeDomains(d) { return new Set(d.filter(x => active.has(x))); },
    async optedOut(d) { return new Set(d.filter(x => optouts.has(x))); },
    async upload(path, bytes) { objects.set(path, bytes.length); },
    async upsertRow(row) { if (optouts.has(row.domain)) return "opted_out"; const i = rows.findIndex(r => r.path === row.path); const next = { ...row, id: i >= 0 ? rows[i]!.id : ++id }; if (i >= 0) rows[i] = next; else rows.push(next); return "ok"; },
    async rows(domain, viewport) { return rows.filter(r => r.domain === domain && (!viewport || r.viewport === viewport)).sort((a, b) => b.captured_at.localeCompare(a.captured_at)); },
    async removeObjects(paths) { for (const p of paths) objects.delete(p); },
    async deleteRows(ids) { for (const i of ids) rows.splice(rows.findIndex(r => r.id === i), 1); },
    async addOptout(domain) { optouts.add(domain); },
    async removeOptout(domain) { optouts.delete(domain); },
  };
  return { store, objects, rows, optouts };
}
const post = (body: unknown, secret: string | null = SECRET, url = "http://localhost/api/public/ingest-thumbs") => new Request(url, { method: "POST", headers: { "content-type": "application/json", ...(secret ? { "x-crawl-secret": secret } : {}) }, body: JSON.stringify(body) });
const capture = (domain: string, day: string, over: Record<string, string> = {}) => ({ domain, viewport: "desktop", captured_at: `${day}T06:00:00Z`, images: { full: b64(webp(1280, 800)), w640: b64(webp(640, 400)), w320: b64(webp(320, 200, { kind: "VP8L" })), ...over } });

describe("POST /api/public/ingest-thumbs", () => {
  it("authenticates before reading the body", async () => {
    let read = false;
    const body = new ReadableStream({ pull(c) { read = true; c.close(); } }, { highWaterMark: 0 });
    const req = new Request("http://localhost/api/public/ingest-thumbs", { method: "POST", headers: { "x-crawl-secret": "wrong" }, body, duplex: "half" } as RequestInit);
    const res = await handleThumbIngest(req, memory().store);
    expect(res.status).toBe(403);
    expect(read).toBe(false);
  });
  it("refuses bodies over 4 MB with 413", async () => {
    const res = await handleThumbIngest(new Request("http://localhost/x", { method: "POST", headers: { "x-crawl-secret": SECRET, "content-length": String(4 * 1024 * 1024 + 1) }, body: "{}" }), memory().store);
    expect(res.status).toBe(413);
  });
  it("stores a valid capture with both variants", async () => {
    const m = memory();
    const res = await handleThumbIngest(post({ run_id: "2026-11-17-abcd", captures: [capture("vercel.com", "2026-11-17")] }), m.store);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, stored: 1, rejected: 0 });
    expect([...m.objects.keys()].sort()).toEqual(["vercel.com/2026-11-17-desktop-320w.webp", "vercel.com/2026-11-17-desktop-640w.webp", "vercel.com/2026-11-17-desktop.webp"]);
    expect(m.rows[0]).toMatchObject({ width: 1280, height: 800, source_run_id: "2026-11-17-abcd", variants: [{ w: 640, h: 400 }, { w: 320, h: 200 }] });
  });
  it("rejects wrong type, oversize dimensions, oversize bytes, unknown domains and mismatched variants", async () => {
    const m = memory();
    const res = await handleThumbIngest(post({ captures: [
      capture("vercel.com", "2026-11-17", { full: b64(png()) }),
      capture("vercel.com", "2026-11-18", { full: b64(webp(1600, 900)) }),
      capture("vercel.com", "2026-11-19", { full: b64(webp(1280, 800, { bytes: 160 * 1024 })) }),
      capture("unknown.example", "2026-11-17"),
      capture("linear.app", "2026-11-17", { w640: b64(webp(640, 640)) }),
    ] }), m.store);
    const out = await res.json() as { stored: number; results: { reason?: string }[] };
    expect(out.stored).toBe(0);
    expect(out.results.map(r => r.reason)).toEqual(["full:not_webp:png", "full:too_large_dimensions:1600x900", "full:image_over_150kb", "unknown_domain", "w640:aspect_mismatch"]);
    expect(m.objects.size).toBe(0);
  });
  it("refuses opted-out domains and writes nothing", async () => {
    const m = memory({ optouts: ["vercel.com"] });
    const out = await (await handleThumbIngest(post({ captures: [capture("vercel.com", "2026-11-17")] }), m.store)).json() as { results: { reason?: string }[] };
    expect(out.results[0]!.reason).toBe("opted_out");
    expect(m.objects.size + m.rows.length).toBe(0);
  });
  it("keeps only the latest two captures per domain + viewport and deletes older objects", async () => {
    const m = memory();
    for (const d of ["2026-11-03", "2026-11-10", "2026-11-17"]) await handleThumbIngest(post({ captures: [capture("vercel.com", d)] }), m.store);
    expect(m.rows.map(r => r.captured_at.slice(0, 10)).sort()).toEqual(["2026-11-10", "2026-11-17"]);
    expect([...m.objects.keys()].some(p => p.includes("2026-11-03"))).toBe(false);
    expect(m.objects.size).toBe(6);
  });
});

describe("POST /api/public/thumb-optout", () => {
  it("needs the crawler secret before the body", async () => {
    expect((await handleThumbOptout(post({ domain: "vercel.com" }, null), memory().store)).status).toBe(403);
  });
  it("adds the opt-out and deletes every stored capture; remove lifts it", async () => {
    const m = memory();
    await handleThumbIngest(post({ captures: [capture("vercel.com", "2026-11-17"), { ...capture("vercel.com", "2026-11-17"), viewport: "mobile" }] }), m.store);
    expect(m.rows.length).toBe(2);
    const res = await handleThumbOptout(post({ domain: "Vercel.com", note: "owner request" }), m.store);
    expect(await res.json()).toEqual({ ok: true, domain: "vercel.com", action: "add", deleted: 2 });
    expect(m.rows.length + m.objects.size).toBe(0);
    expect(m.optouts.has("vercel.com")).toBe(true);
    await handleThumbOptout(post({ domain: "vercel.com", action: "remove" }), m.store);
    expect(m.optouts.has("vercel.com")).toBe(false);
  });
});
