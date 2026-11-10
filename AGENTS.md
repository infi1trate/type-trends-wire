<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Band classification lives only in `src/lib/bands.ts` (pure, dependency-free) so the phase-3 MCP server can mirror it; covered by `src/lib/bands.test.ts`.
- All frontend Supabase reads go through query options in `src/lib/data.ts`; the front end only SELECTs and paginates past 1000 rows with `.range()`.
- Terminal UI components live in `src/components/terminal/`; the single route is `/`.
- Ingestion uses cron-authenticated `/api/public/` callbacks with privileged writes in `src/lib/ingest.server.ts`; this keeps the terminal public-read-only and secrets server-only.
- Shared ingest parsing/ranking lives in `src/lib/ingest.ts` with focused tests; cap outbound fetch concurrency at six for the hosted runtime.
- Google Fonts ingestion calls the configured connector gateway, never the provider with the connection credential, because connection credentials are gateway keys.
- MCP tools use the supported defineMcp toolkit and a shared anonymous SELECT-only client; public exposure must not bypass existing RLS.
- The MCP HTTP boundary adds bounded per-IP throttling and a methodology-resource compatibility adapter, because the toolkit currently only registers tool and app resources.
- HTML entity decoding is shared by ingest and render safety checks; a one-time maintenance script repairs existing rows without changing recurring jobs.
- Crawler writes use a dedicated dynamic-imported server handler with SHA-256 shared-secret authentication, bounded streaming bodies, and a pure payload schema; aggregate views use security_invoker to preserve public-read RLS.
