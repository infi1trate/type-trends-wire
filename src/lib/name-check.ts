// I3b · a health check, not reader-facing: does each tracked brand's name appear in its latest home page title or headline?
// Pure. Names and page lines are folded (accents, case, spacing and punctuation removed; "&" reads "and") before comparing, so
// "BASIC/DEPT" matches "Basic Dept". The address's own first label counts as the name too ("lucidmotors" in "Lucid Motors").
export const NAME_CHECK_DAYS = 8;
const fold = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
export function nameAppears(names: readonly (string | null | undefined)[], domain: string, lines: readonly (string | null | undefined)[]): boolean {
  const hay = lines.filter((x): x is string => typeof x === "string" && !!x.trim()).map(fold).join("|");
  if (!hay) return false;
  const stem = fold(domain.replace(/^www\./, "").split(".")[0] ?? "");
  const keys = [...names.filter((x): x is string => typeof x === "string").map(fold), stem].filter(k => k.length >= 2);
  return keys.some(k => hay.includes(k));
}
export type NameCheckSite = { domain: string; names: (string | null)[]; title: string | null; h1: string | null; captured_at: string | null };
export type NameCheck = { checked_at: string; checked: number; not_captured: string[]; failing: { domain: string; name: string; title: string | null; h1: string | null }[] };
export function nameCheck(sites: readonly NameCheckSite[], now: Date): NameCheck {
  const captured = sites.filter(s => s.captured_at), out: NameCheck["failing"] = [];
  for (const s of captured) if (!nameAppears(s.names, s.domain, [s.title, s.h1])) out.push({ domain: s.domain, name: s.names.find(Boolean) ?? s.domain, title: s.title, h1: s.h1 });
  return { checked_at: now.toISOString(), checked: captured.length, not_captured: sites.filter(s => !s.captured_at).map(s => s.domain).sort(), failing: out.sort((a, b) => a.domain.localeCompare(b.domain)) };
}
