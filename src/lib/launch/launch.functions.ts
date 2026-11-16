import { createServerFn } from "@tanstack/react-start";

/** Read-only launch readiness for /status/launch (gated like every page). */
export const getLaunch = createServerFn({ method: "GET" }).handler(async () => {
  const { loadLaunch } = await import("./launch.server");
  return loadLaunch();
});
