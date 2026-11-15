import { describe, expect, it } from "vitest";
import { checkImage, webpSize, sniffImage, pruneOld, pickThumb, thumbPath, mainPathOf, thumbPayload, THUMB_LIMITS, type ThumbRow } from "./thumbs";
import { webp, png } from "./__fixtures__/webp";

describe("image checks", () => {
  it("reads WebP canvas size from VP8X, VP8L and VP8 headers", () => {
    expect(webpSize(webp(1280, 800))).toEqual({ width: 1280, height: 800 });
    expect(webpSize(webp(640, 400, { kind: "VP8L" }))).toEqual({ width: 640, height: 400 });
    expect(webpSize(webp(320, 200, { kind: "VP8 " }))).toEqual({ width: 320, height: 200 });
  });
  it("rejects non-WebP files by magic bytes, not by name", () => {
    expect(sniffImage(png())).toBe("png");
    expect(checkImage(png(), 1280, 800)).toEqual({ ok: false, reason: "not_webp:png" });
    expect(checkImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"), 1280, 800)).toEqual({ ok: false, reason: "not_an_image" });
  });
  it("rejects images over 1280×800, over 150 KB stored, and anything over 300 KB before inspection", () => {
    expect(checkImage(webp(1281, 800), 1280, 800)).toMatchObject({ ok: false, reason: "too_large_dimensions:1281x800" });
    expect(checkImage(webp(1280, 801), 1280, 800)).toMatchObject({ ok: false });
    expect(checkImage(webp(1280, 800, { bytes: 150 * 1024 + 1 }), 1280, 800)).toEqual({ ok: false, reason: "image_over_150kb" });
    expect(checkImage(webp(1280, 800, { bytes: 300 * 1024 + 1 }), 1280, 800)).toEqual({ ok: false, reason: "image_over_300kb" });
    expect(checkImage(webp(1280, 800, { bytes: 150 * 1024 }), 1280, 800)).toEqual({ ok: true, width: 1280, height: 800, bytes: 150 * 1024 });
  });
  it("caps the request contract: at most 12 captures, base64 only, desktop or mobile", () => {
    const cap = { domain: "Vercel.com", viewport: "desktop", captured_at: "2026-11-17T06:00:00Z", images: { full: "UklGRiQAAABXRUJQVlA4" } };
    expect(thumbPayload.parse({ captures: [cap] }).captures[0]!.domain).toBe("vercel.com");
    expect(thumbPayload.safeParse({ captures: Array(THUMB_LIMITS.maxCaptures + 1).fill(cap) }).success).toBe(false);
    expect(thumbPayload.safeParse({ captures: [{ ...cap, viewport: "tablet" }] }).success).toBe(false);
    expect(thumbPayload.safeParse({ captures: [{ ...cap, images: { full: "not base64!!" } }] }).success).toBe(false);
  });
});

describe("paths, pruning and display", () => {
  it("stores <domain>/<yyyy-mm-dd>-<viewport>.webp with -640w/-320w variants", () => {
    expect(thumbPath("vercel.com", "2026-11-17T06:00:00Z", "desktop")).toBe("vercel.com/2026-11-17-desktop.webp");
    expect(thumbPath("vercel.com", "2026-11-17T06:00:00Z", "mobile", 320)).toBe("vercel.com/2026-11-17-mobile-320w.webp");
    expect(mainPathOf("vercel.com/2026-11-17-mobile-320w.webp")).toBe("vercel.com/2026-11-17-mobile.webp");
    expect(mainPathOf("../secret.webp")).toBeNull();
  });
  const row = (domain: string, day: string, viewport = "desktop", removed: string | null = null): ThumbRow => ({ domain, captured_at: `${day}T06:00:00Z`, viewport, path: `${domain}/${day}-${viewport}.webp`, width: 1280, height: 800, bytes: 1000, variants: [], removed_at: removed });
  it("keeps the latest two captures per domain and viewport", () => {
    const rows = [row("a.com", "2026-11-01"), row("a.com", "2026-11-08"), row("a.com", "2026-11-15"), row("a.com", "2026-11-02", "mobile"), row("b.com", "2026-11-01")];
    expect(pruneOld(rows).map(r => r.path)).toEqual(["a.com/2026-11-01-desktop.webp"]);
  });
  it("falls back to no thumbnail (typographic card) when none is stored or the row is removed", () => {
    expect(pickThumb([], "a.com")).toBeNull();
    expect(pickThumb([row("a.com", "2026-11-15", "desktop", "2026-11-16T00:00:00Z")], "a.com")).toBeNull();
    expect(pickThumb([row("a.com", "2026-11-15", "mobile")], "a.com")?.viewport).toBe("mobile");
    expect(pickThumb([row("a.com", "2026-11-08"), row("a.com", "2026-11-22")], "a.com", "2026-11-16T00:00:00Z")?.captured_at).toBe("2026-11-08T06:00:00Z");
  });
});
