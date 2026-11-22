// N2 · the standards checklist's items, in order (dependency-free so /desk can name them without loading the checks).
export const CHECKLIST = [
  { id: "numbers", title: "Every number is on the facts sheet" },
  { id: "brands", title: "Every brand is tracked and is the right website" },
  { id: "picture", title: "The lead picture is there when needed, and credited" },
  { id: "dates", title: "The deck's dates and How we know agree" },
  { id: "news", title: "A news story is about the brand its item names, and says what the item says" },
  { id: "minimums", title: "The story meets its type's minimums" },
  { id: "sections", title: "No section is empty" },
  { id: "copy", title: "Every reader-facing line passes the copy desk" },
  // N3 · the data desk's findings.
  { id: "findings", title: "No open data finding on a brand and measure this story cites" },
] as const;
