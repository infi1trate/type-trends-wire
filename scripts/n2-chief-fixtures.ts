// N2 · Part 6: freeze the editor in chief's replay of 19, 20 and 21 Nov: the stories the engine ran each day (as they stood at the end
// of that day), the leads of the seven days before, and that day's slots. Reads only. `bun scripts/n2-chief-fixtures.ts`.
import { readFileSync, writeFileSync } from "node:fs";
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { reviewInput } = await import("../src/lib/newsroom/review.server");
const { slotsFor } = await import("../src/lib/newsroom/chief");
const { rankScores, leadAllowed } = await import("../src/lib/stories/score");
const { storyRaw } = await import("../src/lib/stories/read.server");
const { overlay } = await import("../src/lib/stories/edits");
const beats = readFileSync("newsroom/beats.md", "utf8");
const DAYS = ["2026-11-19", "2026-11-20", "2026-11-21"];
const parts = (c: unknown) => { const o = (c && typeof c === "object" ? c : {}) as Record<string, { value?: number }>; const v = (k: string) => Number(o[k]?.value ?? 0); return { size: v("size"), brand: v("brand"), novelty: v("novelty"), relevance: v("relevance"), total: v("size") + v("brand") + v("novelty") + v("relevance") }; };
const raw = await storyRaw();
const out = [];
for (const day of DAYS) {
  const end = `${day}T23:59:59Z`, endMs = Date.parse(end);
  // As of the end of the day: stories stored by then, edits made by then.
  const asOf = overlay(raw.stories.filter(s => s.created_at <= end), raw.edits.filter(e => e.at <= end), endMs);
  const ran = asOf.filter(s => s.status === "published" && s.type !== "launch" && s.happened_at.slice(0, 10) === day);
  const stream = asOf.filter(s => s.state === "published" && s.type !== "launch") as never[];
  const rank = rankScores(stream);
  const leads = [...Array(7)].map((_, k) => new Date(Date.parse(`${day}T00:00:00Z`) - (k + 1) * 864e5).toISOString().slice(0, 10)).flatMap(d => {
    const xs = (stream as { id: string; happened_at: string; headline: string; type: string; score: number }[]).filter(s => s.happened_at.slice(0, 10) === d && leadAllowed(s as never, stream)).sort((a, b) => (rank.get(b.id) ?? b.score) - (rank.get(a.id) ?? a.score));
    return xs[0] ? [{ day: d, headline: xs[0].headline, type: xs[0].type }] : [];
  });
  const stories = [];
  for (const s of ran.sort((a, b) => b.score - a.score)) {
    const i = await reviewInput(s.id, null, { asOf: end }).catch(() => null);
    stories.push({ id: s.id, type: s.id.startsWith("census:") ? "census" : s.id.startsWith("quiet:") ? "quiet change" : s.type, headline: i?.headline ?? s.headline, deck: i?.deck ?? s.deck, facts: i?.numbers.length ?? 0, picture: i?.picture?.kind ?? "none",
      basis: s.basis === "measured" || s.basis === "ai" ? s.basis : null, score: parts(s.components), age_hours: Math.max(0, Math.round((endMs - Date.parse(s.happened_at)) / 36e5)), domains: s.domains });
  }
  const engineOrder = stories.map(s => s.id);
  const topToday = (stream as { id: string; happened_at: string }[]).filter(s => s.happened_at.slice(0, 10) === day && leadAllowed(s as never, stream)).sort((a, b) => (rank.get(b.id) ?? 0) - (rank.get(a.id) ?? 0))[0]?.id ?? null;
  out.push({ day, input: { now: end, stories, leads, slots: slotsFor([]), lead_open: true, beats: "(beats.md)" }, actual: { lead: topToday, order: engineOrder } });
  console.log(day, stories.length, "stories; actual lead", topToday);
}
writeFileSync("src/lib/newsroom/__fixtures__/chief-days.json", JSON.stringify({ frozen_at: new Date().toISOString(), beats_note: "beats.md is read from the file at run time", days: out }, null, 1) + "\n");
void beats;
process.exit(0);
