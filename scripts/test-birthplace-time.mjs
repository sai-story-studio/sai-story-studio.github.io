import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { KOREAN_BIRTHPLACES, getKoreanBirthplace, resolveSeoulCivilTime, resolveKoreanBirthTime } from '../public/experience/birthplace-time.js';

// Public documentation and synthetic calendar fixtures only. No HTTP, DB,
// storage, user identities, or external ephemeris requests are made.
let groups = 0;
function check(name, callback) { callback(); groups++; console.log(`PASS ${name}`); }
const stamp = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const corrected = (solarDate, birthTime, extra = {}) => resolveKoreanBirthTime({ solarDate, birthTime,
  birthplaceId: 'seoul', timeCorrection: 'local-mean-solar', ...extra });

check('18 bounded KMA station references are frozen and source-linked', () => {
  assert.equal(KOREAN_BIRTHPLACES.length, 18);
  assert.ok(Object.isFrozen(KOREAN_BIRTHPLACES));
  assert.equal(new Set(KOREAN_BIRTHPLACES.map((city) => city.id)).size, 18);
  for (const city of KOREAN_BIRTHPLACES) {
    assert.ok(Object.isFrozen(city));
    assert.equal(getKoreanBirthplace(city.id), city);
    assert.ok(city.latitude > 33 && city.latitude < 39 && city.longitude > 126 && city.longitude < 130);
    assert.ok(/^https:\/\/(data|nmsc)\.kma\.go\.kr\//.test(city.sourceUrl));
  }
  assert.equal(getKoreanBirthplace('not-a-city'), null);
  assert.throws(() => { getKoreanBirthplace('seoul').longitude = 0; });
});

check('strict civil input and pre-1908 refusal do not silently normalize', () => {
  for (const value of ['1900-01-01 12:00:00', '1908-03-31 23:59:59']) assert.equal(resolveSeoulCivilTime(value).status, 'unsupported');
  for (const value of ['2000-02-30 12:00:00', '2001-02-29 12:00:00', '2020-01-01 24:00:00',
    '2020-01-01 08:60:00', '2020-01-01 08:00:60', '2020-1-1 08:00:00', '2020-01-01T08:00:00Z', null]) {
    assert.equal(resolveSeoulCivilTime(value).status, 'invalid-input', String(value));
  }
  assert.equal(resolveSeoulCivilTime('2000-02-29 08:37:00').status, 'valid');
});

// Independently transcribed from IANA 2026e Asia/Seoul + Rule ROK. Assert BOTH
// endpoints of every fold/gap, rather than trusting the host OS timezone data.
const transitions = [
  ['1908-03-31T15:32:08Z', 30472, 30600], ['1911-12-31T15:30:00Z', 30600, 32400],
  ['1948-05-31T15:00:00Z', 32400, 36000], ['1948-09-12T14:00:00Z', 36000, 32400],
  ['1949-04-02T15:00:00Z', 32400, 36000], ['1949-09-10T14:00:00Z', 36000, 32400],
  ['1950-03-31T15:00:00Z', 32400, 36000], ['1950-09-09T14:00:00Z', 36000, 32400],
  ['1951-05-05T15:00:00Z', 32400, 36000], ['1951-09-08T14:00:00Z', 36000, 32400],
  ['1954-03-20T15:00:00Z', 32400, 30600],
  ['1955-05-04T15:30:00Z', 30600, 34200], ['1955-09-08T14:30:00Z', 34200, 30600],
  ['1956-05-19T15:30:00Z', 30600, 34200], ['1956-09-29T14:30:00Z', 34200, 30600],
  ['1957-05-04T15:30:00Z', 30600, 34200], ['1957-09-21T14:30:00Z', 34200, 30600],
  ['1958-05-03T15:30:00Z', 30600, 34200], ['1958-09-20T14:30:00Z', 34200, 30600],
  ['1959-05-02T15:30:00Z', 30600, 34200], ['1959-09-19T14:30:00Z', 34200, 30600],
  ['1960-04-30T15:30:00Z', 30600, 34200], ['1960-09-17T14:30:00Z', 34200, 30600],
  ['1961-08-09T15:30:00Z', 30600, 32400],
  ['1987-05-09T17:00:00Z', 32400, 36000], ['1987-10-10T17:00:00Z', 36000, 32400],
  ['1988-05-07T17:00:00Z', 32400, 36000], ['1988-10-08T17:00:00Z', 36000, 32400],
];
check('all 28 historical changes: exact fold/gap edges and valid outside edges', () => {
  for (const [instant, previous, next] of transitions) {
    const utc = Date.parse(instant);
    const lower = utc + Math.min(previous, next) * 1000;
    const upper = utc + Math.max(previous, next) * 1000;
    const status = next > previous ? 'nonexistent' : 'ambiguous';
    for (const wall of [lower, upper - 1000]) {
      const result = resolveSeoulCivilTime(stamp(wall));
      assert.equal(result.status, status, `${instant}: ${stamp(wall)}`);
      assert.equal(result.candidates.length, status === 'ambiguous' ? 2 : 0);
    }
    const before = resolveSeoulCivilTime(stamp(lower - 1000));
    assert.equal(before.status, instant.startsWith('1908') ? 'unsupported' : 'valid');
    const after = resolveSeoulCivilTime(stamp(upper));
    assert.equal(after.status, 'valid');
    assert.equal(after.offsetSeconds, next);
  }
});

check('standard offset and DST are separate, east-positive mean solar math is exact', () => {
  const seoul = corrected('2005-12-23', '08:37');
  assert.equal(seoul.originalDateTime, '2005-12-23 08:37:00');
  assert.equal(seoul.utcDateTime, '2005-12-22T23:37:00Z');
  assert.equal(seoul.engineDateTime, '2005-12-23 07:37:00');
  assert.equal(seoul.correctedDateTime, '2005-12-23 08:04:52');
  assert.equal(seoul.offsetSeconds, 32400); assert.equal(seoul.standardOffsetSeconds, 32400); assert.equal(seoul.dstSeconds, 0);
  assert.equal(seoul.longitudeSeconds, 30472); assert.equal(seoul.correctionSeconds, -1928);
  const busan = corrected('2005-12-23', '08:37', { birthplaceId: 'busan' });
  assert.equal(busan.longitudeSeconds, 30968); assert.equal(busan.correctionSeconds, -1432);
  const summer = corrected('1988-07-01', '08:37');
  assert.equal(summer.offsetSeconds, 36000); assert.equal(summer.standardOffsetSeconds, 32400);
  assert.equal(summer.dstSeconds, 3600); assert.equal(summer.correctionSeconds, -5528);
  const oldSummer = corrected('1956-07-01', '08:37');
  assert.equal(oldSummer.standardOffsetSeconds, 30600); assert.equal(oldSummer.dstSeconds, 3600); assert.equal(oldSummer.correctionSeconds, -3728);
  for (const city of KOREAN_BIRTHPLACES) {
    const result = corrected('2000-01-01', '00:10', { birthplaceId: city.id });
    assert.equal(Date.parse(result.correctedDateTime.replace(' ', 'T') + 'Z') - Date.parse(result.utcDateTime), Math.round(city.longitude * 240) * 1000);
    assert.equal(result.correctionSeconds, Math.round(city.longitude * 240) - result.offsetSeconds);
  }
});

check('none, unknown time, missing city and bad historical clocks never infer correction', () => {
  const none = resolveKoreanBirthTime({ solarDate: '1900-01-01', birthTime: '08:37', birthplaceId: 'seoul' });
  assert.equal(none.status, 'not-requested'); assert.equal(none.applied, false); assert.equal(none.correctedDateTime, null);
  const unknown = corrected('1900-01-01', null);
  assert.equal(unknown.status, 'missing-time'); assert.equal(unknown.originalDateTime, null); assert.equal(unknown.correctedDateTime, null);
  assert.equal(corrected('2005-12-23', '08:37', { birthplaceId: 'unknown' }).status, 'city-required');
  assert.equal(corrected('2005-12-23', '08:37', { timeCorrection: 'true-solar' }).status, 'invalid-input');
  assert.equal(corrected('1988-05-08', '02:30').status, 'nonexistent');
  assert.equal(corrected('1988-10-09', '02:30').status, 'ambiguous');
  assert.equal(corrected('1908-03-31', '08:37').status, 'unsupported');
  const value = { solarDate: '2005-12-23', birthTime: '08:37', birthplaceId: 'seoul', timeCorrection: 'local-mean-solar' };
  const before = JSON.stringify(value);
  assert.deepEqual(resolveKoreanBirthTime(value), resolveKoreanBirthTime(value));
  assert.equal(JSON.stringify(value), before);
});

const experience = new URL('../public/experience/', import.meta.url);
const sandbox = { console }; sandbox.self = sandbox; sandbox.window = sandbox; vm.createContext(sandbox);
for (const filename of ['lunar.js', 'iztro.min.js']) vm.runInContext(await readFile(new URL(`vendor/${filename}`, experience), 'utf8'), sandbox, { filename });
for (const key of ['Solar', 'Lunar', 'LunarUtil', 'iztro']) globalThis[key] = sandbox[key];
const { calculateReading } = await import('../public/experience/reading-engine.js');
const { buildManseView } = await import('../public/experience/manse-view.js');
const { prepareReadingRecord } = await import('../public/experience/reading-records.js');
const options = { asOf: '2026-10-23 12:00:00' };
const basic = { mode: 'saju', birthDate: '2005-12-23', birthTime: '00:45', calendar: 'solar', leapMonth: false, gender: 'female' };
const read = (extra = {}) => calculateReading({ ...basic, birthplaceId: 'seoul', timeCorrection: 'local-mean-solar', ...extra }, options);
function baziAt(value) {
  const bazi = sandbox.Solar.fromYmdHms(...value.match(/\d+/g).map(Number)).getLunar().getEightChar(); bazi.setSect(2); return bazi;
}
function directComparison(result) {
  const meta = result.chart.timeCorrection;
  const physical = baziAt(meta.engineDateTime), local = baziAt(meta.correctedDateTime);
  // Use the original vendor functions with a test-only day-master adapter.
  // This checks production's table reconstruction against vendor executable code.
  const relative = Object.create(physical);
  relative.getDayGan = () => local.getDayGan(); relative.getDayGanIndex = () => local.getDayGanIndex();
  for (const pillar of result.chart.pillars) {
    const name = { year: 'Year', month: 'Month', day: 'Day', time: 'Time' }[pillar.key];
    const source = ['year', 'month'].includes(pillar.key) ? physical : local;
    const labels = ['year', 'month'].includes(pillar.key) ? relative : local;
    assert.equal(pillar.ganZhi, source[`get${name}`]());
    assert.equal(result.calculation.details.pillars[pillar.key], pillar.ganZhi);
    assert.deepEqual(pillar.hiddenStems, Array.from(source[`get${name}HideGan`]()));
    assert.equal(pillar.stemTenGod, labels[`get${name}ShiShenGan`]());
    assert.deepEqual(pillar.branchTenGods, Array.from(labels[`get${name}ShiShenZhi`]()));
    assert.equal(pillar.growthStage, labels[`get${name}DiShi`]());
    assert.equal(pillar.naYin, source[`get${name}NaYin`]());
    assert.equal(pillar.voidBranches, source[`get${name}XunKong`]());
  }
  assert.equal(result.chart.cycles.dayStem, local.getDayGan());
  assert.equal(result.chart.cycles.daYun.startSolar, physical.getYun(basic.gender === 'male' ? 1 : 0, 2).getStartSolar().toYmdHms());
  assert.equal(result.chart.cycles.solarTimeZone, 'UTC+08:00');
  assert.ok(buildManseView(result));
  return { physical, local };
}

check('mixed-clock pillars and all relative labels match actual pinned vendor code', () => {
  const result = read();
  const { physical, local } = directComparison(result);
  assert.notEqual(physical.getDayGan(), local.getDayGan());
  assert.equal(result.chart.solarDate, basic.birthDate); assert.equal(result.calculation.details.solarDate, basic.birthDate);
  assert.equal(result.chart.timeCorrection.engineDateTime, '2005-12-22 23:45:00');
  assert.equal(result.chart.timeCorrection.correctedDateTime, '2005-12-23 00:12:52');
  for (const city of KOREAN_BIRTHPLACES) for (const birthDate of ['1956-07-01', '1988-07-01', '2000-01-01']) {
    directComparison(read({ birthplaceId: city.id, birthDate }));
  }
});

check('LiChun and Jie boundaries use absolute instant, not shifted mean solar time', () => {
  const terms = sandbox.Solar.fromYmdHms(2000, 7, 1, 12, 0, 0).getLunar().getJieQiTable();
  for (const name of ['立春', '惊蛰']) {
    const term = terms[name].toYmdHms();
    // Ten minutes before the actual term, rounded down to the input minute.
    const termWall = Date.parse(term.replace(' ', 'T') + 'Z');
    const civil = stamp(Math.floor((termWall + 3600000 - 600000) / 60000) * 60000);
    const result = read({ birthDate: civil.slice(0, 10), birthTime: civil.slice(11, 16) });
    const { physical, local } = directComparison(result);
    assert.ok(result.chart.timeCorrection.engineDateTime < term);
    assert.ok(result.chart.timeCorrection.correctedDateTime > term);
    assert.notEqual(physical.getMonth(), local.getMonth());
    assert.equal(result.calculation.details.pillars.month, physical.getMonth());
    if (name === '立春') assert.notEqual(physical.getYear(), local.getYear());
  }
});

check('corrected late-Zi and midnight follow pinned sect2 day/hour rules without changing solar DOB', () => {
  for (const birthTime of ['00:00', '00:20', '00:45', '23:00', '23:40', '23:59']) {
    const result = read({ birthTime });
    directComparison(result);
    assert.equal(result.chart.solarDate, basic.birthDate);
    assert.equal(result.calculation.details.sect, 2);
  }
  const newYear = read({ birthDate: '2000-01-01', birthTime: '00:10' });
  directComparison(newYear);
  assert.equal(newYear.chart.solarDate, '2000-01-01');
  assert.equal(newYear.chart.timeCorrection.engineDateTime.slice(0, 10), '1999-12-31');
  assert.equal(newYear.chart.timeCorrection.correctedDateTime.slice(0, 10), '1999-12-31');
});

check('legacy no-correction, other methods and unknown time preserve their original calculations', () => {
  const old = calculateReading(basic, options), none = read({ timeCorrection: 'none' });
  const { timeCorrection, ...noneChart } = none.chart;
  assert.equal(timeCorrection.status, 'not-requested');
  assert.deepEqual({ ...none, chart: noneChart }, old);
  for (const mode of ['zodiac', 'ziwei']) {
    assert.deepEqual(calculateReading({ ...basic, mode }, options), read({ mode }));
  }
  const unknown = read({ birthTime: null });
  assert.equal(unknown.chart.timeCorrection.status, 'missing-time');
  assert.equal(unknown.chart.pillars.length, 3); assert.equal(unknown.calculation.details.pillars.time, null);
  assert.equal(unknown.chart.cycles.daYun.status, 'missing-input');
  for (const [birthDate, birthTime] of [['1900-01-01', '08:37'], ['1988-05-08', '02:30'], ['1988-10-09', '02:30']]) {
    assert.throws(() => read({ birthDate, birthTime }));
  }
});

check('cross-midnight correction preserves original DOB and storage allowlist excludes all location clocks', () => {
  const result = read({ birthTime: '00:10' });
  assert.equal(result.chart.timeCorrection.correctedDateTime.slice(0, 10), '2005-12-22');
  assert.equal(result.chart.solarDate, '2005-12-23'); assert.equal(result.calculation.details.solarDate, '2005-12-23');
  const config = { collectionEnabled: true, operatorName: 'synthetic', contactEmail: 'unit@example.test', retentionDays: 90,
    readingRecord: { enabled: true, consentVersion: 'reading-records-v1', purpose: 'synthetic test', minimumAge: 14 } };
  const record = prepareReadingRecord({ name: '합성 테스트', phone: '01012345678', topic: 'saju', ...result.chart.timeCorrection },
    config, result.calculation.details.solarDate, new Date('2026-10-23T00:00:00Z'));
  assert.equal(record.kind, 'ready'); assert.equal(record.payload.birthDate, '2005-12-23');
  assert.deepEqual(Object.keys(record.payload).sort(), ['birthDate', 'consentVersion', 'name', 'phone', 'recordConsent', 'source', 'topic'].sort());
  const prose = JSON.stringify([result.basis, result.sections, result.uncertainty, result.calculation.rules,
    result.chart.cycles.rules, result.chart.cycles.limitations]);
  for (const privateText of [result.chart.timeCorrection.city.name, String(result.chart.timeCorrection.city.longitude),
    result.chart.timeCorrection.originalDateTime, result.chart.timeCorrection.correctedDateTime, result.chart.timeCorrection.city.sourceUrl]) {
    assert.ok(!prose.includes(privateText));
  }
});

check('real lunar input conversion stays original while corrected clocks remain independently reproducible', () => {
  const lunar = sandbox.Solar.fromYmdHms(2000, 6, 15, 8, 37, 0).getLunar();
  const input = { birthDate: `${lunar.getYear()}-${String(Math.abs(lunar.getMonth())).padStart(2, '0')}-${String(lunar.getDay()).padStart(2, '0')}`,
    birthTime: '08:37', calendar: 'lunar', leapMonth: lunar.getMonth() < 0 };
  const a = read(input), b = read(input);
  assert.deepEqual(a, b); assert.equal(a.chart.solarDate, '2000-06-15'); directComparison(a);
  const before = JSON.stringify(input); read(input); assert.equal(JSON.stringify(input), before);
});

console.log(`\n${groups} birthplace/time groups passed; local synthetic/public fixtures only.`);
