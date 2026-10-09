// Quality gates. Each returns { id, ok, detail }; a poster ships only when
// every gate passes. Layout gates measure the rendered page, not the CSS, so
// they catch what a reviewer would see: clipped lines, text over a bright
// patch of photo, a caption Instagram would truncate.

export const W = 1080;
export const H = 1350;
// Instagram's profile grid shows a 3:4 centre crop of a 4:5 post, trimming
// ~34px off each side; 64px leaves room for that plus breathing space.
const SAFE = 64;
const MAX_UPSCALE = 1.35;
const MIN_PHOTO_H = 340;
const MIN_GAP = 30;
const MAX_BYTES = 8 * 1024 * 1024;
const CAPTION_MAX = 2200;
const HASHTAG_MAX = 5;

const gate = (id, ok, detail = '') => ({ id, ok: Boolean(ok), detail });

// ── Content gates (before rendering) ───────────────────────────────────────
export function contentGates(ev) {
  const out = [];
  const missing = ['title', 'year', 'category', 'category_label', 'description']
    .filter((k) => !ev[k]);
  out.push(gate('content.fields', !missing.length, missing.length ? `missing: ${missing.join(', ')}` : ''));

  const specific = (ev.sources || []).filter((s) => {
    try { return new URL(s.url).pathname.replace(/\/$/, '') !== ''; } catch { return false; }
  });
  out.push(gate('content.sources', specific.length > 0,
    `${specific.length}/${(ev.sources || []).length} sources cite a specific page`));

  // Latin digits are fine inside Latin tokens (IR655, F-14) but not in Farsi prose.
  const stray = [ev.title, ev.year, ev.description, ev.category_label]
    .flatMap((t) => String(t).match(/(?<![A-Za-z0-9-])[0-9]+(?![A-Za-z0-9])/g) || []);
  out.push(gate('content.persian-digits', !stray.length, stray.length ? `ASCII digits: ${stray.join(' ')}` : ''));

  if (ev.photo && !ev.photo.licensed) {
    out.push(gate('content.photo-licence', true, 'photo has no recorded licence — using typographic layout'));
  }
  if (ev.photo?.licensed) {
    out.push(gate('content.photo-file', ev.photo.exists, ev.photo.file));
  }
  return out;
}

// ── Layout gates (in the page) ─────────────────────────────────────────────
// Runs inside the browser; returns raw measurements for layoutGates().
export function measureInPage() {
  const poster = document.getElementById('poster');
  const origin = poster.getBoundingClientRect();
  const rel = (r) => ({ x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height });
  // Glyph runs whose vertical centre falls inside an earlier run share its
  // line (Persian and Latin runs on one line have different heights).
  const countLines = (rects) => {
    const lines = [];
    for (const r of rects.filter((r) => r.width > 1)) {
      const c = (r.top + r.bottom) / 2;
      if (!lines.some((l) => c > l.top && c < l.bottom)) lines.push(r);
    }
    return lines.length;
  };
  const clip = (rects, box) => rects.map((r) => {
    const left = Math.max(r.left, box.left), top = Math.max(r.top, box.top);
    const right = Math.min(r.right, box.right), bottom = Math.min(r.bottom, box.bottom);
    return { left, top, width: right - left, height: bottom - top };
  }).filter((r) => r.width > 1 && r.height > 1);

  const texts = [...poster.querySelectorAll('[data-text]')]
    .filter((el) => el.offsetParent !== null && el.textContent.trim())
    .map((el) => {
      const cs = getComputedStyle(el);
      const range = document.createRange();
      range.selectNodeContents(el);
      return {
        id: el.id || el.className,
        text: el.textContent.trim(),
        fontSize: parseFloat(cs.fontSize),
        min: +el.dataset.min || 0,
        bold: +cs.fontWeight >= 700,
        color: cs.color,
        lines: countLines([...range.getClientRects()]),
        // Unmarked text is a one-line label.
        maxLines: el.dataset.lines ? +el.dataset.lines : 1,
        overflowX: el.scrollWidth > el.clientWidth + 1,
        // Glyph runs clipped to the element's own box: a font's content area
        // is taller than its line box, which would report phantom overlaps.
        ink: clip([...range.getClientRects()], el.getBoundingClientRect()).map(rel),
      };
    });

  // Whitespace between the masthead, the copy and the footer.
  const box = (el) => el.getBoundingClientRect();
  const blocks = [...poster.querySelectorAll('.content > *, .photo')]
    .filter((el) => el.offsetParent !== null && box(el).height > 0);
  const gaps = {
    top: Math.min(...blocks.map((el) => box(el).top)) - box(poster.querySelector('.masthead')).bottom,
    bottom: box(poster.querySelector('.footer')).top - Math.max(...blocks.map((el) => box(el).bottom)),
  };

  const img = document.getElementById('photo-img');
  const photo = poster.dataset.layout === 'photo' ? {
    naturalW: img.naturalWidth,
    naturalH: img.naturalHeight,
    box: rel(img.getBoundingClientRect()),
  } : null;

  const fontsOk = [...document.fonts].some((f) => f.family.includes('Vazirmatn') && f.status === 'loaded')
    && document.fonts.check('900 40px Vazirmatn', 'ایران');

  return { size: rel(origin), texts, photo, fontsOk, gaps };
}

// Hides text so the page can be screenshotted as "background only".
export function hideTextInPage(hide) {
  document.getElementById('poster').classList.toggle('qa-no-text', hide);
  if (!document.getElementById('qa-style')) {
    const s = document.createElement('style');
    s.id = 'qa-style';
    // Borders go too: a stamp's frame is drawn in the text colour and isn't what the text sits on.
    s.textContent = '.qa-no-text [data-text], .qa-no-text [data-text] * { color: transparent !important; text-shadow: none !important; border-color: transparent !important; outline-color: transparent !important; }';
    document.head.append(s);
  }
}

// Worst-case (10th percentile) contrast of each text box against the pixels
// actually behind it. Runs in the page with the background PNG as a data URL.
export async function contrastInPage({ png, texts }) {
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.src = png; });
  const c = new OffscreenCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const parse = (s) => s.match(/[\d.]+/g).map(Number);

  return texts.map((t) => {
    const [tr, tg, tb, ta = 1] = parse(t.color);
    const ratios = [];
    for (const r of t.ink) {
      const x = Math.max(0, Math.floor(r.x)), y = Math.max(0, Math.floor(r.y));
      const w = Math.min(img.width - x, Math.ceil(r.w)), h = Math.min(img.height - y, Math.ceil(r.h));
      if (w <= 0 || h <= 0) continue;
      const data = ctx.getImageData(x, y, w, h).data;
      for (let i = 0; i < data.length; i += 4 * 7) {
        const [br, bg, bb] = [data[i], data[i + 1], data[i + 2]];
        const fg = lum(tr * ta + br * (1 - ta), tg * ta + bg * (1 - ta), tb * ta + bb * (1 - ta));
        const bgL = lum(br, bg, bb);
        ratios.push((Math.max(fg, bgL) + 0.05) / (Math.min(fg, bgL) + 0.05));
      }
    }
    ratios.sort((a, b) => a - b);
    return { id: t.id, p10: ratios.length ? ratios[Math.floor(ratios.length * 0.1)] : 0 };
  });
}

export function layoutGates(m, contrast) {
  const out = [];
  out.push(gate('layout.size', m.size.w === W && m.size.h === H, `${m.size.w}×${m.size.h}`));
  out.push(gate('layout.fonts', m.fontsOk, m.fontsOk ? 'Vazirmatn loaded' : 'Vazirmatn not loaded — fallback font would render'));

  for (const t of m.texts) {
    const fitOk = !t.overflowX && t.lines <= t.maxLines;
    out.push(gate(`fit.${t.id}`, fitOk,
      `${t.lines}/${t.maxLines} lines @ ${t.fontSize}px${t.overflowX ? ', overflows width' : ''}`));
    out.push(gate(`type.${t.id}`, t.fontSize >= t.min, `${t.fontSize}px (min ${t.min})`));

    const outside = t.ink.filter((r) => r.x < SAFE || r.y < SAFE || r.x + r.w > W - SAFE || r.y + r.h > H - SAFE);
    out.push(gate(`safe.${t.id}`, !outside.length,
      outside.length ? `ink outside ${SAFE}px safe zone at ${outside.map((r) => `${r.x | 0},${r.y | 0}`).join(' ')}` : ''));
  }

  // No two text blocks may share pixels.
  const hits = [];
  for (let i = 0; i < m.texts.length; i++) {
    for (let j = i + 1; j < m.texts.length; j++) {
      const a = m.texts[i], b = m.texts[j];
      const overlap = a.ink.some((p) => b.ink.some((q) =>
        p.x < q.x + q.w - 1 && q.x < p.x + p.w - 1 && p.y < q.y + q.h - 1 && q.y < p.y + p.h - 1));
      if (overlap) hits.push(`${a.id}×${b.id}`);
    }
  }
  out.push(gate('layout.no-overlap', !hits.length, hits.join(', ')));
  out.push(gate('layout.breathing', m.gaps.top >= MIN_GAP && m.gaps.bottom >= MIN_GAP,
    `masthead→copy ${m.gaps.top | 0}px, copy→footer ${m.gaps.bottom | 0}px (min ${MIN_GAP})`));

  for (const c of contrast) {
    const t = m.texts.find((x) => x.id === c.id);
    // Thresholds are for the phone screen, where a 1080px poster shows at ~⅓ size.
    const need = t.fontSize >= 64 || (t.fontSize >= 44 && t.bold) ? 3 : 4.5;
    out.push(gate(`contrast.${c.id}`, c.p10 >= need, `${c.p10.toFixed(2)}:1 (need ${need})`));
  }

  if (m.photo) {
    const s = Math.max(m.photo.box.w / m.photo.naturalW, m.photo.box.h / m.photo.naturalH);
    out.push(gate('photo.resolution', m.photo.naturalW > 0 && s <= MAX_UPSCALE,
      `${m.photo.naturalW}×${m.photo.naturalH} shown at ${s.toFixed(2)}× (max ${MAX_UPSCALE})`));
    out.push(gate('photo.presence', m.photo.box.h >= MIN_PHOTO_H,
      `photo ${m.photo.box.h | 0}px tall (min ${MIN_PHOTO_H}) — text is crowding it out`));
  }
  return out;
}

// ── Output gates ───────────────────────────────────────────────────────────
export function outputGates({ bytes, caption }) {
  const tags = caption.match(/#[^\s#]+/g) || [];
  return [
    gate('output.filesize', bytes < MAX_BYTES, `${(bytes / 1024).toFixed(0)} KB`),
    gate('caption.length', caption.length <= CAPTION_MAX, `${caption.length}/${CAPTION_MAX} chars`),
    gate('caption.hashtags', tags.length > 0 && tags.length <= HASHTAG_MAX, `${tags.length}/${HASHTAG_MAX}: ${tags.join(' ')}`),
    gate('caption.link', caption.includes('thegreatdevil.com/events/'), 'links to the event page'),
    gate('caption.sources', /منابع/.test(caption), 'lists sources'),
    // Instagram's feed shows ~125 characters before "…more": the hook must land there.
    gate('caption.hook', caption.split('\n')[0].length <= 125, `first line ${caption.split('\n')[0].length} chars`),
  ];
}
