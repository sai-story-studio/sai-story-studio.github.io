/**
 * A pure, local view model for an already-calculated reading. No new chart,
 * personality assessment, network request, or persistent record is created.
 * Render every string with textContent; none of these fields contain HTML.
 * Calculation vocabulary: https://6tail.cn/calendar/lunar.bazi.html
 * Ziwei terminology: https://docs.iztro.com/ko_KR/learn/palace
 * https://docs.iztro.com/ko_KR/learn/star and /learn/mutagen
 */
import { describeDayPillar } from './day-pillar.js';
import { getZodiacProfile } from './zodiac-profiles.js';
import { buildSajuReport } from './saju-report.js';
import { buildZiweiReport } from './ziwei-report.js';
import { getKoreanBirthplace } from './birthplace-time.js';

const SAJU_UNCORRECTED = '한국 출생지·과거 표준시·서머타임·진태양시를 추가 보정한 전문 감정은 아닙니다.';
function correctionStamp(value, utc = false) {
  if (typeof value !== 'string' || !(utc ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/ : /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/).test(value)) return null;
  const iso = utc ? value : `${value.replace(' ', 'T')}Z`, instant = Date.parse(iso);
  return Number.isFinite(instant) && new Date(instant).toISOString().replace('.000Z', 'Z') === iso ? instant / 1000 : null;
}
/** Safe policy copy is shareable; exact place/clock metadata is local-only. */
export function sajuTimeCorrectionDisplay(result, { includePrivate = false } = {}) {
  if (result?.mode !== 'saju' || result.chart?.kind !== 'saju') return null;
  const data = result.chart.timeCorrection;
  const legacy = { applied: false, summary: '입력 시각을 그대로 사용했습니다.', policy: SAJU_UNCORRECTED, items: [], privateItems: [] };
  if (!data || data.method === 'none' && data.applied === false && data.status === 'not-requested') return legacy;
  if (data.version === '1.0.0' && data.method === 'local-mean-solar' && data.applied === false && data.status === 'missing-time') return {
    applied: false, summary: '생시를 몰라 시각 보정을 적용하지 않았습니다.', policy: '지역 평균태양시 보정을 선택했지만 생시가 없어 시주나 보정 시각을 만들지 않았습니다. 확인된 출생일의 세 기둥만 설명합니다.',
    items: ['출생지 선택만으로 생시를 추정하지 않으며 시주와 생시를 필요로 하는 대운은 비워 둡니다.'], privateItems: [],
  };
  const city = getKoreanBirthplace(data.city?.id);
  const original = correctionStamp(data.originalDateTime), utc = correctionStamp(data.utcDateTime, true), engine = correctionStamp(data.engineDateTime), corrected = correctionStamp(data.correctedDateTime);
  const numbers = ['offsetSeconds', 'longitudeSeconds', 'correctionSeconds'].every((key) => Number.isSafeInteger(data[key]));
  const valid = data.version === '1.0.0' && data.method === 'local-mean-solar' && data.status === 'applied' && data.applied === true && city
    && [original, utc, engine, corrected].every(value => value !== null) && numbers && [30600,32400,34200,36000].includes(data.offsetSeconds) && data.longitudeSeconds === Math.round(city.longitude * 240)
    && data.correctionSeconds === data.longitudeSeconds - data.offsetSeconds && original - data.offsetSeconds === utc
    && utc + 8 * 3600 === engine && original + data.correctionSeconds === corrected;
  if (!valid) return { applied: false, summary: '시각 보정 자료의 정합성을 확인하지 못했습니다.', policy: '보정 방식과 원래 시각·계산 시각이 일치하는지 확인하지 못해 보정의 적용 결과를 설명하지 않았습니다.', items: [], privateItems: [] };
  const delta = Math.abs(data.correctionSeconds), deltaText = `${Math.floor(delta / 60)}분 ${delta % 60}초 ${data.correctionSeconds < 0 ? '앞당김' : '늦춤'}`;
  return { applied: true, summary: '출생지 기준 지역 평균태양시 보정을 적용했습니다.',
    policy: '선택 도시의 대표 경도와 출생 당시 한국 표준시·서머타임을 반영한 지역 평균태양시 보정입니다. 균시차를 적용하지 않아 진태양시와 다르며, 실제 출생 장소의 정확한 좌표를 뜻하지 않습니다.',
    items: ['연주·월주와 절기·대운의 기산은 실제 출생 순간을 UTC+08:00 엔진 시각으로 옮겨 계산하고, 일주·시주는 지역 평균태양시를 기준으로 구분했습니다.', '원래 출생일과 보정 후 계산 시각을 분리했습니다. 입력 기록에 보관하는 양력 생년월일은 보정 전 출생일입니다.'],
    privateItems: includePrivate === true ? [`출생지 기준: ${city.name} · 대표 경도 ${city.longitude}°E`, `원래 양력 출생 시각: ${data.originalDateTime}`, `지역 평균태양시: ${data.correctedDateTime} · ${deltaText}`, `절기·대운 엔진 시각: ${data.engineDateTime} (UTC+08:00)`] : [],
  };
}

const MODES = { zodiac: '별자리', saju: '사주', ziwei: '자미두수' };
const SIGN_STORIES = {
  물병자리: ['익숙한 것을 다른 각도에서 바라보는 이미지', '다들 당연하게 여기는 것 중 나만의 방식으로 바꿔 보고 싶은 것은 무엇인가요?'],
  물고기자리: ['서로 다른 마음과 경험 사이를 잇는 이미지', '말로 설명하기 어려웠지만 누군가와 나누고 싶은 느낌이 있나요?'],
  양자리: ['작게라도 첫걸음을 떼어 보는 이미지', '완벽한 준비보다 작은 시도가 도움이 될 일은 무엇인가요?'],
  황소자리: ['좋아하는 것을 천천히 가꾸는 이미지', '빨리 이루는 것보다 오래 지키고 싶은 일상의 즐거움은 무엇인가요?'],
  쌍둥이자리: ['질문과 대화로 관점을 넓히는 이미지', '최근 나와 다른 생각을 듣고 새롭게 궁금해진 것은 무엇인가요?'],
  게자리: ['편안한 공간과 관계를 돌보는 이미지', '나에게 안전하고 편안한 느낌을 주는 사람이나 장소는 어디인가요?'],
  사자자리: ['좋아하는 것을 자기 목소리로 표현하는 이미지', '누군가의 평가와 상관없이 표현해 보고 싶은 나의 관심사는 무엇인가요?'],
  처녀자리: ['작은 부분을 살펴 일상을 다듬는 이미지', '지금 생활을 조금 편하게 만들 수 있는 작은 정리는 무엇인가요?'],
  천칭자리: ['서로 다른 입장 사이에서 균형을 찾아보는 이미지', '다른 사람을 배려하면서도 내 바람을 분명히 말할 수 있는 방법은 무엇인가요?'],
  전갈자리: ['한 가지 경험을 깊이 들여다보는 이미지', '겉으로 보이는 이유 말고, 내가 정말 중요하게 여기는 마음은 무엇인가요?'],
  사수자리: ['익숙한 경계를 넘어 시야를 넓히는 이미지', '가까운 곳에서라도 새롭게 배우거나 경험해 보고 싶은 것은 무엇인가요?'],
  염소자리: ['시간을 들여 자기 목표를 쌓아 가는 이미지', '남의 기준보다 나에게 의미 있는 목표를 작게 나눈다면 첫 단계는 무엇인가요?'],
};
const ELEMENT_STORIES = {
  목: ['성장과 시도', '새로 시작해 보고 싶은 작은 일은 무엇인가요?'],
  화: ['표현과 온기', '내 마음을 부담 없이 표현할 수 있는 방법은 무엇인가요?'],
  토: ['안정과 꾸준함', '반복할수록 편안해지는 나만의 일상은 무엇인가요?'],
  금: ['기준과 정리', '지금 지키고 싶은 기준과 내려놓아도 되는 기준은 무엇인가요?'],
  수: ['숙고와 유연함', '잠시 멈추어 생각하거나 다른 방법을 시도할 여유가 필요한가요?'],
};
const ZODIAC_ELEMENTS = { 불: '표현하고 시도하는 장면', 흙: '경험을 쌓고 기반을 다지는 장면', 공기: '대화하며 생각을 연결하는 장면', 물: '마음과 관계를 돌아보는 장면' };
const MODALITY_STORIES = { 활동궁: '어떻게 시작할지', 고정궁: '무엇을 오래 지킬지', 변통궁: '언제 방식을 바꿀지' };
const STAR_SCENES = {
  자미: '함께하는 일에서 중심과 방향을 정하는 장면', 천기: '여러 방법을 연결하고 계획을 고쳐 보는 장면',
  태양: '알고 있는 것과 관심을 바깥으로 나누는 장면', 무곡: '기준을 세우고 작은 실천을 이어 가는 장면',
  천동: '편안한 분위기에서 호기심을 펼치는 장면', 염정: '자기 기준과 표현 방법을 함께 다듬는 장면',
  천부: '필요한 것을 챙기며 안정적인 바탕을 만드는 장면', 태음: '조용히 자기 감각과 마음을 살피는 장면',
  탐랑: '다양한 관심사를 만나고 새로운 연결을 즐기는 장면', 거문: '질문을 던지고 이유를 확인하는 장면',
  천상: '사람들의 입장을 살피고 균형을 찾는 장면', 천량: '지난 경험에서 배운 것을 서로 나누는 장면',
  칠살: '필요한 선택을 분명히 하고 움직이는 장면', 파군: '익숙한 방식을 바꾸어 다른 가능성을 찾는 장면',
};
const STAR_GUIDES = {
  자미: ['여러 사람의 역할을 정리하고 전체 방향을 잡는 중심 역할이에요.', '책임을 모두 떠안기보다 결정할 일과 나눠 맡길 일을 구분하는 것이 중요해요.'],
  천기: ['관찰한 정보를 연결해 계획을 세우고, 조건이 바뀌면 방법도 고쳐요.', '비교할 선택지가 많을수록 작은 실험 하나를 정해 실행하는 데 힘을 써요.'],
  태양: ['알고 있는 것을 공개하고 도움이 필요한 곳에 먼저 손을 내미는 쪽이에요.', '남을 챙기는 일정 옆에 나를 위해 비워 둘 시간도 남겨요.'],
  무곡: ['돈·시간·결과처럼 확인할 수 있는 기준을 세우고 실천을 쌓아요.', '정확한 업무 처리에 더해 함께하는 사람이 어떤 부담을 느끼는지도 물어봐요.'],
  천동: ['편안하게 어울리는 분위기와 작지만 즐거운 일상을 소중히 여겨요.', '쉬는 시간을 지키되 미뤄 둔 일은 가장 쉬운 단계부터 시작해 볼 수 있어요.'],
  염정: ['내가 지킬 원칙과 관계 안에서의 표현을 선명하게 다루는 별이에요.', '감정이 커졌을 때는 바로 결론 내리기보다 무엇이 불편했는지 구체적으로 말해 봐요.'],
  천부: ['이미 가진 자원과 사람을 챙겨 오래 유지할 기반을 만드는 역할이에요.', '지켜야 할 것은 남기고, 상황이 달라져 조정할 부분은 따로 골라요.'],
  태음: ['세밀한 관찰과 조용한 준비로 생각과 감각을 깊게 모아요.', '혼자 정리한 바람을 편한 사람에게 한 문장으로 꺼내 보는 연습이 어울려요.'],
  탐랑: ['새로운 취미·사람·경험에 관심을 넓히고 서로 연결하는 쪽이에요.', '선택을 늘리는 재미와 한 가지를 끝까지 가꾸는 시간을 함께 챙겨요.'],
  거문: ['말과 질문으로 이유를 확인하고 설명의 빈틈을 짚는 역할이에요.', '옳은 내용도 상대가 받아들일 표현과 순서로 전하면 대화가 달라져요.'],
  천상: ['서로 다른 입장을 듣고 역할과 기준을 조율하는 데 무게를 둬요.', '도와주기 전에 내가 할 수 있는 범위와 원하는 조건을 분명히 해요.'],
  천량: ['경험과 원칙을 바탕으로 보호하고 조언하는 어른의 역할에 견줘요.', '해법을 말하기 전, 상대에게 필요한 것이 조언인지 공감인지 먼저 물어봐요.'],
  칠살: ['필요한 결정을 분명히 내리고 독립적으로 실행하는 쪽이에요.', '속도를 낸 뒤에는 점검할 날짜와 주변에 공유할 내용을 붙여요.'],
  파군: ['쓰임이 다한 방식을 정리하고 다른 구조를 시험하는 변화의 역할이에요.', '전부 바꾸기 전에 유지할 기반과 되돌릴 수 있는 실험을 나눠요.'],
};
const STEM_NAMES = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
const BRANCH_NAMES = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
const TEN_GODS = {
  比肩: ['비견', '나와 같은 음양·오행', '내 방식으로 결정하고 동료와 나란히 힘을 보태는 태도예요. 함께하는 일에서는 각자 맡을 범위까지 정해 두면 좋아요.'],
  劫财: ['겁재', '같은 오행·다른 음양', '사람들과 자원을 모아 판을 넓히는 대신 비교나 경쟁도 생길 수 있어요. 돈·시간·성과를 어떻게 나눌지 먼저 약속하는 쪽을 생각해요.'],
  食神: ['식신', '내가 생하는 오행·같은 음양', '익힌 기술을 꾸준히 써서 먹을 것, 작품, 서비스처럼 손에 잡히는 결과를 만들어요. 잘하는 일을 무리 없는 속도로 반복하는 데 초점을 둬요.'],
  伤官: ['상관', '내가 생하는 오행·다른 음양', '당연하게 하던 방식에 질문을 던지고 자기 언어로 새 답을 내놓아요. 날카로운 아이디어를 전달할 때는 상대가 들을 준비가 됐는지도 챙겨요.'],
  偏财: ['편재', '내가 극하는 오행·같은 음양', '바깥의 기회를 발견하고 사람·정보·자원을 연결해 활용해요. 여러 일을 벌일 때는 지금 감당할 규모와 손을 뗄 기준을 함께 정해요.'],
  正财: ['정재', '내가 극하는 오행·다른 음양', '정해진 수입과 지출, 시간과 약속을 꼼꼼히 관리하는 쪽이에요. 작은 성과를 쌓되 계획 밖의 변화에 쓸 여유도 남겨 둬요.'],
  七杀: ['편관·칠살', '나를 극하는 오행·같은 음양', '부담이 큰 과제 앞에서 결단하고 버텨 내는 힘을 떠올려요. 도전할 일과 혼자 감당하지 않아도 될 압박을 구분하는 것이 핵심이에요.'],
  正官: ['정관', '나를 극하는 오행·다른 음양', '규칙과 약속을 지키며 맡은 역할을 책임 있게 수행해요. 기대에 맞추는 일만큼 내 한계를 설명하고 도움을 요청하는 일도 중요해요.'],
  偏印: ['편인', '나를 생하는 오행·같은 음양', '익숙한 정답 대신 혼자 탐구하거나 낯선 분야를 연결해 이해해요. 깊게 파고든 생각을 실제로 써 보거나 다른 사람에게 설명하는 단계까지 이어 봐요.'],
  正印: ['정인', '나를 생하는 오행·다른 음양', '배움과 돌봄, 믿을 만한 조언을 받아 기반을 다지는 쪽이에요. 충분히 준비했다면 배운 것을 내 판단으로 적용할 작은 기회를 만들어요.'],
};
const CYCLE_THEMES = {
  比肩: ['자율성과 협력', '독립적으로 정할 일과 함께할 일을 나눠요.'],
  劫财: ['공동 자원과 경쟁', '함께 쓸 시간·비용의 기준을 먼저 정해요.'],
  食神: ['꾸준한 생산과 돌봄', '편하게 반복할 작업과 생활 습관을 만들어요.'],
  伤官: ['표현과 개선', '바꾸고 싶은 점을 설득할 언어를 준비해요.'],
  偏财: ['외부 기회와 자원 활용', '새 선택지를 살피되 감당할 범위를 정해요.'],
  正财: ['생활 자원과 관리', '계획·예산·시간표를 현실에 맞게 조정해요.'],
  七杀: ['도전과 부담 조절', '도전의 크기와 도움받을 지점을 확인해요.'],
  正官: ['책임과 약속', '맡은 역할과 지킬 수 있는 기준을 분명히 해요.'],
  偏印: ['탐구와 관점 전환', '새로 배운 생각을 작은 실험에 적용해요.'],
  正印: ['배움과 기반 다지기', '필요한 공부와 회복 시간을 확보해요.'],
};
const TRADITIONAL_CHARS = { 財: '财', 傷: '伤', 殺: '杀' };
const STAGES = { 长生: '장생', 沐浴: '목욕', 冠带: '관대', 临官: '건록·임관', 帝旺: '제왕', 衰: '쇠', 病: '병', 死: '사', 墓: '묘', 绝: '절', 胎: '태', 养: '양' };
const NAYIN = { 海中金: '해중금', 炉中火: '노중화', 大林木: '대림목', 路旁土: '노방토', 剑锋金: '검봉금', 山头火: '산두화', 涧下水: '간하수', 城头土: '성두토', 白蜡金: '백랍금', 杨柳木: '양류목', 泉中水: '천중수', 屋上土: '옥상토', 霹雳火: '벽력화', 松柏木: '송백목', 长流水: '장류수', 沙中金: '사중금', 山下火: '산하화', 平地木: '평지목', 壁上土: '벽상토', 金箔金: '금박금', 覆灯火: '복등화', 天河水: '천하수', 大驿土: '대역토', 钗钏金: '채천금', 桑柘木: '상자목', 大溪水: '대계수', 沙中土: '사중토', 天上火: '천상화', 石榴木: '석류목', 大海水: '대해수' };
const PALACE_TOPICS = {
  명궁: '나를 바라보는 출발점과 기본적인 반응', 형제: '형제·또래와 주고받는 관계', 부처: '배우자·가까운 동반자와의 관계', 자녀: '자녀·후배를 돌보고 무언가를 길러 내는 관계',
  재백: '돈과 자원을 다루는 방식', 질액: '몸과 생활 리듬이라는 전통 주제', 천이: '외부 환경과 새로운 자리에서의 활동', 노복: '친구·동료와 맺는 협력 관계',
  관록: '일과 사회적인 역할', 전택: '머무는 공간과 생활의 기반', 복덕: '내면의 만족과 쉬는 방식', 부모: '부모·윗세대와 주고받는 관계',
};
const BRIGHTNESS = { '[+3]': '묘(廟)', '[+2]': '왕(旺)', '[+1]': '득(得)', '[0]': '리(利)', '[-1]': '평(平)', '[-2]': '불(不)', '[-3]': '함(陷)' };
const MUTAGENS = { 록: ['화록(化祿)', '관심·기회·만족을 넓히는 상징'], 권: ['화권(化權)', '주도권과 실행을 강조하는 상징'], 과: ['화과(化科)', '정리·학습·드러나는 평가를 강조하는 상징'], 기: ['화기(化忌)', '마음이 걸리거나 반복해서 점검하는 주제를 나타내는 상징'] };
const COMMON_NOTES = [
  '계산 근거는 입력으로 얻은 기호·명반 정보이고, 일상 설명과 질문은 SAI가 직접 쓴 자기 성찰용 상징 문안입니다.',
  '상징은 실제 성격·능력·관계·미래를 확정하지 않습니다. 맞지 않는 설명은 받아들이지 않아도 됩니다.',
  '화면의 네 글자 스타일은 자체 연결표의 결과이며 정식 MBTI 검사나 과학적 성격 측정이 아닙니다.',
];
const text = (value) => typeof value === 'string' ? value.trim() : '';
const strings = (value) => Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [];
const unique = (values) => [...new Set(values)];
const pillarPattern = /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/;
const section = (id, title, description, items) => ({ id, title, text: description, items });
const normalizeTenGod = (value) => text(value).replace(/[財傷殺]/g, (character) => TRADITIONAL_CHARS[character]);
const hasTenGod = (value) => Object.hasOwn(TEN_GODS, normalizeTenGod(value));
const tenGod = (value) => text(value) === '日主' ? '일간·나(日主)' : hasTenGod(value) ? `${TEN_GODS[normalizeTenGod(value)][0]}(${text(value)})` : text(value) || '미확인';
const namedGlyph = (value, names) => {
  const original = text(value);
  if (names[original]) return `${names[original]}(${original})`;
  const entry = Object.entries(names).find(([, name]) => name === original);
  return entry ? `${original}(${entry[0]})` : original || '미확인';
};
const stemLabel = (value) => namedGlyph(value, STEM_NAMES);
const branchLabel = (value) => namedGlyph(value, BRANCH_NAMES);
const tableSection = (id, title, description, caption, headers, rows, items = []) => ({ ...section(id, title, description, items), table: { caption, headers, rows } });
const palaceName = (value) => text(value) === '명궁' ? '명궁' : `${text(value)}궁`;
const palaceLocation = (palace) => `${stemLabel(palace?.heavenlyStem)} · ${branchLabel(palace?.earthlyBranch)}`;
const validStars = (value) => Array.isArray(value) ? value.filter((star) => text(star?.name)) : [];
const starLabel = (star) => `${star.name}${text(star.brightness) ? ` · ${BRIGHTNESS[star.brightness] || star.brightness}${BRIGHTNESS[star.brightness] ? ` ${star.brightness}` : ''}` : ''}${text(star.mutagen) ? ` · ${MUTAGENS[star.mutagen]?.[0] || star.mutagen}` : ''}`;

function zodiacSections(result) {
  const details = result.calculation?.details ?? {};
  const chart = result.chart ?? {};
  const detailSign = text(details.sign), chartSign = text(chart.name);
  const candidate = detailSign || chartSign;
  const expected = getZodiacProfile(candidate);
  const consistent = (!detailSign || !chartSign || detailSign === chartSign)
    && (!expected || (!text(chart.element) || chart.element === expected.element) && (!text(chart.modality) || chart.modality === expected.modality));
  const sign = consistent ? candidate : '';
  const story = SIGN_STORIES[sign];
  const profile = getZodiacProfile(sign);
  const facts = [];
  if (text(details.solarDate)) facts.push(`계산에 사용한 양력 날짜: ${details.solarDate}`);
  if (sign) facts.push(`계산된 별자리: ${sign}${text(details.dateRange) ? ` · 관용 날짜 범위 ${details.dateRange}` : ''}`);
  else facts.push(consistent ? '계산 결과에 별자리 이름이 없어 특정 별자리를 채워 넣지 않았습니다.' : '별자리 세부 정보가 서로 달라 특정 별자리 해설을 표시하지 않았습니다.');
  if (consistent && ZODIAC_ELEMENTS[chart.element]) facts.push(`계산표의 원소: ${chart.element}`);
  if (consistent && MODALITY_STORIES[chart.modality]) facts.push(`계산표의 양상: ${chart.modality}`);
  const symbols = [];
  if (story) symbols.push(`핵심 장면 · ${story[0].replace(/ 이미지$/, '')}.`);
  else symbols.push('별자리 이름을 확인할 수 없어 맞춤 풀이를 표시하지 않았어요.');
  if (consistent && ZODIAC_ELEMENTS[chart.element]) symbols.push(`${chart.element} 원소 · ${ZODIAC_ELEMENTS[chart.element].replace(/ 장면$/, '')}에 관심을 두는 분류예요.`);
  if (consistent && MODALITY_STORIES[chart.modality]) symbols.push(`${chart.modality} · ‘${MODALITY_STORIES[chart.modality]}’가 행동의 리듬을 이해하는 열쇠예요.`);
  const sections = [section('symbols', '이 별자리의 기본 결', profile ? '원소는 관심의 방향, 양상은 움직이는 방식을 설명해요.' : '', symbols)];
  if (profile) sections.push(
    tableSection('zodiac-chart', '별자리 기본표', '생일로 확인한 태양궁 분류와 그에 연결되는 전통 상징을 나누어 보세요.', `${sign}의 기본 분류`, ['항목', '내용'], [
      ['태양궁', sign], ['관용 날짜 범위', text(details.dateRange) || '미확인'], ['원소', profile.element], ['양상', profile.modality], ['수호성 상징', profile.ruler],
    ]),
    section('strengths', '강점으로 읽는 모습', '', profile.strengths),
    section('cautions', '과해질 때 살펴볼 점', '', profile.cautions),
    section('relationships', '관계와 소통에서는', '', profile.relationships),
    section('work', '일하고 배우는 방식', '', profile.work),
  );
  sections.push(section('calculation', '계산 근거', '이미 계산된 태양궁 관용 날짜표의 결과를 읽었습니다. 실제 태양의 황경을 새로 계산하지 않습니다. 달 별자리·상승궁·행성 배치와 각도는 계산하지 않았습니다.', facts),
    section('reflection', '자기 성찰 질문', '내 경험과 닮은 부분과 다른 부분을 함께 떠올려 보세요.',
      [profile?.balance || story?.[1] || '요즘 나의 관심을 가장 오래 붙잡는 경험은 무엇인가요?', '이 설명과 닮은 부분, 닮지 않은 부분을 각각 하나씩 떠올린다면 무엇인가요?']));
  return {
    label: sign ? `${sign} 상징 이야기` : '별자리 계산 정보 확인',
    intro: profile?.summary || '먼저 계산된 별자리를 확인한 뒤, 내 경험과 연결되는 상징을 읽어 보세요.',
    notes: ['태양궁 하나로 궁합이나 직업 적성을 판정하지 않습니다. 이 화면은 고정된 관용 날짜표를 사용하므로 경계일의 실제 태양궁과 다를 수 있습니다.'],
    sections,
  };
}

function validWallStamp(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(text(value));
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return year >= 1900 && year <= 2999 && date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day && date.getUTCHours() === hour && date.getUTCMinutes() === minute && date.getUTCSeconds() === second;
}
const cycleKey = (item) => item ? [item.index, item.ganZhi, item.startSolar, item.endSolarExclusive].join('|') : '';
const sameCycle = (left, right) => left == null || right == null ? left == null && right == null
  : ['index', 'ganZhi', 'stem', 'branch', 'elements', 'hiddenStems', 'stemTenGod', 'branchTenGods', 'startSolar', 'endSolarExclusive', 'startYear', 'endYear', 'startAge', 'endAge']
    .every((key) => JSON.stringify(left[key]) === JSON.stringify(right[key]));
const cycleGanZhi = (item) => `${STEM_NAMES[item.stem]}${BRANCH_NAMES[item.branch]}(${item.ganZhi})`;
const cyclePeriod = (item) => `${item.startSolar}\n~ ${item.endSolarExclusive} 직전`;
const cycleRelationships = (item) => strings(item.hiddenStems).map((stem, index) => `${stemLabel(stem)} · ${tenGod(item.branchTenGods[index])}`).join('\n');
const cycleThemes = (item) => unique([item.stemTenGod, ...strings(item.branchTenGods)].map(normalizeTenGod)
  .map((key) => Object.hasOwn(CYCLE_THEMES, key) ? CYCLE_THEMES[key][0] : null).filter(Boolean));
function validCycleSymbol(item) {
  return pillarPattern.test(text(item?.ganZhi)) && item.stem === [...item.ganZhi][0] && item.branch === [...item.ganZhi][1]
    && Array.isArray(item.elements) && item.elements.length === 2 && item.elements.every((element) => Object.hasOwn(ELEMENT_STORIES, element))
    && Array.isArray(item.hiddenStems) && item.hiddenStems.length > 0 && item.hiddenStems.every((stem) => Object.hasOwn(STEM_NAMES, stem))
    && hasTenGod(item.stemTenGod) && Array.isArray(item.branchTenGods)
    && item.branchTenGods.length === item.hiddenStems.length && item.branchTenGods.every(hasTenGod)
    && validWallStamp(item.startSolar) && validWallStamp(item.endSolarExclusive) && item.startSolar < item.endSolarExclusive;
}
function sajuCycleSections(result, day, details) {
  const cycles = result.chart?.cycles;
  const corrected = sajuTimeCorrectionDisplay(result)?.applied === true;
  const correctionClockMatches = corrected ? cycles?.solarTimeZone === 'UTC+08:00' : cycles?.solarTimeZone == null;
  if (!cycles || !day || cycles.dayStem !== day.stem.hanja || !validWallStamp(cycles.asOf) || !correctionClockMatches) return {
    sections: [section('saju-cycles', '대운·세운 정보 확인', '', ['주기 자료가 없거나 원국의 일간과 일치하지 않아 대운·세운을 표시하지 않았어요.'])], facts: [], notes: [],
  };
  const timeZone = corrected ? 'UTC+08:00' : 'Asia/Seoul';
  const sections = [], facts = [`대운·세운 기준 시각: ${cycles.asOf} (${timeZone})`, ...strings(cycles.rules)];
  const notes = strings(cycles.limitations);
  const daYun = cycles.daYun ?? {}, annual = cycles.liuNian ?? {};
  const list = Array.isArray(daYun.list) ? daYun.list : [];
  const expectedCurrent = list.find((item) => text(item?.startSolar) <= cycles.asOf && cycles.asOf < text(item?.endSolarExclusive)) || null;
  const expectedNext = list.find((item) => text(item?.startSolar) > cycles.asOf) || null;
  const daYunValid = daYun.status === 'available' && details.birthTimeKnown === true && ['forward', 'backward'].includes(daYun.direction)
    && list.length >= 9 && list.length <= 19 && validWallStamp(daYun.startSolar) && list[0]?.startSolar === daYun.startSolar
    && list.every((item, index) => validCycleSymbol(item) && item.index === index + 1
      && [item.startYear, item.endYear, item.startAge, item.endAge].every(Number.isInteger)
      && item.startAge > 0 && item.endAge === item.startAge + 9 && item.endYear === item.startYear + 9
      && Number(item.startSolar.slice(0, 4)) === item.startYear
      && Number(item.endSolarExclusive.slice(0, 4)) === item.startYear + 10
      && (!index || list[index - 1].endSolarExclusive === item.startSolar))
    && sameCycle(daYun.current, expectedCurrent) && sameCycle(daYun.next, expectedNext);
  if (daYunValid) {
    const flow = [];
    for (const [label, item] of [['현재 대운', daYun.current], ['다음 대운', daYun.next]]) {
      if (item) flow.push(`${label} · ${cycleGanZhi(item)}\n${cyclePeriod(item)}\n천간 십성 ${tenGod(item.stemTenGod)} · ${CYCLE_THEMES[normalizeTenGod(item.stemTenGod)][0]}. ${CYCLE_THEMES[normalizeTenGod(item.stemTenGod)][1]} 지장간에서는 ${unique(item.branchTenGods.map((god) => tenGod(god))).join(' · ')}도 함께 살펴요.`);
    }
    if (daYun.current === null) flow.unshift(cycles.asOf < list[0].startSolar ? '아직 첫 대운이 시작되기 전이에요. 아래 다음 대운은 실제 기운일부터 적용되는 구간이에요.' : '기준 시각이 제공된 대운 목록 밖이어서 현재 대운을 연장해 만들지 않았어요.');
    if (daYun.next === null) flow.push('목록 안에 다음 대운이 없어 다음 간지를 추정하지 않았어요.');
    const offset = daYun.startOffset;
    if (offset && ['years', 'months', 'days', 'hours'].every((key) => Number.isInteger(offset[key]) && offset[key] >= 0)) facts.push(`엔진의 기운 환산: 출생 후 ${offset.years}년 ${offset.months}개월 ${offset.days}일 ${offset.hours}시간 · 첫 기운일 ${daYun.startSolar}`);
    if (text(daYun.ageConvention)) facts.push(daYun.ageConvention);
    sections.push(section('saju-cycle-flow', '현재와 다음 대운을 읽는 순서', `${cycles.asOf} 기준 (${timeZone}).\n대운은 약 10년 단위의 간지 흐름이에요. 이 표는 ${daYun.direction === 'forward' ? '순행' : '역행'}하며, 첫 기운일은 ${daYun.startSolar}예요. 먼저 천간의 주제를 보고 지장간의 관계를 덧붙여 읽어요.`, flow));
    sections.push(tableSection('saju-da-yun', '전체 대운표', '교운 기간은 시작 시각부터 끝 시각 직전까지예요. 명목 나이는 출생 연도를 1로 센 엔진 표기이며 만 나이가 아니에요.',
      `엔진이 반환한 ${list.length}개 대운 · 엔진의 교운 시각 기준`, ['순서', '대운 · 오행', '교운 기간', '명목 나이', '천간 십성', '지장간 · 십성'], list.map((item) => [
        `${item.index}대운${cycleKey(item) === cycleKey(daYun.current) ? ' · 현재' : cycleKey(item) === cycleKey(daYun.next) ? ' · 다음' : ''}`,
        `${cycleGanZhi(item)}\n${item.elements.join(' · ')}`, cyclePeriod(item), `${item.startAge}~${item.endAge}세`, tenGod(item.stemTenGod), cycleRelationships(item),
      ])));
  } else sections.push(section('saju-da-yun', '대운 정보 확인', '', [daYun.status === 'missing-input'
    ? '대운을 보려면 태어난 시각과 전통 계산용 성별이 모두 필요해요. 모르는 값은 채우지 않았어요.'
    : '대운의 일간·간지·교운 기간을 모두 확인하지 못해 대운표를 표시하지 않았어요.']));
  const years = Array.isArray(annual.years) ? annual.years : [];
  const annualValid = annual.status === 'available' && annual.yearBoundary === 'lichun' && Number.isInteger(annual.currentYear) && years.length === 5
    && years.every((item, index) => validCycleSymbol(item) && item.year === annual.currentYear + index && item.isCurrent === (index === 0)
      && Number(item.startSolar.slice(0, 4)) === item.year && Number(item.endSolarExclusive.slice(0, 4)) === item.year + 1
      && (!index || years[index - 1].endSolarExclusive === item.startSolar))
    && years[0].startSolar <= cycles.asOf && cycles.asOf < years[0].endSolarExclusive;
  if (annualValid) {
    sections.push(tableSection('saju-liu-nian', '입춘 기준 앞으로 5년의 세운', `세운은 1월 1일이 아니라 입춘에 바뀌어요. 기준 시각에 해당하는 ${annual.currentYear}년 간지부터 다섯 구간을 표시했어요. 천간은 큰 주제, 지장간은 함께 볼 세부 관계로 구분해요.`,
      `${daYunValid ? '' : `${cycles.asOf} 기준 (${timeZone}) · `}현재 입춘 연도와 이후 네 해 · 끝 시각은 포함하지 않음`, ['입춘 연도', '세운 · 오행', '적용 기간', '천간 · 지장간 십성', '살펴볼 주제'], years.map((item) => [
        `${item.year}년${item.isCurrent ? ' · 현재' : ''}`, `${cycleGanZhi(item)}\n${item.elements.join(' · ')}`, cyclePeriod(item),
        `천간 ${tenGod(item.stemTenGod)}\n${cycleRelationships(item)}`, cycleThemes(item).join(' / '),
      ]), years.map((item) => `${item.year}년${item.isCurrent ? ' · 현재' : ''} · ${cycleGanZhi(item)}\n${CYCLE_THEMES[normalizeTenGod(item.stemTenGod)][1]}`)));
  } else sections.push(section('saju-liu-nian', '세운 정보 확인', '', ['입춘 경계와 연간 자료를 확인하지 못해 세운표를 표시하지 않았어요.']));
  return { sections, facts, notes, data: { asOf: cycles.asOf, timeZone, daYun: daYunValid ? daYun : null, annual: annualValid ? annual : null } };
}

function sajuProfessionalSections(result, day, details) {
  const raw = Array.isArray(result.chart?.pillars) ? result.chart.pillars : [];
  const keys = ['year', 'month', 'day', ...(details.birthTimeKnown === true ? ['time'] : [])];
  const pillars = keys.map((key) => raw.find((item) => item?.key === key));
  const reliable = Boolean(day) && keys.every((key, index) => raw.filter((item) => item?.key === key).length === 1
    && pillarPattern.test(text(pillars[index]?.ganZhi)) && details.pillars?.[key] === pillars[index].ganZhi
    && pillars[index].stem === [...pillars[index].ganZhi][0] && pillars[index].branch === [...pillars[index].ganZhi][1]);
  if (!reliable) return [section('saju-chart', '사주 원국표 확인', '기둥의 원문이 일치할 때만 만세력 항목을 펼칩니다.', ['사주 원국의 세부 정보가 없거나 서로 일치하지 않아 표를 추정하지 않았습니다.'])];
  const column = (callback) => pillars.map(callback);
  const chart = tableSection('saju-chart', '나의 사주 원국표', details.birthTimeKnown === true ? '태어난 연·월·일·시의 기둥과 실제 계산된 만세력 항목이에요. 일간을 기준으로 다른 글자와의 관계를 읽어요.' : '생시를 몰라 연·월·일의 세 기둥만 표시해요. 시주를 임의로 채우지 않았어요.',
    '입력한 출생 정보로 계산한 사주 원국', ['항목', ...column((pillar) => pillar.label)], [
      ['천간', ...column((pillar) => stemLabel(pillar.stem))],
      ['천간 십성', ...column((pillar) => tenGod(pillar.stemTenGod))],
      ['지지', ...column((pillar) => branchLabel(pillar.branch))],
      ['지장간', ...column((pillar) => strings(pillar.hiddenStems).map(stemLabel).join(' · ') || '미확인')],
      ['지장간 십성', ...column((pillar) => strings(pillar.branchTenGods).map(tenGod).join(' · ') || '미확인')],
      ['십이운성', ...column((pillar) => text(pillar.growthStage) ? `${STAGES[pillar.growthStage] || pillar.growthStage}(${pillar.growthStage})` : '미확인')],
      ['납음', ...column((pillar) => text(pillar.naYin) ? `${NAYIN[pillar.naYin] ? `${NAYIN[pillar.naYin]} · ` : ''}${pillar.naYin}` : '미확인')],
      ['공망', ...column((pillar) => text(pillar.voidBranches) ? [...pillar.voidBranches].map(branchLabel).join(' · ') : '미확인')],
    ]);
  const tenGodKeys = unique(pillars.flatMap((pillar) => [pillar.stemTenGod, ...strings(pillar.branchTenGods)])
    .map(normalizeTenGod).filter(hasTenGod));
  const tenGodItems = tenGodKeys.map((key) => {
    const [name, , everyday] = TEN_GODS[key];
    return `${name}(${key}) · ${everyday}`;
  });
  const literalCounts = Object.fromEntries(Object.keys(ELEMENT_STORIES).map((key) => [key, 0]));
  const literalValid = pillars.every((pillar) => Array.isArray(pillar.elements) && pillar.elements.length === 2
    && pillar.elements.every((element) => Object.hasOwn(literalCounts, element)));
  if (literalValid) for (const pillar of pillars) for (const element of pillar.elements) literalCounts[element]++;
  const weighted = Array.isArray(result.chart?.elements) ? result.chart.elements : [];
  const elementTable = tableSection('saju-elements', '오행은 두 가지 수치를 나누어 봐요',
    '본오행 글자 수는 겉에 보이는 천간·지지를 센 값이에요. SAI 연결 가중치는 여기에 일간을 한 번 더 센 별도의 표시예요. 둘 다 계절·지장간·합충까지 반영한 강약이나 용신 판정은 아니에요.',
    '본오행 글자 수와 SAI 연결 가중치', ['오행', '본오행 글자 수', 'SAI 연결 가중치'], Object.keys(ELEMENT_STORIES).map((label) => {
      const item = weighted.find((entry) => entry?.label === label && Number.isInteger(entry.count) && entry.count >= 0);
      return [label, literalValid ? String(literalCounts[label]) : '미확인', item ? String(item.count) : '미확인'];
    }));
  return [chart,
    section('saju-reading-order', '처음 볼 때는 이렇게 읽어요', '표 전체를 외우기보다 기준이 되는 글자부터 차례로 살펴보세요.', [
      `먼저 일간 항목을 찾아보세요: ${stemLabel(day.stem.hanja)}. 사주에서 다른 기운과의 관계를 비교하는 기준이에요.`,
      '연주는 출생해의 기둥, 월주는 절기를 기준으로 정한 달의 기둥, 일주는 출생일의 기둥이에요. 달력의 월 숫자와 월주가 꼭 같은 날 바뀌는 것은 아니에요.',
      details.birthTimeKnown === true ? '시주는 입력 시각이 속한 전통적인 두 시간 구간의 기둥이에요. 표의 시주도 다른 기둥과 함께 비교해 보세요.' : '생시 미상인 경우 시주의 해석은 건너뛰어요. 절기가 바뀌는 날짜라면 연주·월주의 경계도 확인이 필요해요.',
    ]),
    section('saju-ten-gods', '내 표에 있는 십성을 쉽게 읽기', '십성은 일간과 다른 글자의 오행·음양 관계를 열 가지로 나눈 이름이에요. 비겁은 나와 같은 오행, 식상은 내가 생하는 쪽, 재성은 내가 극하는 쪽, 관성은 나를 극하는 쪽, 인성은 나를 생하는 쪽이에요. 아래에는 내 표에 실제로 나온 십성만 모았어요.', tenGodItems.length ? tenGodItems : ['확인된 십성 자료가 없어 관계 이름을 임의로 채우지 않았어요.']),
    elementTable,
    section('saju-terms', '낯선 만세력 용어 풀이', '표에 나타난 이름을 이해하는 참고 설명이에요.', [
      '지장간은 지지 안에 담긴 천간을 뜻해요. 지장간 십성은 그 천간 하나하나를 일간과 비교한 관계이며, 표에서는 같은 순서로 읽으면 돼요.',
      '십이운성은 장생·목욕·관대·건록·제왕 등 열두 단계로 기운의 상태를 비유한 전통 분류예요. 병·사·묘·절 같은 이름을 실제 질병·죽음·수명으로 읽지 않아요.',
      '납음은 두 글자의 조합을 육십갑자 체계로 다시 분류한 이름이에요. 천간·지지의 본오행과 다른 분류이므로 오행 수에 더하지 않았어요.',
      '공망은 순(旬)의 배열에서 비는 지지를 표시하는 보조 분류예요. 이 이름 하나로 관계·재물·인생의 좋고 나쁨을 단정하지 않아요.',
    ]),
  ];
}

function sajuSections(result, input) {
  const details = result.calculation?.details ?? {};
  const correction = sajuTimeCorrectionDisplay(result);
  const day = describeDayPillar(result);
  const pillars = details.pillars ?? {};
  const facts = [];
  if (text(details.solarDate)) facts.push(`${correction?.applied ? '원래 출생일의 양력 날짜' : '계산에 사용한 양력 날짜'}: ${details.solarDate}`);
  if (correction && (correction.applied || result.chart?.timeCorrection?.method === 'local-mean-solar')) facts.push(correction.summary, ...correction.items);
  if (day) facts.push(`실제 일주: ${day.label}`, `일간(하늘 기호): ${day.stem.name}(${day.stem.hanja}) · ${day.stem.element}(${day.stem.elementHanja})`,
    `일지(땅 기호): ${day.branch.name}(${day.branch.hanja}) · ${day.branch.element}(${day.branch.elementHanja})`);
  else facts.push('일주 세부 정보가 없거나 서로 일치하지 않아 일간·일지를 추정하지 않았습니다.');
  const otherPillars = [['year', '연주'], ['month', '월주']].filter(([key]) => pillarPattern.test(text(pillars[key])))
    .map(([key, label]) => `${label} ${pillars[key]}`);
  if (otherPillars.length) facts.push(`함께 계산된 기둥: ${otherPillars.join(' · ')}`);
  if (details.birthTimeKnown === false) facts.push('생시 미상: 정오를 일주 계산 기준으로만 사용했고 시주·시주 오행은 포함하지 않았습니다. 절입 당일의 연주·월주 경계에는 불확실성이 있습니다.');
  else if (details.birthTimeKnown === true) {
    const suppliedTime = input?.mode === 'saju' && /^\d{2}:\d{2}$/.test(text(input.birthTime)) ? `입력 시각 ${input.birthTime} · ` : '';
    facts.push(`${suppliedTime}${pillarPattern.test(text(pillars.time)) ? `계산된 시주(${pillars.time})를 포함했습니다.` : '생시 입력은 확인되지만 결과에 시주가 없어 시주 이름을 표시하지 않았습니다.'}`);
  } else facts.push('결과에 생시 반영 여부가 없어 시주 포함 여부를 추정하지 않았습니다.');
  const rawElements = Array.isArray(result.chart?.elements) ? result.chart.elements : details.elements;
  const elements = Array.isArray(rawElements) ? rawElements.filter((item) => ELEMENT_STORIES[item?.label]
    && Number.isInteger(item.count) && item.count >= 0) : [];
  if (elements.length) facts.push(`결과의 오행 가중치: ${elements.map((item) => `${item.label} ${item.count}`).join(' · ')}`,
    '천간·지지의 본오행 각 1회와 일간 추가 1회를 반영한 자체 가중치입니다. 사주의 강약·용신·부족한 성격을 뜻하지 않습니다.');
  else facts.push('결과에 오행 수치가 없어 임의의 비율이나 우세 오행을 만들지 않았습니다.');
  const professional = sajuProfessionalSections(result, day, details);
  const cycles = sajuCycleSections(result, professional[0]?.table ? day : null, details);
  const reportKeys = ['year', 'month', 'day', ...(details.birthTimeKnown === true ? ['time'] : [])];
  const report = buildSajuReport({ day, pillars: professional[0]?.table ? reportKeys.map((key) => result.chart.pillars.find((pillar) => pillar.key === key)) : [], professional, cycles,
    format: { stem: stemLabel, branch: branchLabel, tenGod, cycleGanZhi, cyclePeriod } });
  return {
    label: day ? `${day.label} 상징 이야기` : '사주 계산 정보 확인',
    intro: day ? `${day.label}의 일간과 실제 십성 배치를 바탕으로, 어떤 성향이 도출됐고 그 이유가 무엇인지 설명하는 보고서입니다. 기본 기질과 분야별 강점·주의점을 구분하고, 대운·세운은 원국과 별도의 시기 구조로 설명합니다.` : '일주 자료가 확인되지 않아 기본 기질과 분야별 성향을 도출하지 않았습니다.',
    notes: [`${correction?.policy || SAJU_UNCORRECTED} 용신·격국·신강신약 및 대운·세운의 길흉을 판정하지 않았으며, 입력하지 않은 정보를 추정하지 않습니다.`, ...cycles.notes],
    sections: [...report,
      section('calculation', '계산 근거', '원국과 주기 표는 엔진의 실제 반환값을 읽었습니다. 생활 주제는 십성의 전통 관계를 쉽게 옮긴 문안이며 길흉을 계산한 점수가 아닙니다.', [...facts, ...cycles.facts]),
      section('reflection', '성향 해석의 연결 기준', day ? `${day.label}에서 일간 ${stemLabel(day.stem.hanja)}은 자기 기질을 설명하는 기준이고, 일지 ${branchLabel(day.branch.hanja)}는 그 기질이 표현되는 배경으로 구분했습니다.` : '일주 정보가 확인되지 않은 부분은 성격 설명의 근거로 사용하지 않았습니다.', [
        '본문의 십성은 일간과 다른 글자의 생극·음양 관계입니다. 같은 관계도 직업에서는 일하는 방식, 가까운 관계에서는 감정과 경계를 다루는 방식으로 구분되므로 분야별 설명이 달라집니다.',
        '원국에서 도출한 기질과 대운·세운의 시기별 주제는 별도입니다. 특정 시기의 간지가 평생의 성격을 바꾸거나 실제 사건을 보장한다는 뜻은 아닙니다.',
        '강점과 주의점은 같은 특성이 서로 다른 조건에서 드러나는 양면입니다. 세심함이 완성도를 높이는 동시에 판단을 늦출 수 있듯, 한 기호를 장점이나 결점 하나로만 분류하지 않았습니다.',
      ])],
  };
}

function ziweiSections(result) {
  const details = result.calculation?.details ?? {};
  const chart = result.chart ?? {};
  const palace = chart.soulPalace;
  const chartOwn = Array.isArray(palace?.majorStars) ? palace.majorStars.map((star) => text(star?.name)).filter(Boolean) : null;
  const original = Array.isArray(details.originalMajorStars) ? strings(details.originalMajorStars) : chartOwn;
  const consistent = !chartOwn || !original || [...chartOwn].sort().join('|') === [...original].sort().join('|');
  const source = details.mappingSource;
  let stars = strings(details.majorStars);
  let sourceValid = consistent && ((source === 'soulPalace' && original?.length > 0)
    || (source === 'oppositePalace' && original?.length === 0));
  const rawPalaces = Array.isArray(chart.palaces) ? chart.palaces : [];
  const indexedPalaces = rawPalaces.filter((item) => Number.isInteger(item?.index) && item.index >= 0 && item.index < 12
    && Object.hasOwn(PALACE_TOPICS, text(item.name)) && Array.isArray(item.majorStars));
  const completePalaces = indexedPalaces.length === 12 && new Set(indexedPalaces.map((item) => item.index)).size === 12
    && new Set(indexedPalaces.map((item) => item.name)).size === 12;
  const actualOpposite = Number.isInteger(palace?.index) ? indexedPalaces.find((item) => item.index === (palace.index + 6) % 12) : null;
  if (source === 'oppositePalace' && actualOpposite
    && validStars(actualOpposite.majorStars).map((star) => star.name).sort().join('|') !== [...stars].sort().join('|')) sourceValid = false;
  if (!sourceValid) stars = [];
  if (source === 'soulPalace' && stars.some((star) => !original.includes(star))) stars = [];
  const listedSoul = Number.isInteger(palace?.index) ? indexedPalaces.find((item) => item.index === palace.index) : null;
  const chartReliable = sourceValid && stars.length > 0 && completePalaces && listedSoul?.name === '명궁'
    && listedSoul.heavenlyStem === palace.heavenlyStem && listedSoul.earthlyBranch === palace.earthlyBranch
    && validStars(listedSoul.majorStars).map((star) => star.name).sort().join('|') === [...(chartOwn || [])].sort().join('|');
  const facts = [];
  if (text(details.solarDate) || text(chart.solarDate)) facts.push(`계산에 사용한 양력 날짜: ${text(details.solarDate) || text(chart.solarDate)}`);
  if (palace && text(palace.heavenlyStem) && text(palace.earthlyBranch)) facts.push(`실제 명궁 위치: ${palace.heavenlyStem}${palace.earthlyBranch}`);
  if (text(chart.fiveElementsClass)) facts.push(`명반의 오행국: ${chart.fiveElementsClass}`);
  if (text(chart.lunarDate)) facts.push(`엔진의 음력 표기: ${chart.lunarDate}`);
  if (text(chart.time)) facts.push(`계산된 생시 구간: ${chart.time}${text(chart.timeRange) ? ` (${chart.timeRange})` : ''}`);
  if (!sourceValid || !stars.length) facts.push('명궁 주성 또는 실제 상징 연결 출처를 확인할 수 없어 별 이름과 공궁 여부를 추정하지 않았습니다.');
  else if (source === 'oppositePalace') facts.push('명궁의 실제 주성은 0개인 공궁입니다. 이 화면의 상징 연결에는 명궁 자체의 별이 아니라 대궁인 천이궁 주성을 차용했습니다.',
    `차용한 실제 천이궁 주성: ${stars.join(' · ')}`);
  else facts.push(`명궁의 실제 주성: ${original.join(' · ')}`, `상징 연결에 사용한 명궁 주성: ${stars.join(' · ')}`);
  const symbols = [];
  for (const star of stars) {
    const meaning = Array.isArray(details.mapping?.symbols) ? details.mapping.symbols.find((item) => item?.label === star) : null;
    if (text(meaning?.meaning)) symbols.push(`${star} · ${meaning.meaning}`);
    else if (STAR_SCENES[star]) symbols.push(`${star} · ${STAR_SCENES[star].replace(/ 장면$/, '')}`);
    else symbols.push(`${star} · 이름은 확인되지만 연결된 설명은 없어요.`);
  }
  if (!symbols.length) symbols.push('주성의 출처를 확인하지 못해 맞춤 해설을 표시하지 않았어요.');
  const sections = [section('symbols', source === 'oppositePalace' ? '천이궁에서 참고한 주성을 읽어요' : '명궁의 주성부터 읽어요',
    sourceValid && source === 'oppositePalace' ? '명궁에 주성이 없는 공궁이어서 실제 천이궁의 주성을 구분해 참고했어요.' : '먼저 별의 핵심어를 확인한 뒤 생활 속 행동으로 풀어 볼게요.', symbols)];
  const guides = stars.flatMap((star) => STAR_GUIDES[star] ? [`${star} · ${STAR_GUIDES[star][0]} ${STAR_GUIDES[star][1]}`] : []);
  if (guides.length) sections.push(section('ziwei-major-guides', '이 주성을 쉬운 말로 풀면', '', guides));
  if (chartReliable) {
    const palaces = [...indexedPalaces].sort((a, b) => a.index - b.index);
    const bodyPalaces = palaces.filter((item) => item.isBodyPalace === true);
    const identity = [
      `명궁은 이 명반에서 나를 읽는 출발점인 궁의 이름이에요. 위치는 ${palaceLocation(palace)}이고 실제 주성은 ${original.length ? original.join(' · ') : '없음(공궁)'}이에요.`,
      bodyPalaces.length === 1 ? `신궁은 활동과 삶의 관심이 드러나는 자리를 참고하는 별도의 표시예요. 이 명반에서는 ${palaceName(bodyPalaces[0].name)}(${palaceLocation(bodyPalaces[0])})에 겹쳐 있어요.` : '신궁의 표시가 하나로 확인되지 않아 위치를 임의로 정하지 않았어요.',
      `명주${text(chart.soul) ? `는 ${chart.soul}` : '는 미확인'}, 신주${text(chart.body) ? `는 ${chart.body}` : '는 미확인'}예요. 이 둘은 별에 붙는 지표 이름이며, 명궁·신궁이라는 궁의 위치나 그 궁의 주성과 같은 뜻은 아니에요.`,
      `오행국은 ${text(chart.fiveElementsClass) || '미확인'}이에요. 명반 배열과 운한 체계에서 쓰는 분류이지, 사주 오행의 많고 적음을 세는 표는 아니에요.`,
    ];
    sections.push(section('ziwei-identity', '명궁·신궁과 명주·신주는 달라요', '이름이 비슷하지만 서로 다른 자료이므로 구분해서 읽어요.', identity));
    sections.push(tableSection('ziwei-palaces', '나의 12궁 명반', '각 궁의 전통 주제와 실제 배치된 별을 한눈에 볼 수 있어요. 주성 없음은 그 궁에 주성이 없다는 뜻이지, 해당 삶의 영역이 없다는 뜻은 아니에요.',
      '실제 계산된 열두 궁과 별의 배치', ['궁 · 위치', '살펴보는 주제', '주성 · 밝기 · 사화', '보조성 · 잡요'], palaces.map((item) => [
        `${palaceName(item.name)}${item.isBodyPalace ? ' · 신궁' : ''}\n${palaceLocation(item)}`,
        PALACE_TOPICS[item.name], validStars(item.majorStars).map(starLabel).join('\n') || '주성 없음(공궁)',
        [...validStars(item.minorStars), ...validStars(item.adjectiveStars)].map(starLabel).join('\n') || '표시된 별 없음',
      ])));
    const related = [[0, '본궁'], [4, '삼합궁 1'], [8, '삼합궁 2'], [6, '대궁']].map(([offset, role]) => ({ role, palace: palaces.find((item) => item.index === (palace.index + offset) % 12) }));
    sections.push(tableSection('ziwei-related', '명궁의 삼방사정을 함께 봐요', '삼방사정은 명궁 하나만 보지 않고, 명궁·두 삼합궁·반대편 대궁을 함께 살피는 방식이에요. 아래 위치는 실제 명반의 순번으로 확인했어요.',
      '명궁과 실제로 연결된 네 궁', ['관계', '실제 궁', '주성'], related.map((item) => [item.role, `${palaceName(item.palace.name)} · ${palaceLocation(item.palace)}`, validStars(item.palace.majorStars).map((star) => star.name).join(' · ') || '주성 없음'])));
    const focus = ['명궁', '관록', '재백', '복덕'].map((name) => palaces.find((item) => item.name === name));
    const areaPrompts = {
      명궁: '여러 상황에서 내가 자주 맡는 역할은 무엇인지, 편할 때와 긴장할 때의 차이를 살펴봐요.',
      관록: '목표를 정하고 일을 끝내는 과정에서 어떤 방법이 잘 맞았는지 확인해요. 성과만큼 협업 방식도 중요해요.',
      재백: '시간·돈·물건을 어디에 쓰고 싶은지 우선순위를 적어 봐요. 실제 수입이나 재산의 크기를 뜻하는 표는 아니에요.',
      복덕: '일을 멈춘 뒤 무엇을 해야 마음이 편해지는지 찾아봐요. 남에게 보여 주는 성과와 나만의 만족은 다를 수 있어요.',
    };
    sections.push(section('ziwei-life-areas', '생활의 주제별로 연결해 읽기', '같은 별도 어느 궁에 놓였는지에 따라 살펴볼 질문이 달라져요.', focus.map((item) => {
      const own = validStars(item.majorStars);
      const simple = own.map((star) => STAR_SCENES[star.name]?.replace(/ 장면$/, '')).filter(Boolean);
      return `${palaceName(item.name)} · ${own.length ? own.map((star) => star.name).join('·') : '주성 없음(공궁)'}\n${simple.length ? `${simple.join(' / ')}에 초점을 둬요. ` : ''}${areaPrompts[item.name]}`;
    })));
    const transformations = palaces.flatMap((item) => [...validStars(item.majorStars), ...validStars(item.minorStars), ...validStars(item.adjectiveStars)]
      .filter((star) => text(star.mutagen)).map((star) => `${palaceName(item.name)} · ${star.name} · ${MUTAGENS[star.mutagen]?.[0] || star.mutagen}${MUTAGENS[star.mutagen] ? `: ${MUTAGENS[star.mutagen][1].replace(/ 상징$/, '')}` : ''}`));
    sections.push(section('ziwei-marks', '별 옆의 밝기와 사화 표시', '숫자와 이름을 좋고 나쁨의 총점으로 읽지 않고, 별의 표현 방식을 구분하는 전통 기호로 이해해요.', [
      '밝기는 묘[+3]·왕[+2]·득[+1]·리[0]·평[-1]·불[-2]·함[-3]으로 병기했어요. 천문학적으로 측정한 별의 광도가 아니며, 밝기 표는 유파마다 달라질 수 있어요.',
      ...transformations,
      '화기(化忌)는 불행이나 실패가 확정된다는 뜻이 아니에요. 이 화면에서는 마음이 걸리거나 반복해서 살펴보는 주제라는 상징으로 설명해요. 사화의 배치 규칙 역시 유파에 따라 달라요.',
    ]));
  } else sections.push(section('ziwei-palaces', '12궁 명반 정보 확인', '명궁의 출처와 열두 궁의 원문이 일치할 때만 상세 명반표를 표시해요.', ['열두 궁 자료가 없거나 명궁의 주성 출처가 서로 일치하지 않아 상세 배치를 추정하지 않았어요.']));
  sections.push(section('calculation', '계산 근거', '입력 정보로 이미 계산된 본명 명반을 읽었습니다. 다른 날짜의 운한이나 새로운 명반을 추가 계산하지 않습니다.', facts),
    section('reflection', '자기 성찰 질문', '별을 정답으로 삼기보다 실제 경험을 살펴보세요.', [
      stars.length ? `${stars.join('·')}에 연결한 생활 이미지 중 최근 내 경험과 닮은 장면이 있나요?` : '최근 내가 스스로 선택했다고 느낀 일은 무엇인가요?',
      '상황이 달라지면 나의 역할이나 반응도 어떻게 달라지나요?', '다른 사람과 나누고 싶은 관심사와, 아직 혼자 생각해 보고 싶은 이야기는 각각 무엇인가요?',
    ]));
  return {
    label: stars.length ? `${source === 'oppositePalace' ? '천이궁 차용' : '명궁'} ${stars.join('·')} 이야기` : '자미두수 명반 정보 확인',
    intro: stars.length ? `${stars.join('·')}의 성질을 먼저 이해하고, 12궁에서 일·관계·휴식의 주제로 넓혀 읽어 볼게요.` : '명궁에 어떤 별이 놓였는지부터 확인하며, 나의 경험을 천천히 돌아보세요.',
    sections,
    notes: ['본명 12궁·주성·보조성·잡요·밝기·사화 표기는 엔진의 실제 반환값입니다. 대운·유년·유월의 시기별 사건, 직업·건강·재산의 결과나 길흉을 판정하지 않았습니다.'],
  };
}

/** Editorial presentation only; calculation payload and zodiac copy stay intact. */
export function readingResultSummary(result) {
  const summary = text(result?.summary);
  if (!['saju', 'ziwei'].includes(result?.mode)) return summary;
  return summary.replace(/ 실제 나의 모습과 닮은 부분만 가볍게 골라 읽어 보세요\.$/u,
    result.mode === 'saju' ? ' 사주 원국의 상징을 성향으로 연결한 설명입니다.' : ' 실제 명반의 상징을 성향으로 연결한 설명입니다.');
}

/** @returns {{heading:string,mode:string,label:string,intro:string,sections:Array<{id:string,title:string,text:string,items:string[],paragraphs?:string[],groupLabel?:string,collapsible?:boolean,table?:{caption:string,headers:string[],rows:string[][]}}>,notes:string[]}} */
export function buildReadingDetail(result, input = null) {
  const mode = Object.hasOwn(MODES, result?.mode) ? result.mode : 'unknown';
  let content;
  if (mode === 'zodiac') content = zodiacSections(result);
  else if (mode === 'saju') content = sajuSections(result, input);
  else if (mode === 'ziwei') content = buildZiweiReport(result, input);
  else content = { label: '계산 결과 확인', sections: [
    section('calculation', '계산 근거', '먼저 성향 이야기를 계산하면 이곳에서 사용한 기호와 계산 범위를 확인할 수 있습니다.', ['아직 확인된 계산 결과가 없어 날짜·일주·별자리·명반을 추정하지 않았습니다.']),
    section('symbols', '일상에서 이해하는 상징', '결과가 있을 때 해당 기호에 맞는 생활 이미지를 보여 드립니다.', []),
    section('reflection', '자기 성찰 질문', '계산 결과가 없어도 스스로의 경험은 돌아볼 수 있습니다.', ['최근 나답다고 느낀 순간은 언제였나요?']),
  ] };
  const balance = mode === 'zodiac' && Array.isArray(result?.sections) ? result.sections.find((item) => item?.title === '균형을 위한 질문' && text(item.text)) : null;
  if (balance) content.sections = content.sections.map((item) => item.id === 'reflection'
    ? { ...item, title: '균형을 위한 질문', text: balance.text } : item);
  return { heading: '나에 대해 더 알아가는 시간', mode, ...content,
    intro: content.intro || '나와 닮은 부분만 골라 읽고 다른 부분은 편하게 지나쳐도 괜찮아요.',
    notes: unique([...(mode === 'ziwei' ? [] : COMMON_NOTES.map((note, index) => mode === 'saju' && index === 0 ? '계산 근거는 입력으로 얻은 기호·원국 정보이고, 성향 설명은 전통 상징의 관계를 바탕으로 SAI가 작성한 해석입니다.' : note)), ...strings(content.notes), ...strings(result?.uncertainty).filter((note) => mode !== 'ziwei' || !note.includes('정식 MBTI 검사'))]),
  };
}
