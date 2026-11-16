import { describe, expect, it } from "vitest";
import { memo, memoBy, withRetry } from "./memo";

const noSleep = () => Promise.resolve();
const failOnce = <T,>(v: T) => { let n = 0; return { calls: () => n, load: async () => { n++; if (n === 1) throw new Error("canceling statement due to statement timeout"); return v; } }; };

describe("memo: never cache a failure", () => {
  it("a loader that fails once then succeeds returns the data on the second call and leaves nothing rejected behind", async () => {
    const l = failOnce({ ok: 1 }), m = memo(60_000, l.load, { retries: 0, sleep: noSleep });
    await expect(m()).rejects.toThrow(/statement timeout/);
    expect([m.pending(), m.size(), m.peek()]).toEqual([0, 0, undefined]);
    await expect(m()).resolves.toEqual({ ok: 1 });
    expect([l.calls(), m.pending(), m.size()]).toEqual([2, 0, 1]);
    await m(); expect(l.calls()).toBe(2); // the settled value is reused
  });
  it("one retry with a short backoff inside the loader: a single failure never reaches the page", async () => {
    const waits: number[] = [], l = failOnce("rows");
    const m = memo(60_000, l.load, { sleep: async ms => { waits.push(ms); } });
    await expect(m()).resolves.toBe("rows");
    expect([l.calls(), waits]).toEqual([2, [250]]);
    let n = 0;
    await expect(withRetry(async () => { n++; throw new Error("down"); }, 1, 10, noSleep)).rejects.toThrow("down");
    expect(n).toBe(2); // gives up after one retry
  });
  it("a load left pending by a request that ended is not inherited: the next caller loads for itself", async () => {
    let n = 0, orphan!: (e: Error) => void;
    const m = memo(60_000, () => { n++; return n === 1 ? new Promise<string>((_, rej) => { orphan = rej; }) : Promise.resolve("fresh"); }, { retries: 0 });
    const first = m(); first.catch(() => undefined);
    const second = m(); // joins the load in flight
    orphan(new Error("This promise was created by a request that has since ended, so it can never settle."));
    await expect(second).resolves.toBe("fresh");
    expect([n, m.pending(), m.size()]).toEqual([2, 0, 1]);
  });
  it("values expire after the TTL; keyed memos keep keys apart", async () => {
    let t = 0, n = 0;
    const m = memoBy(1000, async (k: string) => `${k}${++n}`, { now: () => t, key: k => k });
    expect(await m("a")).toBe("a1"); expect(await m("b")).toBe("b2"); expect(await m("a")).toBe("a1");
    t = 1001; expect(await m("a")).toBe("a3");
  });
});
