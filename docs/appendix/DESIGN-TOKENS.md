# Appendix B: design tokens (contrast checked)

All text pairs below were calculated at WCAG contrast of at least 4.5:1 (most far higher). Kiro uses these as CSS variables in `ui/` and never invents new colours without checking contrast.

## Shared
- Base text 20 px; line height 1.5; headings 28 / 24 px; captions 24 px; minimum tap target 56 x 56 px; spacing scale 4, 8, 12, 16, 24, 32, 48 px; corner radius 12 px; focus ring 3 px `#1D4ED8` (6.7:1 on white), offset 2 px.
- Motion: only the receipt "prints" line by line (200 ms per line) and stamps appear; everything respects `prefers-reduced-motion` (no animation).
- Never use colour alone for meaning: every stamp has an icon and a word.

## Skin `care` (calm, card-based, single column)
| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| bg | #F5F8F7 | page | ink on bg 15.5 |
| surface | #FFFFFF | cards | |
| ink | #14211E | text | |
| inkSoft | #3F4F4B | secondary text | 8.6 on surface |
| accent | #0B6B5D | buttons, links | white on accent 6.4 |
| heard | #0A6B3A | Heard clearly stamp | 6.6 on white |
| check | #8A4B00 | Check this stamp | 6.8 on white |
| notSaid | #4A4F57 | Not said stamp | 8.2 on white |
| line | #C9D3CF | borders | |

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
System font stack (no web-font download so it works offline): `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Care uses weight 500 for body and 700 for headings. Cover uses tabular numbers (`font-variant-numeric: tabular-nums`) in tables.

## Distinctness rule
Care = soft cards, one column, generous spacing, stamps as pill badges. Cover = ruled ledger, columns per seller, dense rows with large text, amber markers. A reviewer must be able to tell the two apps apart from a screenshot with the logo hidden.
