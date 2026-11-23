// S1 polish (owner's review of 23 Nov): the lead stack's one caption block, the Tape's hanging rows, one failed line per region.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LeadPicture } from "./LeadPicture";
import { failStore } from "./Later";
import { Ledger } from "@/components/brand/Ledger";
import type { LeadItem, LeadPlan } from "@/lib/lead-picture";

const item = (domain: string): LeadItem => ({ domain, section: "First screen", date: "2026-11-22", src: `/thumbs/${domain}.webp`, srcSet: null, width: 1280, height: 800,
  asset: `thumb:${domain}`, credit: domain, alt: `${domain} first screen`, live: `https://${domain}/`, report: `/report?asset=${domain}`, role: null });
const stackPlan: LeadPlan = { kind: "mosaic", items: [item("vercel.com"), item("netlify.com")], rule: "pattern" as LeadPlan["rule"], caption: "First screens" };

describe("S1 polish · the front lead's picture stack", () => {
  it("has one caption block under the whole stack: both captures in order with one Report each, then the credit line", () => {
    const html = renderToStaticMarkup(<LeadPicture plan={stackPlan} compact stack />);
    expect(html.match(/<figcaption/g)?.length).toBe(1);
    const cap = html.slice(html.indexOf("<figcaption"));
    expect(cap.indexOf("vercel.com")).toBeLessThan(cap.indexOf("netlify.com"));
    expect(cap.match(/>Report</g)?.length).toBe(2);
    expect(cap).toContain("First screens");
    // the caption comes after the stack, never inside it
    expect(html.indexOf("data-lead-stack")).toBeLessThan(html.indexOf("<figcaption"));
  });
});

describe("S1 polish · the Tape's rows hang under their own text", () => {
  it("puts the icon and chips in their own column and the title in the next", () => {
    const html = renderToStaticMarkup(<Ledger inlineTags rows={[{ key: "a", href: "/a", lead: <i data-lead="" />, tags: ["Type"], title: "Figma changed its type", time: "21 Nov" }]} />);
    const head = html.slice(html.indexOf("ledger-hang-head"), html.indexOf("ledger-hang-text"));
    expect(head).toContain("data-lead");
    expect(head).toContain(">Type<");
    expect(head).not.toContain("Figma changed");
    expect(html.slice(html.indexOf("ledger-hang-text"))).toContain("Figma changed its type");
  });
  it("leaves lists without inline chips as they were", () => {
    const html = renderToStaticMarkup(<Ledger rows={[{ key: "a", href: "/a", tags: ["Type"], title: "A row" }]} />);
    expect(html).not.toContain("ledger-hang");
  });
});

describe("S1 polish · several failed parts of one region show one line and one retry", () => {
  it("only the first failed slot in page order shows the line, and its retry retries every failed slot", () => {
    const s = failStore();
    const a = s.order(), b = s.order();
    const ra = vi.fn(), rb = vi.fn();
    s.add(b, rb);
    expect(s.first()).toBe(b);
    s.add(a, ra);
    expect(s.first()).toBe(a);
    s.retryAll();
    expect(ra).toHaveBeenCalledTimes(1);
    expect(rb).toHaveBeenCalledTimes(1);
    s.drop(a);
    expect(s.first()).toBe(b);
    s.drop(b);
    expect(s.first()).toBeNull();
  });
});
