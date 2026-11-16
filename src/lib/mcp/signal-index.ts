// Tier / Momentum index / Confidence fields for MCP outputs. handleMcp primes this from the latest stored forecast before a tool call;
// json() (tools/shared.ts) reads it synchronously, so every tool gains the fields beside `label` without changing its handler.
import { canonical } from "../labels";
import { classifyTrait, type Tier } from "../tiers";
import type { Signal } from "../signals";

export type SignalFields = { tier: Tier; momentum_index: number | null; confidence: string | null; confidence_reason: string | null };
let index: Map<string, SignalFields> | null = null, at = 0;
const TTL = 5 * 60_000;
export function setSignalIndex(signals: Pick<Signal, "key" | "tier" | "momentum_index" | "confidence" | "confidence_reason">[], tiers: Map<string, { tier: Tier }>) {
  const m = new Map<string, SignalFields>();
  for (const [k, t] of tiers) m.set(k, { tier: t.tier, momentum_index: null, confidence: null, confidence_reason: null });
  for (const s of signals) m.set(s.key, { tier: s.tier, momentum_index: s.momentum_index, confidence: s.confidence, confidence_reason: s.confidence_reason });
  index = m; at = Date.now();
}
export const clearSignalIndex = () => { index = null; at = 0; };
/** Fields for one trait key; keys the forecast doesn't stage still get their static tier. undefined until primed. */
export function signalFields(key: string): SignalFields | undefined {
  if (!index) return undefined;
  const k = canonical(key);
  return index.get(k) ?? { tier: classifyTrait(k, null).tier, momentum_index: null, confidence: null, confidence_reason: null };
}
export const tierOf = (key: string): Tier => signalFields(key)?.tier ?? classifyTrait(canonical(key), null).tier;
/** Additive tier filter for tools that list signals: unset returns rows unchanged. */
export const byTier = <T,>(rows: T[], tier: Tier | undefined, keyOf: (r: T) => string | null) => (tier ? rows.filter(r => { const k = keyOf(r); return k ? tierOf(k) === tier : false; }) : rows);
export async function primeSignalIndex(): Promise<void> {
  if (index && Date.now() - at < TTL) return;
  try { const { latestSignals } = await import("../signals.server"); const { tiers, signals } = await latestSignals("all"); setSignalIndex(signals, tiers); }
  catch { console.error("MCP signal index unavailable"); }
}
