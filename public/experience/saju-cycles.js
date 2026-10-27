/**
 * Plain natal-cycle data from lunar-javascript 1.7.7. No predictions, scores,
 * storage, requests or new personality weights are created by this module.
 * API: https://6tail.cn/calendar/lunar.bazi.html
 * getYun(..., 2) is the minute-based start-offset method; it is independent of
 * EightChar.setSect(2), which selects the natal late-Zi day-pillar convention.
 */
import { resolveSeoulCivilTime } from './birthplace-time.js';

const ENGINE = 'lunar-javascript';
const VERSION = '1.7.7 / cycles 1.0.0';
const ENGINE_TIME_ZONE = 'UTC+08:00';
const ELEMENT_NAMES = { 木: '목', 火: '화', 土: '토', 金: '금', 水: '수' };
const PILLAR = /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/;
const AGE_CONVENTION = 'startAge·endAge는 출생 양력 연도를 1로 센 엔진의 연도 기준 명목 나이이며 만 나이가 아닙니다.';
const RULES = [
  '대운 기산은 getYun(남 1·여 0, 2)의 분 단위 환산을 사용합니다. 일주 경계의 setSect(2)와 별개의 규칙입니다.',
  '양년 남성·음년 여성은 순행, 음년 남성·양년 여성은 역행하는 엔진 규칙입니다. 생시나 성별이 없으면 기운일·방향·대운을 추정하지 않습니다.',
  '대운 index 0은 기운 전 구간이므로 대운 간지 목록에 넣지 않습니다. 공식 getDaYun(n)으로 현재와 다음 두 주기를 덮도록 최소 10개·최대 20개 구간을 요청합니다.',
  '각 대운의 정확 구간은 원래 getStartSolar()에 (index−1)×10년을 더한 시작 시각부터 다음 10년 시작 직전까지입니다. 현재 대운을 연도 숫자만으로 선택하지 않습니다.',
  'startYear·endYear 및 startAge·endAge는 엔진의 명목 연도·나이 표기입니다. 정확한 교운 구간은 startSolar·endSolarExclusive를 사용합니다.',
  '세운은 기준 시각의 입춘으로 나눈 간지 연도부터 총 5개를 표시합니다. 생시·성별 없이도 실제 연간을 독립 계산하며, 대운의 getLiuNian() 값이 있으면 서로 대조합니다.',
  '오행·십성은 일간과 해당 간지의 실제 엔진 대응표를 읽은 상징 이름입니다. 기존 성향 연결표와 가중치에는 반영하지 않습니다.',
];
const LIMITATIONS = [
  '대운·세운은 전통 간지와 기간을 표시한 것으로 사건·성격·능력·건강·재산·미래의 결과를 보장하지 않습니다.',
  '기준 시각은 Asia/Seoul로 읽습니다. 출생 입력 및 엔진 절기·교운 시각은 원문의 벽시계 시각으로 비교하며 출생지·표준시·서머타임·진태양시를 추가 보정하지 않습니다. 실제 한국 절입 경계와 차이가 날 수 있습니다.',
  '대운 기산과 교운 방식은 유파마다 다릅니다. 엔진에 요청한 최대 20개 구간 밖의 시기는 새 대운을 추정하지 않으며, 명목 나이를 만 나이로 해석하지 않습니다.',
  '생시 미상의 일간은 기존 사주 계산과 같이 정오 기준입니다. 절입 당일에는 연주·월주 경계의 불확실성도 남습니다.',
];

function requireValue(condition) { if (!condition) throw new Error('계산 자료 누락 또는 불일치'); }
function integer(value) { return Number.isInteger(value); }
function stamp(solar) {
  const value = solar?.toYmdHms?.();
  requireValue(typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value));
  return value;
}
function validateWallParts(parts) {
  const [year, month, day, hour, minute, second] = parts;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  requireValue(year >= 1900 && year <= 2999 && month >= 1 && month <= 12 && day >= 1
    && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59
    && date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day);
}
function asOfSolar(value, Solar) {
  // A date-only or unzoned timestamp is an explicitly supplied Seoul wall time.
  if (typeof value === 'string') {
    const wall = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
    if (wall) {
      const parts = wall.slice(1).map((part) => part === undefined ? 0 : Number(part));
      validateWallParts(parts);
      return Solar.fromYmdHms(...parts);
    }
    const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
    requireValue(iso);
    validateWallParts(iso.slice(1, 7).map(Number));
  } else requireValue(Object.prototype.toString.call(value) === '[object Date]');
  const date = new Date(value);
  requireValue(Number.isFinite(date.getTime()));
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type) => Number(formatted.find((item) => item.type === type)?.value);
  const parts = ['year', 'month', 'day', 'hour', 'minute', 'second'].map(part);
  validateWallParts(parts);
  return Solar.fromYmdHms(...parts);
}
function utcEngineSolar(value, Solar) {
  const date = new Date(value);
  requireValue(Number.isFinite(date.getTime()));
  date.setUTCHours(date.getUTCHours() + 8);
  const parts = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()];
  validateWallParts(parts);
  return Solar.fromYmdHms(...parts);
}
function correctedAsOfSolar(value, Solar) {
  if (typeof value === 'string') {
    const wall = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
    if (wall) {
      const parts = wall.slice(1).map((part) => part === undefined ? 0 : Number(part));
      validateWallParts(parts);
      const resolved = resolveSeoulCivilTime(stamp(Solar.fromYmdHms(...parts)));
      requireValue(resolved?.status === 'valid' && typeof resolved.utcDateTime === 'string');
      return utcEngineSolar(resolved.utcDateTime, Solar);
    }
    const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
    requireValue(iso);
    validateWallParts(iso.slice(1, 7).map(Number));
  } else requireValue(Object.prototype.toString.call(value) === '[object Date]');
  return utcEngineSolar(value, Solar);
}
function correctedTimeBasis(timeCorrection, solar, correctedBazi, Solar) {
  const utcParts = typeof timeCorrection.utcDateTime === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(timeCorrection.utcDateTime) : null;
  requireValue(timeCorrection.method === 'local-mean-solar'
    && utcParts && integer(timeCorrection.offsetSeconds));
  validateWallParts(utcParts.slice(1).map(Number));
  for (const value of [timeCorrection.originalDateTime, timeCorrection.engineDateTime, timeCorrection.correctedDateTime]) {
    requireValue(typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value));
    validateWallParts(value.match(/\d+/g).map(Number));
  }
  requireValue(stamp(solar) === timeCorrection.engineDateTime
    && stamp(utcEngineSolar(timeCorrection.utcDateTime, Solar)) === timeCorrection.engineDateTime
    && typeof correctedBazi?.getDayGan === 'function'
    && stamp(correctedBazi?.getLunar?.()?.getSolar?.()) === timeCorrection.correctedDateTime);
  const originalUtc = Date.parse(`${timeCorrection.originalDateTime.replace(' ', 'T')}Z`) - timeCorrection.offsetSeconds * 1000;
  requireValue(originalUtc === Date.parse(timeCorrection.utcDateTime));
  return { timeZone: ENGINE_TIME_ZONE, asOfTimeZone: ENGINE_TIME_ZONE,
    civilBirthDateTime: timeCorrection.originalDateTime, utcBirthDateTime: timeCorrection.utcDateTime,
    engineBirthDateTime: timeCorrection.engineDateTime, correctedBirthDateTime: timeCorrection.correctedDateTime };
}
function symbolData(ganZhi, dayStem, util) {
  requireValue(typeof ganZhi === 'string' && PILLAR.test(ganZhi) && util.JIA_ZI.includes(ganZhi));
  const [stem, branch] = [...ganZhi];
  const elements = [ELEMENT_NAMES[util.WU_XING_GAN?.[stem]], ELEMENT_NAMES[util.WU_XING_ZHI?.[branch]]];
  const hiddenStems = util.ZHI_HIDE_GAN?.[branch];
  const stemTenGod = util.SHI_SHEN?.[dayStem + stem];
  requireValue(elements.every(Boolean) && Array.isArray(hiddenStems) && hiddenStems.length > 0 && typeof stemTenGod === 'string');
  const branchTenGods = Array.from(hiddenStems, (hidden) => util.SHI_SHEN?.[dayStem + hidden]);
  requireValue(branchTenGods.every((god) => typeof god === 'string' && god.length > 0));
  return { ganZhi, stem, branch, elements, hiddenStems: Array.from(hiddenStems), stemTenGod, branchTenGods };
}
function unavailableDaYun(status, reason) {
  return { status, reason, direction: null, startSolar: null, startOffset: null, ageConvention: AGE_CONVENTION,
    rangeStatus: 'unavailable', current: null, next: null, list: [] };
}
function daYunData({ bazi, birthTimeKnown, gender, dayStem, asOf, util }) {
  if (birthTimeKnown !== true || !['male', 'female'].includes(gender)) return {
    data: unavailableDaYun('missing-input', '대운 기산에는 태어난 시각과 전통 계산용 성별이 모두 필요합니다. 모르는 값으로 시작일·방향·대운을 만들지 않았습니다.'), annualByYear: new Map(),
  };
  try {
    const yun = bazi.getYun(gender === 'male' ? 1 : 0, 2);
    const origin = yun.getStartSolar();
    const startSolar = stamp(origin);
    const forward = yun.isForward();
    requireValue(typeof forward === 'boolean');
    const startOffset = { years: yun.getStartYear(), months: yun.getStartMonth(), days: yun.getStartDay(), hours: yun.getStartHour() };
    requireValue(Object.values(startOffset).every((value) => integer(value) && value >= 0));
    const count = Math.min(20, Math.max(10, Math.floor((Number(asOf.slice(0, 4)) - origin.getYear()) / 10) + 4));
    const raw = yun.getDaYun(count);
    requireValue(Array.isArray(raw) && raw.length === count && raw[0].getIndex() === 0 && raw[0].getGanZhi() === '');
    const annualByYear = new Map();
    const list = Array.from(raw).filter((item) => item.getIndex() > 0).map((item) => {
      const index = item.getIndex();
      requireValue(integer(index) && index >= 1 && index < count);
      const start = stamp(origin.nextYear((index - 1) * 10));
      const end = stamp(origin.nextYear(index * 10));
      const data = { index, ...symbolData(item.getGanZhi(), dayStem, util), startSolar: start, endSolarExclusive: end,
        startYear: item.getStartYear(), endYear: item.getEndYear(), startAge: item.getStartAge(), endAge: item.getEndAge() };
      requireValue(start < end && [data.startYear, data.endYear, data.startAge, data.endAge].every(integer)
        && data.endYear === data.startYear + 9 && data.endAge === data.startAge + 9 && Number(start.slice(0, 4)) === data.startYear);
      return data;
    });
    requireValue(list.length === count - 1 && list.every((item, index) => item.index === index + 1));
    for (const item of raw) {
      const years = item.getLiuNian();
      requireValue(Array.isArray(years));
      for (const year of years) {
        const value = { year: year.getYear(), ganZhi: year.getGanZhi() };
        requireValue(integer(value.year) && PILLAR.test(value.ganZhi));
        if (annualByYear.has(value.year)) requireValue(annualByYear.get(value.year).ganZhi === value.ganZhi);
        annualByYear.set(value.year, value);
      }
    }
    const current = list.find((item) => item.startSolar <= asOf && asOf < item.endSolarExclusive) || null;
    const next = list.find((item) => item.startSolar > asOf) || null;
    const rangeStatus = asOf < list[0].startSolar ? 'before-first' : asOf >= list.at(-1).endSolarExclusive ? 'after-list' : 'within-list';
    return { data: { status: 'available', reason: rangeStatus === 'after-list' ? '기준 시각은 엔진에 요청한 최대 대운 목록 이후입니다. 목록 밖의 현재·다음 대운을 추정하지 않았습니다.'
      : rangeStatus === 'before-first' ? '첫 대운 시작 전입니다. 현재 대운을 채우지 않고 실제 첫 대운을 다음 대운으로 표시합니다.' : null,
      direction: forward ? 'forward' : 'backward', startSolar, startOffset, ageConvention: AGE_CONVENTION, rangeStatus, current, next, list }, annualByYear };
  } catch {
    return { data: unavailableDaYun('unavailable', '대운의 시작·간지·기간 계산 자료를 확인하지 못했습니다. 일부 자료로 대운을 추정하지 않았습니다.'), annualByYear: new Map() };
  }
}
function liChun(year, Solar) {
  const lunar = Solar.fromYmdHms(year, 7, 1, 12, 0, 0).getLunar();
  const label = globalThis.I18n?.getMessage?.('jq.liChun') || '立春';
  const term = lunar.getJieQiTable()[label];
  requireValue(term?.getYear?.() === year);
  stamp(term);
  return term;
}
function liuNianData({ current, asOf, dayStem, util, Solar, annualByYear }) {
  try {
    const year = current.getYear();
    const currentYear = asOf < stamp(liChun(year, Solar)) ? year - 1 : year;
    const currentGanZhi = current.getLunar().getYearInGanZhiExact();
    const years = Array.from({ length: 5 }, (_, offset) => {
      const target = currentYear + offset;
      const start = liChun(target, Solar), end = liChun(target + 1, Solar);
      const independent = Solar.fromYmdHms(target, 7, 1, 12, 0, 0).getLunar().getYearInGanZhiExact();
      const vendor = annualByYear.get(target);
      if (vendor) requireValue(vendor.ganZhi === independent);
      if (offset === 0) requireValue(independent === currentGanZhi);
      return { year: target, ...symbolData(vendor?.ganZhi || independent, dayStem, util),
        startSolar: stamp(start), endSolarExclusive: stamp(end), isCurrent: offset === 0,
        source: vendor ? 'getLiuNian' : 'getYearInGanZhiExact' };
    });
    return { status: 'available', reason: null, yearBoundary: 'lichun', currentYear, years };
  } catch {
    return { status: 'unavailable', reason: '입춘 경계와 연간 계산 자료를 확인하지 못해 세운 표를 추정하지 않았습니다.', yearBoundary: 'lichun', currentYear: null, years: [] };
  }
}

/**
 * `asOf` accepts Date/offset ISO timestamps, or explicit Seoul wall-time
 * YYYY-MM-DD[ HH:mm[:ss]]. Date-only means 00:00:00, not an inferred birth time.
 * With applied local-mean-solar correction, solar/bazi must be the absolute
 * UTC+08 birth used for Jie/Yun. correctedBazi supplies the LMT day stem only.
 * All cycle timestamps and reference comparisons then use fixed UTC+08.
 * Missing vendor/input data returns a status and empty data, never fake cycles.
 */
export function calculateSajuCycles({ solar, bazi, correctedBazi, timeCorrection, birthTimeKnown, gender }, { asOf = new Date(), Solar = globalThis.Solar, LunarUtil = globalThis.LunarUtil } = {}) {
  const unavailableAnnual = { status: 'unavailable', reason: '세운 계산 자료를 확인하지 못했습니다.', yearBoundary: 'lichun', currentYear: null, years: [] };
  const base = { engine: ENGINE, version: VERSION, asOf: null, dayStem: null, rules: [...RULES], limitations: [...LIMITATIONS],
    daYun: unavailableDaYun('unavailable', '대운 계산 자료를 확인하지 못했습니다.'), liuNian: unavailableAnnual };
  const corrected = timeCorrection?.applied === true;
  if (corrected) {
    base.solarTimeZone = ENGINE_TIME_ZONE;
    base.daYun.startSolarTimeZone = ENGINE_TIME_ZONE;
    base.daYun.ageConvention += ' 보정 모드의 출생 연도는 UTC+08:00 엔진 시각의 양력 연도입니다.';
    base.rules.push('보정 모드: 연주·월주·절기·대운 기산은 실제 출생 순간을 UTC+08:00으로 옮긴 엔진 시각을 사용하고, 대운·세운의 십성은 지방평균태양시의 일간을 기준으로 읽습니다.');
    base.limitations[1] = '보정 모드의 기준 입력은 Asia/Seoul의 역사적 표준시·서머타임으로 해석하며, 절기·교운의 startSolar·endSolarExclusive와 asOf는 모두 UTC+08:00입니다. 지방평균태양시와 원래 출생 벽시계는 별도 표시하며 균시차에 따른 진태양시 보정은 하지 않습니다.';
  }
  try {
    requireValue(typeof Solar?.fromYmdHms === 'function' && typeof bazi?.getDayGan === 'function' && solar?.getYear);
    if (corrected) base.timeBasis = correctedTimeBasis(timeCorrection, solar, correctedBazi, Solar);
    const current = corrected ? correctedAsOfSolar(asOf, Solar) : asOfSolar(asOf, Solar);
    base.asOf = stamp(current);
    requireValue(typeof bazi.getLunar === 'function' && stamp(bazi.getLunar().getSolar()) === stamp(solar));
    const dayStem = (corrected ? correctedBazi : bazi).getDayGan();
    requireValue(typeof dayStem === 'string' && /^[甲乙丙丁戊己庚辛壬癸]$/.test(dayStem));
    base.dayStem = dayStem;
    requireValue(Array.isArray(LunarUtil?.JIA_ZI) && LunarUtil.SHI_SHEN && LunarUtil.ZHI_HIDE_GAN && LunarUtil.WU_XING_GAN && LunarUtil.WU_XING_ZHI);
    const daYun = daYunData({ bazi, birthTimeKnown, gender, dayStem, asOf: base.asOf, util: LunarUtil });
    base.daYun = daYun.data;
    if (corrected) {
      base.daYun.startSolarTimeZone = ENGINE_TIME_ZONE;
      base.daYun.ageConvention += ' 보정 모드의 출생 연도는 UTC+08:00 엔진 시각의 양력 연도입니다.';
    }
    base.liuNian = liuNianData({ current, asOf: base.asOf, dayStem, util: LunarUtil, Solar, annualByYear: daYun.annualByYear });
  } catch {
    base.limitations.push('기준 시각 또는 엔진 자료가 유효하지 않아 주기 정보를 만들지 않았습니다.');
  }
  return base;
}
