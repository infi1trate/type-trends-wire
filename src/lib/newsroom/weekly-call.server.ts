// N5 · the publisher's and scout's one model call a week each (the story writer's gateway path and cost ledger). Their call records
// live in `desk_calls_weekly` (desk_calls keeps its own fixed desk list). The daily limit is checked before the call and the answer is
// enforced by the caller after it. A fixture call is recorded as `fixture` and never counts against the limit.
import type { Admin } from "./review.server";
import { WEEKLY_LIMITS } from "./caps";
const dayStart = (now: number) => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };

export type WeeklyDesk = (typeof WEEKLY_LIMITS)[number]["desk"];
export async function weeklyCallsToday(db: Admin, desk: WeeklyDesk, purpose: string, now = Date.now()): Promise<number> {
  const { count, error } = await db.from("desk_calls_weekly").select("id", { count: "exact", head: true }).eq("desk", desk).eq("purpose", purpose).gte("at", dayStart(now));
  if (error) throw new Error("weekly_calls_read_failed");
  return count ?? 0;
}
export async function weeklyCall(db: Admin, desk: WeeklyDesk, purpose: "drafts" | "candidates" | "fixture", week: string,
  req: { system: string; user: string; schema: Record<string, unknown>; schemaName: string; tool: import("../stories/writer.server").GatewayRequest["tool"]; maxTokens: number },
  parse: (raw: unknown) => unknown | null, signal: AbortSignal, prompt: import("./golden/versions").DeskPrompt): Promise<{ parsed: unknown; call_id: number | null; model: string; cost: number } | { refused: string }> {
  if (purpose !== "fixture") {
    const cap = WEEKLY_LIMITS.find(l => l.desk === desk && l.purpose === purpose)?.cap ?? 0;
    if ((await weeklyCallsToday(db, desk, purpose)) >= cap) return { refused: `limit used: the ${desk}'s ${cap} ${cap === 1 ? "call" : "calls"} today are made` };
  }
  const [{ gatewayCall, providerCanRun }, { AI_MODELS }, { currentDeskVersion }] = await Promise.all([import("../stories/writer.server"), import("../ai-models"), import("./golden/versions")]);
  const model = providerCanRun(AI_MODELS.writer) ? AI_MODELS.writer : AI_MODELS.text;
  const r = await gatewayCall(db, { model, ...req, textMaxTokens: Math.min(req.maxTokens, 2500) }, signal);
  if (!r) return { refused: "call failed: no answer from the gateway (or the weekly cap is reached)" };
  const parsed = r.raw != null ? parse(r.raw) : null;
  const { data } = await db.from("desk_calls_weekly").insert({ desk, purpose, model, usage_id: r.usage_id ?? null, ok: parsed != null, cost: Math.round(r.cost * 1e6) / 1e6, prompt_version: currentDeskVersion(prompt)?.version ?? null, week,
    answer: (parsed ?? {}) as never, error: parsed == null ? (r.raw == null ? "no answer" : "not the fixed structure") : null }).select("id").single();
  return { parsed, call_id: (data?.id as number | undefined) ?? null, model, cost: r.cost };
}
