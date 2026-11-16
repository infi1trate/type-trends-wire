# Themes

A theme is every value the product's look is made of — colours, faces, type sizes, radii, borders, shadows, spacing, motion — named by role (`surface.page`, `text.muted`, `stage.rising`, `type.h1`), never by value. `css.ts` writes the active theme as `--tk-*` CSS variables; `src/styles.css` and components read only those variables.

Each theme has three modes: **light** (Read pages), **dark** (the terminal) and **vibes** (a loud, colour-forward mode for covers and share cards). The route sets the mode on `<html data-mode>`; a subtree can switch with its own `data-mode`.

To add a brand direction, copy legacy.ts, change values, register it.

1. Copy `legacy.ts` to `<name>.ts` and change the values (keep every key; the `Theme` type fails if one is missing).
2. Register it in `THEMES` in `index.ts`.
3. Set `ACTIVE_THEME` to its name. Judge it on `/kit`.

`blank.ts` is a typed stub that only proves the contract is complete; it carries no look.
