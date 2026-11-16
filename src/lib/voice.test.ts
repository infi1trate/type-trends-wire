import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { VOICE, VOICE_IDS, say, inInventory, type Said } from "./voice";

const walk = (d: string): string[] => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(n) && !/\.test\./.test(n) ? [p] : []; });
// A string literal or JSX text that reads like an empty, loading, failed or not-found state (same rule the inventory was built from).
const STATE = /(["`>])((?:No |Nothing|None )[^"`<>{}\n]{3,}|[^"`<>{}\n]*\b(?:yet\.|LOADING|Loading|Checking|Creating|Trying again|[Uu]navailable|UNAVAILABLE|didn.t load|couldn.t be read|NOT FOUND)[^"`<>{}\n]*)(["`<])/g;
/** Copy that matches the pattern but describes a product, not a state. */
const NOT_STATES = new Set([
  "Type, color, layout, voice, how each site sits against the market and the open territory none of them use yet. Print it as a PDF appendix.",
  "Compare two to six sites side by side: type, color, layout, vibe, versus the market and the open territory nobody uses yet.",
  "Compare 2–6 sites on type, color, layout and voice, and find the open territory none of them use yet.",
  ": the target quarter hasn't closed in the data yet.", "No (already there)",
]);
const all = Object.entries(VOICE as Record<string, Said>);

describe("voice inventory", () => {
  it("no component renders a state string that is not in the inventory", () => {
    const loose: string[] = [];
    for (const f of [...walk("src/components"), ...walk("src/routes")]) readFileSync(f, "utf8").split("\n").forEach((l, n) => {
      if (/^\s*import /.test(l)) return;
      for (const m of l.matchAll(STATE)) {
        const t = m[2]!.trim(), before = l.slice(0, m.index);
        if (t.length < 4 || NOT_STATES.has(t) || /data-[a-z-]+=$/.test(before.trimEnd()) || t.startsWith("@/") || t.endsWith("=")) continue;
        if (!inInventory(t)) loose.push(`${f}:${n + 1} ${t}`);
      }
    });
    expect(loose).toEqual([]);
  });
  it("every entry says where it shows; failed and not-found pages have a title and a next step", () => {
    for (const [id, e] of all) {
      expect(e.where, id).not.toBe(""); expect(e.text.trim(), id).not.toBe("");
      if ((e.kind === "failed" || e.kind === "notFound" || e.kind === "offline") && !id.startsWith("site.notFound.")) {
        if (!/^(terminal|library|chart)\.|^read\.|^tools\.|^agency\.|^ambient\./.test(id)) expect(e.title, id).toBeTruthy();
        expect(e.next.length, id).toBeGreaterThan(0);
      }
    }
  });
  it("never apologises, never says Oops, never leaves a bare spinner", () => {
    for (const [id, e] of all) {
      expect(`${e.title ?? ""} ${e.text}`, id).not.toMatch(/\b(oops|sorry|apolog|unfortunately|something went wrong)\b/i);
      if (e.kind === "loading") expect(e.text, id).toMatch(/[A-Za-z]{4,}/);
    }
  });
  it("the 404 offers the front page, brands and signals; the newest story line is its own entry", () => {
    const hrefs = VOICE["site.notFound"].next.flatMap(s => ("href" in s ? [s.href] : []));
    expect(hrefs).toEqual(expect.arrayContaining(["/", "/brands", "/signals"]));
    expect(VOICE_IDS).toContain("site.notFound.newest"); expect(VOICE_IDS).toContain("site.offline");
  });
  it("fills values and matches templated sentences", () => {
    expect(say("morningDay.notFound", { date: "2026-02-30", first: "2026-11-01" }).text).toBe("The Morning Line has no edition for “2026-02-30”. Editions run daily (UTC) from 2026-11-01 to today, written as YYYY-MM-DD.");
    expect(inInventory("Nothing tracked matches “zzz”. Try part of the name or domain.")).toBe(true);
    expect(inInventory("No widgets here yet.")).toBe(false);
  });
  it("counts the states", () => { expect(VOICE_IDS.length).toBeGreaterThan(150); });
});
