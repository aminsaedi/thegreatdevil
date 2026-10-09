// Telegram caption for an event's channel post. Unlike Instagram, links in a
// Telegram caption are clickable, so the post links straight to the event
// page. Captions are HTML (parsed by TDLib's textParseModeHTML).
import { bodyParagraphs, toFa } from './events.mjs';

// Telegram's photo-caption limit for non-Premium senders, in visible characters.
export const TG_CAPTION_MAX = 1024;

const CATEGORY_TAG = {
  coup: '#کودتا',
  sanction: '#تحریم',
  military: '#نظامی',
  cyber: '#سایبری',
  diplo: '#دیپلماسی',
  intel: '#اطلاعاتی',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const visibleLength = (html) =>
  html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').length;

export function buildTelegramCaption(ev, channel) {
  const link = `${ev.url}?utm_source=telegram&utm_medium=social&utm_campaign=channel`;
  const decade = `#دهه_${toFa(Math.floor(ev.firstYear / 10) * 10)}`;
  const n = (ev.sources || []).length;

  const head = [
    `<b>${esc(ev.title)}</b>`,
    `${esc(ev.year)} · ${esc(ev.category_label)}`,
    '',
    esc(ev.description),
  ].join('\n');
  const tail = [
    `🔗 <a href="${esc(link)}">روایت کامل${n ? ` با ${toFa(n)} منبع مستند` : ''}</a>`,
    '',
    `${CATEGORY_TAG[ev.category] || ''} ${decade}`.trim(),
    `@${channel}`,
  ].join('\n');

  // The story fills whatever room the limit leaves, cut at a sentence.
  const room = TG_CAPTION_MAX - visibleLength(head) - visibleLength(tail) - 4;
  const story = clipToSentence(
    bodyParagraphs(ev.body).filter((p) => p !== ev.description).join('\n\n'),
    Math.min(room, 650),
  );
  return [head, story && esc(story), tail].filter(Boolean).join('\n\n');
}

function clipToSentence(text, max) {
  if (max < 80) return '';
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('؛'), cut.lastIndexOf('!'), cut.lastIndexOf('؟'));
  return end > max * 0.4 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…';
}
