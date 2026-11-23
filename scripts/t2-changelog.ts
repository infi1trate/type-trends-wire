// T2 · B: the changelog read's failures. `--golden` writes the ten-case set from stored good answers (no model calls); `--rerun` sends the
// inputs of the week's failed changelog jobs to the model once each (reserved and settled in ai_usage like any call, nothing stored as
// an extraction) and reads each answer with the old strict schema and with the new reading. Prints counts only, never page text.
//   bun scripts/t2-changelog.ts --golden | --rerun [--limit 25]
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { AI_MODELS, AI_LIMITS } from "../src/lib/ai-models";
import { estimateCost } from "../src/lib/ai-budget";
import { libraryRequest } from "../src/lib/ai-prompts";
import { changelogSchema, normalizeExtraction } from "../src/lib/ai-schema";

const args = process.argv.slice(2), opt = (n: string, d: string) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1]! : d; };
const db = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, { auth: { persistSession: false } });

if (args.includes("--golden")) {
  const { data, error } = await db.from("library_extractions").select("snapshot_id,data,library_snapshots!inner(domain,captured_at)").eq("kind", "changelog").order("snapshot_id", { ascending: false }).limit(400);
  if (error) throw error;
  const seen = new Set<string>(), cases: { snapshot_id: number; captured_at: string; data: unknown }[] = [];
  for (const r of data as unknown as { snapshot_id: number; data: { entries: unknown[] }; library_snapshots: { domain: string; captured_at: string } }[]) {
    if (seen.has(r.library_snapshots.domain) || !changelogSchema.safeParse(r.data).success || r.data.entries.length < 2) continue;
    seen.add(r.library_snapshots.domain); cases.push({ snapshot_id: r.snapshot_id, captured_at: r.library_snapshots.captured_at, data: r.data });
    if (cases.length === 10) break;
  }
  writeFileSync("src/lib/fixtures/changelog-golden.json", JSON.stringify({ built: new Date().toISOString().slice(0, 10), note: "Ten stored good changelog answers (distinct sites); reading each again must give it back unchanged.", cases }, null, 1) + "\n");
  console.log("golden cases", cases.length);
  process.exit(0);
}

if (args.includes("--rerun")) {
  process.env["AI_PROVIDER"] = "lovable";
  const { aiClient, markProvider } = await import("../src/lib/ai-provider.server");
  const ai = aiClient(), model = AI_MODELS.text, limit = Number(opt("--limit", "25"));
  const { data: jobs, error } = await db.from("library_ai_jobs").select("id,snapshot_id,status,validation_failures").eq("kind", "changelog").gt("validation_failures", 0).gte("created_at", new Date(Date.now() - 10 * 864e5).toISOString()).order("id").limit(limit);
  if (error) throw error;
  let oldFail = 0, newFail = 0, calls = 0, cost = 0, noCall = 0;
  const why: Record<string, number> = {};
  for (const j of jobs ?? []) {
    const { data: s } = await db.from("library_snapshots").select("id,captured_at").eq("id", j.snapshot_id).single();
    const { data: t } = await db.from("library_snapshot_text").select("raw_text").eq("snapshot_id", j.snapshot_id).maybeSingle();
    if (!s || !t?.raw_text) { noCall++; continue; }
    const estimate = estimateCost({ provider: ai.provider, model, input_tokens: AI_LIMITS.textInput, output_tokens: AI_LIMITS.output });
    const res = await db.rpc("ai_reserve", { p_snapshot_id: s.id, p_kind: "changelog", p_model: model, p_estimate: estimate });
    const r = res.data as { ok: boolean; id?: number; code?: string } | null;
    if (res.error || !r?.ok || r.id == null) { console.log("reserve refused", r?.code ?? res.error?.message); break; }
    await markProvider(db as never, r.id, ai.provider);
    calls++;
    try {
      const out = await ai.complete({ model, max_tokens: AI_LIMITS.output, temperature: 0, ...libraryRequest({ kind: "changelog", context: t.raw_text.slice(0, AI_LIMITS.textChars), captured_at: s.captured_at }) });
      const c = estimateCost({ provider: ai.provider, model, input_tokens: out.usage.prompt_tokens, output_tokens: out.usage.completion_tokens }); cost += c;
      const raw = out.tool_call_args === undefined ? undefined : JSON.parse(out.tool_call_args);
      const strict = raw === undefined ? null : changelogSchema.safeParse(raw);
      if (!strict?.success) { oldFail++; for (const i of strict?.error.issues ?? [{ path: ["(no answer)"], code: "missing" }]) { const k = `${String(i.path.filter(p => typeof p !== "number").join("."))}: ${i.code}`; why[k] = (why[k] ?? 0) + 1; } }
      let ok = true; try { if (raw === undefined) throw new Error("none"); normalizeExtraction("changelog", raw, s.captured_at); } catch { ok = false; }
      if (!ok) newFail++;
      await db.rpc("ai_settle", { p_id: r.id, p_input: out.usage.prompt_tokens, p_output: out.usage.completion_tokens, p_cost: c, p_ok: ok, p_error: ok ? null as never : "invalid_structured_output", p_state: "done" });
    } catch (e) {
      await db.rpc("ai_settle", { p_id: r.id, p_input: 0, p_output: 0, p_cost: estimate, p_ok: false, p_error: "gateway_failed", p_state: "unknown" }); cost += estimate;
      console.log("call failed", (e as Error).message.slice(0, 80)); oldFail++; newFail++;
    }
  }
  console.log(JSON.stringify({ jobs: jobs?.length ?? 0, calls, no_text: noCall, old_schema_failures: oldFail, new_reading_failures: newFail, old_failure_fields: why, usd: Math.round(cost * 1e4) / 1e4 }));
}
