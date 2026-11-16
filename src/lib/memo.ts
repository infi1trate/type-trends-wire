// Per-instance memos for server reads on the hosted runtime (Cloudflare Workers).
// Only SETTLED VALUES are shared between requests. A pending promise belongs to the request that created it: if that request ends
// first (it failed fast elsewhere, or the visitor went away), the promise can never settle, and every later request that awaited it
// failed at once ("This promise was created by a request that has since ended"). So: a load in flight may be joined, but a joiner that
// sees it fail runs its own load; a failed load is never kept; and each load gets one retry after a short backoff before giving up.
export const MEMO_RETRIES = 1;
export const MEMO_BACKOFF_MS = 250;
/** An in-flight load older than this is presumed orphaned and is not joined. */
export const MEMO_JOIN_MS = 20_000;

export type MemoOptions = { retries?: number; backoffMs?: number; max?: number; now?: () => number; sleep?: (ms: number) => Promise<void> };
const realSleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Run `load`, retrying `retries` times with a linear backoff. */
export async function withRetry<T>(load: () => Promise<T>, retries = MEMO_RETRIES, backoffMs = MEMO_BACKOFF_MS, sleep = realSleep): Promise<T> {
  for (let n = 0; ; n++) {
    try { return await load(); } catch (e) { if (n >= retries) throw e; await sleep(backoffMs * (n + 1)); }
  }
}

export type Memo<K, T> = ((k: K) => Promise<T>) & {
  /** The cached value when fresh, without loading. */ peek: (k: K) => T | undefined;
  /** Loads in flight (for tests: a failed or finished load leaves none behind). */ pending: () => number;
  /** Cached values (for tests: a failed load leaves none behind). */ size: () => number;
  clear: () => void;
};
/** A keyed memo: `key` turns the argument into the cache key (JSON by default). */
export function memoBy<K, T>(ttl: number, load: (k: K) => Promise<T>, o: MemoOptions & { key?: (k: K) => string } = {}): Memo<K, T> {
  const now = o.now ?? Date.now, keyOf = o.key ?? ((k: K) => JSON.stringify(k) ?? ""), max = o.max ?? 500;
  const values = new Map<string, { at: number; v: T }>(), flying = new Map<string, { at: number; p: Promise<T> }>();
  const run = (key: string, k: K): Promise<T> => {
    const p = withRetry(() => load(k), o.retries ?? MEMO_RETRIES, o.backoffMs ?? MEMO_BACKOFF_MS, o.sleep ?? realSleep).then(v => {
      values.delete(key); values.set(key, { at: now(), v });
      while (values.size > max) values.delete(values.keys().next().value!);
      return v;
    });
    const entry = { at: now(), p }; flying.set(key, entry);
    const done = () => { if (flying.get(key) === entry) flying.delete(key); };
    p.then(done, done);
    return p;
  };
  const fresh = (key: string) => { const hit = values.get(key); return hit && now() - hit.at < ttl ? hit : undefined; };
  const fn = ((k: K) => {
    const key = keyOf(k), hit = fresh(key);
    if (hit) return Promise.resolve(hit.v);
    const f = flying.get(key);
    if (f && now() - f.at < MEMO_JOIN_MS) return f.p.catch(() => { if (flying.get(key) === f) flying.delete(key); return run(key, k); });
    return run(key, k);
  }) as Memo<K, T>;
  fn.peek = k => fresh(keyOf(k))?.v;
  fn.pending = () => flying.size;
  fn.size = () => values.size;
  fn.clear = () => { values.clear(); flying.clear(); };
  return fn;
}
/** A memo of one value. */
export function memo<T>(ttl: number, load: () => Promise<T>, o: MemoOptions = {}): Memo<void, T> & (() => Promise<T>) {
  return memoBy<void, T>(ttl, () => load(), { ...o, key: () => "" }) as Memo<void, T> & (() => Promise<T>);
}
