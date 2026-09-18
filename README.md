# BITFIELD

A binary field studio in the browser. Draw posters out of 1s and 0s: shapes
and text are rasterized into a seeded grid of digits, bold ink inside the
shapes, faint ink everywhere else. The technique comes from a printed A3 sign
where a USB trident was picked out of a field of binary.

Live at https://chuatzeyee.github.io/bitfield/

![The editor with the default USB trident preset](docs/screenshot.png)

## Presets

Each preset shows a different layer mode in action: bits (bold digits fill
the shape), punch (the shape cuts a hole), and solid (plain shapes on top).

| usb trident (bits) | heart (bits) |
| --- | --- |
| ![USB trident preset](docs/preset-usb-trident.png) | ![Heart preset](docs/preset-heart.png) |
| **smiley (punch eyes and mouth)** | **headline (bits text plus solid caption)** |
| ![Smiley preset](docs/preset-smiley.png) | ![Headline preset](docs/preset-headline.png) |

## Patterns

Patterns shape the density of the faint background field:

![All eight field patterns](docs/patterns.png)

Previews regenerate from `docs/capture.html` (serve the repo, then screenshot
`docs/capture.html?preset=NAME` for a preset or `docs/capture.html` for the
pattern montage).

## What it does

- **Layers**: rectangles, ellipses, lines, triangles, and text, stacked in
  any order. Reorder, hide, rename, recolor, delete.
- **Three layer modes**:
  - `bits`: the shape is filled with bold digits in the layer color
  - `punch`: the shape cuts a hole in the field
  - `solid`: the shape is drawn plainly on top of the field
- **Field parameters**: canvas size, cell size, random seed, charset,
  density, background and faint ink colors, and the font.
- **Bit sources**: pure random, a threshold pattern, or a hidden message,
  where the field spells out your text in 8 bit ASCII, over and over.
- **Patterns**: gradients, waves, rings, vortex, checker, scanlines. They
  shape the density of the faint field, or drive the 0s and 1s directly.
- **Presets**: USB trident, heart, smiley, headline, blank.
- **Editing**: drag layers on the canvas, nudge with arrow keys, undo and
  redo with ctrl+z and ctrl+shift+z.
- **Export**: PNG at 1x to 4x, real vector SVG (each digit is a text glyph,
  editable afterward), and the whole document as JSON to save and load.

## Running locally

It is a static page with ES modules, so serve it over HTTP:

```
python3 -m http.server 8000
```

then open http://localhost:8000/. No build step, no dependencies.

## Fonts

- **Canela** ships locally in `fonts/` (weights 100, 400, 500, 700, 900) and
  is the default field and heading font. It is a licensed typeface included
  under the repository owner's license; do not reuse it outside this project.
  Exported SVGs fall back to Fraunces on machines without Canela installed.
- **Fraunces** and **JetBrains Mono** load from Google Fonts under the SIL
  Open Font License.

## Server-rendered API

`api/bitfield.js` is a Vercel serverless function that renders a headline
straight to PNG, for embedding wherever you can't run JS (dashboards, Power
Apps' Image control, Slack unfurls, etc). It calls the real `renderCanvas`
from `js/engine.js` headlessly via `@napi-rs/canvas`, so the output matches
the editor exactly.

Live at `https://bitfield-five.vercel.app/api/bitfield?text=YOUR TEXT`

Query params, all optional:

| param              | default   | meaning                                                           |
| ------------------ | --------- | ------------------------------------------------------------------ |
| `text`             | (none)    | headline picked out in bold digits; omit for field only            |
| `pattern`          | `waves`   | `random`, `gradient down`, `gradient right`, `waves`, `rings`, `vortex`, `checker`, `scanlines` |
| `density`          | `0.55`    | 0-1, faint field coverage                                          |
| `cell`             | `16`      | grid cell size in px                                                |
| `seed`             | `KIOSK`   | RNG seed                                                            |
| `bg` / `faint` / `ink` | `0a0f14` / `1f6f5c` / `eafff5` | hex colors, no `#`                    |
| `width` / `height` | `1920` / `1080` | output size in px                                          |

Deploy your own copy: `npm install`, then `vercel --prod` from the repo root
(zero config, `api/` is picked up automatically).

## Layout

```
index.html      page shell
style.css       editorial paper theme
fonts/          local Canela ttfs
js/engine.js    seeded RNG, patterns, mask rasterizer, canvas renderer
js/app.js       state, undo, panels, canvas interaction
js/export.js    PNG, SVG, and JSON export
js/presets.js   starting documents
api/bitfield.js server-rendered PNG endpoint (see above)
```

## License

MIT for the code. Canela is licensed separately, see Fonts above. Google
Fonts families are under the SIL Open Font License.
