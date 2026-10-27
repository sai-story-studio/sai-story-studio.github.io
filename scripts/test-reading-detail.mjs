import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { buildReadingDetail, readingResultSummary } from '../public/experience/reading-detail.js';
import { calculateReading as calculateEngineReading } from '../public/experience/reading-engine.js';
import { getZodiacProfile } from '../public/experience/zodiac-profiles.js';
import { buildReadingPdfDocument } from '../public/experience/reading-pdf-document.js';
import { buildZiweiStructure } from '../public/experience/ziwei-structure.js';

const experience = new URL('../public/experience/', import.meta.url);
const sandbox = {};
sandbox.self = sandbox; sandbox.window = sandbox;
vm.createContext(sandbox);
for (const filename of ['lunar.js', 'iztro.min.js']) {
  vm.runInContext(await readFile(new URL(`vendor/${filename}`, experience), 'utf8'), sandbox);
}
const previous = { Solar: globalThis.Solar, Lunar: globalThis.Lunar, LunarUtil: globalThis.LunarUtil, iztro: globalThis.iztro };
Object.assign(globalThis, { Solar: sandbox.Solar, Lunar: sandbox.Lunar, LunarUtil: sandbox.LunarUtil, iztro: sandbox.iztro });
const calculateReading = (value, options = {}) => calculateEngineReading(value, { asOf: '2026-10-22 12:00:00', ...options });
const input = { mode: 'saju', birthDate: '2005-12-23', birthTime: '08:37', calendar: 'solar', leapMonth: false, gender: 'female' };
const LEGACY_SAJU_IDS = ['saju-reading-order', 'saju-ten-gods', 'saju-elements', 'saju-terms'];
const LEGACY_SAJU_TITLES = ['처음 볼 때는 이렇게 읽어요', '내 표에 있는 십성을 쉽게 읽기', '오행은 두 가지 수치를 나누어 봐요', '낯선 만세력 용어 풀이'];
const body = (detail) => detail.sections.flatMap((item) => [item.text, ...(item.paragraphs || []), ...item.items, ...(item.table ? [item.table.caption, ...item.table.headers, ...item.table.rows.flat()] : [])]).join('\n');
let checks = 0;
function check(label, run) { run(); checks++; console.log(`PASS ${label}`); }
try {
  check('known saju day pillar, stem/branch and actual weighted elements', () => {
    const result = calculateReading(input), before = JSON.stringify(result), detail = buildReadingDetail(result, input);
    assert.equal(detail.heading, '나에 대해 더 알아가는 시간');
    assert.match(detail.label, /신사\(辛巳\)/);
    assert.match(body(detail), /일간.*신\(辛\).*금\(金\)/);
    assert.match(body(detail), /일지.*사\(巳\).*화\(火\)/);
    assert.match(body(detail), /壬辰.*포함/);
    for (const element of result.chart.elements) assert.ok(body(detail).includes(`${element.label} ${element.count}`));
    assert.equal(JSON.stringify(result), before);
    assert.deepEqual(buildReadingDetail(result, input), detail);
  });
  check('unknown time omits invented time pillar and preserves uncertainty', () => {
    const unknown = { ...input, birthTime: null };
    const result = calculateReading(unknown), detail = buildReadingDetail(result, unknown);
    assert.match(body(detail), /생시 미상.*시주·시주 오행은 포함하지 않았/);
    assert.match(body(detail), /절입 당일.*불확실/);
    assert.doesNotMatch(body(detail), /계산된 시주/);
  });
  check('real conventional zodiac boundaries are preserved, not inferred from input', () => {
    for (const [birthDate, sign] of [['2000-01-19', '염소자리'], ['2000-01-20', '물병자리'], ['2000-03-21', '양자리']]) {
      const result = calculateReading({ ...input, mode: 'zodiac', birthDate });
      const detail = buildReadingDetail(result, { ...input, birthDate: '2000-10-23' });
      assert.ok(detail.label.includes(sign));
      assert.ok(body(detail).includes(result.calculation.details.dateRange));
      assert.match(body(detail), /실제 태양의 황경.*계산하지/);
    }
  });
  check('actual Ziwei soul-palace stars are distinct from opposite borrowing', () => {
    const own = calculateReading({ ...input, mode: 'ziwei', birthDate: '2000-08-16', birthTime: '03:00' });
    assert.deepEqual(own.calculation.details.majorStars, ['자미']);
    const detail = buildReadingDetail(own, input);
    assert.match(detail.label, /명궁 자미/);
    const fact = detail.sections.find((section) => section.id === 'ziwei-stage-01').paragraphs[0];
    const soulFact = fact.split('\n').find((line) => line.startsWith('명궁 '));
    assert.match(soulFact, /본궁 주성 자미/);
    assert.doesNotMatch(soulFact, /차성 출처/);
    assert.match(detail.label, /명궁·신궁·복덕궁으로/);
  });
  check('real empty palace is clearly labelled with actual opposite stars', () => {
    const result = Array.from({ length: 24 }, (_, hour) => calculateReading({ ...input, mode: 'ziwei', birthDate: '2000-08-16', birthTime: `${String(hour).padStart(2, '0')}:00` }))
      .find((item) => item.calculation.details.mappingSource === 'oppositePalace');
    assert.ok(result);
    const detail = buildReadingDetail(result, input);
    assert.match(detail.label, /명궁 공궁.*천이궁.*차성/);
    const soulFact = detail.sections.find((section) => section.id === 'ziwei-stage-01').paragraphs[0].split('\n').find((line) => line.startsWith('명궁 '));
    assert.match(soulFact, /주성 없음\(공궁\).*차성 출처: 대궁 천이궁/);
    for (const star of result.calculation.details.majorStars) assert.ok(soulFact.includes(star));
    assert.doesNotMatch(soulFact, /본궁 주성/);
    const soulRow = detail.sections.find((section) => section.id === 'ziwei-palaces').table.rows.find((row) => row[0].startsWith('명궁 '));
    assert.equal(soulRow[2], '주성 없음(공궁)');
  });
  check('missing data stays missing; incomplete input never supplies chart facts', () => {
    for (const mode of ['saju', 'zodiac', 'ziwei']) {
      const detail = buildReadingDetail({ mode }, input);
      assert.doesNotMatch(body(detail), /辛巳|신사|壬辰|자미:|계산된 별자리:/);
      assert.match(body(detail), /없|확인/);
    }
    assert.equal(buildReadingDetail(null, input).mode, 'unknown');
  });
  check('inconsistent day pillar, sign and star-source data is not disguised', () => {
    const saju = calculateReading(input);
    saju.chart.pillars.find((item) => item.key === 'day').ganZhi = '甲子';
    assert.match(body(buildReadingDetail(saju)), /일주 세부 정보가 없거나 서로 일치하지 않아/);
    const zodiac = calculateReading({ ...input, mode: 'zodiac' });
    zodiac.chart.name = '양자리';
    assert.match(body(buildReadingDetail(zodiac)), /별자리 세부 정보가 서로 달라/);
    const ziwei = calculateReading({ ...input, mode: 'ziwei' });
    ziwei.calculation.details.mappingSource = 'oppositePalace';
    ziwei.calculation.details.originalMajorStars = ['자미'];
    const restricted = buildReadingDetail(ziwei);
    assert.match(body(restricted), /명궁·신궁·12궁의 일관된 자료가 확인되지 않았/);
    assert.equal(restricted.sections.find((section) => section.id === 'ziwei-palaces'), undefined);
    assert.equal(restricted.sections.filter((section) => /^ziwei-stage-\d{2}$/.test(section.id)).length, 10);
  });
  check('expanded sections remain serializable plain text with clear limitations', () => {
    for (const mode of ['saju', 'zodiac', 'ziwei']) {
      const result = calculateReading({ ...input, mode });
      const detail = buildReadingDetail(result, { ...input, mode });
      const balance = result.sections?.find((item) => item.title === '균형을 위한 질문');
      assert.ok(detail.sections.length >= 7);
      if (mode === 'zodiac') assert.ok(detail.sections.length <= 13);
      if (mode === 'ziwei') assert.ok(detail.sections.length <= 40);
      if (mode !== 'ziwei') assert.ok(['calculation', 'symbols', 'reflection'].every((id) => detail.sections.some((section) => section.id === id)));
      assert.equal(new Set(detail.sections.map((section) => section.id)).size, detail.sections.length);
      assert.equal(detail.sections.at(-1).id, mode === 'ziwei' ? 'ziwei-final-disclosure' : 'reflection');
      if (mode === 'zodiac' && balance) assert.equal(detail.sections.find((item) => item.id === 'reflection').text, balance.text);
      assert.ok(detail.sections.every((item) => typeof item.text === 'string' && item.items.every((value) => typeof value === 'string')));
      assert.ok(detail.sections.every((item) => !item.paragraphs || item.paragraphs.every((value) => typeof value === 'string')));
      for (const section of detail.sections.filter((item) => item.table)) {
        assert.equal(typeof section.table.caption, 'string');
        assert.ok(section.table.headers.length >= 2 && section.table.headers.every((cell) => typeof cell === 'string'));
        assert.ok(section.table.rows.every((row) => row.length === section.table.headers.length && row.every((cell) => typeof cell === 'string')));
      }
      if (mode === 'ziwei') {
        assert.equal(detail.sections[0].id, 'ziwei-guidance');
        assert.equal(detail.sections[1].id, 'ziwei-input-state');
        assert.equal(detail.sections.filter((section) => /^ziwei-stage-\d{2}$/.test(section.id)).length, 10);
        assert.match(detail.sections[0].text, /검증된 예측·의학적 진단·법률·투자 조언이 아닙니다/);
        assert.ok(!detail.notes.some((note) => note.includes('정식 MBTI 검사')));
      } else {
        assert.ok(detail.notes.some((note) => note.includes('정식 MBTI 검사')));
        assert.ok(detail.notes.some((note) => note.includes('미래를 확정하지')));
      }
      assert.deepEqual(JSON.parse(JSON.stringify(detail)), detail);
    }
  });
  check('manse table retains real metadata and the prompt report uses actual literal counts', () => {
    for (const birthTime of ['08:37', null]) {
      const result = calculateReading({ ...input, birthTime });
      const detail = buildReadingDetail(result, { ...input, birthTime });
      const table = detail.sections.find((section) => section.id === 'saju-chart').table;
      assert.equal(table.headers.length, birthTime ? 5 : 4);
      assert.deepEqual(table.headers.slice(1), result.chart.pillars.map((pillar) => pillar.label));
      for (const [index, pillar] of result.chart.pillars.entries()) {
        const column = table.rows.map((row) => row[index + 1]).join('\n');
        for (const raw of [pillar.stem, pillar.branch, pillar.stemTenGod, pillar.growthStage, pillar.naYin, ...pillar.hiddenStems, ...pillar.branchTenGods]) assert.ok(column.includes(raw));
        for (const branch of pillar.voidBranches) assert.ok(column.includes(branch));
      }
      const counts = Object.fromEntries(['목', '화', '토', '금', '수'].map((key) => [key, 0]));
      for (const pillar of result.chart.pillars) for (const element of pillar.elements) counts[element]++;
      assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), birthTime ? 8 : 6);
      assert.equal(result.chart.elements.reduce((sum, element) => sum + element.count, 0), birthTime ? 9 : 7);
      const structure = detail.sections.find((section) => section.id === 'symbols').paragraphs.join('\n');
      assert.ok(structure.includes(`본오행 글자 수는 ${Object.entries(counts).map(([key, count]) => `${key} ${count}`).join(' · ')}`));
      assert.match(body(detail), /천간·지지의 본오행 각 1회와 일간 추가 1회/);
      assert.ok(detail.notes.some((note) => /실제 성격·능력·관계·미래를 확정하지/.test(note)));
      assert.ok(detail.notes.some((note) => /용신·격국·신강신약.*대운·세운의 길흉/.test(note)));
      assert.ok(!detail.notes.some((note) => /대운·세운·용신.*판정하지/.test(note)));
    }
  });
  check('missing manse metadata stays missing and a mismatched pillar hides the table', () => {
    const result = calculateReading(input);
    for (const pillar of result.chart.pillars) {
      pillar.hiddenStems = []; pillar.stemTenGod = null; pillar.branchTenGods = [];
      pillar.growthStage = null; pillar.naYin = null; pillar.voidBranches = null;
    }
    const table = buildReadingDetail(result, input).sections.find((section) => section.id === 'saju-chart').table;
    assert.ok(table.rows.find((row) => row[0] === '납음').slice(1).every((cell) => cell === '미확인'));
    result.chart.pillars.find((pillar) => pillar.key === 'year').ganZhi = '甲子';
    const detail = buildReadingDetail(result, input);
    assert.equal(detail.sections.find((section) => section.id === 'saju-chart').table, undefined);
    assert.match(body(detail), /원국의 세부 정보가 없거나 서로 일치하지/);
  });
  check('twelve zodiac profiles have brief unique summaries and distinct detailed categories', () => {
    const dates = ['2000-01-25', '2000-02-25', '2000-03-25', '2000-04-25', '2000-05-25', '2000-06-25', '2000-07-25', '2000-08-25', '2000-09-25', '2000-10-25', '2000-11-25', '2000-12-25'];
    const summaries = new Set();
    for (const birthDate of dates) {
      const result = calculateReading({ ...input, mode: 'zodiac', birthDate });
      const profile = getZodiacProfile(result.chart.name);
      assert.ok(profile.summary.length <= 140 && profile.keywords.length <= 4);
      summaries.add(profile.summary);
      const detail = buildReadingDetail(result);
      for (const id of ['strengths', 'cautions', 'relationships', 'work']) {
        assert.equal(detail.sections.find((section) => section.id === id).items.length, 2);
      }
      assert.ok(body(detail).includes(profile.ruler));
      assert.match(body(detail), /달 별자리·상승궁·행성 배치와 각도는 계산하지/);
      const first = getZodiacProfile(result.chart.name); first.strengths[0] = 'mutated';
      assert.notEqual(getZodiacProfile(result.chart.name).strengths[0], 'mutated');
    }
    assert.equal(summaries.size, 12);
    assert.equal(getZodiacProfile('없는 별자리'), null);
  });
  check('inconsistent zodiac element or modality cannot produce sign-specific traits', () => {
    for (const key of ['element', 'modality']) {
      const result = calculateReading({ ...input, mode: 'zodiac', birthDate: '2000-03-25' });
      result.chart[key] = key === 'element' ? '물' : '고정궁';
      const detail = buildReadingDetail(result);
      assert.match(body(detail), /별자리 세부 정보가 서로 달라/);
      assert.equal(detail.sections.find((section) => section.id === 'strengths'), undefined);
      assert.doesNotMatch(body(detail), /양자리는 먼저 시도/);
    }
  });
  check('twelve actual Ziwei palaces and related palaces use real indexes and star marks', () => {
    const brightness = { '[+3]': '묘(廟)', '[+2]': '왕(旺)', '[+1]': '득(得)', '[0]': '리(利)', '[-1]': '평(平)', '[-2]': '불(不)', '[-3]': '함(陷)' };
    for (const birthTime of ['03:00', '08:37', '23:00']) {
      const result = calculateReading({ ...input, mode: 'ziwei', birthDate: '2000-08-16', birthTime });
      const before = JSON.stringify(result), detail = buildReadingDetail(result);
      const structure = buildZiweiStructure(result);
      const table = detail.sections.find((section) => section.id === 'ziwei-palaces').table;
      assert.equal(table.rows.length, 12);
      const allMajor = result.chart.palaces.flatMap((palace) => palace.majorStars.map((star) => star.name));
      assert.equal(allMajor.length, 14);
      assert.equal(new Set(allMajor).size, 14);
      for (const palace of result.chart.palaces) {
        const row = table.rows[palace.index].join(' ');
        assert.ok(row.includes(palace.name));
        for (const star of [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars]) {
          assert.ok(row.includes(star.name));
          if (star.brightness) assert.ok(row.includes(brightness[star.brightness] || star.brightness));
        }
      }
      const basis = detail.sections.find((section) => section.id === 'ziwei-basis-01');
      assert.ok(detail.sections.indexOf(basis) < detail.sections.findIndex((section) => section.id === 'ziwei-stage-01'));
      const related = basis.table;
      assert.ok(related.rows.length >= 4);
      assert.deepEqual(related.rows.slice(0, 4).map((row) => row[1]), ['본궁', '대궁', '삼합궁 1', '삼합궁 2']);
      const ref = structure.triads.find((item) => item.targetIndex === structure.anchors.soulIndex);
      for (const [index, field] of ['targetIndex', 'oppositeIndex', 'wealthIndex', 'careerIndex'].entries()) {
        const palace = result.chart.palaces.find((item) => item.index === ref[field]);
        assert.ok(related.rows[index][2].includes(palace.name));
        assert.ok(related.rows[index][2].includes(palace.heavenlyStem + palace.earthlyBranch));
      }
      const bodyPalace = result.chart.palaces.find((palace) => palace.index === structure.anchors.bodyIndex);
      assert.ok(table.rows[bodyPalace.index][0].includes('신궁'));
      assert.match(body(detail), /명궁은 자기 인식, 신궁은 행동과 에너지가 실리는 보조 축, 복덕궁은 만족과 회복/);
      assert.ok(detail.notes.some((note) => /보조성·사화의 단독 표기로 성공·실패·질병·이별을 판단하지/.test(note)));
      assert.equal(JSON.stringify(result), before);
    }
  });
  check('incomplete, duplicate or mismatched Ziwei palace data is never filled in', () => {
    const original = calculateReading({ ...input, mode: 'ziwei', birthDate: '2000-08-16', birthTime: '03:00' });
    for (const change of [
      (result) => result.chart.palaces.pop(),
      (result) => { result.chart.palaces[1].index = result.chart.palaces[0].index; },
      (result) => { result.chart.palaces.find((palace) => palace.name === '명궁').majorStars = []; },
    ]) {
      const result = structuredClone(original); change(result);
      const detail = buildReadingDetail(result);
      assert.equal(detail.sections.find((section) => section.id === 'ziwei-palaces')?.table, undefined);
      assert.match(body(detail), /명궁·신궁·12궁의 일관된 자료가 확인되지 않았/);
      assert.equal(detail.sections.filter((section) => /^ziwei-stage-\d{2}$/.test(section.id)).length, 10);
    }
  });
  check('actual current and next cycles retain exact periods, symbols and full dynamic list', () => {
    for (const birthDate of [input.birthDate, '1900-01-01']) {
      const result = calculateReading({ ...input, birthDate });
      const before = JSON.stringify(result), detail = buildReadingDetail(result, { ...input, birthDate });
      const cycles = result.chart.cycles;
      assert.equal(cycles.daYun.status, 'available');
      assert.equal(cycles.liuNian.status, 'available');
      const flow = detail.sections.find((section) => section.id === 'saju-cycle-flow');
      const table = detail.sections.find((section) => section.id === 'saju-da-yun').table;
      assert.equal(table.rows.length, cycles.daYun.list.length);
      assert.ok(table.caption.includes(`${cycles.daYun.list.length}개 대운`));
      assert.match(table.caption, /엔진의 교운 시각 기준/);
      const flowText = flow.paragraphs.join('\n');
      assert.ok(flowText.includes(cycles.asOf) && flowText.includes('Asia/Seoul'));
      if (birthDate === '1900-01-01') assert.ok(table.rows.length > 9);
      for (const [label, cycle] of [['현재 대운', cycles.daYun.current], ['다음 대운', cycles.daYun.next]]) {
        assert.ok(cycle, `dynamic list must contain ${label}`);
        for (const value of [cycle.ganZhi, cycle.startSolar, cycle.endSolarExclusive, cycle.stemTenGod]) assert.ok(flowText.includes(value));
      }
      for (const [index, cycle] of cycles.daYun.list.entries()) {
        const row = table.rows[index].join('\n');
        for (const value of [cycle.ganZhi, cycle.startSolar, cycle.endSolarExclusive, cycle.stemTenGod, ...cycle.hiddenStems, ...cycle.branchTenGods]) assert.ok(row.includes(value));
        assert.ok(row.includes(`${cycle.startAge}~${cycle.endAge}세`));
      }
      const facts = detail.sections.find((section) => section.id === 'calculation').items;
      for (const rule of cycles.rules) assert.ok(facts.includes(rule));
      for (const limitation of cycles.limitations) assert.ok(detail.notes.includes(limitation));
      assert.match(body(detail), /명목 나이.*만 나이가 아니/s);
      assert.equal(JSON.stringify(result), before);
      assert.deepEqual(buildReadingDetail(result), buildReadingDetail(result));
    }
  });
  check('five annual cycles use the current Lichun year and each has a plain-language explanation', () => {
    for (const asOf of ['2026-01-01 12:00:00', '2026-10-22 12:00:00']) {
      const result = calculateReading(input, { asOf }), detail = buildReadingDetail(result, input);
      const annual = result.chart.cycles.liuNian;
      const section = detail.sections.find((section) => section.id === 'saju-liu-nian');
      assert.equal(annual.currentYear, asOf.startsWith('2026-01') ? 2025 : 2026);
      assert.equal(section.table.rows.length, 5);
      assert.equal(detail.sections.filter((section) => section.id.startsWith('saju-year-')).length, 5);
      for (const [index, year] of annual.years.entries()) {
        const row = section.table.rows[index].join('\n');
        assert.ok(row.includes(String(year.year)) && row.includes(year.ganZhi));
        for (const value of [year.startSolar, year.endSolarExclusive, year.stemTenGod, ...year.hiddenStems, ...year.branchTenGods]) assert.ok(row.includes(value));
        const narrative = detail.sections.find((section) => section.id === `saju-year-${year.year}`);
        assert.equal(narrative.paragraphs.length, 3);
        assert.ok(narrative.paragraphs[0].includes(`${year.year}년`) && narrative.paragraphs[0].includes(year.ganZhi));
        assert.ok(narrative.paragraphs[2].length > 60);
      }
      assert.match(section.text, /1월 1일이 아니라 입춘/);
      assert.equal(section.table.rows.filter((row) => row[0].includes('현재')).length, 1);
    }
  });
  check('missing cycle inputs suppress decadal cycles but keep independent annual cycles', () => {
    for (const change of [{ birthTime: null }, { gender: null }, { birthTime: null, gender: null }]) {
      const sample = { ...input, ...change }, result = calculateReading(sample), detail = buildReadingDetail(result, sample);
      assert.equal(result.chart.cycles.daYun.status, 'missing-input');
      assert.equal(detail.sections.find((section) => section.id === 'saju-da-yun')?.table, undefined);
      assert.match(detail.sections.find((section) => section.id === 'saju-cycle-flow').paragraphs.join('\n'), /대운을 보려면/);
      assert.match(body(detail), /태어난 시각과 전통 계산용 성별이 모두 필요/);
      assert.equal(detail.sections.find((section) => section.id === 'saju-liu-nian').table.rows.length, 5);
      assert.match(detail.sections.find((section) => section.id === 'saju-liu-nian').table.caption, /2026-10-22 12:00:00 기준 \(Asia\/Seoul\)/);
    }
  });
  check('before first cycle and after supported list never invent current or next cycles', () => {
    const early = calculateReading(input, { asOf: '2005-12-24 12:00:00' });
    assert.equal(early.chart.cycles.daYun.rangeStatus, 'before-first');
    assert.equal(early.chart.cycles.daYun.current, null);
    const earlyDetail = buildReadingDetail(early, input);
    assert.match(body(earlyDetail), /아직 첫 대운이 시작되기 전/);
    assert.doesNotMatch(earlyDetail.sections.find((section) => section.id === 'saju-cycle-flow').paragraphs.join('\n'), /현재는 .+ 대운입니다/);
    const late = calculateReading(input, { asOf: '2299-10-22 12:00:00' });
    assert.equal(late.chart.cycles.daYun.rangeStatus, 'after-list');
    assert.equal(late.chart.cycles.daYun.current, null);
    assert.equal(late.chart.cycles.daYun.next, null);
    const lateDetail = buildReadingDetail(late, input);
    assert.equal(lateDetail.sections.find((section) => section.id === 'saju-da-yun').table.rows.length, late.chart.cycles.daYun.list.length);
    assert.match(body(lateDetail), /현재 대운을 연장해 만들지 않았/);
    assert.match(body(lateDetail), /다음 간지를 추정하지 않았/);
  });
  check('missing or contradictory cycle day and as-of data suppresses all cycle tables', () => {
    const original = calculateReading(input);
    for (const change of [
      (result) => { delete result.chart.cycles; },
      (result) => { result.chart.cycles.dayStem = '甲'; },
      (result) => { result.chart.cycles.asOf = '2026-02-30 12:00:00'; },
      (result) => { result.chart.pillars.find((pillar) => pillar.key === 'month').ganZhi = '甲子'; },
    ]) {
      const result = structuredClone(original); change(result);
      const detail = buildReadingDetail(result, input);
      assert.equal(detail.sections.find((section) => section.id === 'saju-cycles')?.table, undefined);
      assert.equal(detail.sections.find((section) => section.id === 'saju-da-yun'), undefined);
      assert.equal(detail.sections.find((section) => section.id === 'saju-liu-nian')?.table, undefined);
      assert.equal(detail.sections.filter((section) => section.id.startsWith('saju-year-')).length, 0);
      assert.match(body(detail), /대운·세운을 표시하지 않았|원국의 기둥이 서로 일치하는지 확인하지 못/);
    }
  });
  check('partial or contradictory decadal data cannot become a plausible full table', () => {
    const original = calculateReading(input);
    for (const change of [
      (cycles) => { cycles.daYun.list.pop(); },
      (cycles) => { cycles.daYun.list[1].startSolar = '2020-06-19 02:37:00'; },
      (cycles) => { cycles.daYun.list[1].ganZhi = '甲子'; },
      (cycles) => { cycles.daYun.list[1].hiddenStems = []; },
      (cycles) => { cycles.daYun.current = { ...cycles.daYun.current, stemTenGod: '正官' }; },
      (cycles) => { cycles.daYun.next = null; },
      (cycles) => { cycles.daYun.direction = null; },
    ]) {
      const result = structuredClone(original); change(result.chart.cycles);
      const detail = buildReadingDetail(result, input);
      assert.equal(detail.sections.find((section) => section.id === 'saju-da-yun')?.table, undefined);
      assert.doesNotMatch(detail.sections.find((section) => section.id === 'saju-cycle-flow').paragraphs.join('\n'), /현재는 .+ 대운입니다/);
      assert.equal(detail.sections.find((section) => section.id === 'saju-liu-nian').table.rows.length, 5);
    }
  });
  check('partial or inconsistent annual data is not repaired from calendar guesses', () => {
    const original = calculateReading(input);
    for (const change of [
      (annual) => { annual.years.pop(); },
      (annual) => { annual.years[1].year++; },
      (annual) => { annual.years[1].isCurrent = true; },
      (annual) => { annual.years[1].startSolar = '2027-02-30 09:46:18'; },
      (annual) => { annual.years[1].branchTenGods = []; },
      (annual) => { annual.yearBoundary = 'jan1'; },
      (annual) => { annual.currentYear++; },
    ]) {
      const result = structuredClone(original); change(result.chart.cycles.liuNian);
      const detail = buildReadingDetail(result, input);
      assert.equal(detail.sections.find((section) => section.id === 'saju-liu-nian')?.table, undefined);
      assert.equal(detail.sections.find((section) => section.id === 'saju-da-yun').table.rows.length, result.chart.cycles.daYun.list.length);
    }
  });
  check('prompt structure stays distinct without legacy glossaries or repeated intro', () => {
    for (let month = 1; month <= 12; month++) {
      const result = calculateReading({ ...input, birthDate: `2000-${String(month).padStart(2, '0')}-15` });
      const detail = buildReadingDetail(result);
      assert.ok(detail.sections.every((section) => !LEGACY_SAJU_IDS.includes(section.id)));
      const symbols = detail.sections.find((section) => section.id === 'symbols');
      assert.ok(!symbols.items.includes(detail.intro));
      assert.doesNotMatch(symbols.items.join('\n'), /의 이미지는|일상에서 이 모습이/);
      assert.equal(new Set(symbols.paragraphs).size, symbols.paragraphs.length);
      assert.ok(symbols.paragraphs.some((item) => item.includes('일간')) && symbols.paragraphs.some((item) => item.includes('일지')));
    }
  });
  check('Ziwei and zodiac sections avoid repetitive verification instructions', () => {
    for (const mode of ['zodiac', 'ziwei']) {
      const detail = buildReadingDetail(calculateReading({ ...input, mode }));
      const sentences = detail.sections.filter((section) => section.id !== 'calculation').flatMap((section) => [...section.items, ...(mode === 'ziwei' ? section.paragraphs || [] : [])]);
      assert.ok(!sentences.includes(detail.intro));
      assert.doesNotMatch(sentences.join('\n'), /실제로 내가 그런 선택을 했는지는|그 이미지와 닮은 경험이 있는지/);
      assert.equal(new Set(sentences).size, sentences.length);
    }
  });
  check('saju report follows exactly five prompt chapters without the four legacy cards', () => {
    const detail = buildReadingDetail(calculateReading(input), input);
    assert.deepEqual(detail.sections.filter((section) => section.groupLabel).map((section) => section.groupLabel), [
      '01 · 타고난 구조', '02 · 인생 흐름', '03 · 분야별 해석', '04 · 시기별 정리', '05 · 핵심 결론',
    ]);
    assert.equal(detail.sections[0].id, 'saju-chart');
    assert.ok(detail.sections.every((section) => !LEGACY_SAJU_IDS.includes(section.id) && !LEGACY_SAJU_TITLES.includes(section.title)));
    assert.equal(detail.sections.find((section) => section.id === 'saju-da-yun').collapsible, true);
    const order = detail.sections.map((section) => section.id);
    assert.ok(order.indexOf('symbols') < order.indexOf('saju-cycle-flow'));
    assert.ok(order.indexOf('saju-cycle-flow') < order.indexOf('saju-domain-money'));
    assert.ok(order.indexOf('saju-domain-family') < order.indexOf('saju-da-yun'));
    assert.ok(order.indexOf('saju-year-2030') < order.indexOf('saju-conclusion'));
    assert.equal(order.at(-1), 'reflection');
  });
  check('automatic PDF models also omit legacy cards while retaining the five prompt chapters', () => {
    for (const change of [{}, { birthTime: null }, { gender: null }, { birthTime: null, gender: null }]) {
      const sample = { ...input, ...change }, reading = calculateReading(sample), before = JSON.stringify(reading);
      const detail = buildReadingDetail(reading, sample);
      const chapters = detail.sections.filter((section) => section.groupLabel).map((section) => section.groupLabel);
      assert.equal(chapters.length, 5);
      for (const includeBirthData of [false, true]) {
        const document = buildReadingPdfDocument({ reading, input: sample, includeBirthData });
        const encoded = JSON.stringify(document);
        for (const value of [...LEGACY_SAJU_IDS, ...LEGACY_SAJU_TITLES]) assert.ok(!encoded.includes(value), `PDF restored legacy card: ${value}`);
        assert.deepEqual(document.sections.filter((section) => section.chapter).map((section) => section.chapter), chapters);
        for (const id of ['saju-chart', 'symbols', 'saju-cycle-flow', 'saju-domain-money', 'saju-domain-work', 'saju-domain-love',
          'saju-domain-marriage', 'saju-domain-rest', 'saju-domain-family', 'saju-liu-nian', 'saju-conclusion']) {
          assert.ok(document.sections.some((section) => section.id === id), `PDF missing prompt section: ${id}`);
        }
        assert.deepEqual(document.notes, detail.notes);
        assert.ok(document.notes.some((note) => note.includes('미래를 확정하지')));
      }
      assert.equal(JSON.stringify(reading), before);
    }
  });
  check('six consultation domains each give evidence, plain interpretation and distinct application', () => {
    const original = calculateReading(input), before = JSON.stringify(original);
    const detail = buildReadingDetail(original, input);
    const domains = ['money', 'work', 'love', 'marriage', 'rest', 'family'].map((id) => detail.sections.find((section) => section.id === `saju-domain-${id}`));
    assert.equal(domains.length, 6);
    for (const domain of domains) {
      assert.equal(domain.paragraphs.length, 3);
      assert.ok(domain.paragraphs.every((paragraph) => paragraph.length >= 60));
      assert.match(domain.paragraphs[0], /연주|월주|일주|시주/);
      assert.match(domain.paragraphs[0], /십성|비견|겁재|식신|상관|편재|정재|칠살|정관|편인|정인/);
      assert.ok(!domain.paragraphs.some((paragraph) => paragraph === detail.intro));
    }
    assert.equal(new Set(domains.flatMap((domain) => domain.paragraphs)).size, 18);
    assert.equal(JSON.stringify(original), before);
    assert.deepEqual(buildReadingDetail(original, input), detail);
    assert.doesNotMatch(body(detail), /30년 이상 경력|30년 경력|용신은|격국은|신강으로|신약으로|이혼하게|결혼하게|질병에 걸리|수익률은/);
  });
  check('report evidence names only actual natal locations and does not count the day master as peer', () => {
    const result = calculateReading(input), detail = buildReadingDetail(result, input);
    const ownSources = result.chart.pillars.flatMap((pillar) => [
      ...(pillar.stemTenGod !== '日主' ? [`${pillar.label} 천간`] : []),
      ...pillar.hiddenStems.map(() => `${pillar.label} 지지`),
    ]);
    for (const section of detail.sections.filter((section) => section.id.startsWith('saju-domain-'))) {
      assert.ok(ownSources.some((source) => section.paragraphs[0].includes(source)));
      assert.doesNotMatch(section.paragraphs[0], /일주 천간.*비견|日主/);
    }
    const noTime = calculateReading({ ...input, birthTime: null });
    // A stale extra time pillar must never enter a three-pillar report.
    noTime.chart.pillars.push(structuredClone(result.chart.pillars.find((pillar) => pillar.key === 'time')));
    const noTimeDetail = buildReadingDetail(noTime, { ...input, birthTime: null });
    const evidence = noTimeDetail.sections.filter((section) => section.id.startsWith('saju-domain-')).map((section) => section.paragraphs[0]).join('\n');
    assert.doesNotMatch(evidence, /시주/);
  });
  check('inherited property names are not treated as ten-god definitions', () => {
    for (const key of ['constructor', '__proto__', 'toString']) {
      const natal = calculateReading(input);
      natal.chart.pillars[0].stemTenGod = key;
      natal.chart.pillars[0].branchTenGods[0] = key;
      const detail = buildReadingDetail(natal, input);
      assert.doesNotThrow(() => JSON.stringify(detail));
      assert.doesNotMatch(detail.sections.filter((section) => section.paragraphs).flatMap((section) => section.paragraphs).join('\n'), /constructor|__proto__|toString/);
      const cycle = calculateReading(input);
      cycle.chart.cycles.daYun.list[0].stemTenGod = key;
      cycle.chart.cycles.liuNian.years[0].stemTenGod = key;
      const guarded = buildReadingDetail(cycle, input);
      assert.equal(guarded.sections.find((section) => section.id === 'saju-da-yun')?.table, undefined);
      assert.equal(guarded.sections.find((section) => section.id === 'saju-liu-nian')?.table, undefined);
    }
  });
  check('empty natal metadata gives one unavailable-domain explanation, not six invented reports', () => {
    const result = calculateReading(input);
    for (const pillar of result.chart.pillars) { pillar.stemTenGod = null; pillar.hiddenStems = []; pillar.branchTenGods = []; }
    const detail = buildReadingDetail(result, input);
    assert.equal(detail.sections.filter((section) => section.id.startsWith('saju-domain-')).length, 0);
    assert.equal(detail.sections.find((section) => section.id === 'saju-domains-unavailable').paragraphs.length, 3);
    assert.match(body(detail), /미확인은 그 기호가 없다는 확정과 다릅니다/);
  });
  check('a year crossing the actual cycle boundary identifies both overlapping periods', () => {
    const result = calculateReading(input), detail = buildReadingDetail(result, input);
    const year = result.chart.cycles.liuNian.years.find((year) => year.year === 2030);
    const overlaps = result.chart.cycles.daYun.list.filter((period) => year.startSolar < period.endSolarExclusive && period.startSolar < year.endSolarExclusive);
    assert.equal(overlaps.length, 2);
    const paragraph = detail.sections.find((section) => section.id === 'saju-year-2030').paragraphs[1];
    for (const period of overlaps) assert.ok(paragraph.includes(period.ganZhi));
    assert.match(paragraph, /한 입춘 연도 안에 교운이 걸리므로/);
  });
  check('domain interpretation and application vary with specific real gods across 72 dates', () => {
    const domains = ['money', 'work', 'love', 'marriage', 'rest', 'family'];
    const variants = Object.fromEntries(domains.map((id) => [id, [new Map(), new Map()]]));
    for (const year of [1950, 1960, 1970, 1980, 1990, 2000]) {
      for (let month = 1; month <= 12; month++) {
        const result = calculateReading({ ...input, birthDate: `${year}-${String(month).padStart(2, '0')}-15` });
        const detail = buildReadingDetail(result);
        assert.doesNotMatch(body(detail), /일’와|일’를|것를/);
        for (const id of domains) {
          const section = detail.sections.find((section) => section.id === `saju-domain-${id}`);
          for (const [index, map] of variants[id].entries()) {
            const paragraph = section.paragraphs[index + 1];
            map.set(paragraph, (map.get(paragraph) || 0) + 1);
          }
        }
      }
    }
    for (const [id, maps] of Object.entries(variants)) {
      for (const [index, map] of maps.entries()) {
        assert.ok(map.size >= 8, `${id} paragraph ${index + 2}: only ${map.size} variants`);
        assert.ok(Math.max(...map.values()) <= 36, `${id} paragraph ${index + 2} repeats in a majority of fixtures`);
      }
    }
  });
  check('saju and Ziwei interpretations highlight substantive exact phrases and separate ideas', () => {
    for (const mode of ['saju', 'ziwei']) {
      const sample = { ...input, mode, ...(mode === 'ziwei' ? { ziweiReport: { asOf: '2026-10-23' } } : {}) };
      const detail = buildReadingDetail(calculateReading(sample), sample);
      const emphasized = detail.sections.filter((section) => section.highlights?.length);
      assert.ok(emphasized.length >= 8, `${mode} should emphasize actual interpretation sections`);
      for (const section of emphasized) {
        const content = [section.text, ...(section.paragraphs || []), ...section.items].join('\n');
        assert.ok(section.highlights.length <= 4 && new Set(section.highlights).size === section.highlights.length);
        for (const phrase of section.highlights) {
          assert.ok(phrase.length >= 12 && phrase.length <= 180 && content.includes(phrase));
          assert.doesNotMatch(phrase, /<[^>]*>|\*\*|^Fact|^Claim|^Disclosure|예측·|진단·|미확인|^자미$|^재성$/);
        }
      }
      const areas = detail.sections.filter((section) => mode === 'saju' ? section.id.startsWith('saju-domain-') : /^ziwei-stage-0[1-8]$/.test(section.id));
      for (const section of areas) {
        assert.ok(section.highlights?.length >= 1, `${section.id} has a meaningful strength/caution/action`);
        assert.ok(section.paragraphs.some((paragraph) => /\n\n\d\. /.test(paragraph)), `${section.id} separates numbered ideas with blank lines`);
        if (mode === 'saju') {
          assert.doesNotMatch(section.paragraphs[1], /함께 놓고 읽습니다|두 관계는 모두|각각 .+에서 확인됩니다/);
          assert.match(section.paragraphs[2], /강점과 주의/);
        }
      }
      if (mode === 'saju') assert.equal(new Set(areas.map((section) => section.highlights[0])).size, areas.length, 'each life area has its own substantive relation prompt, not six copies of one generic god definition');
      if (mode === 'ziwei') assert.doesNotMatch(body(detail), /풀어봅니다/);
    }
  });
  check('saju rendered reports explain evidence, personality, strengths and cautions without homework', () => {
    const homework = /보세요|주세요|답해|적어\s*보|기록해|작성해|체크해|떠올려|남겨\s*두세요|자기 성찰 질문|균형을 위한 질문|실제 상황 선택|구체적인 실천|관찰 질문|숙제|실천\s*계획|시도할 행동|확인할 날짜|90일\s*행동|[?？]/u;
    for (const change of [{}, { birthTime: null }, { gender: null }, { birthTime: null, gender: null }]) {
      const sample = { ...input, ...change }, result = calculateReading(sample), before = JSON.stringify(result);
      const detail = buildReadingDetail(result, sample);
      const rendered = [detail.label, detail.intro, body(detail), ...detail.notes, readingResultSummary(result)].join('\n');
      assert.equal(homework.test(rendered), false, `unexpected homework copy: ${rendered.match(homework)?.[0]}`);
      assert.equal(detail.sections.find((section) => section.id === 'reflection').title, '성향 해석의 연결 기준');
      for (const item of detail.sections.filter((section) => section.id.startsWith('saju-domain-'))) {
        assert.equal(item.paragraphs.length, 3);
        assert.match(item.paragraphs[0], /(?:연주|월주|일주|시주).*(?:비견|겁재|식신|상관|편재|정재|칠살|정관|편인|정인)/s);
        assert.match(item.paragraphs[1], /관계|일간|오행|연결/);
        assert.match(item.paragraphs[2], /강점|장점/);
        assert.match(item.paragraphs[2], /주의|반면|다만|여지|부담|긴장/);
      }
      for (const item of detail.sections.filter((section) => /^saju-year-\d+$/.test(section.id))) {
        assert.match(item.paragraphs[1], /전통적 관계.*연결한 해석/);
        assert.match(item.paragraphs[2], /강점|장점/);
        assert.match(item.paragraphs[2], /해석 범위/);
      }
      assert.equal(readingResultSummary(result), readingResultSummary(result));
      assert.equal(JSON.stringify(result), before);
    }
    for (const mode of ['saju', 'ziwei', 'zodiac']) {
      const result = calculateReading({ ...input, mode }), before = JSON.stringify(result);
      const summary = readingResultSummary(result);
      assert.equal(typeof summary, 'string');
      if (mode === 'zodiac') assert.equal(summary, result.summary);
      else assert.doesNotMatch(summary, homework);
      assert.equal(JSON.stringify(result), before);
    }
    const missing = calculateReading(input);
    for (const pillar of missing.chart.pillars) { pillar.stemTenGod = null; pillar.hiddenStems = []; pillar.branchTenGods = []; }
    const missingBody = body(buildReadingDetail(missing, input));
    assert.equal(homework.test(missingBody), false, `unexpected missing-data homework copy: ${missingBody.match(homework)?.[0]}`);
  });
  console.log(`\n${checks} reading-detail test groups passed; synthetic/public fixture dates only, no network or database access.`);
} finally {
  for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[name]; else globalThis[name] = value; }
}
