# Chhaya.

छाया · "shadow, image" in Marathi. *A film camera for moments.*

A camera booth on the web that shoots film-look photos, turns them into ASCII art, and prints them as Polaroids and photo strips. Everything runs on the phone or laptop. No sign-in, no uploads.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The camera needs `localhost` or HTTPS.

## Status: Phase 1 (camera and core pipeline)

- **Shoot:** live viewfinder with the chosen look applied, swipe (or ← →) to change looks, 3-2-1 countdown (toggle), white flash, front/back switch, upload or drag and drop a photo instead. The camera is only requested after tapping "start camera".
- **Develop:** 10 film looks with strength 0–12 (tap a look twice), Exposure, Contrast, Saturation, Grain and Vignette on hairline sliders (double-tap to reset), pink dot on anything changed, hold the photo (or `\`) to compare, undo/redo (⌘Z / ⇧⌘Z) and reset.
- **Save:** full-size PNG or JPG through the same GPU pipeline as the preview. Share sheet on phones, download on desktop.
- **Layout:** mobile first; on desktop the photo sits in the centre with tools in a slim right column. Follows the device's light/dark setting.

Next, Phase 2 adds all 22 adjustments, all 40 looks and the 16 presets. Phase 3 adds ASCII and frames, and Phase 4 is polish (see the plan).

## How it's built

- Next.js 16 + React 19, no UI libraries.
- `src/chhaya/gl/` is a raw WebGL2 shader pipeline: exposure → contrast → saturation → film LUT → grain → vignette. The viewfinder, preview, thumbnails and export all use it, so they look identical.
- `src/chhaya/looks.ts`: each look is a small set of colour parameters baked into a 33³ 3D LUT on first use. Hand-graded LUT PNGs can replace the baked ones later without changes to the pipeline.
- `src/chhaya/edit.ts`: an edit is plain data (look, strength and tool values), which makes undo, presets and saving easy.
- Grain samples a pre-made noise texture and scales with output size, so the saved photo matches the preview.

## Fonts

The design calls for **Cirka** (display) and **Gilroy** (UI). Until their woff2 files are in `public/fonts` (see `src/app/globals.css`), the app uses Instrument Serif and Plus Jakarta Sans as stand-ins, with Tiro Devanagari Marathi for छ. All three are self-hosted at build time by `next/font`.

## Open decisions (from the plan)

1. Look names: our own names with "inspired by" hints (used now), or brand names?
2. Where it lives: `/playground/chhaya` in the portfolio, or its own site? The app is in `src/chhaya/`, so it can move into the portfolio as one folder.
3. Sound: on or off by default? (No sounds yet.)
