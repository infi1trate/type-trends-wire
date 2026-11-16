import { z } from 'zod';
import { ToolError } from '@lovable.dev/mcp-js';
import { withLabels } from '../../labels';
import { signalFields } from '../signal-index';
export const GF = 'Google Fonts Developer API (daily snapshot)';
/** Every tool answers through here, so each trait keeps its stable key and gains `label` + `dimension` (or `label_dimension` when a raw `dimension` is already present), `basis`, `tier`, `momentum_index`, `confidence`, and stages gain `stage_label`. */
export const json = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(withLabels(data,signalFields),null,2) }] });
export const TIER_INPUT = z.enum(['headline','supporting','archive']).optional().describe("Optional: only signals in this tier (headline = shown by default; supporting = evidence; archive = build plumbing and residuals). Unset returns every row as before.");
export const LABEL_NOTE = 'Each trait or signal keeps its stable key and adds a plain-English label, a dimension (FONT, COLOR, LAYOUT or VIBE), basis (measured or ai), tier (headline, supporting or archive), momentum_index (0–100 percentile of the stored next-wave score among headline + supporting signals), confidence (High, Medium or Low, with confidence_reason) and, where staged, stage_label (Emerging, Rising, Peaking, Fading or Steady).';
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
