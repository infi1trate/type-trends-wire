// Serves each fixture folder on its own port so each looks like its own site.
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
const types = { ".html": "text/html; charset=utf-8", ".ttf": "font/ttf", ".txt": "text/plain" };
export function serve(dir, port) {
  return new Promise((res) => {
    const s = createServer((req, r) => {
      let p = join(dir, req.url === "/" ? "index.html" : req.url.split("?")[0].replace(/\/$/, ""));
      if (!existsSync(p) && existsSync(p + ".html")) p += ".html";
      if (!existsSync(p)) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { "content-type": types[extname(p)] ?? "application/octet-stream" }); r.end(readFileSync(p));
    }).listen(port, () => res(s));
  });
}
