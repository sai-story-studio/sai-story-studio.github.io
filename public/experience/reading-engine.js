/**
 * Browser-only, deterministic entertainment readings.
 * Load vendor/lunar.js (1.7.7) and vendor/iztro.min.js (2.6.2) first.
 * Traditional calculations and the editorial personality mapping are separate.
 * Nothing in this module measures psychological traits or predicts the future.
 */

import { getZodiacProfile } from './zodiac-profiles.js';
import { calculateSajuCycles } from './saju-cycles.js';
import { resolveKoreanBirthTime } from './birthplace-time.js';

const PROFILES = {
  ISTJ: ['차분한 기록가', '작은 약속과 구체적인 사실을 소중히 여기며, 익숙한 흐름을 단단하게 가꾸는 이야기입니다.', ['성실함', '관찰', '정돈']],
  ISFJ: ['다정한 지킴이', '주변의 필요를 세심하게 살피고, 조용한 배려를 일상의 행동으로 옮기는 이야기입니다.', ['배려', '꾸준함', '기억']],
  INFJ: ['고요한 길잡이', '사람과 경험 사이의 의미를 연결하고, 마음에 둔 가치를 차분히 실천하는 이야기입니다.', ['통찰', '공감', '의미']],
  INTJ: ['먼 곳의 설계자', '전체의 구조를 그린 뒤 자신만의 기준으로 생각을 다듬어 가는 이야기입니다.', ['구상', '독립', '설계']],
  ISTP: ['담백한 탐구자', '눈앞의 원리를 직접 살펴보고, 필요한 순간에 유연한 해법을 찾는 이야기입니다.', ['실험', '관찰', '유연함']],
  ISFP: ['감각의 산책자', '지금의 감각과 개인적인 가치를 아끼며, 자기다운 방식으로 표현하는 이야기입니다.', ['감각', '진심', '여유']],
  INFP: ['마음의 이야기꾼', '작은 경험에서도 의미를 발견하고, 상상과 진심으로 자기만의 이야기를 만드는 유형입니다.', ['상상', '진정성', '가능성']],
  INTP: ['생각의 수집가', '당연해 보이는 일에도 질문을 던지고, 여러 가능성을 이어 생각을 넓히는 이야기입니다.', ['질문', '논리', '탐색']],
  ESTP: ['순간의 탐험가', '현장의 신호를 빠르게 읽고, 직접 움직이며 경험을 배우는 이야기입니다.', ['실행', '순발력', '경험']],
  ESFP: ['빛나는 동행자', '함께하는 순간의 즐거움을 발견하고, 생생한 표현으로 분위기를 따뜻하게 만드는 이야기입니다.', ['표현', '활기', '친밀함']],
  ENFP: ['가능성의 여행자', '새로운 연결과 아이디어에 마음이 움직이고, 사람들과 가능성을 나누는 이야기입니다.', ['호기심', '연결', '상상']],
  ENTP: ['질문의 발명가', '익숙한 관점을 뒤집어 보고, 대화와 실험에서 새로운 길을 찾는 이야기입니다.', ['발상', '토론', '변화']],
  ESTJ: ['든든한 추진자', '필요한 일을 분명하게 정리하고, 함께 움직일 수 있는 질서를 만드는 이야기입니다.', ['추진', '책임', '명료함']],
  ESFJ: ['온기의 연결자', '사람 사이의 약속과 분위기를 살피며, 함께하는 일상을 세심하게 챙기는 이야기입니다.', ['협력', '돌봄', '조화']],
  ENFJ: ['마음을 잇는 안내자', '서로의 강점을 발견하고, 함께 향할 수 있는 의미 있는 방향을 제안하는 이야기입니다.', ['격려', '공감', '방향']],
  ENTJ: ['넓은 시야의 개척자', '목표와 구조를 연결하고, 생각을 구체적인 움직임으로 이끄는 이야기입니다.', ['결단', '구조', '도전']],
};

// Each vector is [E minus I, N minus S, F minus T, P minus J].
// These are authored symbolic associations, not validated psychological scales.
const AXES = [
  { positive: 'E', negative: 'I', name: '관심의 방향', plus: '교류와 표현', minus: '몰입과 숙고' },
  { positive: 'N', negative: 'S', name: '정보를 보는 방식', plus: '의미와 가능성', minus: '경험과 구체성' },
  { positive: 'F', negative: 'T', name: '판단의 초점', plus: '가치와 관계', minus: '기준과 원리' },
  { positive: 'P', negative: 'J', name: '움직임의 리듬', plus: '탐색과 유연함', minus: '정리와 지속성' },
];
const TIE_LETTERS = ['I', 'N', 'F', 'P'];
const ELEMENTS = [
  { key: 'wood', label: '목', symbol: '木', vector: [1, 2, 1, 1], meaning: '성장·확장·탐색' },
  { key: 'fire', label: '화', symbol: '火', vector: [2, 1, 2, 1], meaning: '표현·활기·공감' },
  { key: 'earth', label: '토', symbol: '土', vector: [-1, -2, 1, -2], meaning: '안정·구체성·돌봄' },
  { key: 'metal', label: '금', symbol: '金', vector: [-1, -1, -2, -2], meaning: '기준·분별·정리' },
  { key: 'water', label: '수', symbol: '水', vector: [-2, 2, 1, 2], meaning: '숙고·상상·유연함' },
];
const ZODIAC_ELEMENTS = {
  fire: { label: '불', vector: [2, 1, 1, 1], meaning: '표현과 시도' },
  earth: { label: '흙', vector: [-1, -2, -1, -1], meaning: '경험과 안정' },
  air: { label: '공기', vector: [2, 2, -1, 1], meaning: '교류와 생각' },
  water: { label: '물', vector: [-2, 1, 2, 1], meaning: '내면과 공감' },
};
const MODALITIES = {
  cardinal: { label: '활동궁', vector: [1, 0, 0, -2], meaning: '먼저 시작하고 방향을 정하는 상징' },
  fixed: { label: '고정궁', vector: [-1, -1, 0, -2], meaning: '집중하며 오래 지키는 상징' },
  mutable: { label: '변통궁', vector: [0, 1, 0, 2], meaning: '상황을 살피며 유연하게 바꾸는 상징' },
};
const SIGNS = [
  { start: 120, name: '물병자리', symbol: '♒', element: 'air', modality: 'fixed', range: '1월 20일–2월 18일' },
  { start: 219, name: '물고기자리', symbol: '♓', element: 'water', modality: 'mutable', range: '2월 19일–3월 20일' },
  { start: 321, name: '양자리', symbol: '♈', element: 'fire', modality: 'cardinal', range: '3월 21일–4월 19일' },
  { start: 420, name: '황소자리', symbol: '♉', element: 'earth', modality: 'fixed', range: '4월 20일–5월 20일' },
  { start: 521, name: '쌍둥이자리', symbol: '♊', element: 'air', modality: 'mutable', range: '5월 21일–6월 21일' },
  { start: 622, name: '게자리', symbol: '♋', element: 'water', modality: 'cardinal', range: '6월 22일–7월 22일' },
  { start: 723, name: '사자자리', symbol: '♌', element: 'fire', modality: 'fixed', range: '7월 23일–8월 22일' },
  { start: 823, name: '처녀자리', symbol: '♍', element: 'earth', modality: 'mutable', range: '8월 23일–9월 22일' },
  { start: 923, name: '천칭자리', symbol: '♎', element: 'air', modality: 'cardinal', range: '9월 23일–10월 22일' },
  { start: 1023, name: '전갈자리', symbol: '♏', element: 'water', modality: 'fixed', range: '10월 23일–11월 21일' },
  { start: 1122, name: '사수자리', symbol: '♐', element: 'fire', modality: 'mutable', range: '11월 22일–12월 21일' },
  { start: 1222, name: '염소자리', symbol: '♑', element: 'earth', modality: 'cardinal', range: '12월 22일–1월 19일' },
];
const STAR_SYMBOLS = {
  자미: { vector: [1, 1, -1, -2], meaning: '중심을 잡고 방향을 세우는 상징' },
  천기: { vector: [-1, 2, -1, 2], meaning: '생각을 연결하고 유연하게 살피는 상징' },
  태양: { vector: [2, 1, 1, -1], meaning: '밖으로 표현하고 함께 나누는 상징' },
  무곡: { vector: [-1, -1, -2, -2], meaning: '기준을 세우고 꾸준히 실행하는 상징' },
  천동: { vector: [-1, 1, 2, 2], meaning: '편안함과 다정한 호기심의 상징' },
  염정: { vector: [1, 1, -1, -1], meaning: '자기 기준과 표현을 다듬는 상징' },
  천부: { vector: [-1, -2, 1, -2], meaning: '품을 넓히고 안정을 가꾸는 상징' },
  태음: { vector: [-2, 1, 2, -1], meaning: '내면의 감각과 세심함의 상징' },
  탐랑: { vector: [2, 2, 1, 2], meaning: '호기심과 다양한 연결의 상징' },
  거문: { vector: [-1, 2, -2, 1], meaning: '질문하고 근거를 살피는 상징' },
  천상: { vector: [-1, -1, 2, -2], meaning: '관계를 살피며 균형을 맞추는 상징' },
  천량: { vector: [-1, 1, 2, -2], meaning: '경험을 돌아보고 배려를 더하는 상징' },
  칠살: { vector: [1, -1, -2, -1], meaning: '분명하게 정하고 움직이는 상징' },
  파군: { vector: [1, 2, -1, 2], meaning: '익숙한 틀을 바꾸며 탐색하는 상징' },
};

const COMMON_LIMITS = [
  '전통 상징을 바탕으로 만든 오락용 성향 콘텐츠입니다. 정식 MBTI 검사나 과학적 성격 측정이 아닙니다.',
  '출생지·시간대·서머타임·진태양시를 보정하지 않습니다. 입력한 날짜와 시각을 그대로 사용하므로 다른 만세력이나 유파의 결과와 다를 수 있습니다.',
];
const LUNAR_LIMIT = '음력 변환은 중국 역법 기반 lunar-javascript를 사용합니다. 한국 음력 및 한국 표준시의 절입 경계와 일치하는지 별도로 검증하지 않았습니다.';

function fail(message) { throw new Error(message); }
function vendor() {
  const { Solar, Lunar } = globalThis;
  if (!Solar?.fromYmdHms || !Lunar?.fromYmdHms) fail('달력 계산 파일을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
  return { Solar, Lunar };
}
function todayInSeoul() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function isoDate(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function validateSolarDate(year, month, day) {
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) {
    fail('존재하는 날짜를 입력해 주세요. 월과 일, 윤년을 확인해 주세요.');
  }
}
// Date-only and unzoned timestamps are Seoul civil dates. An explicit ISO
// offset identifies an instant, so convert that instant to the Seoul date
// before freezing it; slicing UTC at Lunar New Year would select the wrong age.
function ziweiReferenceDate(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(value);
  if (!match) return null;
  const [, y, m, d, hh, mm, ss, fraction, zone] = match;
  try { validateSolarDate(Number(y), Number(m), Number(d)); } catch { return null; }
  if (Number(y) < 1900 || (hh != null && (Number(hh) > 23 || Number(mm) > 59 || Number(ss || 0) > 59))) return null;
  if (!zone) return `${y}-${m}-${d}`;
  if (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59)) return null;
  const instant = Date.parse(`${y}-${m}-${d}T${hh}:${mm}:${ss || '00'}${fraction ? '.' + fraction : ''}${zone}`);
  if (!Number.isFinite(instant)) return null;
  const seoul = new Date(instant + 9 * 60 * 60 * 1000);
  const date = isoDate(seoul.getUTCFullYear(), seoul.getUTCMonth() + 1, seoul.getUTCDate());
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number(date.slice(0, 4)) >= 1900 ? date : null;
}
function normalizeInput(input) {
  if (!input || typeof input !== 'object') fail('생년월일을 입력해 주세요.');
  const { mode, birthDate, birthTime = null, calendar = 'solar', leapMonth = false, gender = null } = input;
  if (!['zodiac', 'saju', 'ziwei'].includes(mode)) fail('별자리, 사주, 자미두수 중 하나를 선택해 주세요.');
  if (!['solar', 'lunar'].includes(calendar)) fail('양력 또는 음력을 선택해 주세요.');
  if (typeof leapMonth !== 'boolean') fail('윤달 여부를 확인해 주세요.');
  if (calendar === 'solar' && leapMonth) fail('윤달은 음력 날짜에서만 선택할 수 있습니다.');
  if (gender !== null && !['male', 'female'].includes(gender)) fail('명반 계산에 사용할 성별을 확인해 주세요.');
  if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) fail('생년월일을 YYYY-MM-DD 형식으로 입력해 주세요.');
  const [year, month, day] = birthDate.split('-').map(Number);
  const today = todayInSeoul();
  if (year < 1900 || year > Number(today.slice(0, 4))) fail('1900년부터 오늘까지의 생년월일을 입력해 주세요.');
  if (month < 1 || month > 12 || day < 1 || day > (calendar === 'lunar' ? 30 : 31)) fail('존재하는 월과 일을 입력해 주세요.');
  let hour = 12;
  let minute = 0;
  if (birthTime !== null) {
    if (typeof birthTime !== 'string' || !/^\d{2}:\d{2}$/.test(birthTime)) fail('태어난 시각을 HH:mm 형식으로 입력하거나 생시 모름을 선택해 주세요.');
    [hour, minute] = birthTime.split(':').map(Number);
    if (hour > 23 || minute > 59) fail('시각은 00:00부터 23:59 사이로 입력해 주세요.');
  }
  const { Solar, Lunar } = vendor();
  let solar;
  if (calendar === 'solar') {
    validateSolarDate(year, month, day);
    solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
  } else {
    try {
      const lunarMonth = leapMonth ? -month : month;
      const lunar = Lunar.fromYmdHms(year, lunarMonth, day, hour, minute, 0);
      solar = lunar.getSolar();
      const roundTrip = solar.getLunar();
      if (roundTrip.getYear() !== year || roundTrip.getMonth() !== lunarMonth || roundTrip.getDay() !== day) {
        fail('음력 날짜를 변환한 뒤 일치하지 않았습니다.');
      }
    } catch {
      fail('해당 음력 날짜나 윤달이 존재하지 않습니다. 윤달 여부와 마지막 날짜를 확인해 주세요.');
    }
  }
  const solarDate = isoDate(solar.getYear(), solar.getMonth(), solar.getDay());
  if (solarDate < '1900-01-01' || solarDate > today) fail('양력으로 환산한 날짜가 1900년부터 오늘 사이여야 합니다. 미래 날짜는 입력할 수 없습니다.');
  const nickname = typeof input.nickname === 'string' ? input.nickname.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) : '';
  // Only saju consumes these optional inputs. Keep old calls byte-for-byte
  // compatible, and never forward birthplace into other engines or storage.
  const hasTimeCorrection = mode === 'saju' && ('birthplaceId' in input || 'timeCorrection' in input);
  const birthplaceId = hasTimeCorrection ? input.birthplaceId ?? null : null;
  const timeCorrection = hasTimeCorrection ? input.timeCorrection ?? 'none' : 'none';
  if (hasTimeCorrection && ((birthplaceId !== null && typeof birthplaceId !== 'string') || !['none', 'local-mean-solar'].includes(timeCorrection))) {
    fail('출생 도시와 시간 보정 방식을 확인해 주세요.');
  }
  return { mode, birthDate, birthTime, calendar, leapMonth, gender, nickname, solar, solarDate, hour, minute, today,
    hasTimeCorrection, birthplaceId, timeCorrection };
}
function addVectors(entries) {
  return entries.reduce((total, { vector, weight = 1 }) => total.map((value, i) => value + vector[i] * weight), [0, 0, 0, 0]);
}
function mapAxes(vector) {
  return AXES.map((axis, i) => ({
    axis: `${axis.positive}/${axis.negative}`,
    name: axis.name,
    result: vector[i] > 0 ? axis.positive : vector[i] < 0 ? axis.negative : TIE_LETTERS[i],
    symbolBalance: vector[i],
    interpretation: vector[i] > 0 ? axis.plus : vector[i] < 0 ? axis.minus : '상징이 동률이어서 고정 표기 규칙을 적용',
  }));
}
function mappingDetails(vector, symbols) {
  return {
    method: '자체 제작 상징 연결표 v1.0.0. 성격 검사 점수나 확률이 아닙니다.',
    vectorOrder: ['E−I', 'N−S', 'F−T', 'P−J'],
    symbols,
    axes: mapAxes(vector),
    tieRule: '각 축의 합이 동률이면 I·N·F·P를 차례로 표기합니다. 이 선택에는 성격 측정의 의미가 없습니다.',
  };
}
function finish(input, vector, basis, calculation, chart, uncertainty = []) {
  const axes = mapAxes(vector);
  const type = axes.map((axis) => axis.result).join('');
  const [title, description, keywords] = PROFILES[type];
  const address = input.nickname ? `${input.nickname}님을 위한 상징 이야기입니다. ` : '';
  const result = {
    mode: input.mode,
    type,
    title,
    summary: `${address}${description} 실제 나의 모습과 닮은 부분만 가볍게 골라 읽어 보세요.`,
    basis,
    sections: [
      { title: '이 이야기의 중심', text: description },
      { title: '네 글자로 연결한 이유', text: axes.map((axis) => `${axis.result}: ${axis.interpretation}`).join(' · ') },
      { title: '균형을 위한 질문', text: `${type[0] === 'E' ? '바깥의 교류 뒤에 혼자 정리할 시간도 마련하고 있나요?' : '충분히 생각한 것을 편한 사람과 나눌 기회도 마련하고 있나요?'} ${type[3] === 'J' ? '익숙한 계획에 작은 여백을 남겨 본다면 어떨까요?' : '여러 가능성 중 오늘 해 볼 작은 한 가지를 정한다면 무엇일까요?'}` },
    ],
    keywords: [...keywords],
    calculation,
    uncertainty: [...COMMON_LIMITS, ...uncertainty],
    chart,
  };
  return result;
}

function zodiacReading(input) {
  const monthDay = input.solar.getMonth() * 100 + input.solar.getDay();
  let sign = SIGNS[SIGNS.length - 1];
  for (const candidate of SIGNS) if (monthDay >= candidate.start) sign = candidate;
  const element = ZODIAC_ELEMENTS[sign.element];
  const modality = MODALITIES[sign.modality];
  const vector = addVectors([element, modality]);
  const basis = [
    `양력 ${input.solarDate} → ${sign.name} (${sign.range})`,
    `${element.label} 원소: ${element.meaning}의 상징`,
    `${modality.label}: ${modality.meaning}`,
    '원소와 양상의 자체 연결표를 축별로 합산해 네 글자 스타일을 정했습니다. 날짜 해시나 무작위 배정은 사용하지 않습니다.',
  ];
  const result = finish(input, vector, basis, {
    engine: '서양 태양궁 관용 날짜표 · 자체 상징 매핑', version: '1.0.0',
    rules: ['태양의 실제 황경 대신 고정된 관용 월일 경계를 사용합니다.', '4원소와 3양상의 상징 벡터를 같은 비중으로 합산합니다.', '시간대·진태양시는 보정하지 않습니다.'],
    details: {
      solarDate: input.solarDate, sign: sign.name, dateRange: sign.range,
      mapping: mappingDetails(vector, [
        { label: element.label, vector: [...element.vector], weight: 1, meaning: element.meaning },
        { label: modality.label, vector: [...modality.vector], weight: 1, meaning: modality.meaning },
      ]),
    },
  }, { kind: 'zodiac', name: sign.name, symbol: sign.symbol, element: element.label, modality: modality.label }, [
    '관용 날짜 경계를 쓰므로 경계일에는 실제 천문학적 태양궁과 다를 수 있습니다. 출생시각을 입력해도 천문 황경을 계산하지 않습니다.',
    ...(input.calendar === 'lunar' ? [LUNAR_LIMIT] : []),
  ]);
  // Keep the main reading brief. The longer editorial profile belongs in the
  // detail view, not in the calculation or the four-axis symbolic mapping.
  const profile = getZodiacProfile(sign.name);
  const reflection = result.sections.find((section) => section.title === '균형을 위한 질문');
  const core = typeof profile?.strengths?.[0] === 'string' ? profile.strengths[0] : result.sections[0].text;
  if (typeof profile?.summary === 'string' && profile.summary.trim()) result.summary = profile.summary;
  if (Array.isArray(profile?.keywords) && profile.keywords.length && profile.keywords.every((word) => typeof word === 'string')) {
    result.keywords = [...profile.keywords];
  }
  result.sections = [{ title: '별자리의 핵심', text: core }, ...(reflection ? [reflection] : [])];
  return result;
}

// These are unmodified natal-chart labels from the pinned vendor, not new
// personality weights. Missing optional information stays null/empty.
// Official API: https://6tail.cn/calendar/lunar.bazi.html
function eightCharText(bazi, method) {
  const value = typeof bazi[method] === 'function' ? bazi[method]() : null;
  return typeof value === 'string' && value.length ? value : null;
}
function eightCharTexts(bazi, method) {
  const value = typeof bazi[method] === 'function' ? bazi[method]() : null;
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? Array.from(value) : [];
}

function solarFromClock(value) {
  const parts = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!parts) fail('시간 보정 계산 자료를 확인할 수 없습니다.');
  return vendor().Solar.fromYmdHms(...parts.slice(1).map(Number));
}

// The pinned EightChar methods use their own day's stem for TenGods and
// growth stages. In the split-clock policy, physical year/month must instead
// be read relative to the LMT day stem. Read the SAME pinned vendor tables;
// never mix a physical-clock day master into the corrected chart.
// Source: lunar-javascript v1.7.7 EightChar.get*ShiShen*/_getDiShi.
function correctedRelativeLabels(dayBazi, stem, branch, key) {
  const util = globalThis.LunarUtil;
  const dayStem = dayBazi.getDayGan();
  const hidden = util?.ZHI_HIDE_GAN?.[branch];
  const offset = util?.CHANG_SHENG_OFFSET?.[dayStem];
  const branchIndex = '子丑寅卯辰巳午未申酉戌亥'.indexOf(branch);
  const dayIndex = '甲乙丙丁戊己庚辛壬癸'.indexOf(dayStem);
  if (!Array.isArray(hidden) || !Number.isInteger(offset) || branchIndex < 0 || dayIndex < 0 || !util?.SHI_SHEN || !Array.isArray(util.CHANG_SHENG)) {
    fail('시간 보정에 필요한 사주 대응표를 확인할 수 없습니다.');
  }
  const stemTenGod = key === 'day' ? '日主' : util.SHI_SHEN[dayStem + stem];
  const branchTenGods = Array.from(hidden, (hiddenStem) => util.SHI_SHEN[dayStem + hiddenStem]);
  const growthStage = util.CHANG_SHENG[((offset + (dayIndex % 2 === 0 ? branchIndex : -branchIndex)) % 12 + 12) % 12];
  if (typeof stemTenGod !== 'string' || branchTenGods.some((item) => typeof item !== 'string') || typeof growthStage !== 'string') {
    fail('시간 보정한 사주의 십성·십이운성 자료를 확인할 수 없습니다.');
  }
  return { stemTenGod, branchTenGods, growthStage };
}

function sajuReading(input, options) {
  const timeCorrection = input.hasTimeCorrection ? resolveKoreanBirthTime({ solarDate: input.solarDate,
    birthTime: input.birthTime, birthplaceId: input.birthplaceId, timeCorrection: input.timeCorrection }) : null;
  if (timeCorrection && !['applied', 'not-requested', 'missing-time'].includes(timeCorrection.status)) fail(timeCorrection.reason || '시간 보정 정보를 확인해 주세요.');
  const applied = timeCorrection?.applied === true;
  // Solar terms in lunar 1.7.7 are expressed in fixed UTC+08 (ShouXingUtil
  // qiAccurate adds ONE_THIRD day). Compare the actual instant in that clock.
  // Longitude shifts only the day/hour clock; it must not shift a solar term.
  const absoluteSolar = applied ? solarFromClock(timeCorrection.engineDateTime) : input.solar;
  const bazi = absoluteSolar.getLunar().getEightChar();
  bazi.setSect(2);
  const dayBazi = applied ? solarFromClock(timeCorrection.correctedDateTime).getLunar().getEightChar() : bazi;
  dayBazi.setSect(2);
  const fields = [
    ['year', '연주', 'Year'], ['month', '월주', 'Month'], ['day', '일주', 'Day'],
    ...(input.birthTime !== null ? [['time', '시주', 'Time']] : []),
  ];
  const counts = Object.fromEntries(ELEMENTS.map((element) => [element.key, 0]));
  const pillars = fields.map(([key, label, method]) => {
    const pillarBazi = key === 'day' || key === 'time' ? dayBazi : bazi;
    const ganZhi = pillarBazi[`get${method}`]();
    const pair = [...pillarBazi[`get${method}WuXing`]()].map((symbol) => ELEMENTS.find((element) => element.symbol === symbol));
    if (pair.some((element) => !element)) fail('사주 오행 정보를 확인할 수 없습니다.');
    pair.forEach((element) => { counts[element.key] += 1; });
    if (key === 'day') counts[pair[0].key] += 1;
    return {
      key, label, ganZhi, stem: pillarBazi[`get${method}Gan`](), branch: pillarBazi[`get${method}Zhi`](), elements: pair.map((element) => element.label),
      hiddenStems: eightCharTexts(pillarBazi, `get${method}HideGan`),
      stemTenGod: eightCharText(pillarBazi, `get${method}ShiShenGan`),
      branchTenGods: eightCharTexts(pillarBazi, `get${method}ShiShenZhi`),
      growthStage: eightCharText(pillarBazi, `get${method}DiShi`),
      naYin: eightCharText(pillarBazi, `get${method}NaYin`),
      voidBranches: eightCharText(pillarBazi, `get${method}XunKong`),
      ...(applied ? correctedRelativeLabels(dayBazi, pillarBazi[`get${method}Gan`](), pillarBazi[`get${method}Zhi`](), key) : {}),
    };
  });
  const elements = ELEMENTS.map((element) => ({ key: element.key, label: element.label, symbol: element.symbol, count: counts[element.key] }));
  const vector = addVectors(ELEMENTS.map((element) => ({ vector: element.vector, weight: counts[element.key] })));
  const basis = [
    `${pillars.map((pillar) => `${pillar.label} ${pillar.ganZhi}`).join(' · ')}${input.birthTime === null ? ' · 생시 미상으로 시주 제외' : ''}`,
    `천간과 지지의 본오행을 각각 한 번, 일간을 추가 한 번 반영했습니다: ${elements.map((element) => `${element.label} ${element.count}`).join(' · ')}. 이는 자체 해석 가중치입니다.`,
    '목은 성장·확장, 화는 표현·공감, 토는 안정·돌봄, 금은 기준·정리, 수는 숙고·탐색의 상징으로 연결했습니다.',
    '오행의 수나 네 글자는 강약·용신 판정 또는 심리측정 결과를 뜻하지 않습니다.',
  ];
  const uncertainty = [applied ? '음력 날짜 변환은 중국 역법 기반 lunar-javascript를 사용하며 한국 음력 날짜와의 차이를 별도로 보정하지 않습니다.' : LUNAR_LIMIT];
  if (input.birthTime === null) uncertainty.push('생시를 몰라 정오를 일주 계산의 기준으로만 사용했습니다. 시주와 시주 오행은 결과에 포함하지 않았으며 절입 당일의 연주·월주 경계는 확정할 수 없습니다.');
  const result = finish(input, vector, basis, {
    engine: 'lunar-javascript · 자체 오행 상징 매핑', version: '1.7.7 / mapping 1.0.0',
    rules: [
      '연주는 입춘 시각, 월주는 절입 시각을 기준으로 하는 EightChar의 Exact 계산을 사용합니다.',
      'setSect(2): 23시대의 일주를 당일로 보는 규칙입니다. 시주는 엔진의 자시 계산을 따릅니다.',
      '천간·지지의 본오행 각 1, 일간 추가 1의 자체 가중치입니다. 지장간·월령·합충·용신을 반영한 사주 강약 계산은 아닙니다.',
      input.birthTime === null ? '생시 미상: 정오를 임시 계산 시각으로 사용하며 시주를 완전히 제외합니다.' : '입력한 생시의 시주를 포함합니다.',
      applied ? '한국 표준시·서머타임 이력을 거쳐 절대시각을 환산합니다. 연·월 절입과 대운은 UTC+08 엔진 시각, 일·시는 대표 관측소 경도의 지역평균태양시를 사용합니다. 균시차는 적용하지 않습니다.'
        : '출생지·시간대·서머타임·진태양시를 보정하지 않습니다.',
    ],
    details: {
      solarDate: input.solarDate, birthTimeKnown: input.birthTime !== null, sect: 2,
      pillars: Object.fromEntries(['year', 'month', 'day', 'time'].map((key) => [key, pillars.find((pillar) => pillar.key === key)?.ganZhi || null])),
      elements,
      mapping: mappingDetails(vector, ELEMENTS.map((element) => ({ label: `${element.label}(${element.symbol})`, vector: [...element.vector], weight: counts[element.key], meaning: element.meaning }))),
    },
  }, { kind: 'saju', solarDate: input.solarDate, lunarDate: input.solar.getLunar().toString(), pillars, elements,
    cycles: calculateSajuCycles({ solar: absoluteSolar, bazi, ...(applied ? { correctedBazi: dayBazi, timeCorrection } : {}), birthTimeKnown: input.birthTime !== null, gender: input.gender }, options),
    ...(timeCorrection ? { timeCorrection } : {}),
  }, uncertainty);
  if (applied) result.uncertainty[1] = '지역평균태양시 보정은 대표 관측소 경도와 IANA tzdb 2026e의 한국 시각 이력을 사용한 선택형 계산입니다. 균시차·병원 위치는 반영하지 않으며 유파와 과거 실제 시계 기록에 따라 차이가 날 수 있습니다.';
  if (timeCorrection?.status === 'missing-time') result.uncertainty.push('지역평균태양시 보정을 선택했지만 생시가 없어 적용하지 않았습니다.');
  return result;
}

// iztro's auxiliary/miscellaneous stars use the same natal Star structure.
// Only natal decade ranges are copied; no current age or transit is inferred.
// Official schema: https://www.iztro.com/en_US/type-definition
function plainSupplementalStars(stars) {
  if (!Array.isArray(stars)) return [];
  return Array.from(stars, (star) => ({
    name: star.name, brightness: star.brightness || '', mutagen: star.mutagen || '',
    ...(typeof star.type === 'string' ? { type: star.type } : {}),
  }));
}
function plainPalace(palace) {
  return {
    index: palace.index, name: palace.name, heavenlyStem: palace.heavenlyStem,
    earthlyBranch: palace.earthlyBranch, isBodyPalace: palace.isBodyPalace,
    majorStars: Array.from(palace.majorStars).filter((star) => star.type === 'major').map((star) => ({ name: star.name, brightness: star.brightness || '', mutagen: star.mutagen || '' })),
    minorStars: plainSupplementalStars(palace.minorStars),
    adjectiveStars: plainSupplementalStars(palace.adjectiveStars),
    decadal: palace.decadal && Array.isArray(palace.decadal.range) ? {
      range: Array.from(palace.decadal.range),
      heavenlyStem: palace.decadal.heavenlyStem, earthlyBranch: palace.decadal.earthlyBranch,
    } : null,
  };
}
const ZIWEI_STEM_KEYS = ['jiaHeavenly', 'yiHeavenly', 'bingHeavenly', 'dingHeavenly', 'wuHeavenly', 'jiHeavenly', 'gengHeavenly', 'xinHeavenly', 'renHeavenly', 'guiHeavenly'];
const ZIWEI_STAR_KEYS = {
  ziweiMaj: '자미', tianjiMaj: '천기', taiyangMaj: '태양', wuquMaj: '무곡', tiantongMaj: '천동', lianzhenMaj: '염정',
  tianfuMaj: '천부', taiyinMaj: '태음', tanlangMaj: '탐랑', jumenMaj: '거문', tianxiangMaj: '천상', tianliangMaj: '천량',
  qishaMaj: '칠살', pojunMaj: '파군', zuofuMin: '좌보', youbiMin: '우필', wenchangMin: '문창', wenquMin: '문곡',
};
function plainBirthYearMutagens(calculated) {
  const yearStem = calculated.rawDates?.chineseDate?.yearly?.[0];
  const stemKey = ZIWEI_STEM_KEYS['甲乙丙丁戊己庚辛壬癸'.indexOf(yearStem)];
  const stars = globalThis.iztro?.data?.heavenlyStems?.[stemKey]?.mutagen;
  if (typeof yearStem !== 'string' || yearStem.length !== 1 || !Array.isArray(stars) || stars.length !== 4
    || stars.some((key) => !ZIWEI_STAR_KEYS[key])) return null;
  return { yearStem, source: 'iztro 2.6.2 기본 생년사화표 · 록·권·과·기 순서',
    items: Array.from(stars, (key, index) => ({ key: ['록', '권', '과', '기'][index], star: ZIWEI_STAR_KEYS[key] })),
  };
}
function plainTriadRefs(calculated) {
  if (typeof calculated.surroundedPalaces !== 'function') return [];
  try {
    return Array.from(calculated.palaces, (palace) => {
      const surrounded = calculated.surroundedPalaces(palace.index);
      return { targetIndex: surrounded?.target?.index, oppositeIndex: surrounded?.opposite?.index,
        wealthIndex: surrounded?.wealth?.index, careerIndex: surrounded?.career?.index };
    });
  } catch { return []; }
}
function ziweiReading(input, options = {}) {
  if (input.birthTime === null) fail('자미두수 명반에는 태어난 시각이 필요합니다. 생시를 모르면 별자리 또는 시주를 제외한 사주 이야기를 이용해 주세요.');
  if (input.gender === null) fail('자미두수 명반 규칙에 사용할 성별을 선택해 주세요. 모르는 정보로 명반을 만들지 않습니다.');
  const astro = globalThis.iztro?.astro;
  if (!astro?.withOptions) fail('자미두수 계산 파일을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
  const timeIndex = input.hour === 0 ? 0 : input.hour === 23 ? 12 : Math.floor((input.hour + 1) / 2);
  const config = { yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'forward', algorithm: 'default' };
  let calculated;
  try {
    calculated = astro.withOptions({
      type: 'solar', dateStr: input.solarDate, timeIndex, gender: input.gender,
      fixLeap: true, language: 'ko-KR', config,
    });
  } catch {
    fail('입력 정보로 자미두수 명반을 계산하지 못했습니다. 날짜·윤달·시각을 다시 확인해 주세요.');
  }
  if (!Array.isArray(calculated.palaces) || calculated.palaces.length !== 12 ||
      calculated.palaces.some((palace) => !Number.isInteger(palace.index) || palace.index < 0 || palace.index > 11 || typeof palace.name !== 'string' || !palace.name || !Array.isArray(palace.majorStars)) ||
      new Set(calculated.palaces.map((palace) => palace.index)).size !== 12) {
    fail('계산한 자미두수 명반의 12궁 정보를 확인할 수 없습니다.');
  }
  const soulPalace = calculated.palace('命宫') || calculated.palaces.find((palace) => palace.name === '명궁');
  if (!soulPalace) fail('계산한 명반에서 명궁을 찾지 못했습니다.');
  const ownStars = Array.from(soulPalace.majorStars).filter((star) => star.type === 'major');
  const oppositePalace = calculated.palaces.find((palace) => palace.index === (soulPalace.index + 6) % 12);
  const mappingPalace = ownStars.length ? soulPalace : oppositePalace;
  const mappingStars = Array.from(mappingPalace?.majorStars || []).filter((star) => star.type === 'major');
  if (!mappingStars.length || mappingStars.some((star) => !STAR_SYMBOLS[star.name])) fail('명반의 주성 상징을 해석할 수 없습니다.');
  const vector = addVectors(mappingStars.map((star) => STAR_SYMBOLS[star.name]));
  const sourceLabel = ownStars.length ? '명궁 주성' : '명궁은 주성이 없는 공궁입니다. 대궁인 천이궁 주성';
  // Freeze a date-only reference for repeatable reports. Explicit report dates
  // may override this later; this does not enter any personality calculation.
  const referenceDate = ziweiReferenceDate(options.asOf, input.today);
  const basis = [
    `실제 명반: 명궁 ${soulPalace.heavenlyStem}${soulPalace.earthlyBranch} · ${calculated.fiveElementsClass} · ${calculated.time} (${calculated.timeRange})`,
    `${sourceLabel}: ${mappingStars.map((star) => star.name).join('·')}`,
    ...mappingStars.map((star) => `${star.name}: ${STAR_SYMBOLS[star.name].meaning}`),
    '위 주성의 자체 상징 벡터를 같은 비중으로 합산했습니다. 보조성·사화·대운을 성격이나 미래의 점수로 해석하지 않습니다.',
  ];
  return finish(input, vector, basis, {
    engine: 'iztro · 자체 주성 상징 매핑', version: '2.6.2 / mapping 1.0.0',
    rules: [
      '한국어 명반의 명궁 주성만 상징 연결에 사용합니다. 명궁 공궁은 실제 대궁(천이궁) 주성을 참고했다고 표시합니다.',
      'yearDivide normal: 연의 경계는 음력 설입니다. dayDivide forward: 23시의 늦은 자시는 다음날로 배정합니다.',
      'fixLeap true: 윤달 전반 1~15일은 해당 월, 후반은 다음 월로 보는 엔진 규칙을 사용합니다. 늦은 자시의 세부 처리는 엔진에 맡깁니다.',
      'algorithm default를 사용합니다. 각 2시간 생시 구간을 사용하며 분 단위 명반을 계산하지 않습니다.',
      '출생지·시간대·서머타임·진태양시를 보정하지 않습니다. 성별 입력은 전통 명반의 배열 규칙에 사용됩니다.',
    ],
    details: {
      solarDate: input.solarDate, timeIndex, fixLeap: true, config,
      soulPalaceName: soulPalace.name, originalMajorStars: ownStars.map((star) => star.name),
      mappingSource: ownStars.length ? 'soulPalace' : 'oppositePalace', majorStars: mappingStars.map((star) => star.name),
      mapping: mappingDetails(vector, mappingStars.map((star) => ({ label: star.name, vector: [...STAR_SYMBOLS[star.name].vector], weight: 1, meaning: STAR_SYMBOLS[star.name].meaning }))),
    },
  }, {
    kind: 'ziwei', solarDate: input.solarDate, lunarDate: calculated.lunarDate, referenceDate,
    time: calculated.time, timeRange: calculated.timeRange, fiveElementsClass: calculated.fiveElementsClass,
    soul: calculated.soul, body: calculated.body, soulPalace: plainPalace(soulPalace),
    palaces: Array.from(calculated.palaces, plainPalace),
    soulPalaceBranch: calculated.earthlyBranchOfSoulPalace,
    bodyPalaceBranch: calculated.earthlyBranchOfBodyPalace,
    birthYearStem: calculated.rawDates?.chineseDate?.yearly?.[0] || null,
    birthLunarYear: Number.isInteger(calculated.rawDates?.lunarDate?.lunarYear) ? calculated.rawDates.lunarDate.lunarYear : null,
    birthYearMutagens: plainBirthYearMutagens(calculated), triadRefs: plainTriadRefs(calculated),
  }, [LUNAR_LIMIT, ...(ownStars.length ? [] : ['명궁에 주성이 없어 대궁인 천이궁의 실제 주성을 참고한 상징 이야기입니다. 다른 유파는 다르게 해석할 수 있습니다.'])]);
}

/** Return only plain data and text. Render all strings with textContent, never innerHTML. */
export function calculateReading(input, options = {}) {
  const normalized = normalizeInput(input);
  if (normalized.mode === 'zodiac') return zodiacReading(normalized);
  if (normalized.mode === 'saju') return sajuReading(normalized, { asOf: options.asOf });
  return ziweiReading(normalized, { asOf: options.asOf });
}
