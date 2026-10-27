/** Vector/text PDF renderer; usable in browser, Node and Cloudflare Worker. */
import { PDFDocument, rgb } from './vendor/pdf-lib.esm.min.js';
import fontkit from './vendor/fontkit-bundle.js';
import { validateReadingPdfDocument } from './reading-pdf-document.js';
import { reportSegments, reportBlocks } from './report-format.js';

export const PDF_FONT_PATHS = Object.freeze({ regular: '/experience/fonts/sai-pdf-regular.ttf', bold: '/experience/fonts/sai-pdf-bold.ttf' });
const PAGE = { width: 595.28, height: 841.89, margin: 40, bottom: 46 };
const C = { ink: '#302B39', body: '#5C5665', muted: '#82778C', accent: '#88709F', line: '#DCD3E3', pale: '#F6F2F8', white: '#FFFFFF',
  목: '#477F89', 화: '#CD7179', 토: '#B68C4B', 금: '#8A8885', 수: '#605D79' };
const color = (hex) => rgb(...hex.slice(1).match(/../g).map((value) => parseInt(value, 16) / 255));
const clean = (value) => String(value ?? '').replace(/[\u2011\u2012\u2013\u2014\u2212]/g, '-').replace(/\r/g, '').replace(/\t/g, ' ');

/** Fetching is deliberately outside the pure renderer. Same-origin paths only. */
export async function loadReadingPdfFonts() {
  const pairs = await Promise.all(Object.entries(PDF_FONT_PATHS).map(async ([weight, path]) => {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-cache' });
    if (!response.ok) throw new Error('PDF 글꼴을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error('PDF 글꼴 크기가 올바르지 않습니다.');
    return [weight, bytes];
  }));
  return Object.fromEntries(pairs);
}

/** No fetch, DOM, canvas, storage or binary uploads. Metadata is fixed for retry. */
export async function buildReadingPdf({ document: raw, fontBytes } = {}) {
  const document = validateReadingPdfDocument(raw, { includeBirthData: Boolean(raw?.birthData) });
  if (!(fontBytes?.regular instanceof Uint8Array) || !(fontBytes?.bold instanceof Uint8Array)
    || !fontBytes.regular.length || !fontBytes.bold.length || fontBytes.regular.length > 8 * 1024 * 1024 || fontBytes.bold.length > 8 * 1024 * 1024) throw new TypeError('PDF 글꼴이 필요합니다.');
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // Compact, licensed, pre-subset TrueType files are embedded intact.
  const regular = await pdf.embedFont(fontBytes.regular, { subset: false });
  const bold = await pdf.embedFont(fontBytes.bold, { subset: false });
  pdf.setTitle(document.title); pdf.setAuthor('사이(SAI STUDIO)'); pdf.setSubject('계산된 상징으로 읽는 나의 이야기');
  pdf.setCreator('SAI STUDIO'); pdf.setProducer('SAI STUDIO · pdf-lib');
  pdf.setCreationDate(new Date('2026-10-23T00:00:00.000Z')); pdf.setModificationDate(new Date('2026-10-23T00:00:00.000Z'));
  let page, y, pageIndex = 0;
  const width = PAGE.width - PAGE.margin * 2;
  const fontFor = (strong) => strong ? bold : regular;
  const can = (font, char) => font.getCharacterSet().includes(char.codePointAt(0));
  const supported = new Map();
  function textValue(value, strong = false) {
    const font = fontFor(strong), key = strong ? 'b' : 'r';
    return [...clean(value)].map((char) => {
      const cacheKey = key + char;
      if (!supported.has(cacheKey)) supported.set(cacheKey, char === '\n' || can(font, char));
      return supported.get(cacheKey) ? char : '?';
    }).join('');
  }
  function text(value, x, top, size = 10, strong = false, tone = C.body, maxWidth = null, centered = false) {
    const content = textValue(value, strong);
    const font = fontFor(strong);
    const targetX = centered ? x + (maxWidth - font.widthOfTextAtSize(content, size)) / 2 : x;
    page.drawText(content, { x: targetX, y: top - size, size, font, color: color(tone) });
  }
  function rule(top, x = PAGE.margin, lineWidth = width, tone = C.line) {
    page.drawLine({ start: { x, y: top }, end: { x: x + lineWidth, y: top }, thickness: 0.65, color: color(tone) });
  }
  function rounded(x, top, boxWidth, height, fill = C.white, border = C.line, radius = 12) {
    const w = boxWidth, h = height, r = Math.min(radius, h / 2, w / 2);
    const path = `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
    page.drawSvgPath(path, { x, y: top, color: color(fill), borderColor: color(border), borderWidth: 0.7 });
  }
  function newPage() {
    if (pageIndex >= 40) throw new Error('PDF 페이지 수가 너무 많습니다.');
    page = pdf.addPage([PAGE.width, PAGE.height]); pageIndex++;
    y = PAGE.height - 37;
    text('SAI STUDIO', PAGE.margin, y, 9, true, C.accent);
    text(document.mode === 'saju' ? 'SAJU READING' : document.mode === 'ziwei' ? 'ZI WEI READING' : 'ZODIAC READING', PAGE.width - 150, y, 7.5, true, C.muted);
    rule(y - 18); y -= 38;
  }
  function ensure(height) { if (y - height < PAGE.bottom) newPage(); }
  function wrap(value, maxWidth, size = 10, strong = false) {
    const font = fontFor(strong), lines = [];
    for (const segment of textValue(value, strong).split('\n')) {
      if (!segment) { lines.push(''); continue; }
      let line = '';
      for (const token of segment.match(/[^\s]+\s*|\s+/gu) || []) {
        if (font.widthOfTextAtSize(line + token, size) <= maxWidth) { line += token; continue; }
        if (line.trim()) { lines.push(line.trimEnd()); line = ''; }
        for (const char of token) {
          if (font.widthOfTextAtSize(line + char, size) > maxWidth && line) { lines.push(line.trimEnd()); line = ''; }
          if (!line && /\s/u.test(char)) continue;
          line += char;
        }
      }
      if (line.trim() || !lines.length) lines.push(line.trimEnd());
    }
    return lines;
  }
  function paragraph(value, { strong = false, size = 10, tone = C.body, inset = 0, bullet = false, gap = 9, leading = 1.68 } = {}) {
    if (!value) return;
    const lineHeight = size * leading, lines = wrap(value, width - inset - (bullet ? 13 : 0), size, strong);
    let first = true;
    for (let index = 0; index < lines.length; index++) {
      ensure(lineHeight + (index === 0 ? Math.min(lines.length, 2) * lineHeight : 0));
      if (bullet && first) text('·', PAGE.margin + inset, y, size + 1, true, C.accent);
      text(lines[index], PAGE.margin + inset + (bullet ? 13 : 0), y, size, strong, tone);
      y -= lineHeight; first = false;
    }
    y -= gap;
  }
  const characterWidths = new Map();
  function mixedLines(value, maxWidth, size, highlights) {
    // Measure with the actual font of each character. Measuring the full
    // string as regular and painting selected words bold would clip long
    // semantic spans at the right margin.
    const atoms = reportSegments(value, highlights).flatMap((segment) => {
      const strong = segment.semantic === true;
      return [...textValue(segment.text, strong)].map((char) => {
        const key = `${size}:${strong ? 'b' : 'r'}:${char}`;
        if (!characterWidths.has(key)) characterWidths.set(key, char === '\n' ? 0 : fontFor(strong).widthOfTextAtSize(char, size));
        return { text: char, strong, width: characterWidths.get(key) };
      });
    });
    const lines = [], tokens = [];
    let token = [], previousSpace = false;
    const flushToken = () => { if (token.length) tokens.push(token); token = []; previousSpace = false; };
    for (const atom of atoms) {
      if (atom.text === '\n') { flushToken(); tokens.push(null); continue; }
      const space = /\s/u.test(atom.text);
      if (previousSpace && !space) flushToken();
      token.push(atom); previousSpace = space;
    }
    flushToken();
    let line = [], lineWidth = 0;
    const flushLine = () => {
      while (line.length && /\s/u.test(line.at(-1).text)) line.pop();
      lines.push(line); line = []; lineWidth = 0;
    };
    for (const part of tokens) {
      if (part === null) { flushLine(); continue; }
      const partWidth = part.reduce((sum, atom) => sum + atom.width, 0);
      if (line.length && lineWidth + partWidth > maxWidth) flushLine();
      for (const atom of part) {
        if (!line.length && /\s/u.test(atom.text)) continue;
        if (line.length && lineWidth + atom.width > maxWidth) flushLine();
        if (!line.length && /\s/u.test(atom.text)) continue;
        line.push(atom); lineWidth += atom.width;
      }
    }
    if (line.length) flushLine();
    return lines;
  }
  function proseParagraph(value, { highlights = [], size = 10, tone = C.body, inset = 0, bullet = false, gap = 9, leading = 1.68, ...rest } = {}) {
    // The old rendering path remains byte-for-byte unchanged for Zodiac.
    if (document.mode === 'zodiac') { paragraph(value, { size, tone, inset, bullet, gap, leading, ...rest }); return; }
    const blocks = reportBlocks(value), lineHeight = size * leading;
    let first = true;
    blocks.forEach((block, blockIndex) => {
      const lines = mixedLines(block, width - inset - (bullet ? 13 : 0), size, highlights);
      for (let index = 0; index < lines.length; index++) {
        ensure(lineHeight + (index === 0 ? Math.min(lines.length, 2) * lineHeight : 0));
        if (bullet && first) text('·', PAGE.margin + inset, y, size + 1, true, C.accent);
        let x = PAGE.margin + inset + (bullet ? 13 : 0), run = '', runStrong = false;
        const paint = () => {
          if (!run) return;
          text(run, x, y, size, runStrong, tone);
          x += fontFor(runStrong).widthOfTextAtSize(textValue(run, runStrong), size); run = '';
        };
        for (const atom of lines[index]) {
          if (run && atom.strong !== runStrong) paint();
          runStrong = atom.strong; run += atom.text;
        }
        paint(); y -= lineHeight; first = false;
      }
      if (blockIndex < blocks.length - 1) y -= 7;
    });
    if (blocks.length) y -= gap;
  }
  function heading(value, chapter = false) {
    ensure(chapter ? 220 : 106);
    if (chapter) { y -= 12; rounded(PAGE.margin, y, width, 40, C.pale); text(value.replace(/^0?(\d)\s*[·.-]\s*/, '$1  '), PAGE.margin + 16, y - 10, 13, true, C.accent); y -= 58; }
    else { y -= 5; paragraph(value, { strong: true, size: 13, tone: C.ink, gap: 11 }); }
  }
  function tableLeadHeight(model) {
    if (!model.rows.length) return 0;
    const manse = model.kind === 'manse', columns = model.headers.length;
    const labelWidth = manse ? 53 : width / columns, dataWidth = manse ? (width - labelWidth) / 4 : labelWidth;
    const size = manse ? 9.5 : Math.max(7, Math.min(9, 35 / Math.sqrt(columns))), padding = manse ? 9 : 8;
    const height = (row, index) => manse && [0, 2].includes(index) ? 62 : Math.max(34, Math.max(...row.map((value, column) => wrap(value, (manse && column === 0 ? labelWidth : dataWidth) - padding * 2, size).length)) * size * 1.5 + padding * 2);
    const total = 30 + model.rows.reduce((sum, row, index) => sum + height(row, index), 0);
    const first = 30 + height(model.rows[0], 0) + (manse && model.rows[1] ? height(model.rows[1], 1) : 0);
    const caption = model.caption ? wrap(model.caption, width, 9, true).length * 15.12 + 8 : 0;
    return caption + (manse && total < PAGE.height - 125 ? total : first) + 12;
  }
  function table(model) {
    if (!model.rows.length) return;
    const manse = model.kind === 'manse', colCount = model.headers.length;
    const labelWidth = manse ? 53 : width / colCount;
    const dataWidth = manse ? (width - labelWidth) / 4 : labelWidth;
    const sizes = model.headers.map((_, index) => manse && index === 0 ? labelWidth : dataWidth);
    const size = manse ? 9.5 : Math.max(7, Math.min(9, 35 / Math.sqrt(colCount)));
    const lineHeight = size * 1.5, padding = manse ? 9 : 8;
    // Keep controlled outside row labels intact rather than splitting the
    // final Korean syllable. Only these short labels may shrink to fit.
    const cellSize = (value, index) => manse && index === 0
      ? Math.max(6.5, Math.min(size, ...textValue(value, true).split('\n').filter(Boolean).map((line) => size * (sizes[index] - padding * 2 - 0.5) / Math.max(1, fontFor(true).widthOfTextAtSize(line, size))))) : size;
    const cellLines = (row) => row.map((value, index) => wrap(value, sizes[index] - padding * 2, cellSize(value, index), manse && index === 0));
    const rowHeight = (row, index) => manse && (index === 0 || index === 2) ? 62 : Math.max(34, Math.max(...cellLines(row).map((lines) => lines.length)) * lineHeight + padding * 2);
    const totalHeight = 30 + model.rows.reduce((sum, row, index) => sum + rowHeight(row, index), 0);
    // Do not leave a caption/column header alone at a page bottom.
    const firstBlockHeight = rowHeight(model.rows[0], 0) + (manse && model.rows[1] ? rowHeight(model.rows[1], 1) : 0);
    ensure(Math.min(totalHeight + 30, 58 + firstBlockHeight));
    if (manse && totalHeight < PAGE.height - 125) ensure(totalHeight + 35);
    paragraph(model.caption, { strong: true, size: 9, tone: C.muted, gap: 8 });
    const drawHeader = () => {
      ensure(74);
      let x = PAGE.margin;
      model.headers.forEach((header, index) => { text(index === 0 && manse ? '' : header, x + 3, y, 9, true, C.muted, sizes[index] - 6, true); x += sizes[index]; });
      y -= 25;
    };
    drawHeader();
    let segmentStart = y, segmentRows = [], segmentHeight = 0;
    const drawSegment = () => {
      if (!segmentRows.length) return;
      const x0 = PAGE.margin + (manse ? labelWidth : 0), w0 = width - (manse ? labelWidth : 0);
      rounded(x0, segmentStart, w0, segmentHeight, C.white, C.line, 11);
      let yy = segmentStart;
      segmentRows.forEach(({ row, index, height }) => {
        if (yy !== segmentStart) rule(yy, x0, w0);
        let x = PAGE.margin;
        row.forEach((value, column) => {
          if (column > (manse ? 1 : 0)) page.drawLine({ start: { x, y: yy }, end: { x, y: yy - height }, thickness: 0.65, color: color(C.line) });
          const glyphRow = manse && column > 0 && (index === 0 || index === 2);
          if (glyphRow && /^[가-힣][\u3400-\u9fff]\n[+-][목화토금수]$/u.test(value)) {
            const [pair, element] = value.split('\n');
            // Hangul/Hanja occupy the center of the full cell, independent
            // of the small polarity/element annotation in its lower corner.
            const glyphSize = 23, polaritySize = 9.5;
            text(pair, x + 3, yy - (height - glyphSize) / 2, glyphSize, true, C[element.slice(-1)], sizes[column] - 6, true);
            const polarityWidth = fontFor(true).widthOfTextAtSize(element, polaritySize);
            text(element, x + sizes[column] - padding - polarityWidth, yy - height + padding + polaritySize, polaritySize, true, C[element.slice(-1)]);
          } else {
            const actualSize = cellSize(value, column), actualLineHeight = actualSize * 1.5;
            const lines = wrap(value, sizes[column] - padding * 2, actualSize, column === 0);
            const top = yy - Math.max(padding, (height - lines.length * actualLineHeight) / 2);
            lines.forEach((line, lineIndex) => text(line, x + padding, top - lineIndex * actualLineHeight, actualSize, column === 0 || (manse && index === 1 && column === 2), column === 0 ? C.muted : C.body, sizes[column] - padding * 2, manse));
          }
          x += sizes[column];
        });
        yy -= height;
      });
      segmentRows = []; segmentHeight = 0;
    };
    model.rows.forEach((row, index) => {
      const height = rowHeight(row, index);
      if (height > PAGE.height - 150) throw new Error('표 한 행의 내용이 너무 깁니다.');
      // A glyph row must stay with the following interpretation/names row.
      // Long stem/branch lists can split the table, but not their label pair.
      const pairHeight = manse && [0, 2].includes(index) && model.rows[index + 1]
        ? height + rowHeight(model.rows[index + 1], index + 1) : height;
      if (y - pairHeight < PAGE.bottom + 14) { drawSegment(); newPage(); drawHeader(); segmentStart = y; }
      segmentRows.push({ row, index, height }); segmentHeight += height; y -= height;
    });
    drawSegment(); y -= 18;
  }

  let lastChapter = '';
  function renderSection(section) {
    const bodyParagraph = (value, options = {}) => proseParagraph(value, { highlights: section.highlights || [], ...options });
    const newChapter = section.chapter && section.chapter !== lastChapter;
    if (section.table) {
      const titleHeight = wrap(section.title, width, 13, true).length * 21.84 + 16;
      const introHeight = section.text ? wrap(section.text, width, 9.5).length * 15.96 + 9 : 0;
      // Keep the section title with its table, not alone on the prior page.
      ensure(titleHeight + introHeight + tableLeadHeight(section.table) + (newChapter ? 70 : 0));
    }
    if (newChapter) { heading(section.chapter, true); lastChapter = section.chapter; }
    const guidanceLines = document.mode === 'ziwei' && section.id === 'ziwei-guidance' && /^\[해석\s*안내\]\n/u.test(section.text) ? section.text.split('\n') : null;
    heading(guidanceLines ? guidanceLines[0] : document.mode === 'ziwei' && section.id === 'ziwei-input-state' ? '[입력 상태]' : section.title);
    if (section.text) bodyParagraph(guidanceLines ? guidanceLines.slice(1).join('\n') : section.text, { size: 9.5, tone: C.muted });
    if (section.table) table(section.table);
    for (const value of section.paragraphs) {
      const [lead, ...body] = value.split('\n');
      if (document.mode === 'ziwei' && /^(?:\[)?(?:Fact|Claim|Disclosure)(?:\])?\s*[·:]/u.test(lead) && body.length) {
        ensure(9.7 * 1.68 + 2 + 3 * 10 * 1.68);
        paragraph(lead, { strong: true, size: 9.7, tone: C.accent, gap: 2 });
        bodyParagraph(body.join('\n'));
      } else bodyParagraph(value);
    }
    for (const value of section.items) {
      const parts = value.split('\n');
      if (parts.length > 1) {
        if (document.mode !== 'zodiac') ensure(4 * 9.7 * 1.68 + 2);
        paragraph(parts.shift(), { strong: true, size: 9.7, gap: 2 }); bodyParagraph(parts.join('\n'), { size: 9.7, gap: 9 });
      }
      else bodyParagraph(value, { bullet: true, size: 9.7 });
    }
    y -= 8;
  }

  const preludeIds = new Set(['ziwei-guidance', 'ziwei-input-state']);
  const prelude = document.mode === 'ziwei' ? ['ziwei-guidance', 'ziwei-input-state'].flatMap((id) => document.sections.filter((section) => section.id === id)) : [];
  const ending = document.mode === 'ziwei' ? document.sections.filter((section) => section.id === 'ziwei-final-disclosure') : [];
  const body = document.mode === 'ziwei' ? document.sections.filter((section) => !preludeIds.has(section.id) && section.id !== 'ziwei-final-disclosure') : document.sections;
  newPage();
  // The prompt's guidance and input state are the first report body content.
  for (const section of prelude) renderSection(section);
  paragraph(document.title, { strong: true, size: 23, tone: C.ink, gap: 9 });
  paragraph(document.subtitle, { size: 11, tone: C.accent, gap: 20 });
  if (document.birthData) paragraph(`양력 ${document.birthData.date} · ${document.birthData.time || '생시 모름'}`, { size: 8.5, tone: C.muted, gap: 15 });
  for (const item of document.summary) {
    ensure(80);
    paragraph(item.label, { strong: true, size: 11, tone: C.ink, gap: 4 });
    paragraph(item.text, { size: 10, gap: 13 });
  }
  rule(y); y -= 18;
  for (const section of body) renderSection(section);
  if (document.notes.length) {
    if (document.mode !== 'zodiac') {
      // Keep a short closing group together rather than leaving one note or
      // the mandatory final sentence alone on an otherwise empty last page.
      const notesHeight = 38 + document.notes.reduce((sum, value) => sum + wrap(value, width, 7.6).length * 7.6 * 1.4 + 4, 0);
      const endingHeight = ending.reduce((sum, section) => sum + Math.max(106, 54
        + [section.text, ...section.paragraphs, ...section.items].filter(Boolean).reduce((height, value) => height + wrap(value, width).length * 16.8 + 9, 0)), 0);
      if (notesHeight + endingHeight < PAGE.height - 125) ensure(notesHeight + endingHeight + 14);
    }
    heading('읽기 전에 기억해 주세요'); for (const value of document.notes) paragraph(value, { size: 7.6, leading: 1.4, tone: C.muted, gap: 4 });
  }
  // Common notes must not follow the prompt's mandatory final sentence.
  for (const section of ending) renderSection(section);
  const pages = pdf.getPages();
  for (let index = 0; index < pages.length; index++) {
    page = pages[index]; rule(33);
    text('SAI STUDIO · 자기 성찰을 위한 상징 해설', PAGE.margin, 25, 7, false, C.muted);
    text(`${index + 1} / ${pages.length}`, PAGE.width - 77, 25, 7, true, C.muted);
  }
  return pdf.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: Infinity });
}
