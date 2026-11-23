// T1 · the spend ledger's one loader: reads the rows behind /desk's Spend table (service role, reads only) and hands them to the pure
// ledger.ts. Model calls are paged past 1,000 rows; story costs read every writer text and standards/editor-in-chief call for the stories
// first published in the eight weeks, whenever the call was made.
import type { SupabaseClient } from "@supabase/supabase-js";
import * as L from "./ledger";

type Admin = SupabaseClient;
const PAGE = 1000, MAX_PAGES = 40;

async function paged<T>(q: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await q(p * PAGE, p * PAGE + PAGE - 1);
    if (error) throw new Error("ledger_read_failed");
    out.push(...((data ?? []) as T[]));
    if ((data ?? []).length < PAGE) break;
  }
  return out;
}

export async function loadLedger(db: Admin, now = Date.now()): Promise<L.LedgerWeek[]> {
  const weeks = L.etWeeks(now), since = weeks[weeks.length - 1]!.start;
  const [calls, builds, agents, published, cap, items, gates] = await Promise.all([
    paged<{ created_at: string; kind: string; model: string; ok: boolean; state: string; input_tokens: number | null; output_tokens: number | null; est_cost_usd: number | null; snapshot_id: number | null }>((a, b) =>
      db.from("ai_usage").select("id,created_at,kind,model,ok,state,input_tokens,output_tokens,est_cost_usd,snapshot_id").gte("created_at", since).order("id").range(a, b)),
    paged<{ at: string; credits: number; queue_item: number | null; what: string }>((a, b) => db.from("spend_entries").select("id,at,credits,queue_item,what").gte("at", since).order("id").range(a, b)),
    paged<{ at: string; usd: number; what: string; actor: string }>((a, b) => db.from("agent_spend" as never).select("id,at,usd,what,actor").gte("at", since).order("id").range(a, b)),
    paged<{ story_id: string; at: string }>((a, b) => db.from("story_states").select("id,story_id,at").eq("state", "published").order("id").range(a, b)),
    db.from("spend_caps").select("model_usd,build_credits,at").order("id", { ascending: false }).limit(1),
    paged<{ id: number; test: boolean }>((a, b) => db.from("build_queue").select("id,test").order("id").range(a, b)),
    paged<{ item_id: number; at: string; pass: boolean }>((a, b) => db.from("gate_results").select("id,item_id,at,pass").gte("at", since).order("id").range(a, b)),
  ]);
  // Only stories whose first publication falls in the window carry a cost here.
  const first = new Map<string, string>();
  for (const p of published) { const f = first.get(p.story_id); if (!f || p.at < f) first.set(p.story_id, p.at); }
  const ids = [...first.entries()].filter(([, at]) => Date.parse(at) >= Date.parse(since)).map(([id]) => id);
  const [texts, deskCalls, moves] = await Promise.all([
    ids.length ? paged<{ story_id: string; cost: number | null }>((a, b) => db.from("story_texts").select("id,story_id,cost").in("story_id", ids).order("id").range(a, b)) : Promise.resolve([]),
    ids.length ? paged<{ at: string; desk: string; purpose: string; cost: number | null; story_ids: string[] | null }>((a, b) =>
      db.from("desk_calls").select("id,at,desk,purpose,cost,story_ids").in("desk", [...L.STORY_DESKS]).neq("purpose", "fixture").overlaps("story_ids", ids).order("id").range(a, b)) : Promise.resolve([]),
    paged<{ item_id: number; status: string; at: string }>((a, b) => db.from("build_queue_moves").select("id,item_id,status,at").order("id").range(a, b)),
  ]);
  const ships: L.ShipRow[] = items.map(i => ({ id: i.id, test: i.test, moves: moves.filter(m => m.item_id === i.id), gates: gates.filter(g => g.item_id === i.id) }));
  const c = cap.data?.[0];
  return L.buildLedger({
    calls: calls.map(x => ({ at: x.created_at, kind: x.kind, model: x.model, ok: x.ok, state: x.state, input_tokens: x.input_tokens, output_tokens: x.output_tokens, usd: Number(x.est_cost_usd ?? 0), snapshot_id: x.snapshot_id })),
    builds: builds.map(x => ({ ...x, credits: Number(x.credits) })), agents: agents.map(x => ({ ...x, usd: Number(x.usd) })),
    texts: texts.map(x => ({ story_id: x.story_id, usd: Number(x.cost ?? 0) })),
    deskCalls: deskCalls.map(x => ({ at: x.at, desk: x.desk, purpose: x.purpose, usd: Number(x.cost ?? 0), story_ids: x.story_ids ?? [] })),
    published, ships, cap: c ? { model_usd: c.model_usd == null ? null : Number(c.model_usd), build_credits: c.build_credits == null ? null : Number(c.build_credits), set_at: c.at } : null,
  }, now);
}
/** /api/public/health's spend line from the anonymous week facade (totals only). */
export async function healthSpend(db: Admin): Promise<{ line: string; model_usd: number; build_credits: number; agent_usd: number } | null> {
  const { data, error } = await db.rpc("spend_week_facts" as never);
  if (error || !data) return null;
  const f = data as unknown as { model_usd: number; build_credits: number; agent_usd: number };
  const w = { model_usd: Number(f.model_usd) || 0, build_credits: Number(f.build_credits) || 0, agent_usd: Number(f.agent_usd) || 0 };
  return { ...w, line: L.healthSpendLine(w) };
}
