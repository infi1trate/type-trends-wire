import { CONDITION_TEXT, type Condition } from "../integrity";
// U4 · PITCH THIS. An editor sends a row to the desk; the story engine answers. Pure: the request schema, which candidate a pitch is
// about, and the engine's verdict, computed from the same plan, integrity verdicts, carousel set and site kinds the builder uses
// (build.server.ts hands them over after planning). A pitch never adds a candidate, never changes a score and never publishes: it
// only asks whether the engine already has, would, or would not run it, and records that answer (pitch_verdicts, insert-only).
import { z } from "zod";
import { canonical } from "../labels";
import type { SiteKind } from "../brand-names";
import type { Planned } from "./score";

export const PITCH_KINDS = ["change", "signal", "brand", "census", "receipt"] as const;
export type PitchKind = (typeof PITCH_KINDS)[number];
export const PITCH_NOTE_MAX = 140;
/** Who pitched: the label of the key that unlocked the desk (there is one editor key). */
export const PITCH_BY = "editor key";
const noDollar = (s: string) => !s.replace(/“[^”]*”|‘[^’]*’|"[^"]*"/g, "").includes("$");
export const pitchBody = z.object({
  action: z.literal("pitch"), kind: z.enum(PITCH_KINDS), ref: z.string().trim().min(1).max(200),
  facts: z.array(z.string().max(300)).max(20), note: z.string().trim().min(1).max(PITCH_NOTE_MAX).refine(noDollar, "no $ in our own words"),
}).strict();
export type PitchInput = Omit<z.infer<typeof pitchBody>, "action">;
export type Pitch = PitchInput & { id: number; by: string; at: string };

/** The stories the engine has stored (edits applied), as the pitch check needs them. */
export type KnownStory = { id: string; state: "published" | "held" | "killed"; headline: string; domains: string[]; signalKeys: string[]; sourceIds: string[]; type: string };
/** What the builder hands over after it planned: its plan, the stories that existed before it, and the rules' refusals. */
export type EngineView = {
  plan: Pick<Planned, "id" | "type" | "status" | "reason" | "score" | "domains" | "signalKeys" | "sourceIds" | "headline">[];
  stories: KnownStory[];
  /** Changes the integrity rule did not confirm (event id → the fields that failed). */
  unconfirmed: { id: number; failed: string[] }[];
  /** Changes on a rotating first screen (carousel rule). */
  rotating: ReadonlySet<number>;
  /** The site kind of a domain (storefront and media homepages change for the day's promotion or lead story). */
  kindOf: (domain: string) => SiteKind;
  /** Is the domain a showcase (a studio): its palette and hero are its portfolio, never a single-brand story (E2d). */
  showcase: (domain: string) => boolean;
  /** The event behind a change id, when loaded (for the brand and showcase check). */
  eventDomain: (id: number) => string | null;
  /** A story's permanent number, once it has one. */
  numberOf: (storyId: string) => number | null;
  /** A dry run (the desk asking now) says "would run"; the build's own run says "ran". */
  dry: boolean;
};
export type Verdict =
  | { status: "story"; storyId: string; number: number | null; headline: string; retired: boolean; text: string }
  | { status: "ran"; storyId: string; number: number | null; headline: string; text: string }
  | { status: "would_run"; candidateId: string; score: number; rank: number; of: number; text: string }
  | { status: "held"; candidateId: string; score: number; reason: string; text: string }
  | { status: "refused"; rule: "integrity" | "carousel" | "showcase" | "kinds" | "none"; text: string };

type Subject = { ids?: string[]; sources?: string[]; domain?: string; signal?: string; census?: string };
/** What a pitch is about, in the engine's terms. A receipt names its own type: `story:<id>`, `brand:<domain>`, `signal:<key>`, `change:<id>`. */
export function subjectOf(p: Pick<Pitch, "kind" | "ref">): Subject {
  const ref = p.ref.trim();
  if (p.kind === "change") return { sources: [`event:${ref.replace(/^event:/, "")}`] };
  if (p.kind === "brand") return { domain: ref.toLowerCase().replace(/^www\./, "") };
  if (p.kind === "signal") return { signal: canonical(ref) };
  if (p.kind === "census") return { census: ref };
  const i = ref.indexOf(":"), type = ref.slice(0, i), id = ref.slice(i + 1);
  if (i < 0) return {};
  if (type === "story") return { ids: [id] };
  if (type === "brand") return subjectOf({ kind: "brand", ref: id });
  if (type === "signal" || type === "pattern") return subjectOf({ kind: "signal", ref: id });
  if (type === "change" || type === "event") return subjectOf({ kind: "change", ref: id });
  if (type === "census") return { census: id };
  return {};
}
type Matchable = { id: string; type: string; domains: string[]; signalKeys: string[]; sourceIds: string[] };
/** Does a candidate or stored story answer this pitch? A brand pitch matches single-brand items only; a signal pitch items led by it. */
export function matches(s: Subject, c: Matchable): boolean {
  if (s.ids) return s.ids.includes(c.id);
  if (s.sources) return s.sources.some(x => c.sourceIds.includes(x));
  if (s.domain) return c.domains.length === 1 && c.domains[0] === s.domain;
  if (s.signal) return c.signalKeys.length > 0 && canonical(c.signalKeys[0]!) === s.signal;
  if (s.census) return c.type === "census" && (c.id === s.census || c.id.startsWith(`${s.census}:`) || c.id.includes(`:${s.census}`));
  return false;
}
const no = (n: number | null) => (n == null ? "an unnumbered story" : `No. ${n}`);
/** The engine's verdict on one pitch. Order: already a story → in this plan (ran / would run, or held with the engine's reason) →
 *  refused by a rule (integrity, carousel, showcase) → no candidate under the rules. */
export function pitchVerdict(p: Pick<Pitch, "kind" | "ref">, v: EngineView): Verdict {
  const s = subjectOf(p);
  const before = v.stories.filter(x => matches(s, x));
  // A published or retired story answers the pitch; a story stored as held is asked again below, against this build's plan.
  const shown = before.find(x => x.state === "published") ?? before.find(x => x.state === "killed");
  if (shown) { const n = v.numberOf(shown.id); return { status: "story", storyId: shown.id, number: n, headline: shown.headline, retired: shown.state === "killed",
    text: shown.state === "killed" ? `Already a story, since retired: ${no(n)}.` : `Already a story: ${no(n)}.` }; }
  const published = v.plan.filter(x => x.status === "published").sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const hit = v.plan.filter(x => matches(s, x)).sort((a, b) => (a.status === b.status ? b.score - a.score : a.status === "published" ? -1 : 1))[0];
  if (hit?.status === "published") {
    if (!v.dry) { const n = v.numberOf(hit.id); return { status: "ran", storyId: hit.id, number: n, headline: hit.headline, text: `Ran: ${no(n)}, like any other story.` }; }
    const rank = published.findIndex(x => x.id === hit.id) + 1;
    return { status: "would_run", candidateId: hit.id, score: hit.score, rank, of: published.length, text: `Would run on the next build: score ${hit.score}, rank ${rank} of ${published.length}.` };
  }
  if (hit) return { status: "held", candidateId: hit.id, score: hit.score, reason: hit.reason, text: `Held: ${hit.reason}` };
  const storedHeld = before.find(x => x.state === "held");
  if (storedHeld) return { status: "held", candidateId: storedHeld.id, score: 0, reason: "held when it was built and outside this build's window", text: "Held: it was held when it was built and is outside this build's window, so it is not judged again." };
  const ev = s.sources?.[0] ? Number(s.sources[0].slice(6)) : null;
  if (ev != null && Number.isFinite(ev)) {
    const u = v.unconfirmed.find(x => x.id === ev);
    if (u) return { status: "refused", rule: "integrity", text: `Not a change under the integrity rule: ${u.failed.length ? u.failed.map(f => CONDITION_TEXT[f as Condition] ?? f).join("; ") : "the second capture did not confirm it"}.` };
    if (v.rotating.has(ev)) return { status: "refused", rule: "carousel", text: "Not a change under the carousel rule: the first screen rotates, so the change is the carousel, not the brand." };
  }
  const domain = s.domain ?? (ev != null && Number.isFinite(ev) ? v.eventDomain(ev) : null);
  if (domain && v.showcase(domain)) return { status: "refused", rule: "showcase", text: "Not a story under the showcase rule: a studio's homepage is its portfolio, so its palette and hero changes are not single-brand stories." };
  if (domain && v.kindOf(domain) !== "standard") return { status: "refused", rule: "kinds", text: `Not a story under the site-kind rule: a ${v.kindOf(domain) === "merchandised" ? "storefront" : "media"} homepage changes its palette, hero and headline for the day's promotion or lead story.` };
  return { status: "refused", rule: "none", text: "No candidate under the rules in the build window: nothing measured here passes as a change yet." };
}
/** The verdict rows to append: only pitches whose answer changed since their last stored verdict. */
/** Two verdicts are the same answer when status and sentence match (stored JSON does not keep key order). */
export const verdictKey = (v: Pick<Verdict, "status" | "text">) => `${v.status}|${v.text}`;
export function verdictsToRecord(pitches: readonly Pitch[], last: ReadonlyMap<number, string>, v: EngineView): { pitch_id: number; status: Verdict["status"]; verdict: Verdict; story_id: string | null; story_number: number | null }[] {
  return pitches.flatMap(p => {
    const verdict = pitchVerdict(p, v), key = verdictKey(verdict);
    if (last.get(p.id) === key) return [];
    const storyId = "storyId" in verdict ? verdict.storyId : null, number = "number" in verdict ? verdict.number : null;
    return [{ pitch_id: p.id, status: verdict.status, verdict, story_id: storyId, story_number: number }];
  });
}
/** A pitch with its newest answer (the desk's Pitched list). */
export type PitchedItem = { pitch: Pitch; verdict: Verdict | null; answeredAt: string | null; source: "desk" | "build" | null };
/** A pitch stays open until it ran, is a story, or was refused; held and would-run pitches are asked again on every build. */
export const isOpen = (status: Verdict["status"] | null) => status == null || status === "held" || status === "would_run";
