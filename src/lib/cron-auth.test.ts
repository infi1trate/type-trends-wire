import { afterEach, expect, it, vi } from "vitest";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
afterEach(() => vi.unstubAllEnvs());
it("rejects ingestion requests with no bearer credential", async () => {
  vi.stubEnv("LOVABLE_CRON_SECRET", "synthetic-test-credential");
  const response = await authenticateCronRequest(new Request("https://example.test/api/public/ingest-wire", { method: "POST" }));
  expect(response?.status).toBe(401);
});
it("rejects ingestion requests with the wrong bearer credential", async () => {
  vi.stubEnv("LOVABLE_CRON_SECRET", "synthetic-test-credential");
  vi.stubEnv("LOVABLE_CRON_SECRET_PREVIOUS", "");
  const response = await authenticateCronRequest(new Request("https://example.test/api/public/ingest-gfonts", { headers: { Authorization: "Bearer wrong-test-credential" } }));
  expect(response?.status).toBe(401);
});
it("accepts the managed cron credential", async () => {
  vi.stubEnv("LOVABLE_CRON_SECRET", "synthetic-test-credential");
  const response = await authenticateCronRequest(new Request("https://example.test/api/public/ingest-wire", { headers: { Authorization: "Bearer synthetic-test-credential" } }));
  expect(response).toBeNull();
});