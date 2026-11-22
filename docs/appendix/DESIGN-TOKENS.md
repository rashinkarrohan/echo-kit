# Appendix B: design tokens (contrast checked)

All text pairs below were calculated at WCAG contrast of at least 4.5:1 (most far higher). Kiro uses these as CSS variables in `ui/` and never invents new colours without checking contrast.

## Shared
- Base text 20 px; line height 1.5; headings 28 / 24 px; captions 24 px; minimum tap target 56 x 56 px; spacing scale 4, 8, 12, 16, 24, 32, 48 px; corner radius 12 px; focus ring 3 px `#1D4ED8` (6.7:1 on white), offset 2 px.
- Motion: only the receipt "prints" line by line (200 ms per line) and stamps appear; everything respects `prefers-reduced-motion` (no animation).
- Never use colour alone for meaning: every stamp has an icon and a word.

## Skin `care` (calm, card-based, single column; from the Echo Care design pack)
| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| bg | #F6F4EF | page | ink on bg 15.9 |
| surface | #FFFFFF | cards |  |
| ink | #101C1A | text |  |
| inkSoft | #44524E | secondary text | 8.2 on surface, 7.5 on bg |
| accent | #0A5C51 | buttons, links, active nav | white on accent 7.9 |
| heard | #0A5C51 | Heard clearly stamp | 7.9 on white |
| check | #6B3800 | Check this stamp | 9.6 on white |
| notSaid | #2B3A36 | Not said stamp | 11.9 on white |
| flagBg | #FFE08A | highlight behind flagged words | ink on flagBg 13.5 |
| line | #C9D3CF | borders |  |
Echo Care also uses these design-pack colours (see `apps/echo-care/src/design/`, all contrast-tested in `palette.test.ts`): teal 900 `#063F37` for the dark Please repeat screen and outline button text, border `#4F6B64` for small controls (5.3 on the page), danger `#8A1C1C` on `#FBE9E7` (7.9), amber `#6B3800` on `#FCEFD2` (8.4).
## Skin `cover` (ledger, table layout)
| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| bg | #F3F4F8 | page | ink on bg 16.1 |
| surface | #FFFFFF | table rows | |
| ink | #111827 | text | |
| inkSoft | #374151 | secondary text | 10.3 on surface |
| accent | #1F3A6E | buttons, headings | white on accent 11.1 |
| amber | #7A4A00 | Not discussed marker | 7.5 on white |
| line | #CBD0DC | table rules | |

## Typography

Cover uses the system font stack (no web-font download so it works offline): `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Care self-hosts Atkinson Hyperlegible Next (SIL OFL 1.1, from the `@fontsource-variable` package, no request to a third party) with the system stack as fallback; root weight 450 and 700 for headings. Cover uses weight 400 for body and 700 for headings. Cover uses tabular numbers (`font-variant-numeric: tabular-nums`) in tables.
## Distinctness rule
Care = soft cards, one column, generous spacing, stamps as pill badges. Cover = ruled ledger, columns per seller, dense rows with large text, amber markers. A reviewer must be able to tell the two apps apart from a screenshot with the logo hidden.
