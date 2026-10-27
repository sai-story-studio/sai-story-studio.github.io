import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { calculateReading } from '../public/experience/reading-engine.js';
import { buildZiweiStructure } from '../public/experience/ziwei-structure.js';
import { buildZiweiReport } from '../public/experience/ziwei-report.js';
import { validateReadingPdfDocument } from '../public/experience/reading-pdf-document.js';

const root = new URL('../public/experience/', import.meta.url), sandbox = {};
sandbox.self = sandbox; sandbox.window = sandbox; vm.createContext(sandbox);
for (const file of ['lunar.js', 'iztro.min.js']) vm.runInContext(await readFile(new URL(`vendor/${file}`, root), 'utf8'), sandbox);
const previous = { Solar: globalThis.Solar, Lunar: globalThis.Lunar, LunarUtil: globalThis.LunarUtil, iztro: globalThis.iztro };
Object.assign(globalThis, { Solar: sandbox.Solar, Lunar: sandbox.Lunar, LunarUtil: sandbox.LunarUtil, iztro: sandbox.iztro });
const input = { mode: 'ziwei', birthDate: '2000-08-16', birthTime: '03:00', calendar: 'solar', leapMonth: false, gender: 'female' };
const reportSource = await readFile(new URL('ziwei-report.js', root), 'utf8');
const text = (report) => report.sections.flatMap((section) => [section.text, ...(section.paragraphs || []), ...section.items,
  ...(section.table ? [section.table.caption, ...section.table.headers, ...section.table.rows.flat()] : [])]).join('\n');
const stages = (report) => report.sections.filter((section) => /^ziwei-stage-\d{2}$/.test(section.id));
const claims = (report) => stages(report).flatMap((section) => section.paragraphs.filter((paragraph) => paragraph.startsWith('Claim'))).join('\n');
const stage = (report, number) => report.sections.find((section) => section.id === `ziwei-stage-${String(number).padStart(2, '0')}`);
const pdf = (report) => validateReadingPdfDocument({ version: 1, mode: 'ziwei', title: '자미두수 보고서', subtitle: report.label, summary: [],
  sections: report.sections.map((section) => ({ id: section.id, title: section.title, chapter: section.groupLabel || '', text: section.text || '',
    paragraphs: section.paragraphs || [], items: section.items || [], ...(section.highlights?.length ? { highlights: section.highlights } : {}), ...(section.table ? { table: { kind: 'standard', ...section.table } } : {}) })), notes: report.notes });
let count = 0;
function check(label, run) { run(); count++; console.log(`PASS ${label}`); }
try {
  const reading = calculateReading(input);
  check('mandatory opening, input state, exact ten stages and final line', () => {
    const report = buildZiweiReport(reading, input);
    assert.equal(report.sections[0].id, 'ziwei-guidance');
    assert.equal(report.sections[1].id, 'ziwei-input-state');
    assert.equal(report.intro, report.sections[0].text);
    assert.ok(report.intro.startsWith('[해석 안내]\n'));
    assert.deepEqual(stages(report).map((section) => section.id), Array.from({ length: 10 }, (_, index) => `ziwei-stage-${String(index + 1).padStart(2, '0')}`));
    assert.equal(report.sections.at(-1).id, 'ziwei-final-disclosure');
    assert.equal(report.sections.at(-1).paragraphs.at(-1), '이 해석은 전통 자미두수의 상징 체계에 따른 참고 관점이며, 중요한 현실 결정은 사실 정보와 전문 조언을 함께 검토해야 합니다.');
    assert.equal(new Set(report.sections.map((section) => section.id)).size, report.sections.length);
    assert.match(report.label, /명궁 자미 · 명궁·신궁·복덕궁으로/);
    assert.doesNotMatch(report.label, /궁를/);
    assert.ok(!report.sections.some((section) => ['symbols', 'reflection', 'ziwei-major-guides', 'ziwei-life-areas'].includes(section.id)));
    for (const number of [1, 2, 3, 4, 5, 6, 7, 8, 10]) {
      assert.deepEqual(stage(report, number).paragraphs.map((paragraph) => paragraph.split('\n')[0]), ['Fact · 확인된 자료', 'Claim · 전통적 해석', 'Disclosure · 해석 범위와 조건']);
    }
  });
  check('three output modes retain order but differ in basis tables and detail', () => {
    const reports = ['QUICK', 'STANDARD', 'DEEP'].map((mode) => buildZiweiReport(reading, { ...input, ziweiReport: { mode } }));
    for (const report of reports) assert.equal(stages(report).length, 10);
    assert.equal(reports[0].sections.filter((section) => section.id.startsWith('ziwei-basis-')).length, 0);
    assert.ok(reports[1].sections.filter((section) => section.id.startsWith('ziwei-basis-')).length >= 8);
    assert.ok(JSON.stringify(reports[0]).length < JSON.stringify(reports[1]).length);
    assert.ok(JSON.stringify(reports[1]).length < JSON.stringify(reports[2]).length);
    for (const report of reports) assert.ok(report.sections.length <= 40);
  });
  check('actual fourteen stars, twelve palaces and provided brightness are preserved', () => {
    const report = buildZiweiReport(reading, input);
    const rows = report.sections.find((section) => section.id === 'ziwei-palaces').table.rows;
    assert.equal(rows.length, 12);
    for (const palace of reading.chart.palaces) {
      const row = rows.find((row) => row[0].includes(palace.name === '노복' ? '노복궁' : palace.name)).join('\n');
      for (const star of [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars]) assert.ok(row.includes(star.name));
    }
    assert.match(text(report), /교우궁\(노복궁\)/);
  });
  check('every displayed triad uses actual helper references before the conclusion', () => {
    const structure = buildZiweiStructure(reading), report = buildZiweiReport(reading, input);
    for (const basis of report.sections.filter((section) => section.id.startsWith('ziwei-basis-'))) {
      const number = Number(basis.id.slice(-2));
      assert.ok(report.sections.indexOf(basis) < report.sections.indexOf(stage(report, number)));
      for (let offset = 0; offset < basis.table.rows.length; offset += 4) {
        const rows = basis.table.rows.slice(offset, offset + 4);
        assert.deepEqual(rows.map((row) => row[1]), ['본궁', '대궁', '삼합궁 1', '삼합궁 2']);
        const target = structure.palaces.find((palace) => rows[0][2].includes(palace.heavenlyStem + palace.earthlyBranch));
        assert.ok(target);
        const ref = structure.triads.find((item) => item.targetIndex === target.index);
        for (const [index, field] of ['targetIndex', 'oppositeIndex', 'wealthIndex', 'careerIndex'].entries()) {
          const palace = structure.palaces.find((palace) => palace.index === ref[field]);
          assert.ok(rows[index][2].includes(palace.heavenlyStem + palace.earthlyBranch));
        }
      }
    }
  });
  check('empty soul palace labels the actual opposite source without moving its stars', () => {
    const fixture = Array.from({ length: 24 }, (_, hour) => calculateReading({ ...input, birthTime: `${String(hour).padStart(2, '0')}:00` }))
      .find((result) => result.calculation.details.mappingSource === 'oppositePalace');
    assert.ok(fixture);
    const report = buildZiweiReport(fixture, input), structure = buildZiweiStructure(fixture);
    const own = structure.palaces.find((palace) => palace.index === structure.anchors.soulIndex);
    const ref = structure.triads.find((item) => item.targetIndex === own.index);
    const opposite = structure.palaces.find((palace) => palace.index === ref.oppositeIndex);
    assert.equal(own.majorStars.length, 0);
    assert.match(report.label, /명궁 공궁.*천이궁.*차성/);
    assert.match(stage(report, 1).paragraphs[0], /주성 없음\(공궁\).*차성 출처/);
    for (const star of opposite.majorStars) assert.ok(stage(report, 1).paragraphs[0].includes(star.name));
    assert.match(claims(report), /본궁의 별이 아니라/);
    assert.equal(buildZiweiStructure(fixture).palaces.find((palace) => palace.index === own.index).majorStars.length, 0);
  });
  check('missing body palace and triads remain missing rather than borrowing made-up axes', () => {
    const fixture = structuredClone(reading);
    for (const palace of fixture.chart.palaces) palace.isBodyPalace = false;
    delete fixture.chart.triadRefs;
    const report = buildZiweiReport(fixture, input);
    assert.match(text(report), /신궁을 유일하게 확인할 수 없어|신궁.*생략/);
    assert.match(text(report), /삼방사정.*없|삼방사정 미확인/);
    assert.ok(!report.sections.find((section) => section.id === 'ziwei-basis-01').table.rows.some((row) => row[1] === '대궁'));
  });
  check('canonical mutagen disagreement is disclosed and suppresses transformation claims', () => {
    const fixture = structuredClone(reading);
    fixture.chart.birthYearMutagens.items[0].star = '파군';
    const report = buildZiweiReport(fixture, input);
    assert.match(text(report), /사화.*충돌/);
    assert.doesNotMatch(claims(report), /에 확인된 화[록권과기]/);
    assert.ok(report.sections.some((section) => section.id === 'ziwei-stage-05'));
  });
  check('nominal age is automatic and missing reference data alone limits stage nine', () => {
    const report = buildZiweiReport(reading, { ...input, ziweiReport: { asOf: '2026-10-23' } });
    assert.match(text(report), /기준일 세는나이: 27세\(음력 연도 기준 허세 · 자동 계산\)/);
    assert.match(stage(report, 9).paragraphs[0], /현재: 23~32세.*부처궁/);
    assert.match(stage(report, 9).paragraphs[0], /다음: 33~42세.*자녀궁.*시작 2032-02-11/);
    assert.doesNotMatch(text(report), /직접 입력한|현재 나이: 미입력|나이를 대신 정하지/);
    const fixture = structuredClone(reading); delete fixture.chart.referenceDate;
    const missing = buildZiweiReport(fixture, input);
    assert.match(stage(missing, 9).paragraphs.join('\n'), /유효한 해석 기준일을 확인하지 못/);
    assert.ok(!missing.sections.some((section) => section.id === 'ziwei-decadal-evidence'));
  });
  check('calculated ages select actual current/next ranges and boundary extras stay secondary', () => {
    const source = buildZiweiStructure(reading);
    const range = source.decadals.table[2].range;
    for (const age of [range[0], range[0] + 4, range[1]]) {
      const options = { asOf: `${reading.chart.birthLunarYear + age - 1}-07-01`, mode: 'DEEP' };
      const structure = buildZiweiStructure(reading, options), report = buildZiweiReport(reading, { ...input, ziweiReport: options });
      const rows = report.sections.find((section) => section.id === 'ziwei-decadal-evidence').table.rows;
      const main = [structure.decadals.current, structure.decadals.next].filter(Boolean);
      const extras = structure.decadals.boundary.candidates.filter((candidate) => !main.some((period) => period.palaceIndex === candidate.palaceIndex));
      const periods = [...main, ...extras];
      assert.equal(structure.decadals.calculatedAge, age);
      assert.equal(rows.length, periods.length);
      for (const [index, period] of periods.entries()) assert.ok(rows[index][0].includes(`${period.range[0]}~${period.range[1]}`));
      assert.ok(stage(report, 9).paragraphs[0].includes(`현재: ${main[0].range[0]}~${main[0].range[1]}세`));
      if (main[1]) assert.ok(stage(report, 9).paragraphs[0].includes(`다음: ${main[1].range[0]}~${main[1].range[1]}세`));
      if (structure.decadals.currentStartDate) assert.ok(stage(report, 9).paragraphs[0].includes(`시작 ${structure.decadals.currentStartDate}`));
      if (structure.decadals.nextTransitionDate) assert.ok(stage(report, 9).paragraphs[0].includes(`시작 ${structure.decadals.nextTransitionDate}`));
      if (extras.length) assert.match(stage(report, 9).paragraphs[0], /경계 참고:.*보조 비교/);
    }
  });
  check('age/reference conflicts and malformed core data never become personal predictions', () => {
    const conflict = buildZiweiReport(reading, { ...input, ziweiReport: { currentAge: 99, asOf: '2026-10-23' } });
    assert.match(stage(conflict, 9).paragraphs.join('\n'), /충돌.*보류/);
    assert.ok(!conflict.sections.some((section) => section.id === 'ziwei-decadal-evidence'));
    for (const change of [(result) => result.chart.palaces.pop(), (result) => { result.chart.palaces[0].majorStars.push({ name: 'constructor' }); }]) {
      const fixture = structuredClone(reading); change(fixture);
      const report = buildZiweiReport(fixture, { ...input, ziweiReport: { mode: 'constructor' } });
      assert.equal(stages(report).length, 10);
      assert.ok(!report.sections.some((section) => section.id === 'ziwei-palaces'));
      assert.doesNotMatch(text(report), /constructor/);
    }
  });
  check('each unavailable decadal cause is accurate and display statuses are localized', () => {
    const options = { asOf: '2149-07-01' };
    assert.equal(buildZiweiStructure(reading, options).decadals.status, 'out-of-range');
    const outside = buildZiweiReport(reading, { ...input, ziweiReport: options });
    assert.match(stage(outside, 9).paragraphs.join('\n'), /기준일 세는나이가 제공된 대운표 범위 밖/);
    assert.doesNotMatch(stage(outside, 9).paragraphs.join('\n'), /현재 나이 또는 대운표가 없어/);
    const missing = structuredClone(reading);
    delete missing.chart.palaces[0].decadal;
    const incomplete = buildZiweiReport(missing, { ...input, ziweiReport: { currentAge: 27 } });
    assert.match(stage(incomplete, 9).paragraphs.join('\n'), /대운표 자료 일부가 누락/);
    for (const sample of [{}, { asOf: '2026-10-23' }, options, { currentAge: 27.5 }, { currentAge: 99, asOf: '2026-10-23' }]) {
      const report = buildZiweiReport(reading, { ...input, ziweiReport: sample });
      const finalFact = stage(report, 10).paragraphs[0];
      assert.match(finalFact, /기준일 대운의 자료 상태: [가-힣]/);
      assert.doesNotMatch(finalFact, /자료 상태: (?:available|age-required|missing|conflict|invalid-age|age-conflict|out-of-range)/);
    }
  });
  check('plain PDF schema and size stay bounded in all output modes', () => {
    for (const mode of ['QUICK', 'STANDARD', 'DEEP']) {
      const report = buildZiweiReport(reading, { ...input, ziweiReport: { mode, asOf: '2026-10-23', focus: 'relationship' } });
      const document = pdf(report);
      assert.equal(document.sections.at(-1).id, 'ziwei-final-disclosure');
      assert.ok(new TextEncoder().encode(JSON.stringify(document)).length < 220 * 1024);
      assert.ok(document.sections.length <= 40);
      assert.doesNotMatch(text(report), /100%|운명적으로|이혼하게|질병에 걸리|부자가 됩|이직하세요|투자하세요/);
      assert.match(text(report), /의료 또는 상담 전문가와 상의/);
      assert.ok(JSON.stringify(report) === JSON.stringify(buildZiweiReport(reading, { ...input, ziweiReport: { mode, asOf: '2026-10-23', focus: 'relationship' } })));
    }
  });
  check('substantive highlights are exact body phrases and numbered ideas are blank-separated', () => {
    const report = buildZiweiReport(reading, { ...input, ziweiReport: { mode: 'DEEP', asOf: '2026-10-23' } });
    for (const item of stages(report)) {
      const content = [item.text, ...item.paragraphs, ...item.items].join('\n');
      assert.ok(item.highlights?.length >= 1 && item.highlights.length <= 4, item.id);
      assert.equal(new Set(item.highlights).size, item.highlights.length);
      for (const phrase of item.highlights) {
        assert.ok(phrase.length >= 12 && phrase.length <= 180 && content.includes(phrase));
        assert.doesNotMatch(phrase, /<[^>]*>|\*\*|^Fact|^Claim|^Disclosure|미확인|예측·|진단·/);
      }
      assert.ok(item.paragraphs.some((paragraph) => /\n\n\d\. /.test(paragraph)), item.id);
      assert.deepEqual(item.paragraphs.map((paragraph) => paragraph.split('\n')[0]), ['Fact · 확인된 자료', 'Claim · 전통적 해석', 'Disclosure · 해석 범위와 조건']);
    }
    assert.doesNotMatch(text(report), /풀어봅니다/);
    const environmentBlocks = stages(report).filter((item) => item.paragraphs.some((paragraph) => paragraph.includes('잘 맞는 환경:')));
    assert.equal(environmentBlocks.length, 1, 'the full environment/burden profile belongs to personality, not every domain');
  });
  check('representative charts produce distinct facts and conditions without external side effects', () => {
    const variants = new Set();
    for (const birthDate of ['1950-01-15', '1970-04-15', '1980-08-15', '1990-12-15', '2000-06-15', '2005-12-23']) {
      const fixture = calculateReading({ ...input, birthDate }), before = JSON.stringify(fixture);
      const report = buildZiweiReport(fixture, { ...input, birthDate, ziweiReport: { mode: 'DEEP' } });
      variants.add(stage(report, 5).paragraphs[2]);
      assert.equal(JSON.stringify(fixture), before);
      pdf(report);
    }
    assert.ok(variants.size >= 4);
    assert.doesNotMatch(reportSource, /fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage/);
  });
  check('all fourteen symbolic profiles explain the chart connection without homework prompts across representative fixtures', () => {
    const covered = new Set();
    const homework = /확인해\s*보세요|살펴보세요|비교해\s*보세요|적어\s*보세요|기록해|기록으로|관찰 질문|점검 질문|현실 비교 과제|향후\s*90일|처음\s*30일|다음\s*30일|마지막\s*30일|시도해|부터 시도|해\s*봅시다|체크해|\?/;
    for (const birthDate of ['1950-01-15', '1970-04-15', '1980-08-15', '1990-12-15', '2000-06-15', '2005-12-23']) {
      for (const birthTime of ['00:37', '08:37', '16:37', '23:37']) {
        const fixture = calculateReading({ ...input, birthDate, birthTime }, { asOf: '2026-10-23' });
        const structure = buildZiweiStructure(fixture), snapshot = JSON.stringify(fixture);
        for (const mode of ['QUICK', 'STANDARD', 'DEEP']) {
          const options = { mode, asOf: '2026-10-23' }, report = buildZiweiReport(fixture, { ziweiReport: options });
          const body = [report.intro, text(report), ...report.notes].join('\n');
          assert.doesNotMatch(body, homework, `${birthDate}/${birthTime}/${mode}`);
          assert.doesNotMatch(body, /설계을|기여을|준비을|화록\(化祿\)는|화권\(化權\)는/);
          for (const star of ['자미','천기','태양','무곡','천동','염정','천부','태음','탐랑','거문','천상','천량','칠살','파군','좌보','우필','문창','문곡','천괴','천월','경양','타라','화성','영성','지공','지겁','록존','천마']) {
            const hasFinal = (star.charCodeAt(star.length - 1) - 0xac00) % 28 !== 0;
            assert.doesNotMatch(body, new RegExp(`${star}${hasFinal ? '는' : '은'}`), `${star} topic particle`);
          }
          assert.equal(stage(report, 10).title, '해석 종합');
          assert.match(stage(report, 10).paragraphs[1], /중심 성향이 나온 이유/);
          assert.match(stage(report, 10).paragraphs[2], /명궁은 판단의 기준, 신궁은 힘이 실리는 행동 영역, 복덕궁은 만족과 회복의 방식/);
          assert.match(stage(report, 2).paragraphs[2], /역할의 차이가 성격·감정·행동/);
          for (const item of stages(report)) {
            assert.equal(item.paragraphs.length, 3, item.id);
            assert.equal(item.paragraphs[2].split('\n')[0], 'Disclosure · 해석 범위와 조건');
          }
          pdf(report);
        }
        for (const index of new Set(Object.values(structure.anchors))) {
          const palace = structure.palaces.find((item) => item.index === index);
          if (!palace) continue;
          const ref = structure.triads.find((item) => item.targetIndex === palace.index);
          const source = palace.majorStars.length ? palace : structure.palaces.find((item) => item.index === ref?.oppositeIndex);
          for (const star of source?.majorStars || []) {
            covered.add(star.name);
            const report = buildZiweiReport(fixture, { ziweiReport: { asOf: '2026-10-23' } });
            assert.match(stage(report, 2).paragraphs[1], new RegExp(`${star.name}[은는]`), `${star.name} must have its own explanatory mechanism`);
          }
        }
        assert.equal(JSON.stringify(fixture), snapshot);
      }
    }
    assert.deepEqual([...covered].sort(), ['자미','천기','태양','무곡','천동','염정','천부','태음','탐랑','거문','천상','천량','칠살','파군'].sort());
  });
  check('limited data keeps three-part explanatory stages and no invented solution plan', () => {
    const malformed = structuredClone(reading); malformed.chart.palaces.pop();
    const invalid = buildZiweiReport(malformed);
    for (const item of stages(invalid)) {
      assert.equal(item.paragraphs.length, 3);
      assert.equal(item.paragraphs[2].split('\n')[0], 'Disclosure · 해석 범위와 조건');
    }
    assert.doesNotMatch(text(invalid), /90일|관찰 질문|해 보세요|실천/);
    const missing = structuredClone(reading); delete missing.chart.referenceDate;
    const unavailable = buildZiweiReport(missing);
    assert.equal(stage(unavailable, 9).paragraphs.length, 3);
    assert.match(stage(unavailable, 9).paragraphs[1], /현재·다음 구간의 성향 해설을 보류/);
    assert.ok(!unavailable.sections.some((item) => item.id === 'ziwei-decadal-evidence'));
  });
  check('deep copy retains every distinct star mechanism once instead of repeating it across domains', () => {
    const mechanisms = ['자미는 여러 역할', '천기는 변화하는', '태양은 밖을', '무곡은 실무', '천동은 즐거움', '염정은 기준', '천부는 자원을', '태음은 내면', '탐랑은 관심', '거문은 말과', '천상은 보좌', '천량은 보호', '칠살은 결단', '파군은 해체'];
    for (const [birthDate, birthTime] of [['1970-04-15','08:37'],['1980-08-15','16:37'],['2000-06-15','16:37']]) {
      const fixture = calculateReading({ ...input, birthDate, birthTime }, { asOf: '2026-10-23' });
      const report = buildZiweiReport(fixture, { ziweiReport: { mode: 'DEEP', asOf: '2026-10-23' } });
      const prose = claims(report);
      for (const mechanism of mechanisms) assert.equal(prose.split(mechanism).length - 1, 1, `${birthDate}: ${mechanism}`);
      assert.match(stage(report, 2).paragraphs[1], /상징입니다/);
      assert.ok(stages(report).every((item) => item.highlights?.length >= 1));
      pdf(report);
    }
  });
  console.log(`${count} Ziwei report groups passed; synthetic dates only, no API or database access.`);
} finally {
  for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
}
