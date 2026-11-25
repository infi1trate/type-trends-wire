// Pure helpers for the Wayback history backfill. No network.

export const START_YEAR = 2021;

/** All quarters from START_YEAR Q1 to the quarter before `now` (the live crawler covers the current one). */
export function quarters(now = new Date()) {
  const out = [];
  const curQ = now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3);
  for (let y = START_YEAR; y <= now.getUTCFullYear(); y++) {
    for (let q = 0; q < 4; q++) if (y * 4 + q < curQ) out.push(`${y}Q${q + 1}`);
  }
  return out;
}

/** Coarse-first pass number: Q1 = 1, Q3 = 2, Q2/Q4 = 3. */
export const passOf = (quarter) => ({ 1: 1, 3: 2, 2: 3, 4: 3 })[Number(quarter.slice(-1))];

/** Midpoint of a quarter, the ideal capture date. */
export function quarterMid(quarter) {
  const y = Number(quarter.slice(0, 4)), q = Number(quarter.slice(-1));
  return new Date(Date.UTC(y, (q - 1) * 3 + 1, 15));
}

export function quarterOf(date) {
  return `${date.getUTCFullYear()}Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

/** "20230115083000" <-> Date */
export const tsToDate = (ts) => new Date(Date.UTC(+ts.slice(0, 4), +ts.slice(4, 6) - 1, +ts.slice(6, 8), +ts.slice(8, 10) || 0, +ts.slice(10, 12) || 0, +ts.slice(12, 14) || 0));

/** Parse a CDX JSON response (array of rows, first row is the header) into capture timestamps. */
export function parseCdx(json) {
  if (!Array.isArray(json) || json.length < 2) return [];
  const head = json[0];
  const iTs = head.indexOf("timestamp"), iStatus = head.indexOf("statuscode"), iMime = head.indexOf("mimetype");
  return json.slice(1)
    .filter((r) => (iStatus < 0 || r[iStatus] === "200") && (iMime < 0 || /html/.test(r[iMime])))
    .map((r) => r[iTs])
    .filter((ts) => /^\d{14}$/.test(ts));
}

/** Capture inside `quarter` closest to its midpoint, or null. */
export function pickCapture(timestamps, quarter) {
  const mid = quarterMid(quarter).getTime();
  let best = null, bestD = Infinity;
  for (const ts of timestamps) {
    const d = tsToDate(ts);
    if (quarterOf(d) !== quarter) continue;
    const dist = Math.abs(d.getTime() - mid);
    if (dist < bestD) { best = ts; bestD = dist; }
  }
  return best;
}

/** Up to `n` captures in `quarter`, nearest the midpoint first, each ≥14 days from the others — alternates
 *  to try when an archived render comes back blank or broken. */
export function pickCaptures(timestamps, quarter, n = 3) {
  const mid = quarterMid(quarter).getTime();
  const inQ = timestamps.map((ts) => ({ ts, t: tsToDate(ts).getTime() })).filter((c) => quarterOf(new Date(c.t)) === quarter)
    .sort((a, b) => Math.abs(a.t - mid) - Math.abs(b.t - mid));
  const out = [];
  for (const c of inQ) { if (out.length >= n) break; if (out.every((o) => Math.abs(o.t - c.t) >= 14 * 86400000)) out.push(c); }
  return out.map((c) => c.ts);
}

/** Archived renders that came back empty (missing assets, broken playback, JS shells that never booted). */
export function blankArchive(sig) {
  const chars = sig?.composition?.text_chars_fold ?? 0;
  const boxes = (sig?.skeleton ?? []).filter((b) => b.kind !== "section").length;
  return chars < 40 && boxes < 6;
}

/** iframe-mode playback: archived assets, no Wayback toolbar. */
export const archiveUrl = (ts, domain) => `https://web.archive.org/web/${ts}if_/https://${domain}/`;

export const cdxUrl = (domain) =>
  `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain + "/")}&output=json&fl=timestamp,statuscode,mimetype&from=${START_YEAR}0101&filter=statuscode:200&collapse=timestamp:8`;

/** Actual capture timestamp after playback redirects, from the final archive URL. */
export const tsFromArchiveUrl = (u) => /\/web\/(\d{14})/.exec(u || "")?.[1] ?? null;

/** Archive error/placeholder pages rather than the site. */
export const ARCHIVE_ERROR = /wayback machine has not archived|got an http \d{3} response at crawl time|this url has been excluded|hrm\.|redirecting to\.\.\.|page not found|access denied|just a moment|attention required|captcha/i;

/** Quarters this run knows will never arrive: the Archive's index holds no usable copy ("no_capture"), or a copy
 * failed to render `failLimit` times ("unreadable"). Only for brands whose index answer is on file, and never for a
 * quarter the site already stores. The site records them so a brand's archive can count as fully read. */
export function archiveGaps(sites, have, quarterList, cache, failLimit = 2) {
  const out = [];
  for (const s of sites) {
    const e = cache?.cdx?.[s.domain];
    if (!e) continue;
    for (const q of quarterList) {
      if (have.get(s.domain)?.has(q)) continue;
      if (!(e.picks?.[q]?.length)) out.push({ domain: s.domain, quarter: q, reason: "no_capture" });
      else if ((cache.failed?.[`${s.domain}|${q}`] ?? 0) >= failLimit) out.push({ domain: s.domain, quarter: q, reason: "unreadable" });
    }
  }
  return out;
}

/**
 * Work queue: every (site, quarter) not yet captured, ordered coarse-first (pass), then quarter,
 * then interleaved across sectors so an interrupted run still covers every sector.
 */
export function buildQueue(sites, have, quarterList, maxPass = 3) {
  const items = [];
  for (const q of quarterList) {
    const pass = passOf(q);
    if (pass > maxPass) continue;
    const bySector = new Map();
    for (const s of sites) {
      if (have.get(s.domain)?.has(q)) continue;
      if (!bySector.has(s.sector)) bySector.set(s.sector, []);
      bySector.get(s.sector).push(s);
    }
    const lists = [...bySector.values()];
    for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) items.push({ ...l[i], quarter: q, pass });
  }
  return items.sort((a, b) => a.pass - b.pass); // stable: keeps quarter + sector interleave inside a pass
}
