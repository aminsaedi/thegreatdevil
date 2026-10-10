// Instagram caption for an event. Captions carry what the poster can't: the
// longer story and the sources. Links aren't clickable in captions, so the
// event URL is written out and the CTA points to the bio link.
import { bodyParagraphs, toFa } from './events.mjs';

const BASE_TAGS = ['#ایران', '#آمریکا', '#تاریخ_ایران', '#شیطان_بزرگ'];
const CATEGORY_TAG = {
  coup: '#کودتا',
  sanction: '#تحریم',
  military: '#جنگ',
  cyber: '#جنگ_سایبری',
  diplo: '#دیپلماسی',
  intel: '#سیا',
};
const STORY_CHARS = 700;
const MAX_SOURCES = 4;

export function buildCaption(ev) {
  const story = clipToSentence(
    bodyParagraphs(ev.body).filter((p) => p !== ev.description).join('\n\n'),
    STORY_CHARS,
  );

  const sources = (ev.sources || []).slice(0, MAX_SOURCES)
    .map((s) => `• ${s.publisher}: ${s.title}${s.year ? ` (${s.year})` : ''}`);
  const more = (ev.sources || []).length - sources.length;

  return [
    `${ev.title} | ${ev.year}`,
    '',
    ev.description,
    '',
    story,
    '',
    'منابع:',
    ...sources,
    ...(more > 0 ? [`و ${toFa(more)} منبع دیگر در سایت`] : []),
    '',
    `روایت کامل با همهٔ منابع (لینک در بیو):`,
    ev.url.replace(/^https:\/\//, ''),
    '',
    'شیطان بزرگ · دخالت‌های آمریکا در ایران',
    '',
    [...BASE_TAGS, CATEGORY_TAG[ev.category]].filter(Boolean).join(' '),
  ].join('\n').replace(/\n{3,}/g, '\n\n');
}

function clipToSentence(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('؛'), cut.lastIndexOf('!'), cut.lastIndexOf('؟'));
  return end > max * 0.4 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…';
}
