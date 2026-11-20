// The AI worker's self-recovery (pure, with injected I/O): while it is paused because the workspace ran out of credits or the provider
// rate-limited it, a scheduled call tries ONE probe job at most once every 60 minutes. A probe that reaches the model clears the pause
// and the same call carries on with the queue; a probe that fails the same way keeps the pause and records when it tried.
export const PROBE_REASONS = new Set(["workspace_credits", "rate_limited"]);
export const PROBE_EVERY_MS = 60 * 60_000;
export type ProbeControl = { paused: boolean; reason: string | null; paused_at: string | null; probed_at: string | null };

const ms = (iso: string | null | undefined) => { const t = iso ? Date.parse(iso) : NaN; return Number.isFinite(t) ? t : null; };
/** When the next probe is due (ms), or null when this pause does not probe (not paused, or a reason that needs a person). */
export function nextProbeAt(c: ProbeControl | null | undefined): number | null {
  if (!c?.paused || !c.reason || !PROBE_REASONS.has(c.reason)) return null;
  const last = Math.max(ms(c.paused_at) ?? -Infinity, ms(c.probed_at) ?? -Infinity);
  return Number.isFinite(last) ? last + PROBE_EVERY_MS : 0;
}
/** "normal": run the queue as usual. "probe": try one job now. "wait": paused, next probe not due yet. */
export function probeDecision(c: ProbeControl | null | undefined, now: number): "normal" | "probe" | "wait" {
  const next = nextProbeAt(c);
  return next == null ? "normal" : next <= now ? "probe" : "wait";
}

/** One probe job: whether the model was called, whether it answered, and the failure code when it did not. */
export type ProbeOutcome = { called: boolean; ok: boolean; code: string | null };
export type ProbeDeps = {
  control: () => Promise<ProbeControl | null>;
  /** Atomically take the lease for a probe: still paused for a probe reason, no live lease, no probe or pause start in the last hour. */
  acquire: (token: string) => Promise<boolean>;
  /** Run at most one model call on the next job (jobs that need no model are settled along the way). */
  runOne: (token: string) => Promise<ProbeOutcome>;
  /** ok: clear the pause; otherwise keep it with this reason (null keeps the stored one). Releases the lease either way. */
  settle: (token: string, ok: boolean, reason: string | null) => Promise<void>;
};
export type ProbeResult = { state: "normal" } | { state: "waiting"; next_probe_at: string } | { state: "busy" } | { state: "probed"; ok: boolean; code: string | null };
export async function probeStep(deps: ProbeDeps, now: number, token: string): Promise<ProbeResult> {
  const c = await deps.control(), decision = probeDecision(c, now);
  if (decision === "normal") return { state: "normal" };
  if (decision === "wait") return { state: "waiting", next_probe_at: new Date(nextProbeAt(c)!).toISOString() };
  if (!await deps.acquire(token)) return { state: "busy" };
  let out: ProbeOutcome;
  try { out = await deps.runOne(token); } catch { out = { called: false, ok: false, code: null }; }
  // Only a model call that answered proves the pause is over; anything else keeps it (the original reason unless a new pause code came back).
  const ok = out.called && out.ok;
  await deps.settle(token, ok, ok ? null : out.code && PROBE_REASONS.has(out.code) ? out.code : null);
  return { state: "probed", ok, code: out.code };
}

const REASON_WORDS: Record<string, string> = {
  workspace_credits: "the AI workspace ran out of credits",
  rate_limited: "the AI provider is rate-limiting requests",
  provider_or_policy_denied: "the AI provider refused the request",
  provider_refusal: "the AI provider refused the request",
  provider_not_configured: "the AI provider is not configured",
  provider_invalid: "the AI provider setting is invalid",
  provider_model_unavailable: "the AI model is unavailable",
  usage_unknown: "a model call ended without a usage record",
  unknown_outcome: "a model call ended without a known outcome",
};
const hm = (t: number) => { const d = new Date(t); return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC ${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]}`; };
/** The plain-words pause note for health and the status page, or null when the worker is not paused. */
export function pauseNote(c: ProbeControl | null | undefined, now: number): string | null {
  if (!c?.paused) return null;
  const why = c.reason ? REASON_WORDS[c.reason] ?? `stopped with "${c.reason}"` : "no reason recorded", since = ms(c.paused_at);
  const head = `Paused${since != null ? ` since ${hm(since)}` : ""}: ${why}`;
  const next = nextProbeAt(c);
  if (next == null) return `${head}. It does not retry by itself; it needs a person to clear it.`;
  return `${head}. ${next <= now ? "It tries one job with the next scheduled call" : `It tries one job at ${hm(next)}`}${ms(c.probed_at) != null ? ` (last try ${hm(ms(c.probed_at)!)})` : ""}.`;
}
