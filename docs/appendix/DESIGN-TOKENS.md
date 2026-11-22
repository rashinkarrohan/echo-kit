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
## Skin `cover` (calm, card-based, blue; from the Echo Cover design pack)
| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| bg | #F3F6FC | page | ink on bg 16.0 |
| surface | #FFFFFF | cards | |
| ink | #0F1A33 | text | |
| inkSoft | #44506A | secondary text | 8.1 on surface, 7.5 on bg |
| accent | #1A4FBA | buttons, links, active nav, logo | white on accent 7.3 |
| heard | #0F2F7A | Said chip text (navy on #E3EDFF) | 12.3 on white, 10.4 on #E3EDFF |
| check | #6B3800 | Check this chip (on #FCEFD2) | 9.6 on white, 8.4 on #FCEFD2 |
| notSaid, missing | #26324D | Not said, Not discussed chip (on #EBEFF7) | 12.8 on white, 11.1 on #EBEFF7 |
| flagBg | #FFE08A | money, percentage, time and commission words | ink on flagBg 13.4 |
| line | #DCE3F1 | dividers | |
Echo Cover also uses these design-pack colours (see `apps/echo-cover/src/design/`, all contrast-tested in `palette.test.ts`): primary button gradient `#2A62D6` to `#1A4FBA` (white on `#2A62D6` is 5.5), hero gradient `#1A4FBA` to `#0F2F7A` with `#E3EDFF` text (6.2 and 10.4), border `#4A5B7A` for outline pills (6.3 on the page), soft border `#6F7C97` for chips and switches (3.6 on `#EBEFF7`), danger `#8A1C1C` on `#FBE9E7` (7.9).
## Typography

Both apps self-host Atkinson Hyperlegible Next (SIL OFL 1.1, from the `@fontsource-variable` package, no request to a third party) with the system stack as fallback; root weight 450 and 700 for headings (the system stack is the fallback).
## Distinctness rule
Care = teal on warm white, one column, doctor card and a dark Please repeat screen, stamps as pill chips. Cover = blue on cool white, a hero ledger, a column per seller side by side, Said and Not said chips with a blue or grey edge, amber markers. A reviewer must be able to tell the two apps apart from a screenshot with the logo hidden.
