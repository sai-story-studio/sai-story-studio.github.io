/**
 * Optional Korean local MEAN solar time. This is not apparent/true solar time:
 * the NOAA equation-of-time term is deliberately not applied.
 * Primary sources (snapshot: IANA tzdb 2026e, 2026-10-23):
 * https://data.iana.org/time-zones/tzdb/asia (Asia/Seoul and Rule ROK)
 * https://data.iana.org/time-zones/tzdb/tz-how-to.html (wall-time transitions)
 * https://data.iana.org/time-zones/tzdb/theory.html#accuracy
 * https://gml.noaa.gov/grad/solcalc/solareqns.PDF (east-positive longitude)
 * Coordinates are KMA observation-station points, NOT hospital/city centroids.
 * No network, storage, current-clock lookup, or platform timezone dependency.
 */

const KMA_DETAIL = 'https://data.kma.go.kr/tmeta/stn/selectStnDetail.do?isSelectStn=Y&pgmNo=82&stdStnNo=';
const KMA_PDF = 'https://nmsc.kma.go.kr/resources/common/pdf/NMSC-SCI-ATBD-INS_v1.0.pdf';
const CITIES = [
  ['seoul', '서울', '수도권', 37.57142, 126.9658, 108],
  ['incheon', '인천', '수도권', 37.47772, 126.6249, 112],
  ['suwon', '수원', '수도권', 37.25746, 126.983, 119],
  ['chuncheon', '춘천', '강원권', 37.90262, 127.7357, 101],
  ['gangneung', '강릉', '강원권', 37.75147, 128.89099, 105],
  ['daejeon', '대전', '충청권', 36.37199, 127.3721, 133],
  ['sejong', '세종', '충청권', 36.48522, 127.24438, 239],
  ['cheongju', '청주', '충청권', 36.63935, 127.44089, 131],
  ['seosan', '서산', '충청권', 36.776, 126.493, 129, KMA_PDF],
  ['gwangju', '광주', '전라권', 35.17294, 126.89156, 156],
  ['jeonju', '전주', '전라권', 35.84092, 127.11718, 146],
  ['mokpo', '목포', '전라권', 34.81732, 126.38151, 165],
  ['busan', '부산', '경상권', 35.10468, 129.03203, 159],
  ['daegu', '대구', '경상권', 35.87797, 128.65296, 143],
  ['ulsan', '울산', '경상권', 35.58237, 129.33469, 152],
  ['andong', '안동', '경상권', 36.57293, 128.70733, 136],
  ['changwon', '창원', '경상권', 35.17019, 128.57282, 155],
  ['jeju', '제주', '제주권', 33.514, 126.529, 184, KMA_PDF],
];
export const KOREAN_BIRTHPLACES = Object.freeze(CITIES.map(([id, name, region, latitude, longitude, stationId, sourceUrl]) =>
  Object.freeze({ id, name, region, latitude, longitude, stationId, sourceUrl: sourceUrl || `${KMA_DETAIL}${stationId}` })));

export function getKoreanBirthplace(id) {
  return typeof id === 'string' ? KOREAN_BIRTHPLACES.find((city) => city.id === id) || null : null;
}

const SOURCES = Object.freeze([
  Object.freeze({ id: 'iana-2026e', title: 'IANA tzdb 2026e · Asia/Seoul', url: 'https://data.iana.org/time-zones/tzdb/asia' }),
  Object.freeze({ id: 'noaa-mean-solar', title: 'NOAA 태양시 계산식 · 균시차 제외', url: 'https://gml.noaa.gov/grad/solcalc/solareqns.PDF' }),
]);
// UTC instants at which the new offset becomes effective. The 1908 initial
// LMT offset is used only to detect the first gap; pre-1908 births are refused.
const INITIAL_OFFSET = 30472;
const TRANSITIONS = [
  ['1908-03-31T15:32:08Z', 30600], ['1911-12-31T15:30:00Z', 32400],
  ['1948-05-31T15:00:00Z', 36000], ['1948-09-12T14:00:00Z', 32400],
  ['1949-04-02T15:00:00Z', 36000], ['1949-09-10T14:00:00Z', 32400],
  ['1950-03-31T15:00:00Z', 36000], ['1950-09-09T14:00:00Z', 32400],
  ['1951-05-05T15:00:00Z', 36000], ['1951-09-08T14:00:00Z', 32400],
  ['1954-03-20T15:00:00Z', 30600],
  ['1955-05-04T15:30:00Z', 34200], ['1955-09-08T14:30:00Z', 30600],
  ['1956-05-19T15:30:00Z', 34200], ['1956-09-29T14:30:00Z', 30600],
  ['1957-05-04T15:30:00Z', 34200], ['1957-09-21T14:30:00Z', 30600],
  ['1958-05-03T15:30:00Z', 34200], ['1958-09-20T14:30:00Z', 30600],
  ['1959-05-02T15:30:00Z', 34200], ['1959-09-19T14:30:00Z', 30600],
  ['1960-04-30T15:30:00Z', 34200], ['1960-09-17T14:30:00Z', 30600],
  ['1961-08-09T15:30:00Z', 32400],
  ['1987-05-09T17:00:00Z', 36000], ['1987-10-10T17:00:00Z', 32400],
  ['1988-05-07T17:00:00Z', 36000], ['1988-10-08T17:00:00Z', 32400],
].map(([instant, offset]) => [Date.parse(instant), offset]);
const OFFSETS = [30472, 30600, 32400, 34200, 36000];

function parseClock(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  if (year < 1900 || year > 9999 || hour > 23 || minute > 59 || second > 59) return null;
  const valueMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const date = new Date(valueMs);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return valueMs;
}
function clockFromMs(ms) { return new Date(ms).toISOString().slice(0, 19).replace('T', ' '); }
function instantFromMs(ms) { return new Date(ms).toISOString().slice(0, 19) + 'Z'; }
function offsetAt(ms) {
  let offset = INITIAL_OFFSET;
  for (const [instant, nextOffset] of TRANSITIONS) {
    if (instant > ms) break;
    offset = nextOffset;
  }
  return offset;
}
function standardOffsetAt(ms) {
  if (ms >= Date.parse('1961-08-09T15:30:00Z')) return 32400;
  if (ms >= Date.parse('1954-03-20T15:00:00Z')) return 30600;
  if (ms >= Date.parse('1911-12-31T15:30:00Z')) return 32400;
  return 30600;
}

/** Resolve a Seoul civil wall clock without Intl/OS historical timezone data. */
export function resolveSeoulCivilTime(dateTime) {
  const wallMs = parseClock(dateTime);
  const empty = (status) => ({ status, utcDateTime: null, offsetSeconds: null, candidates: [] });
  if (wallMs === null) return empty('invalid-input');
  if (dateTime < '1908-04-01 00:00:00') return empty('unsupported');
  const candidates = OFFSETS.flatMap((offsetSeconds) => {
    const utcMs = wallMs - offsetSeconds * 1000;
    return offsetAt(utcMs) === offsetSeconds ? [{ utcDateTime: instantFromMs(utcMs), offsetSeconds }] : [];
  }).sort((a, b) => a.utcDateTime.localeCompare(b.utcDateTime));
  if (!candidates.length) return empty('nonexistent');
  if (candidates.length > 1) return { ...empty('ambiguous'), candidates };
  return { status: 'valid', ...candidates[0], candidates };
}

/**
 * solarDate is the ORIGINAL converted solar birth date, never a corrected one.
 * Successful metadata is plain JSON; callers must not expose private city/
 * clocks in mail/report prose without the separate birth-data opt-in.
 */
export function resolveKoreanBirthTime({ solarDate, birthTime = null, birthplaceId = null, timeCorrection = 'none' } = {}) {
  const city = getKoreanBirthplace(birthplaceId);
  const metadata = {
    version: '1.0.0', method: timeCorrection, status: 'not-requested', applied: false,
    city: city ? { ...city } : null,
    originalDateTime: birthTime === null ? null : `${solarDate} ${birthTime}:00`,
    utcDateTime: null, engineDateTime: null, correctedDateTime: null,
    offsetSeconds: null, standardOffsetSeconds: null, dstSeconds: null,
    longitudeSeconds: null, correctionSeconds: null,
    sources: SOURCES.map((source) => ({ ...source })), notes: [],
  };
  const reject = (status, reason) => ({ ...metadata, status, reason });
  if (!['none', 'local-mean-solar'].includes(timeCorrection)) return reject('invalid-input', '시간 보정 방식을 확인해 주세요.');
  if (typeof solarDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(solarDate) || parseClock(`${solarDate} 12:00:00`) === null
      || (birthTime !== null && (typeof birthTime !== 'string' || !/^\d{2}:\d{2}$/.test(birthTime) || parseClock(metadata.originalDateTime) === null))) {
    return reject('invalid-input', '보정할 원래 날짜와 태어난 시각을 확인해 주세요.');
  }
  if (timeCorrection === 'none') {
    metadata.notes = ['시간 보정을 선택하지 않아 입력 날짜와 시각을 그대로 사용했습니다.'];
    return metadata;
  }
  if (!city) return reject('city-required', '지역평균태양시 보정에 사용할 지원 도시를 선택해 주세요.');
  if (birthTime === null) {
    metadata.status = 'missing-time';
    metadata.notes = ['생시를 몰라 시간 보정을 적용하지 않았으며 시주도 만들지 않았습니다.'];
    return metadata;
  }
  const resolved = resolveSeoulCivilTime(metadata.originalDateTime);
  const errors = {
    unsupported: '1908년 4월 1일 이전에는 이 보정 방식의 한국 표준시 이력을 지원하지 않습니다. 보정 안 함을 선택해 주세요.',
    ambiguous: '표준시 또는 서머타임 전환으로 두 번 존재하는 시각입니다. 어느 시각인지 확인할 수 없어 보정하지 않았습니다.',
    nonexistent: '표준시 또는 서머타임 전환으로 존재하지 않는 시각입니다. 원래 출생 기록을 확인해 주세요.',
    'invalid-input': '보정할 원래 날짜와 시각을 확인해 주세요.',
  };
  if (resolved.status !== 'valid') return reject(resolved.status, errors[resolved.status]);
  const utcMs = Date.parse(resolved.utcDateTime);
  const longitudeSeconds = Math.round(city.longitude * 240);
  const standardOffsetSeconds = standardOffsetAt(utcMs);
  return {
    ...metadata, status: 'applied', applied: true,
    utcDateTime: resolved.utcDateTime,
    engineDateTime: clockFromMs(utcMs + 28800 * 1000),
    correctedDateTime: clockFromMs(utcMs + longitudeSeconds * 1000),
    offsetSeconds: resolved.offsetSeconds, standardOffsetSeconds,
    dstSeconds: resolved.offsetSeconds - standardOffsetSeconds,
    longitudeSeconds, correctionSeconds: longitudeSeconds - resolved.offsetSeconds,
    sources: [...metadata.sources, { id: `kma-${city.stationId}`, title: '기상청 대표 관측소 좌표', url: city.sourceUrl }],
    notes: [
      'IANA tzdb 2026e의 한국 표준시·서머타임 이력을 적용하고 대표 관측소 경도로 지역평균태양시를 초 단위 반올림했습니다.',
      '병원 위치가 아닌 대표 지점 기준이며 균시차는 적용하지 않았습니다. 진태양시 보정이 아닙니다.',
      '과거 지역·기관의 실제 시계와 다를 수 있습니다. 연·월 절입과 대운은 절대시각, 일·시는 지역평균태양시로 구분합니다.',
    ],
  };
}
