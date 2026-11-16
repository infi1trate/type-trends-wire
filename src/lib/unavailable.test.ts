import { describe, expect, it } from "vitest";
import { retryLater, RETRY_AFTER_S } from "./unavailable";

const page = (status: number, h: Record<string, string>) => new Response("<html></html>", { status, headers: { "content-type": "text/html; charset=utf-8", ...h } });
describe("a gallery read that gave up", () => {
  it("answers 503 with Retry-After instead of 500", async () => {
    const r = retryLater(page(500, { "Retry-After": String(RETRY_AFTER_S) }));
    expect([r.status, r.headers.get("retry-after"), await r.text()]).toEqual([503, "30", "<html></html>"]);
  });
  it("leaves every other response alone", () => {
    expect(retryLater(page(500, {})).status).toBe(500);
    expect(retryLater(page(200, { "Retry-After": "30" })).status).toBe(200);
    expect(retryLater(new Response("{}", { status: 500, headers: { "content-type": "application/json", "Retry-After": "30" } })).status).toBe(500);
  });
});
