// POST /api/public/desk — the editor's machine endpoint (queue, edits, and the staff pages' data). Crawler-secret auth (compared by SHA-256) BEFORE the body is read;
// per-IP rate limit; every write is an appended story_edits row (stories are never changed).
import { createRateLimiter } from "../mcp/rate-limit";
import { DESK_BODY_LIMIT, DESK_RATE_PER_MIN, deskBody, pinOk, type StaffPage } from "./desk";
import type { EditRow } from "./edits";

const NO_STORE = { "cache-control": "no-store" };
const j = (status: number, body: unknown) => Response.json(body, { status, headers: NO_STORE });
const ipOf = (r: Request) => r.headers.get("cf-connecting-ip") ?? r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
async function bounded(request: Request, limit: number): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > limit) return null;
  const reader = request.body?.getReader(); if (!reader) return "";
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel().catch(() => {}); return null; } chunks.push(value); }
  const all = new Uint8Array(size); let o = 0; for (const c of chunks) { all.set(c, o); o += c.byteLength; }
  return new TextDecoder().decode(all);
}
export type DeskStore = { pitch?: (p: import("./pitch").PitchInput) => Promise<unknown>; exists: (id: string) => Promise<boolean>; insertEdit: (e: Omit<EditRow, "id" | "at">) => Promise<EditRow>; queue: (day: string | null) => Promise<unknown>; staff?: (page: StaffPage) => Promise<unknown> };
export type DeskDeps = { authorize: (r: Request) => Promise<boolean>; store: DeskStore; allow: (ip: string) => boolean; now: () => number };
const limiter = createRateLimiter(DESK_RATE_PER_MIN, 60_000);

export async function handleDesk(request: Request, deps?: DeskDeps): Promise<Response> {
  if (request.method !== "POST") return j(405, { error: "method_not_allowed" });
  const d = deps ?? await prodDeps();
  if (!d.allow(ipOf(request))) return j(429, { error: "rate_limited" });
  if (!(await d.authorize(request))) return j(401, { error: "unauthorized" });
  const text = await bounded(request, DESK_BODY_LIMIT);
  if (text === null) return j(413, { error: "body_too_large" });
  let raw: unknown; try { raw = JSON.parse(text); } catch { return j(400, { error: "invalid_json" }); }
  const p = deskBody.safeParse(raw); if (!p.success) return j(400, { error: "invalid_input", issues: p.error.issues.slice(0, 5).map(i => ({ path: i.path.join("."), message: i.message })) });
  const b = p.data;
  if (b.action === "check") return j(200, { ok: true });
  if (b.action === "staff") return d.store.staff ? j(200, await d.store.staff(b.page)) : j(404, { error: "not_found" });
  if (b.action === "queue") return j(200, await d.store.queue(b.day ?? null));
  if (b.action === "pitch") { if (!d.store.pitch) return j(404, { error: "not_found" }); const { action: _, ...p } = b; return j(201, { ok: true, pitched: await d.store.pitch(p) }); }
  if (!(await d.store.exists(b.id))) return j(404, { error: "not_found" });
  if (b.action === "pin" && !pinOk(b.until, d.now())) return j(400, { error: "invalid_input", issues: [{ path: "until", message: "must be in the future and within 7 days" }] });
  const payload: Record<string, unknown> = b.action === "pin" ? { until: new Date(b.until).toISOString() } : b.action === "kill" ? { reason: b.reason }
    : b.action === "correct" ? Object.fromEntries(Object.entries({ headline: b.headline, deck: b.deck, why_line: b.why_line }).filter(([, v]) => v !== undefined)) : {};
  const edit = await d.store.insertEdit({ story_id: b.id, action: b.action, payload, note: b.note ?? null });
  return j(201, { ok: true, edit });
}

async function prodDeps(): Promise<DeskDeps> {
  const [{ authenticateQueueCaller }, { supabaseAdmin: db }, { loadQueue }] = await Promise.all([import("../crawl-requests.server"), import("@/integrations/supabase/client.server"), import("./page.server")]);
  return {
    authorize: authenticateQueueCaller, allow: ip => limiter(ip), now: Date.now,
    store: {
      exists: async id => { const { data, error } = await db.from("stories").select("id").eq("id", id).maybeSingle(); if (error) throw new Error("story_lookup_failed"); return !!data; },
      insertEdit: async e => { const { data, error } = await db.from("story_edits").insert(e as never).select("id,story_id,action,payload,note,at").single(); if (error || !data) throw new Error("edit_insert_failed"); return data as unknown as EditRow; },
      queue: async day => { const [{ newsWindow }, { listPitches }] = await Promise.all([import("./page.server"), import("./pitch.server")]); const [q, news, pitches] = await Promise.all([loadQueue(day, true), newsWindow(), listPitches(db, 50).catch(() => [])]); return { ...q, news, pitches }; },
      pitch: async p => (await import("./pitch.server")).pitchNow(db, p),
      // Staff pages (/status, /status/launch, /welcome) load only here, after the key: nothing reaches the page's HTML first.
      staff: async page => page === "launch" ? (await import("../launch/launch.server")).loadLaunch()
        : page === "welcome" ? (await import("../editions/welcome.server")).loadWelcome()
        : { ok: true },
    },
  };
}
