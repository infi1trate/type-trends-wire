// Dry parity check: Google AI Studio vs stored (Lovable-gateway) results. Nothing is stored and no budget is
// reserved; images are rendered in memory only. Runs only when GEMINI_API_KEY is set (or --provider lovable
// for a plumbing smoke test).
//   bun scripts/ai-parity.ts [--models] [--provider google|lovable] [--vision 10] [--text 5] [--no-brief]
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/integrations/supabase/types";
import { AI_MODELS, AI_LIMITS, GOOGLE_MODEL_IDS, type AiProvider } from "../src/lib/ai-models";
import { estimateCost } from "../src/lib/ai-budget";
import { libraryRequest } from "../src/lib/ai-prompts";
import { cleanTags, normalizeExtraction, type ExtractionKind } from "../src/lib/ai-schema";
import { completeGoogle, ProviderError, type CompleteInput, type CompleteResult } from "../src/lib/ai-provider.server";
import { fingerprint } from "../src/lib/library";
import { validateBrief } from "../src/lib/forecast-brief";
import { briefInputs, briefTool } from "../src/lib/forecast-brief.server";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string, d: string) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1]! : d; };
const provider = opt("--provider", "google") as AiProvider;
const key = process.env["GEMINI_API_KEY"]?.trim();
if (provider === "google" && !key) { console.log("GEMINI_API_KEY not set — parity check skipped (nothing called)."); process.exit(0); }

async function call(input: CompleteInput): Promise<CompleteResult> {
  if (provider === "google") return completeGoogle(input, key!);
  const { aiClient } = await import("../src/lib/ai-provider.server");
  const prev = process.env["AI_PROVIDER"]; process.env["AI_PROVIDER"] = "lovable";
  try { return await aiClient().complete(input); } finally { if (prev === undefined) delete process.env["AI_PROVIDER"]; else process.env["AI_PROVIDER"] = prev; }
}

if (flag("--models") || provider === "google") {
  if (provider === "google") {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": key! } });
    if (!r.ok) { console.log(`models.list failed: HTTP ${r.status}`); process.exit(1); }
    const ids = ((await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] }).models?.filter(m => m.supportedGenerationMethods?.includes("generateContent")).map(m => m.name.replace(/^models\//, "")) ?? [];
    console.log("MODELS (mapping canonical → AI Studio id → listed?)");
    for (const [canon, id] of Object.entries(GOOGLE_MODEL_IDS)) console.log(`  ${canon} → ${id} → ${ids.includes(id) ? "yes" : "NO"}`);
    console.log("  gemini-3* listed:", ids.filter(i => i.startsWith("gemini-3")).join(", "));
  }
  if (flag("--models")) process.exit(0);
}

const db = createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, { auth: { persistSession: false } });
const nVision = Number(opt("--vision", "10")), nText = Number(opt("--text", "5"));
const cost = (model: (typeof AI_MODELS)[keyof typeof AI_MODELS], u: { prompt_tokens: number; completion_tokens: number }) => estimateCost({ provider, model, input_tokens: u.prompt_tokens, output_tokens: u.completion_tokens });
const usageFor = async (snapshot: number | null, kind: string) => {
  let q = db.from("ai_usage").select("input_tokens,output_tokens,est_cost_usd").eq("kind", kind).eq("ok", true).order("created_at", { ascending: false }).limit(1);
  if (snapshot !== null) q = q.eq("snapshot_id", snapshot);
  return (await q.maybeSingle()).data;
};
const set = (v: unknown) => new Set(Array.isArray(v) ? v.map(String) : []);
const jaccard = (a: Set<string>, b: Set<string>) => { const u = new Set([...a, ...b]); return u.size ? [...a].filter(x => b.has(x)).length / u.size : 1; };
const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x);
const totals = { stored: { in: 0, out: 0, usd: 0 }, run: { in: 0, out: 0, usd: 0 } };
const add = (s: { input_tokens: number | null; output_tokens: number | null; est_cost_usd: number } | null, u: { prompt_tokens: number; completion_tokens: number }, usd: number) => {
  // Totals compare only calls with a stored receipt, so the delta is like-for-like.
  if (!s) return;
  totals.stored.in += s.input_tokens ?? 0; totals.stored.out += s.output_tokens ?? 0; totals.stored.usd += Number(s.est_cost_usd);
  totals.run.in += u.prompt_tokens; totals.run.out += u.completion_tokens; totals.run.usd += usd;
};

function capture(url: string): Promise<{ fold: string; sections: string[] } | null> {
  return new Promise(resolve => {
    const p = spawn("python3", ["scripts/ai-parity-capture.py", url], { stdio: ["ignore", "pipe", "ignore"] });
    const chunks: Buffer[] = []; p.stdout.on("data", c => chunks.push(c));
    const timer = setTimeout(() => p.kill("SIGKILL"), 90_000);
    p.on("close", code => { clearTimeout(timer); try { resolve(code === 0 ? JSON.parse(Buffer.concat(chunks).toString()) : null); } catch { resolve(null); } });
  });
}

// ---- Vision: 10 recent tagged live homepages, re-rendered now.
if (nVision > 0) {
  const { data: tags } = await db.from("library_tags").select("snapshot_id,domain,tags,created_at,library_snapshots!inner(source,page_type,viewport,url,captured_at,signals)").eq("library_snapshots.source", "live").order("created_at", { ascending: false }).limit(80);
  const picks: NonNullable<typeof tags> = []; const seen = new Set<string>();
  for (const t of tags ?? []) { const g = t.tags as { blocked?: boolean; low_confidence?: boolean; confidence?: number }; if (g.blocked || g.low_confidence || (g.confidence ?? 0) < 0.4 || seen.has(t.domain)) continue; seen.add(t.domain); picks.push(t); if (picks.length >= nVision) break; }
  const fields = ["imagery", "aesthetic", "components", "tone", "hero_layout", "ai_positioning", "color_mood"] as const;
  const agree: Record<string, { exact: number; jac: number; n: number }> = Object.fromEntries(fields.map(f => [f, { exact: 0, jac: 0, n: 0 }]));
  console.log(`\nVISION (${provider}) — ${picks.length} snapshots; pages re-rendered now, so some disagreement is page drift since capture`);
  for (const t of picks) {
    const s = t.library_snapshots as unknown as { url: string; captured_at: string; signals: unknown };
    const imgs = await capture(s.url);
    if (!imgs) { console.log(`  ${t.domain}: render failed — skipped`); continue; }
    const { data: site } = await db.from("library_sites").select("sector").eq("domain", t.domain).maybeSingle();
    const f = fingerprint(s.signals as never);
    const images = [imgs.fold, ...imgs.sections], imageLabels = ["fold", ...imgs.sections.map((_, i) => `section ${i + 1}, top to bottom`)];
    try {
      const r = await call({ model: AI_MODELS.vision, max_tokens: AI_LIMITS.output, temperature: 0, ...libraryRequest({ kind: "vision", captured_at: s.captured_at, context: JSON.stringify({ domain: t.domain, sector: site?.sector, headline: f.h1, h1_font: f.h1_family, body_font: f.body_family, theme: f.theme }), images, imageLabels }) });
      const got = cleanTags(JSON.parse(r.tool_call_args!)) as Record<string, unknown>, want = t.tags as Record<string, unknown>;
      const line: string[] = [];
      for (const k of fields) {
        const a = agree[k]!; a.n++;
        if (Array.isArray(want[k]) || Array.isArray(got[k])) { const j = jaccard(set(want[k]), set(got[k])); a.jac += j; if (j === 1) a.exact++; line.push(`${k} ${j.toFixed(2)}`); }
        else { const eq = (want[k] ?? null) === (got[k] ?? null); a.exact += eq ? 1 : 0; a.jac += eq ? 1 : 0; line.push(`${k} ${eq ? "=" : `${String(want[k])}→${String(got[k])}`}`); }
      }
      const stored = await usageFor(t.snapshot_id, "vision"), usd = cost(AI_MODELS.vision, r.usage); add(stored, r.usage, usd);
      console.log(`  ${t.domain} [${images.length} img] ${line.join(" · ")} | tokens ${stored?.input_tokens ?? "?"}/${stored?.output_tokens ?? "?"} → ${r.usage.prompt_tokens}/${r.usage.completion_tokens}`);
    } catch (e) { console.log(`  ${t.domain}: ${e instanceof ProviderError ? e.code : "parse_failed"}`); }
  }
  console.log("  per-field agreement (exact sets / mean Jaccard):");
  for (const k of fields) { const a = agree[k]!; if (a.n) console.log(`    ${k.padEnd(15)} ${a.exact}/${a.n}  ${(a.jac / a.n).toFixed(2)}`); }
}

// ---- Text: 5 recent extractions on private page text.
if (nText > 0) {
  const { data: ex } = await db.from("library_extractions").select("snapshot_id,domain,kind,data,created_at").order("created_at", { ascending: false }).limit(40);
  const kinds: ExtractionKind[] = ["pricing", "changelog", "product"]; const picks: NonNullable<typeof ex> = [];
  for (let i = 0; picks.length < nText && i < 40; i++) { const k = kinds[picks.length % 3]; const x = (ex ?? []).find(e => e.kind === k && !picks.includes(e)) ?? (ex ?? []).find(e => !picks.includes(e)); if (!x) break; picks.push(x); }
  console.log(`\nTEXT (${provider}) — ${picks.length} extractions, same stored page text`);
  for (const x of picks) {
    const [{ data: snap }, { data: txt }] = await Promise.all([db.from("library_snapshots").select("captured_at").eq("id", x.snapshot_id).single(), db.from("library_snapshot_text").select("raw_text").eq("snapshot_id", x.snapshot_id).maybeSingle()]);
    if (!snap || !txt?.raw_text) { console.log(`  ${x.domain} ${x.kind}: no private text — skipped`); continue; }
    const kind = x.kind as ExtractionKind;
    try {
      const r = await call({ model: AI_MODELS.text, max_tokens: AI_LIMITS.output, temperature: 0, ...libraryRequest({ kind, context: txt.raw_text.slice(0, AI_LIMITS.textChars), captured_at: snap.captured_at }) });
      const got = normalizeExtraction(kind, JSON.parse(r.tool_call_args!), snap.captured_at) as Record<string, unknown>, want = x.data as Record<string, unknown>;
      const keys = [...new Set([...Object.keys(want), ...Object.keys(got)])].filter(k => k !== "extracted_at");
      const same = keys.filter(k => stable(want[k]) === stable(got[k]));
      const lens = keys.filter(k => Array.isArray(want[k])).map(k => `${k} ${(want[k] as unknown[]).length}→${Array.isArray(got[k]) ? (got[k] as unknown[]).length : "-"}`);
      const stored = await usageFor(x.snapshot_id, kind), usd = cost(AI_MODELS.text, r.usage); add(stored, r.usage, usd);
      console.log(`  ${x.domain} ${kind}: ${same.length}/${keys.length} fields identical${lens.length ? ` · ${lens.join(" · ")}` : ""} | tokens ${stored?.input_tokens ?? "?"}/${stored?.output_tokens ?? "?"} → ${r.usage.prompt_tokens}/${r.usage.completion_tokens}`);
    } catch (e) { console.log(`  ${x.domain} ${kind}: ${e instanceof ProviderError ? e.code : "invalid_output"}`); }
  }
}

// ---- Brief: one generation from the latest ok forecast run (validated, not stored).
if (!flag("--no-brief")) {
  const { data: run } = await db.from("forecast_runs").select("id").eq("status", "ok").order("id", { ascending: false }).limit(1).single();
  const { data: stored } = await db.from("weekly_briefs").select("week,brief").order("week", { ascending: false }).limit(1).maybeSingle();
  if (run) {
    const { week, evidence, allowed, system } = await briefInputs(db as never, run.id);
    try {
      const r = await call({ model: AI_MODELS.text, max_tokens: 3000, temperature: 0.4, messages: [{ role: "system", content: system }, { role: "user", content: [{ type: "text", text: JSON.stringify({ week, evidence }) }] }], ...briefTool() });
      const raw = JSON.parse(r.tool_call_args!) as Record<string, unknown>; raw["week"] = week;
      const v = validateBrief(raw, allowed);
      const su = await usageFor(null, "brief"), usd = cost(AI_MODELS.text, r.usage); add(su, r.usage, usd);
      const sb = stored?.brief as { headline?: string; sections?: { citations: unknown[] }[] } | undefined;
      console.log(`\nBRIEF (${provider}) run ${run.id}: ${v.ok ? "VALID" : `INVALID (${v.reason})`}${v.ok ? ` · ${v.brief.sections.length} sections · ${v.brief.sections.flatMap(s => s.citations).length} citations · dropped ${Array.isArray(v.dropped) ? v.dropped.length : v.dropped}` : ""}`);
      if (v.ok) console.log(`  headline: ${v.brief.headline}`);
      console.log(`  stored ${stored?.week}: ${sb?.sections?.length ?? 0} sections · ${sb?.sections?.flatMap(s => s.citations).length ?? 0} citations · "${sb?.headline ?? ""}"`);
      console.log(`  tokens ${su?.input_tokens ?? "?"}/${su?.output_tokens ?? "?"} → ${r.usage.prompt_tokens}/${r.usage.completion_tokens}`);
    } catch (e) { console.log(`\nBRIEF (${provider}): ${e instanceof ProviderError ? e.code : "invalid_output"}`); }
  }
}

console.log(`\nTOTALS (calls with a stored receipt) stored ${totals.stored.in}/${totals.stored.out} tokens $${totals.stored.usd.toFixed(4)} → ${provider} ${totals.run.in}/${totals.run.out} tokens $${totals.run.usd.toFixed(4)} (Δ ${totals.stored.usd ? (((totals.run.usd - totals.stored.usd) / totals.stored.usd) * 100).toFixed(0) : "—"}%)`);
