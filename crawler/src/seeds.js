import { execFileSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Infrastructure, CDNs, trackers and adult domains that rank high on traffic lists but aren't websites people design.
const INFRA = /(^|\.)(googleapis|gstatic|googleusercontent|googlevideo|googlesyndication|googletagmanager|google-analytics|doubleclick|1e100|akamai\w*|akadns|edgekey|edgesuite|cloudfront|cloudflare(-dns)?|amazonaws|awsdns|azure\w*|msedge|windowsupdate|trafficmanager|office365?|live|msn|bing|apple-dns|icloud-content|mzstatic|aaplimg|fbcdn|cdninstagram|whatsapp\.net|tiktokcdn\w*|byteoversea|ttwstatic|root-servers|digicert|sectigo|letsencrypt|ocsp\w*|gvt[12]|app-measurement|crashlytics|branch|adnxs|criteo|taboola|outbrain|rubiconproject|pubmatic|casalemedia|demdex|omtrdc|scorecardresearch|segment|sentry|newrelic|nr-data|hotjar|yandex\.net|spotifycdn|steamstatic|xboxlive|playstation\.net|nintendo\.net|samsungcloud\w*|miui|xiaomi\.net|tplinkcloud|ntp|pool\.ntp|in-addr)\.\w+$/i;
const ADULT = /(porn|xxx|sex|xvideo|xnxx|xhamster|redtube|youporn|youjizz|onlyfans|chaturbate|stripchat|bongacams|spankbang|hentai|nsfw|toon\d|javhd|erome|fapello|rule34|nhentai|camsoda|livejasmin|eporner|tnaflix|sxyprn|^xh|\.xh|xhname|xhstream|xhopen|javsub|javhd|jav[a-z]*\.|tube8|beeg|motherless|literotica|fansly|missav|hanime|jav\d|tubegalore|mat\d+tube|taktube|vidtube)/i;
// Logged-in app surfaces and utility subdomains: real traffic, but not the brand's designed front door.
const APP_SUB = /^(m|mail|outlook|classroom|accounts|login|amp|cdn|app|my|portal|auth|sso|signin|web|drive|docs|calendar|meet|teams|admin|dashboard|secure|online|webmail|music|open|policies|support|help|translate|maps|news|chat|studio|down|dl|download)\./i;
const SLD = /\.(co|com|net|org|gov|ac|edu|ne|or)\.[a-z]{2}$/i;
export const registrable = (h) => h.split(".").slice(SLD.test(h) ? -3 : -2).join(".");
const SKIP_VANGUARD = /(^|\.)(github\.com|github\.io|gitlab\.com|youtube\.com|youtu\.be|twitter\.com|x\.com|medium\.com|substack\.com|reddit\.com|news\.ycombinator\.com|apps\.apple\.com|play\.google\.com|chromewebstore\.google\.com|docs\.google\.com|arxiv\.org|npmjs\.com|pypi\.org|huggingface\.co|notion\.site|vercel\.app|netlify\.app|herokuapp\.com|pages\.dev|itch\.io|bsky\.app|linkedin\.com|wikipedia\.org)$/i;

export const hostOf = (u) => { try { return new URL(u.includes("://") ? u : `https://${u}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; } };
const GAMBLING = /(matka|dpboss|satta|xoso|xổsố|lottery|loteria|lotto|casino|betting|\bbet\d|\d+bet|1xbet|betway|sportybet|toto|slot|thscore|bola\d|jackpot|pokies)/i;
export const keepMainstream = (d) => d && !INFRA.test(d) && !ADULT.test(d) && !GAMBLING.test(d) && d.split(".").length <= 3;
export const keepVanguard = (d) => d && !SKIP_VANGUARD.test(d) && !ADULT.test(d);

/** CrUX top origins (Chrome UX Report, popularity buckets of pages real users load; github.com/zakird/crux-top-lists). */
export async function cruxOrigins(maxBucket = 5000) {
  const r = await fetch("https://raw.githubusercontent.com/zakird/crux-top-lists/main/data/global/current.csv.gz");
  if (!r.ok) throw new Error(`crux HTTP ${r.status}`);
  const rows = gunzipSync(Buffer.from(await r.arrayBuffer())).toString().split(/\r?\n/).slice(1).map((l) => l.split(",")).filter((x) => x.length === 2 && Number(x[1]) <= maxBucket);
  rows.sort((a, b) => Number(a[1]) - Number(b[1])); // bucket 1000 before 5000; unordered within a bucket
  return rows.map(([origin, bucket]) => ({ origin, bucket: Number(bucket) }));
}

/** Tranco top list (research-grade traffic ranking, https://tranco-list.eu). */
export async function trancoDomains(n) {
  try {
    const meta = await (await fetch("https://tranco-list.eu/api/lists/date/latest")).json();
    const csv = await (await fetch(`https://tranco-list.eu/download/${meta.list_id}/${n}`)).text();
    const rows = csv.trim().split(/\r?\n/).map((l) => l.split(",")[1]).filter(Boolean);
    if (rows.length > n / 2) return { list_id: meta.list_id, domains: rows };
  } catch (e) { console.warn("tranco api failed, falling back to zip:", String(e)); }
  const dir = mkdtempSync(join(tmpdir(), "tranco-"));
  const buf = Buffer.from(await (await fetch("https://tranco-list.eu/top-1m.csv.zip")).arrayBuffer());
  writeFileSync(join(dir, "t.zip"), buf);
  const csv = execFileSync("unzip", ["-p", join(dir, "t.zip")], { maxBuffer: 64 << 20 }).toString();
  return { list_id: "top-1m.csv.zip", domains: csv.split(/\r?\n/).slice(0, n).map((l) => l.split(",")[1]).filter(Boolean) };
}

/** Show HN launches with real traction: a proxy for what new products look like right now. */
export async function showHnDomains(days = 180, minPoints = 25) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const out = [];
  for (let page = 0; page < 10; page++) {
    const url = `https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&hitsPerPage=1000&page=${page}&numericFilters=points>=${minPoints},created_at_i>${since}`;
    const j = await (await fetch(url)).json();
    for (const h of j.hits ?? []) if (h.url) out.push({ domain: hostOf(h.url), url: h.url, points: h.points });
    if (page + 1 >= (j.nbPages ?? 0)) break;
  }
  return out;
}

export function curated(path) {
  return readFileSync(path, "utf8").split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim()).filter(Boolean);
}

/** Candidate lists per index, deduped by registrable domain across indexes (mainstream wins). Over-fetches so failures can be skipped. */
export async function buildSeeds({ perIndex, curatedPath }) {
  const sites = new Set();
  const mainstream = [];
  let source;
  try {
    const crux = await cruxOrigins();
    source = { mainstream: "crux-top-lists global <=5000", crux_candidates: crux.length };
    for (const { origin } of crux) {
      const h = hostOf(origin);
      if (!h || ADULT.test(h) || GAMBLING.test(h) || APP_SUB.test(h) || INFRA.test(h)) continue;
      const reg = registrable(h);
      if (sites.has(reg)) continue;
      sites.add(reg); mainstream.push(origin.replace(/\/$/, ""));
      if (mainstream.length >= perIndex * 2) break;
    }
  } catch (e) {
    console.warn("CrUX failed, falling back to Tranco:", String(e));
    const t = await trancoDomains(Math.max(perIndex * 4, 2000));
    source = { mainstream: "tranco", tranco_list: t.list_id };
    for (const d of t.domains.map(hostOf).filter(keepMainstream)) {
      const reg = registrable(d);
      if (sites.has(reg)) continue;
      sites.add(reg); mainstream.push(d);
      if (mainstream.length >= perIndex * 2) break;
    }
  }
  const hn = await showHnDomains();
  hn.sort((a, b) => b.points - a.points);
  const vanguard = [];
  for (const d of [...curated(curatedPath).map(hostOf), ...hn.map((x) => x.domain)]) {
    if (!keepVanguard(d)) continue;
    const reg = registrable(d);
    if (sites.has(reg)) continue;
    sites.add(reg); vanguard.push(d);
  }
  return { mainstream, vanguard: vanguard.slice(0, perIndex * 2), meta: { ...source, show_hn_candidates: hn.length } };
}
