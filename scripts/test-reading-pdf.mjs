import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import vm from 'node:vm';
import { calculateReading } from '../public/experience/reading-engine.js';
import { buildReadingPdfDocument, validateReadingPdfDocument } from '../public/experience/reading-pdf-document.js';
import { buildReadingPdf, loadReadingPdfFonts, PDF_FONT_PATHS } from '../public/experience/reading-pdf.js';
import { PDFDocument } from '../public/experience/vendor/pdf-lib.esm.min.js';
import fontkit from '../public/experience/vendor/fontkit-bundle.js';
import { buildManseView } from '../public/experience/manse-view.js';
import { buildReadingDetail, readingResultSummary } from '../public/experience/reading-detail.js';
import { reportSegments, reportBlocks } from '../public/experience/report-format.js';
import { buildZiweiStructure } from '../public/experience/ziwei-structure.js';

const experience = new URL('../public/experience/', import.meta.url);
const sandbox = {}; sandbox.self = sandbox; sandbox.window = sandbox; vm.createContext(sandbox);
for (const file of ['lunar.js', 'iztro.min.js']) vm.runInContext(await readFile(new URL(`vendor/${file}`, experience), 'utf8'), sandbox);
Object.assign(globalThis, { Solar: sandbox.Solar, Lunar: sandbox.Lunar, LunarUtil: sandbox.LunarUtil, iztro: sandbox.iztro });
const input = { birthDate: '2005-12-23', birthTime: '08:37', calendar: 'solar', leapMonth: false, gender: 'female' };
const fontBytes = { regular: new Uint8Array(await readFile(new URL('fonts/sai-pdf-regular.ttf', experience))), bold: new Uint8Array(await readFile(new URL('fonts/sai-pdf-bold.ttf', experience))) };
const coverage = { regular: new Set(fontkit.create(fontBytes.regular).characterSet), bold: new Set(fontkit.create(fontBytes.bold).characterSet) };
const outputs = new URL('../output/pdf/', import.meta.url);
let checks = 0;
function check(label, run) { run(); checks++; console.log(`PASS ${label}`); }
function assertGlyphCoverage(document) {
  const normalized = JSON.stringify(document).replace(/[\u2011\u2012\u2013\u2014\u2212]/g, '-');
  for (const char of normalized) if (!/[\s]/u.test(char)) for (const [weight, set] of Object.entries(coverage)) assert.ok(set.has(char.codePointAt(0)), `${weight} missing U+${char.codePointAt(0).toString(16)} ${char}`);
}
const ZIWEI_FINAL = '이 해석은 전통 자미두수의 상징 체계에 따른 참고 관점이며, 중요한 현실 결정은 사실 정보와 전문 조언을 함께 검토해야 합니다.';
const fixtures = {};
let sajuSamplePageCount = 0;
for (const mode of ['saju', 'ziwei', 'zodiac']) {
  const reading = calculateReading({ ...input, mode }, { asOf: '2026-10-23 12:00:00' });
  const document = buildReadingPdfDocument({ reading, input }); fixtures[mode] = document;
  check(`${mode}: bounded detailed document and DOB exclusion`, () => {
    assert.equal(document.mode, mode); assert.equal(document.version, 1);
    assert.ok(document.sections.length > 5); assert.ok(!document.birthData);
    assert.ok(document.sections.every((section) => section.id !== 'calculation'));
    assert.doesNotMatch(JSON.stringify(document), /2005-12-23|08:37|female|gender/);
  });
  check(`${mode}: zero missing Korean, Hanja, Latin or punctuation glyphs in both weights`, () => {
    assertGlyphCoverage(document);
  });
  if (mode !== 'zodiac') check(`${mode}: authored semantic phrases and editorial paragraph breaks survive the PDF contract`, () => {
    const detail = buildReadingDetail(reading, input);
    const highlighted = detail.sections.filter((section) => section.highlights?.length);
    assert.ok(highlighted.length > 0, 'the report must include meaningful authored emphasis');
    for (const section of highlighted) {
      const copy = document.sections.find((candidate) => candidate.id === section.id);
      assert.deepEqual(copy.highlights, section.highlights);
      const prose = [copy.text, ...copy.paragraphs, ...copy.items];
      assert.ok(copy.highlights.every((phrase) => prose.some((value) => value.includes(phrase))));
      assert.ok(prose.some((value) => reportSegments(value, copy.highlights).some((segment) => segment.semantic && segment.strong)));
    }
    assert.ok(document.sections.some((section) => section.paragraphs.some((value) => reportBlocks(value).length > 1)), 'intentional blank-separated report blocks must be retained');
  });
  if (mode !== 'zodiac') check(`${mode}: PDF copy explains personality and its basis, without assigning homework`, () => {
    const prose = [document.title, document.subtitle, ...document.summary.flatMap((item) => [item.label, item.text]),
      ...document.sections.flatMap((section) => [section.title, section.text, ...section.paragraphs, ...section.items]), ...document.notes].join('\n');
    assert.doesNotMatch(prose, /보세요|주세요|답해|적어\s*보|기록해|작성해|체크해|떠올려|남겨\s*두세요|자기 성찰 질문|균형을 위한 질문|실제 상황 선택|구체적인 실천|관찰 질문|숙제|실천\s*계획|시도할 행동|확인할 날짜|90일\s*행동|현실 비교 과제|[?？]/u);
    if (mode === 'saju') {
      assert.equal(document.summary[0].text, readingResultSummary(reading));
      assert.match(document.summary[0].text, /사주 원국의 상징을 성향으로 연결한 설명/);
      assert.equal(document.sections.find((section) => section.id === 'reflection').title, '성향 해석의 연결 기준');
      assert.equal(document.sections.find((section) => section.id === 'saju-conclusion').title, '이 원국에서 연결되는 핵심 성향');
    }
  });
  if (mode === 'ziwei') check('Ziwei PDF is the ten-stage prompt report, without MBTI preface', () => {
    assert.deepEqual(document.summary, []);
    assert.ok(document.sections.every((section) => section.id !== 'mapping-explanation'));
    for (const id of ['ziwei-guidance', 'ziwei-input-state', 'ziwei-palaces', ...Array.from({ length: 10 }, (_, index) => `ziwei-stage-${String(index + 1).padStart(2, '0')}`), 'ziwei-final-disclosure']) assert.equal(document.sections.filter((section) => section.id === id).length, 1, id);
    assert.equal(document.sections[0].id, 'ziwei-guidance');
    assert.equal(document.sections[1].id, 'ziwei-input-state');
    const final = document.sections.find((section) => section.id === 'ziwei-final-disclosure');
    const finalText = [final.text, ...final.paragraphs, ...final.items].filter(Boolean).join('\n').trim();
    assert.ok(finalText.endsWith(ZIWEI_FINAL), 'the prompt final sentence must be preserved exactly');
    const decadal = buildZiweiStructure(reading).decadals;
    assert.equal(decadal.ageSource, 'calculated');
    assert.equal(decadal.calculatedAge, 22, 'nominal age follows the actual lunar year, not the Gregorian birthday');
    assert.equal(decadal.referenceDate, '2026-10-23');
    assert.equal(decadal.referenceLunarYear, 2026); assert.equal(decadal.birthLunarYear, 2005);
    assert.equal(decadal.ageConvention, 'nominal');
    assert.deepEqual(decadal.current.range, [22, 31]); assert.equal(decadal.currentStartDate, '2026-02-17');
    assert.deepEqual(decadal.next.range, [32, 41]); assert.equal(decadal.nextTransitionDate, '2036-01-28');
    const timing = JSON.stringify(document.sections.find((section) => section.id === 'ziwei-stage-09'));
    assert.match(timing, /22세\(허세\)/);
    assert.doesNotMatch(timing, /나이 미입력|현재 나이\s*[:·]\s*21/);
    assert.ok(document.sections.some((section) => section.id === 'ziwei-decadal-evidence'));
    const noReference = structuredClone(reading); delete noReference.chart.referenceDate;
    const restricted = buildReadingPdfDocument({ reading: noReference });
    assert.match(JSON.stringify(restricted.sections.find((section) => section.id === 'ziwei-stage-09')), /대운 분석 제한/,
      'older records without a reference date must not infer a current cycle');
    const conclusion = document.sections.find((section) => section.id === 'ziwei-stage-10');
    assert.equal(conclusion.title, '해석 종합');
    assert.match(conclusion.paragraphs[1], /중심 성향이 나온 이유/);
    assert.match(conclusion.paragraphs[2], /명궁은 판단의 기준, 신궁은 힘이 실리는 행동 영역, 복덕궁은 만족과 회복의 방식/);
    for (const section of document.sections.filter((candidate) => /^ziwei-stage-\d+$/.test(candidate.id))) {
      assert.equal(section.paragraphs.length, 3);
      assert.equal(section.paragraphs[2].split('\n')[0], 'Disclosure · 해석 범위와 조건');
    }
  });
  if (mode === 'saju') check('rounded manse grid contract keeps four pillars and Hangul/Hanja', () => {
    const table = document.sections.find((section) => section.id === 'saju-chart').table;
    assert.equal(table.kind, 'manse'); assert.deepEqual(table.headers, ['항목', '생시', '생일', '생월', '생년']);
    assert.match(table.rows[0][1], /임壬\n\+수/); assert.match(table.rows[0][2], /신辛\n-금/);
  });
  if (mode === 'saju') check('separate PDF natal stem/branch table matches actual calculated layers', () => {
    const chartIndex = document.sections.findIndex((section) => section.id === 'saju-chart');
    const chartSection = document.sections[chartIndex];
    const section = document.sections[chartIndex + 1], table = section.table;
    const view = buildManseView(reading);
    assert.equal(section.id, 'saju-shinsal'); assert.equal(section.title, '나의 귀인·신살');
    assert.equal(chartSection.table.rows.length, 8); assert.ok(chartSection.table.rows.every((row) => row[0] !== '길성'));
    assert.equal(table.kind, 'manse'); assert.deepEqual(table.headers, ['항목', '생시', '생일', '생월', '생년']);
    assert.deepEqual(table.rows.map((row) => row[0]), ['천간', '귀인·신살', '지지', '귀인·신살', '12신살\n(연지/일지)']);
    assert.ok(Array.isArray(view.auspicious?.supported));
    for (const name of view.auspicious.supported) for (const char of name) for (const [weight, set] of Object.entries(coverage)) assert.ok(set.has(char.codePointAt(0)), `${weight} missing supported natal label ${name}`);
    for (const [index, column] of view.columns.entries()) {
      for (const [rowIndex, layer] of [[1, 'stem'], [3, 'branch']]) {
        assert.ok(column.missing || Array.isArray(column.auspiciousByLayer?.[layer]));
        const names = column.auspiciousByLayer?.[layer];
        assert.equal(table.rows[rowIndex][index + 1], column.missing ? '모름' : names.length ? names.join('\n') : '—');
      }
      assert.ok(column.missing || (typeof column.twelveStars?.year === 'string' && typeof column.twelveStars?.day === 'string'));
      assert.equal(table.rows[4][index + 1], column.missing ? '모름' : `연지 기준: ${column.twelveStars.year}\n일지 기준: ${column.twelveStars.day}`);
    }
    assert.ok(Array.isArray(view.auspicious?.notes));
    for (const note of view.auspicious.notes) { assert.ok(section.items.includes(note), 'calculated natal-method note must be preserved'); assert.ok(!chartSection.items.includes(note), 'method note belongs to the separate natal section'); }
    const unknownInput = { ...input, mode, birthTime: null };
    const unknown = calculateReading(unknownInput, { asOf: '2026-10-23 12:00:00' });
    const unknownTable = buildReadingPdfDocument({ reading: unknown, input: unknownInput }).sections.find((section) => section.id === 'saju-shinsal').table;
    assert.ok(unknownTable.rows.every((row) => row[1] === '모름'));
  });
  if (process.argv.includes('--samples')) {
    // The parent task must mark the artifact operation before this opt-in path.
    await mkdir(outputs, { recursive: true });
    const bytes = await buildReadingPdf({ document, fontBytes });
    assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
    const parsed = await PDFDocument.load(bytes);
    assert.ok(parsed.getPageCount() > 0 && parsed.getPageCount() <= 40);
    if (mode === 'saju') sajuSamplePageCount = parsed.getPageCount();
    const again = await buildReadingPdf({ document, fontBytes });
    assert.deepEqual(bytes, again, 'same document and font bytes must be retry-deterministic');
    await writeFile(new URL(`sai-${mode}-sample.pdf`, outputs), bytes);
    console.log(`PASS ${mode}: ${parsed.getPageCount()} pages, ${bytes.length} bytes, repeat bytes identical`); checks++;
  }
}
for (const outputMode of ['QUICK', 'STANDARD', 'DEEP']) check(`Ziwei ${outputMode} options reach report without a new document schema`, () => {
  const ziweiInput = { ...input, mode: 'ziwei', ziweiReport: { mode: outputMode, boundary: 'unknown', asOf: '2026-10-23', focus: 'career' } };
  const result = calculateReading(ziweiInput, { asOf: '2026-10-23 12:00:00' });
  const document = buildReadingPdfDocument({ reading: result, input: ziweiInput });
  const state = JSON.stringify(document.sections.find((section) => section.id === 'ziwei-input-state'));
  assert.match(state, new RegExp(outputMode));
  assert.match(state, /22세/);
  assert.match(state, /자동 계산/);
  assert.ok(document.sections.length <= 80);
  assertGlyphCoverage(document);
  fixtures[`ziwei-${outputMode}`] = document;
});
if (process.argv.includes('--samples')) {
  // Synthetic renderer-only stress, never saved, sent, or presented as a chart.
  // Repeat the actual label vocabulary to exercise much longer name lists than
  // the real fixture, preserving the real generated samples above unchanged.
  const stress = structuredClone(fixtures.saju);
  const table = stress.sections.find((section) => section.id === 'saju-shinsal').table;
  const vocabulary = [...new Set(table.rows.filter((_, index) => [1, 3].includes(index)).flatMap((row) => row.slice(1)).flatMap((value) => value.split('\n')).filter((value) => !['—', '모름', '미확인'].includes(value)))];
  assert.ok(vocabulary.length > 0);
  const longNames = Array.from({ length: 20 }, (_, index) => vocabulary[index % vocabulary.length]).join('\n');
  for (const rowIndex of [1, 3]) for (let column = 1; column < 5; column++) table.rows[rowIndex][column] = longNames;
  const stressBytes = await buildReadingPdf({ document: stress, fontBytes });
  const parsedStress = await PDFDocument.load(stressBytes);
  assert.ok(parsedStress.getPageCount() > sajuSamplePageCount && parsedStress.getPageCount() <= 40, 'long lists must paginate, not truncate');
  checks++; console.log(`PASS synthetic long-name pagination: ${parsedStress.getPageCount()} pages; generated in memory only`);
  for (const outputMode of ['QUICK', 'DEEP']) {
    const bytes = await buildReadingPdf({ document: fixtures[`ziwei-${outputMode}`], fontBytes });
    const parsed = await PDFDocument.load(bytes);
    assert.ok(parsed.getPageCount() > 0 && parsed.getPageCount() <= 40);
    checks++; console.log(`PASS Ziwei ${outputMode} PDF: ${parsed.getPageCount()} pages; generated in memory only`);
  }
  // These synthetic placements previously exceeded the 40-page production
  // cap despite the default fixture passing. Check both calculation sexes;
  // the real charts, text hierarchy, body font size and page cap stay intact.
  for (const [birthDate, birthTime] of [['1970-04-15', '08:37'], ['1980-08-15', '16:37'], ['2000-06-15', '16:37']]) {
    for (const gender of ['female', 'male']) {
      const selectedInput = { ...input, mode: 'ziwei', birthDate, birthTime, gender, ziweiReport: { mode: 'DEEP', asOf: '2026-10-23' } };
      const reading = calculateReading(selectedInput, { asOf: '2026-10-23 12:00:00' });
      const document = buildReadingPdfDocument({ reading, input: selectedInput }); assertGlyphCoverage(document);
      const bytes = await buildReadingPdf({ document, fontBytes }), parsed = await PDFDocument.load(bytes);
      assert.ok(parsed.getPageCount() > 0 && parsed.getPageCount() <= 40);
      checks++; console.log(`PASS Ziwei DEEP cap regression ${birthDate}/${birthTime}/${gender}: ${parsed.getPageCount()} pages; memory only`);
    }
  }
}
check('strict validation rejects arbitrary HTML, URL, attachments and unknown keys', () => {
  for (const patch of [{ title: '<script>x</script>' }, { title: 'https://example.com' }, { attachment: 'base64' }, { sections: [{ ...fixtures.saju.sections[0], html: 'x' }] }]) assert.throws(() => validateReadingPdfDocument({ ...fixtures.saju, ...patch }));
});
check('privacy boundary rejects birthData and calculation section without explicit inclusion', () => {
  const reading = calculateReading({ ...input, mode: 'saju' }, { asOf: '2026-10-23 12:00:00' });
  const local = buildReadingPdfDocument({ reading, input, includeBirthData: true });
  assert.deepEqual(local.birthData, { date: input.birthDate, time: input.birthTime, calendar: 'solar' });
  assert.ok(local.sections.some((section) => section.id === 'calculation'));
  assert.throws(() => validateReadingPdfDocument(local));
  assert.deepEqual(validateReadingPdfDocument(local, { includeBirthData: true }), local);
});
check('limits reject oversized sections, table and document text', () => {
  assert.throws(() => validateReadingPdfDocument({ ...fixtures.saju, sections: Array(81).fill(fixtures.saju.sections[0]) }));
  assert.throws(() => validateReadingPdfDocument({ ...fixtures.saju, title: 'x'.repeat(161) }));
  assert.throws(() => validateReadingPdfDocument({ ...fixtures.saju, notes: Array(31).fill('x') }));
});
check('optional semantic highlight contract is bounded, literal, deduplicated and backward compatible', () => {
  const make = (highlights, paragraphs = ['관찰한 정보를 연결해 계획을 세우고, 조건이 바뀌면 방법도 고쳐요.\n\n1. 작은 실험 하나를 정해 실행해 봐요.']) => ({
    ...fixtures.saju, sections: [{ id: 'semantic-test', title: '성격과 실천', chapter: '', text: '', paragraphs, items: [], ...(highlights === undefined ? {} : { highlights }) }],
  });
  const phrases = ['관찰한 정보를 연결해 계획', '정보를 연결해 계획을 세우고', '작은 실험 하나'];
  const valid = validateReadingPdfDocument(make(phrases));
  assert.deepEqual(valid.sections[0].highlights, phrases);
  assert.ok(!Object.hasOwn(validateReadingPdfDocument(make(undefined)).sections[0], 'highlights'));
  const value = valid.sections[0].paragraphs[0], segments = reportSegments(value, phrases);
  assert.equal(segments.map((part) => part.text).join(''), value, 'overlapping highlights must never duplicate or drop prose');
  assert.equal(segments.filter((part) => part.semantic).length, 2, 'overlap is one contiguous semantic span');
  assert.equal(reportBlocks(value).length, 2);
  for (const highlights of [null, '관찰', [''], ['본문에 없는 문구'], ['작은 실험 하나', ' 작은 실험 하나 '], Array(13).fill('작은 실험 하나'), ['<strong>관찰</strong>'], ['https://example.com']]) assert.throws(() => validateReadingPdfDocument(make(highlights)));
  assert.throws(() => validateReadingPdfDocument(make(['가'.repeat(181)], ['가'.repeat(181)])));
});
{
  const originalFetch = globalThis.fetch, requests = [];
  try {
    globalThis.fetch = async (path, options) => { requests.push({ path, options }); return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2]).buffer }; };
    const loaded = await loadReadingPdfFonts();
    assert.deepEqual(Object.keys(loaded).sort(), ['bold', 'regular']);
    assert.deepEqual(requests.map((request) => request.path).sort(), Object.values(PDF_FONT_PATHS).sort());
    assert.ok(requests.every((request) => request.options.credentials === 'same-origin' && request.options.cache === 'no-cache'));
    checks++; console.log('PASS font loading revalidates only the same-origin allowlisted font paths');
  } finally { globalThis.fetch = originalFetch; }
}
if (process.argv.includes('--samples')) {
  await writeFile(new URL('sai-pdf-highlight-expectations.json', outputs), JSON.stringify(Object.fromEntries(['saju', 'ziwei'].map((mode) => [mode,
    fixtures[mode].sections.flatMap((section) => section.highlights || [])])), null, 2));
}
console.log(`${checks} PDF contract/generation groups passed.`);
