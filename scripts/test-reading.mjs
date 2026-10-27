import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const experience = new URL('../public/experience/', import.meta.url);
const sandbox = { console };
sandbox.self = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const name of ['lunar.js', 'iztro.min.js']) {
  vm.runInContext(await readFile(new URL(`vendor/${name}`, experience), 'utf8'), sandbox, { filename: name });
}
assert.equal(typeof sandbox.Solar.fromYmdHms, 'function');
assert.equal(typeof sandbox.Lunar.fromYmdHms, 'function');
assert.equal(typeof sandbox.iztro.astro.withOptions, 'function');

const originalGlobals = { Solar: globalThis.Solar, Lunar: globalThis.Lunar, LunarUtil: globalThis.LunarUtil, iztro: globalThis.iztro };
Object.assign(globalThis, { Solar: sandbox.Solar, Lunar: sandbox.Lunar, LunarUtil: sandbox.LunarUtil, iztro: sandbox.iztro });
const { calculateReading: calculateAt } = await import(new URL('reading-engine.js', experience));
const calculateReading = (input) => calculateAt(input, { asOf: '2026-10-22 12:00:00' });

let checks = 0;
function check(name, callback) {
  callback();
  checks += 1;
  console.log(`PASS ${name}`);
}
const sample = { birthDate: '2005-12-23', birthTime: '08:37', calendar: 'solar', leapMonth: false, gender: 'female' };
const read = (mode, extra = {}) => calculateReading({ ...sample, mode, ...extra });
const typePattern = /^[EI][SN][TF][JP]$/;

try {
  check('official EightChar 2005-12-23 08:37 four pillars', () => {
    assert.deepEqual(read('saju').calculation.details.pillars, { year: '乙酉', month: '戊子', day: '辛巳', time: '壬辰' });
  });
  check('known and unknown birth times include different pillar sets', () => {
    const unknown = read('saju', { birthTime: null });
    assert.equal(unknown.calculation.details.pillars.time, null);
    assert.equal(unknown.chart.pillars.length, 3);
    assert.equal(unknown.chart.elements.reduce((sum, element) => sum + element.count, 0), 7);
    assert.equal(read('saju').chart.elements.reduce((sum, element) => sum + element.count, 0), 9);
    assert.ok(unknown.uncertainty.some((text) => text.includes('시주와 시주 오행은 결과에 포함하지 않았')));
  });
  check('sect 2 late Zi day boundary follows official test', () => {
    assert.equal(read('saju', { birthDate: '1988-02-15', birthTime: '23:30' }).calculation.details.pillars.day, '庚子');
  });
  check('Korean Ziwei palace and actual major star', () => {
    const chart = read('ziwei', { birthDate: '2000-08-16', birthTime: '03:00' }).chart;
    assert.equal(chart.soulPalace.name, '명궁');
    assert.deepEqual(chart.soulPalace.majorStars.map((star) => star.name), ['자미']);
    assert.equal(chart.palaces.length, 12);
    assert.equal(chart.fiveElementsClass, '목삼국');
    assert.ok(chart.palaces.every((palace) => !('ages' in palace) && Array.isArray(palace.adjectiveStars) && Array.isArray(palace.minorStars)));
  });
  check('Ziwei requires birth time and gender', () => {
    assert.throws(() => read('ziwei', { birthTime: null }), /태어난 시각이 필요/);
    assert.throws(() => read('ziwei', { gender: null }), /성별을 선택/);
  });
  check('Ziwei traditional hour indices at boundaries', () => {
    for (const [birthTime, expected] of [['00:00', 0], ['00:59', 0], ['01:00', 1], ['02:59', 1], ['03:00', 2], ['22:59', 11], ['23:00', 12]]) {
      assert.equal(read('ziwei', { birthTime }).calculation.details.timeIndex, expected);
    }
  });
  check('invalid dates, format, calendars, gender, and hours reject', () => {
    for (const birthDate of ['2005-02-29', '2000-02-30', '2005-04-31', '2005-13-01', '2005-00-10', '2005-12-00', '2005-2-01', '1899-12-31', '2999-01-01']) {
      assert.throws(() => read('saju', { birthDate }), Error, birthDate);
    }
    for (const birthTime of ['24:00', '23:60', '-1:00', '9:00', '', '12:00:00']) {
      assert.throws(() => read('zodiac', { birthTime }), Error, birthTime);
    }
    assert.throws(() => read('saju', { calendar: 'invalid' }), /양력 또는 음력/);
    assert.throws(() => read('saju', { gender: 'invalid' }), /성별/);
    assert.throws(() => read('saju', { leapMonth: true }), /음력 날짜/);
  });
  check('future date within the present year rejects when available', () => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const get = (key) => Number(parts.find((part) => part.type === key).value);
    const tomorrow = new Date(Date.UTC(get('year'), get('month') - 1, get('day') + 1));
    assert.throws(() => read('saju', { birthDate: tomorrow.toISOString().slice(0, 10) }), /미래|오늘/);
  });
  check('real lunar leap month round trip matches Gregorian readings', () => {
    for (const mode of ['saju', 'ziwei', 'zodiac']) {
      const lunar = read(mode, { calendar: 'lunar', birthDate: '2020-04-01', leapMonth: true });
      const solar = read(mode, { birthDate: '2020-05-23' });
      assert.equal(lunar.calculation.details.solarDate, '2020-05-23');
      assert.equal(lunar.type, solar.type);
      assert.deepEqual(lunar.chart, solar.chart);
    }
    assert.throws(() => read('saju', { calendar: 'lunar', birthDate: '2021-04-01', leapMonth: true }), /음력 날짜나 윤달이 존재하지/);
    assert.throws(() => read('saju', { calendar: 'lunar', birthDate: '2020-04-30', leapMonth: true }), /음력 날짜나 윤달이 존재하지/);
  });
  check('all three methods return deterministic, serializable valid types', () => {
    for (const mode of ['zodiac', 'saju', 'ziwei']) {
      const first = read(mode);
      assert.match(first.type, typePattern);
      assert.deepEqual(first, read(mode));
      assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
      assert.ok(first.title && first.summary && first.keywords.length && first.sections.length);
      assert.ok(first.basis.every((item) => typeof item === 'string'));
      assert.ok(first.calculation.rules.every((item) => typeof item === 'string'));
      assert.equal(first.calculation.details.mapping.axes.length, 4);
      assert.ok(first.uncertainty.some((text) => text.includes('정식 MBTI 검사')));
      assert.ok(first.uncertainty.some((text) => text.includes('진태양시')));
    }
  });
  check('zodiac conventional date boundary and year wrap', () => {
    for (const [birthDate, name] of [['2000-01-19', '염소자리'], ['2000-01-20', '물병자리'], ['2000-03-20', '물고기자리'], ['2000-03-21', '양자리'], ['2000-12-22', '염소자리']]) {
      assert.equal(read('zodiac', { birthDate }).chart.name, name);
    }
  });
  check('nickname remains plain text and does not change calculated type', () => {
    const nickname = '<img src=x onerror=alert(1)>';
    const named = read('saju', { nickname });
    assert.equal(named.type, read('saju').type);
    assert.ok(named.summary.startsWith(nickname.slice(0, 24)));
    assert.ok(!('html' in named));
  });
  check('Ziwei empty soul palaces use visibly labelled real opposite stars', () => {
    const empty = read('ziwei', { birthDate: '2000-08-16', birthTime: '01:00' });
    // Find one real empty-palace example deterministically if this hour has stars.
    const result = empty.calculation.details.mappingSource === 'oppositePalace' ? empty :
      Array.from({ length: 24 }, (_, hour) => read('ziwei', { birthDate: '2000-08-16', birthTime: `${String(hour).padStart(2, '0')}:00` }))
        .find((item) => item.calculation.details.mappingSource === 'oppositePalace');
    assert.ok(result);
    assert.equal(result.chart.soulPalace.majorStars.length, 0);
    assert.ok(result.calculation.details.majorStars.length);
    assert.ok(result.uncertainty.some((text) => text.includes('대궁')));
  });
  console.log(`\n${checks} reading-engine test groups passed. Only synthetic/public fixture dates were used; no network calls were made.`);
} finally {
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
}
