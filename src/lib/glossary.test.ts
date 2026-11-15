import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GLOSSARY, glossaryEntry, searchGlossary, stageId, dimensionId } from "./glossary";
import { STAGES, DIMENSIONS } from "./labels";
import { METHOD_IDS } from "./methodology";

const ROOT = join(__dirname, "..");
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? files(join(dir, d.name)) : /\.tsx$/.test(d.name) ? [join(dir, d.name)] : []);
/** Registry of heading ids used in the UI: g="id", g={"id"}, g: "id", and ["HEADING","id"] tuples. */
function headingIds() {
  const ids = new Set<string>();
  for (const f of [...files(join(ROOT, "components/terminal")), ...files(join(ROOT, "routes"))]) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/\bg(?:=|:\s*|=\{)\s*["'`]([a-z][a-z0-9-]*)["'`]/g)) ids.add(m[1]!);
    for (const m of src.matchAll(/\[\s*['"`]?[A-Z][^'"\]a-z]*['"`]?\s*,\s*['"]([a-z][a-z0-9-]*)['"]\s*\]/g)) if (src.includes("Info")) ids.add(m[1]!);
    for (const m of src.matchAll(/g=\{`p-\$\{panel\}`\}/g)) for (const p of ["color", "layout", "composition", "lexicon"]) ids.add(`p-${p}`), void m;
  }
  return ids;
}

describe("glossary", () => {
  it("has an entry for every panel and column heading id used in the UI", () => {
    const ids = headingIds();
    expect(ids.size).toBeGreaterThan(60);
    const missing = [...ids].filter(id => !glossaryEntry(id) && !/^(sm|md|lg|xl)$/.test(id));
    expect(missing).toEqual([]);
  });
  it("covers the required concepts, five stages and four dimensions", () => {
    for (const id of ["gap", "momentum", "vanguard", "curation", "corroboration", "discourse", "supply", "next-wave-score", "share", "pts-q", "stage", "sector-scope", "receipts"]) expect(glossaryEntry(id), id).toBeTruthy();
    for (const s of STAGES) expect(glossaryEntry(stageId(s))?.term).toBe(s);
    for (const d of DIMENSIONS) expect(glossaryEntry(dimensionId(d))?.term).toBe(d);
  });
  it("every entry has unique id, one-line copy and a real methodology anchor", () => {
    const anchors = METHOD_IDS();
    expect(new Set(GLOSSARY.map(e => e.id)).size).toBe(GLOSSARY.length);
    for (const e of GLOSSARY) {
      expect(e.measures.length, e.id).toBeGreaterThan(10);
      expect(e.howToRead.length, e.id).toBeGreaterThan(10);
      expect(e.measures + e.howToRead, e.id).not.toMatch(/\n/);
      expect(anchors.has(e.methodologyAnchor), `${e.id} → ${e.methodologyAnchor}`).toBe(true);
    }
  });
  it("search filters as you type", () => {
    expect(searchGlossary("momen")[0]?.id).toBe("momentum");
    expect(searchGlossary("zzzz")).toEqual([]);
    expect(searchGlossary("").length).toBe(GLOSSARY.length);
  });
});
