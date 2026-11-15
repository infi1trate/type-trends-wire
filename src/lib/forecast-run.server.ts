// POST /api/public/forecast-run: cron auth first, then a bounded JSON body ({} or {"kind":"weekly"}), then the weekly run.
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { FORECAST_BODY_LIMIT, parseForecastRunBody } from "./forecast-run";

async function boundedText(request: Request): Promise<string | null> {
  const length = request.headers.get("content-length");
  if (length && Number(length) > FORECAST_BODY_LIMIT) return null;
  const reader = request.body?.getReader(); if (!reader) return "";
  const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > FORECAST_BODY_LIMIT) { await reader.cancel(); return null; } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function handleForecastRun(request: Request): Promise<Response> {
  const denied = await authenticateCronRequest(request); if (denied) return denied;
  const body = await boundedText(request);
  if (body === null) return Response.json({ ok: false, code: "body_too_large" }, { status: 413 });
  if (!parseForecastRunBody(body).ok) return Response.json({ ok: false, code: "invalid_input" }, { status: 400 });
  try { const { runForecast } = await import("./forecast.server"); return Response.json(await runForecast()); }
  catch { return Response.json({ ok: false, code: "forecast_failed" }, { status: 500 }); }
}
