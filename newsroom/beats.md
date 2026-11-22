# Beats

The standing questions slug answers, and the series a reader learns to expect. Every trigger and minimum below is read from the code (`src/lib/newsroom/docs.ts` writes this file; a test fails when it drifts). Edit the constants, not this file.

## Every day: the story engine

- **Daily limits.** At most 5 stories a day, 3 of them about a single brand, 3 outside-news stories and 1 AI-read roundup; the weekly pieces run outside the five. A story needs a score of 45; the same brand and type do not run twice within 7 days.
- **The writers.** Story writer 12 calls a day, study writer 4, Digest writer 2. Every text passes the shared check or the facts-built text is shown.
- **Moves and rebrands.** A measured change on a homepage, confirmed by two captures either side. “Rebrand” needs type, colour and layout together, or a new name or logo.
- **Roundups.** At least 3 brands making the same change within 7 days.
- **Against the grain.** At least 3 brands moving against their sector, in the weekly roundup; seasonal promotions need 3 brands to be a story.
- **First seen.** A signal first seen in a sector on 2 to 5 brands.
- **White space.** A signal on at most 5% of a sector's homepages while at least 15% elsewhere, in a sector with at least 15 measured homepages.
- **Shifts and crossovers.** A stage change or a crossover between two forecast runs is built only when the earlier run read at least 80% as many of the sector's homepages as the later run, and at least 15; otherwise it is recorded as “more homepages read, not a change” and no story is built. Written for: `crossover:hero_layout:split_left_text:media:16` (8.3% → 25.0% between runs 13 and 16); `crossover:tone:calm:media:16` (8.3% → 17.9% between runs 13 and 16).
- **Breakouts.** A forecast alert that a signal reached the Breakout stage (stage words in `labels.ts`, alert rules in `alerts.ts`).
- **Outside news.** An item from the wire's publications that names a tracked brand (names of at least 4 letters, strict matching) and is about design; the story says what the item says, about that brand.
- **Quiet change.** Needs a confirmed new site icon, a confirmed new social card, or a confirmed change of headline or body typeface on another page at the same address, with no mention in the wire's publications within 14 days either side. Never alone: an accent, palette or theme change alone on another page stays a line on the tape. It needs a picture to lead with: the old and new icon or card, or the page's first screen before and after; with no picture it does not run. A page that follows a confirmed homepage change of the same kind within 30 days is not quiet: it becomes a fact on the brand's own story.

## The desks: what runs

A story the engine would run waits for review. Standards checks it, then the editor in chief places it; only then does it publish (its state is “reviewed”). Standards runs again on a published story when an edit changes its facts. Daily model-call caps: standards 12, editor in chief 6 (UTC day, counted in the spend ledger). When a desk's call fails or its cap is used, the story takes the engine's path and its state says so.

The standards checklist (code, no model); a failed item holds the story with the item as the reason:

1. Every number is on the facts sheet.
2. Every brand is tracked and is the right website.
3. The lead picture is there when needed, and credited.
4. The deck's dates and How we know agree.
5. A news story is about the brand its item names, and says what the item says.
6. The story meets its type's minimums.
7. No section is empty.
8. Every reader-facing line passes the copy desk.
9. No open data finding on a brand and measure this story cites.

Brands whose homepage title does not carry their name and are known to be the right website: Hinge Health, Mercury, MVSM, N26, Pitch, Postman, Substack.

The second reader (one model call) reads what a reader will see with the facts sheet and each brand's title and sector, and lists problems; any blocker holds the story with the model's own sentence. The editor in chief (one call per build, only with a decision to make) picks the lead and order and may hold; it never kills, changes text, exceeds the caps or runs a held story. A story it held two days running is not offered again unless its facts change.

## The order of work

candidate → drafted → checked → picture checked (graphics) → standards (the checklist, then the second reader) → editor in chief → published. When a desk's call fails or its limit is used, the pipeline carries on by rule and the story's state history says so.

## Daily model-call limits (UTC day; fixture calls are not counted)

- **standards**, second reader: 12 a day.
- **editor in chief**, placement: 6 a day.
- **news**, wire picks: 4 a day.
- **graphics**, picture check: 8 a day.
- **graphics**, study chart: 2 a day.
- **data**, weekly proposal: 1 a day.
- **design review**, page review: 9 a day.
- **publisher**, social drafts: 2 a day (one call a week).
- **scout**, brand candidates: 1 a day (one call a week).

## The news desk

Picks at most 5 links a day from the wire's publications (outlet items only, published in the last 36 hours, never picked before, one per story keeping the earliest; at most 40 shown to the model, and only when at least 3 are new since its last call). Each line is checked in code: at most 120 characters, one sentence, no number or proper name the item's title or excerpt does not carry, never more than 6 words in a row taken from them, and the copy desk's and writers' word lists. The brand tag comes from the strict name matcher, never the model. A pick tagged with a brand that has a measured change within 14 days either side files a pitch for the editor in chief. Readers see the picks of the last 24 hours as THE WIRE on the front page, after THE TAPE.

## The graphics desk

Checks each story's picture before standards: the rule's choice and up to 3 ranked alternates that pass the quality gate. Only a stored crop that passes the gate can be chosen; a before-and-after pair may become its after-crop alone, never mixed across dates; the caption is rebuilt by rule and no text changes. “No picture shows it” fails checklist item 3 for a type that needs a picture. For study figures it chooses a form only where more than one chart-kit form fits the data, and checks every published story, study and Digest share image daily (code).

### Chart forms

One registry (src/lib/chart/forms.ts) lists every form the product can draw; the desk's choice and the study builder read it. Live: Quarter line, Small multiples, Bars, Sparkline, Before-and-after strip, Two-axis scatter, Donut, Bands over quarters, Whitespace scatter, Vibe map, Library history, Font-rank flow, Palette strip, Score bars.

Proposed, shown only as specimens on /brand/system: Slope chart (two points per row; 2 rows at both points), Dot with range (value with range per row; 2 rows with a range). A figure no live form shows whole is filed with `propose` naming the proposed form that would fit; only the owner accepts, an accepted form goes on the build queue as a feature, and it becomes live only in a build that passed the gate.

## The data desk

Daily checks (code) record findings of these kinds: contradiction, detector, impossible, coverage, wrong website. The detector sample re-derives 25 measured events a day under today's rules; coverage flags active brands with no good capture for 3 days and sectors under 15 measured homepages. An open finding on a brand and measure a story cites holds it (checklist item 9). Weekly, after the forecast, it scores the forecast made 28 days earlier against what the measurements show, then makes one call that files at most 3 study pitches and 2 signal ideas; code drops any that name a measure the product does not hold.

## Door actions added in N3

- **`wire_pick`** (ships alone): The news desk picks one outlet item from the wire with its subject (brand, web or type) and one line saying what it reports; at most five picks a day. Shown on the front page's THE WIRE block for 24 hours.
- **`wire_drop`** (ships alone): Drops a wire pick with a reason (news, standards or the editor in chief); it leaves the front page and stays in the log.
- **`picture`** (ships alone): The graphics desk chooses a story's lead picture: a stored crop or before-and-after pair that passes the quality gate, no picture, or back to the rule's choice, with a reason. The caption is rebuilt by rule; no text changes.
- **`finding`** (ships alone): The data desk records a finding: wrong or contradictory data, with what was expected, what was found and the receipt. An open finding on a brand and measure holds a story that cites them.
- **`finding_close`** (ships alone): Closes a data finding with who and why (data, standards or the editor in chief).
- **`data_run`** (ships alone): The data desk's daily checks, the weekly forecast backtest, the share-image check, the study chart check or one news desk pass: records what the run found (counts by kind). It fixes nothing.

## Page reviews

A review run measures 9 pages (the front page `front`, a story page `story`, a brand page `brand`, a study page `study`, the terminal `terminal`, the digest `digest`, studies `studies`, brands `brands`, signals `signals`) at 1440, 768, 390 px. An outside browser job sends one `review` call per page and width with its measures (`height_px`, `words`, `links`, `images`, `image_kb`, `first_byte_ms`, `lcp_ms`, `cls`, `overflow_x`, `small_targets`, `low_contrast`, `h1`, `headings`, `console_errors`, `failed_requests`, `changed_share`) and an optional small WebP picture (the crops' rule; kept under its own folder, never shown to readers). A run's kind is weekly, before, after, test; a test run is shown as a test and never counts toward budgets, breaches or the gate. A missing measure is not measured, never zero.

Budgets per page and width: height px (first weekly run plus 10%); words (first weekly run plus 10%); links (first weekly run plus 10%); image kb (first weekly run plus 10%); first byte ms (speed target: 800); lcp ms (speed target: 2500); cls (speed target: 0.05); overflow x (must be false); small targets (not above the previous weekly run); low contrast (not above the previous weekly run); console errors (not above the previous weekly run); failed requests (not above the previous weekly run). The first-run budgets are the first complete weekly run plus 10%, so nothing breaches on day one; until a first weekly run exists there are none.

## The design review desk

Weekly, after a complete weekly run (all 9 pages at 3 widths), once per run. Breaches first, in code: overflow, contrast, tap targets, errors and speed become bug items on the queue; height, words, links and image weight become proposals. Then one vision call per page (limit 9 a day) sees the page's three pictures, its measures with last week's and the register of design settings with their ranges, and returns at most two observations about density, hierarchy and access, each with one move. Code keeps a setting move only when it names a register setting and a value inside its range; anything else is a layout move that needs the owner; a move that touches the name, the wordmark, the brand direction, the type families, the navigation or a page's structure is dropped. At most 5 proposals a week, the ones tied to a breach first, each filed with `propose` and a queue item linked to it. Nothing live changes. Setting moves the owner accepts wait for the next monthly design edition.

## The engineering desk

Daily, code only, no model: files or declines bug items by stable key for a scheduled job whose newest run failed, that has not run within 2 times its usual interval, or whose newest run took more than 3 times its 14-day median (and over 5 s); a crawl or the wire older than the health staleness rules; a page over its speed target in the newest review run; more than 10% of a desk's or the writers' model calls failing over 24 hours; a writer's texts failing the shared check more than 50% of the time over 24 hours; the history refresh taking over 60 s (it records a run only when captures arrived, so it is never called late: library-history-refresh). Job facts are names, run times, durations and success only. An item whose problem is gone is declined “no longer found”; nothing is deleted.

## The build queue

One list for every product change. Kinds: bug, label, design move, layout, feature, phase. What readers should see: no visible change, small, layout. Statuses: queued, briefed, built, gate passed, gate failed, live, declined. The order: queued → briefed; briefed → built; gate failed → built; gate passed → live; built → gate passed or gate failed only through `gate_result`; declined at any open point with a reason. Briefed and live for anything but bug and label need the owner's accepted proposal; live needs the newest gate result to be a pass.

## The gate

1. No failed tests.
2. Every page and width of the review list is in the after run.
3. No page scrolls sideways at any width.
4. First byte within 800 ms on every page and width, or no more than 150 ms worse than the middle of its last 5 runs.
5. Layout shift within 0.05 on every page and width, or no more than 0.02 worse than the middle of its last 5 runs.
6. Largest paint within 2500 ms on every page and width, or no more than 300 ms worse than the middle of its last 5 runs.
7. Console errors, failed requests, small tap targets and low-contrast text not above the before run.
8. Visible change within what the item said to expect (no visible change: at most 1% of pixels and 20 px of height; small: 10% and 8%; layout: no pixel limit).
9. A layout change has the owner's accepted proposal.
10. A design move passes the living-design gate.

Visible change: no visible change allows at most 1% of pixels changed and height within 20 px; small allows at most 10% of pixels changed and height within 8%; layout has no pixel limit, but the owner's accepted proposal. Not above the before run: console errors, failed requests, small targets, low contrast. A design move also passes the living-design gate (its checks except the edition's move count).

## Door actions added in N4

- **`review`** (ships alone): One page at one width from a review run (the outside browser job): its measures and an optional small picture, stored as sent; a missing measure is not measured, never zero. A test run is shown as a test and never counts toward budgets, breaches or the gate.
- **`queue_add`** (ships alone): Files a product change on the build queue: title, why, kind, what readers should see, its source and a stable key (the same key is not filed twice while open).
- **`queue_move`** (ships alone): Moves a queue item along (engineering; the owner may decline): queued, briefed, built, then a gate result, then live; or declined with a reason. Briefed and live for anything but a bug or a label need the owner's accepted proposal; live needs the newest gate result to be a pass.
- **`gate_result`** (ships alone): Records a build's gate (engineering): the commit, the test numbers and the before and after review runs. Code works out every check and the verdict; the door takes no verdict.

## When the desk jobs run

- **News desk:** in the wire ingest's own job, straight after the ingest stores its items and before the story build, with its own 25-second limit. When it decides not to call, it records why at most once every 60 minutes (`data_run`, run `picks`).
- **Share-image and study-chart checks (graphics):** once a UTC day in their own scheduled passes (schedule “desk-passes”, `7-57/10 1-3 * * *` UTC): at most 5 items a pass, one pass per 10-minute slot, each under 20 s, resuming where the last pass stopped. A pass reads stored records only; an image that cannot be built from them in 5 s is recorded as failing and not retried that day. A start row is written before any work; one with no finish row after 2 minutes is a failed pass, and 2 failed passes stop the check for the day and file a bug item. Never two passes at once, and never while ingest-wire (every 15 min), library-ai-worker (every 5 min), library-history-refresh (every 10 min) is inside its time limit.
- **Data desk checks, backtest, health run and design review:** after the story build when time is left, each behind its once-a-day (proposal: once-a-week; design review: one pass a day per weekly run) record, written before the work starts, so a run that is cut off is not retried by the next job.
- **Holds:** `job_hold` (engineering or owner) holds any of share, chart, picks, checks, health, design review, backtest, proposal, reviews, review, stories, package, drafts, candidates until a time at most 7 days ahead; a held job does not start. `job_release` ends a hold early. Both carry a reason; /desk and the memory show every hold.

## Door actions added in N4b

- **`job_hold`** (ships alone): Holds a scheduled desk job (share, chart, picks, checks, health, design review, backtest or proposal) until a time at most seven days ahead, with a reason (engineering or the owner). A held job does not start; /desk shows who, why and until when. N5: also `review` (the review passes) and `stories` (the story build's publishing step), so content can be frozen around a gated deploy, and the publisher's and scout's weekly jobs (`package`, `drafts`, `candidates`).
- **`job_release`** (ships alone): Releases a held scheduled desk job before its time, with a reason (engineering or the owner).

## The publisher

Mondays, after the Digest's week closes, in the desk jobs after the story build. First the package check (code, no model) on the newest published issue: the issue is for a closed iso week; under 600 words; its pictures (up to three); one chart; three to five changes; the cover builds; the share image builds; the digest rss is well-formed and carries the newest issue; the morning line rss is well-formed and carries the newest morning; every internal link in the issue answers 200. One stored row per check; a failure files a bug item (key `package:<week>`). Only after that issue's check passed, one drafts call (2 a day at most): up to 6 drafts, 3 for the Digest's argument and up to 3 for the week's stories the editor in chief led with. Code drops a draft over 280 characters with its slug.global link, with more than one sentence or one number, a number not on its target's facts, an emoji, more than 1 hashtag, a question or exclamation, or a line the shared check or the copy desk refuses. Drafts are drafts: draft → approved or declined; approved → posted or declined, set only by the owner (`draft_status`). There is no posting code. Audience numbers come once a week from the publisher's outside session (`audience`): counts only, at most 20 paths and 10 sources; no tracker, cookie or per-person data is added to the site.

## The scout

Keeps the sources register (28 sources: 16 read, 0 needs permission, 11 closed by its terms, 1 off); `source_note` appends a terms reading and changes only what the register shows. Reading a new source still needs the owner. Mondays, one candidates call (1 a day at most) over the last 7 days of outlet wire items, stored Product Hunt launches and names in news items the matcher could not tie to a tracked brand. Up to 15 come back; code keeps at most 10 whose website is a well-formed domain that is not tracked (active or not), not opted out, not proposed in the last 90 days and not a publication, store or social profile, whose sector is one of slug's ten and whose name appears in the item it cites. Each kept candidate is stored and filed with `propose`. Statuses: proposed → accepted or declined (the owner) → added (engineering, once the crawler's seed list carries it). Nothing is added to the library by the product.

## Door actions added in N5

- **`audience`** (ships alone): The week's audience numbers from the host's own analytics (the publisher's outside session, once a week): visitors, pageviews, at most 20 paths and 10 sources, counts only. A later entry for the same week replaces what is shown; the earlier one stays stored.
- **`source_note`** (ships alone): Appends a terms reading to a source in the sources register (the scout): status, date read, link, one line. It changes what the register shows and nothing else; reading a new source still needs the owner.
- **`candidate_status`** (ships alone): Moves a brand candidate: accepted or declined (the owner only), then added (engineering, once the crawler's seed list carries it, or the owner). Nothing is added to the library by the product.
- **`draft_status`** (needs the owner): Sets a social draft's status: approved, posted or declined (from draft: approved or declined; from approved: posted or declined). There is no posting code: outbound posts stay the owner's.

## The census

A census counts what homepages say now: a brand counts when its newest capture and one at least 6 hours older are both inside the last 8 days. It runs with at least 8 members and names at most 6.

- **Words in headlines: agents** (agent, agents, agentic).
- **Sale wording** (`sale`): headlines and buttons in sale mode.
- **Product pages** (commerce-dtc, hardware): does the product page match the homepage (headline typeface and accent from the same crawl).

## Studies

- **Who moved first** (`first-movers`): One signal, every brand that took it up, in the order the archive shows it.
  - Study No. 2, “Who went big first?” (live)
- **The long view** (`long-view`): Five years of one sector or one signal, read quarter by quarter.
  - Study No. 1, “What happened to the software homepage in five years?” (live)
  - Study No. 3, “Where did fintech's colour go?” (draft: Only 5 well-covered quarters have palettes for 15+ fintech brands (needs 8))
- **Sector against sector** (`sector-v-sector`): The same measure across all ten sectors, side by side.
  - Study No. 4, “Which sector changes its mind most?” (live)

## The Digest

One argument a week, under 600 words, from published stories only: 3 pictures, one chart and the 5 changes that mattered. The week is a closed ISO week.
