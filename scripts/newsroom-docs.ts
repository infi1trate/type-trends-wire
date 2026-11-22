// N1 · writes the code-derived parts of the newsroom memory: the lists block in newsroom/style.md, the whole of newsroom/beats.md and
// (N3) the desks block in newsroom/README.md.
// Usage: bun scripts/newsroom-docs.ts. No database, no model.
import { readFileSync, writeFileSync } from "node:fs";
import { beatsDoc, desksBlockOf, desksReadmeBlock, listsBlockOf, styleListsBlock } from "../src/lib/newsroom/docs";
const style = readFileSync("newsroom/style.md", "utf8"), block = listsBlockOf(style);
if (!block) throw new Error("newsroom/style.md has no lists markers");
writeFileSync("newsroom/style.md", style.replace(block, styleListsBlock()));
writeFileSync("newsroom/beats.md", beatsDoc());
// N3 · the README's desks block (order of work, limits, the three new desks, the new actions).
const readme = readFileSync("newsroom/README.md", "utf8"), desks = desksBlockOf(readme);
if (!desks) throw new Error("newsroom/README.md has no desks markers");
writeFileSync("newsroom/README.md", readme.replace(desks, desksReadmeBlock()));
console.log("wrote newsroom/style.md lists, newsroom/beats.md and the README desks block");
