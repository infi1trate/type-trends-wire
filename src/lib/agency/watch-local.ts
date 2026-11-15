// Device-local convenience list of watchlists this browser created or opened. Never sent anywhere except explicit edit calls.
import { TOKEN_RE } from "./watch";
export type LocalWatch = { id: string; name: string; token?: string; saved_at: string };
export type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
export const LIST_KEY = "dsgn.watch.lists", CURRENT_KEY = "dsgn.watch.current", LOCAL_MAX = 50;
const mem = new Map<string, string>();
const memKV: KV = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: k => void mem.delete(k) };
function kv(): KV { try { if (typeof window !== "undefined" && window.localStorage) { const t = "__dsgn_t"; window.localStorage.setItem(t, "1"); window.localStorage.removeItem(t); return window.localStorage; } } catch { /* private mode */ } return memKV; }
const valid = (x: unknown): x is LocalWatch => !!x && typeof x === "object" && TOKEN_RE.test(String((x as LocalWatch).id)) && typeof (x as LocalWatch).name === "string" && ((x as LocalWatch).token === undefined || TOKEN_RE.test(String((x as LocalWatch).token)));
export function localWatches(store: KV = kv()) {
  const read = (): LocalWatch[] => { try { const v = JSON.parse(store.getItem(LIST_KEY) ?? "[]"); return Array.isArray(v) ? v.filter(valid).slice(0, LOCAL_MAX) : []; } catch { return []; } };
  const write = (xs: LocalWatch[]) => { try { store.setItem(LIST_KEY, JSON.stringify(xs.slice(0, LOCAL_MAX))); } catch { /* full or blocked */ } };
  return {
    list: read,
    get: (id: string) => read().find(x => x.id === id) ?? null,
    /** Remember (or refresh) a list; a token is kept only when given, and an existing token survives a token-less save. */
    save: (w: { id: string; name: string; token?: string | null }, now = new Date()) => {
      const xs = read(), prev = xs.find(x => x.id === w.id);
      const token = w.token ?? prev?.token;
      const next: LocalWatch = { id: w.id, name: w.name.slice(0, 80), ...(token ? { token } : {}), saved_at: now.toISOString() };
      if (!valid(next)) return;
      write([next, ...xs.filter(x => x.id !== w.id)]);
    },
    forgetToken: (id: string) => write(read().map(x => (x.id === id ? { id: x.id, name: x.name, saved_at: x.saved_at } : x))),
    remove: (id: string) => { write(read().filter(x => x.id !== id)); try { if (store.getItem(CURRENT_KEY) === id) store.removeItem(CURRENT_KEY); } catch { /* ignore */ } },
    current: () => { try { const v = store.getItem(CURRENT_KEY); return v && TOKEN_RE.test(v) ? v : null; } catch { return null; } },
    setCurrent: (id: string) => { try { store.setItem(CURRENT_KEY, id); } catch { /* ignore */ } },
  };
}
