// Loads _events/*.md into the shape the poster template and caption need.
// Everything shown on a poster comes from an event's own front matter — the
// framework never invents copy, so a poster can't say more than the site does.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export const SITE = 'https://thegreatdevil.com';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const toFa = (v) => String(v).replace(/[0-9]/g, (d) => FA_DIGITS[d]);
const toAscii = (v) => String(v).replace(/[۰-۹]/g, (d) => FA_DIGITS.indexOf(d));

// Strongest evidence first: primary documents beat commentary.
const SOURCE_RANK = ['declassified', 'official', 'archive', 'academic', 'ngo', 'news', 'reference'];

export function loadEvents(repoRoot) {
  const dir = path.join(repoRoot, '_events');
  const events = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parseEvent(path.join(dir, f), repoRoot));

  // Same order as index.html: eras by id, then `order` within the era.
  return events.sort((a, b) => a.era_id.localeCompare(b.era_id) || a.order - b.order);
}

function parseEvent(file, repoRoot) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: no front matter`);
  const fm = yaml.load(m[1]);
  const slug = path.basename(file, '.md');

  return {
    ...fm,
    slug,
    url: `${SITE}/events/${slug}/`,
    body: m[2],
    yearParts: splitYear(fm.year),
    firstYear: Number((toAscii(fm.year).match(/\d{4}/) || [0])[0]),
    leadSource: pickLeadSource(fm.sources || []),
    photo: resolvePhoto(fm, repoRoot),
  };
}

// "۳ ژانویه ۲۰۲۰" → { big: "۲۰۲۰", detail: "۳ ژانویه ۲۰۲۰" }
// "۱۹۸۲–۱۹۸۸"    → { big: "۱۹۸۲–۱۹۸۸", detail: null }
function splitYear(year) {
  const s = String(year).trim();
  const years = toAscii(s).match(/\d{4}/g) || [];
  const big = years.length ? toFa([...new Set(years)].join('–')) : s;
  return { big, detail: big === s ? null : s };
}

function pickLeadSource(sources) {
  const rank = (s) => {
    const r = SOURCE_RANK.indexOf(s.type);
    return r === -1 ? SOURCE_RANK.length : r;
  };
  return [...sources].sort((a, b) => rank(a) - rank(b))[0] || null;
}

// A photo is only used when its licence is recorded — the same rule the site
// follows (CLAUDE.md › Images). Unlicensed images fall back to the
// typographic layout rather than being republished without attribution.
function resolvePhoto(fm, repoRoot) {
  if (!fm.image) return null;
  const file = path.join(repoRoot, fm.image.replace(/^\//, ''));
  const licensed = Boolean(fm.image_credit && fm.image_license);
  return {
    file,
    exists: fs.existsSync(file),
    licensed,
    credit: fm.image_credit || null,
    license: fm.image_license || null,
  };
}

// Plain-text paragraphs of the Markdown body, for the caption.
export function bodyParagraphs(body) {
  return body
    .replace(/<div class="key-fact">([\s\S]*?)<\/div>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('#') && !p.startsWith('- ') && !p.startsWith('|'))
    .map((p) => p
      .replace(/^>\s?/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*\*|__|`/g, '')
      .replace(/\s+/g, ' '));
}
