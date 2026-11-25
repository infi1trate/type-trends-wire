# A3 + A4, second half · proof

Not deployed. Flags unchanged (MUSEUM_SHOWN false, ICONS_SHOWN true). No migration, dependency, font, edition or crawler change.

Pictures: `<page>-<width>-before.png` are from the live site (build 364d68e), and `-after` from this build. Pages: sector (/sectors/fintech), sector-chip (?category=payments), today, signals. `strip-390/1440-after` show a small-multiples tile chosen, with the shared strip filled ("Scrolling marquees · Q4 2026 · 3.3% · 1 of 30"); the 390 picture is a first tap, which stayed on the page. `placeholder-1440-after` shows a Terminal panel while its read is held back.

## Layout shift (six seconds from first byte, 900 px tall window)
Before = live site, after = this build in the sandbox. Terminal figures are the worst of repeated loads.

| Page | 390 before | 390 after | 768 before | 768 after | 1440 before | 1440 after |
|---|---|---|---|---|---|---|
| Today | 0.001 | 0.001 | 0.002 | 0.002 | 0.004 | 0.001 |
| Signals | 0.004 | 0.001 | 0.005 | 0.002 | 0.001 | 0.001 |
| Brand (Stripe) | 0.002 | 0.002 | 0.002 | 0.002 | 0.005 | 0.001 |
| Study (/studies) | 0.014 | 0.014 | 0.018 | 0.018 | 0.013 | 0.013 |
| Terminal Library | 0.004 | 0.004 | 0.534 (some loads) | 0.010 | 0.034 (some loads) | 0.011 |

Both Terminal jumps came from the stand-in font: the sector buttons wrapped to two lines at 768 px, and a column heading wrapped at 1440 px, until the real font arrived. They now stay on one line.

## Today's lead card
Pictures stay inside their column, with a 26 px gutter at 1024, 1280 and 1440 (they stack below 1024). The trend chart is capped at 9rem beside the pictures. Card height: 682 px at 1024, 602 at 1280, 727 at 1440. At 1440 the extra height comes from the three-line headline and the number, not the chart.
