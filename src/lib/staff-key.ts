// The editor key, held in this tab's memory only (never storage, cookies, URL or logs), shared by the staff pages (/desk,
// /status, /status/launch, /welcome, /kit) and the links to them. A reload forgets it. The server never sees it except as the
// bearer on /api/public/desk calls, where it is checked against the stored SHA-256 before any body is read.
import { useSyncExternalStore } from "react";

/** Links that lead to staff-only pages: shown only once the editor key is accepted in the tab. */
export const STAFF_HREFS: ReadonlySet<string> = new Set(["/status", "/desk", "/status/launch", "/welcome", "/kit"]);

let key: string | null = null;
const subs = new Set<() => void>();
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export const staffKey = (): string | null => (typeof window === "undefined" ? null : key);
export const setStaffKey = (k: string | null) => { key = k && k.length ? k : null; subs.forEach(f => f()); };
/** The accepted key, or null. Server render and first hydration always read null, so staff content never ships in HTML. */
export const useStaffKey = () => useSyncExternalStore(subscribe, staffKey, () => null);

/** N1 · the staff pages act as the owner (the person holding the editor key); desk sessions name their own desk. */
export const STAFF_ACTOR = "owner";
/** One call to the editor endpoint with the key as bearer. A 401 forgets the key. Every call names its actor (N1). */
export async function staffCall(body: Record<string, unknown>, k: string | null = staffKey()): Promise<Response> {
  const r = await fetch("/api/public/desk", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${k ?? ""}` }, body: JSON.stringify({ actor: STAFF_ACTOR, ...body }), credentials: "same-origin" });
  if (r.status === 401 && k === key) setStaffKey(null);
  return r;
}
/** JSON from the editor endpoint, or a thrown Error with the status. */
export async function staffJson<T>(body: Record<string, unknown>): Promise<T> {
  const r = await staffCall(body);
  if (!r.ok) throw new Error(`staff_${r.status}`);
  return (await r.json()) as T;
}
/** Try a key; on success it is kept for the tab. Returns a plain sentence on failure. */
export async function unlockStaff(k: string): Promise<string | null> {
  const r = await staffCall({ action: "check" }, k).catch(() => null);
  if (r?.ok) { setStaffKey(k); return null; }
  return r?.status === 401 ? "That key was not accepted." : r?.status === 429 ? "Too many tries; wait a minute." : "The desk could not be reached.";
}
