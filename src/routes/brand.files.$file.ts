import { createFileRoute } from "@tanstack/react-router";
// One file from the brand kit (brand/), by its flat name. Gated like every page (not in OPEN_PATHS) while BRAND_PUBLIC is false.
export const Route = createFileRoute("/brand/files/$file")({ server: { handlers: { GET: async ({ params }) => {
  const { kitFile } = await import("@/lib/brand-files.server");
  const f = await kitFile(params.file);
  if (!f) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(f.body as BodyInit, { headers: {
    "content-type": f.type, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff", "x-robots-tag": "noindex",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:", "content-disposition": `inline; filename="${params.file}"`,
  } });
} } } });
