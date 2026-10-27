import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { calculateSajuCycles } from '../public/experience/saju-cycles.js';
import { calculateReading } from '../public/experience/reading-engine.js';

// Local public/synthetic dates only. No network, server, DB or personal records.
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(await readFile(new URL('../public/experience/vendor/lunar.js', import.meta.url), 'utf8'), sandbox);
const originals = { Solar: globalThis.Solar, Lunar: globalThis.Lunar, LunarUtil: globalThis.LunarUtil };
Object.assign(globalThis, { Solar: sandbox.Solar, Lunar: sandbox.Lunar, LunarUtil: sandbox.LunarUtil });
const AS_OF = '2026-10-22 12:00:00';
const elements = { 木: '목', 火: '화', 土: '토', 金: '금', 水: '수' };
const plain = (value) => JSON.parse(JSON.stringify(value));
let groups = 0;
function check(label, run) { run(); groups++; console.log(`PASS ${label}`); }
function fixture(birthDate = '2005-12-23', birthTime = '08:37', gender = 'female') {
  const [year, month, day] = birthDate.split('-').map(Number);
  const [hour, minute] = (birthTime || '12:00').split(':').map(Number);
  const solar = sandbox.Solar.fromYmdHms(year, month, day, hour, minute, 0);
  const bazi = solar.getLunar().getEightChar();
  bazi.setSect(2);
  return { solar, bazi, birthTimeKnown: birthTime !== null, gender };
}
const cycles = (input = fixture(), asOf = AS_OF) => calculateSajuCycles(input, { asOf });
function shifted(value, seconds) {
  const date = new Date(`${value.replace(' ', 'T')}Z`);
  date.setUTCSeconds(date.getUTCSeconds() + seconds);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}
function correctedFixture(originalDateTime = '2005-12-23 00:45:00', offsetSeconds = 32400, correctionSeconds = -1928) {
  const engineDateTime = shifted(originalDateTime, 28800 - offsetSeconds);
  const correctedDateTime = shifted(originalDateTime, correctionSeconds);
  const fromStamp = (value) => sandbox.Solar.fromYmdHms(...value.match(/\d+/g).map(Number));
  const solar = fromStamp(engineDateTime), bazi = solar.getLunar().getEightChar();
  const correctedBazi = fromStamp(correctedDateTime).getLunar().getEightChar();
  bazi.setSect(2); correctedBazi.setSect(2);
  return { solar, bazi, correctedBazi, birthTimeKnown: true, gender: 'female', timeCorrection: {
    applied: true, method: 'local-mean-solar', originalDateTime, engineDateTime, correctedDateTime, offsetSeconds,
    utcDateTime: `${shifted(originalDateTime, -offsetSeconds).replace(' ', 'T')}Z`,
  } };
}
function symbolMatch(actual, ganZhi, dayStem) {
  assert.equal(actual.ganZhi, ganZhi);
  const [stem, branch] = [...ganZhi];
  assert.equal(actual.stem, stem); assert.equal(actual.branch, branch);
  assert.deepEqual(actual.elements, [elements[sandbox.LunarUtil.WU_XING_GAN[stem]], elements[sandbox.LunarUtil.WU_XING_ZHI[branch]]]);
  assert.deepEqual(actual.hiddenStems, Array.from(sandbox.LunarUtil.ZHI_HIDE_GAN[branch]));
  assert.equal(actual.stemTenGod, sandbox.LunarUtil.SHI_SHEN[dayStem + stem]);
  assert.deepEqual(actual.branchTenGods, Array.from(sandbox.LunarUtil.ZHI_HIDE_GAN[branch], (hidden) => sandbox.LunarUtil.SHI_SHEN[dayStem + hidden]));
}

try {
  check('legacy full JSON matches the pre-correction baseline for four synthetic natal inputs', () => {
    const inputs = [fixture(), fixture('1900-01-01', '12:00', 'male'), fixture('1988-02-15', '08:37', 'male'), fixture('2000-01-01', null, null)];
    const expected = '9885e5fde11af79215717bf7bdcaacb69600e2faf07174b07854dbda955c1261';
    const fingerprint = (values) => createHash('sha256').update(JSON.stringify(values)).digest('hex');
    assert.equal(fingerprint(inputs.map((input) => cycles(input))), expected);
    assert.equal(fingerprint(inputs.map((input) => cycles({ ...input, timeCorrection: 'none' }))), expected);
    assert.equal(fingerprint(inputs.map((input) => cycles({ ...input, timeCorrection: { applied: false } }))), expected);
  });
  check('official pinned EightChar fixture uses minute-based getYun sect 2 and real nine DaYun rows', () => {
    const input = fixture(), actual = cycles(input), yun = input.bazi.getYun(0, 2), direct = yun.getDaYun();
    assert.equal(actual.engine, 'lunar-javascript');
    assert.equal(actual.asOf, AS_OF);
    assert.equal(actual.daYun.status, 'available');
    assert.equal(actual.daYun.startSolar, yun.getStartSolar().toYmdHms());
    assert.equal(actual.daYun.startSolar, '2010-06-18 02:37:00');
    assert.deepEqual(actual.daYun.startOffset, { years: yun.getStartYear(), months: yun.getStartMonth(), days: yun.getStartDay(), hours: yun.getStartHour() });
    assert.equal(actual.daYun.list.length, 9);
    assert.ok(actual.daYun.list.every((item) => item.index > 0));
    assert.equal(direct[0].getGanZhi(), '');
    for (const row of actual.daYun.list) {
      const expected = direct[row.index];
      symbolMatch(row, expected.getGanZhi(), input.bazi.getDayGan());
      assert.equal(row.startYear, expected.getStartYear()); assert.equal(row.endYear, expected.getEndYear());
      assert.equal(row.startAge, expected.getStartAge()); assert.equal(row.endAge, expected.getEndAge());
      assert.equal(row.startSolar, yun.getStartSolar().nextYear((row.index - 1) * 10).toYmdHms());
      assert.equal(row.endSolarExclusive, yun.getStartSolar().nextYear(row.index * 10).toYmdHms());
    }
    assert.match(actual.daYun.ageConvention, /명목 나이.*만 나이가 아닙니다/);
    assert.ok(actual.rules.some((text) => /getYun.*2/.test(text)));
  });
  check('yang male / yin female forward and yang female / yin male reverse match the vendor', () => {
    for (const [birthDate, gender, expected] of [['1988-02-15', 'male', 'forward'], ['1988-02-15', 'female', 'backward'], ['2005-12-23', 'female', 'forward'], ['2005-12-23', 'male', 'backward']]) {
      const input = fixture(birthDate, '08:37', gender), actual = cycles(input);
      const direct = input.bazi.getYun(gender === 'male' ? 1 : 0, 2);
      assert.equal(actual.daYun.direction, expected);
      assert.equal(actual.daYun.direction, direct.isForward() ? 'forward' : 'backward');
      assert.equal(actual.daYun.startSolar, direct.getStartSolar().toYmdHms());
    }
  });
  check('current and next change at the exact handover second, not January 1', () => {
    const input = fixture(), base = cycles(input), boundary = base.daYun.list[1].startSolar;
    const january = cycles(input, '2020-01-01 00:00:00');
    assert.equal(january.daYun.current.index, 1);
    const before = cycles(input, shifted(boundary, -1)), exact = cycles(input, boundary), after = cycles(input, shifted(boundary, 1));
    assert.equal(before.daYun.current.index, 1); assert.equal(before.daYun.next.index, 2);
    assert.equal(exact.daYun.current.index, 2); assert.equal(exact.daYun.next.index, 3);
    assert.equal(after.daYun.current.index, 2);
    assert.equal(before.daYun.current.endSolarExclusive, exact.daYun.current.startSolar);
  });
  check('before first handover, oldest supported births and capped distant ranges remain explicit', () => {
    const input = fixture(), first = cycles(input).daYun.startSolar;
    const before = cycles(input, shifted(first, -1));
    assert.equal(before.daYun.rangeStatus, 'before-first');
    assert.equal(before.daYun.current, null); assert.equal(before.daYun.next.index, 1);
    assert.equal(cycles(input, first).daYun.current.index, 1);
    const old = cycles(fixture('1900-01-01', '12:00', 'male'));
    assert.equal(old.daYun.status, 'available'); assert.equal(old.daYun.rangeStatus, 'within-list');
    assert.ok(old.daYun.current); assert.ok(old.daYun.next);
    assert.ok(old.daYun.list.length > 9 && old.daYun.list.length <= 19);
    assert.ok(old.daYun.list.at(-1).index >= old.daYun.current.index + 2);
    assert.equal(old.liuNian.years.length, 5);
    const distant = cycles(fixture('1900-01-01', '12:00', 'male'), '2200-10-22 12:00:00');
    assert.equal(distant.daYun.rangeStatus, 'after-list'); assert.equal(distant.daYun.list.length, 19);
    assert.equal(distant.daYun.current, null); assert.equal(distant.daYun.next, null);
    assert.match(distant.daYun.reason, /목록 이후.*추정하지/);
  });
  check('unknown time or gender hard-gates getYun while independent annual symbols remain real', () => {
    for (const [birthTime, gender] of [[null, 'female'], ['08:37', null], [null, null], ['08:37', 'unknown']]) {
      const input = fixture('2005-12-23', birthTime, gender);
      let calls = 0;
      input.bazi.getYun = () => { calls++; throw new Error('must not be called'); };
      const result = cycles(input);
      assert.equal(calls, 0); assert.equal(result.daYun.status, 'missing-input');
      assert.equal(result.daYun.startSolar, null); assert.equal(result.daYun.direction, null);
      assert.deepEqual(result.daYun.list, []); assert.equal(result.daYun.current, null); assert.equal(result.daYun.next, null);
      assert.equal(result.liuNian.status, 'available'); assert.equal(result.liuNian.years.length, 5);
      assert.ok(result.liuNian.years.every((year) => year.source === 'getYearInGanZhiExact'));
    }
  });
  check('January and exact LiChun second choose the actual current GanZhi year', () => {
    const input = fixture(), boundary = sandbox.Solar.fromYmdHms(2026, 7, 1, 12, 0, 0).getLunar().getJieQiTable()['立春'].toYmdHms();
    for (const asOf of ['2026-01-01 00:00:00', shifted(boundary, -1)]) {
      const result = cycles(input, asOf);
      assert.equal(result.liuNian.currentYear, 2025); assert.equal(result.liuNian.years[0].ganZhi, '乙巳');
      assert.deepEqual(result.liuNian.years.map((year) => year.year), [2025, 2026, 2027, 2028, 2029]);
    }
    for (const asOf of [boundary, shifted(boundary, 1)]) {
      const result = cycles(input, asOf);
      assert.equal(result.liuNian.currentYear, 2026); assert.equal(result.liuNian.years[0].ganZhi, '丙午');
      assert.equal(result.liuNian.years[0].startSolar, boundary);
    }
  });
  check('all five annual symbols match getLiuNian and independent exact year pillars', () => {
    for (const birthDate of ['2005-12-23', '2000-01-01', '1988-02-15']) {
      const input = fixture(birthDate), result = cycles(input);
      const direct = input.bazi.getYun(0, 2).getDaYun().flatMap((item) => Array.from(item.getLiuNian()));
      for (const year of result.liuNian.years) {
        const expected = direct.find((item) => item.getYear() === year.year);
        const independent = sandbox.Solar.fromYmdHms(year.year, 7, 1, 12, 0, 0).getLunar().getYearInGanZhiExact();
        assert.equal(year.ganZhi, independent); if (expected) assert.equal(year.ganZhi, expected.getGanZhi());
        symbolMatch(year, independent, input.bazi.getDayGan());
        assert.equal(year.isCurrent, year.year === result.liuNian.currentYear);
      }
    }
  });
  check('annual data never depends on the currently selected DaYun integer-year bucket', () => {
    const input = fixture(), result = cycles(input, '2020-01-15 12:00:00');
    assert.equal(result.daYun.current.index, 1);
    // It is still 2019 before LiChun, even though the Gregorian date is 2020.
    assert.equal(result.liuNian.currentYear, 2019);
    const afterLiChun = cycles(input, '2020-03-15 12:00:00');
    assert.equal(afterLiChun.daYun.current.index, 1);
    assert.equal(afterLiChun.liuNian.currentYear, 2020);
    assert.equal(afterLiChun.liuNian.years[0].ganZhi, '庚子');
  });
  check('Date/offset timestamps normalize to Seoul, and explicit wall times stay explicit', () => {
    const input = fixture();
    assert.equal(cycles(input, new Date('2026-01-01T15:00:00Z')).asOf, '2026-01-02 00:00:00');
    assert.equal(cycles(input, '2026-01-01T15:00:00Z').asOf, '2026-01-02 00:00:00');
    assert.equal(cycles(input, '2026-01-02T00:00:00+09:00').asOf, '2026-01-02 00:00:00');
    assert.equal(cycles(input, '2026-01-02').asOf, '2026-01-02 00:00:00');
    assert.equal(cycles(input, '2026-01-02 13:37').asOf, '2026-01-02 13:37:00');
    for (const asOf of ['bad', '2026-02-30', '2026-13-01', '2026-01-01 24:00:00', '2026-02-30T12:00:00Z', new Date(NaN), 0]) {
      const result = cycles(input, asOf);
      assert.equal(result.asOf, null); assert.equal(result.daYun.status, 'unavailable'); assert.deepEqual(result.liuNian.years, []);
    }
  });
  check('missing Yun/list data fails closed without blocking valid independent annual calculations', () => {
    for (const corruption of [
      (yun) => { yun.getStartSolar = () => null; },
      (yun) => { yun.getDaYun = () => []; },
      (yun) => { const original = yun.getDaYun; yun.getDaYun = () => { const list = original.call(yun); list[1].getGanZhi = () => ''; return list; }; },
      (yun) => { const original = yun.getDaYun; yun.getDaYun = () => { const list = original.call(yun); list[1].getLiuNian = undefined; return list; }; },
    ]) {
      const input = fixture(), original = input.bazi.getYun;
      input.bazi.getYun = (...args) => { const yun = original.apply(input.bazi, args); corruption(yun); return yun; };
      const result = cycles(input);
      assert.equal(result.daYun.status, 'unavailable'); assert.deepEqual(result.daYun.list, []);
      assert.equal(result.daYun.startSolar, null); assert.equal(result.daYun.current, null);
      assert.equal(result.liuNian.status, 'available'); assert.equal(result.liuNian.years.length, 5);
    }
  });
  check('inconsistent vendor annual symbols or missing symbol tables never become plausible replacements', () => {
    const input = fixture(), original = input.bazi.getYun;
    input.bazi.getYun = (...args) => {
      const yun = original.apply(input.bazi, args), originalList = yun.getDaYun;
      yun.getDaYun = () => originalList.call(yun).map((row) => {
        const originalYears = row.getLiuNian;
        row.getLiuNian = () => originalYears.call(row).map((year) => { if (year.getYear() === 2026) year.getGanZhi = () => '甲子'; return year; });
        return row;
      });
      return yun;
    };
    const result = cycles(input);
    assert.equal(result.daYun.status, 'available');
    assert.equal(result.liuNian.status, 'unavailable'); assert.deepEqual(result.liuNian.years, []);
    const missing = calculateSajuCycles(fixture(), { asOf: AS_OF, LunarUtil: {} });
    assert.equal(missing.daYun.status, 'unavailable'); assert.deepEqual(missing.liuNian.years, []);
    const mismatch = fixture(); mismatch.solar = fixture('2000-01-01').solar;
    const rejected = cycles(mismatch);
    assert.equal(rejected.daYun.status, 'unavailable'); assert.deepEqual(rejected.liuNian.years, []);
  });
  check('engine integration preserves natal pillars and personality weights independently of cycles', () => {
    const input = { mode: 'saju', birthDate: '2005-12-23', birthTime: '08:37', calendar: 'solar', leapMonth: false, gender: 'female' };
    const first = calculateReading(input, { asOf: AS_OF });
    assert.equal(first.type, 'INFJ'); assert.deepEqual(first.calculation.details.pillars, { year: '乙酉', month: '戊子', day: '辛巳', time: '壬辰' });
    assert.equal(first.chart.cycles.daYun.status, 'available');
    for (const gender of [null, 'male']) {
      const next = calculateReading({ ...input, gender }, { asOf: AS_OF });
      assert.equal(next.type, first.type); assert.deepEqual(next.basis, first.basis);
      assert.deepEqual(next.calculation.details.mapping, first.calculation.details.mapping);
    }
    const unknown = calculateReading({ ...input, birthTime: null }, { asOf: AS_OF });
    assert.equal(unknown.chart.pillars.length, 3); assert.equal(unknown.calculation.details.pillars.time, null);
    assert.equal(unknown.chart.cycles.daYun.status, 'missing-input'); assert.equal(unknown.chart.cycles.liuNian.status, 'available');
    assert.deepEqual(calculateReading(input, { asOf: AS_OF }), first);
    assert.deepEqual(first, plain(first));
  });
  check('equivalent lunar leap input yields identical cycles with no raw calendar ambiguity', () => {
    const base = { mode: 'saju', birthTime: '08:37', gender: 'female' };
    const lunar = calculateReading({ ...base, birthDate: '2020-04-01', calendar: 'lunar', leapMonth: true }, { asOf: AS_OF });
    const solar = calculateReading({ ...base, birthDate: '2020-05-23', calendar: 'solar', leapMonth: false }, { asOf: AS_OF });
    assert.deepEqual(lunar.chart.cycles, solar.chart.cycles);
  });
  check('plain deterministic cycle data never mutates vendor symbol tables and documents limits', () => {
    const input = fixture(), result = cycles(input), saved = plain(result);
    result.daYun.list[0].hiddenStems.push('not-a-stem'); result.liuNian.years[0].branchTenGods.length = 0;
    assert.deepEqual(cycles(input), saved);
    assert.deepEqual(saved, plain(saved));
    assert.ok(saved.limitations.some((text) => /건강·재산·미래.*보장하지/.test(text)));
    assert.ok(saved.limitations.some((text) => /Asia\/Seoul.*진태양시/.test(text)));
    assert.ok(saved.rules.some((text) => /기존 성향 연결표와 가중치에는 반영하지/.test(text)));
  });
  check('corrected cycles use absolute UTC+08 Yun and the separate LMT day stem for all TenGods', () => {
    const input = correctedFixture(), direct = input.bazi.getYun(0, 2), dayStem = input.correctedBazi.getDayGan();
    assert.notEqual(dayStem, input.bazi.getDayGan());
    input.correctedBazi.getYun = () => { throw new Error('LMT must never become the Jie/Yun clock'); };
    const result = cycles(input), expectedRows = direct.getDaYun();
    assert.equal(result.daYun.status, 'available'); assert.equal(result.liuNian.status, 'available');
    assert.equal(result.daYun.startSolar, direct.getStartSolar().toYmdHms());
    assert.equal(result.daYun.direction, direct.isForward() ? 'forward' : 'backward');
    assert.deepEqual(result.daYun.startOffset, { years: direct.getStartYear(), months: direct.getStartMonth(), days: direct.getStartDay(), hours: direct.getStartHour() });
    assert.equal(result.dayStem, dayStem);
    for (const row of result.daYun.list) symbolMatch(row, expectedRows[row.index].getGanZhi(), dayStem);
    for (const row of result.liuNian.years) {
      const independent = sandbox.Solar.fromYmdHms(row.year, 7, 1, 12, 0, 0).getLunar().getYearInGanZhiExact();
      symbolMatch(row, independent, dayStem);
    }
    assert.equal(result.solarTimeZone, 'UTC+08:00');
    assert.equal(result.daYun.startSolarTimeZone, 'UTC+08:00');
    assert.deepEqual(result.timeBasis, { timeZone: 'UTC+08:00', asOfTimeZone: 'UTC+08:00',
      civilBirthDateTime: input.timeCorrection.originalDateTime, utcBirthDateTime: input.timeCorrection.utcDateTime,
      engineBirthDateTime: input.timeCorrection.engineDateTime, correctedBirthDateTime: input.timeCorrection.correctedDateTime });
    assert.deepEqual(result, plain(result));
    assert.equal(result.asOf, '2026-10-22 11:00:00');
  });
  check('corrected reference conversion honors historical Seoul offsets and rejects gaps and folds', () => {
    const input = correctedFixture();
    for (const asOf of [new Date('2026-01-01T15:00:00Z'), '2026-01-01T15:00:00Z', '2026-01-02T00:00:00+09:00', '2026-01-02']) {
      assert.equal(cycles(input, asOf).asOf, '2026-01-01 23:00:00');
    }
    assert.equal(cycles(input, '1988-06-01 12:00:00').asOf, '1988-06-01 10:00:00');
    assert.equal(cycles(input, '1955-06-01 12:00:00').asOf, '1955-06-01 10:30:00');
    assert.equal(cycles(input, '1954-04-01 12:00:00').asOf, '1954-04-01 11:30:00');
    for (const asOf of ['1988-05-08 02:30:00', '1988-10-09 02:30:00', '1954-03-20 23:45:00', '1900-01-01', '2026-02-30']) {
      const result = cycles(input, asOf);
      assert.equal(result.asOf, null); assert.equal(result.daYun.status, 'unavailable'); assert.deepEqual(result.liuNian.years, []);
    }
    const firstFold = cycles(input, '1988-10-09T02:30:00+10:00');
    const secondFold = cycles(input, '1988-10-09T02:30:00+09:00');
    assert.equal(firstFold.asOf, '1988-10-09 00:30:00');
    assert.equal(secondFold.asOf, '1988-10-09 01:30:00');
  });
  check('corrected current annual year changes at the same absolute LiChun instant', () => {
    const input = correctedFixture();
    const boundary = sandbox.Solar.fromYmdHms(2026, 7, 1, 12, 0, 0).getLunar().getJieQiTable()['立春'].toYmdHms();
    const seoulBoundary = shifted(boundary, 3600);
    const before = cycles(input, shifted(seoulBoundary, -1));
    const exact = cycles(input, seoulBoundary);
    const absolute = cycles(input, `${shifted(boundary, -28800).replace(' ', 'T')}Z`);
    assert.equal(before.liuNian.currentYear, 2025); assert.equal(before.liuNian.years[0].ganZhi, '乙巳');
    assert.equal(exact.liuNian.currentYear, 2026); assert.equal(exact.liuNian.years[0].ganZhi, '丙午');
    assert.equal(exact.liuNian.years[0].startSolar, boundary); assert.deepEqual(absolute, exact);
  });
  check('absolute birth retains the correct year/month Yun even when LMT crosses LiChun', () => {
    const boundary = sandbox.Solar.fromYmdHms(2026, 7, 1, 12, 0, 0).getLunar().getJieQiTable()['立春'].toYmdHms();
    const input = correctedFixture(shifted(boundary, 2400));
    assert.notEqual(input.bazi.getYear(), input.correctedBazi.getYear());
    assert.notEqual(input.bazi.getMonth(), input.correctedBazi.getMonth());
    const expected = input.bazi.getYun(0, 2), wrongClock = input.correctedBazi.getYun(0, 2), actual = cycles(input);
    assert.notEqual(expected.isForward(), wrongClock.isForward());
    assert.equal(actual.daYun.status, 'available');
    assert.equal(actual.daYun.direction, expected.isForward() ? 'forward' : 'backward');
    assert.equal(actual.daYun.startSolar, expected.getStartSolar().toYmdHms());
    assert.notEqual(actual.daYun.startSolar, wrongClock.getStartSolar().toYmdHms());
    assert.equal(actual.daYun.list[0].ganZhi, expected.getDaYun()[1].getGanZhi());
  });
  check('corrected civil birthday stays explicit when UTC+08 engine birth crosses New Year', () => {
    const input = correctedFixture('2000-01-01 00:45:00'), result = cycles(input);
    assert.equal(result.timeBasis.civilBirthDateTime, '2000-01-01 00:45:00');
    assert.equal(result.timeBasis.engineBirthDateTime, '1999-12-31 23:45:00');
    assert.equal(result.timeBasis.correctedBirthDateTime, '2000-01-01 00:12:52');
    assert.equal(result.daYun.status, 'available');
    assert.match(result.daYun.ageConvention, /UTC\+08:00 엔진 시각의 양력 연도/);
    for (const row of result.daYun.list) assert.equal(row.startAge, row.startYear - 1999 + 1);
  });
  check('corrected handover comparisons use UTC+08 startSolar and an absolute reference', () => {
    const input = correctedFixture(), base = cycles(input), boundary = base.daYun.list[1].startSolar;
    const seoulBoundary = shifted(boundary, 3600);
    const before = cycles(input, shifted(seoulBoundary, -1)), exact = cycles(input, seoulBoundary);
    assert.equal(before.daYun.current.index, 1); assert.equal(before.daYun.next.index, 2);
    assert.equal(exact.daYun.current.index, 2); assert.equal(exact.daYun.next.index, 3);
    assert.equal(exact.asOf, boundary);
    assert.deepEqual(cycles(input, `${shifted(boundary, -28800).replace(' ', 'T')}Z`), exact);
  });
  check('mismatched corrected natal clocks and incomplete correction metadata fail closed', () => {
    for (const mutate of [
      (input) => { input.correctedBazi = fixture('2000-01-01').bazi; },
      (input) => { delete input.correctedBazi; },
      (input) => { input.timeCorrection.method = 'true-solar'; },
      (input) => { input.timeCorrection.utcDateTime = '2005-12-22T16:45:00Z'; },
      (input) => { input.timeCorrection.offsetSeconds = 36000; },
      (input) => { input.timeCorrection.originalDateTime = '2005-02-30 00:45:00'; },
      (input) => { delete input.timeCorrection.originalDateTime; },
    ]) {
      const input = correctedFixture(); mutate(input);
      const result = cycles(input);
      assert.equal(result.daYun.status, 'unavailable'); assert.equal(result.daYun.startSolar, null);
      assert.deepEqual(result.daYun.list, []); assert.deepEqual(result.liuNian.years, []);
    }
    const input = correctedFixture(); input.birthTimeKnown = false;
    const result = cycles(input);
    assert.equal(result.daYun.status, 'missing-input'); assert.equal(result.liuNian.status, 'available');
    assert.equal(result.daYun.startSolarTimeZone, 'UTC+08:00');
  });
  console.log(`\n${groups} saju-cycle test groups passed. Local pinned vendor and public/synthetic dates only; no requests or DB access.`);
} finally {
  for (const [key, value] of Object.entries(originals)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
}
