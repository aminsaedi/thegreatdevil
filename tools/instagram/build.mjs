#!/usr/bin/env node
// Builds a social poster (1080×1350 JPEG) plus Instagram and Telegram captions
// for each event and runs every quality gate on it. Exits non-zero if any
// poster fails a gate.
//
//   node build.mjs                    # all events
//   node build.mjs 1901-darcy 1953    # events whose slug starts with these
//   node build.mjs --sheet            # also write out/contact-sheet.jpg (grid preview)
//   node build.mjs --publish DIR      # copy passing posters + manifest.json into DIR
//                                     # (the deploy does this into _site/posters; the
//                                     # n8n Telegram workflow reads the manifest)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import yaml from 'js-yaml';

import { loadEvents, toFa, SITE } from './lib/events.mjs';
import { buildCaption } from './lib/caption.mjs';
import { buildTelegramCaption, visibleLength, TG_CAPTION_MAX } from './lib/telegram.mjs';
import {
  W, H, contentGates, layoutGates, outputGates,
  measureInPage, hideTextInPage, contrastInPage,
} from './lib/gates.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const OUT = path.join(HERE, 'out');
const TEMPLATE = pathToFileURL(path.join(HERE, 'template/poster.html')).href;
const ACCENT = '#e94560';

const args = process.argv.slice(2);
const wantSheet = args.includes('--sheet');
const publishIdx = args.indexOf('--publish');
const publishDir = publishIdx === -1 ? null : path.resolve(args[publishIdx + 1] || '');
const filters = args.filter((a, i) => !a.startsWith('--') && i !== publishIdx + 1);
const CHANNEL = yaml.load(fs.readFileSync(path.join(REPO, '_config.yml'), 'utf8')).telegram_channel;

const events = loadEvents(REPO)
  .filter((e) => !filters.length || filters.some((f) => e.slug.startsWith(f)));
if (!events.length) {
  console.error(`no events match: ${filters.join(' ')}`);
  process.exit(2);
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
fs.mkdirSync(OUT, { recursive: true });

let failed = 0;
const ready = [];
for (const ev of events) {
  const gates = await buildOne(ev);
  const bad = gates.filter((g) => !g.ok);
  failed += bad.length ? 1 : 0;
  if (!bad.length) ready.push(ev);
  console.log(`${bad.length ? '✗' : '✓'} ${ev.slug.padEnd(34)} ${gates.length - bad.length}/${gates.length} gates`);
  for (const g of bad) console.log(`    ✗ ${g.id}: ${g.detail}`);
}

await browser.close();
if (wantSheet) contactSheet(events);
console.log(`\n${events.length - failed}/${events.length} posters ready → ${path.relative(process.cwd(), OUT)}/`);
if (publishDir) {
  publish(ready);
  // A failing poster is held back from the manifest, so it never gets posted;
  // it shouldn't also block the site deploy.
  if (failed) console.log(`::warning::${failed} poster(s) failed quality gates and were not published`);
  process.exit(0);
}
process.exit(failed ? 1 : 0);

async function buildOne(ev) {
  const dir = path.join(OUT, ev.slug);
  fs.mkdirSync(dir, { recursive: true });
  const gates = contentGates(ev);
  const usePhoto = ev.photo?.licensed && ev.photo.exists;

  await page.goto(TEMPLATE);
  await page.evaluate((d) => window.renderPoster(d), {
    accent: ACCENT,
    category: ev.category,
    categoryLabel: ev.category_label,
    title: ev.title,
    description: ev.description,
    yearBig: ev.yearParts.big,
    yearDetail: ev.yearParts.detail,
    sourcePublisher: ev.leadSource?.publisher || '',
    moreSources: (ev.sources?.length || 0) > 1 ? toFa(ev.sources.length - 1) : '',
    photo: usePhoto ? pathToFileURL(ev.photo.file).href : null,
    photoCredit: ev.photo?.credit,
    photoLicense: ev.photo?.license,
  });

  const poster = page.locator('#poster');
  const m = await page.evaluate(measureInPage);

  await page.evaluate(hideTextInPage, true);
  const bg = await poster.screenshot({ type: 'png' });
  await page.evaluate(hideTextInPage, false);
  const contrast = await page.evaluate(contrastInPage, {
    png: `data:image/png;base64,${bg.toString('base64')}`,
    texts: m.texts,
  });
  gates.push(...layoutGates(m, contrast));

  const jpg = path.join(dir, 'poster.jpg');
  await poster.screenshot({ path: jpg, type: 'jpeg', quality: 95 });
  const caption = buildCaption(ev);
  fs.writeFileSync(path.join(dir, 'caption.txt'), caption + '\n');
  gates.push(...outputGates({ bytes: fs.statSync(jpg).size, caption }));

  ev.telegramCaption = buildTelegramCaption(ev, CHANNEL);
  fs.writeFileSync(path.join(dir, 'telegram.html'), ev.telegramCaption + '\n');
  const tgLen = visibleLength(ev.telegramCaption);
  gates.push({ id: 'telegram.caption', ok: tgLen <= TG_CAPTION_MAX && ev.telegramCaption.includes(ev.url),
    detail: `${tgLen}/${TG_CAPTION_MAX} chars, links to the event page` });

  fs.writeFileSync(path.join(dir, 'qa.json'), JSON.stringify({
    slug: ev.slug,
    layout: usePhoto ? 'photo' : 'type',
    passed: gates.every((g) => g.ok),
    gates,
  }, null, 2) + '\n');
  return gates;
}

// Posters that passed every gate, in timeline order, for the daily post.
function publish(evs) {
  fs.mkdirSync(publishDir, { recursive: true });
  const items = evs.map((ev) => {
    fs.copyFileSync(path.join(OUT, ev.slug, 'poster.jpg'), path.join(publishDir, `${ev.slug}.jpg`));
    return {
      slug: ev.slug,
      title: ev.title,
      year: ev.year,
      url: ev.url,
      poster: `${SITE}/posters/${ev.slug}.jpg`,
      width: W,
      height: H,
      telegram_caption_html: ev.telegramCaption,
    };
  });
  fs.writeFileSync(path.join(publishDir, 'manifest.json'), JSON.stringify({
    generated_at: new Date().toISOString(),
    channel: CHANNEL,
    items,
  }, null, 2) + '\n');
  console.log(`published ${items.length} posters → ${publishDir}`);
}

// Playwright's bundled Chromium if installed, otherwise the system Chrome.
async function launch() {
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ channel: 'chrome' });
  }
}

// Every poster as Instagram's profile grid shows it: a 3:4 centre crop.
function contactSheet(evs) {
  const files = evs.map((e) => path.join(OUT, e.slug, 'poster.jpg'));
  const sheet = path.join(OUT, 'contact-sheet.jpg');
  execFileSync('magick', [
    'montage', ...files,
    '-gravity', 'center', '-crop', `${Math.round(H * 3 / 4)}x${H}+0+0`, '+repage',
    '-resize', '300x400', '-tile', '6x', '-geometry', '+4+4', '-background', '#000',
    '-quality', '85', sheet,
  ]);
  console.log(`contact sheet → ${path.relative(process.cwd(), sheet)}`);
}
