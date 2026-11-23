import { describe, expect, it } from "vitest";
import * as pub from "./publisher";

const H = 3_600_000, at = (iso: string) => iso, NOW = Date.parse("2026-11-23T14:00:00Z");
const row = (id: number, iso: string, pass: boolean, week = "2026-W47", test = false): pub.CheckRow => ({ id, at: at(iso), week, pass, test });
describe("D1c · the publisher can try again", () => {
  it("re-checks the newest issue when its last check failed six hours or more ago", () => {
    const d = pub.recheckDue([row(3, "2026-11-23T02:00:00Z", false)], NOW);
    expect(d).toMatchObject({ due: true, week: "2026-W47", recheck: 1 });
  });
  it("waits six hours between re-checks", () => {
    const d = pub.recheckDue([row(3, "2026-11-23T02:00:00Z", false), row(4, "2026-11-23T10:00:00Z", false)], NOW);
    expect(d).toEqual({ due: false, week: "2026-W47", why: "2026-W47: next re-check after 16:00 UTC" });
    expect(pub.recheckDue([row(3, "2026-11-23T02:00:00Z", false), row(4, "2026-11-23T08:00:00Z", false)], NOW).due).toBe(true);
  });
  it("re-checks one issue at most four times", () => {
    const rows = [0, 1, 2, 3, 4].map(k => row(3 + k, new Date(NOW - (40 - 7 * k) * H).toISOString(), false));
    expect(pub.recheckDue(rows, NOW)).toEqual({ due: false, week: "2026-W47", why: "2026-W47: all 4 re-checks used" });
    expect(pub.recheckDue(rows.slice(0, 4), NOW).due).toBe(true);
  });
  it("does nothing once the issue passed, and ignores test checks", () => {
    expect(pub.recheckDue([row(3, "2026-11-23T02:00:00Z", false), row(4, "2026-11-23T03:00:00Z", true)], NOW).due).toBe(false);
    expect(pub.recheckDue([row(3, "2026-11-23T02:00:00Z", true), row(9, "2026-11-23T03:00:00Z", false, "2026-W47", true)], NOW).due).toBe(false);
  });
  it("the closing note names the week and the passing row", () => {
    expect(pub.recheckCloseReason("2026-W47", 5)).toBe("no longer found: the package check for 2026-W47 passed on a re-check (row 5)");
  });
  it("each link gets 10 s and one retry; a 200 slower than 3 s is named slow, not failed", () => {
    expect([pub.LINK_TIMEOUT_MS, pub.LINK_TRIES, pub.SLOW_LINK_MS]).toEqual([10_000, 2, 3_000]);
    const issue: pub.PackageIssue = { week: "2026-W47", number: 2, words: 540, rows: [1, 2, 3, 4, 5].map(n => ({ href: `/stories/no/${n}`, picture: n <= 3 })), chart: { href: "/stories/no/1" }, cover: { id: "a", href: "/stories/no/1", subject: "Coinbase" }, links: [] };
    const rss = (link: string) => ({ status: 200, body: `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title><item><title>a</title><link>${link}</link></item></channel></rss>` });
    const items = pub.packageChecks({ now: NOW, closed: true, issue, share: { status: 200, type: "image/png", bytes: 60_000 }, cover: { status: 200 }, digestRss: rss("https://slug.global/digest/2026-W47"), morningRss: rss("https://slug.global/morning/2026-11-23"), morningNewest: "2026-11-23", links: [{ path: "/digest/2026-W47", status: 200, ms: 900 }, { path: "/terminal?panel=library", status: 200, ms: 4_900 }] });
    const links = items.find(i => i.id === "links")!;
    expect(links.ok).toBe(true);
    expect(links.detail).toBe("2 of 2 answer 200; slow: /terminal?panel=library (4.9 s)");
  });
});
