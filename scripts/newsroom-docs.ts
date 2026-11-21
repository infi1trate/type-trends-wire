// N1 · writes the code-derived parts of the newsroom memory: the lists block in newsroom/style.md and the whole of newsroom/beats.md.
// Usage: bun scripts/newsroom-docs.ts. No database, no model.
import { readFileSync, writeFileSync } from "node:fs";
import { beatsDoc, listsBlockOf, styleListsBlock } from "../src/lib/newsroom/docs";
const style = readFileSync("newsroom/style.md", "utf8"), block = listsBlockOf(style);
if (!block) throw new Error("newsroom/style.md has no lists markers");
writeFileSync("newsroom/style.md", style.replace(block, styleListsBlock()));
writeFileSync("newsroom/beats.md", beatsDoc());
console.log("wrote newsroom/style.md lists and newsroom/beats.md");
