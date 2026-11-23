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
- [x] Tests, responsive 360–1920, TTFB before/after, report

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

# U3 + U4 · One design system for both views; the terminal as a workbench
- [x] 0 Print footer path identical on server and client (decoded); check brand/signal/pattern/study/Digest
- [x] 1.1 One token source (system.ts): type steps, colour roles (Read + Data), space/shape, motion → CSS vars + typed mirror, test
- [x] 1.2 Adopt tokens in Read + terminal components; lint test (no raw hex / px font size in src/components)
- [x] 1.3 One chart kit (line by quarter, small multiples, bars, sparkline, before/after strip) with look read|data, tables, labels.ts formats; remove duplicates
- [x] 1.4 One navigation: seven sections from ia.ts (Studies added), F1–F7, Read keys 1–7 ? / `, Tools in bar ≥1024 if it fits
- [x] 1.5 /brand/system page (BRAND_PUBLIC)
- [x] 2.1 Study figure tables: "Open in console" with prefilled command; pure commands + tests; sector lens on Data view tables
- [x] 2.2 "Copy as CSV" on Data view + terminal tables
- [x] 2.3 Pitches: table (additive), editor-only Pitch form, desk Pitched list with engine verdicts, builder evaluates open pitches
- [x] Responsive 360–1920 both views, TTFB before/after, report

# Phase I3 · Truth fixes + lead pictures
- [x] 0.1 Re-read vs change (mark events 14 d), tape/counts/candidates ignore, Data view line, re-check stories, tag-intake reuse, 40-call noise measurement
- [x] 0.2 News name matching, news facts sheet, no-story when nothing to say, retire No. 77, re-check news stories
- [x] 0.3 Method words narrowed + tests; study No. 4 writer call; facts_hash rebuild check
- [x] 0.4 Why 81/82/91 had no text; queue by front position; no empty sections; no lead without text
- [x] 0.5 Grid 0 columns; percentage-as-price; mark existing rows
- [x] 1 leadPicture pure fn, rules + fallbacks, crop gate (stored), slots (front lead, cards, story page, Data Pictures table), sizes/eager/lazy, captions/alt
- [x] Tests, responsive, weight/paint before/after, report

# I3b · Five follow-ups after reading I3 live
- [x] 1 Front lead: picture-only right column ≥1024 (stat+trail left under Receipts), compact captions, heights before/after at 1440/1024/390
- [x] 2 ragged-edge.com → raggededge.com; inactive excluded everywhere (audit); intake answer; No. 45 rebuild + 1 writer call + correction; other users; health name-in-title check
- [x] 3 AI read variants investigation; read_version column + backfill; version mix for top-10 share / top-10 momentum AI signals
- [x] 4 Superlative check accepts ranked-list first/last claims + tests; Study No. 4 writer once
- [x] 5 Crop quality measured at intake/sweep; time per measurement
- [x] Tests, responsive 360–1920, report, commit

# W1b · Every surface a brand owns
- [x] 1 Icon/card change = measured change (perceptual diff, prev ≥2 captures, new ≥2 captures ≥6 h apart); tape pair; Data "Icon and card history"; verdicts for the 9 brands
- [x] 2 Brand page "Surfaces" block (home/product/about/pricing first screens + icon + card); Data "Surfaces" table with Matches home; weights/heights before/after
- [x] 3 Product vs home match (headline typeface + accent, same crawl); brand-page line; census candidate commerce/hardware; N/M + brands
- [x] 4 `quiet` story type (icon/card or same-url non-home identity change, no wire mention ±14 d); wording ban; leadPicture pair; today's candidates
- [x] 5 Corrected story with hidden text first in writer queue + test; facts-built body without run numbers, lower-case stages; show No. 45 body
- [ ] 6 Study No. 4 writer once; outcome — waiting: today's study allowance (4/4) was used before this build; run `bun scripts/w1b-study4.ts` once after the 7 pm ET reset
- [ ] Tests, responsive, report, commit

# W1c · Three changes to W1b
- [x] 1 A page that follows its homepage (same kind, confirmed, ±30 days; icons/cards vs any identity change or rebrand) is not quiet; fact on the brand's own story (candidate + fold onto stored published/held story); today's candidates re-reported
- [x] 2 Outlets = publications on the wire's source list only (RSS feeds); social and aggregators searched, never counted or named; N and list reported
- [x] 3 Surfaces: compact rows (home/product/about/pricing/changelog), match line, ≤240 px at 1440 and ≤420 px at 390; crop intake accepts product/about/pricing_page first screens (own table, same rules); thumbnails from fixtures
- [x] Tests, responsive 360–1920, report, commit

# Phase N1 · Newsroom foundations (no reader-facing change)
- [x] 1 newsroom/ style.md (rules + examples + banned lists), beats.md, README.md; style-vs-code test
- [x] 1 desk log (append-only) + history view with story_edits; board = pitches + assignments/status
- [x] 2 story state history (8 states), pipeline writes, 14-day backfill
- [x] 3 action register with levels; actor required; preview = proposal; owner + phrase; every call logged; memory action (<200 KB); wire-only switch (off); docs/editor-desk.md
- [x] 4 spend ledger (model from ai_usage, build credits via desk), weekly cap (not set), cap stops writers/costly actions/health/log; ET Mon–Sun; this week's spend report
- [x] 5 golden counts; writing set fixtures; scorer + suite; hand-run live script (refuses when allowance used, not run); version stamps + score files test; README rule
- [x] 6 /desk: queue with state history, desk log with desk filter, spend vs cap, register, golden scores; responsive 7 widths
- [x] Tests, report, commit

# Phase W1d · Quiet-change fixes
- [x] 1 quiet change needs icon/card/typeface + picture; accent/palette/theme alone stays tape; retire No. 92; beats.md + tests
- [x] 2 colour-name boundaries vs 48-colour reference table; renamed colours on published stories listed
- [x] 3 How we know gives both capture dates (facts-built line + writers' sheet); deck/line agreement test
- [x] 4 no empty "The numbers" line; fallback list from stored lines or section left out; story types audited

# Phase N2 · Standards, editor in chief, copy desk
- [x] 1 order of work: engine-run stories wait held for review; published only from reviewed; desk failure/cap falls back with reason; health counts it
- [x] 2 standards: eight-item checklist (no model) + second reader (one call, fixed structure, versioned); release by editor in chief/owner only
- [x] 3 editor in chief: one placement call when there is a choice; enforced after the call; holds only; two-day reoffer rule; versioned
- [x] 4 copy desk lints on every non-written line; No. 45 line fixed; weekly sweep logs; style.md from code
- [x] 5 hold + note actions; proposals list with owner status; truthful writer meter; No. 85 page-follow fact; /desk review details
- [x] 6 fixture runs (16 calls): standards 10 + 3 after one tuning, editor in chief 3 days
- [x] Tests, report, commit

# Phase N3 · News, graphics, data desks + N2 fixes
- [x] 0 migration: desk_calls checks wider; wire_picks, picture_choices, data_findings, backtest rows (append-only, service role)
- [x] 1 news desk: candidates, picks call, line check, brand tag, wire_pick/wire_drop, pitch, THE WIRE front block, terminal mark
- [x] 2 graphics desk: picture check before standards, picture action, Data view who chose, study chart form table + call, share-image check
- [x] 3 data desk: daily checks → findings, finding/finding_close, ninth checklist item, label source fix, backtest, weekly proposal
- [x] 4 N2 fixes: second-reader 7 re-runs, EIC refused lead fallback, standards release over second reader, No. 85 rewrite, /desk 390/1280 + test rows note
- [x] 5 /desk panels News/Graphics/Data, memory, beats/README regenerated, writer meter
- [x] 6 proof runs (<30 calls) + report + commit
- [ ] N3 open: second reader alone passed No. 91 on the final prompt; the brief's "tune once more and re-run all ten" needs ~10 more fixture calls beyond the 30-call ceiling (owner)
- [ ] N3 open: backtest waits for a forecast run at least 28 days old

# Phase N4 · Design review and engineering, through a gate
- [x] 0 migration: page_reviews, build_queue (+moves), gate_results (append-only, service role); spend_entries.queue_item; desk_calls/desk_log checks wider
- [x] 1 page reviews: REVIEW_PAGES × 1440/768/390, `review` door action (kinds weekly/before/after/test, measures, picture to crops bucket under reviews/), budgets + breaches + run diffs (design-review.ts)
- [x] 2 build queue: queue_add / queue_move / gate_result; order, proposal-accepted and gate-pass rules at the door; gate checks in one file; spend names an item
- [x] 3 engineering desk: daily health run files/declines bug items by key (jobs, staleness, speed, desk/writer failures, shared check, history refresh); no model
- [x] 4 design review desk: weekly after a complete weekly run; breaches first; one vision call per page (9/day); moves enforced in code; ≤5 proposals/week; propose + queue item
- [x] 5 /desk Design review + Engineering panels; memory facts; beats.md + README regenerated; drift tests; 390/1280 check
- [x] 6 second reader re-run: Nos. 44, 90 (pass), 92 (hold)
- [x] 7 proof: two test review runs, gate tests, health run live, design review fixtures (front/story/brand), reader pages unchanged; report; commit

# Phase N4c · Five faults from the desks' first live hours
- [x] 1 checklist numbers: stored facts count; checklist fingerprint per standards review; checklist holds of 7 days re-checked once after a fix; sweep of item 1
- [x] 2 review pass: own schedule (≤2 stories, <40 s, start/finish rows), picture → standards → EIC; build tail stores sheets only
- [x] 3 news desk beat: prompt + code beat check, possessive-safe line check, 72 h fixture replay
- [x] 4 front top line: readers never see "Late"; follow-ups late only against their own interval; test with 22 Nov times
- [x] 5 job_runs: start/finish rows for every scheduled job; health run reads them; /desk 24 h lines; story build durations
- [x] Report, tests, commit
- [ ] N4c open: an editor in chief hold is re-offered by the next pass and runs in engine order when it is the only story (no decision to make); owner to decide
- [ ] N4c open: the story build still times out in the :00 and :30 wire jobs (ingest ~20 s there); it completes on :15 and :45 and in the library jobs
- [ ] N4c open: three test-suite forecast rows in job_runs at 12:07 UTC 22 Nov (append-only; owner to decide)

# Phase N5 · Publisher and scout desks + five review fixes
- [x] A1 door holds never offered; EIC hold day rule; no "no decision" for EIC-held; tests
- [x] A2 out of time waits up to six passes
- [x] A3 job_hold review/stories; health build stamp
- [x] A4 steady≠flat shared check + style.md; No. 94 rewrite
- [x] A5 item 1 for published vs stored facts; sweep
- [x] B1 publisher: package check, drafts call, draft_status, audience, /desk panel, memory
- [x] B2 scout: sources register, source_note, candidates call, candidate_status, /desk panel, memory
- [x] job_runs test-row note
- [x] Proof 1–7, report, commit

# Phase L2 · Chart library + six leftovers
- [x] A1 numbers lines dated; stage-change update line (no model); tests No. 45 / run 16
- [ ] A2 No. 43 deck rewrite; drop from golden known failures — blocked: story-writer limit used today (13 of 12); next UTC day
- [x] A3 Digest pictures fix; package check thresholds; preview Digest No. 2
- [x] A4 terminal first byte < 500 ms warm
- [x] A5 wire job < 25 s (move deferrable work to its own pass)
- [ ] A6 queue kind `phase` — code + tests done; stored kind list and phase column need the owner's yes (existing table)
- [x] B1 chart forms registry + test
- [x] B2 /brand/system registry page
- [x] B3 slope chart + dot-with-range specimens (proposed)
- [x] B4 propose names registry forms; accepted → feature queue item; colophon by edition
- [x] B5 /desk Graphics panel + memory; regen docs
- [x] Proof 1–8, report, commit

# P2 · Speed budget on every page
- [ ] 1 First byte uncached <500 ms on front, story, brand, study, Digest, studies, brands, signals (shell first) — studies index now shell-first; Digest still awaits its issue (blocked: needs a stored issue head; owner to confirm); uncached edge timing not measurable from the sandbox
- [x] 2 Layout shift ≤0.05 on reviewed pages at 1440/768/390; front LCP element requested early (<2,000 ms)
- [x] 3 Terminal story list full height again; space reserved from the row count in the shell
- [x] 4 Gate: before from 5-run history, tolerances, "over target, not caused by this deploy" filed once; fix two slow tests
- [x] 5 Crossover/stage change needs comparable homepage counts (≥80%, ≥15); docs; sweep run 16
- [ ] Proof tables, reader looks unchanged, full suite, commit

# W3a + L3 · Museum palettes, monthly design reading, one story rule
- [x] A1 art_works table (additive, public read of non-removed)
- [x] A2 POST /api/public/ingest-art (crawler secret, limits, CC0 + host checks, removed never stored again)
- [x] A3 art_remove owner door action (removed_at + thumbnail deleted); shown on /desk
- [x] A4 sources register: The Met, Art Institute of Chicago
- [x] A5 health: art line
- [x] B pure nearest-palette module + tests + proof picture/spread
- [x] C1 brand page line + thumbnail (only near work, threshold met); Data view row
- [x] C2 study (threshold-gated)
- [x] D1 living_readings table + monthly job + November reading
- [x] D2–D3 assembly (pure) + proposed edition write + one proposal
- [x] D4 colophon side-by-side preview (only with a proposed edition)
- [x] D5 colophon Readings lines
- [x] D6 tests
- [x] E1 reading-not-steady rule (AI fields) in crossovers and stage changes
- [x] E2 data desk finding per unsteady field and sector
- [x] E3 proof table runs 13 → 16
- [x] E4 tests
- [x] Report: heights, full suite, commit

# P2c · Fresh-instance layout (front page at 390, /brands short)
- [x] Reproduce with deferred reads forced late (dev only `?__late=`, `?__fail=checks`), measure placeholder vs real heights at 390/768/1440
- [x] Bug 1 fix: the jump is the lead figure's count roll re-wrapping its line (fixed in Count); lower front blocks land with the top
- [x] Bug 2 fix: short /brands = change checks failed on a fresh instance and rebrands dropped silently; now refused, stored record fallback; first response carries the stored directory
- [x] Browser check `scripts/perf/deferred_heights.py` (fails on the old code, passes now)
- [x] Report: CLS/LCP median of ten, heights/words cold vs warm, full suite, commit
- [ ] Records sweep: the `wire-followups` pass has been cut off by its caller at about 5 s since 16:16 UTC 22 Nov, so stored records age out and fresh instances compute live (waits on owner: it changes how a scheduled job answers)

# W3b · Museum surfaces off; a match has to mean something
- [x] Part 1: `MUSEUM_SHOWN = false` hides the study (404, not listed, not on the shelf, not in the Digest) and the brand line; own commit
- [x] Part 2: comparable palettes (colour families: ≤60% one, ≥3 at 5%), media-led first screens get no match, groups pool comparable works only
- [x] Part 2: sector names a group only at ≥⅓ and ≥8; study only with ≥5 sectors, else "not enough for a finding" with counts; full museum labels
- [x] Part 2: brand line redrawn for the Data view only (≤2 lines at 390, ≤64 px thumbnail, title-only link); stays off
- [x] Part 2: read-only proof on the stored works (picture, counts, sector rows)

# T1 + T2 · Stored-pages job, one spend ledger, cut the site's own calls
- [ ] 0 wire-followups answers at once + finishes in background (run id, start/finish rows, no doubling); 16:16 cause; health stored-page ages; front LCP wait check; own commit
- [ ] 1 Spend ledger (pure + loader, 8 ET weeks, kinds/models, build credits @0.30, agent spend by hand, 3 unit costs, cap line); /desk Spend table; health line; tests
- [ ] 2A Vision: count unchanged-capture share; skip-and-carry rule (28 d, low confidence, top 30); confirmation + steadiness honesty; expected calls/dollars
- [ ] 2B Changelog structured-output failures: cause, fix, one retry, golden set
- [ ] 2C story_why steps, cheapest passing model per step (≤60 calls), shorter fixed prompts
- [ ] 2D One retry place, constant per kind

# Phase S1 · Space and composition pass
- [x] 1 Ledger number column: none when unnumbered, sized to the list's longest number; Tape icon, chips, text on one line
- [x] 2 Today: lead picture stack; Studies and Editions in the left column; one-column order under 1024 px (left top-up with five more stories not built)
- [x] 3 Signals: trend line column, three aligned figure columns, one header per tier
- [x] 4 Brands: tiles with logo/monogram plates, MOVED sticker, Moved this week band
- [x] 5 Studies: All studies shelf of cards, series key, In the works chips in two columns
- [x] 6 Patterns: stored captures first, large tiles always captures (counts wait on the database)
- [ ] 7 Loading: 4 s read limit, health within 2 s, no silent retries, top progress line (click-to-heading table waits on the database; old stored copy on timeout not built)
- [x] S1 follow-up: restart, outage cause, one-story-build-at-a-time guard, real-data measurements, brand move line fix
- [ ] Today left column ends ~450 px above the right at 1024–1440 (five-story top-up still not built)
- [ ] Brand page Sections placeholder differs from real height (0.06 shift on a 1800 px tall window); fixing it means waiting before first byte, against E3b

# D1 · Database hardening (owner, 23 Nov)
- [~] 1 (estimates from row counts + 1 h 47 min quiet sample; per-post WAL needs crawler back on) Find the writes: per job/post rows + WAL MB per run, runs/day, ranked; disk-speed allowance; 22 Nov stalls vs 23 Nov
- [x] 2 (post time after: waits on deploy + crawler) Crawler posts store + mark dirty only; one follow-up worker across instances, newest state once; slow DB → quick "try later" with seconds; post time before/after
- [x] 3 (summary tables were already diff refreshes; quiet-hour sweep count waits on deploy) Summary tables diff-write (no empty/refill, nothing when source unchanged); stored pages hash-compare; other delete+reinsert sets; WAL MB/h before/after
- [x] 4 (schedule + role settings written out for the owner) Job limits (10 s pass step / 30 s rebuild), health precheck 1 s → "skipped: database slow", spread schedule (proposal), role settings (proposal), connections per part
- [x] 5 Reader-only last good copy outside DB (edge), quiet age line; no DB call on usual path; offline rehearsal test in suite; tests without live DB; preview DB question
- [x] 6 Health: DB answer time, connections, WAL/h, allowance, biggest job, skipped count; warn 5 min / bad → one desk finding + /desk; automatic safe mode + owner switch; health <2 s
- [~] 7 (live re-measure waits on the owner's deploy) Old page stays on screen with progress line; Patterns first screen from stored copy, rest on scroll, cold <1 s; live re-measure after owner deploys

# D1b · After the D1 deploy (owner, 23 Nov 07:09 UTC)
- [x] 1 (live catch-up awaits deploy) Stored-pages sweep: name + fix the 2 errors; why 6 pages take 23 s; overdue + cheapest first; enough of the pass; ages per kind before/after; written vs re-timed; split a kind that can't fit
- [x] 2 Health: "starting" (not "down") on a cold server, within 2 s, reads DB lines first if it can; one-sentence "down" rule; sweep's last result on the database lines
- [x] 3 Live measurements (b53ffa2): crawler post time, WAL/h + disk reads/h first hour, click-to-heading cold/warm
- [x] 4a Today: server-chosen top-up (≤5 stories) so left column ends within 160 px of rail at 1024/1280/1440, no jump
- [x] 4b Brand page: reserve Sections strip's real height from known crop count/sizes; shift after

# D1c · The morning after (owner, 23 Nov 13:36 UTC)
- [x] 1 Sweep: re-time only near limit (or one statement per kind); overdue/soon-overdue kinds first whatever the cost, up to 20 s with story build yielding; ages over four passes
- [x] 2 Story build with 0 new changes under 2 s (check first); before/after
- [x] 3 Publisher re-runs a failed package check (≤ every 6 h, ≤4 per issue), closes the bug item; link check 10 s + one retry, "slow" >3 s; run W47 check now; /terminal?panel=library 4.9 s
- [x] 4 Product Hunt ingest start/finish rows + health jobs list, token works yes/no; discourse stale while ok

# PH1 · Product Hunt launches
- [x] 1 Ingest reads the finished Pacific day (votes order, topics), stores votes/topics, plain run row, recorded-response tests
- [x] 2 Vote floor 150 + beat topics (300 without topics); below the line = wire item only
- [x] 3 Launches never numbered; No. 98–117 fate; held launch nowhere
- [x] 4 Today box ≤3 by votes, upvotes + launch day, no number; Terminal LAUNCHES group, not counted; before/after pictures
- [x] 5a W3c proof pictures into docs/proof/w3c/
- [x] 5b Retries for daily jobs / weekly model jobs; drafts made by an existing job with room

# C1 · A cold server is as fast as a warm one (owner, 23 Nov 16:44 UTC)
- [x] 1 x-instance-age header; cold vs warm table per page (TTFB, LCP element + wait, reads, first connection, code before first byte)
- [x] 2 Cold targets (TTFB ≤800 ms, LCP ≤2.5 s, CLS ≤0.05; 5 pages × 390/768/1440): one early stored read, connection while rendering, less code before first byte, LCP picture eager, fonts never hold text; after table
- [x] 3 Later retries once after ~1.2 s; brand page never without header facts + stored card (test once/twice failed); every Later page listed; brand Data view shift ≤0.05
- [x] 4 Warming after a deploy without a new scheduled job (written out, not built: would only warm instances near the job's caller)

# W3d · App icons as measured colour only (hidden, ICONS_SHOWN false)
- [ ] 1 Intake: POST /api/public/ingest-icons (crawler secret, ≤256 KB, per-row refusals), app_icons table (service role only, one snapshot per ISO week per category, unchanged writes nothing, 26 weeks), icon_remove (owner), health line
- [ ] 2 Measure (pure, tested): ground (largest share, <0.35 mixed, white/grey/black), per category counts/leading/mixed share, lean in points
- [ ] 3 Study the-colour-app-icons-sit-on behind ICONS_SHOWN via withheld(): wall, lean, headline/deck by rule, method, check; series "Beyond the homepage" if a list entry
- [ ] 4 Proof pictures in docs/proof/w3d (real rows if arrived, else fixture said plainly)
- [ ] 5 First-bytes picture hint on /library/<domain>, /patterns/<key>, /collections/<slug>, /brands
