# MCP keys (owner only)

The MCP endpoint (`/api/public/mcp`) works without a key at 60 requests per minute per IP. An owner-issued key raises the limit for one caller and records daily call counts per tool (aggregate only; no request bodies).

- Format: `dsgn_` + 32 base62 characters. Only its SHA-256 is stored; the plaintext is returned once, at creation.
- Callers send `Authorization: Bearer dsgn_…`. Unknown or revoked keys get HTTP 401 (JSON-RPC error, no detail). Revocation takes effect within about 30 seconds.
- Admin calls use the crawler shared secret (the same one the crawler uses for `/api/public/crawl-requests`), checked before the body is read. Set it in your shell as `CRAWLER_SECRET`; never paste it into files.

```sh
# Create (returns the key once; default rate_per_min 600, max 6000)
curl -sS -X POST https://type-trends-wire.lovable.app/api/public/mcp-keys \
  -H "Authorization: Bearer $CRAWLER_SECRET" -H "Content-Type: application/json" \
  -d '{"action":"create","name":"Acme agency","rate_per_min":600,"note":"pilot"}'

# Revoke
curl -sS -X POST https://type-trends-wire.lovable.app/api/public/mcp-keys \
  -H "Authorization: Bearer $CRAWLER_SECRET" -H "Content-Type: application/json" \
  -d '{"action":"revoke","id":"<key id from create or list>"}'

# List (ids, names, prefixes, created / last used, 30-day call counts; never hashes)
curl -sS -X POST https://type-trends-wire.lovable.app/api/public/mcp-keys \
  -H "Authorization: Bearer $CRAWLER_SECRET" -H "Content-Type: application/json" \
  -d '{"action":"list"}'
```
