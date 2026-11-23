// D1 Part 3 · one text per value whatever its key order (the database returns JSON objects with their keys reordered), so "is this the
// same as what is stored" never reads a reordered copy as a change. Pure.
export function stableJson(v: unknown): string {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stableJson(o[k])}`).join(",")}}`;
}
export async function stableHash(v: unknown): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableJson(v)));
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, "0")).join("");
}
