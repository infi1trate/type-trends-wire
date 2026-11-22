// N3b · two corrections to N3, from the brief's words: (1) the theme-against-palette check is withdrawn — the next run closes its open
// findings with that reason and it never holds a story; (2) "change not visible" does not strip a set of named brands' first screens
// (Nos. 42 and 44, from the stored answers of fixture calls 36 and 38), while one brand's change keeps the N3 rule.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { closeReason, contradictions, findingsOn, reconcile, withdrawnReason } from "./datadesk";
import { decidePicture, isSetStory, parseGraphics, type PictureRef } from "./graphics";
import { checklist } from "./standards";

const ANS = JSON.parse(readFileSync("src/lib/newsroom/__fixtures__/graphics-answers-n3b.json", "utf8")) as { calls: { id: number; story_ids: string[]; answer: unknown }[] };
const answerOf = (id: number) => { const c = ANS.calls.find(x => x.id === id)!; return parseGraphics(c.answer, ["c1", "c2", "c3", "a1", "a2", "a3"]); };
const ref = (r: string, domain: string, o: Partial<PictureRef> = {}): PictureRef => ({ ref: r, asset: `crop:${domain}/hero/${r}.webp`, src: `/crops/${domain}/${r}.webp`, domain, section: "First screen", date: "2026-11-21", role: "after", label: `${r} · ${domain}`, ...o });

describe("N3b · a withdrawn check", () => {
  const card = { domain: "adyen.com", at: "2026-11-21", hero: null, theme: "light", palette: [{ hex: "#0D1721", share: 0.9, name: null }, { hex: "#FFFFFF", share: 0.1, name: null }] };
  it("the daily run no longer opens theme-against-palette findings", () => {
    expect(contradictions([card as never], []).filter(f => f.key.endsWith(":theme-palette"))).toEqual([]);
  });
  it("a finding whose check is not in the run is closed by the next run, with the withdrawn reason", () => {
    const open = [{ id: 7, key: "contradiction:adyen.com:theme-palette", kind: "contradiction" }, { id: 8, key: "contradiction:b.com:theme", kind: "contradiction" }];
    const found = [{ kind: "contradiction" as const, key: "contradiction:b.com:theme", subject: "b.com", measure: "theme", expected: "dark theme", found: "light theme", receipt: {} }];
    expect(reconcile(open, found, new Set(["contradiction"])).close).toEqual([7]);
    expect(closeReason("contradiction:adyen.com:theme-palette", "2026-11-22")).toMatch(/^Check withdrawn: theme against palette is off until the theme and palette labels are defined/);
    expect(closeReason("contradiction:b.com:theme", "2026-11-22")).toBe("No longer found by the daily check on 2026-11-22.");
  });
  it("a withdrawn check never holds a story; the card-against-log theme check still does", () => {
    const withdrawn = { id: 7, kind: "contradiction", subject: "adyen.com", measure: "theme", found: "Light mode above a palette that is 99% dark", key: "contradiction:adyen.com:theme-palette" };
    const real = { id: 8, kind: "contradiction", subject: "adyen.com", measure: "theme", found: "light theme (the brand card)", key: "contradiction:adyen.com:theme" };
    const cites = [{ domain: "adyen.com", measure: "theme" }];
    expect(withdrawnReason(withdrawn.key)).not.toBeNull();
    expect(findingsOn([withdrawn], cites)).toEqual([]);
    const fx = JSON.parse(readFileSync("src/lib/newsroom/__fixtures__/standards-cases.json", "utf8")) as { cases: { number: number; input: Parameters<typeof checklist>[0] }[] };
    const input = fx.cases.find(c => c.number === 43)!.input;
    expect(checklist({ ...input, findings: [withdrawn], cites }).find(x => x.id === "findings")?.result).toBe("pass");
    expect(checklist({ ...input, findings: [withdrawn, real], cites }).find(x => x.id === "findings")?.result).toBe("fail");
  });
});

describe("N3b · change not visible on a set of named brands' first screens", () => {
  it("the set types are roundup, against the grain, breakout, white space and census (agents and sale); one brand's change is not", () => {
    for (const id of ["roundup:all:aesthetic:corporate:2026-11-20", "against:2026-W47:measured", "breakout:css:x:all:13", "white:dev-tools:2026-W47", "census:agents:2026-W47", "census:sale:2026-W47"]) expect(isSetStory(id)).toBe(true);
    for (const id of ["move:4905", "rebrand:x.com:2026-11-20", "brand:coinbase.com:2026-11-20", "quiet:event:4905", "news:45715"]) expect(isSetStory(id)).toBe(false);
  });
  it("No. 42 (call 36): all three first screens stay, the verdict is a desk note", () => {
    const chosen = [ref("c1", "headspace.com"), ref("c2", "readwise.io"), ref("c3", "canva.com")];
    const d = decidePicture(answerOf(36), { chosen, alternates: [], set: true });
    expect(d).toMatchObject({ kind: "rule", verdict: "keep", assets: chosen.map(c => c.asset) });
    expect(d.notes).toHaveLength(1);
    expect(d.notes![0]).toContain("Kept as the named brands' first screens; nothing removed.");
  });
  it("No. 44 (call 38): all three first screens stay, the verdict is a desk note", () => {
    const chosen = [ref("c1", "tailwindcss.com"), ref("c2", "astro.build"), ref("c3", "cloudflare.com")];
    const d = decidePicture(answerOf(38), { chosen, alternates: [], set: true });
    expect(d).toMatchObject({ kind: "rule", verdict: "keep", assets: chosen.map(c => c.asset) });
    expect(d.notes).toHaveLength(1);
  });
  it("a set tile leaves only for its own problem, and fewer than two usable tiles means no lead picture", () => {
    const chosen = [ref("c1", "a.com"), ref("c2", "b.com"), ref("c3", "c.com")];
    const ans = (p: [string, boolean, string][]) => ({ pictures: p.map(([r, usable, problem]) => ({ ref: r, usable, problem: problem as never, why: "x" })), overall: "no picture shows it" as const, why: "w" });
    const one = decidePicture(ans([["c1", false, "cookie or consent banner"], ["c2", false, "change not visible"], ["c3", true, "none"]]), { chosen, alternates: [], set: true });
    expect(one).toMatchObject({ kind: "crop", assets: [chosen[1]!.asset, chosen[2]!.asset] });
    const two = decidePicture(ans([["c1", false, "blank"], ["c2", false, "login wall"], ["c3", false, "change not visible"]]), { chosen, alternates: [], set: true });
    expect(two).toMatchObject({ kind: "none", assets: [] });
    expect(decidePicture(ans([["c1", true, "none"], ["c2", true, "none"], ["c3", true, "none"]]), { chosen, alternates: [], set: true, failing: [chosen[0]!.asset, chosen[1]!.asset] }).kind).toBe("none");
  });
  it("one brand's change is unchanged from N3: no picture shows it removes the picture", () => {
    const chosen = [ref("c1", "gitlab.com", { role: "before" }), ref("c2", "gitlab.com")];
    const d = decidePicture({ pictures: [{ ref: "c1", usable: false, problem: "change not visible", why: "x" }, { ref: "c2", usable: false, problem: "change not visible", why: "x" }], overall: "no picture shows it", why: "w" }, { chosen, alternates: [], set: false });
    expect(d).toMatchObject({ kind: "none", verdict: "none" });
    expect(d.notes ?? []).toEqual([]);
  });
});
