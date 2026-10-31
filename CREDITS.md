# Credits

Chhaya's code is our own. Some looks and presets use numeric values and ideas
from the open source projects below. No code was copied from any of them: the
colour maths in `src/chhaya/recipes.ts` is our own implementation, following
the public W3C specs (Filter Effects for `sepia`, `saturate`, `hue-rotate`,
`contrast`, `brightness`; Compositing and Blending for the blend modes).

## Values reused

| Project | License | What we used | Where |
| --- | --- | --- | --- |
| [instagram.css](https://github.com/picturepan2/instagram.css) by Yan Zhu | MIT | Filter recipes (CSS filter chains and overlay colour/blend) for the 41 Instagram-style looks I1–I41. Radial and linear gradient overlays are approximated with a flat overlay plus our vignette. | `src/chhaya/data/recipe-looks.json` |
| [color_filter_extension](https://pub.dev/packages/color_filter_extension) by Dipendra Sharma | MIT | Colour-matrix recipes for the film stock, black-and-white, cinematic, instant and mood looks (V8–V13, L1–L7, B1–B5, M1–M10, A1–A5). Renamed: film-stock, movie and brand names are given as "inspired by" hints only. | `src/chhaya/data/recipe-looks.json` |
| [react-native-gl-image-filters](https://github.com/GregoryNative/react-native-gl-image-filters) by Gregory Galushka | MIT | The gentle Gingham and Slumber values (A6 Soft Gingham, A7 Soft Slumber), and the idea of presets as plain data (`createPreset`). | `src/chhaya/data/recipe-looks.json`, `src/chhaya/data/presets.json` |
| [iOS-Image-Filters](https://github.com/jameswomack/iOS-Image-Filters) by James Womack | MIT | The false-colour toning idea behind B6 Blue Mood and B7 Envy. Colours are our own. | `src/chhaya/data/recipe-looks.json` |

## Icons

| Project | License | What we use | Where |
| --- | --- | --- | --- |
| [Lucide](https://lucide.dev) | ISC | All interface icons (55), as the original SVG files. The license is kept beside them. | `src/chhaya/icons/lucide/`, generated into `src/chhaya/icons/icons.generated.ts` |

## Ideas only (no code or data)

| Project | License | Idea |
| --- | --- | --- |
| [pilgram2](https://github.com/mgrl/pilgram2) | Apache-2.0 | Confirmed how CSSgram-style filters combine filter chains with blend-mode overlays. Same filter set as instagram.css, so nothing extra was taken. |
| [analog-film-emulator](https://github.com/jwagner/analog-film-emulator) by Jonas Wagner | Not open source | Film looks as colour lookup tables, plus grain and vignette sliders. We already had these; it informed adding HaldCLUT import. |
| [preset-from-pair](https://github.com/stacylkv/preset-from-pair) | MIT | Building a LUT from a before/after photo pair. Not added yet (see CHANGELOG). |
| [cifilter.app](https://github.com/noahsark769/cifilter.app) | MIT | Reference for Core Image effect names (sepia tone, false colour, photo effects). |

## LUT files

Chhaya ships no third-party LUT files. You can import your own `.cube` or
HaldCLUT `.png` files from the Looks tab; they stay on your device. If you
use packs such as the G'MIC colour presets, check each pack's license first.

## Fonts

Instrument Serif, Plus Jakarta Sans, Tiro Devanagari Marathi, JetBrains Mono,
IBM Plex Mono and VT323 are served through `next/font` under the SIL Open Font
License.
