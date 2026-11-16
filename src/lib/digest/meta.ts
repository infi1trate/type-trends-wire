// Head tags for Digest and explainer pages: canonical on SITE_URL, og/twitter cards with absolute images. Pure.
import { SITE_URL, DIGEST_NAME } from "../site";
import type { Issue } from "./issue";
import type { TraitPage } from "./trait";
import { traitSummary } from "./trait";
import { oembedLink } from "../embed/embed";
export const EDITORIAL_FONTS = "https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..700&family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..600&family=Geist+Mono:wght@400;600&display=swap";
export const fontLinks = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
  { rel: "stylesheet", href: EDITORIAL_FONTS },
];
const rss = { rel: "alternate", type: "application/rss+xml", title: `${DIGEST_NAME} RSS`, href: `${SITE_URL}/digest/rss.xml` };
type Meta = { title?: string; name?: string; property?: string; content?: string };
const card = (title: string, description: string, url: string, image: string, w: number, h: number, type: string): Meta[] => [
  { title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description },
  { property: "og:type", content: type }, { property: "og:url", content: url }, { property: "og:image", content: image }, { property: "og:image:width", content: String(w) }, { property: "og:image:height", content: String(h) },
  { name: "twitter:card", content: "summary_large_image" }, { name: "twitter:title", content: title }, { name: "twitter:description", content: description }, { name: "twitter:image", content: image },
];
/** `path` is the page's own path (/digest or /digest/<week>); the image is always the issue's 1200×630 card. */
export function issueHead(i: Issue, path: string, specimenLinks: { rel: string; href: string }[] = []) {
  const url = `${SITE_URL}${path}`, title = `${i.cover.headline} — ${i.name} No. ${i.number}`, desc = (i.cover.standfirst || `${i.name} No. ${i.number}, ${i.dates.label}.`).slice(0, 300);
  return { meta: card(title, desc, url, `${SITE_URL}/digest/${i.week}.png`, 1200, 630, "article"), links: [{ rel: "canonical", href: url }, rss, ...fontLinks(), ...specimenLinks] };
}
export function traitHead(p: TraitPage) {
  // Canonical is the signal page (/signals/<key>); the share image stays at the open /trait/<key>.png path.
  const path = `/signals/${encodeURIComponent(p.key)}`, url = `${SITE_URL}${path}`, title = `${p.name} [${p.dimension}] — signal · DSGN/TERMINAL`;
  const desc = `${traitSummary(p)}. ${p.definition}`.slice(0, 300);
  return { meta: card(title, desc, url, `${SITE_URL}/trait/${encodeURIComponent(p.key)}.png`, 1200, 675, "article"), links: [{ rel: "canonical", href: url }, rss, oembedLink(url, `${p.name} [${p.dimension}]`), ...fontLinks()] };
}
export function archiveHead() {
  const url = `${SITE_URL}/digest/archive`, title = `Archive — ${DIGEST_NAME} · DSGN/TERMINAL`, desc = `Every issue of ${DIGEST_NAME}, the weekly edition of DSGN/TERMINAL: what moved in type, color, layout and vibe.`;
  return { meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "website" }, { property: "og:url", content: url }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: url }, rss, ...fontLinks()] };
}
/** Google Fonts stylesheet for one specimen, subset to the characters it shows. */
export const specimenLink = (family: string, text: string) => ({ rel: "stylesheet", href: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}&display=swap&text=${encodeURIComponent([...new Set(text)].join(""))}` });
export const SPECIMEN_TEXT = (family: string) => `${family} Aa Bb Rr Gg 0123456789 Hamburgefonstiv`;
