import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { buildManseView } from '../public/experience/manse-view.js';
import { calculateReading } from '../public/experience/reading-engine.js';
import { calculateNatalAuspicious } from '../public/experience/natal-auspicious.js';

// No DOM, requests, personal records or database access. The fixture is the
// public EightChar example; other dates below are synthetic test inputs.
const experience = new URL('../public/experience/', import.meta.url);
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(await readFile(new URL('vendor/lunar.js', experience), 'utf8'), sandbox);
const originalGlobals = { Solar: globalThis.Solar, Lunar: globalThis.Lunar, LunarUtil: globalThis.LunarUtil };
Object.assign(globalThis, { Solar: sandbox.Solar, Lunar: sandbox.Lunar, LunarUtil: sandbox.LunarUtil });
const sample = { mode: 'saju', birthDate: '2005-12-23', birthTime: '08:37', calendar: 'solar', leapMonth: false, gender: 'female' };
const read = (extra = {}) => calculateReading({ ...sample, ...extra }, { asOf: '2026-10-23 12:00:00' });
const clone = (value) => JSON.parse(JSON.stringify(value));
let groups = 0;
function check(label, callback) { callback(); groups++; console.log(`PASS ${label}`); }
function direct(birthDate, birthTime) {
  const [year, month, day] = birthDate.split('-').map(Number);
  const [hour, minute] = (birthTime || '12:00').split(':').map(Number);
  const bazi = sandbox.Solar.fromYmdHms(year, month, day, hour, minute, 0).getLunar().getEightChar();
  bazi.setSect(2);
  return bazi;
}
const stemNames = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
const branchNames = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
const gods = { 比肩: '비견', 劫财: '겁재', 食神: '식신', 伤官: '상관', 偏财: '편재', 正财: '정재', 七杀: '편관·칠살', 正官: '정관', 偏印: '편인', 正印: '정인', 日主: '일간·나' };
const stages = { 长生: '장생', 沐浴: '목욕', 冠带: '관대', 临官: '건록·임관', 帝旺: '제왕', 衰: '쇠', 病: '병', 死: '사', 墓: '묘', 绝: '절', 胎: '태', 养: '양' };

try {
  check('natal auspicious names attach to the checked pillar without borrowing year stems or hidden stems', () => {
    const reading = read(), before = JSON.stringify(reading), view = buildManseView(reading);
    const expected = calculateNatalAuspicious(reading.chart.pillars);
    assert.deepEqual(view.auspicious.supported, expected.supported);
    assert.equal(view.auspicious.catalog.length, 34);
    for (const column of view.columns) {
      assert.deepEqual(column.auspiciousStars, expected.byPillar[column.key]);
      assert.deepEqual(column.auspiciousByLayer, expected.byLayer[column.key]);
      assert.deepEqual(column.twelveStars, expected.twelveByPillar[column.key]);
    }
    assert.deepEqual(view.auspicious.matches, expected.matches);
    assert.ok(view.auspicious.notes.some((note) => note.includes('22개') && note.includes('12신살')));
    assert.ok(view.auspicious.catalog.some((item) => item.label === '월덕귀인'));
    assert.ok(view.auspicious.sources.every((item) => item.url.startsWith('https://')));
    const unknown = buildManseView(read({ birthTime: null }));
    assert.equal(unknown.columns[0].auspiciousStars, null);
    assert.equal(unknown.columns[0].auspiciousByLayer, null);
    assert.equal(unknown.columns[0].twelveStars, null);
    assert.deepEqual(unknown.columns.slice(1).map((column) => column.auspiciousStars), view.columns.slice(1).map((column) => column.auspiciousStars));
    assert.equal(JSON.stringify(reading), before);
  });
  check('four columns always run time/day/month/year, without reversing the actual pillar contents', () => {
    const result = read(), model = buildManseView(result), vendor = direct(sample.birthDate, sample.birthTime);
    assert.deepEqual(model.columns.map((column) => column.key), ['time', 'day', 'month', 'year']);
    assert.deepEqual(model.columns.map((column) => column.label), ['생시', '생일', '생월', '생년']);
    for (const [index, method] of ['Time', 'Day', 'Month', 'Year'].entries()) {
      const column = model.columns[index];
      assert.equal(column.missing, false); assert.equal(column.placeholder, null);
      assert.equal(column.stem.glyph + column.branch.glyph, vendor[`get${method}`]());
      assert.equal(column.stem.name, stemNames[vendor[`get${method}Gan`]()]);
      assert.equal(column.branch.name, branchNames[vendor[`get${method}Zhi`]()]);
      assert.equal(column.stemTenGod, gods[vendor[`get${method}ShiShenGan`]()]);
      assert.deepEqual(column.hiddenStems, Array.from(vendor[`get${method}HideGan`](), (stem) => stemNames[stem]));
      assert.deepEqual(column.branchTenGods, Array.from(vendor[`get${method}ShiShenZhi`](), (god) => gods[god]));
      assert.equal(column.growthStage, stages[vendor[`get${method}DiShi`]()]);
      assert.deepEqual(column.voidBranches, [...vendor[`get${method}XunKong`]()].map((branch) => branchNames[branch]));
      assert.deepEqual(column.unavailable, []);
    }
    assert.equal(model.columns[1].stemTenGod, '일간·나');
    assert.equal(model.columns[1].naYin, '백랍금');
  });
  check('unknown birth time keeps one explicit empty time column, never a noon time pillar', () => {
    const result = read({ birthTime: null }), model = buildManseView(result), time = model.columns[0];
    assert.equal(model.columns.length, 4); assert.equal(time.key, 'time');
    assert.equal(time.missing, true); assert.equal(time.placeholder, '생시 모름');
    assert.equal(time.stem, null); assert.equal(time.branch, null); assert.equal(time.stemTenGod, null);
    for (const key of ['hiddenStems', 'branchTenGods', 'voidBranches', 'unavailable']) assert.deepEqual(time[key], []);
    assert.equal(time.growthStage, null); assert.equal(time.naYin, null);
    assert.equal(model.facts.birthTimeKnown, false);
    assert.equal(model.facts.literalTotal, 6); assert.equal(model.facts.mappingTotal, 7);
    assert.equal(result.chart.pillars.length, 3);
  });
  check('literal stem/branch counts are 8 or 6, separately from existing 9 or 7 weights', () => {
    for (const birthTime of ['08:37', null]) {
      const result = read({ birthTime }), model = buildManseView(result);
      assert.equal(model.facts.literalCounts.reduce((sum, item) => sum + item.count, 0), birthTime ? 8 : 6);
      assert.equal(model.facts.mappingWeights.reduce((sum, item) => sum + item.count, 0), birthTime ? 9 : 7);
      assert.deepEqual(model.facts.mappingWeights, result.chart.elements.map((item) => ({ element: item.label, count: item.count })));
      assert.match(model.facts.weightingNote, /본오행 글자 수.*일간을 한 번 더.*별도/);
    }
  });
  check('all ten stems and twelve branches have their own glyph polarity, not hidden-stem polarity', () => {
    const seenStems = new Set(), seenBranches = new Set();
    const yangStems = new Set(['甲', '丙', '戊', '庚', '壬']), yangBranches = new Set(['子', '寅', '辰', '午', '申', '戌']);
    // Sixty real consecutive day pillars cover every stem and branch. Reuse
    // only the actual vendor facts, rather than adding invented classifications.
    for (let offset = 0; offset < 60; offset++) {
      const date = new Date(Date.UTC(2000, 0, 1 + offset)).toISOString().slice(0, 10);
      const vendor = direct(date, '12:00'), result = read();
      const day = result.chart.pillars.find((pillar) => pillar.key === 'day');
      day.ganZhi = vendor.getDay(); day.stem = vendor.getDayGan(); day.branch = vendor.getDayZhi();
      const labels = { 木: '목', 火: '화', 土: '토', 金: '금', 水: '수' };
      day.elements = [...vendor.getDayWuXing()].map((symbol) => labels[symbol]);
      day.stemTenGod = vendor.getDayShiShenGan();
      result.calculation.details.pillars.day = day.ganZhi;
      // This test isolates glyph presentation, so no unrelated weight data is
      // asserted against the changed fixture's day stem.
      delete result.chart.elements; delete result.calculation.details.elements;
      const model = buildManseView(result), column = model.columns[1];
      assert.equal(column.stem.polarity, yangStems.has(column.stem.glyph) ? '+' : '-');
      assert.equal(column.branch.polarity, yangBranches.has(column.branch.glyph) ? '+' : '-');
      seenStems.add(column.stem.glyph); seenBranches.add(column.branch.glyph);
    }
    assert.equal(seenStems.size, 10); assert.equal(seenBranches.size, 12);
    const model = buildManseView(read());
    assert.equal(model.columns.find((column) => column.branch.glyph === '子').branch.polarity, '+');
    assert.match(model.notes.join(' '), /낱글자 자체.*지장간 본기의 음양과 별개/);
  });
  check('missing optional classifications stay null/empty and explicitly unavailable', () => {
    const result = read();
    for (const pillar of result.chart.pillars) for (const key of ['stemTenGod', 'branchTenGods', 'hiddenStems', 'growthStage', 'naYin', 'voidBranches']) delete pillar[key];
    const model = buildManseView(result);
    for (const column of model.columns) {
      assert.equal(column.missing, false);
      for (const key of ['stemTenGod', 'growthStage', 'naYin']) assert.equal(column[key], null);
      for (const key of ['branchTenGods', 'hiddenStems', 'voidBranches']) assert.deepEqual(column[key], []);
      assert.deepEqual(column.unavailable, ['stemTenGod', 'branchTenGods', 'hiddenStems', 'growthStage', 'naYin', 'voidBranches']);
    }
  });
  check('unknown/prototype/HTML metadata never becomes output names or executable values', () => {
    for (const poison of ['constructor', '__proto__', '<img src=x onerror=alert(1)>', 'unknown']) {
      const result = read();
      for (const pillar of result.chart.pillars) Object.assign(pillar, { stemTenGod: poison, growthStage: poison, naYin: poison, hiddenStems: [poison], branchTenGods: [poison], voidBranches: poison });
      const model = buildManseView(result);
      assert.ok(model);
      for (const column of model.columns) {
        assert.equal(column.stemTenGod, null); assert.equal(column.growthStage, null); assert.equal(column.naYin, null);
        assert.deepEqual(column.hiddenStems, []); assert.deepEqual(column.branchTenGods, []); assert.deepEqual(column.voidBranches, []);
      }
      assert.equal(JSON.stringify(model).includes(poison), false);
    }
  });
  check('traditional ten-god character variants translate but unknown middle items never shift pairs', () => {
    const result = read(), year = result.chart.pillars.find((pillar) => pillar.key === 'year');
    year.stemTenGod = '偏財'; year.branchTenGods = ['劫財'];
    assert.equal(buildManseView(result).columns[3].stemTenGod, '편재');
    assert.deepEqual(buildManseView(result).columns[3].branchTenGods, ['겁재']);
    year.hiddenStems = ['甲', '乙']; year.branchTenGods = ['正印'];
    const mismatch = buildManseView(result).columns[3];
    assert.deepEqual(mismatch.hiddenStems, []); assert.deepEqual(mismatch.branchTenGods, []);
    assert.ok(mismatch.unavailable.includes('hiddenStems') && mismatch.unavailable.includes('branchTenGods'));
    year.hiddenStems = ['甲', 'unknown', '丙']; year.branchTenGods = ['正印', 'unknown', '偏印'];
    assert.deepEqual(buildManseView(result).columns[3].hiddenStems, []);
    assert.deepEqual(buildManseView(result).columns[3].branchTenGods, []);
  });
  check('missing core, duplicate/extra pillars, invalid sexagenary combinations and mismatches fail closed', () => {
    for (const value of [null, {}, { mode: 'zodiac' }, { mode: 'saju' }]) assert.equal(buildManseView(value), null);
    for (const change of [
      (result) => { result.chart.kind = 'ziwei'; },
      (result) => { delete result.calculation.details.birthTimeKnown; },
      (result) => { result.calculation.details.sect = 1; },
      (result) => { result.chart.pillars.pop(); },
      (result) => { result.chart.pillars.push(clone(result.chart.pillars[0])); },
      (result) => { result.chart.pillars[0].key = 'extra'; },
      (result) => { result.chart.pillars[0].ganZhi = '甲子'; },
      (result) => { result.chart.pillars[0].stem = '甲'; },
      (result) => { result.chart.pillars[0].elements = ['수', '수']; },
      (result) => { result.chart.pillars[0].ganZhi = '甲丑'; result.chart.pillars[0].stem = '甲'; result.chart.pillars[0].branch = '丑'; result.calculation.details.pillars.year = '甲丑'; },
      (result) => { result.calculation.details.birthTimeKnown = false; },
      (result) => { result.chart.pillars.find((pillar) => pillar.key === 'day').stemTenGod = '比肩'; },
      (result) => { result.chart.pillars.find((pillar) => pillar.key === 'year').stemTenGod = '日主'; },
    ]) { const result = read(); change(result); assert.equal(buildManseView(result), null); }
    const unknown = read({ birthTime: null }); unknown.calculation.details.pillars.time = '壬午';
    assert.equal(buildManseView(unknown), null);
  });
  check('contradictory dates or weighted counts fail closed; absent weights never get invented', () => {
    for (const change of [
      (result) => { result.chart.solarDate = '2000-01-01'; },
      (result) => { result.chart.solarDate = '2005-02-30'; },
      (result) => { result.chart.elements[0].count += 1; },
      (result) => { result.chart.elements[0].label = 'unknown'; },
      (result) => { result.calculation.details.elements = []; },
    ]) { const result = read(); change(result); assert.equal(buildManseView(result), null); }
    const result = read(); delete result.chart.elements; delete result.calculation.details.elements;
    const model = buildManseView(result);
    assert.equal(model.facts.mappingWeights, null); assert.equal(model.facts.mappingTotal, null); assert.equal(model.facts.literalTotal, 8);
  });
  check('equivalent leap-lunar and solar readings present the same calculated original chart', () => {
    const lunar = buildManseView(read({ birthDate: '2020-04-01', calendar: 'lunar', leapMonth: true }));
    const solar = buildManseView(read({ birthDate: '2020-05-23' }));
    assert.deepEqual(lunar, solar);
    assert.equal(lunar.facts.solarDate, '2020-05-23');
  });
  check('view construction is deterministic plain JSON, does not mutate, and shares no source arrays', () => {
    const result = read(), before = JSON.stringify(result), model = buildManseView(result);
    assert.equal(JSON.stringify(result), before); assert.deepEqual(buildManseView(result), model);
    assert.deepEqual(clone(model), model);
    model.columns[0].hiddenStems.push('mutated'); model.facts.mappingWeights[0].count += 1;
    assert.equal(JSON.stringify(result), before);
    assert.notDeepEqual(model, buildManseView(result));
    const properties = Object.keys(buildManseView(result).columns[0]);
    assert.equal(properties.some((key) => /shensha|guiren|lucky|fortune/i.test(key)), false);
  });
  console.log(`\n${groups} manse-view test groups passed. Pinned vendor/public-synthetic fixtures only; no DOM, requests or DB.`);
} finally {
  for (const [key, value] of Object.entries(originalGlobals)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
}
