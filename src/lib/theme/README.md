# Themes

A theme is every value the product's look is made of — colours, faces, type sizes, radii, borders, shadows, spacing, densities, motion — named by role (`surface.page`, `text.muted`, `plate.bg`, `stage.rising`, `type.h1`), never by value. `css.ts` writes the active theme as `--tk-*` CSS variables; `src/styles.css` and components read only those variables.

The active theme is **slug** (`slug.ts`), built from the owner's kit in `brand/tokens` (`brand/README.md` is the source of truth). Values the kit does not give are marked `CHOSEN` in `slug.ts` with the reason.

Each theme has three modes: **light** (Read pages: paper page, white cards), **dark** (the terminal: ink page, dark cards, paper text) and **vibes** (pink page, yellow cards, ink plate; covers and share cards). The route sets the mode on `<html data-mode>`; a subtree can switch with its own `data-mode`. The page density (Quiet, Steady, Loud) comes from `ia.ts` and is written to `<html data-density>`.

`legacy.ts` is the look before the brand. It is kept for before/after comparisons (`COMPARISON_THEMES`) and is not registered for pages. `blank.ts` is a typed stub that only proves the contract is complete.

To add a direction: copy `slug.ts`, change values (the `Theme` type fails if a key is missing), register it in `THEMES`, set `ACTIVE_THEME`, and judge it on `/kit` and `/brand`.
