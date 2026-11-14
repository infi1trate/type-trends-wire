import { createServerFn } from "@tanstack/react-start";
// Terminal status-bar read of the same payload as GET /api/public/health.
export const getHealth = createServerFn({ method: "GET" }).handler(async () => {
  const { healthPayload } = await import("./health.server");
  return healthPayload();
});
