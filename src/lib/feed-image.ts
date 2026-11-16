// The drawn mark in feeds: RSS channels carry the kit's s monogram (the favicon, the one kit file on an open path, so feed readers
// can fetch it while the rest of the site is gated). Pure.
import { BRAND_NAME, SITE_ORIGIN } from "./brand";
export const FEED_IMAGE = `${SITE_ORIGIN}/favicon.svg`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const rssImage = (title: string, link: string) => `<image><url>${FEED_IMAGE}</url><title>${esc(title)}</title><link>${esc(link)}</link></image>`;
export const feedImageTitle = (feed: string) => `${feed} · ${BRAND_NAME}`;
