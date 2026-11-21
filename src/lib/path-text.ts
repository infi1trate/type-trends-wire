// U3 · one readable form of a page's path for both renders. The server's router hands components a decoded path
// ("/stories/brand:coinbase.com:2026-11-20") while the browser's is percent-encoded ("%3A"); any text or link built from it then
// differs between the two renders (React #418). Each segment is decoded, and only characters that would change the address when
// decoded (/ ? # %) stay encoded, so the form is the same from either input and the address it names is unchanged. Pure (tested).
export function readablePath(path: string): string {
  return path.split("/").map(seg => { try { return decodeURIComponent(seg).replace(/[/?#%]/g, c => encodeURIComponent(c)); } catch { return seg; } }).join("/");
}
