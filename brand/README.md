# slug brand kit

**P · Extra Fine**, approved 16 November 2026. slug is the live newsroom for how brands look and sound on the web.

The idea in one line: loud tabloid bones, four spot inks, and things that look like you could pick them up.

## What is in this kit

| Folder | Contents |
|---|---|
| `logo/svg` | The wordmark as outlined vectors in three cuts, the s monogram, tiles, favicon and app icon. Slits are real cut-outs, so the files sit on any ground. |
| `logo/png` | Transparent PNG exports of the same. |
| `tokens` | `slug.tokens.css` (CSS variables, three modes, type classes), `slug.tokens.json`, `slug.theme.ts`. |
| `motion` | `slug-motion.css`: timing tokens, easings and the five reference animations. |
| `illustration` | `slug-filters.svg`: paper, grain, pencil, soft-object, trail and one-ink photo filters. |
| `boards` | The five brand boards as images: mark, system, compositions, illustration, motion. |

## The mark

- The word is always `slug`: lowercase, black, never typeset in a font, never in capitals.
- It is drawn from Shrikhand (SIL Open Font License) stood upright, set on one line. Each letter cuts a thin slit into the letter before it; the slit shows the ground.
- Three cuts, chosen by height:
  - **Display**, 96 px and taller: `slug-wordmark-display.svg`
  - **Standard**, 32 to 96 px: `slug-wordmark-standard.svg` (wider slits, slightly lighter)
  - **Micro**, under 32 px: `slug-wordmark-micro.svg` (no slits, the letters fuse)
- Clear space is half the x-height on every side (`slug-wordmark-display-clearspace.svg` has it built in).
- Grounds: paper by default; pink, yellow and green are allowed. On ink or on a photograph the mark sits on a slab (pink on ink, paper on a photo). It is never reversed to white.
- The **s** stands in where four letters will not fit: avatars, favicon, app icon. Tiles are square. The app icon is the one place the s becomes an object, with a rounded body, a light and a hard shadow.
- Not allowed: the italic lean, any colour but black, stretching, letterspacing, soft shadows or glows, setting the name in a typeface.

## Colour

Paper and ink carry the brand. Four inks do one job each.

| Name | Hex | Share of a page | The job | The limit |
|---|---|---|---|---|
| Paper | `#F1ECE0` | about 56% | The page | Never pure white for a page |
| Ink | `#0A0A0A` | about 16% | Type, rules, shadows, the mark, the night desk | Never greyed down for body text |
| White | `#FFFFFF` | about 9% | Cards you read from | Never a page background |
| Pink | `#FF8FC4` | about 8% | The lead: one plate per screen, covers | Never for status or alerts |
| Green | `#19B560` | about 4% | Rising, positive data, the trail, measured values | Never a decorative fill |
| Yellow | `#FFE600` | about 4% | The highlighter: what moved, focus, stickers | Never under long text |
| Red | `#E8320E` | about 3% | Live and urgent: the dot, the stamp, a falling number | Never more than a mark at a time |

Supporting: newsprint `#CFC7B4` for quiet fills and the Steady stage; muted `#4A463D` for captions.

Contrast against ink: paper 16.8, white 19.8, pink 9.4, yellow 15.6, green 7.4, red 4.8. Red text on paper is 3.8, so large type only.

Stage colours: Emerging pink, Rising green, Peaking red, Fading ink with paper text, Steady newsprint.

Modes: **light** (paper page, white cards), **dark** (ink page, `#1D1B18` cards, paper text; the mark on a pink slab), **vibes** (pink page, yellow cards, ink plate; for covers, share cards and launches).

## Type

Two families and the mark, plus one utility face for the terminal.

- **Big Shoulders** 900 for headlines and figures, 700 for labels. Capitals. It states the fact.
- **Newsreader** 400 (italic for quotes) for decks, body and captions. It explains the fact.
- **IBM Plex Mono** 400 and 600 is a utility face. It is used only in the terminal and for code-like values: the console, signal keys, hex colours, domains and dense data tables. It never sets a headline, a label on a Read page or a sentence.

| Role | Face | Size / leading | Notes |
|---|---|---|---|
| Display | Big Shoulders 900 | 132 / 0.88 | Capitals, balanced lines |
| H1 | Big Shoulders 900 | 72 / 0.92 | |
| H2 | Big Shoulders 900 | 44 / 0.95 | |
| H3 | Big Shoulders 900 | 28 / 1.0 | |
| Kicker | Big Shoulders 700 | 15 / 1.15 | Tracked 0.12em |
| Chip | Big Shoulders 700 | 12 / 1.5 | Tracked 0.12em, on an ink chip |
| Deck | Newsreader 400 | 26 / 1.25 | |
| Body | Newsreader 400 | 18 / 1.55 | 62 characters |
| Quote | Newsreader italic | 34 / 1.15 | |
| Figure | Big Shoulders 900 | 96 / 0.9 | Tabular; the unit in 700 |
| Caption | Newsreader 400 | 14 / 1.4 | Muted |
| Data | IBM Plex Mono 400, 600 | 13 / 1.5 | Terminal, console and code-like values only; tabular figures |

Rules: capitals are for headlines only. Every number a reader should remember is set in Big Shoulders. Headlines are set tight, text is set loose. Balance headline lines; avoid one-word last lines in text.

## The terminal

The terminal is the same brand at its densest: the night desk.

- Dark mode, Loud density: ink page, `#1D1B18` panels, paper text, 8 px gaps, 1.5 px paper rules. The mark sits on its pink slab.
- Panel titles and column heads are Big Shoulders 700, tracked capitals. The one figure a panel exists to show is Big Shoulders 900.
- Table cells, keys, hex values, domains and the console are IBM Plex Mono 13 / 1.5 with tabular figures, so columns align and codes read exactly.
- Any full sentence (a story line, a why-it-matters, help text) is Newsreader.
- Colour does the same jobs as everywhere else: yellow for focus, selection and the cursor; green rising, red live and peaking, pink for the lead row or the active story. No other colours, no gradients, no gumballs, no stickers and no illustration in the terminal.
- Motion: the live tick and the cursor only. No ooze, no wipes.

## Containers

1. **Sheet**: the page. No border, no fill.
2. **Rule box**: a 3 px ink border, for grouping an index, a table, a set of charts.
3. **Card**: white with a 3 px border, for anything read as a unit. No shadow.
4. **Slab**: ink, for navigation, the ticker, footers, the night desk.
5. **Plate**: a colour fill with a border, for the one loud thing on a screen.
6. **Raised**: a hard 6 px shadow, for things you press, and only those.
7. **Sticker**: round, tilted, with a short hard shadow, for a note on top of the layout.
8. **Photo plate**: the picture runs full; anything you read sits on an ink strip.

- Square is print, round is object. Only things a hand could pick up are round: stickers, gumballs, the app icon.
- One plate per screen. Two levels deep at most. A shadow is a promise that something moves.
- Lists are ruled tables, not stacks of cards. If a 1.5 px rule separates two things, do not draw a box.

## Space

Scale: 4, 8, 16, 24, 40, 64, 104.

| Density | About this much empty | Use |
|---|---|---|
| Quiet | 70% | Stories and reports. One column, off-centre; the left third holds a label and nothing else; 104 above the title. |
| Steady | 45% | The front page and indexes. One plate, a ruled list beside it, 40 between blocks, 16 inside. |
| Loud | 15% | The terminal, tile walls, share sets. Gaps drop to 8 and the grid does the work. |

- Air goes above: the bigger the idea, the more space over it.
- Pin small type (folios, dates, credits) to the edges and leave the middle to one thing.

## Layout moves

- The index is a ledger: numbered, ruled rows; serif for the story, Big Shoulders for facts, small capitals in ink chips for tags.
- Covers put one object in the middle, tilted and bleeding off the frame, with captions pinned to the left and right edges at mid-height.
- A cover number or word can be an object (illustration style 03).
- Tile walls use one grid with tiles of several sizes and 8 px gaps.

## Photography and illustration

- Photographs are printed in one ink (green, pink or ink on paper) before they are used. Reading text never sits on a photograph; a display headline may cross one. Credit every photo.
- Every illustration mixes three materials: something printed (halftone, newsprint), something made by hand (cut paper, pencil), something with volume (a gumball, a trail, a soft object).
- Three styles: **Cut and paste** (paper collage, taped photo, headline in strips, pencil notes), **The trail** (the chart line as a wet, raised trail with gumballs at the measurements), **Soft objects** (a number or letter as an inflated object on a two-ink print).
- Light comes from the top left. In illustration shadows are real: short and soft. In the interface they are hard and black.
- The number, the brand and the date stay in type, on paper, undistorted.

## Motion

| Token | Time | Ease | For |
|---|---|---|---|
| Tap | 120 ms | linear | Presses and toggles |
| Move | 240 ms | Ooze | Digits, bars, stickers |
| Wipe | 480 ms | Cut | Page changes |
| Arrive | 700 ms | Ooze | The mark, soft objects landing |
| Draw | 1.6 to 3 s | Slow in, slow out | The trail |

Easings: Ooze `cubic-bezier(0.3, 1.5, 0.5, 1)`, Cut `cubic-bezier(0.7, 0, 0.3, 1)`, Settle `cubic-bezier(0.2, 0.8, 0.2, 1)`. Letters of the mark follow each other by 110 ms.

- Objects squash. Pages cut; they do not fade or slide. Data counts to its value.
- One thing moves at a time. The ticker and the live dot are the only loops.
- With reduced motion on, everything rests on its last frame.

## Credits and licences

- Wordmark letterforms derived from Shrikhand by Jonny Pinhorn, SIL Open Font License 1.1.
- Big Shoulders, Newsreader and IBM Plex Mono are served from Google Fonts under the SIL Open Font License.
- Photographs on the boards are from Unsplash and are placeholders, credited on the boards.
