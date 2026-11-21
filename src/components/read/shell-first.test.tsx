// P1 · shell first: each split Read route awaits only its critical read. Deferred reads are started (prefetchQuery) but never
// awaited, so a deferred read that never settles must not hold the loader (and so the first byte) back.
import { describe, expect, it } from "vitest";

type Opts = { queryKey: readonly unknown[] };
function client(critical: (key: readonly unknown[]) => unknown) {
  const started: string[] = [], awaited: string[] = [];
  return {
    started, awaited,
    queryClient: {
      prefetchQuery: (o: Opts) => { started.push(String(o.queryKey[0])); return new Promise(() => {}); },
      ensureQueryData: (o: Opts) => { awaited.push(String(o.queryKey[0])); return Promise.resolve(critical(o.queryKey)); },
    },
  };
}
const within = <T,>(p: Promise<T>, ms = 500) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error("loader waited on a deferred read")), ms))]);
type Loader = (a: Record<string, unknown>) => unknown;
const loaderOf = (r: unknown) => (r as { options: { loader: Loader } }).options.loader;

describe("split Read loaders never await deferred reads", { timeout: 30_000 }, () => {
  it("E3b · a tracked brand's page awaits nothing: the seeded name gives head and frame, the card streams", async () => {
    const { Route } = await import("@/routes/brands.$domain");
    const c = client(() => ({ name: "GoPro", sectorName: "Consumer", soWhat: "x" }));
    const r = await within(Promise.resolve(loaderOf(Route)({ context: c, params: { domain: "netlify.com" }, deps: { data: false } })));
    expect(c.awaited).toEqual([]);
    expect(c.started.sort()).toEqual(["brand-card", "brand-moves", "brand-sections", "brand-sector", "brand-similar", "brand-stories", "brand-surfaces"]);
    expect(r).toEqual({ name: "Netlify", data: false });
  });
  it("E3b · story page awaits only its head and streams the body and earlier stories", async () => {
    const { Route } = await import("@/routes/stories.$id");
    const c = client(() => ({ headline: "h", deck: null, kicker: "k", ran: true }));
    await within(Promise.resolve(loaderOf(Route)({ context: c, params: { id: "story-1" }, deps: { data: false } })));
    expect(c.awaited).toEqual(["story-head"]);
    expect(c.started).toEqual(["story-lead", "story-related"]);
  });
  it("E3b · front page awaits nothing: the lead and live column stream too", async () => {
    const { Route } = await import("@/routes/index");
    const c = client(() => ({}));
    await within(Promise.resolve(loaderOf(Route)({ context: c, deps: { sector: "all", format: "all" } })));
    expect(c.awaited).toEqual([]);
    expect(c.started).toEqual(["front-top", "front-rest", "front-also", "front-tape"]);
  });
  it("signal, pattern and sector pages await their head only", async () => {
    const sig = client(() => ({ key: "aesthetic:brutalist", name: "Brutalist" }));
    await within(Promise.resolve(loaderOf((await import("@/routes/signals.$key")).Route)({ context: sig, params: { key: "aesthetic:brutalist" }, deps: { data: false } })));
    expect([sig.awaited, sig.started]).toEqual([["trait-head"], ["trait-page"]]);
    const pat = client(() => ({ name: "Brutalist", total: 3, dimension: "aesthetic" }));
    await within(Promise.resolve(loaderOf((await import("@/routes/patterns.$key")).Route)({ context: pat, params: { key: "aesthetic:brutalist" }, deps: { sector: "all", data: false } })));
    expect([pat.awaited, pat.started]).toEqual([["pattern-head"], ["pattern"]]);
    const sec = client(() => ({ title: "t", basis: "b", name: "n" }));
    await within(Promise.resolve(loaderOf((await import("@/routes/sectors.$sector")).Route)({ context: sec, params: { sector: "fintech" } })));
    expect(sec.awaited).toEqual(["sector-head"]);
  });
  it("brand and signal indexes await nothing before the shell", async () => {
    for (const [path, deps] of [["@/routes/brands.index", {}], ["@/routes/signals.index", { v: { tab: "all", sort: "momentum", sector: "all", archive: false } }], ["@/routes/sectors.index", {}]] as const) {
      const c = client(() => null);
      const mod = path === "@/routes/brands.index" ? await import("@/routes/brands.index") : path === "@/routes/signals.index" ? await import("@/routes/signals.index") : await import("@/routes/sectors.index");
      await within(Promise.resolve(loaderOf(mod.Route)({ context: c, deps })));
      expect(c.awaited, path).toEqual([]);
      expect(c.started.length, path).toBe(1);
    }
  });
  it("an unknown brand or story is a 404 from the critical read", async () => {
    const b = client(() => null);
    await expect(Promise.resolve(loaderOf((await import("@/routes/brands.$domain")).Route)({ context: b, params: { domain: "nope.example" }, deps: { data: false } }))).rejects.toMatchObject({ isNotFound: true });
    const s = client(() => null);
    await expect(Promise.resolve(loaderOf((await import("@/routes/stories.$id")).Route)({ context: s, params: { id: "no-such-story" }, deps: { data: false } }))).rejects.toMatchObject({ isNotFound: true });
  });
});
