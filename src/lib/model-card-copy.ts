/** Model-card coverage in plain sentences (no component codes). Pure; the forecast panel and tests share it. */
import { MIN_BASELINE_WEEKS } from "./discourse";

export const COMPONENT_NAMES: Record<string, string> = { gap: "Trendsetter gap", vanguard: "Vanguard", curation: "Curation", momentum: "Momentum", corroboration: "Corroboration", discourse: "Discourse", supply: "Supply" };
type Card = { component_coverage?: Record<string, number>; crawl?: { notes?: string[]; age_days?: number | null } | null } | null | undefined;
const addDays = (iso: string, d: number) => new Date(Date.parse(iso) + d * 864e5).toISOString().slice(0, 10);

/** One sentence per missing or partial component; fully covered components are not mentioned. */
export function coverageSentences(card: Card, opts: { discourseSince?: string | null | undefined } = {}): string[] {
  const cov = card?.component_coverage, rows = cov?.["rows"] ?? 0;
  if (!cov || !rows) return ["No forecast has run yet, so no score parts are measured. The first run happens after the Sunday crawl."];
  const notes = (card?.crawl?.notes ?? []).join(" ");
  const out: string[] = [];
  for (const k of Object.keys(COMPONENT_NAMES)) {
    const n = cov[k] ?? 0, name = COMPONENT_NAMES[k]!;
    if (n >= rows) continue;
    if (n > 0) { out.push(`${name} is measured for ${n} of ${rows} traits; the others count as average.`); continue; }
    if (k === "curation") out.push(/no finished crawl|days old/.test(notes) ? "Curation is left out this week because the latest crawl is missing or too old; it returns after the next weekly crawl." : "Curation is left out this week: the latest crawl had no curated gallery sites, so it joins the score after the next weekly crawl that includes them.");
    else if (k === "vanguard") out.push(/days old/.test(notes) ? `Vanguard is left out this week because the latest crawl is ${card?.crawl?.age_days ?? "too many"} days old; it returns after the next weekly crawl.` : "Vanguard is left out this week because no weekly crawl has finished yet.");
    else if (k === "discourse") out.push(opts.discourseSince ? `Discourse sampling began ${opts.discourseSince.slice(0, 10)}; this fills in after ${MIN_BASELINE_WEEKS} weeks of posts, around ${addDays(opts.discourseSince, MIN_BASELINE_WEEKS * 7)}.` : `Discourse fills in after ${MIN_BASELINE_WEEKS} weeks of sampled posts.`);
    else if (k === "supply") out.push("Supply only applies to font-category traits, and none qualified this week.");
    else out.push(`${name} is not measured yet; it needs at least 4 usable quarters of history.`);
  }
  return out;
}
