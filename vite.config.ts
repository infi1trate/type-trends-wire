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
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

// C1 · the generated MCP route files import the toolkit's TanStack handlers statically; this points that one import at a lazy wrapper
// (src/lib/mcp/lazy-handlers.ts, whose own import of the toolkit is left alone), so the toolkit loads on the first MCP request instead
// of in front of every page's first byte on a cold server.
const LAZY_MCP = resolve(fileURLToPath(new URL(".", import.meta.url)), "src/lib/mcp/lazy-handlers.ts");
const lazyMcpHandlers = {
  name: "slug-lazy-mcp-handlers",
  enforce: "pre" as const,
  resolveId(source: string, importer?: string) {
    return source === "@lovable.dev/mcp-js/stacks/tanstack" && importer && resolve(importer.split("?")[0] ?? importer) !== LAZY_MCP ? LAZY_MCP : null;
  },
};

type NitroOptions = Exclude<NonNullable<Parameters<typeof defineConfig>[0]>["nitro"], undefined>;

export default defineConfig({
  vite: { plugins: [lazyMcpHandlers, mcpPlugin({ path: "/api/public/mcp", metadataPath: "/api/public/oauth-protected-resource" })], define: { __SLUG_BUILD__: JSON.stringify(commit) } },
  // C1 · the server bundle grouped zod and unenv's performance shim into the AI tools toolkit's library chunk, so every page's first
  // byte on a cold server waited for that megabyte to load. Their own chunks keep the toolkit off the page path (it loads on the
  // first MCP request; see lazyMcpHandlers above). Nitro adds its per-package groups after these.
  // The wrapper passes nitro options through whole but types only a few of them, hence the cast.
  nitro: { rolldownConfig: { output: { codeSplitting: { groups: [
    { name: "_libs/zod", test: /node_modules[\\/]zod[\\/]/, priority: 30 },
    { name: "_libs/unenv", test: /node_modules[\\/]unenv[\\/]/, priority: 30 },
  ] } } } } as unknown as NitroOptions,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
