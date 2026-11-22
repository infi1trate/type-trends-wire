# The newsroom's memory

slug's newsroom is a set of desks (editor in chief, copy desk, standards, news, data, graphics, design review, engineering, publisher, scout). The desks that need judgment run as scheduled agent sessions outside the product. A session starts knowing nothing, so everything the newsroom knows is readable in one call, and everything a desk does goes through one door that enforces the rules. **Six desks are on: standards, the editor in chief and the copy desk (N2); news, graphics and data (N3).** Inside the product they review every story before it publishes (see beats.md, “The desks: what runs”); outside it, an editor reading the live site acts through the door with the carrier.

## The files

- `style.md` — how slug writes: the editorial rules and the truth rules, each with one good and one bad example from stories that ran or were retired, then every word and phrase list the writers' check refuses. The lists are written from the code by `bun scripts/newsroom-docs.ts`; a test fails when the file and the code disagree.
- `beats.md` — the standing questions and series: the daily story engine, the census, white space, breakouts, quiet change, the studies and the weekly Digest, each with what triggers it and its minimums. Written whole from the code's constants by the same script.
- `scores/` — one score file per writer version (see “Writer versions” below).
- `README.md` — this file.

## How a desk session works

1. **Read the memory.** One call returns everything: these three files, the action register with each action's level, the board (pitches with the desk that holds each), the last 14 days of the desk log, today's queue with each story's state history, spend against the weekly cap, the golden scores, the design dry run and health. The response stays under 200 KB; if it would not, the oldest log rows are left out and `log_left_out` says how many.

   ```sh
   curl -sX POST https://slug.global/api/public/desk \
     -H "authorization: Bearer <EDITOR_KEY>" -H "content-type: application/json" \
     -d '{"actor":"copy desk","action":"memory"}'
   ```

2. **Act through the door.** Every call names its `actor` (one of the ten desks, or `owner`). The door decides by the action's level:
   - **Ships alone** (content inside existing formats: the tape, stories, the Digest, corrections; data label and bug fixes) runs.
   - **Ships to preview** (anything that changes how a page looks or adds a format) is recorded as a proposal; nothing live changes.
   - **Needs the owner** (navigation and sections, brand and voice, new outside sources, deleting or rewriting stored data, spend over the cap, secrets, outbound posts) is refused unless the actor is `owner` and the call carries `"confirm": "owner confirms <action>"`. The phrase guards against a desk's mistake; it is not a lock (there is one editor key).
   - While the owner's weekly cap is reached, any action that costs is refused, and the writers make no calls.

3. **Every call is logged** in the desk log: when, which desk, the action, its level, the subject, the decision (done, read, proposed, refused, failed) and the reason. A kill, a hold, a retirement and a refusal always carry a reason. The log cannot be edited; story edits appear in the same history list.

## Story states

Each story has a state history beside its stored status: candidate, drafted, checked, reviewed, published, held, killed, retired, each with who and why. The pipeline records them from what it stores (the engine and the three writers are actors in it). `reviewed` means standards passed the story and the editor in chief placed it; from N2 a story publishes only from `reviewed`. When a desk's call fails or its daily cap is used, the story takes the engine's path and its reviewed line says so (“reviewed without second reader: cap used”).

## Writer versions and the golden gate

A writer's version is its prompt (system text and output schema), its models and its template version. `src/lib/newsroom/golden/versions.ts` lists every version; the prompt part is a fingerprint computed from the code, so a changed prompt or model fails the build until a new version is recorded with a score file in `scores/` that passes the gate: a mean at least the baseline's, and no frozen text that passed now failing. The frozen writing set (`src/lib/newsroom/golden/__fixtures__/writing-set.json`) holds the approved texts and the facts each was written from. `bun scripts/golden-score.ts --frozen` scores it without a model; `--live --writer story` is hand-run only and refuses when today's writer allowance or the weekly cap would not cover it.

## Desk actions added in N2

- **`hold`** (ships alone): puts a published or reviewed story back to held with a `reason`; its page says it is held and why in one line, and `/desk` shows the reason. A story the standards desk held is released (`restore`) only by the editor in chief or the owner.
- **`note`** (ships alone): a dated note on a `story`, `study`, `brand` or `signal` (`subject_kind`, `subject`, `text`). Shown on `/desk` and in the memory, never on a reader's page.
- **`proposal_status`** (needs the owner): sets a `propose` call's status (`log` is the proposal's desk-log id) to `open`, `accepted` or `declined`.
- **`copy_sweep`**: written only by the copy desk's weekly sweep inside the product; one row per page with lines that fail the copy lints.

## The desks at work (N3)

<!-- desks:start (written by scripts/newsroom-docs.ts from the code; do not edit by hand) -->

### The order of work

candidate → drafted → checked → picture checked (graphics) → standards (the checklist, then the second reader) → editor in chief → published. When a desk's call fails or its limit is used, the pipeline carries on by rule and the story's state history says so.

### Daily model-call limits (UTC day; fixture calls are not counted)

- **standards**, second reader: 12 a day.
- **editor in chief**, placement: 6 a day.
- **news**, wire picks: 4 a day.
- **graphics**, picture check: 8 a day.
- **graphics**, study chart: 2 a day.
- **data**, weekly proposal: 1 a day.
- **design review**, page review: 9 a day.
- **publisher**, social drafts: 2 a day (one call a week).
- **scout**, brand candidates: 1 a day (one call a week).

### The news desk

Picks at most 5 links a day from the wire's publications (outlet items only, published in the last 36 hours, never picked before, one per story keeping the earliest; at most 40 shown to the model, and only when at least 3 are new since its last call). Each line is checked in code: at most 120 characters, one sentence, no number or proper name the item's title or excerpt does not carry, never more than 6 words in a row taken from them, and the copy desk's and writers' word lists. The brand tag comes from the strict name matcher, never the model. A pick tagged with a brand that has a measured change within 14 days either side files a pitch for the editor in chief. Readers see the picks of the last 24 hours as THE WIRE on the front page, after THE TAPE.

### The graphics desk

Checks each story's picture before standards: the rule's choice and up to 3 ranked alternates that pass the quality gate. Only a stored crop that passes the gate can be chosen; a before-and-after pair may become its after-crop alone, never mixed across dates; the caption is rebuilt by rule and no text changes. “No picture shows it” fails checklist item 3 for a type that needs a picture. For study figures it chooses a form only where more than one chart-kit form fits the data, and checks every published story, study and Digest share image daily (code).

### The data desk

Daily checks (code) record findings of these kinds: contradiction, detector, impossible, coverage, wrong website. The detector sample re-derives 25 measured events a day under today's rules; coverage flags active brands with no good capture for 3 days and sectors under 15 measured homepages. An open finding on a brand and measure a story cites holds it (checklist item 9). Weekly, after the forecast, it scores the forecast made 28 days earlier against what the measurements show, then makes one call that files at most 3 study pitches and 2 signal ideas; code drops any that name a measure the product does not hold.

### Door actions added in N3

- **`wire_pick`** (ships alone): The news desk picks one outlet item from the wire with its subject (brand, web or type) and one line saying what it reports; at most five picks a day. Shown on the front page's THE WIRE block for 24 hours.
- **`wire_drop`** (ships alone): Drops a wire pick with a reason (news, standards or the editor in chief); it leaves the front page and stays in the log.
- **`picture`** (ships alone): The graphics desk chooses a story's lead picture: a stored crop or before-and-after pair that passes the quality gate, no picture, or back to the rule's choice, with a reason. The caption is rebuilt by rule; no text changes.
- **`finding`** (ships alone): The data desk records a finding: wrong or contradictory data, with what was expected, what was found and the receipt. An open finding on a brand and measure holds a story that cites them.
- **`finding_close`** (ships alone): Closes a data finding with who and why (data, standards or the editor in chief).
- **`data_run`** (ships alone): The data desk's daily checks, the weekly forecast backtest, the share-image check, the study chart check or one news desk pass: records what the run found (counts by kind). It fixes nothing.

### Page reviews

A review run measures 9 pages (the front page `front`, a story page `story`, a brand page `brand`, a study page `study`, the terminal `terminal`, the digest `digest`, studies `studies`, brands `brands`, signals `signals`) at 1440, 768, 390 px. An outside browser job sends one `review` call per page and width with its measures (`height_px`, `words`, `links`, `images`, `image_kb`, `first_byte_ms`, `lcp_ms`, `cls`, `overflow_x`, `small_targets`, `low_contrast`, `h1`, `headings`, `console_errors`, `failed_requests`, `changed_share`) and an optional small WebP picture (the crops' rule; kept under its own folder, never shown to readers). A run's kind is weekly, before, after, test; a test run is shown as a test and never counts toward budgets, breaches or the gate. A missing measure is not measured, never zero.

Budgets per page and width: height px (first weekly run plus 10%); words (first weekly run plus 10%); links (first weekly run plus 10%); image kb (first weekly run plus 10%); first byte ms (speed target: 800); lcp ms (speed target: 2500); cls (speed target: 0.05); overflow x (must be false); small targets (not above the previous weekly run); low contrast (not above the previous weekly run); console errors (not above the previous weekly run); failed requests (not above the previous weekly run). The first-run budgets are the first complete weekly run plus 10%, so nothing breaches on day one; until a first weekly run exists there are none.

### The design review desk

Weekly, after a complete weekly run (all 9 pages at 3 widths), once per run. Breaches first, in code: overflow, contrast, tap targets, errors and speed become bug items on the queue; height, words, links and image weight become proposals. Then one vision call per page (limit 9 a day) sees the page's three pictures, its measures with last week's and the register of design settings with their ranges, and returns at most two observations about density, hierarchy and access, each with one move. Code keeps a setting move only when it names a register setting and a value inside its range; anything else is a layout move that needs the owner; a move that touches the name, the wordmark, the brand direction, the type families, the navigation or a page's structure is dropped. At most 5 proposals a week, the ones tied to a breach first, each filed with `propose` and a queue item linked to it. Nothing live changes. Setting moves the owner accepts wait for the next monthly design edition.

### The engineering desk

Daily, code only, no model: files or declines bug items by stable key for a scheduled job whose newest run failed, that has not run within 2 times its usual interval, or whose newest run took more than 3 times its 14-day median (and over 5 s); a crawl or the wire older than the health staleness rules; a page over its speed target in the newest review run; more than 10% of a desk's or the writers' model calls failing over 24 hours; a writer's texts failing the shared check more than 50% of the time over 24 hours; the history refresh taking over 60 s (it records a run only when captures arrived, so it is never called late: library-history-refresh). Job facts are names, run times, durations and success only. An item whose problem is gone is declined “no longer found”; nothing is deleted.

### The build queue

One list for every product change. Kinds: bug, label, design move, layout, feature. What readers should see: no visible change, small, layout. Statuses: queued, briefed, built, gate passed, gate failed, live, declined. The order: queued → briefed; briefed → built; gate failed → built; gate passed → live; built → gate passed or gate failed only through `gate_result`; declined at any open point with a reason. Briefed and live for anything but bug and label need the owner's accepted proposal; live needs the newest gate result to be a pass.

### The gate

1. No failed tests.
2. Every page and width of the review list is in the after run.
3. No page scrolls sideways at any width.
4. First byte within 800 ms on every page and width.
5. Console errors, failed requests, small tap targets and low-contrast text not above the before run.
6. Visible change within what the item said to expect (no visible change: at most 1% of pixels and 20 px of height; small: 10% and 8%; layout: no pixel limit).
7. A layout change has the owner's accepted proposal.
8. A design move passes the living-design gate.

Visible change: no visible change allows at most 1% of pixels changed and height within 20 px; small allows at most 10% of pixels changed and height within 8%; layout has no pixel limit, but the owner's accepted proposal. Not above the before run: console errors, failed requests, small targets, low contrast. A design move also passes the living-design gate (its checks except the edition's move count).

### Door actions added in N4

- **`review`** (ships alone): One page at one width from a review run (the outside browser job): its measures and an optional small picture, stored as sent; a missing measure is not measured, never zero. A test run is shown as a test and never counts toward budgets, breaches or the gate.
- **`queue_add`** (ships alone): Files a product change on the build queue: title, why, kind, what readers should see, its source and a stable key (the same key is not filed twice while open).
- **`queue_move`** (ships alone): Moves a queue item along (engineering; the owner may decline): queued, briefed, built, then a gate result, then live; or declined with a reason. Briefed and live for anything but a bug or a label need the owner's accepted proposal; live needs the newest gate result to be a pass.
- **`gate_result`** (ships alone): Records a build's gate (engineering): the commit, the test numbers and the before and after review runs. Code works out every check and the verdict; the door takes no verdict.

### When the desk jobs run

- **News desk:** in the wire ingest's own job, straight after the ingest stores its items and before the story build, with its own 25-second limit. When it decides not to call, it records why at most once every 60 minutes (`data_run`, run `picks`).
- **Share-image and study-chart checks (graphics):** once a UTC day in their own scheduled passes (schedule “desk-passes”, `7-57/10 1-3 * * *` UTC): at most 5 items a pass, one pass per 10-minute slot, each under 20 s, resuming where the last pass stopped. A pass reads stored records only; an image that cannot be built from them in 5 s is recorded as failing and not retried that day. A start row is written before any work; one with no finish row after 2 minutes is a failed pass, and 2 failed passes stop the check for the day and file a bug item. Never two passes at once, and never while ingest-wire (every 15 min), library-ai-worker (every 5 min), library-history-refresh (every 10 min) is inside its time limit.
- **Data desk checks, backtest, health run and design review:** after the story build when time is left, each behind its once-a-day (proposal: once-a-week; design review: one pass a day per weekly run) record, written before the work starts, so a run that is cut off is not retried by the next job.
- **Holds:** `job_hold` (engineering or owner) holds any of share, chart, picks, checks, health, design review, backtest, proposal, reviews, review, stories, package, drafts, candidates until a time at most 7 days ahead; a held job does not start. `job_release` ends a hold early. Both carry a reason; /desk and the memory show every hold.

### Door actions added in N4b

- **`job_hold`** (ships alone): Holds a scheduled desk job (share, chart, picks, checks, health, design review, backtest or proposal) until a time at most seven days ahead, with a reason (engineering or the owner). A held job does not start; /desk shows who, why and until when. N5: also `review` (the review passes) and `stories` (the story build's publishing step), so content can be frozen around a gated deploy, and the publisher's and scout's weekly jobs (`package`, `drafts`, `candidates`).
- **`job_release`** (ships alone): Releases a held scheduled desk job before its time, with a reason (engineering or the owner).

### The publisher

Mondays, after the Digest's week closes, in the desk jobs after the story build. First the package check (code, no model) on the newest published issue: the issue is for a closed iso week; under 600 words; three pictures; one chart; five changes; the cover builds; the share image builds; the digest rss is well-formed and carries the newest issue; the morning line rss is well-formed and carries the newest morning; every internal link in the issue answers 200. One stored row per check; a failure files a bug item (key `package:<week>`). Only after that issue's check passed, one drafts call (2 a day at most): up to 6 drafts, 3 for the Digest's argument and up to 3 for the week's stories the editor in chief led with. Code drops a draft over 280 characters with its slug.global link, with more than one sentence or one number, a number not on its target's facts, an emoji, more than 1 hashtag, a question or exclamation, or a line the shared check or the copy desk refuses. Drafts are drafts: draft → approved or declined; approved → posted or declined, set only by the owner (`draft_status`). There is no posting code. Audience numbers come once a week from the publisher's outside session (`audience`): counts only, at most 20 paths and 10 sources; no tracker, cookie or per-person data is added to the site.

### The scout

Keeps the sources register (28 sources: 16 read, 0 needs permission, 11 closed by its terms, 1 off); `source_note` appends a terms reading and changes only what the register shows. Reading a new source still needs the owner. Mondays, one candidates call (1 a day at most) over the last 7 days of outlet wire items, stored Product Hunt launches and names in news items the matcher could not tie to a tracked brand. Up to 15 come back; code keeps at most 10 whose website is a well-formed domain that is not tracked (active or not), not opted out, not proposed in the last 90 days and not a publication, store or social profile, whose sector is one of slug's ten and whose name appears in the item it cites. Each kept candidate is stored and filed with `propose`. Statuses: proposed → accepted or declined (the owner) → added (engineering, once the crawler's seed list carries it). Nothing is added to the library by the product.

### Door actions added in N5

- **`audience`** (ships alone): The week's audience numbers from the host's own analytics (the publisher's outside session, once a week): visitors, pageviews, at most 20 paths and 10 sources, counts only. A later entry for the same week replaces what is shown; the earlier one stays stored.
- **`source_note`** (ships alone): Appends a terms reading to a source in the sources register (the scout): status, date read, link, one line. It changes what the register shows and nothing else; reading a new source still needs the owner.
- **`candidate_status`** (ships alone): Moves a brand candidate: accepted or declined (the owner only), then added (engineering, once the crawler's seed list carries it, or the owner). Nothing is added to the library by the product.
- **`draft_status`** (needs the owner): Sets a social draft's status: approved, posted or declined (from draft: approved or declined; from approved: posted or declined). There is no posting code: outbound posts stay the owner's.

<!-- desks:end -->
