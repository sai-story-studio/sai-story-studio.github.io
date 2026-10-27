/** A bounded, text-only PDF contract shared by browser and email Worker.
 * No HTML, binary, URL, engine input, or arbitrary attachment is accepted.
 */
import { buildReadingDetail, readingResultSummary, sajuTimeCorrectionDisplay } from './reading-detail.js';
import { buildManseView } from './manse-view.js';
import { buildMappingExplanation } from './mapping-explanation.js';

export const READING_PDF_MAX_BYTES = 220 * 1024;
const MODES = { saju: '사주', ziwei: '자미두수', zodiac: '별자리' };
const KEYS = {
  root: ['version', 'mode', 'title', 'subtitle', 'summary', 'sections', 'notes', 'birthData'],
  summary: ['label', 'text'], section: ['id', 'title', 'chapter', 'text', 'paragraphs', 'items', 'table', 'highlights'],
  table: ['kind', 'caption', 'headers', 'rows'], birth: ['date', 'time', 'calendar'],
};
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some((key) => !keys.includes(key))) throw new TypeError('PDF 문서 형식이 올바르지 않습니다.');
  return value;
}
function string(value, max = 2000, required = false) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)
    || /<\/?[a-z][^>]*>|(?:https?:\/\/|data:|javascript:|blob:)/iu.test(value)) throw new TypeError('PDF 텍스트 형식이 올바르지 않습니다.');
  const output = value.trim();
  if (required && !output) throw new TypeError('PDF 필수 내용이 없습니다.');
  return output;
}
function list(value, maxItems = 20, maxText = 2000) {
  if (!Array.isArray(value) || value.length > maxItems) throw new TypeError('PDF 항목 수를 확인해 주세요.');
  return value.map((item) => string(item, maxText));
}

/** Strict validation returns an allowlisted copy; never renders user HTML. */
export function validateReadingPdfDocument(raw, { includeBirthData = false } = {}) {
  let encoded;
  try { encoded = JSON.stringify(raw); } catch { throw new TypeError('PDF 문서를 읽을 수 없습니다.'); }
  if (!encoded || new TextEncoder().encode(encoded).byteLength > READING_PDF_MAX_BYTES) throw new TypeError('PDF 문서가 너무 큽니다.');
  object(raw, KEYS.root);
  if (raw.version !== 1 || !Object.hasOwn(MODES, raw.mode)) throw new TypeError('지원하지 않는 PDF 문서입니다.');
  if (!Array.isArray(raw.summary) || raw.summary.length > 12 || !Array.isArray(raw.sections) || raw.sections.length > 80) throw new TypeError('PDF 구성 수를 확인해 주세요.');
  const result = {
    version: 1, mode: raw.mode, title: string(raw.title, 160, true), subtitle: string(raw.subtitle, 300),
    summary: raw.summary.map((item) => { object(item, KEYS.summary); return { label: string(item.label, 160, true), text: string(item.text, 4000) }; }),
    sections: raw.sections.map((item) => {
      object(item, KEYS.section);
      const section = { id: string(item.id, 100, true), title: string(item.title, 200, true), chapter: string(item.chapter, 200),
        text: string(item.text, 4000), paragraphs: list(item.paragraphs, 20, 4000), items: list(item.items, 20, 4000) };
      if (!/^[a-z0-9-]+$/.test(section.id) || (!includeBirthData && section.id === 'calculation')) throw new TypeError('PDF에 포함할 수 없는 계산 자료입니다.');
      if (item.highlights !== undefined) {
        const highlights = list(item.highlights, 12, 180);
        const prose = [section.text, ...section.paragraphs, ...section.items];
        if (highlights.some((phrase) => !phrase || !prose.some((value) => value.includes(phrase)))
          || new Set(highlights).size !== highlights.length) throw new TypeError('PDF 강조 문구는 본문의 서로 다른 일부여야 합니다.');
        section.highlights = highlights;
      }
      if (item.table !== undefined) {
        object(item.table, KEYS.table);
        if (!['standard', 'manse'].includes(item.table.kind)) throw new TypeError('PDF 표 형식이 올바르지 않습니다.');
        const headers = list(item.table.headers, 20, 160);
        if (headers.length < 1 || !Array.isArray(item.table.rows) || item.table.rows.length > 120) throw new TypeError('PDF 표 크기를 확인해 주세요.');
        const rows = item.table.rows.map((row) => {
          const values = list(row, 20, 2000);
          if (values.length !== headers.length) throw new TypeError('PDF 표의 열 수가 다릅니다.');
          return values;
        });
        if (item.table.kind === 'manse' && (headers.length !== 5 || rows.length > 10)) throw new TypeError('사주 표의 크기가 올바르지 않습니다.');
        section.table = { kind: item.table.kind, caption: string(item.table.caption, 300), headers, rows };
      }
      return section;
    }),
    notes: list(raw.notes, 30, 4000),
  };
  if (raw.birthData !== undefined) {
    if (!includeBirthData) throw new TypeError('출생정보 포함 동의가 필요합니다.');
    object(raw.birthData, KEYS.birth);
    const { date, time, calendar } = raw.birthData;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || calendar !== 'solar'
      || (time !== null && (typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)))) throw new TypeError('출생정보 형식이 올바르지 않습니다.');
    result.birthData = { date, time, calendar: 'solar' };
  }
  const textCount = JSON.stringify(result).length;
  if (textCount > 100000) throw new TypeError('PDF 문서의 텍스트가 너무 깁니다.');
  return result;
}

function manseTable(view) {
  const values = (get) => view.columns.map((column) => column.missing ? '모름' : get(column) || '미확인');
  const glyph = (value) => value ? `${value.name}${value.glyph}\n${value.polarity}${value.element}` : '미확인';
  return { kind: 'manse', caption: '사주 원국 · 생시부터 생년 순서', headers: ['항목', ...view.columns.map((column) => column.label)], rows: [
    ['천간', ...values((column) => glyph(column.stem))], ['십성', ...values((column) => column.stemTenGod)],
    ['지지', ...values((column) => glyph(column.branch))], ['십성\n(본기)', ...values((column) => column.branchTenGods[0])],
    ['지장간', ...values((column) => column.hiddenStems.join(' '))], ['12운성', ...values((column) => column.growthStage)],
    ['납음', ...values((column) => column.naYin)], ['공망', ...values((column) => column.voidBranches.join(' '))],
  ] };
}

function shinsalSection(view) {
  const values = (get) => view.columns.map((column) => column.missing ? '모름' : get(column) || '미확인');
  const glyph = (value) => value ? `${value.name}${value.glyph}\n${value.polarity}${value.element}` : '미확인';
  const names = (column, layer) => Array.isArray(column.auspiciousByLayer?.[layer]) && column.auspiciousByLayer[layer].length ? column.auspiciousByLayer[layer].join('\n') : '—';
  const twelve = (column) => typeof column.twelveStars?.year === 'string' && typeof column.twelveStars?.day === 'string'
    ? `연지 기준: ${column.twelveStars.year}\n일지 기준: ${column.twelveStars.day}` : '미확인';
  const methodNotes = Array.isArray(view.auspicious?.notes) ? view.auspicious.notes.filter((value) => typeof value === 'string' && value.trim()) : [];
  return { id: 'saju-shinsal', title: '나의 귀인·신살', chapter: '', text: '', paragraphs: [], items: [...new Set(methodNotes)],
    table: { kind: 'manse', caption: '천간·지지로 나누어 보는 귀인과 신살', headers: ['항목', ...view.columns.map((column) => column.label)], rows: [
      ['천간', ...values((column) => glyph(column.stem))], ['귀인·신살', ...values((column) => names(column, 'stem'))],
      ['지지', ...values((column) => glyph(column.branch))], ['귀인·신살', ...values((column) => names(column, 'branch'))],
      ['12신살\n(연지/일지)', ...values(twelve)],
    ] } };
}

/** Builds only from the already-computed result. Does not calculate or send. */
export function buildReadingPdfDocument({ reading, input = null, includeBirthData = false, localOnlyCorrection = false } = {}) {
  if (!reading || !Object.hasOwn(MODES, reading.mode) || !/^[EI][SN][TF][JP]$/.test(reading.type || '')) throw new TypeError('먼저 결과를 확인해 주세요.');
  const detail = buildReadingDetail(reading, input);
  const manse = reading.mode === 'saju' ? buildManseView(reading) : null;
  const mapping = buildMappingExplanation(reading);
  const summary = reading.mode === 'ziwei' ? [] : [{ label: `${reading.type} · ${reading.title || ''}`, text: readingResultSummary(reading) },
    ...(Array.isArray(reading.sections) ? reading.sections.filter((item) => item.title !== '균형을 위한 질문' && !(mapping && item.title === '네 글자로 연결한 이유')).map((item) => ({ label: item.title, text: item.text })) : [])];
  const sections = detail.sections.filter((item) => includeBirthData || item.id !== 'calculation').map((item) => {
    let items = item.items || [];
    // Preserve every verified fact without widening the shared 20-item schema.
    // New correction/cycle provenance can make this one reference list longer.
    if (reading.mode === 'saju' && item.id === 'calculation' && items.length > 20) {
      const size = Math.ceil(items.length / 20);
      items = Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size).join('\n\n'));
    }
    const result = { id: item.id, title: item.title, chapter: item.groupLabel || '', text: item.text || '', paragraphs: item.paragraphs || [], items };
    if (item.highlights !== undefined) result.highlights = item.highlights;
    if (item.id === 'saju-chart' && manse) {
      result.table = manseTable(manse);
    }
    else if (item.table) result.table = { kind: 'standard', caption: item.table.caption || '', headers: item.table.headers, rows: item.table.rows };
    return result;
  });
  const chartIndex = sections.findIndex((item) => item.id === 'saju-chart');
  if (manse && chartIndex >= 0) sections.splice(chartIndex + 1, 0, shinsalSection(manse));
  // Exact location and corrected clocks are local-download-only. Delivery never
  // enables this projection, even when the separate birthday option is checked.
  if (reading.mode === 'saju' && localOnlyCorrection === true && includeBirthData) {
    const correction = sajuTimeCorrectionDisplay(reading, { includePrivate: true });
    if (correction?.privateItems.length) sections.splice(Math.max(0, chartIndex + 1), 0, { id: 'saju-local-time-basis', title: '출생지와 계산 시각', chapter: '', text: correction.summary,
      paragraphs: [correction.policy], items: [...correction.privateItems] });
  }
  if (mapping && reading.mode !== 'ziwei') sections.unshift({ id: 'mapping-explanation', title: mapping.title, chapter: '', text: mapping.source,
    paragraphs: [mapping.note], items: mapping.axes.map((axis) => `${axis.letter} · ${axis.name}\n${axis.description} ${axis.cause}\n${axis.values}\n${axis.terms.join(' / ')}`) });
  const document = { version: 1, mode: reading.mode, title: `${MODES[reading.mode]} · 나를 읽는 이야기`, subtitle: detail.label || '', summary, sections, notes: detail.notes || [] };
  if (includeBirthData) {
    const rawDate = reading.calculation?.details?.solarDate || reading.chart?.solarDate || (input?.calendar === 'solar' ? input.birthDate : '');
    const date = typeof rawDate === 'string' ? rawDate.match(/^\d{4}-\d{2}-\d{2}/)?.[0] : null;
    if (date) document.birthData = { date, time: typeof input?.birthTime === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.birthTime) ? input.birthTime : null, calendar: 'solar' };
  }
  return validateReadingPdfDocument(document, { includeBirthData });
}
