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
- **Breakouts.** A forecast alert that a signal reached the Breakout stage (stage words in `labels.ts`, alert rules in `alerts.ts`).
- **Outside news.** An item from the wire's publications that names a tracked brand (names of at least 4 letters, strict matching) and is about design; the story says what the item says, about that brand.
- **Quiet change.** An icon, social card or other-page identity change with no mention in the wire's publications within 14 days either side. A page that follows a confirmed homepage change of the same kind within 30 days is not quiet: it becomes a fact on the brand's own story.

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
