#!/usr/bin/env bash
# Derives every logo asset (site, favicons, share card, Telegram avatar) from
# logo-source.jpg, the wax-seal emblem. Re-run after replacing the source.
#   tools/brand/build.sh
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
SRC="$HERE/logo-source.jpg"
OUT="$ROOT/assets/images/brand"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

# Seal centre and outer radius in the 1254×1254 source.
CX=624 CY=601 R=509

# Cut the seal off the parchment: the red wax plus a disc covering the inner
# scene, holes filled from outside, specks dropped, edge feathered.
magick "$SRC" -fx 'r-g > 0.22 ? 1 : 0' \
  \( -size 1254x1254 xc:black -fill white -draw "circle $CX,$CY $CX,$((CY + R))" \) \
  -compose Lighten -composite \
  -morphology Close Disk:6 -morphology Open Disk:4 \
  -fill red -draw 'color 0,0 floodfill' -fill white +opaque red -fill black -opaque red \
  -define connected-components:area-threshold=20000 -define connected-components:mean-color=true \
  -connected-components 4 -blur 0x1.5 -level 30%,100% "$TMP/mask.png"
magick "$SRC" "$TMP/mask.png" -alpha off -compose CopyOpacity -composite -compose over -trim +repage \
  -background none -gravity center -extent 1140x1140 "$TMP/seal.png"

# Opaque square on its parchment, for places that crop or can't do alpha.
magick "$SRC" -crop 1170x1170+39+16 +repage "$TMP/paper.png"

# Transparent seal: header, footer, 404, JSON-LD publisher logo.
magick "$TMP/seal.png" -strip -resize 256x256 PNG8:"$OUT/logo.png"
magick "$TMP/seal.png" -strip -resize 256x256 -quality 82 -define webp:method=6 "$OUT/logo.webp"

# Favicons and PWA icons. PNG8 (palette) keeps them a fraction of the size
# with no visible loss on a photo this busy.
magick "$TMP/seal.png" -strip \( -clone 0 -resize 16x16 \) \( -clone 0 -resize 32x32 \) \
  \( -clone 0 -resize 48x48 \) -delete 0 "$ROOT/favicon.ico"
magick "$TMP/seal.png" -strip -resize 192x192 PNG8:"$OUT/icon-192.png"
magick "$TMP/seal.png" -strip -resize 512x512 PNG8:"$OUT/icon-512.png"
magick "$TMP/paper.png" -strip -resize 180x180 "$ROOT/apple-touch-icon.png"

# Telegram avatar (circular crop, so the parchment version fills the corners).
magick "$TMP/paper.png" -strip -resize 640x640 -quality 88 "$ROOT/tools/telegram/avatar.jpg"

# Default share card (og:image / twitter:image), rendered in Chromium for the
# Persian type. Uses the poster tool's Playwright install.
cp "$TMP/seal.png" "$HERE/.seal.png"
trap 'rm -rf "$TMP" "$HERE/.seal.png"' EXIT
(cd "$ROOT/tools/instagram" && node --input-type=module -e "
import { chromium } from 'playwright';
const b = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto('file://$HERE/og.html');
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: '$TMP/og.png' });
await b.close();
")
magick "$TMP/og.png" -strip -quality 85 -sampling-factor 4:2:0 -interlace JPEG "$OUT/og.jpg"

ls -l "$OUT" "$ROOT/favicon.ico" "$ROOT/apple-touch-icon.png" "$ROOT/tools/telegram/avatar.jpg"
