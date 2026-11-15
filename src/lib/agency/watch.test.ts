// @vitest-environment node
import { describe, expect, it } from "vitest";
import { TOKEN_RE, WATCH_LIMITS, applyOp, classify, initialState, newToken, normDomain, parseConsole, editPath, feedPath, viewPath, type WatchState } from "./watch";

const ctx = { active: new Set(["linear.app", "vercel.com", "supabase.com"]), traits: new Set(["css:subgrid", "theme:dark"]) };
const empty: WatchState = { name: "Acme", sites: [], pending_sites: [], traits: [], sectors: [] };

describe("watchlist tokens", () => {
  it("are 22 base64url characters from 16 random bytes", () => {
    let asked = 0;
    const t = newToken(n => { asked = n; return new Uint8Array(n).fill(255); });
    expect(asked).toBe(16);
    expect(t).toBe("_____________________w");
    expect(TOKEN_RE.test(t)).toBe(true);
  });
  it("crypto tokens differ and match the format", () => {
    const xs = Array.from({ length: 200 }, () => newToken());
    expect(new Set(xs).size).toBe(200);
    for (const x of xs) expect(x).toMatch(TOKEN_RE);
  });
  it("link shapes: view, edit (?k=) and feed are separate", () => {
    expect(viewPath("a".repeat(22))).toBe(`/watch/${"a".repeat(22)}`);
    expect(editPath("a".repeat(22), "b".repeat(22))).toBe(`/watch/${"a".repeat(22)}?k=${"b".repeat(22)}`);
    expect(feedPath("c".repeat(22))).toBe(`/api/public/watch-feed/${"c".repeat(22)}.xml`);
  });
});

describe("watchlist validation", () => {
  it("normalizes domains", () => {
    expect(normDomain("https://www.Linear.app/pricing?x=1")).toBe("linear.app");
    expect(normDomain("not a domain")).toBeNull();
  });
  it("sorts inputs into tracked sites, untracked domains, invalid strings, forecast traits and unknown traits", () => {
    const c = classify({ sites: ["vercel.com", "https://linear.app/", "newco.io", "hello world"], traits: ["css:subgrid", "css:nope"] }, ctx);
    expect(c.sites).toEqual(["linear.app", "vercel.com"]);
    expect(c.untracked).toEqual(["newco.io"]);
    expect(c.invalid).toEqual(["hello world"]);
    expect(c.traits).toEqual(["css:subgrid"]);
    expect(c.unknownTraits).toEqual(["css:nope"]);
  });
  it("removes duplicates and sorts", () => {
    const r = applyOp(empty, { op: "add", sites: ["vercel.com", "linear.app", "www.vercel.com"], traits: ["theme:dark", "theme:dark"] }, ctx);
    expect(r.state.sites).toEqual(["linear.app", "vercel.com"]);
    expect(r.state.traits).toEqual(["theme:dark"]);
  });
  it("untracked domains go to pending (and are queued) only with a render request", () => {
    expect(applyOp(empty, { op: "add", sites: ["newco.io"] }, ctx).error).toBe("nothing_valid");
    const r = applyOp(empty, { op: "add", sites: ["newco.io"], request_render: true }, ctx);
    expect(r.state.pending_sites).toEqual(["newco.io"]);
    expect(r.queued).toEqual(["newco.io"]);
  });
  it("pending sites join once tracked", () => {
    const r = applyOp({ ...empty, pending_sites: ["newco.io"] }, { op: "rename", name: "B" }, { ...ctx, active: new Set([...ctx.active, "newco.io"]) });
    expect(r.state.sites).toEqual(["newco.io"]);
    expect(r.state.pending_sites).toEqual([]);
  });
  it("refuses a 26th site or signal whole", () => {
    const many = Array.from({ length: 30 }, (_, i) => `s${i}.com`);
    const big = { active: new Set(many), traits: new Set(Array.from({ length: 30 }, (_, i) => `css:f${i}`)) };
    const full = applyOp(empty, { op: "add", sites: many.slice(0, WATCH_LIMITS.sites) }, big);
    expect(full.error).toBeNull();
    expect(full.state.sites).toHaveLength(25);
    const over = applyOp(full.state, { op: "add", sites: [many[29]!] }, big);
    expect(over.error).toBe("limit");
    expect(over.state.sites).toHaveLength(25);
    expect(applyOp(empty, { op: "add", traits: [...big.traits].slice(0, 26) }, big).error).toBe("limit");
  });
  it("names are trimmed to 80 characters and required", () => {
    expect(initialState({ name: "x".repeat(120), sites: [], traits: [] }, ctx).state.name).toHaveLength(80);
    expect(initialState({ name: "   ", sites: [], traits: [] }, ctx).error).toBe("empty_name");
    expect(initialState({ name: "Empty is fine", sites: [], traits: [] }, ctx).error).toBeNull();
  });
  it("remove drops sites, pending sites and traits", () => {
    const r = applyOp({ ...empty, sites: ["linear.app", "vercel.com"], pending_sites: ["newco.io"], traits: ["css:subgrid"] }, { op: "remove", sites: ["https://linear.app", "newco.io"], traits: ["css:subgrid"] }, ctx);
    expect(r.state).toMatchObject({ sites: ["vercel.com"], pending_sites: [], traits: [] });
  });
});

describe("console commands", () => {
  it("parses watch and audit commands", () => {
    expect(parseConsole("watch")).toEqual({ cmd: "panel" });
    expect(parseConsole("watch new Acme competitors")).toEqual({ cmd: "new", name: "Acme competitors" });
    expect(parseConsole("watch add linear.app css:subgrid")).toEqual({ cmd: "add", targets: ["linear.app", "css:subgrid"] });
    expect(parseConsole("watch rm vercel.com")).toEqual({ cmd: "rm", targets: ["vercel.com"] });
    expect(parseConsole(`watch open https://x.test/watch/${"a".repeat(22)}?range=week`)).toEqual({ cmd: "open", id: "a".repeat(22) });
    expect(parseConsole("watch open nope")).toBeNull();
    expect(parseConsole("audit a.com, b.com c.com")).toEqual({ cmd: "audit", sites: ["a.com", "b.com", "c.com"] });
    expect(parseConsole("type fintech")).toBeNull();
  });
});
