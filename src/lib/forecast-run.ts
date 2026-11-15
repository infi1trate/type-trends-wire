// Pure helpers for the weekly forecast trigger and run bookkeeping: body contract, safe error text, crawl freshness.
import { z } from "zod";

export const FORECAST_BODY_LIMIT = 64 * 1024;
/** The schedule posts {} or {"kind":"weekly"}; any JSON whitespace is fine, extra keys are not. */
export const forecastRunBody = z.object({ kind: z.literal("weekly").optional() }).strict();
export function parseForecastRunBody(text: string): { ok: true; value: z.infer<typeof forecastRunBody> } | { ok: false } {
  let json: unknown;
  try { json = JSON.parse(text); } catch { return { ok: false }; }
  const r = forecastRunBody.safeParse(json);
  return r.success ? { ok: true, value: r.data } : { ok: false };
}

export const RUN_ERROR_MAX = 300;
/** Short "stage: code message" for forecast_runs.error: first line only, URLs/credentials redacted, ≤300 chars, never a stack. */
export function runErrorText(stage: string, e: unknown): string {
  const o = e && typeof e === "object" ? (e as Record<string, unknown>) : {};
  const code = typeof o["code"] === "string" || typeof o["code"] === "number" ? String(o["code"]) : e instanceof Error ? e.name : "error";
  const raw = e instanceof Error ? e.message : typeof o["message"] === "string" ? (o["message"] as string) : typeof e === "string" ? e : "";
  const msg = (raw.split("\n")[0] ?? "")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\bbearer\s+\S+/gi, "bearer [redacted]")
    .replace(/\b(api[_-]?key|apikey|token|secret|password|key)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .replace(/\b(sb_(?:secret|publishable)_\S+|eyJ[\w-]+\.[\w-]+\.[\w-]+|AIza[\w-]{20,})/g, "[redacted]")
    .replace(/\s+/g, " ").trim();
  return `${stage}: ${code}${msg && msg !== code ? ` ${msg}` : ""}`.slice(0, RUN_ERROR_MAX);
}

/** Weekly crawl: stale after 2× its interval (same rule as job health). Stale or missing crawl data drops crawl components, never the run. */
export const CRAWL_STALE_DAYS = 14;
export type CrawlCoverage = { run: string | null; finished_at: string | null; age_days: number | null; stale: boolean; use: boolean; curated_sites: number; notes: string[] };
export function crawlCoverage(c: { run: string | null; finished_at: string | null; curated_sites: number }, now: number): CrawlCoverage {
  const t = c.finished_at ? Date.parse(c.finished_at) : NaN, age = Number.isFinite(t) ? Number(((now - t) / 864e5).toFixed(1)) : null;
  const stale = !c.run || age === null || age > CRAWL_STALE_DAYS, use = !!c.run && !stale, notes: string[] = [];
  if (!c.run) notes.push("no finished crawl run: vanguard and curation components missing");
  else if (stale) notes.push(`latest crawl ${c.run} is ${age ?? "?"} days old (> ${CRAWL_STALE_DAYS}): vanguard and curation components missing`);
  if (use && c.curated_sites === 0) notes.push("no curated index in the latest crawl: curation component missing");
  return { run: c.run, finished_at: c.finished_at, age_days: age, stale, use, curated_sites: use ? c.curated_sites : 0, notes };
}
