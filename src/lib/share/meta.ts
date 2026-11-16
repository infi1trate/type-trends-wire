// Adds a page's share image to its head() meta: drops any image or card-size tags already there, then appends og:image (1200×630) and
// a large Twitter card with the same image. Pure; the image path is one of /share/…, /data/<slug>.png etc., always absolute.
import { SITE_URL } from "../site";
import { SHARE_SIZE, sharePath, type ShareKind } from "./scene";
type Meta = { title?: string; name?: string; property?: string; content?: string; charSet?: string };
const IMAGE_TAGS = new Set(["og:image", "og:image:width", "og:image:height", "og:image:alt", "twitter:card", "twitter:image"]);
export function withShare<M extends Meta>(image: string, meta: M[], alt?: string): Meta[] {
  const url = image.startsWith("http") ? image : `${SITE_URL}${image}`;
  return [...meta.filter(m => !IMAGE_TAGS.has(m.property ?? m.name ?? "")),
    { property: "og:image", content: url }, { property: "og:image:width", content: String(SHARE_SIZE.w) }, { property: "og:image:height", content: String(SHARE_SIZE.h) },
    ...(alt ? [{ property: "og:image:alt", content: alt }] : []),
    { name: "twitter:card", content: "summary_large_image" }, { name: "twitter:image", content: url }];
}
export const shareImageFor = (kind: ShareKind, id: string) => sharePath(kind, id);
