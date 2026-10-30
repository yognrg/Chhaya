# Chhaya.

छाया · "shadow, image" in Marathi. *A film camera for moments.*

A camera booth on the web that shoots film-look photos, turns them into ASCII art, and prints them as Polaroids and photo strips. Everything runs on the phone or laptop. No sign-in, no uploads.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The camera needs `localhost` or HTTPS.

## What's in it

- **Camera:** Photo, Strip (4 shots, booth style) and live ASCII modes. Looks apply live; swipe to change. Countdown, flash, front/back camera, upload or drag and drop.
- **Presets:** the 16 from the plan, plus "Save" to keep your own (stored on this device only).
- **Looks:** all 40 film looks (K, F, S, P, C, N, T families) with strength 0–12.
- **Adjust:** 22 tools in six groups. Light: exposure, contrast, highlights, shadows, whites/blacks. Colour: temperature, tint, saturation, vibrance, skin tone, HSL (8 colours), split tone. Detail: clarity, texture, sharpness, dehaze. Film: grain (amount, size, roughness), fade, halation, light leak (4 styles). Effects: vignette (amount, midpoint), blur/tilt-shift. Crop: 8 aspect ratios, rotate, flip, straighten.
- **ASCII:** 8 character sets (standard, dense, blocks, braille, binary, matrix, moons, custom), 40–240 columns, 7 colour styles (incl. duotone, terminal, amber), brightness/contrast/gamma, edge lines, 4 dithering modes (ordered, Floyd–Steinberg, Atkinson), invert, 4 fonts, background (black, paper, transparent, custom), CRT glow. Export PNG, TXT, HTML or copy the text.
- **Print:** Instant 600, SX-70, Mini, Wide, photo strip, 35mm film and plain border, with Cirka-style caption, orange date stamp, paper texture and a develop-from-white animation.
- Hold the photo to compare, undo/redo, full-size export through the same pipeline as the preview.

Still to come: tone curve editor, ASCII GIF loop, Studio gallery, sounds and haptics polish.

## How it's built

- Next.js 16 + React 19, no UI libraries.
- `src/chhaya/gl/` is a raw WebGL2 shader pipeline, one pass: geometry → detail → white balance and exposure → tone → colour and HSL → film LUT → split tone → fade → halation → leak → grain → vignette. Blurs read the source's mipmaps, so it stays live on phones.
- `ascii.ts` turns the graded frame into characters; `frames.ts` lays out the prints; `finish.ts` chains them. The viewfinder, preview, thumbnails and export all use it, so they look identical.
- `src/chhaya/looks.ts`: each look is a small set of colour parameters baked into a 33³ 3D LUT on first use. Hand-graded LUT PNGs can replace the baked ones later without changes to the pipeline.
- `src/chhaya/edit.ts`: an edit is plain data (look, strength and tool values), which makes undo, presets and saving easy.
- Grain samples a pre-made noise texture and scales with output size, so the saved photo matches the preview.

## Fonts

The design calls for **Cirka** (display) and **Gilroy** (UI). Until their woff2 files are in `public/fonts` (see `src/app/globals.css`), the app uses Instrument Serif and Plus Jakarta Sans as stand-ins, with Tiro Devanagari Marathi for छ. All three are self-hosted at build time by `next/font`.

## Open decisions (from the plan)

1. Look names: our own names with "inspired by" hints (used now), or brand names?
2. Where it lives: `/playground/chhaya` in the portfolio, or its own site? The app is in `src/chhaya/`, so it can move into the portfolio as one folder.
3. Sound: on or off by default? (No sounds yet.)
