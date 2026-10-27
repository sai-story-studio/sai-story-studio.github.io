/**
 * Presentation-only sentence groups. Every original character, including
 * whitespace, is retained: chunkCopyText(text).join('') === text.
 * No HTML, chart calculation, network, storage, or browser API is used here.
 */
const TERMINAL = /[.!?。！？…]/;
const CLOSING = /["'”’»›)\]}>」』】〉》]/;
const SPACE = /\s/;
const SHORT_FORM = /(?:^|[\s(])(?:e\.g|i\.e|etc|mr|mrs|ms|dr|prof|sr|jr|vs)\.$/i;
const SHORT_SENTENCE_LENGTH = 42;
const PAIRED_LENGTH_LIMIT = 110;

function sentences(source) {
  const result = [];
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (!TERMINAL.test(source[index])) continue;
    if (source[index] === '.') {
      // Dates, decimals, versions, URL paths and email/domain dots are not
      // sentence boundaries. A period also needs whitespace/end after closers.
      if (/\d/.test(source[index - 1] || '') && /\d/.test(source[index + 1] || '')) continue;
      if (SHORT_FORM.test(source.slice(Math.max(0, index - 12), index + 1))) continue;
    }
    let end = index + 1;
    while (end < source.length && TERMINAL.test(source[end])) end += 1;
    while (end < source.length && CLOSING.test(source[end])) end += 1;
    if (end < source.length && !SPACE.test(source[end])) continue;
    while (end < source.length && SPACE.test(source[end])) end += 1;
    result.push(source.slice(start, end));
    start = end;
    index = end - 1;
  }
  if (start < source.length) result.push(source.slice(start));
  return result;
}

/**
 * Keep a substantial sentence together. A short lead may share a compact
 * group with the following sentence (for example, a name/address + description).
 * A group contains at most two sentences, never a word/character-count cut.
 * Inline rendering preserves desktop flow; CSS may stack groups on mobile.
 * @param {string} value
 * @returns {string[]}
 */
export function chunkCopyText(value) {
  const source = value == null ? '' : String(value);
  if (!source) return [];
  const parts = sentences(source);
  const groups = [];
  for (let index = 0; index < parts.length; index += 1) {
    let group = parts[index];
    if (group.trim().length < SHORT_SENTENCE_LENGTH && index + 1 < parts.length
      && (group + parts[index + 1]).trim().length <= PAIRED_LENGTH_LIMIT) {
      group += parts[++index];
    }
    groups.push(group);
  }
  return groups;
}
