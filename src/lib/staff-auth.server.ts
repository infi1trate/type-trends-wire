// Staff password: opens /api/public/desk only (as the owner). Its SHA-256 lives in staff_secrets row 1, never in the repository.
import { constantTimeHashEqual, sha256Hex } from "./crawl-ingest.server";

export type StaffHashStore = () => Promise<string | null>;
const dbHash: StaffHashStore = async () => {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data, error } = await db.from("staff_secrets").select("secret_sha256").eq("id", 1).maybeSingle();
  if (error) throw new Error("Staff secret lookup failed");
  return data?.secret_sha256 ?? null;
};

/** True when the bearer's SHA-256 equals the stored staff hash. No row: false. */
export async function authenticateStaff(request: Request, store: StaffHashStore = dbHash): Promise<boolean> {
  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1]?.trim();
  if (!bearer) return false;
  const stored = await store();
  return !!stored && constantTimeHashEqual(await sha256Hex(bearer), stored);
}
