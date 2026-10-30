Product plan · v1 · for Yog's Playground

# Chhaya.

छाया · “shadow, image” in Marathi

A camera booth on the web that shoots **film-look photos**, turns them into **ASCII art**, and prints them as **Polaroids and photo strips**. Everything runs on the phone or laptop. No sign-in, no uploads.

VSCO-quiet, Bloom Room styleCirka + Gilroy · 8px gridWeb app, mobile firstLives at /playground/chhayaOn-device processing\~40 film looks · 22 adjustments · 16 presets

[01Goals and scope](#goals) [02The flow](#flow) [03Screens](#screens) [04Visual design](#design) [05Film looks library](#looks) [06Adjustments](#adjust) [07Presets](#presets) [08Polaroid and frames](#frames) [09ASCII mode](#ascii) [10Micro-interactions](#motion) [11How it's built](#tech) [12Accessibility and privacy](#a11y) [13Build plan](#plan) [14Decisions for you](#questions)

01 · Goals and scope

## What Chhaya is for

Chhaya is a Playground project that shows taste and craft: a camera app that feels like a toy but edits like a pro tool. People open it, take a photo in five seconds, tap a film look, and leave with something they want to post.

### Goals

- **Instant fun:** camera to shareable photo in under 10 seconds, one tap per step.
- **Real editing depth:** pro-grade adjustments for people who want them, hidden until asked.
- **Three outputs from one photo:** film photo, ASCII art, Polaroid or strip.
- **Smooth everywhere:** 60fps live preview on a mid-range Android phone.
- **Private by design:** photos never leave the device.

### Not in v1

- Accounts, cloud gallery, social feed.
- Video recording (a short ASCII GIF loop is in, see ASCII mode).
- AI retouching or background removal.

02 · The flow

## Shoot, develop, print

Three steps, plus Studio, a gallery of everything you shot. Each step is one screen, and people can skip straight to export at any point.

Step 1 · Shoot**Camera**

Live viewfinder with the chosen look already applied. Pick Photo, Strip (4 shots) or ASCII. Tap the shutter for a 3-2-1 countdown, or upload a photo instead.

Step 2 · Develop**Edit**

Film looks first, then Adjust, ASCII and Frame tabs. Hold the photo to see the original. Undo, redo and reset everything with one tap.

Step 3 · Print**Export**

Save as PNG or JPG at full size, Polaroid, photo strip, ASCII as PNG, TXT or GIF. Share sheet on phones, copy to clipboard on desktop.

03 · Screens

## Six screens, VSCO-quiet

Monochrome UI, full-bleed photos, hairline sliders and tiny tracked labels, like VSCO. The difference is warmth: one pink dot marks what you changed, controls answer with small springy motion, and the Polaroid and ASCII screens add play. The mockups are live.

2

StripPhotoASCII

**Camera**Black, edge to edge, no labels on icons. The current look shows live; swipe the viewfinder to change it. A pink dot sits under the active mode.

Studio

AllEditedASCIIPrints

**Studio**Your shots in a tight 3-column grid with 2px gaps. A pink dot marks edited photos. Tap to edit, long-press to pick several.

Portra Glow

8.0

Aa

**Looks**Square thumbnails with short codes (K1, F3, T6). Tap once to apply, again for strength on a 0–12 hairline slider, like VSCO.

Exposure

+2.0

ExpoContrastGrainSatSkinVignette

**Tools**A row of thin line icons. Pick one and a hairline slider appears with a centre tick and the value. Edited tools get a pink dot.

‹ASCIICopy

MonoColourTermDuoBraille

96

**ASCII**Black like a terminal. Style chips, a hairline for detail (columns), and copy as text. Characters scramble into place when you switch in.

‹PrintSave

monsoon, 30 oct

600

SX-70

Mini

35mm

Strip

**Print**The playful one. The Polaroid slides out and develops from milky white; write a caption in Cirka, pick a frame, drag to tilt.

04 · Visual design

## VSCO's calm, in your Bloom Room style

Chhaya uses the same look as your **Bloom Room** interaction: Cirka for display moments, Gilroy for everything else, a warm off-white surface and soft ink, so it feels like part of your Playground. On top of that sits VSCO's quiet language: black and white UI, the photo full-bleed, thin line icons, hairline sliders, tiny uppercase labels and short filter codes. Chhaya adds what VSCO lacks: one pink dot as a signature, soft spring motion, Cirka captions on prints, and small surprises in Print and ASCII.

### What we keep from VSCO, and what we change

**Keep**

Monochrome UI so photos carry all the colour. Short look codes. Hairline sliders with a centre tick. Icon-only toolbars. A tight 3-column gallery. Very little text on screen.

**Make better**

Labels under tool icons so people know what they do. Before/after by holding the photo. Undo, redo and a visible edit history. A pink dot on anything changed. Bigger tap targets (44px) while keeping the thin look.

**Add play**

Springy thumbnails that lift when picked, a counting-down shutter, prints that slide out and develop, ASCII that scrambles in, light haptics on slider ticks.

**Avoid**

Colourful buttons, gradients, cards with shadows, emoji, loud onboarding. Nothing should compete with the photo.

Paper#F6F5F2 · Bloom background

Surface#FFFFFF · sheets, prints

Ink#141413 · text, icons, buttons

Ink 2#6E6C66 · secondary text

Chip#ECEAE4 · chips, tracks

Night#0F0F0E · camera, ASCII, dark

Pink dot#FF4F9A · "changed" and active only

### Name and wordmark

**Chhaya** (छाया) means "shadow" and "image" in Marathi. Photography is light and shadow, so the name describes what the app does, and it ties the project to your Marathi signature and Pune roots.

Chhaya*.*a film camera for moments

Chhaya*.*a film camera for moments

छ

- **Wordmark:** "Chhaya" in Cirka with the pink dot as the full stop, the same dot that marks edits inside the app.
- **App icon:** the Devanagari letter छ on Paper, or white on Night for the dark icon. Cirka has no Devanagari letters, so Marathi text uses **Tiro Devanagari Marathi** (free on Google Fonts), which matches Cirka's calm serif.
- **Tagline:** "a film camera for moments" (draft). Used under the wordmark and in the Playground card.
- **Spelling:** always "Chhaya" in English, छाया in Marathi. Never all caps, except in tiny labels.

### Type

Display · CirkaPortra Glow

UI · GilroyHold to compare · Saved

Labels · GilroyExposure · Contrast · Studio

Codes, valuesK1 · F3 · T6 · +2.0

- **Cirka** only for big, calm moments: screen titles, look names, the countdown numbers, Polaroid captions. Never for buttons or labels.
- **Gilroy** for all UI: 11px uppercase labels (600, +0.16em), 13–16px body (400–500), values with tabular numbers.
- Both fonts are self-hosted as woff2 in the repo (Cirka is already embedded in Bloom Room). Gilroy's file still needs adding; until then the fallback is SF Pro / system sans. This preview uses Plus Jakarta Sans as a stand-in, as your Taskstracker page does.

### Spacing: the 8px grid

Every size is a multiple of 8. A 4px half-step is allowed only for optical tweaks inside a component (icon to its label, a dot's offset), never between components.

| Token | Value | Used for |
| --- | --- | --- |
| space-1 | 8px | Icon to label, chip padding, gaps in a row of chips |
| space-2 | 16px | Screen side margins, gap between tools, slider padding |
| space-3 | 24px | Between groups (photo to looks row, looks row to slider) |
| space-4 | 32px | Bottom bar padding, sheet top padding |
| space-6 | 48px | Minimum tap target, toolbar height |
| space-8 | 64px | Shutter button, section spacing on desktop |
| radius | 8 / 16 / 24 / full | Thumbnails 8, sheets 24, chips and shutter full. Photos stay square-edged. |
| gallery gap | 2px | The one exception: the Studio grid uses 2px gaps so photos read as one wall, like VSCO. |

### Shapes and layout

- Photos are full-bleed with no radius; thumbnails 8px radius; the shutter and chips are round.
- All spacing on the 8px grid above; 1px hairlines for sliders and dividers.
- Icons: 1.4px stroke line icons at 20px, labels under them at 7–8px uppercase.
- Camera, ASCII and dark theme use Night (#0F0F0E); editing uses Paper by default and follows the device theme, exactly like Bloom Room.
- Desktop: photo in the centre on white, tools in a slim right column.

### Voice

As few words as possible, lowercase-calm: "developing…", "saved", "hold to compare", "no camera? upload a photo".

05 · Film looks library

## 40 film looks, grouped by camera family

Like VSCO, every look has a short code (K1 for the first Kodak-inspired look, F3 for the third Fujifilm-inspired one), shown under its thumbnail. Each look is a colour LUT plus tone curve, grain and halation settings, so it renders the same on every device. Looks are **inspired by** classic stocks and cameras. Shipping names are our own (brand names can be trademarks), with the inspiration shown as a small hint, for example *Golden Hour · inspired by Kodak Gold 200*.

| Code | Look | Inspired by | Character | Grain |
| --- | --- | --- | --- | --- |

06 · Adjustments

## 22 adjustments in six groups

Grouped the way photographers expect. Each slider shows its value, double-tap resets it, and an edited slider gets a small pink dot so people can see what they changed.

| Group | Adjustment | Range | Default | What it does |
| --- | --- | --- | --- | --- |

07 · Presets

## 16 one-tap presets

A preset is a look plus adjustments plus a frame, saved together. Tap to apply; tap again to tune. People can save their own from the current edit, stored on their device.

| Preset | Recipe | Good for |
| --- | --- | --- |

08 · Polaroid and frames

## Turn any photo into a print

**Instant 600**

Square photo, thick bottom border, slight off-white paper. Caption in Cirka.

**SX-70**

Narrower border, creamier tones, softer contrast baked into the frame.

**Mini and Wide**

Instax-style 54×86 and 99×62 proportions with rounded corners.

**Photo strip**

Four shots from Strip mode stacked on a long card with a date at the bottom.

**35mm film**

Black frame with sprocket holes, frame number and edge code like a scanned negative.

**Plain border**

White or black border, 0–20% thickness, any aspect ratio for posting.

### Extras

- **Date stamp:** orange seven-segment date in the corner, like a 90s point-and-shoot. On or off.
- **Develop animation:** the Polaroid fades in from milky white over 4 seconds. Shaking the phone speeds it up.
- **Paper texture and light leaks:** optional, with strength sliders.
- **Tilt:** drag the print to rotate it a few degrees before saving, as if placed on a table.

09 · ASCII mode

## ASCII settings

ASCII works live in the camera and as an edit on any photo. It reads the edited photo, so film looks and adjustments feed into it.

| Setting | Options | Default | Notes |
| --- | --- | --- | --- |

10 · Micro-interactions

## Small moments that make it feel alive

- **Shutter:** the white button squishes on press, the screen flashes white for 80ms, a soft click plays if sound is on.
- **Countdown:** big 3-2-1 numbers pop in and fade; the shutter ring fills in time.
- **Look change:** swiping the viewfinder slides the new look in with a wipe; the look name bounces in at the top.
- **Look thumbnails:** the selected one lifts 3px and its code gets a hairline underline.
- **Pink dot:** pops in with a tiny spring the moment a tool or photo is changed, and fades out on reset.
- **Sliders:** the thumb grows while dragging; a light haptic tick at zero and at the default.
- **Strip mode:** four little frames fill one by one at the bottom as shots are taken.
- **Polaroid:** slides out of the bottom like a print leaving the camera, then develops.
- **Save:** the button turns into a tick and the photo shrinks into the gallery thumbnail.
- **ASCII:** characters scramble briefly into place when switching to ASCII.

**Motion rules:** 150–500ms, one easing curve (fast out, soft settle), nothing loops except the live viewfinder. With reduced motion turned on, every animation becomes an instant change.

11 · How it's built

## One GPU pipeline for preview and export

The whole edit runs as a WebGL2 shader pipeline on the GPU, so the live preview and the saved photo use exactly the same code and look identical.

Camera / upload*→*Exposure, WB*→*Tone: contrast, highlights, shadows, curve*→*HSL, skin tone*→*Film LUT (3D, 33³)*→*Clarity, texture, sharpness*→*Split tone, fade*→*Halation, grain, vignette*→*ASCII (optional)*→*Frame

**Stack**

Next.js page inside your portfolio, React for the UI, raw WebGL2 shaders (no heavy library), Framer Motion for UI motion.

**Film looks**

Each look is a 33³ 3D LUT stored as a small PNG strip (\~100 KB), plus JSON for grain, halation and curve. Loaded on first use.

**Camera**

getUserMedia with front/back switch, 1080p preview. Full-resolution capture where the browser allows; otherwise the largest video frame.

**Performance**

Preview at screen size, export at full size. Target 60fps on a 2022 mid-range Android. Grain uses a pre-made noise texture, not per-pixel random.

**ASCII**

The edited frame is shrunk to the column count in a shader, then mapped to characters by brightness. Edge mode uses a Sobel pass to pick / \\ | \_ characters.

**Export**

PNG/JPG via canvas, ASCII as TXT and PNG, short ASCII GIF loop encoded in a Web Worker. Share sheet with fallback to download.

12 · Accessibility and privacy

## Usable by everyone, private by default

- Every control has a visible label or an accessible name; sliders work with arrow keys and show their value.
- Text meets 4.5:1 contrast. The 45% dimmed labels are for unselected items only, and the selected one is always full ink with an underline or dot, so state never depends on colour alone.
- Tiny labels are 11px minimum on the real app (smaller only in these mockups); tap targets are 44px even when icons look thin.
- Upload a photo as an alternative to the camera, for people without one or who don't want to use it.
- Reduced motion: no countdown animation, no develop fade, instant transitions.
- Photos are processed in the browser and never uploaded. Camera permission is asked only when tapping "Start camera", with a clear sentence about why.
- Saved presets live in the browser's local storage on that device only.

13 · Build plan

## Four phases

**Phase 1**

**Camera and core pipeline.** Camera, upload, shutter, countdown, the shader pipeline with exposure, contrast, saturation, grain, vignette. Save as PNG. 10 film looks.

**Phase 2**

**Full edit.** All 22 adjustments, HSL, split tone, before/after, undo/redo. All 40 looks and 16 presets. Saved custom presets.

**Phase 3**

**ASCII and frames.** Live ASCII with all settings, TXT/PNG/GIF export. Polaroid, strip, film frame, date stamp, develop animation.

**Phase 4**

**Polish.** Micro-interactions, sounds, haptics, desktop layout, performance pass on low-end phones, Playground card and case-study write-up.

14 · Decisions for you

## Things to decide before building

1. **Name:** decided: **Chhaya** (छाया, "shadow, image" in Marathi). Still to check: the domain and that no well-known app uses it.
2. **Look names:** our own names with "inspired by" hints (safer), or brand names directly?
3. **Where it lives:** inside your portfolio at /playground/chhaya, or its own site like asciibooth?
4. **Sound:** shutter click and develop sounds on by default, or off until turned on?
5. **First build:** start with Phase 1 as a working prototype, then add the rest?