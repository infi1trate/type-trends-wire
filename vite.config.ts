// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { execSync } from "node:child_process";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// N5 · the short commit this build is made from (src/lib/build-stamp.ts; GET /api/public/health returns it as `build`).
const commit = (() => {
  for (const k of ["SLUG_BUILD", "GITHUB_SHA", "CF_PAGES_COMMIT_SHA", "WORKERS_CI_COMMIT_SHA", "VERCEL_GIT_COMMIT_SHA", "COMMIT_REF", "SOURCE_COMMIT"]) {
    const v = process.env[k]?.trim();
    if (v && /^[0-9a-f]{7,40}$/i.test(v)) return v.slice(0, 7);
  }
  try { return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return "unknown"; }
})();

export default defineConfig({
  vite: { plugins: [mcpPlugin({ path: "/api/public/mcp", metadataPath: "/api/public/oauth-protected-resource" })], define: { __SLUG_BUILD__: JSON.stringify(commit) } },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
