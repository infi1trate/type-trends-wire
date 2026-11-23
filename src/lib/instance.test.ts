import { describe, expect, it } from "vitest";
import { instanceClock, withInstanceHeaders, INSTANCE_AGE_HEADER, INSTANCE_REQUESTS_HEADER } from "./instance";

describe("instance age header", () => {
  it("counts from the first request, not from module load", () => {
    const c = instanceClock();
    expect(c.seen(1_000_000)).toEqual({ age_s: 0, requests: 1 });
    expect(c.seen(1_009_999)).toEqual({ age_s: 9, requests: 2 });
    expect(c.seen(1_010_000)).toEqual({ age_s: 10, requests: 3 });
  });
  it("sets both headers, copying a response whose headers are read-only", async () => {
    const plain = withInstanceHeaders(new Response("x"), { age_s: 4, requests: 2 });
    expect(plain.headers.get(INSTANCE_AGE_HEADER)).toBe("4");
    const frozen = new Response("body", { status: 201, headers: { a: "1" } });
    Object.defineProperty(frozen, "headers", { value: new Proxy(new Headers({ a: "1" }), { get(t, p) { if (p === "set") return () => { throw new TypeError("immutable"); }; const v = Reflect.get(t, p, t); return typeof v === "function" ? v.bind(t) : v; } }) });
    const out = withInstanceHeaders(frozen, { age_s: 0, requests: 1 });
    expect(out).not.toBe(frozen);
    expect(out.status).toBe(201);
    expect(out.headers.get(INSTANCE_REQUESTS_HEADER)).toBe("1");
    expect(out.headers.get("a")).toBe("1");
    expect(await out.text()).toBe("body");
  });
});
