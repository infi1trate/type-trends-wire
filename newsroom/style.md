# slug · style

How slug writes, in plain words. A desk session reads this before it writes or edits anything. The rules come first, each with one good and one bad example from stories that ran or were retired; then every word and phrase list the code refuses, written from the code itself (a test fails when this file and the check disagree).

The voice: a sharp colleague who actually looked at the page. Dry, specific, a little wry, never a consultant.

## The editorial rules

### 1 · A story is a claim
Say what happened, as a sentence a reader could check.
- Good: No. 44, “Dev tools are putting charts on their homepages”.
- Bad: No. 11, “rivian.com changed its layout” (retired: now a tape line).

### 2 · Show it
Every story leads with a picture chosen by rule (crops, social card, chart, marks, or none) and quotes the copy it is about.
- Good: No. 88 quotes both headlines: “Trusted by millions worldwide” and “The trusted financial account for you and your agents”.
- Bad: No. 32, “cash.app rebranded: new palette”, deck “identity change; no forecast trait moved”.

### 3 · Lead with the specific
From what, to what, between which dates.
- Good: No. 88, “Between 11 and 14 November, Coinbase replaced “Trusted by millions worldwide” with …”.
- Bad: No. 37, “Three enterprise SaaS brands changed their colors”, deck “framer.com, atlassian.com and mongodb.com, between 11 Nov and 14 Nov.”

### 4 · Brands by name
The brand's own name; the domain appears once, as the link.
- Good: No. 78, “HubSpot now calls itself a harness”.
- Bad: No. 4, “mistral.ai rebranded: new accent”.

### 5 · Say how we know, once
One line under the story: measured from which captures, or our read (an AI estimate). Never inside the headline.
- Good: No. 88, “The headline and hero changes were measured from captures on 11 and 14 November; the AI figures are our read of homepage copy, an AI estimate.”
- Bad: No. 19, “retool.com shifted its aesthetic (AI estimate)”.

### 6 · “Rebrand” is earned
Only for type, colour and layout changing together, or a new name or logo.
- Good: the approved Black Friday story: “None of it is a rebrand.”
- Bad: No. 27, “barrys.com rebranded: new accent”.

### 7 · Numbers carry their comparison
A share comes with its count and base, and with what it is compared to.
- Good: No. 44, “Charts or data visuals appear on 9 of 30 tracked dev tools homepages.”
- Bad: No. 6, “adopted steady serif headlines — joins 10% of ai”.

### 8 · No stock endings, no advice
End on the last fact, not on a moral or a to-do.
- Good: No. 88 ends “The headline leaves open what the agents do.”
- Bad: No. 8's old line, “… so audit your landing page to determine if motion improves or distracts from conversion.”

### 9 · Every page has a way on
A story points to the brand, signal or tape it came from; a retired story keeps its page with the reason.
- Good: No. 77 was retired, and its page still says why (“the item names Mother Design, not the tracked brand Mother”) and links on.
- Bad: before E2d a retired story's page was a dead end.

### 10 · Empty beats filler
When the facts are thin, the section is left out or the story does not run.
- Good: No. 46 was retired (“the gap could not be filled”) rather than padded.
- Bad: No. 9, deck “identity change; no forecast trait moved”.

### 11 · Outside news has a beat
Outside news runs only when an item from the wire's publications names a tracked brand and is about how it looks, sounds or is built.
- Good: No. 3, “OpenAI might rebrand its data centers as 'AI compute campuses'”.
- Bad: No. 47, “B2 Architecture turns North Korean defector testimonies into Prague exhibition” (retired: outside news without a design subject).

### 12 · Measured before AI-read
A measured change outranks our read; an estimate alone is never a single-brand story.
- Good: No. 88, a measured headline change.
- Bad: No. 57, “zed.dev shifted its aesthetic (AI estimate)” (retired: estimate only).

## The truth rules (added since)

### Two captures either side
A change counts when two captures show the old value and two show the new one.
- Good: Netlify (20 Nov), two captures before and two after, in the golden set's “must run” group.
- Bad: No. 7, “runwayml.com rebranded: new font” (retired: the earlier font and colours were each seen in only one capture).

### One count per claim
Each claim carries one count over one base, read once.
- Good: No. 89, “16 of 162 tracked homepages whose headline we can read”.
- Bad: No. 46, “Zero of 30 tracked media brands show it, against 37% of brands in other sectors” (retired).

### Colour words are facts
Colour words come from the colour-naming function for that change, never from taste.
- Good: the approved DocuSign deck, “from deep indigo to electric violet”.
- Bad: No. 17, “apple.com changed its palette to Off-white and light grey, Muted dark indigo, Vivid purple” (retired: reversed within seven days).

### An AI re-read is not a change
An AI-read field counts only when a measured look field also differs.
- Good: No. 88, measured.
- Bad: No. 29, “future.co shifted its aesthetic (AI estimate)” (retired: estimate only).

### A page that follows its homepage is not a quiet change
A page change within 30 days of a confirmed homepage change of the same kind becomes a fact on the brand's own story.
- Good: Netlify's changelog typeface is one fact on its rebrand story, No. 85: “The changelog page now uses it too.”
- Bad: the W1b candidate “Netlify's changelog typeface changed between 14 and 20 Nov”, offered as a quiet change (stopped by W1c, never ran).

### News says what the item says, about the right brand
- Good: No. 3 restates the item's own claim about OpenAI.
- Bad: No. 77, “It's Nice That named Mother” (retired: the item names Mother Design, not the tracked brand Mother).

## What the check refuses

The writers' shared check (`src/lib/stories/writer.ts`, reused by the study and Digest writers) refuses these, outside quotations.

<!-- lists:start (written by scripts/newsroom-docs.ts from the code; do not edit by hand) -->

### Advice

Refused as “banned phrase”. Source: `ADVICE (stories/writer.ts)`.

“audit your”, “consider”, “you should”, “make sure”, “it's time to”, “brands should”

### Stock endings

Refused as “banned phrase”. Source: `STOCK_ENDINGS (stories/writer.ts)`.

“worth watching”, “a data point, not a trend”, “belongs in briefs and templates”

### Trend-speak

Refused as “banned phrase”. Source: `TREND_SPEAK (stories/writer.ts)`.

“effectively dead”, “the end of”, “the rise of”, “game-changing”

### Superlatives

Refused as “banned word”. Source: `SUPERLATIVES (stories/why.ts, used by the shared check in stories/writer.ts)`.

“revolutionary”, “game-changing”, “game changer”, “groundbreaking”, “ground-breaking”, “unprecedented”, “disruptive”, “incredible”, “amazing”, “stunning”, “massive”, “huge”, “explosive”, “best-ever”, “best ever”, “insane”, “jaw-dropping”, “seismic”, “radical”, “ultimate”, “must-see”, “skyrocket”, “skyrocketing”

### Hedging and filler

Refused as “banned word”. Source: `BANNED_PHRASES (stories/why.ts, used by the shared check in stories/writer.ts)`.

“warrants”, “monitoring”, “signaling”, “signalling”, “too early”, “insufficient”, “it remains to be seen”, “landscape”, “leverage”

### Method words

Refused as “method word”. Source: `METHOD_WORDS (stories/writer.ts)`.

“score”, “scores”, “scored”, “threshold”, “thresholds”, “deterministic”

### Method uses of “run”

Refused as “method word”. Source: `METHOD_RUN_USES (stories/writer.ts)`.

“forecast run”, “run number”, “run <number>”, “this run”, “the latest run”, “per run”

### Claims about intent

Refused as “claim about intent”. Source: `INTENT_CLAIMS (stories/writer.ts)`.

“secretly”, “quietly”, “silently”, “stealth”, “under the radar”, “without telling”, “nobody announced”, “unannounced”, “behind the scenes”

### Ranking words (studies and the Digest: only when the sheet carries the ranking)

Refused as “a superlative the sheet does not carry”. Source: `RANKING_WORDS (data-stories/writer.ts)`.

“first”, “most”, “least”, “biggest”, “largest”, “fewest”, “only”, “highest”, “lowest”

### Ranked-list words (studies: allowed about the top or bottom entry of a ranked list on the sheet)

Refused as “a superlative the sheet does not carry”. Source: `RANK_TOP, RANK_BOTTOM (data-stories/writer.ts)`.

“highest”, “most”, “first”, “lowest”, “least”, “last”

### Causal words (studies and the Digest: only when the sheet links the two)

Refused as “a causal claim”. Source: `CAUSAL (data-stories/writer.ts)`.

“because”, “driven by”, “thanks to”, “as a result of”, “due to”

### Study phrases

Refused as “banned phrase”. Source: `STUDY_BANNED (data-stories/writer.ts)`.

“it turns out”, “in a world”

### Digest phrases

Refused as “banned phrase”. Source: `DIGEST_BANNED (digest/writer.ts)`.

“this week saw”, “it turns out”, “in a world”

### Predictions (the Digest: only with a forecast call on the sheet)

Refused as “a claim about the future without a forecast call”. Source: `FUTURE (digest/writer.ts)`.

“will”, “won't”, “is set to”, “are set to”, “is going to”, “are going to”, “is dead”, “are dead”, “is over”, “are over”

### Also refused by the shared check

An arrow (→ or ->) in our own words; a hex code in the text; “rebrand” as a claim unless the facts show type, colour and layout changing together, or a new name or logo.

### Lengths

Story headline 4–9 words; body 2–4 paragraphs, 60–140 words. The Digest stays under 600 words.

<!-- lists:end -->
