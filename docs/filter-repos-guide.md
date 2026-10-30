# Filter Repos Guide

Reference list of open source repos to pull filters, presets and features from, for adding to our existing photo filter tool. The tool is already built. The goal is only to add more and better filters and presets.

## Repos

| Repo | What to take | License note |
| --- | --- | --- |
| https://github.com/picturepan2/instagram.css | Instagram style filter recipes (CSS filter and blend mode combos) | MIT, safe to reuse |
| https://github.com/GregoryNative/react-native-gl-image-filters | Preset values (Amaro, Clarendon, Dogpatch, Gingham, Ginza, Hefe, Ludwig, Skyline, Slumber, Sierra, Stinson) and the createPreset idea | Check repo license |
| https://github.com/mgrl/pilgram2 | 39 Instagram filters (1977, Aden, Brannan, Brooklyn, Toaster, Valencia, Walden, Willow, Xpro2 and more), blend mode logic | Check repo license |
| https://github.com/jwagner/analog-film-emulator | Idea only: film stock look via LUT, plus grain and vignette sliders | NOT open licensed, do not copy code or data |
| https://github.com/jameswomack/iOS-Image-Filters | Vintage overlay and Camera+ style effect ideas (iOS) | Old code, use as reference only |
| https://github.com/noahsark769/cifilter.app | Core Image filter names and parameters, for building iOS presets | Check repo license |
| https://github.com/stacylkv/preset-from-pair | Method to build a LUT from a before and after photo pair | MIT |
| https://www.gmic.eu/color_presets/ | 1100+ free CLUTs (.cube or HaldCLUT PNG), including film looks | Check license per pack before shipping |
| https://pub.dev/packages/color_filter_extension | 90+ presets: film emulation, cinema looks, artistic effects | MIT |

## What to add to our tool

1. Vintage and film presets: faded film, Polaroid, sepia, cross process, bleach bypass, warm 70s, cool 90s, expired film.
2. Instagram style presets: Clarendon, Gingham, Juno, Lark, Valencia, Toaster, Walden, 1977, Xpro2 and similar.
3. LUT support: load .cube or HaldCLUT PNG files as presets, so new looks are just data files.
4. Finishing effects: film grain, vignette, light leak, dust, halation, date stamp, fade.
5. Preset controls: intensity slider (0 to 100), before and after compare, favorites, categories.
6. Preset format: every preset stored as JSON data, never hardcoded, so adding one means adding one entry.

## Rules for adding

1. Read our existing tool code first. Follow its structure, naming and preset format. Do not rewrite or restructure it.
2. Take only what helps: new filter values, new LUTs, new finishing effects, and small features that fit our UI.
3. Do not copy code from repos without an open license. Re-implement the idea in our own code, or use only the numeric values and ideas.
4. For permissive licenses (MIT), keep attribution in a CREDITS.md file with repo name, link and license.
5. Do not add heavy dependencies. Prefer plain values, LUT files and small helper functions.
6. Group presets into categories: Vintage, Film, Instagram style, Cinematic, Black and White, Soft.
7. Every new preset needs a name, category, parameters (or LUT file), default intensity and a preview thumbnail.
8. Keep performance in mind. Previews should stay real time, so downscale for thumbnails.
9. Test every new preset on at least 3 sample photos (portrait, landscape, low light).

## Suggested steps

1. Inspect our tool and list how presets are currently defined.
2. Fetch each repo above and note usable filters and values.
3. Convert them into our preset format.
4. Add the new categories and presets to the UI.
5. Add grain, vignette and light leak as optional finishing layers if missing.
6. Add LUT import if missing.
7. Write CREDITS.md and a short changelog of what was added.

## Prompt to use with this file

```
Read filter-repos-guide.md. Our photo filter tool is already built, so do not rebuild it. Inspect our current code and the way presets are defined. Then go through each repo in the guide, take only what improves our project (new filters, vintage and film presets, Instagram style presets, LUT support, grain, vignette, light leak, intensity slider, preset categories), and add them in our existing preset format. Follow the rules in the file, especially licenses: do not copy code from repos without an open license, use ideas and numeric values only. Add CREDITS.md for anything reused. When done, give me a short list of the presets and features you added and anything you skipped and why.
```
