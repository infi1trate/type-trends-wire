// U2b · one glossary: `?` in the terminal, in Read pages and in Data views opens the same overlay over the one list in glossary.ts.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { GLOSSARY } from "./glossary";

const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : []; });
const files = walk("src").filter(f => !f.includes("integrations/"));
const src = new Map(files.map(f => [f, readFileSync(f, "utf8")]));

describe("one glossary list", () => {
  it("every mode's `?` overlay is the one Glossary component", () => {
    const overlays = [...src].filter(([, s]) => /overlay === "glossary"/.test(s)).map(([f]) => f).sort();
    expect(overlays).toEqual(["src/components/dataview/DataShell.tsx", "src/components/read/ReadShell.tsx", "src/routes/terminal.tsx"]);
    for (const f of overlays) expect(src.get(f)).toMatch(/import \{ Glossary \} from "@\/components\/terminal\/Glossary"/);
  });
  it("the Glossary component reads only GLOSSARY from glossary.ts", () => {
    expect(src.get("src/components/terminal/Glossary.tsx")).toMatch(/from "@\/lib\/glossary"/);
  });
  it("no other file declares a glossary list", () => {
    const lists = [...src].filter(([f, s]) => f !== "src/lib/glossary.ts" && /\b(const|let)\s+[A-Z_]*GLOSSARY[A-Z_]*\s*[:=]/.test(s)).map(([f]) => f);
    expect(lists).toEqual([]);
  });
  it("entries have unique ids", () => {
    expect(new Set(GLOSSARY.map(g => g.id)).size).toBe(GLOSSARY.length);
  });
});
