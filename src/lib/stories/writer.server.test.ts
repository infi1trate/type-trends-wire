// E2b · the writer's orchestration over memory I/O: fallback order, the daily and per-build limits, waiting instead of falling back.
import { describe, expect, it } from "vitest";
import { AI_MODELS } from "../ai-models";
import { triedWriter, writeStories, type TextInsert, type WriterIO } from "./writer.server";
import { WRITER_PER_DAY, type WriterFacts } from "./writer";

const facts: WriterFacts = { type: "move", kind: "Move", sector: null, brands: [{ name: "DocuSign", role: "subject" }], changes: [], copy: [], headline_call: null, numbers: [], lines: [], dates: ["2026-11-14"], rebrand: false };
const job = (id: string) => ({ story: { id, type: "move", headline: "DocuSign changed its accent", deck: "Deck.", facts: [], sector: null, signal_keys: [], domains: ["docusign.com"], source_ids: [], basis: "measured", happened_at: "2026-11-14T12:00:00Z", kicker: "Move" }, facts, template: { headline: "DocuSign changed its accent", deck: "Deck.", body: [], how_we_know: "Measured from captures on 14 November." } });
const io = (o: { used?: number; ok?: boolean } = {}) => {
  const calls: string[] = [], rows: TextInsert[] = [];
  const x: WriterIO = { used: async () => o.used ?? 0, runs: () => true, call: async model => { calls.push(model); return o.ok ? { raw: null, cost: 0.01 } : { raw: "not json", cost: 0.01 }; }, versions: async () => new Map([["a", 2]]), insert: async r => { rows.push(...r); return r.length; } };
  return { x, calls, rows };
};
const later = () => Date.now() + 600_000;

describe("writer orchestration", () => {
  it("T2 · an answer not in the fixed shape gets one retry, then the template is stored unchecked as the next version", async () => {
    const m = io(), r = await writeStories([job("a")], m.x, { names: ["DocuSign"] }, { deadline: later() });
    expect(m.calls).toEqual([AI_MODELS.writer, AI_MODELS.writer]);
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0]).toMatchObject({ story_id: "a", version: 3, model: "template", checked: false, attempts: 2, headline: "DocuSign changed its accent" });
    expect(r.calls).toBe(2);
  });
  it("T2 · a refused call is not retried: one call, the template stands", async () => {
    const m = io(); m.x.call = async (model: string) => { m.calls.push(model); return { raw: null, cost: 0.01, refused: true }; };
    await writeStories([job("a")], m.x, { names: ["DocuSign"] }, { deadline: later() });
    expect(m.calls).toEqual([AI_MODELS.writer]);
    expect(m.rows[0]).toMatchObject({ model: "template", attempts: 1 });
  });
  it("the 13th writer call of a day is not made: the story waits, no text-model fallback, no row", async () => {
    const m = io({ used: WRITER_PER_DAY }), r = await writeStories([job("a"), job("b")], m.x, { names: ["DocuSign"] }, { deadline: later() });
    expect(m.calls).toEqual([]); expect(m.rows).toEqual([]); expect(r.skipped).toBe(2);
  });
  it("with one call left today, exactly one writer call is made", async () => {
    const m = io({ used: WRITER_PER_DAY - 1 }); await writeStories([job("a"), job("b"), job("c")], m.x, { names: ["DocuSign"] }, { deadline: later() });
    expect(m.calls.filter(c => c === AI_MODELS.writer)).toHaveLength(1);
  });
  it("at most six writer calls in one build", async () => {
    const m = io(); await writeStories(["a", "b", "c", "d", "e", "f", "g", "h"].map(job), m.x, { names: ["DocuSign"] }, { deadline: later(), perBuild: 99 });
    expect(m.calls.filter(c => c === AI_MODELS.writer).length).toBeLessThanOrEqual(6);
  });
  it("no call starts without time left before the deadline", async () => {
    const m = io(); const r = await writeStories([job("a")], m.x, { names: ["DocuSign"] }, { deadline: Date.now() + 1000 });
    expect(m.calls).toEqual([]); expect(r.skipped).toBe(1);
  });
  it("a version made without reaching the writer is owed again; one where the writer failed twice is not", () => {
    expect(triedWriter({ model: AI_MODELS.text, attempts: 1 })).toBe(false);
    expect(triedWriter({ model: "template", attempts: 3 })).toBe(true);
    expect(triedWriter({ model: AI_MODELS.writer, attempts: 1 })).toBe(true);
    expect(triedWriter({ model: "template", attempts: 2, failures: ["no usable answer"] })).toBe(true);
    expect(triedWriter({ model: "template", attempts: 1, failures: [] })).toBe(false);
  });
});
