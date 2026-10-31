# Changelog

## Saving works on every device

- **Save sheet:** after a photo develops, a sheet shows the photo with buttons that work because they are tapped directly. Before, the share sheet or download started seconds after the tap, so iPhones and some Android phones refused it.
  - iPhone/iPad: Save to Photos (share sheet) or Save to Files.
  - Android: Download (Downloads and Gallery) or Share.
  - Mac/Windows: downloads at once; Download again, Copy image, and Share where supported.
- **In-app browsers** (Instagram, WhatsApp, Facebook, Snapchat, TikTok…): a hint to press and hold the photo or open the page in Safari/Chrome. The preview uses a data URL so press-and-hold saving works there.
- **Downloads no longer cut off:** the file link stays valid for a minute instead of 2 seconds.
- **Memory fallback:** if a phone can't make a full-size image, it retries at 2048px, then half size, instead of failing.

## Camera tools, grids and sharper saves

- **Camera toolbar:**
  - **Grid:** 12 photo-booth layouts (2, 3, 4 and 6 shots).
  - **Filter:** looks by family.
  - **Light:** a screen ring light with 15 colours, a custom colour and brightness. The flash takes the light's colour.
  - **Timer:** Off, 3s, 5s or 10s.
- **Print:** all 12 grids, plus the existing frames.
- **Sharper saves:** exports are at least 3000px on the long side. Frames use high-quality scaling, and photo mode takes a full-resolution still where the browser allows (Chrome on Android and desktop).
- **New switch-camera icon** and a छ favicon (`favicon.ico`).

## Filters and presets from the repo guide

### Added

- **85 new looks**, written as JSON recipes (`src/chhaya/data/recipe-looks.json`) and baked into the same 33³ LUT as the original 40, so they also work live in the camera. 125 looks in total.
  - Instagram style (I1–I41): 1977, Aden, Amaro, Ashby, Brannan, Brooklyn, Charmes, Clarendon, Crema, Dogpatch, Earlybird, Gingham, Ginza, Hefe, Helena, Hudson, Inkwell, Juno, Kelvin, Lark, Lo-Fi, Ludwig, Maven, Mayfair, Moon, Nashville, Perpetua, Poprocket, Reyes, Rise, Sierra, Skyline, Slumber, Stinson, Sutro, Toaster, Valencia, Vesper, Walden, Willow, X-Pro II.
  - Vintage (V1–V13): Faded Film, Sepia Print, Cross Process, Bleach Bypass, Warm 70s, Cool 90s, Expired Film, Cream Instant, Square Instant, New Instant, Autumn Roll, Golden Sunset, City Heat.
  - Film (L1–L7): Portrait 400, Vivid 100, Consumer Gold, Slide 50, Slide 100, Soft Slide, Everyday 400.
  - Black and white (B1–B7): Press 400, Silver 100, Street 400, Night 3200, Fine 50, Blue Mood, Envy.
  - Cinematic (M1–M10): Teal & Orange, Blockbuster, Code Green, Desert Orange, Amber Haze, Moonlight, Stairwell, Pastel Symmetry, Hero, Night Steel.
  - Soft (A1–A7): Calm, Romantic, Spring, Nordic, Melancholy, Soft Gingham, Soft Slumber.
- **85 new presets** (101 in total), stored as data in `src/chhaya/data/presets.json`. Each has a name, category, default intensity and a preview thumbnail rendered from your photo. The original 16 moved into the same file unchanged.
- **Preset categories**: Vintage, Film, Instagram style, Cinematic, Black and white, Soft, plus Favourites and Mine.
- **Intensity slider** (0–100) for presets, blending from your edit to the full preset.
- **Favourites**: tap ★ on a preset; saved on this device.
- **LUT import**: `.cube` (any size) and HaldCLUT `.png`, from the Looks tab. They're resampled to 33³, saved on this device, and also listed as presets under Mine.
- **Dust**: a new finishing effect in Adjust → Film (sparse specks and fine scratches).

### Not added

- Building a preset from a before/after photo pair (preset-from-pair). It needs a two-photo picker and a fitting step; better as its own feature.
- G'MIC CLUT packs: licenses vary per pack and the site isn't reachable from the build environment. Use LUT import instead.
- Core Image photo effects (cifilter.app): Apple doesn't publish their numeric values.
- iOS-Image-Filters cross process, magic hour and toy camera: they depend on bundled texture images.
