// N5 · the short commit of the running build, so "is the new build live" can be checked from GET /api/public/health. Set at build
// time by vite.config.ts (the build host's commit variable, or git); "unknown" when the build host had neither. Dependency-free.
declare const __SLUG_BUILD__: string | undefined;
export const BUILD: string = (typeof __SLUG_BUILD__ === "string" && /^[0-9a-f]{7,40}$/i.test(__SLUG_BUILD__) ? __SLUG_BUILD__.slice(0, 7) : "unknown");
