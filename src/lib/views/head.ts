// U1 · head metadata for an object's Data view: never indexed, canonical to the Read address, no share image of its own (share images
// and RSS point at the Read address only). Pure.
import { BRAND_NAME } from "../brand";
import { SITE_URL } from "../site";
import { objectPath, type ObjectRef } from "../ia";

export const readUrl = (o: ObjectRef) => `${SITE_URL}${objectPath(o)}`;
/** `path` names the Read address for pages that are not one of the four object types (reference boards, compare). */
export function dataViewHead(o: ObjectRef, name: string, path?: string) {
  const title = `${name} — data · ${BRAND_NAME}`, desc = `The data behind ${name} on ${BRAND_NAME}: every measured field, score and record, with its receipts.`, url = path ? `${SITE_URL}${path}` : readUrl(o);
  return {
    meta: [{ title }, { name: "description", content: desc }, { name: "robots", content: "noindex" }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "website" }, { property: "og:url", content: url }, { name: "twitter:card", content: "summary" }],
    links: [{ rel: "canonical", href: url }],
  };
}
export const DATA_VIEW_HEADERS = { "X-Robots-Tag": "noindex" } as const;
