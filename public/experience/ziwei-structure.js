/**
 * Read-only natal-chart view model for the pinned iztro 2.6.2 plain data.
 * Official: https://iztro.com/type-definition
 * https://iztro.com/posts/astrolabe · https://iztro.com/posts/config-n-plugin
 * https://iztro.com/learn/mutagen (default ten-stem table, not palace flying transforms)
 * Age convention source: v2.6.2 src/astro/FunctionalAstrolabe.ts lines 38-68:
 * https://raw.githubusercontent.com/SylarLong/iztro/v2.6.2/src/astro/FunctionalAstrolabe.ts
 * Only pinned Solar/Lunar calendar conversion is used for nominal age. No
 * horoscope/transit calls, clock, network, storage or personality scoring.
 */
const NAMES = ['명궁', '부모', '복덕', '전택', '관록', '노복', '천이', '질액', '재백', '자녀', '부처', '형제'];
const MAJORS = ['자미', '천기', '태양', '무곡', '천동', '염정', '천부', '태음', '탐랑', '거문', '천상', '천량', '칠살', '파군'];
const STEMS = [...'甲乙丙丁戊己庚辛壬癸'];
const STEM_KO = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const BRANCHES = [...'寅卯辰巳午未申酉戌亥子丑'];
const BRANCH_KO = ['인', '묘', '진', '사', '오', '미', '신', '유', '술', '해', '자', '축'];
const BRIGHTNESS = ['', '[+3]', '[+2]', '[+1]', '[0]', '[-1]', '[-2]', '[-3]'];
const MUTAGEN_KEYS = ['록', '권', '과', '기'];
const STAR_TYPES = ['major', 'soft', 'tough', 'adjective', 'flower', 'helper', 'lucun', 'tianma'];
// Independent transcription of the author's declared default edition.
const MUTAGEN_TABLE = [
  ['염정', '파군', '무곡', '태양'], ['천기', '천량', '자미', '태음'],
  ['천동', '천기', '문창', '염정'], ['태음', '천동', '천기', '거문'],
  ['탐랑', '태음', '우필', '천기'], ['무곡', '탐랑', '천량', '문곡'],
  ['태양', '무곡', '태음', '천동'], ['거문', '태양', '문곡', '문창'],
  ['천량', '자미', '좌보', '무곡'], ['파군', '거문', '태음', '탐랑'],
];
const copy = (value) => JSON.parse(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const stemIndex = (value) => STEMS.includes(value) ? STEMS.indexOf(value) : STEM_KO.indexOf(value);
const branchIndex = (value) => BRANCHES.includes(value) ? BRANCHES.indexOf(value) : BRANCH_KO.indexOf(value);
const safeName = (value) => typeof value === 'string' && /^[가-힣一-鿿()·\s]+$/u.test(value) && value.length <= 40;
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number), date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900 && date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}
function coreStar(star) {
  return star && MAJORS.includes(star.name) && BRIGHTNESS.includes(star.brightness ?? '')
    && MUTAGEN_KEYS.includes(star.mutagen || '') === Boolean(star.mutagen);
}
/**
 * null: malformed or contradictory core 12-palace / 14-major-star source.
 * Optional source gaps/conflicts instead produce scoped issues and restricted
 * facts, never fabricated stars, borrowed natal placements or selected ages.
 */
export function buildZiweiStructure(result, options = {}) {
  const chart = result?.chart;
  if (result?.mode !== 'ziwei' || chart?.kind !== 'ziwei' || !Array.isArray(chart.palaces) || chart.palaces.length !== 12) return null;
  const raw = Array.from(chart.palaces);
  if (raw.some((p) => !p || !Number.isInteger(p.index) || p.index < 0 || p.index > 11 || !NAMES.includes(p.name)
    || stemIndex(p.heavenlyStem) < 0 || stemIndex(p.heavenlyStem) % 2 !== p.index % 2
    || branchIndex(p.earthlyBranch) !== p.index || !Array.isArray(p.majorStars)
    || Array.from(p.majorStars).some((star) => !coreStar(star)))
    || new Set(raw.map((p) => p.index)).size !== 12 || new Set(raw.map((p) => p.name)).size !== 12) return null;
  const allMajorNames = raw.flatMap((p) => p.majorStars.map((star) => star.name));
  if (allMajorNames.length !== 14 || new Set(allMajorNames).size !== 14) return null;
  const soul = raw.find((p) => p.name === '명궁');
  if (!chart.soulPalace || chart.soulPalace.index !== soul.index || chart.soulPalace.name !== soul.name
    || chart.soulPalace.heavenlyStem !== soul.heavenlyStem || chart.soulPalace.earthlyBranch !== soul.earthlyBranch
    || !same(chart.soulPalace.majorStars, soul.majorStars)) return null;
  const details = result.calculation?.details;
  const mapped = soul.majorStars.length ? soul : raw.find((p) => p.index === (soul.index + 6) % 12);
  if (details && (details.soulPalaceName !== soul.name || !same(details.originalMajorStars, soul.majorStars.map((s) => s.name))
    || details.mappingSource !== (soul.majorStars.length ? 'soulPalace' : 'oppositePalace')
    || !same(details.majorStars, mapped.majorStars.map((s) => s.name)))) return null;
  const issues = []; let hasConflict = false;
  function issue(code, scope, message, conflict = false) {
    issues.push({ code, scope, message }); if (conflict) hasConflict = true;
  }
  const requested = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
  const referenceDateSource = requested.asOf != null ? 'options' : chart.referenceDate != null ? 'chart' : null;
  const requestedReferenceDate = requested.asOf ?? chart.referenceDate;
  const normalized = {
    mode: ['QUICK', 'STANDARD', 'DEEP'].includes(requested.mode) ? requested.mode : 'STANDARD',
    currentAge: requested.currentAge == null ? null : Number.isInteger(requested.currentAge) && requested.currentAge >= 1 && requested.currentAge <= 150 ? requested.currentAge : null,
    boundary: ['unknown', 'yes', 'no'].includes(requested.boundary) ? requested.boundary : 'unknown',
    asOf: validDate(requestedReferenceDate) ? requestedReferenceDate : null,
    focus: ['all', 'career', 'money', 'relationship', 'wellbeing'].includes(requested.focus) ? requested.focus : 'all',
  };
  const invalidAge = requested.currentAge != null && normalized.currentAge === null;
  if (invalidAge) issue('INVALID_AGE', 'decadals', '이전 호환용 나이 입력이 정수 1~150 형식과 맞지 않습니다. 자동 계산값을 이 입력에 맞춰 바꾸지 않았습니다.', true);
  if (requestedReferenceDate != null && normalized.asOf === null) issue('INVALID_AS_OF', 'options', '해석 기준일이 실제 양력 날짜 형식과 맞지 않아 나이와 대운을 자동 선택하지 않았습니다.');
  function stars(p, field) {
    if (!Array.isArray(p[field])) { issue('STARS_MISSING', 'palace-' + p.index, p.name + '의 보조성 자료 일부가 없어 그 자료를 해석하지 않습니다.'); return []; }
    const valid = [];
    for (const s of p[field]) {
      if (!s || !safeName(s.name) || !STAR_TYPES.includes(s.type) || !BRIGHTNESS.includes(s.brightness ?? '') || (s.mutagen && !MUTAGEN_KEYS.includes(s.mutagen))) {
        issue('STAR_METADATA_CONFLICT', 'palace-' + p.index, p.name + '의 보조성 표기 일부가 규격과 달라 제외했습니다.', true); continue;
      }
      valid.push({ name: s.name, type: s.type, brightness: s.brightness || '', mutagen: s.mutagen || '' });
    }
    return valid;
  }
  const palaces = raw.map((p) => ({
    index: p.index, name: p.name, heavenlyStem: p.heavenlyStem, earthlyBranch: p.earthlyBranch,
    isBodyPalace: typeof p.isBodyPalace === 'boolean' ? p.isBodyPalace : null,
    majorStars: p.majorStars.map((s) => ({ name: s.name, brightness: s.brightness || '', mutagen: s.mutagen || '' })),
    minorStars: stars(p, 'minorStars'), adjectiveStars: stars(p, 'adjectiveStars'),
    decadal: null,
  }));
  const find = (index) => palaces.find((p) => p.index === index);
  const anchors = { soulIndex: soul.index, bodyIndex: null, spiritIndex: palaces.find((p) => p.name === '복덕').index };
  if (chart.soulPalaceBranch == null) issue('SOUL_BRANCH_MISSING', 'anchors', '명궁 지지의 별도 확인 자료가 없습니다.');
  else if (branchIndex(chart.soulPalaceBranch) !== soul.index) issue('SOUL_BRANCH_CONFLICT', 'anchors', '명궁 지지 요약과 12궁 위치가 충돌합니다.', true);
  const bodies = palaces.filter((p) => p.isBodyPalace === true);
  if (bodies.length === 1) {
    if (chart.bodyPalaceBranch == null) { anchors.bodyIndex = bodies[0].index; issue('BODY_BRANCH_MISSING', 'anchors', '신궁 표시는 있으나 별도 지지 자료가 없어 교차 확인은 제한됩니다.'); }
    else if (branchIndex(chart.bodyPalaceBranch) === bodies[0].index) anchors.bodyIndex = bodies[0].index;
    else issue('BODY_BRANCH_CONFLICT', 'anchors', '신궁 표시와 신궁 지지 요약이 충돌하여 신궁 해석을 생략합니다.', true);
  } else issue(bodies.length ? 'BODY_PALACE_CONFLICT' : 'BODY_PALACE_MISSING', 'anchors', '신궁을 유일하게 확인할 수 없어 신궁 해석을 생략합니다.', bodies.length > 1);
  const majorStars = palaces.flatMap((p) => p.majorStars.map((s) => ({ ...s, palaceIndex: p.index, palaceName: p.name })));
  const triads = [];
  if (!Array.isArray(chart.triadRefs) || chart.triadRefs.length !== 12) issue('TRIADS_MISSING', 'triads', '12궁 삼방사정 참조 자료가 없어 삼방사정 해석을 생략합니다.');
  else {
    const targets = new Set();
    for (const ref of chart.triadRefs) {
      const i = ref?.targetIndex;
      if (!Number.isInteger(i) || !find(i) || targets.has(i) || ref.oppositeIndex !== (i + 6) % 12
        || ref.wealthIndex !== (i + 8) % 12 || ref.careerIndex !== (i + 4) % 12) {
        issue('TRIAD_CONFLICT', 'triads', '삼방사정 참조 위치가 12궁 관계와 충돌하여 해당 근거를 사용하지 않습니다.', true); continue;
      }
      targets.add(i); triads.push({ targetIndex: i, oppositeIndex: ref.oppositeIndex, wealthIndex: ref.wealthIndex, careerIndex: ref.careerIndex });
    }
  }
  const canonical = chart.birthYearMutagens;
  const yearIndex = stemIndex(chart.birthYearStem);
  const mutagens = { status: 'missing', yearStem: yearIndex < 0 ? null : STEMS[yearIndex], source: '', items: [], conflicts: [] };
  if (!canonical || yearIndex < 0) issue('BIRTH_MUTAGENS_MISSING', 'mutagens', '생년사화 정본이나 생년 천간이 없어 생년사화 해석을 생략합니다.');
  else {
    const conflicts = [];
    const canonicalValid = !(stemIndex(canonical.yearStem) !== yearIndex || canonical.source !== 'iztro 2.6.2 기본 생년사화표 · 록·권·과·기 순서'
      || !Array.isArray(canonical.items) || canonical.items.length !== 4
      || MUTAGEN_KEYS.some((key, i) => canonical.items[i]?.key !== key || canonical.items[i]?.star !== MUTAGEN_TABLE[yearIndex][i]));
    if (!canonicalValid) conflicts.push('생년 천간과 정본의 록·권·과·기 순서 또는 별 이름이 일치하지 않습니다.');
    const tags = palaces.flatMap((p) => [...p.majorStars, ...p.minorStars].filter((s) => s.mutagen).map((s) => ({ ...s, palaceIndex: p.index, palaceName: p.name })));
    const expected = MUTAGEN_TABLE[yearIndex];
    mutagens.items = MUTAGEN_KEYS.map((key, i) => {
      const locations = palaces.flatMap((p) => [...p.majorStars, ...p.minorStars].filter((s) => s.name === expected[i]).map((s) => ({ ...s, palaceIndex: p.index, palaceName: p.name })));
      const matchingTags = tags.filter((s) => s.mutagen === key);
      const verified = canonicalValid && locations.length === 1 && matchingTags.length === 1 && matchingTags[0].name === expected[i] && matchingTags[0].palaceIndex === locations[0].palaceIndex;
      if (!verified) conflicts.push('화' + key + '의 정본 별과 궁 내부 표기가 일치하지 않습니다.');
      return { key, label: '화' + key, star: expected[i], palaceIndex: locations.length === 1 ? locations[0].palaceIndex : null,
        palaceName: locations.length === 1 ? locations[0].palaceName : null, verified };
    });
    if (tags.length !== 4) conflicts.push('궁 내부 생년사화 표기가 네 개로 확인되지 않습니다.');
    mutagens.source = canonicalValid ? canonical.source : '';
    mutagens.conflicts = [...new Set(conflicts)]; mutagens.status = conflicts.length ? 'conflict' : 'verified';
    if (conflicts.length) issue('BIRTH_MUTAGENS_CONFLICT', 'mutagens', '생년사화 정본과 궁 내부 표기가 충돌하여 생년사화 해석을 생략합니다.', true);
  }
  const table = []; let decadeMissing = false, decadeConflict = false;
  for (const p of raw) {
    const d = p.decadal;
    if (d == null) { decadeMissing = true; continue; }
    if (!Array.isArray(d.range) || d.range.length !== 2 || !d.range.every(Number.isInteger) || d.range[0] < 1 || d.range[1] !== d.range[0] + 9
      || stemIndex(d.heavenlyStem) !== stemIndex(p.heavenlyStem) || branchIndex(d.earthlyBranch) !== p.index) { decadeConflict = true; continue; }
    const row = { palaceIndex: p.index, palaceName: p.name, range: [...d.range], heavenlyStem: d.heavenlyStem, earthlyBranch: d.earthlyBranch };
    table.push(row); find(p.index).decadal = { range: [...d.range], heavenlyStem: d.heavenlyStem, earthlyBranch: d.earthlyBranch };
  }
  table.sort((a, b) => a.range[0] - b.range[0]);
  if (table.some((row, i) => i && (row.range[0] <= table[i - 1].range[1]
    || (!decadeMissing && row.range[0] !== table[i - 1].range[1] + 1)))
    || (!decadeMissing && table.length && (table[0].range[0] < 2 || table[0].range[0] > 6))) decadeConflict = true;
  const decadals = { status: decadeConflict ? 'conflict' : decadeMissing ? 'missing' : 'reference-required', ageConvention: 'nominal', table,
    current: null, next: null, boundary: { requested: normalized.boundary, isBoundary: null, candidates: [] },
    inputAge: normalized.currentAge, ageConflict: null, ageSource: 'unavailable', calculatedAge: null,
    referenceDate: normalized.asOf, referenceDateSource: normalized.asOf ? referenceDateSource : null,
    referenceLunarYear: null, birthLunarYear: null, currentStartDate: null, nextTransitionDate: null,
    ageBasis: 'iztro 2.6.2 ageDivide normal: 기준일 음력 연도 − 출생일 음력 연도 + 1. 음력 설에 나이가 바뀌며 만 나이나 양력 연도 차이가 아닙니다.',
    notes: ['입력한 출생일과 해석 기준일을 실제 음력으로 변환해 명반과 같은 세는나이인 허세를 자동 계산합니다. 기준일이 미래라면 그 기준일의 나이·대운이며 오늘의 실제 상태나 사건 예언이 아닙니다.'] };
  if (decadeConflict) issue('DECADAL_CONFLICT', 'decadals', '대운 연령 범위나 궁위 간지가 충돌하여 기준일 대운을 특정하지 않습니다.', true);
  else if (decadeMissing) issue('DECADAL_MISSING', 'decadals', '대운표 자료 일부가 없어 기준일 대운을 특정하지 않습니다.');
  function ageUnavailable(status, code, message, conflict = false) {
    decadals.status = status;
    decadals.notes.push(message);
    if (conflict) decadals.ageConflict = true;
    issue(code, 'decadals', message, conflict);
  }
  if (!normalized.asOf) {
    ageUnavailable('reference-required', 'REFERENCE_DATE_MISSING', '유효한 해석 기준일이 없어 세는나이와 현재·다음 대운을 계산하지 않습니다. 기준일을 선택하거나 명반을 다시 계산해 주세요.');
  } else if (!validDate(chart.solarDate) || !Number.isInteger(chart.birthLunarYear)) {
    ageUnavailable('age-source-missing', 'AGE_SOURCE_MISSING', '출생 양력 날짜 또는 명반의 출생 음력 연도가 없어 나이를 자동 계산하지 않습니다.');
  } else if (details?.solarDate && details.solarDate !== chart.solarDate) {
    ageUnavailable('age-conflict', 'BIRTH_DATE_CONFLICT', '출생일 요약과 명반의 출생일이 충돌하여 나이와 대운을 자동 선택하지 않습니다.', true);
  } else if (normalized.asOf < chart.solarDate) {
    ageUnavailable('reference-before-birth', 'AGE_REFERENCE_CONFLICT', '해석 기준일이 출생일보다 앞서므로 나이와 대운을 계산하지 않습니다.', true);
  } else if (!details?.config || details.config.ageDivide !== 'normal' || details.config.yearDivide !== 'normal') {
    ageUnavailable('unsupported-age-convention', 'AGE_CONVENTION_UNSUPPORTED', '명반의 음력 설 기준 normal 설정을 확인할 수 없어 다른 나이 규칙을 임의로 적용하지 않습니다.');
  } else if (typeof globalThis.Solar?.fromYmd !== 'function') {
    ageUnavailable('calendar-unavailable', 'AGE_CALENDAR_UNAVAILABLE', '정확한 음력 변환 파일을 사용할 수 없어 양력 연도 차이로 나이를 대신 계산하지 않습니다.');
  } else {
    try {
      // This mirrors iztro's solar2lunar($.solarDate), not the late-Zi
      // next-day star placement: age uses the original civil birth date.
      const toLunar = date => globalThis.Solar.fromYmd(...date.split('-').map(Number)).getLunar();
      const birth = toLunar(chart.solarDate), reference = toLunar(normalized.asOf);
      const birthYear = birth.getYear(), referenceYear = reference.getYear();
      if (!Number.isInteger(birthYear) || !Number.isInteger(referenceYear)) throw new Error('Missing lunar year');
      decadals.birthLunarYear = birthYear;
      decadals.referenceLunarYear = referenceYear;
      if (birthYear !== chart.birthLunarYear) {
        ageUnavailable('age-conflict', 'BIRTH_LUNAR_YEAR_CONFLICT', '출생일을 실제 변환한 음력 연도와 명반의 출생 음력 연도가 충돌합니다. 늦은 자시를 이유로 나이용 출생 연도를 바꾸지 않았습니다.', true);
      } else {
        const age = referenceYear - birthYear + 1;
        if (!Number.isSafeInteger(age) || age < 1) throw new Error('Invalid nominal age');
        decadals.ageSource = 'calculated'; decadals.calculatedAge = age; decadals.ageConflict = false;
        decadals.notes.push('나이용 출생 연도는 원래 양력 출생일의 음력 연도입니다. 늦은 자시의 다음날 주성 배치와 별개로 계산합니다.');
        if (invalidAge) decadals.status = 'invalid-age';
        else if (normalized.currentAge !== null && normalized.currentAge !== age) {
          ageUnavailable('age-conflict', 'AGE_REFERENCE_CONFLICT', '이전 호환용 수동 나이와 실제 음력 기준 자동 계산값이 다릅니다. 어느 값도 자동 보정하지 않고 대운 선택을 중단했습니다.', true);
        } else if (!decadeConflict && !decadeMissing) {
          const index = table.findIndex(row => age >= row.range[0] && age <= row.range[1]);
          if (index < 0) {
            decadals.status = 'out-of-range';
            decadals.notes.push('기준일 세는나이가 실제 대운표 범위 밖입니다. 대운 시작 전 구간이나 목록 밖의 대운을 만들어내지 않습니다.');
          } else {
            decadals.status = 'available'; decadals.current = table[index]; decadals.next = table[index + 1] || null;
            const atStart = age === table[index].range[0], atEnd = age === table[index].range[1];
            decadals.boundary.isBoundary = atStart || atEnd || normalized.boundary === 'yes';
            if (typeof globalThis.Lunar?.fromYmd === 'function') {
              try {
                const startOfRange = row => {
                  if (!row) return null;
                  const year = birthYear + row.range[0] - 1;
                  const date = globalThis.Lunar.fromYmd(year, 1, 1).getSolar().toYmd();
                  const check = validDate(date) ? toLunar(date) : null;
                  return check?.getYear() === year && check.getMonth() === 1 && check.getDay() === 1 ? date : null;
                };
                decadals.currentStartDate = startOfRange(decadals.current);
                decadals.nextTransitionDate = startOfRange(decadals.next);
              } catch { /* Age/range selection remains valid; no transition date invented. */ }
            }
            if (decadals.boundary.isBoundary) {
              decadals.boundary.candidates = atStart && index > 0 ? [table[index - 1], table[index]]
                : [table[index], table[index + 1]].filter(Boolean);
              decadals.notes.push('표의 시작·종료 나이에 해당하는 해는 인접 구간도 함께 표시합니다. 기준일 대운은 자동 계산한 나이를 포함하는 범위이며 두 대운을 임의로 합친 판정은 아닙니다.');
              if (normalized.boundary === 'no' && (atStart || atEnd)) decadals.notes.push('이전 경계 비해당 입력과 표의 시작·종료 나이가 달라 인접 구간을 함께 표시했습니다.');
              if (normalized.boundary === 'yes' && !atStart && !atEnd) decadals.notes.push('표의 시작·종료 나이는 아니지만 이전 사용자 경계 입력에 따라 전환 후보를 함께 표시했습니다.');
            }
            if (decadals.nextTransitionDate) decadals.notes.push('다음 대운은 표시한 전환일인 음력 정월 초하루부터의 나이 범위입니다. 시각·출생지 보정을 한 전환 시각은 아닙니다.');
            else if (decadals.next) decadals.notes.push('다음 대운 범위는 있으나 음력 설의 양력 날짜를 확인하지 못해 정확한 전환일은 표시하지 않습니다.');
          }
        }
      }
    } catch {
      ageUnavailable('calendar-unavailable', 'AGE_CALENDAR_UNAVAILABLE', '출생일 또는 기준일의 실제 음력 변환을 확인하지 못해 나이와 대운을 자동 선택하지 않습니다.');
    }
  }
  const status = hasConflict ? 'conflict' : issues.length ? 'partial' : 'verified';
  return copy({ kind: 'ziwei-structure', status, options: normalized, issues, palaces, anchors, majorStars, triads, mutagens, decadals, notes: [
    '본명 자료의 실제 위치와 표기를 정리한 검증 모델입니다. 해석은 전통 상징의 참고 관점이며 예측·진단·투자 조언이 아닙니다.',
    '공궁은 본궁 주성이 없다는 뜻입니다. 대궁 주성은 참고 자료로만 읽고 본궁의 원래 별로 옮기지 않습니다.',
    '유년·유월·유일 운한은 계산하거나 제공하지 않습니다. 사화와 보조성 하나로 사건이나 길흉을 확정하지 않습니다.',
  ] });
}
