// @vitest-environment node
// The MCP server reports the brand name and still answers to its old machine name.
import { describe, expect, it, vi } from 'vitest';
vi.mock('./store.server', () => ({ latestFontDate: vi.fn(async () => '2026-11-10'), fontHistory: vi.fn(async () => [{ captured_on: '2026-11-10', family: 'Inter', category: 'sans-serif', is_variable: true, popularity_rank: 8, trending_rank: 20 }]), fontSnapshot: vi.fn(async () => ({ date: '2026-11-10', rows: [] })), familySuggestions: vi.fn(async () => []), wire: vi.fn(async () => []) }));
import { handleMcp, unaliasTool } from './server.server';
import { BRAND_NAME, LEGACY_MCP_NAME } from '../brand';

const call = (body: unknown, ip: string) => new Request('http://localhost/api/public/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18', 'x-forwarded-for': ip }, body: JSON.stringify(body) });

describe('MCP server name', () => {
  it('reports "slug" with the old name as an alias', async () => {
    expect(BRAND_NAME).toBe('slug');
    expect(LEGACY_MCP_NAME).toBe('type-trends-wire');
    const info = await (await handleMcp(new Request('http://localhost/api/public/mcp', { headers: { 'x-forwarded-for': 'name-info' } }))).json();
    expect(info).toMatchObject({ name: 'slug', aliases: ['type-trends-wire'] });
    const init = await (await handleMcp(call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } }, 'name-init'))).json();
    expect(init.result.serverInfo.name).toBe('slug');
  });
  it('answers tool calls prefixed with the old or new server name', async () => {
    expect(unaliasTool('type-trends-wire__get_trend')).toBe('get_trend');
    expect(unaliasTool('type-trends-wire.get_trend')).toBe('get_trend');
    expect(unaliasTool('slug__get_trend')).toBe('get_trend');
    expect(unaliasTool('get_trend')).toBe('get_trend');
    expect(unaliasTool('other__get_trend')).toBe('other__get_trend');
    const res = await (await handleMcp(call({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'type-trends-wire__get_trend', arguments: { family: 'Inter' } } }, 'name-alias'))).json();
    expect(JSON.parse(res.result.content[0].text).family).toBe('Inter');
  });
});
