// Return plain text segments only. The renderer creates <strong> nodes; it
// never interprets report prose or visitor input as HTML/Markdown.
const TERMS = ['지장간', '일간', '일지', '월주', '기운일', '교운', '입춘', '대운', '세운',
  '비견', '겁재', '식신', '상관', '정재', '편재', '정관', '편관', '칠살', '정인', '편인',
  '명궁', '신궁', '복덕궁', '관록궁', '재백궁', '천이궁', '교우궁', '삼방사정', '생년사화', '화록', '화권', '화과', '화기',
  'Fact · 확인된 자료', 'Claim · 전통적 해석', 'Disclosure · 해석 범위와 조건'];
const PATTERN = new RegExp(`(${TERMS.join('|')}|[12][0-9]{3}년)`, 'g');
export function reportSegments(value, highlights = []) {
  const text = String(value ?? '');
  const semanticRanges = [];
  // Highlights are authored plain substrings, not markup or regular expressions.
  // Longest-first merging keeps overlaps intact without changing the prose.
  for (const phrase of [...new Set(Array.isArray(highlights) ? highlights : [])].filter((item) => typeof item === 'string' && item.trim() && item.length <= 180).slice(0, 12)) {
    let start = text.indexOf(phrase);
    while (start >= 0) {
      semanticRanges.push({ start, end: start + phrase.length });
      start = text.indexOf(phrase, start + phrase.length);
    }
  }
  semanticRanges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged = [];
  for (const range of semanticRanges) {
    const last = merged.at(-1);
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  if (merged.length) {
    const output = []; let start = 0;
    for (const range of merged) {
      if (range.start > start) output.push(...reportSegments(text.slice(start, range.start)));
      output.push({ text: text.slice(range.start, range.end), strong: true, semantic: true });
      start = range.end;
    }
    if (start < text.length) output.push(...reportSegments(text.slice(start)));
    return output;
  }
  let cursor = 0;
  const result = [];
  for (const match of text.matchAll(PATTERN)) {
    if (match.index > cursor) result.push({ text: text.slice(cursor, match.index), strong: false });
    result.push({ text: match[0], strong: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) result.push({ text: text.slice(cursor), strong: false });
  return result;
}
/** Deliberate editorial paragraphs, never arbitrary character-count cuts. */
export function reportBlocks(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').split(/\n[\t ]*\n+/u).map((part) => part.trim()).filter(Boolean);
}
export function reportParagraphRole(sectionId, index) {
  if (/^saju-domain-/.test(sectionId)) return ['원국에서 확인한 근거', '이 성향으로 해석한 이유', '강점과 주의점'][index] || '';
  if (/^saju-year-/.test(sectionId)) return ['이 해의 계산값', '흐름을 해석한 이유', '두드러지는 성향과 한계'][index] || '';
  return '';
}
