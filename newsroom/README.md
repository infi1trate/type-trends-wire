# The newsroom's memory

slug's newsroom is a set of desks (editor in chief, copy desk, standards, news, data, graphics, design review, engineering, publisher, scout). The desks that need judgment run as scheduled agent sessions outside the product. A session starts knowing nothing, so everything the newsroom knows is readable in one call, and everything a desk does goes through one door that enforces the rules. **No desk is switched on yet (N1).**

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

Each story has a state history beside its stored status: candidate, drafted, checked, reviewed, published, held, killed, retired, each with who and why. The pipeline records them from what it stores (the engine and the three writers are actors in it). `reviewed` is the editor desk's sign-off, used from N2; nothing requires it yet.

## Writer versions and the golden gate

A writer's version is its prompt (system text and output schema), its models and its template version. `src/lib/newsroom/golden/versions.ts` lists every version; the prompt part is a fingerprint computed from the code, so a changed prompt or model fails the build until a new version is recorded with a score file in `scores/` that passes the gate: a mean at least the baseline's, and no frozen text that passed now failing. The frozen writing set (`src/lib/newsroom/golden/__fixtures__/writing-set.json`) holds the approved texts and the facts each was written from. `bun scripts/golden-score.ts --frozen` scores it without a model; `--live --writer story` is hand-run only and refuses when today's writer allowance or the weekly cap would not cover it.
