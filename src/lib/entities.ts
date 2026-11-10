// One decoding pass. Ampersands are decoded last so escaped entities remain escaped.
const named: Record<string, string> = {
  quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…",
};
export function decodeEntities(text: string): string {
  return text.replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (entity, value: string) => {
    const code = value[0]?.toLowerCase() === "x" ? parseInt(value.slice(1), 16) : parseInt(value, 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : entity;
  }).replace(/&(quot|apos|lt|gt|nbsp|rsquo|lsquo|rdquo|ldquo|ndash|mdash|hellip);/g, (_, name: string) => named[name] ?? _)
    .replace(/&amp;/g, "&");
}