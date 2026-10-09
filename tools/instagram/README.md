# Social posters (Instagram + Telegram)

Renders a 1080×1350 (4:5) poster, an Instagram caption and a Telegram caption
for every event in `_events/`, then runs quality gates on each. A poster is
ready to post only when all of its gates pass.

```bash
cd tools/instagram
npm install
node build.mjs                  # all events
node build.mjs 1901-darcy 2026  # events whose slug starts with these
node build.mjs --sheet          # also out/contact-sheet.jpg — the profile grid preview
node build.mjs --publish DIR    # copy passing posters + manifest.json into DIR
```

The deploy workflow runs `--publish _site/posters`, so every passing poster is
live at `https://thegreatdevil.com/posters/<slug>.jpg`, listed in timeline
order in `/posters/manifest.json` together with its Telegram caption. The n8n
workflow that posts to the Telegram channel reads that manifest (see
`tools/telegram/README.md`). A poster that fails a gate is left out of the
manifest, so it is never posted, and it doesn't block the deploy.

Output per event, in `out/<slug>/`:

- `poster.jpg` — upload this
- `caption.txt` — paste as the Instagram caption
- `telegram.html` — the Telegram channel caption (HTML, clickable link, ≤1024 chars)
- `qa.json` — every gate with its measurement

It uses Playwright's Chromium if installed (`npx playwright install chromium`),
otherwise the system Chrome.

## Layouts

- **Typographic** (`type`) — a giant year, a category stamp, the title and the summary.
- **Evidence print** (`photo`) — used when the event has an image with a recorded
  `image_credit` and `image_license`. The photo is a framed print with the date
  and stamp on its paper strip, and the credit goes in the footer. An image
  without a recorded licence falls back to the typographic layout, as the site's
  image rules require.

All text comes from the event's front matter. The framework writes no copy of
its own beyond the fixed brand, CTA and caption labels.

## Gates

| Gate | Checks |
|---|---|
| `content.fields` / `content.sources` | Title, year, category and description are present; at least one source cites a specific page |
| `content.persian-digits` | No ASCII digits in Farsi text (digits inside Latin tokens like IR655 are fine) |
| `layout.size` / `layout.fonts` | Exactly 1080×1350; Vazirmatn actually loaded |
| `fit.*` / `type.*` | Each text block fits its line budget at or above its minimum size |
| `safe.*` | No text within 64px of an edge (the profile grid crops 4:5 posts to 3:4) |
| `layout.no-overlap` / `layout.breathing` | No two text blocks touch; at least 30px between masthead, copy and footer |
| `contrast.*` | 10th-percentile contrast against the pixels actually behind the text: 4.5:1, or 3:1 for large text |
| `photo.resolution` / `photo.presence` | The photo is upscaled at most 1.35× and is at least 340px tall |
| `caption.*` | At most 2,200 characters and 5 hashtags, with the hook in the first 125 characters, the event URL and the sources |
| `telegram.caption` | At most 1,024 visible characters (Telegram's photo-caption limit) and links to the event page |
| `output.filesize` | Under Instagram's 8 MB limit |

Copy is fitted automatically: each block shrinks toward its minimum, and if the
whole poster is still too tall the year gives up size first, then the title,
then the summary. Anything that still doesn't fit fails a gate rather than
shipping clipped.
