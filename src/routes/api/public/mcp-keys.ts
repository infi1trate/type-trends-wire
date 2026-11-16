import { createFileRoute } from "@tanstack/react-router";
// Owner-only MCP key admin (create / revoke / list). Crawler shared-secret auth runs before the body is read.
export const Route = createFileRoute("/api/public/mcp-keys")({ server: { handlers: { POST: async ({ request }) => {
  const { handleKeyAdmin } = await import("@/lib/mcp/keys.server");
  try { return await handleKeyAdmin(request); } catch { return Response.json({ error: "internal_error" }, { status: 500, headers: { "cache-control": "no-store" } }); }
} } } });
