// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
const throwers = vi.hoisted(() => ({ next: null as null | (() => never) }));
vi.mock('./store.server', () => ({ latestFontDate: vi.fn(), fontHistory: vi.fn(), fontSnapshot: vi.fn(), familySuggestions: vi.fn(), wire: vi.fn(async () => []) }));
vi.mock('../taste/tools.server', () => ({ critique: vi.fn(async () => { throwers.next!(); }), differentiate: vi.fn(), recommendType: vi.fn(), recommendPalette: vi.fn() }));
import { handleMcp } from './server.server';
import { LiteUnavailableError, LITE_UNAVAILABLE } from '../taste/lite.server';
import { TasteError } from '../taste/errors';
import { z } from 'zod';

let n = 0;
async function callCritique(thrower: () => never) {
  throwers.next = thrower;
  const req = new Request('http://localhost/api/public/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18', 'x-forwarded-for': `errors-${n++}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'critique', arguments: { url: 'https://example.com/' } } }) });
  const res = await handleMcp(req); expect(res.status).toBe(200);
  const body = await res.json(); return { isError: body.result.isError as boolean, text: body.result.content[0].text as string };
}

describe('MCP tool error surfacing', () => {
  it('shows the hosted LITE fail-closed message verbatim', async () => {
    const r = await callCritique(() => { throw new LiteUnavailableError(); });
    expect(r.isError).toBe(true); expect(r.text).toBe(LITE_UNAVAILABLE);
  });
  it('shows TasteError text and marks budget rejections with 429', async () => {
    const r = await callCritique(() => { throw new TasteError('Public AI daily limit reached (300 calls); try tomorrow', 429); });
    expect(r.isError).toBe(true); expect(r.text).toBe('Public AI daily limit reached (300 calls); try tomorrow (429)');
  });
  it('summarises zod input errors with their paths', async () => {
    const r = await callCritique(() => { z.object({ url: z.url() }).parse({ url: 'nope' }); throw new Error('unreachable'); });
    expect(r.isError).toBe(true); expect(r.text).toMatch(/^Invalid input — url: /);
  });
  it('keeps unknown errors generic', async () => {
    const r = await callCritique(() => { throw new Error('connection string postgres://secret'); });
    expect(r.isError).toBe(true); expect(r.text).not.toContain('secret');
  });
});
