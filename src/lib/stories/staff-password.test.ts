import { describe, expect, it, vi } from "vitest";

const CRAWLER = "crawler-test-secret", STAFF = "made-up-staff-password";
const hashes: { crawl: string; staff: string | null } = { crawl: "", staff: null };
vi.mock("@/integrations/supabase/client.server", () => {
  const q = (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "crawl_secrets" ? { secret_sha256: hashes.crawl } : hashes.staff ? { secret_sha256: hashes.staff } : null, error: null }) }) }) });
  return { supabaseAdmin: { from: q } };
});

import { sha256Hex, handleCrawlIngest } from "../crawl-ingest.server";
import { authenticateQueueCaller } from "../crawl-requests.server";
import { authenticateStaff } from "../staff-auth.server";
import { createFailGate, handleDesk, type DeskDeps } from "./desk.server";

const prodLike = async (r: Request) => (await authenticateQueueCaller(r)) || ((await authenticateStaff(r)) ? "owner" as const : false);
function deps() {
  const logs: { actor: string; action: string }[] = [];
  const d: DeskDeps = { authorize: prodLike, allow: () => true, now: () => 1_000, failures: createFailGate(),
    store: { exists: async () => true, insertEdit: async e => ({ id: 1, at: "x", ...e }), queue: async () => ({ ok: "queue" }), staff: async p => ({ page: p }),
      log: async (r: { actor: string; action: string }) => { logs.push(r); return logs.length; } } as DeskDeps["store"] };
  return { d, logs };
}
const post = (body: unknown, bearer: string) => new Request("https://site.test/api/public/desk", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${bearer}`, "cf-connecting-ip": "1.2.3.4" }, body: JSON.stringify(body) });
const setup = async (staff = true) => { hashes.crawl = await sha256Hex(CRAWLER); hashes.staff = staff ? await sha256Hex(STAFF) : null; };

describe("staff password on the desk", () => {
  it("opens staff reads and actions", async () => {
    await setup(); const { d } = deps();
    expect(await (await handleDesk(post({ actor: "owner", action: "queue" }, STAFF), d)).json()).toEqual({ ok: "queue" });
    expect((await handleDesk(post({ actor: "owner", action: "staff", page: "status" }, STAFF), d)).status).toBe(200);
    expect((await handleDesk(post({ actor: "owner", action: "kill", id: "move:1", reason: "duplicate" }, STAFF), d)).status).toBe(201);
  });
  it("acts as owner whatever the body names", async () => {
    await setup(); const { d, logs } = deps();
    await handleDesk(post({ actor: "standards", action: "queue" }, STAFF), d);
    expect(logs.at(-1)?.actor).toBe("owner");
  });
  it("the crawler secret keeps its own actor", async () => {
    await setup(); const { d, logs } = deps();
    expect((await handleDesk(post({ actor: "standards", action: "queue" }, CRAWLER), d)).status).toBe(200);
    expect(logs.at(-1)?.actor).toBe("standards");
  });
  it("a wrong value is 401 and the ninth wrong try in ten minutes is 429", async () => {
    await setup(); const { d } = deps();
    for (let i = 0; i < 8; i++) expect((await handleDesk(post({ actor: "owner", action: "queue" }, "wrong"), d)).status).toBe(401);
    expect((await handleDesk(post({ actor: "owner", action: "queue" }, "wrong"), d)).status).toBe(429);
    expect((await handleDesk(post({ actor: "owner", action: "queue" }, STAFF), d)).status).toBe(429);
    const later = { ...d, now: () => 1_000 + 10 * 60_000 };
    expect((await handleDesk(post({ actor: "owner", action: "queue" }, STAFF), later)).status).toBe(200);
  });
  it("with no staff_secrets row only the crawler secret works", async () => {
    await setup(false); const { d } = deps();
    expect((await handleDesk(post({ actor: "owner", action: "queue" }, STAFF), d)).status).toBe(401);
    expect((await handleDesk(post({ actor: "owner", action: "queue" }, CRAWLER), d)).status).toBe(200);
  });
  it("does not open the crawler ingest", async () => {
    await setup();
    const r = new Request("https://site.test/api/public/ingest-crawl", { method: "POST", headers: { "content-type": "application/json", "x-crawl-secret": STAFF, authorization: `Bearer ${STAFF}` }, body: "{}" });
    expect([401, 403]).toContain((await handleCrawlIngest(r)).status);
  });
});
