# CLAUDE.md

## Project: Iran-US History Timeline

Jekyll static site documenting US interventions in Iran's internal affairs.

## Structure

- `_events/*.md` — Event data files (one per historical event)
- `_layouts/default.html` — Main HTML template (Liquid)
- `assets/style.css` — All CSS styles
- `index.html` — Homepage template that loops over `site.events`
- `_config.yml` — Jekyll configuration

## Adding Events

Create a new file in `_events/` with this front matter:

```yaml
---
title: "Event title in Farsi"
year: "Year display string"
era_id: era-XXXX          # Links to era section anchor
era_title: "Era title"
era_range: "Era subtitle"
era_label: "Short nav label"
category: military        # coup|sanction|military|cyber|diplo|intel
category_label: "فارسی label"
featured: false           # true = spans 2 rows in grid
image: "https://..."      # optional
---
Event description in Farsi here.
```

## Build & Deploy

GitHub Actions workflow at `.github/workflows/deploy.yml` builds with Jekyll and deploys to GitHub Pages on every push to `main`.

## Local Development

```bash
bundle install
bundle exec jekyll serve
```
