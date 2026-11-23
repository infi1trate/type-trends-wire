// C1 · the AI tools toolkit's TanStack handlers, loaded on the first request to the two MCP routes instead of with the route tree.
// The generated route files (src/routes/api/public/mcp.ts, oauth-protected-resource.ts) import "@lovable.dev/mcp-js/stacks/tanstack"
// statically and the toolkit regenerates them, so vite.config.ts points that one import at this module (its own import of the toolkit
// below is left alone). Statically, the toolkit put about a megabyte of code in front of every page's first byte on a cold server.
// Same factories, same options, same responses.
import type * as Toolkit from "@lovable.dev/mcp-js/stacks/tanstack";

export type { TanStackMcpHandler, TanStackOAuthProtectedResourceMetadataHandler } from "@lovable.dev/mcp-js/stacks/tanstack";
type Ctx = Parameters<Toolkit.TanStackMcpHandler>[0];
const toolkit = () => import("@lovable.dev/mcp-js/stacks/tanstack");

function lazy(make: (m: typeof Toolkit) => (ctx: Ctx) => Promise<Response>): (ctx: Ctx) => Promise<Response> {
  let h: Promise<(ctx: Ctx) => Promise<Response>> | undefined;
  return async ctx => (await (h ??= toolkit().then(make).catch(e => { h = undefined; throw e; })))(ctx);
}
export const createTanStackMcpHandler = (...a: Parameters<typeof Toolkit.createTanStackMcpHandler>): Toolkit.TanStackMcpHandler =>
  lazy(m => m.createTanStackMcpHandler(...a));
export const createTanStackOAuthProtectedResourceMetadataHandler = (...a: Parameters<typeof Toolkit.createTanStackOAuthProtectedResourceMetadataHandler>): Toolkit.TanStackOAuthProtectedResourceMetadataHandler =>
  lazy(m => m.createTanStackOAuthProtectedResourceMetadataHandler(...a));
