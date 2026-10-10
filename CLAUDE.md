# CLAUDE.md

## Project: شیطان بزرگ — The Great Devil

Jekyll static site at **https://thegreatdevil.com** — documenting US interventions in Iran's internal affairs.

**GitHub repo:** https://github.com/aminsaedi/thegreatdevil  
**Local working dir:** /home/amin/w/thegreatdevil

## Structure

- `_events/*.md` — Event data files (one per historical event)
- `_layouts/default.html` — Main HTML template (Liquid)
- `assets/style.scss` — All styles (Sass, compiled by Jekyll)
- `index.html` — Homepage template that loops over `site.events`
- `_config.yml` — Jekyll configuration

## Adding Events

Create a new file in `_events/` with this front matter:

```yaml
---
title: "Event title in Farsi"
year: "Year display string"
order: 1                  # REQUIRED — display order within the era (chronological, unique per era_id)
era_id: era-XXXX          # Links to era section anchor
era_title: "Era title"
era_range: "Era subtitle"
era_label: "Short nav label"
category: military        # coup|sanction|military|cyber|diplo|intel
category_label: "فارسی label"
featured: false           # true = spans 2 rows in grid
image: "/assets/images/events/name.jpg"   # optional
image_caption: "فارسی caption shown over the hero"        # optional
image_credit: "Photographer / Agency"                     # REQUIRED with image
image_license: "CC BY 4.0"                                # REQUIRED with image
image_license_url: "https://creativecommons.org/licenses/by/4.0/"
image_source: "https://commons.wikimedia.org/wiki/File:..."
description: "One-sentence summary for cards and meta tags"
sources:                  # REQUIRED — cite a specific article URL, never a site homepage
  - title: "Source title"
    url: "https://example.com/article"
    publisher: "Publisher"
    year: 2026
    type: news            # news|official|academic|ngo|reference
    type_label: "فارسی label"
---
Event description in Farsi here.
```

`index.html` sorts events within each era by `order`, so every event file must have one.

## Images

Only use images that are public domain or Creative Commons licensed — no press-agency
photos (Reuters/AP/AFP). Wikimedia Commons is the practical source; verify the license via
the Commons API rather than trusting the file page, and record `image_credit`,
`image_license` and `image_source` in front matter. CC BY / CC BY-SA **require** visible
attribution, which `_layouts/event.html` renders as a `<figcaption>` over the hero.

Do not crop out embedded agency watermarks — they carry the attribution the licence requires.

Optimize before committing (roughly what the existing files use):

```bash
magick in.jpg -auto-orient -strip -resize '1000>' -quality 80 \
  -sampling-factor 4:2:0 -interlace JPEG assets/images/events/name.jpg
magick in.jpg -auto-orient -strip -resize '1000>' -quality 72 \
  -define webp:method=6 assets/images/events/name.webp
```

Use `1400>` for `featured: true` events (rendered as a wide banner), `1000>` otherwise.
Both a `.jpg` and a matching `.webp` are required — the templates emit a `<picture>` with
the WebP as the preferred source and the JPEG as fallback.

## Logo

The logo is the wax-seal emblem in `tools/brand/logo-source.jpg`. `tools/brand/build.sh`
derives every variant from it: `assets/images/brand/` (transparent `logo.webp`/`logo.png`
for the header, footer and JSON-LD; PWA icons; the default share card `og.jpg`),
`/favicon.ico`, `/apple-touch-icon.png` and `tools/telegram/avatar.jpg`. The posters use
`logo.png` as their brand mark. To change the logo, replace the source and re-run the
script — don't edit the outputs by hand.

## Build & Deploy

GitHub Actions workflow at `.github/workflows/deploy.yml` builds with Jekyll and deploys to GitHub Pages on every push to `main`.

## Local Development

```bash
bundle install
bundle exec jekyll serve
```

## Social: posters & Telegram channel

- `tools/instagram/` renders a quality-gated 1080×1350 poster plus Instagram and
  Telegram captions per event (`node build.mjs`; see its README). The deploy
  publishes passing posters and `/posters/manifest.json`.
- Telegram channel **@thegreatdevil_com** (`telegram_channel` in `_config.yml`).
  An n8n workflow posts the next unposted event from that manifest on its
  schedule trigger (configured only in n8n — keep posting times out of the
  repo, the site and the channel). Ops, IDs and the "post now" webhook: `tools/telegram/README.md`.
- A new event needs nothing extra: if its poster passes the gates, it joins the
  manifest and is posted in timeline order.
