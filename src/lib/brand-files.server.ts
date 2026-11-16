// The brand kit's files (brand/, the owner's folder), bundled into the server only and served through the gated /brand/files/<name>
// route. Text files ship as strings and images as inline data; nothing from brand/ is ever copied to a static or open path.
import { KIT_FILE_RE, KIT_FILE_TYPES, kitFilePurpose } from "./brand-pages";

const TEXT = import.meta.glob("../../brand/**/*.{svg,json,css,ts,md}", { query: "?raw", import: "default" }) as Record<string, () => Promise<string>>;
const BIN = import.meta.glob("../../brand/**/*.png", { query: "?inline", import: "default" }) as Record<string, () => Promise<string>>;
const nameOf = (p: string) => p.split("/").pop()!;
const groupOf = (p: string) => p.replace(/^.*\/brand\//, "").split("/").slice(0, -1).join("/") || "guidelines";
const ALL = { ...TEXT, ...BIN };
const BY_NAME = new Map(Object.keys(ALL).map(p => [nameOf(p), p] as const));

export type KitFile = { name: string; group: string; type: string; bytes: number; what: string; href: string };
async function bytesOf(path: string): Promise<Uint8Array> {
  const v = await ALL[path]!();
  if (path.endsWith(".png")) { const b64 = v.slice(v.indexOf(",") + 1); return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }
  return new TextEncoder().encode(v);
}
let listing: Promise<KitFile[]> | null = null;
/** Every kit file with its size and what it is for, grouped by folder. */
export function kitFiles(): Promise<KitFile[]> {
  listing ??= Promise.all([...BY_NAME].map(async ([name, path]) => ({ name, group: groupOf(path), type: name.split(".").pop()!, bytes: (await bytesOf(path)).byteLength, what: kitFilePurpose(name), href: `/brand/files/${name}` })))
    .then(l => l.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)));
  return listing;
}
/** One kit file by its flat name, or null (unknown names, paths, anything outside brand/). */
export async function kitFile(name: string): Promise<{ body: Uint8Array; type: string } | null> {
  if (!KIT_FILE_RE.test(name)) return null;
  const path = BY_NAME.get(name);
  if (!path) return null;
  return { body: await bytesOf(path), type: KIT_FILE_TYPES[name.split(".").pop()!]! };
}
