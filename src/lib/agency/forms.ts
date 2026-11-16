// Form checks for /audit/new and /watch/new, pure: what is wrong with each field, in plain words, before anything is sent.
// The server still validates; these give the inline error under the field.
import { AUDIT_MAX, AUDIT_MIN } from "./audit";
import { WATCH_LIMITS, isTraitInput, normDomain, splitTargets } from "./watch";

export type FieldErrors<K extends string> = { [P in K]?: string | undefined };
const list = (xs: string[]) => xs.slice(0, 3).map(x => `“${x}”`).join(", ") + (xs.length > 3 ? ` and ${xs.length - 3} more` : "");

export const AUDIT_TEXT = {
  empty: `Add the sites to compare: at least ${AUDIT_MIN}, separated by commas.`,
  tooFew: (n: number) => `Add ${AUDIT_MIN - n} more ${AUDIT_MIN - n === 1 ? "site" : "sites"}: an audit compares at least ${AUDIT_MIN}.`,
  tooMany: (n: number) => `Remove ${n - AUDIT_MAX} ${n - AUDIT_MAX === 1 ? "site" : "sites"}: an audit compares at most ${AUDIT_MAX}.`,
  bad: (xs: string[]) => `${list(xs)} ${xs.length === 1 ? "isn't a web address" : "aren't web addresses"}. Use the domain, like linear.app.`,
} as const;
/** Audit: 2–6 distinct domains. */
export function auditErrors(sites: string): FieldErrors<"sites"> {
  const parts = splitTargets(sites);
  if (!parts.length) return { sites: AUDIT_TEXT.empty };
  const bad = parts.filter(p => !normDomain(p));
  if (bad.length) return { sites: AUDIT_TEXT.bad(bad) };
  const n = new Set(parts.map(p => normDomain(p)!)).size;
  if (n < AUDIT_MIN) return { sites: AUDIT_TEXT.tooFew(n) };
  if (n > AUDIT_MAX) return { sites: AUDIT_TEXT.tooMany(n) };
  return {};
}

export const WATCH_TEXT = {
  name: "Give the watchlist a name, like “Acme competitors”.",
  long: `Keep the name under ${WATCH_LIMITS.name} characters.`,
  bad: (xs: string[]) => `${list(xs)} ${xs.length === 1 ? "is neither a domain nor a signal key" : "are neither domains nor signal keys"}. Use linear.app or css:subgrid.`,
  sites: (n: number) => `That's ${n} sites; a watchlist holds up to ${WATCH_LIMITS.sites}. Remove ${n - WATCH_LIMITS.sites}.`,
  traits: (n: number) => `That's ${n} signals; a watchlist holds up to ${WATCH_LIMITS.traits}. Remove ${n - WATCH_LIMITS.traits}.`,
} as const;
/** Watchlist: a name, and up to 25 sites and 25 signal keys (both optional). */
export function watchErrors(name: string, targets: string): FieldErrors<"name" | "targets"> {
  const out: FieldErrors<"name" | "targets"> = {}, n = name.trim();
  if (!n) out.name = WATCH_TEXT.name; else if (n.length > WATCH_LIMITS.name) out.name = WATCH_TEXT.long;
  const parts = splitTargets(targets), traits = parts.filter(isTraitInput), rest = parts.filter(p => !isTraitInput(p));
  const bad = rest.filter(p => !normDomain(p)), sites = new Set(rest.map(normDomain).filter(Boolean)).size;
  if (bad.length) out.targets = WATCH_TEXT.bad(bad);
  else if (sites > WATCH_LIMITS.sites) out.targets = WATCH_TEXT.sites(sites);
  else if (new Set(traits).size > WATCH_LIMITS.traits) out.targets = WATCH_TEXT.traits(new Set(traits).size);
  return out;
}
