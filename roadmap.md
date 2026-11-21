# Phase E3 · The front page and the navigation

- [x] 0.1 Sale-mode census counts sale wording only (not seasonal); recount No. 90 as a correction
- [x] 0.2 Quotations show captured text unchanged (no currency rewrite inside quotes)
- [x] 0.3 Census "How we know" copy (newest capture + one ≥6 h older; sale: headline and buttons)
- [x] 1 Nav: Live→Today; bar Today, Signals, Brands, Patterns, (Studies?), Digest, More; More menu; narrow menu same order; old addresses
- [x] 2 Front: drop Page state; Also today cards; The tape block; Earlier this week minus today; Explore rules; Moving now hidden without comparison; narrow order
- [x] Tests, golden unchanged, TTFB before/after, 360/768/1024/1440 checks, report

# Phase E3b · Speed back + four touches
- [x] 1 No DB read before first byte on /, brand, story; front tape/counts/cards from stored read records; before/after TTFB
- [x] 2a Earlier this week: one heading with count
- [x] 2b Also today: no twin pictures (gathered story takes next unused member crop)
- [x] 2c Colour change with same plain names hidden on Read tape (front, brand); terminal keeps hex
- [x] 2d No. 90 deck correction (two captures at least six hours apart)
- [x] 3 Writer order after reset: lead, census pieces, rest by rank; reset time ET


# Phase E5 · The Digest: one argument a week
- [x] 0 /data lead study chart fits at 360/390 (value label inside padding)
- [x] 1 Issue model from published stories: cover choice (pure), five rows, three pictures, one chart, numbers line, keep reading, 600-word budget
- [x] 2 Digest writer (sheet, schema, checks, 2/day, digest_texts insert-only, fallback)
- [x] 3 No. 1 rebuilt; corrections names (pure); archive rows
- [x] 4 Terminal weekly brief: withdrawn line; brief generator input = published/integrity-passed only
- [x] 5 RSS, share image, meta, Editions row, Read bar, next-issue line, no-story week = no issue
- [x] Tests, responsive 360–1920, heights + TTFB before/after, report

# Phase U1 + U2 · One address per thing, two views; receipts in place
- [ ] 0 Story body set like a study opening (17/18 px, 68ch)
- [ ] 1 `?view=data` on story, brand, signal, pattern, study, week; dark shell; redirects from old addresses; toggleHref/modeOf; noindex + canonical; name line + Read view link; keys
- [ ] 2 Receipt drawer on Read pages (`?receipt=type:id`), pure receipt models, focus trap, Back/Esc, reduced motion
- [ ] 3 `storyForRow` and "No. N →" on data rows (one batched read per table)
- [ ] 4 One name per thing (ia.ts/labels.ts), one glossary, names test
- [ ] Tests, responsive 360–1920, TTFB before/after, report

## U2b · DB load first, follow-ups, story truth fixes
- [x] A1 confirm no API caller of refresh_library_history()
- [x] A2 materialize library_site_history (same cols) + indexes, refresh in library_history_refresh_job, equality check, repoint callers
- [x] A3 read history once / keyset, not pages of 200
- [x] A4 cache forecasts / sector_stats / latest / tag_share (run-keyed), health_facts 60 s
- [x] A5 library_snapshots slow selects: EXPLAIN before/after, index or narrow
- [x] A6 EXPLAIN new object + three slowest remaining
- [x] B1 /stories/no/<n> keeps query string
- [x] B2 story page hydration #418
- [x] B3 drawer/Data view change rows: capture dates first, "confirmed <date>"
- [x] B4 pattern story links, one glossary test, 44 px check at 360/390, old links
- [x] C one count per claim (white space, breakout, against the grain), sheet dedupe, evidence from sheet, headline wording, rebuild records
- [x] D hexName fix + 20-hex tests, colour-word check
