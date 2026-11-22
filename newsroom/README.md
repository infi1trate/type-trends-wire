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

<!-- desks:end -->
