// E2e · measurement integrity: two before, two after, one transition, and the headline element — on the real capture sequences.
import { describe, expect, it } from "vitest";
import data from "./__fixtures__/integrity-captures.json";
import { checkEvent, splitChecked, type Capture, type Check } from "./integrity";

type E = { id: number; domain: string; type: string; before: unknown; after: unknown; detected_at: string; page_type?: string | null; snapshot_id?: number | null; prev_snapshot_id?: number | null };
const fx = data as unknown as Record<string, { captures: Capture[]; events: E[] }>;
const ev = (d: string, id: number) => fx[d]!.events.find(e => e.id === id)!;
const run = (d: string, id: number, caps: Capture[] = fx[d]!.captures) => checkEvent(ev(d, id), caps);

describe("the three conditions, on real sequences", () => {
  it("DocuSign accent #2B0673 → #4C00FF: the earlier value was seen in one capture (11 Nov 05:00), so two before fails", () => {
    const c = run("docusign.com", 3386).fields["accent"]!;
    expect(c).toMatchObject({ verdict: "seen_once", before: 1, transitions: 1 });
    expect(c.failed).toEqual(["two_before"]);
  });
  it("Miro headline font Roobert PRO, Apris, Apris, —, Roobert PRO, Apris…: it alternates (three transitions in 14 days)", () => {
    const c = run("miro.com", 1336).fields["h1"]!;
    expect(c.verdict).toBe("alternating"); expect(c.transitions).toBe(3); expect(c.failed).toContain("one_transition");
  });
  it("Vuori hero video, video, video, still, video, video, still…: alternating", () => {
    const c = run("vuoriclothing.com", 3414).fields["hero_media"]!;
    expect(c.verdict).toBe("alternating"); expect(c.transitions).toBe(3);
  });
  it("Netlify (20 Nov): three captures before, seven after, one transition — every field passes", () => {
    for (const id of [4756, 4757, 4758, 4759]) {
      const c = run("netlify.com", id); expect(c.verdict, String(id)).toBe("pass");
      for (const f of Object.values(c.fields)) { expect(f.before).toBeGreaterThanOrEqual(2); expect(f.after).toBeGreaterThanOrEqual(2); expect(f.beforeHours).toBeGreaterThanOrEqual(6); expect(f.afterHours).toBeGreaterThanOrEqual(6); expect(f.transitions).toBe(1); }
    }
  });
  it("On hero video → still: two before, many after, one transition — passes", () => {
    expect(run("on.com", 3348).fields["hero_media"]).toMatchObject({ verdict: "pass", before: 2, transitions: 1 });
  });
  it("two captures less than six hours apart are not two before", () => {
    const caps = fx["netlify.com"]!.captures, e = ev("netlify.com", 4758), firstAfter = caps.findIndex(c => c.id === e.snapshot_id) - 1;
    // Keep only the last capture before the change and one taken an hour earlier with the same value.
    const before = caps[firstAfter]!, near = { ...before, id: -1, at: new Date(Date.parse(before.at) - 36e5).toISOString() };
    expect(checkEvent(e, [near, before, ...caps.slice(firstAfter + 1)]).fields["hero_media"]?.failed).toEqual(["two_before"]);
  });
});

describe("the headline element", () => {
  it("DocuSign: the earlier headline was read from the largest text, not the h1 — headline fields are not compared", () => {
    const c = run("docusign.com", 3387);
    expect(c.verdict).toBe("headline_element"); expect(c.fields["headline"]?.verdict).toBe("headline_element");
  });
  it("The Light Phone: no h1 in any capture — headline font, alignment and text are not compared; nothing is a change", () => {
    for (const id of [3365, 3366, 3367, 3368]) expect(run("thelightphone.com", id).verdict, String(id)).toBe("headline_element");
    const { tape, unconfirmed } = splitChecked([3365, 3366, 3367].map(id => ev("thelightphone.com", id)), new Map([3365, 3366, 3367].map(id => [id, run("thelightphone.com", id)])));
    expect(tape).toHaveLength(0); expect(unconfirmed).toHaveLength(0); // not even in the Data view list
  });
  it("body font, palette, accent, hero, grid and corners are unaffected by the headline source", () => {
    const caps = fx["netlify.com"]!.captures.map(c => ({ ...c, source: "largest_text" }));
    expect(run("netlify.com", 4758, caps).verdict).toBe("pass"); // hero
    expect(run("netlify.com", 4756, caps).fields["h1"]?.verdict).toBe("headline_element");
    expect(run("netlify.com", 4756, caps).fields["body"]?.verdict).toBe("pass");
  });
});

describe("the Data view list and the tape", () => {
  it("a change that fails is listed in the Data view (Seen once / Alternating), not on the tape", () => {
    const evs = [ev("docusign.com", 3386), ev("miro.com", 1336), ev("on.com", 3348)];
    const checks = new Map<number, Check>([[3386, run("docusign.com", 3386)], [1336, run("miro.com", 1336)], [3348, run("on.com", 3348)]]);
    const { tape, unconfirmed } = splitChecked(evs, checks);
    expect(tape.map(e => e.id)).toEqual([3348]);
    expect(unconfirmed.map(u => [u.id, u.label])).toEqual([[3386, "Seen once"], [1336, "Alternating"]]);
  });
  it("a live change with no verdict yet is on neither list; an archive change is not judged here", () => {
    const e = ev("on.com", 3348);
    expect(splitChecked([e], new Map())).toEqual({ tape: [], unconfirmed: [] });
    expect(splitChecked([{ ...e, source: "wayback" }], new Map()).tape).toHaveLength(1);
  });
  it("a change seen once after moves to the tape when two later captures, six hours apart, confirm it", () => {
    const caps = fx["netlify.com"]!.captures, e = ev("netlify.com", 4758), k = caps.findIndex(c => c.id === e.snapshot_id);
    const early = caps.slice(0, k + 1); // the change's own capture is the only one showing the new hero
    const first = checkEvent(e, early);
    expect(first.fields["hero_media"]).toMatchObject({ verdict: "seen_once", failed: ["two_after"] });
    expect(splitChecked([e], new Map([[e.id, first]])).unconfirmed.map(u => u.label)).toEqual(["Seen once"]);
    const later = [...early, ...[7, 14].map((h, i) => ({ ...caps[k]!, id: -10 - i, at: new Date(Date.parse(caps[k]!.at) + h * 36e5).toISOString() }))];
    const now = checkEvent(e, later);
    expect(now.verdict).toBe("pass");
    expect(splitChecked([e], new Map([[e.id, now]])).tape.map(x => x.id)).toEqual([e.id]);
  });
  it("a change with one passing and one failing field keeps only the passing part on the tape", () => {
    const pal = ev("docusign.com", 3386), c: Check = { verdict: "pass", pass: ["palette"], fields: { palette: { verdict: "pass", failed: [], before: 2, after: 2, beforeHours: 7, afterHours: 7, transitions: 1 }, accent: run("docusign.com", 3386).fields["accent"]! } };
    const both = { ...pal, before: { accent: "#2B0673", palette: ["#000000"] }, after: { accent: "#4C00FF", palette: ["#FFFFFF"] } };
    const { tape, unconfirmed } = splitChecked([both], new Map([[pal.id, c]]));
    expect(tape[0]?.after).toEqual({ palette: ["#FFFFFF"] }); expect(unconfirmed[0]?.after).toEqual({ accent: "#4C00FF" });
  });
});
