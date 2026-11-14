import { ToolError } from '@lovable.dev/mcp-js';
export const GF = 'Google Fonts Developer API (daily snapshot)';
export const json = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data,null,2) }] });
export const daysBefore = (date:string,n:number) => new Date(Date.parse(`${date}T00:00:00Z`)-n*86400000).toISOString().slice(0,10);
export const READ = {readOnlyHint:true,openWorldHint:false} as const;
export const receipt = {source:GF,method:'trend://methodology',terminal:'https://type-trends-wire.lovable.app'};
// Caller-safe error surfacing: known error classes are written for the caller, so their message is shown verbatim;
// anything else stays the toolkit's generic failure (details only in server logs). Matched by name to keep imports light.
const SAFE_ERRORS = new Set(['TasteError', 'LiteUnavailableError', 'ToolError']);
type Issue = { path?: PropertyKey[]; message?: string };
export function publicErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  if (error.name === 'ZodError') {
    const issues = ((error as Error & { issues?: Issue[] }).issues ?? []).slice(0, 5).map(i => `${(i.path ?? []).map(String).join('.') || 'input'}: ${i.message ?? 'invalid'}`);
    return `Invalid input — ${issues.join('; ') || 'validation failed'}`;
  }
  if (!SAFE_ERRORS.has(error.name)) return null;
  const status = (error as Error & { status?: unknown }).status;
  return `${error.message.slice(0, 500)}${status === 429 ? ' (429)' : ''}`;
}
export async function surfaced(run: () => Promise<unknown>) {
  try { return json(await run()); }
  catch (error) {
    const message = publicErrorMessage(error);
    if (message === null) throw error;
    throw new ToolError(message);
  }
}
