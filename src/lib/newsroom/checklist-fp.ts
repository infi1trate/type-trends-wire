// N4c · the standards checklist's code fingerprint (pure). Every standards review stores it; when it changes, stories a checklist item
// held in the last seven days are checked again once (review.ts recheckDue). The fingerprint covers the files the checklist's items run
// on; scripts/newsroom-docs.ts writes it into checklist-fp.gen.ts and n4c.test.ts fails when the generated value is stale.
import { fnv } from "./golden/versions";
export const CHECKLIST_FILES = ["src/lib/newsroom/standards.ts", "src/lib/newsroom/checklist-names.ts", "src/lib/stories/writer.ts", "src/lib/newsroom/copy.ts", "src/lib/newsroom/datadesk.ts"] as const;
/** FNV-1a over the files in order, line endings normalised. */
export const checklistFingerprint = (texts: readonly string[]) => fnv(texts.map(t => t.replace(/\r\n/g, "\n")).join("\n\u0000\n"));
