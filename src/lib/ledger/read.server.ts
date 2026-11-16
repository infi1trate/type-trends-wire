// Anonymous SELECT-only ledger reads shared by /ledger, the terminal, trait explainers, the Digest and MCP.
import { supabaseAnon } from "../mcp/supabase";
import { asOf, backtestOf, ledgerItem, ledgerSummary, LEDGER_RULE, type Outcome, type StoredCall } from "./ledger";
import { canonical } from "../labels";
import { readerRunId } from "../real-runs";
async function pages<T>(f: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 1000) {
  const out: T[] = [];
  for (let from = 0; ; from += size) { const { data, error } = await f(from, from + size - 1); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < size) break; }
  return out;
}
export type LedgerFilter = { trait?: string | undefined; scope?: string | undefined; outcome?: Outcome | "open" | undefined; since?: string | undefined; limit?: number | undefined };
export async function ledgerCalls(f: LedgerFilter = {}): Promise<StoredCall[]> {
  const db = supabaseAnon();
  return pages<StoredCall>((from, to) => {
    let q = db.from("forecast_calls").select("*").order("made_at", { ascending: false }).order("id", { ascending: false });
    if (f.trait) q = q.eq("trait", canonical(f.trait)); if (f.scope) q = q.eq("scope", f.scope); if (f.since) q = q.gte("made_at", f.since);
    if (f.outcome === "open") q = q.is("outcome", null); else if (f.outcome) q = q.eq("outcome", f.outcome);
    return q.range(from, to) as never;
  });
}
export async function loadLedger(f: LedgerFilter = {}) {
  const filtered = !!(f.trait || f.scope || f.outcome || f.since);
  const [all, card] = await Promise.all([ledgerCalls(), readerRunId(supabaseAnon()).then(id => supabaseAnon().from("forecast_runs").select("model_card").eq("id", id).maybeSingle())]);
  if (card.error) throw card.error;
  const rows = filtered ? await ledgerCalls(f) : all;
  const items = rows.slice(0, f.limit ?? rows.length).map(ledgerItem);
  return { rule: [...LEDGER_RULE.text], summary: ledgerSummary(all), calls: items, matched: rows.length, backtest: backtestOf((card.data?.model_card ?? null) as Record<string, unknown> | null) };
}
export async function traitCalls(key: string, limit = 24) { return (await ledgerCalls({ trait: key })).slice(0, limit).map(ledgerItem); }
/** Summary as of an issue's end, so an old Digest issue never changes when later calls resolve. */
export async function ledgerSummaryAsOf(iso: string) { return ledgerSummary(asOf(await ledgerCalls(), iso)); }
