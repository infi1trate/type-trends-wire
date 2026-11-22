// L2 · queue kind `phase` (filed and moved), and the Digest package check's picture and change rules.
import { describe, expect, it } from "vitest";
import { moveDecision, needsProposal, phaseProblem, QUEUE_KINDS } from "./queue";
import { CHANGES_MAX, CHANGES_MIN, picturesItem } from "./publisher";
import { deskBody } from "../stories/desk";
import { leadAsPicture } from "../digest/edition";

describe("queue kind phase", () => {
  it("is a kind that needs no proposal and must name its phase in 2 to 12 characters", () => {
    expect(QUEUE_KINDS).toContain("phase");
    expect(needsProposal("phase")).toBe(false);
    expect(phaseProblem("phase", "L2")).toBeNull();
    expect(phaseProblem("phase", "L")).toMatch(/2 to 12 characters/);
    expect(phaseProblem("phase", "L2-chart-library")).toMatch(/2 to 12 characters/);
    expect(phaseProblem("phase", undefined)).toMatch(/2 to 12 characters/);
    expect(phaseProblem("bug", "L2")).toMatch(/Only a phase item/);
    expect(phaseProblem("bug", undefined)).toBeNull();
  });
  it("is filed through the door's request shape", () => {
    const b = deskBody.safeParse({ action: "queue_add", title: "L2 · chart library", why: "The owner's L2 brief, approved 22 Nov.", kind: "phase", phase: "L2", expects: "no visible change" });
    expect(b.success).toBe(true);
  });
  it("moves queued → briefed → built without a proposal, and goes live only after a passed gate", () => {
    const at = (status: Parameters<typeof moveDecision>[0]["status"], to: string, gatePass: boolean | null = null) => moveDecision({ kind: "phase", status, to, actor: "engineering", reason: null, proposal: null, gatePass });
    expect(at("queued", "briefed")).toEqual({ ok: true });
    expect(at("briefed", "built")).toEqual({ ok: true });
    expect(at("gate passed", "live", true)).toEqual({ ok: true });
    expect(at("gate passed", "live", false).ok).toBe(false);
    expect(moveDecision({ kind: "feature", status: "queued", to: "briefed", actor: "engineering", reason: null, proposal: null, gatePass: null }).ok).toBe(false);
  });
});

describe("the Digest package check: pictures and changes", () => {
  it("no pictures in a week where a published story had one fails", () => {
    expect(picturesItem("Pictures", 0, 3).ok).toBe(false);
    expect(picturesItem("Pictures", 0, 1).ok).toBe(false);
  });
  it("fewer than three because the week had fewer is recorded, not failed", () => {
    const one = picturesItem("Pictures", 1, 1);
    expect(one.ok).toBe(true);
    expect(one.detail).toMatch(/recorded/);
    expect(picturesItem("Pictures", 0, 0).ok).toBe(true);
    expect(picturesItem("Pictures", 2, 5).ok).toBe(false);
    expect(picturesItem("Pictures", 3, 5).ok).toBe(true);
  });
  it("changes: three to five pass, under three fails", () => {
    expect([CHANGES_MIN, CHANGES_MAX]).toEqual([3, 5]);
  });
  it("an issue row can carry a story's lead picture (a breakout's mosaic)", () => {
    const plan = { kind: "mosaic", items: [{ domain: "netlify.com" }] } as never;
    expect(leadAsPicture(plan)?.kind).toBe("lead");
    expect(leadAsPicture(null)).toBeNull();
    expect(leadAsPicture({ kind: "mosaic", items: [] } as never)).toBeNull();
  });
});
