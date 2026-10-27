import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// The vendors execute only inside this process. Fixtures below are public
// documentation examples or synthetic dates; no network, DB or storage access.
const experience = new URL('../public/experience/', import.meta.url);
const sandbox = { console };
sandbox.self = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const filename of ['lunar.js', 'iztro.min.js']) {
  vm.runInContext(await readFile(new URL(`vendor/${filename}`, experience), 'utf8'), sandbox, { filename });
}
const originalGlobals = { Solar: globalThis.Solar, Lunar: globalThis.Lunar, LunarUtil: globalThis.LunarUtil, iztro: globalThis.iztro };
Object.assign(globalThis, { Solar: sandbox.Solar, Lunar: sandbox.Lunar, LunarUtil: sandbox.LunarUtil, iztro: sandbox.iztro });
const { calculateReading } = await import(new URL('reading-engine.js', experience));
const { getZodiacProfile } = await import(new URL('zodiac-profiles.js', experience));
const sample = { birthDate: '2005-12-23', birthTime: '08:37', calendar: 'solar', leapMonth: false, gender: 'female' };
const read = (mode, options = {}) => calculateReading({ ...sample, ...options, mode }, { asOf: '2026-10-22 12:00:00' });
const plain = (value) => JSON.parse(JSON.stringify(value));
let groups = 0;
function check(name, callback) {
  callback();
  groups += 1;
  console.log(`PASS ${name}`);
}
function directSaju(birthDate, birthTime = '12:00') {
  const [year, month, day] = birthDate.split('-').map(Number);
  const [hour, minute] = birthTime.split(':').map(Number);
  const lunar = sandbox.Solar.fromYmdHms(year, month, day, hour, minute, 0).getLunar();
  const bazi = lunar.getEightChar();
  bazi.setSect(2);
  return { bazi, lunar };
}
function comparePillars(result, expected) {
  const methods = { year: 'Year', month: 'Month', day: 'Day', time: 'Time' };
  for (const pillar of result.chart.pillars) {
    const method = methods[pillar.key];
    assert.equal(pillar.ganZhi, expected[`get${method}`]());
    assert.deepEqual(pillar.hiddenStems, Array.from(expected[`get${method}HideGan`]()));
    assert.equal(pillar.stemTenGod, expected[`get${method}ShiShenGan`]());
    assert.deepEqual(pillar.branchTenGods, Array.from(expected[`get${method}ShiShenZhi`]()));
    assert.equal(pillar.growthStage, expected[`get${method}DiShi`]());
    assert.equal(pillar.naYin, expected[`get${method}NaYin`]());
    assert.equal(pillar.voidBranches, expected[`get${method}XunKong`]());
  }
}
const config = { yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'forward', algorithm: 'default' };
function directZiwei(birthDate, birthTime, gender) {
  const hour = Number(birthTime.slice(0, 2));
  return sandbox.iztro.astro.withOptions({
    type: 'solar', dateStr: birthDate, timeIndex: hour === 0 ? 0 : hour === 23 ? 12 : Math.floor((hour + 1) / 2),
    gender, fixLeap: true, language: 'ko-KR', config,
  });
}
const major = (stars) => Array.from(stars).filter((star) => star.type === 'major').map((star) => ({ name: star.name, brightness: star.brightness || '', mutagen: star.mutagen || '' }));
const supplemental = (stars) => Array.from(stars, (star) => ({ name: star.name, brightness: star.brightness || '', mutagen: star.mutagen || '', ...(typeof star.type === 'string' ? { type: star.type } : {}) }));
function comparePalace(actual, expected) {
  for (const key of ['index', 'name', 'heavenlyStem', 'earthlyBranch', 'isBodyPalace']) assert.equal(actual[key], expected[key]);
  assert.deepEqual(actual.majorStars, major(expected.majorStars));
  assert.deepEqual(actual.minorStars, supplemental(expected.minorStars));
  assert.deepEqual(actual.adjectiveStars, supplemental(expected.adjectiveStars));
  assert.ok(!('ages' in actual));
  assert.deepEqual(actual.decadal, expected.decadal ? { range: Array.from(expected.decadal.range),
    heavenlyStem: expected.decadal.heavenlyStem, earthlyBranch: expected.decadal.earthlyBranch } : null);
}

try {
  check('official 2005-12-23 four pillars and all six detail fields match lunar 1.7.7', () => {
    const result = read('saju');
    const { bazi, lunar } = directSaju(sample.birthDate, sample.birthTime);
    assert.deepEqual(result.calculation.details.pillars, { year: '乙酉', month: '戊子', day: '辛巳', time: '壬辰' });
    comparePillars(result, bazi);
    assert.equal(result.chart.solarDate, sample.birthDate);
    assert.equal(result.chart.lunarDate, lunar.toString());
    assert.equal(result.chart.pillars.find((pillar) => pillar.key === 'day').stemTenGod, '日主');
  });
  check('unknown birth time never exposes an invented time pillar or its details', () => {
    const result = read('saju', { birthTime: null });
    comparePillars(result, directSaju(sample.birthDate).bazi);
    assert.deepEqual(result.chart.pillars.map((pillar) => pillar.key), ['year', 'month', 'day']);
    assert.equal(result.calculation.details.pillars.time, null);
    assert.equal(result.chart.elements.reduce((sum, item) => sum + item.count, 0), 7);
    assert.ok(result.uncertainty.some((text) => text.includes('정오를 일주 계산의 기준으로만')));
  });
  check('sect 2 late-Zi day details match the same exact-day vendor methods', () => {
    const result = read('saju', { birthDate: '1988-02-15', birthTime: '23:30' });
    assert.equal(result.calculation.details.pillars.day, '庚子');
    comparePillars(result, directSaju('1988-02-15', '23:30').bazi);
    assert.equal(result.calculation.details.sect, 2);
  });
  check('real leap-month input yields the same full natal chart as its solar date', () => {
    for (const mode of ['saju', 'ziwei']) {
      const lunar = read(mode, { birthDate: '2020-04-01', calendar: 'lunar', leapMonth: true });
      const solar = read(mode, { birthDate: '2020-05-23' });
      assert.deepEqual(lunar.chart, solar.chart);
      assert.equal(lunar.type, solar.type);
    }
    assert.throws(() => read('saju', { birthDate: '2021-04-01', calendar: 'lunar', leapMonth: true }), /음력 날짜나 윤달/);
  });
  check('returned hidden-stem and branch-ten-god arrays do not mutate shared vendor data', () => {
    const first = read('saju');
    const original = plain(first.chart);
    first.chart.pillars[0].hiddenStems.push('not-a-stem');
    first.chart.pillars[0].branchTenGods.length = 0;
    assert.deepEqual(read('saju').chart, original);
  });
  check('missing optional EightChar methods remain null or empty, not fabricated', () => {
    const originalSolar = globalThis.Solar;
    try {
      globalThis.Solar = {
        fromYmdHms(...args) {
          const solar = originalSolar.fromYmdHms(...args);
          const originalGetLunar = solar.getLunar;
          solar.getLunar = () => {
            const lunar = originalGetLunar.call(solar);
            const originalGetEightChar = lunar.getEightChar;
            lunar.getEightChar = () => {
              const bazi = originalGetEightChar.call(lunar);
              for (const prefix of ['Year', 'Month', 'Day', 'Time']) {
                for (const suffix of ['HideGan', 'ShiShenGan', 'ShiShenZhi', 'DiShi', 'NaYin', 'XunKong']) bazi[`get${prefix}${suffix}`] = undefined;
              }
              return bazi;
            };
            return lunar;
          };
          return solar;
        },
      };
      const result = read('saju');
      assert.equal(result.type, 'INFJ');
      for (const pillar of result.chart.pillars) {
        assert.deepEqual(pillar.hiddenStems, []);
        assert.deepEqual(pillar.branchTenGods, []);
        for (const key of ['stemTenGod', 'growthStage', 'naYin', 'voidBranches']) assert.equal(pillar[key], null);
      }
    } finally { globalThis.Solar = originalSolar; }
  });
  check('all 12 Korean palace names and natal star groups match iztro 2.6.2 exactly', () => {
    for (const [birthDate, birthTime, gender] of [['2000-08-16', '03:00', 'female'], ['2005-12-23', '08:37', 'male'], ['1988-02-15', '23:30', 'female']]) {
      const chart = read('ziwei', { birthDate, birthTime, gender }).chart;
      const direct = directZiwei(birthDate, birthTime, gender);
      assert.equal(chart.palaces.length, 12);
      assert.equal(new Set(chart.palaces.map((palace) => palace.name)).size, 12);
      assert.deepEqual(chart.palaces.map((palace) => palace.name), Array.from(direct.palaces, (palace) => palace.name));
      chart.palaces.forEach((palace, index) => comparePalace(palace, direct.palaces[index]));
      comparePalace(chart.soulPalace, direct.palace('命宫'));
      assert.equal(chart.lunarDate, direct.lunarDate);
      assert.ok(chart.palaces.some((palace) => palace.minorStars.length));
      assert.ok(chart.palaces.some((palace) => palace.adjectiveStars.length));
    }
  });
  check('empty soul palace stays empty and uses only the visibly declared real opposite major stars', () => {
    const results = Array.from({ length: 24 }, (_, hour) => read('ziwei', { birthDate: '2000-08-16', birthTime: `${String(hour).padStart(2, '0')}:00` }));
    const result = results.find((item) => item.calculation.details.mappingSource === 'oppositePalace');
    assert.ok(result);
    assert.deepEqual(result.chart.soulPalace.majorStars, []);
    const opposite = result.chart.palaces.find((palace) => palace.index === (result.chart.soulPalace.index + 6) % 12);
    assert.deepEqual(result.calculation.details.majorStars, opposite.majorStars.map((star) => star.name));
    assert.ok(result.uncertainty.some((text) => text.includes('대궁')));
  });
  check('missing or incomplete Ziwei chart never becomes a synthetic 12-palace chart', () => {
    assert.throws(() => read('ziwei', { birthTime: null }), /태어난 시각/);
    assert.throws(() => read('ziwei', { gender: null }), /성별/);
    const original = globalThis.iztro;
    try {
      globalThis.iztro = { astro: { withOptions: () => ({ palaces: [] }) } };
      assert.throws(() => read('ziwei'), /12궁 정보를 확인/);
      globalThis.iztro = { astro: { withOptions: () => ({ palaces: Array.from({ length: 12 }, () => ({ index: 0 })) }) } };
      assert.throws(() => read('ziwei'), /12궁 정보를 확인/);
      globalThis.iztro = { astro: { withOptions: () => ({ palaces: Array.from({ length: 12 }, (_, index) => ({ index: index + 12, name: 'not-a-palace', majorStars: [] })) }) } };
      assert.throws(() => read('ziwei'), /12궁 정보를 확인/);
    } finally { globalThis.iztro = original; }
  });
  check('all 12 zodiac signs have short profile summaries, a brief core and preserved reflection', () => {
    const signs = [
      ['01-20', '물병자리', 'ENTJ'], ['02-19', '물고기자리', 'INFP'], ['03-21', '양자리', 'ENFJ'],
      ['04-20', '황소자리', 'ISTJ'], ['05-21', '쌍둥이자리', 'ENTP'], ['06-22', '게자리', 'INFJ'],
      ['07-23', '사자자리', 'ENFJ'], ['08-23', '처녀자리', 'ISTP'], ['09-23', '천칭자리', 'ENTJ'],
      ['10-23', '전갈자리', 'INFJ'], ['11-22', '사수자리', 'ENFP'], ['12-22', '염소자리', 'ISTJ'],
    ];
    for (const [monthDay, name, type] of signs) {
      const result = read('zodiac', { birthDate: `2000-${monthDay}` });
      const profile = getZodiacProfile(name);
      assert.equal(result.chart.name, name);
      assert.equal(result.type, type);
      assert.equal(result.summary, profile.summary);
      assert.ok(result.summary.length > 0 && result.summary.length <= 140);
      assert.deepEqual(result.keywords, profile.keywords);
      assert.equal(result.sections.length, 2);
      assert.equal(result.sections[0].text, profile.strengths[0]);
      assert.ok(result.sections[0].text.length <= 180);
      assert.equal(result.sections[1].title, '균형을 위한 질문');
      assert.ok(result.sections[1].text.includes(type[0] === 'E' ? '바깥의 교류 뒤에' : '충분히 생각한 것을'));
      assert.ok(result.sections[1].text.includes(type[3] === 'J' ? '익숙한 계획에' : '여러 가능성 중'));
    }
  });
  check('traditional detail data changes neither previous mapping weights nor sample four-letter types', () => {
    assert.equal(read('saju').type, 'INFJ');
    assert.equal(read('ziwei').type, 'ISFJ');
    assert.equal(read('saju').chart.elements.reduce((sum, item) => sum + item.count, 0), 9);
    assert.equal(read('saju').calculation.details.mapping.symbols.reduce((sum, symbol) => sum + symbol.weight, 0), 9);
    assert.equal(read('saju').calculation.version, '1.7.7 / mapping 1.0.0');
    assert.equal(read('ziwei').calculation.version, '2.6.2 / mapping 1.0.0');
    assert.deepEqual(read('ziwei').calculation.details.config, config);
  });
  check('all output remains deterministic plain data without unrequested fortune-cycle fields', () => {
    // V14 supports daYun/liuNian and V22 preserves Ziwei natal decadal ranges.
    // Unrequested annual transits, strength and useful-god fields stay prohibited.
    const forbidden = new Set(['yun', 'ages', 'horoscope', 'strength', 'usefulGod']);
    function inspect(value) {
      if (value === null || typeof value !== 'object') { assert.notEqual(typeof value, 'function'); return; }
      for (const [key, child] of Object.entries(value)) { assert.ok(!forbidden.has(key), `unrequested field ${key}`); inspect(child); }
    }
    for (const mode of ['saju', 'ziwei', 'zodiac']) {
      const result = read(mode);
      assert.deepEqual(result, read(mode));
      assert.deepEqual(result, plain(result));
      inspect(result);
      assert.ok(result.uncertainty.some((text) => text.includes('정식 MBTI 검사')));
      assert.ok(result.uncertainty.some((text) => text.includes('진태양시')));
    }
  });
  console.log(`\n${groups} professional-reading test groups passed. Only local pinned vendors and synthetic/public fixtures were used.`);
} finally {
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
}
