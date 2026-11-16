const real = globalThis.fetch; const log: string[] = []; let live = 0, peak = 0;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const u = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const t0 = Date.now(); live++; peak = Math.max(peak, live);
  try { return await real(input, init); } finally { live--; log.push(`${Date.now() - t0}ms ${u.pathname.replace("/rest/v1/", "")} ${decodeURIComponent(u.search).slice(0, 110)}`); }
}) as typeof fetch;
const { loadGallery } = await import("@/lib/gallery.server");
const t = Date.now();
const g = await loadGallery({ sectors: [], pattern: null, period: null, since: null, basis: null, section: null, changed: null, page: 1 } as never);
console.log("tiles", (g as { tiles: unknown[] }).tiles.length, "requests", log.length, "peak parallel", peak, "ms", Date.now() - t);
const by = new Map<string, number>(); for (const l of log) { const k = l.split(" ")[1]!; by.set(k, (by.get(k) ?? 0) + 1); }
console.log([...by].sort((a, b) => b[1] - a[1]));
console.log(log.sort((a, b) => parseInt(b) - parseInt(a)).slice(0, 12).join("\n"));
