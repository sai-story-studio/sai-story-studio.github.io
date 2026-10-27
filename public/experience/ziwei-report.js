/** Local, deterministic editorial report over iztro's verified natal data.
 * The structure adapter owns validation, triad references and nominal-age
 * matching. This file never recalculates a chart or infers a visitor's life.
 * Core terms: docs.iztro.com/ko_KR/learn/{major-star,palace,mutagen,minor-star}.
 * The structural explanations and everyday examples are original SAI copy,
 * not claims that a natal symbol scientifically causes a person's character.
 */
import { buildZiweiStructure } from './ziwei-structure.js';

const GUIDANCE = '[해석 안내]\n이 해석은 사용자가 제공한 자미두수 명반과 전통 해석 체계에 따른 참고 관점입니다. 검증된 예측·의학적 진단·법률·투자 조언이 아닙니다.';
const FINAL = '이 해석은 전통 자미두수의 상징 체계에 따른 참고 관점이며, 중요한 현실 결정은 사실 정보와 전문 조언을 함께 검토해야 합니다.';
const TITLES = ['명반 총평', '성격·감정·행동 방식', '약점과 자기방해 패턴', '강점과 성장 자원', '직업·직장·사업', '돈·재물·생활 기반', '연애·결혼·가족·인간관계', '건강·생활 리듬·회복 방식', '현재 대운과 다음 전환', '해석 종합'];
// These are neutral symbolic lenses, not labels attached to a person's actual
// character. Each lens has distinct enabling conditions and observable costs.
const PROFILES = {
  자미: ['중심과 조율', '전체의 방향을 정하고 흩어진 역할을 모으는 힘', '책임의 범위와 각자의 권한이 분명한 환경', '일의 완성도를 지키려다 작은 결정까지 혼자 떠맡는 상태', '자미는 여러 역할을 하나의 중심에 묶는 상징입니다. 그래서 개별 성과보다 전체가 제자리를 찾는 데 의미를 두는 성향으로 해석합니다.', '조율하는 능력은 모든 일을 직접 처리하는 것과 다릅니다. 신뢰할 몫을 남길 때 중심을 잡는 힘과 타인의 자율성이 함께 살아납니다.'],
  천기: ['관찰과 설계', '서로 다른 정보를 연결해 더 나은 방법을 설계하는 힘', '새 정보를 반영하고 시제품을 수정할 여지가 있는 환경', '가능성을 계속 비교하느라 이미 가능한 선택도 늦어지는 상태', '천기는 변화하는 조건을 읽고 수단을 바꾸는 상징입니다. 정해진 절차를 반복하기보다 이유를 이해하고 방법을 개선하는 쪽에 관심을 두는 해석입니다.', '생각의 유연함이 강점인 만큼 완벽한 답을 기다리는 부담도 생깁니다. 모든 변수를 아는 상태보다 충분한 근거로 시작할 수 있는 조건에서 이 힘이 선명해집니다.'],
  태양: ['표현과 기여', '생각과 자원을 밖으로 드러내 주변의 참여를 이끄는 힘', '기여가 인정되고 도움도 주고받을 수 있는 환경', '필요한 사람이 되려다 자신의 여유까지 계속 내어주는 상태', '태양은 밖을 비추고 공적인 역할을 맡는 상징입니다. 혼자 만족하는 결과보다 타인에게 전달되고 쓰이는 결과에 의미를 두는 성향으로 연결합니다.', '적극적인 기여와 끝없는 책임은 같은 것이 아닙니다. 맡은 역할의 경계가 있을 때 표현의 힘이 소진보다 신뢰와 참여로 이어지는 해석입니다.'],
  무곡: ['실행과 관리', '자원과 기준을 구체화해 끝까지 결과를 쌓는 힘', '완료 조건과 투입할 자원이 명확한 환경', '정확성과 효율이 앞서 협업에 필요한 설명이 줄어드는 상태', '무곡은 실무와 관리의 상징입니다. 말의 인상보다 실제로 해낸 일과 지킬 수 있는 기준을 중시하는 모습으로 읽기 때문에 실행력이 주요 강점에 놓입니다.', '단단한 기준은 일의 신뢰를 높이지만 사람의 사정을 모두 설명하지는 못합니다. 과정의 맥락도 전달될 때 정확함과 협력의 온도가 함께 유지됩니다.'],
  천동: ['편안함과 즐거움', '관계를 부드럽게 하고 일상에서 만족을 되살리는 힘', '안정적인 리듬과 작은 변화가 공존하는 환경', '편안함을 지키려다 필요한 변화나 불편한 대화가 밀리는 상태', '천동은 즐거움과 조화로운 생활을 향하는 상징입니다. 경쟁의 강도보다 편안하게 지속할 수 있는 관계와 리듬을 중요하게 여기는 성향으로 설명합니다.', '편안함을 찾는 마음은 게으름과 같은 뜻이 아닙니다. 다만 불편함을 없애는 일과 필요한 변화를 피하는 일이 겹칠 때 지속성을 지키려는 강점이 정체감으로 바뀔 수 있습니다.'],
  염정: ['기준과 표현', '자신의 원칙과 관계의 경계를 분명하게 표현하는 힘', '서로 다른 입장을 말하고 기준을 조정할 수 있는 환경', '원칙이 흔들렸다는 느낌과 상대에 대한 감정이 한꺼번에 커지는 상태', '염정은 기준과 감정적 관여가 함께 놓인 상징입니다. 무엇이 옳은지뿐 아니라 자신이 어떤 관계 안에 있는지도 중요하게 받아들이는 해석입니다.', '뚜렷한 경계는 관계를 지키는 자원이지만 한 번의 행동이 사람 전체의 평가로 번지면 부담이 커집니다. 원칙의 선명함과 감정의 크기를 구분할 때 표현의 정밀함이 살아납니다.'],
  천부: ['기반과 보존', '이미 가진 자원과 관계를 안정적으로 지키는 힘', '유지할 기반과 조정할 부분을 구분할 수 있는 환경', '익숙한 구조를 지키는 일이 변화한 조건보다 우선되는 상태', '천부는 자원을 담고 관리하는 상징입니다. 빠른 확장 자체보다 갖춘 것을 오래 쓸 수 있게 만드는 안정성과 운영 감각을 중심에 두는 해석입니다.', '안정을 만드는 힘과 변화를 거부하는 태도는 구별됩니다. 지킬 핵심은 남기고 방법은 바뀔 수 있을 때 보존의 성향이 현실적인 유연함과 연결됩니다.'],
  태음: ['관찰과 준비', '작은 차이를 알아차리고 보이지 않는 준비를 쌓는 힘', '혼자 정리할 여유와 생각을 전할 통로가 함께 있는 환경', '마음속 준비는 깊어지지만 필요한 표현은 밖으로 나오지 않는 상태', '태음은 내면의 감각과 축적의 상징입니다. 반응을 바로 드러내기보다 충분히 살피고 준비한 뒤 움직이는 섬세함으로 설명하는 근거입니다.', '조용함은 생각이나 욕구가 적다는 뜻이 아닙니다. 세밀하게 알아차린 내용이 타인에게 전달될 수 있을 때 배려와 준비가 보이지 않는 부담으로만 남지 않습니다.'],
  탐랑: ['관심과 연결', '낯선 경험과 사람 사이에서 새로운 가능성을 발견하는 힘', '다양한 접점을 열면서 오래 가꿀 중심도 있는 환경', '새로운 자극을 넓히는 속도가 감당할 시간과 자원을 앞서는 상태', '탐랑은 관심과 교류의 폭을 넓히는 상징입니다. 사람과 경험에서 자극을 얻고 다른 분야를 이어 보는 감각이 성향 설명의 중심이 됩니다.', '관심이 많다는 점은 산만함과 동의어가 아닙니다. 넓어진 경험이 몇 가지 지속할 활동에 모일 때 연결의 감각이 깊이와도 만납니다.'],
  거문: ['질문과 분별', '말의 이면과 판단의 근거를 끝까지 구분하는 힘', '의문을 표현해도 관계가 흔들리지 않는 환경', '논리의 빈틈을 찾는 과정에서 상대의 감정과 의도가 뒤로 밀리는 상태', '거문은 말과 분별의 상징입니다. 설명이 충분하지 않은 부분을 그냥 넘기기보다 이유를 묻고 의미를 선명하게 만드는 성향으로 읽습니다.', '깊이 묻는 힘은 이해를 넓힐 수도 있고 대화를 반박의 장으로 좁힐 수도 있습니다. 사실을 가르는 일과 상대의 마음을 이해하는 일이 함께 있을 때 언어의 강점이 잘 드러납니다.'],
  천상: ['협력과 조정', '서로 다른 입장을 연결하고 함께 일할 균형을 만드는 힘', '지원하는 역할과 자신의 판단권이 함께 인정되는 환경', '관계를 매끄럽게 하려다 자신의 조건이 계속 뒤로 밀리는 상태', '천상은 보좌와 조정의 상징입니다. 혼자 앞서가는 방식보다 각자의 역할이 맞물려 돌아가게 하는 관계 감각을 강점으로 설명합니다.', '협력은 자신의 입장을 없애는 일이 아닙니다. 도움의 범위와 개인의 한계가 드러날 때 조정의 능력이 일방적인 부담으로 기울지 않습니다.'],
  천량: ['원칙과 지원', '경험과 기준을 바탕으로 사람과 일을 든든하게 받치는 힘', '조언을 나누면서 상대의 선택도 존중하는 환경', '도움을 주려는 마음이 상대의 결정을 대신하는 방향으로 커지는 상태', '천량은 보호와 경험의 상징입니다. 눈앞의 이익보다 오래 유지할 원칙이나 도움이 되는 역할에 무게를 두는 성향으로 연결됩니다.', '경험에서 나온 확신과 상대에게 맞는 답은 늘 같지는 않습니다. 기준을 지키는 힘에 다른 관점이 더해질 때 보호의 성향이 통제보다 신뢰에 가까워집니다.'],
  칠살: ['결단과 독립', '복잡한 상황에서도 우선순위를 정해 움직이는 힘', '실행의 자율성과 필요한 정보를 나눌 통로가 있는 환경', '책임을 혼자 감당하려다 주변의 정보와 지원에서 멀어지는 상태', '칠살은 결단과 독립적인 실행의 상징입니다. 충분히 안전해질 때까지 기다리기보다 선택의 무게를 받아들이고 움직이는 성향으로 설명합니다.', '결단력은 언제나 빨라야 한다는 뜻이 아닙니다. 자신의 판단을 유지하면서도 정보가 들어올 여지가 있을 때 독립성이 고립으로 바뀌지 않습니다.'],
  파군: ['변경과 재구성', '기존 방식의 한계를 끊고 새로운 구조를 만드는 힘', '바꿀 대상과 남겨 둘 기반이 구분된 환경', '새로 시작하는 속도가 마무리와 복구의 여유를 앞서는 상태', '파군은 해체와 재구성의 상징입니다. 익숙한 형태를 유지하는 것보다 더 맞는 방식으로 바꾸는 데 의미를 두므로 변화의 주도성이 강조됩니다.', '변화를 만드는 힘은 모든 것을 버리는 성향과 다릅니다. 남길 기반이 있을 때 재구성은 반복적인 초기화가 아니라 새로운 질서를 만드는 강점으로 읽힙니다.'],
};
const PALACE_TOPICS = {
  명궁: '자기 인식과 삶의 방향', 형제: '형제·또래의 협력과 경쟁', 부처: '친밀감과 동반 관계', 자녀: '돌봄·창작·결과물을 기르는 일',
  재백: '시간·돈·자원의 운영', 질액: '생활 리듬과 회복', 천이: '외부 활동과 환경 변화', 노복: '친구·동료·팀의 연결',
  관록: '업무 역할과 사회적 활동', 전택: '주거와 생활 기반', 복덕: '만족·휴식·내면의 여유', 부모: '부모·윗사람·제도와의 관계',
};
const PALACE_LENSES = {
  명궁: '명궁의 주성은 자신을 이해하고 선택할 때 앞세우는 기본 기준으로 읽습니다.',
  형제: '형제궁에서는 같은 위치의 사람들과 힘을 나누거나 비교하는 방식을 읽습니다. 실제 형제의 성격을 대신 묘사하는 자료는 아닙니다.',
  부처: '부처궁에서는 친밀한 관계에서 중요하게 여기는 교류와 거리감을 읽습니다. 상대방의 성격 자체와는 구분합니다.',
  자녀: '자녀궁에서는 사람이나 결과물을 돌보고 키워 가는 태도를 읽습니다. 자녀의 유무나 출산 시기를 뜻하지 않습니다.',
  재백: '재백궁의 주성은 자원을 얻고 배분하는 방식에 연결됩니다. 재산의 크기를 매기는 표가 아니라 운영의 태도를 읽는 축입니다.',
  질액: '질액궁은 이 보고서에서 생활을 관리하고 소모를 받아들이는 태도의 보조 축으로만 읽습니다.',
  천이: '천이궁은 익숙한 내부 기준과 달리 외부 환경에서 드러나는 반응과 적응의 방식을 설명합니다.',
  노복: '교우궁은 친구·동료·팀 안에서 지원을 주고받는 방식을 설명하며, 특정 주변 인물의 인품을 판단하지 않습니다.',
  관록: '관록궁은 직업 이름보다 역할을 맡고 결과를 만들어 가는 방식을 설명하는 축입니다.',
  전택: '전택궁에서는 머물 기반과 자원을 유지하는 태도를 읽습니다. 소유 부동산이나 주거 사건을 추정하는 뜻은 아닙니다.',
  복덕: '복덕궁은 밖으로 드러나는 성과보다 마음이 만족하고 긴장을 내려놓는 방식에 가깝습니다.',
  부모: '부모궁에서는 윗사람·제도·기존 질서와 관계를 맺는 태도를 읽으며 실제 가족사를 만들어 넣지 않습니다.',
};
const BRIGHTNESS = { '[+3]': '묘(廟)', '[+2]': '왕(旺)', '[+1]': '득(得)', '[0]': '리(利)', '[-1]': '평(平)', '[-2]': '불(不)', '[-3]': '함(陷)' };
const MUTAGEN_LENS = { 록: ['화록(化祿)', '그 별의 성향이 자원·만족·관심의 확대로 향하는 면'], 권: ['화권(化權)', '그 별의 성향에 주도권과 책임의 무게가 실리는 면'], 과: ['화과(化科)', '그 별의 성향이 정리·표현·인정의 방식으로 드러나는 면'], 기: ['화기(化忌)', '그 별의 주제에 마음이 오래 머물고 부담도 집중되는 면'] };
const DECADAL_STATUS = { available: '기준일 구간 확인', missing: '대운표 일부 누락', conflict: '대운표 충돌', 'invalid-age': '호환 나이 값 확인 필요', 'age-conflict': '나이 계산 자료 충돌', 'out-of-range': '기준일 세는나이가 대운표 범위 밖', 'reference-required': '해석 기준일 미확인', 'reference-before-birth': '기준일이 출생일보다 앞섬', 'age-source-missing': '출생 기준 자료 누락', 'calendar-unavailable': '음력 연도 변환 확인 불가', 'unsupported-age-convention': '대운표 나이 기준 확인 불가' };
const AUXILIARY = {
  좌보: ['길성', '직접적인 협력과 실무 지원'], 우필: ['길성', '부드러운 조율과 뒤에서의 보완'],
  문창: ['길성', '문서·학습·설명의 정리'], 문곡: ['길성', '표현과 감각의 세밀함'],
  천괴: ['길성', '공적인 조언과 지원의 접점'], 천월: ['길성', '개별적인 도움과 다른 관점의 보완'],
  경양: ['살성', '직선적인 돌파와 마찰의 양면'], 타라: ['살성', '반복과 지연 속에 머무는 집중'],
  화성: ['살성', '빠르게 점화되는 반응'], 영성: ['살성', '안쪽으로 모이는 긴장과 집중'],
  지공: ['살성', '기존 기대를 비우고 새롭게 보는 시선'], 지겁: ['살성', '기반의 변화와 자원 소모의 주제'],
  록존: ['보조성', '축적한 기반을 보유하고 유지하는 태도'], 천마: ['보조성', '이동과 환경 변화에 대한 반응'],
};
const own = (object, key) => Object.hasOwn(object, key);
const string = (value) => typeof value === 'string' ? value.trim() : '';
const list = (value) => Array.isArray(value) ? value : [];
const unique = (values) => [...new Set(values)];
const numbered = (values, render) => values.map((value, index) => `${index + 1}. ${render(value, index)}`).join('\n\n');
const strength = (profile) => profile[1].replace(/ 주제$/, ' 힘');
const withHighlights = (item, candidates) => {
  const content = [item.text, ...list(item.paragraphs), ...list(item.items)].join('\n');
  const highlights = unique(candidates.filter((phrase) => typeof phrase === 'string' && phrase.length >= 12 && phrase.length <= 180 && content.includes(phrase))).slice(0, 3);
  return highlights.length ? { ...item, highlights } : item;
};
const name = (palace) => !palace ? '미확인' : palace.name === '명궁' ? '명궁' : palace.name === '노복' ? '교우궁(노복궁)' : `${palace.name}궁`;
const location = (palace) => `${string(palace?.heavenlyStem)}${string(palace?.earthlyBranch)}` || '위치 미확인';
const stars = (palace) => list(palace?.majorStars).filter((star) => own(PROFILES, string(star?.name)));
const extraStars = (palace) => [...list(palace?.minorStars), ...list(palace?.adjectiveStars)].filter((star) => string(star?.name));
const starLabel = (star) => `${star.name}${string(star.brightness) ? ` · ${own(BRIGHTNESS, star.brightness) ? BRIGHTNESS[star.brightness] : star.brightness}` : ''}${string(star.mutagen) ? ` · 궁내 표기 ${own(MUTAGEN_LENS, star.mutagen) ? MUTAGEN_LENS[star.mutagen][0] : star.mutagen}` : ''}`;
const section = (id, title, paragraphs = [], extras = {}) => ({ id, title, text: '', paragraphs, items: [], ...extras });
const fcd = (fact, claim, disclosure) => [`Fact · 확인된 자료\n${fact}`, `Claim · 전통적 해석\n${claim}`, `Disclosure · 해석 범위와 조건\n${disclosure}`];
const stage = (number, fact, claim, disclosure, extras = {}) => section(`ziwei-stage-${String(number).padStart(2, '0')}`, TITLES[number - 1], fcd(fact, claim, disclosure), { groupLabel: `${String(number).padStart(2, '0')} · ${TITLES[number - 1]}`, ...extras });
const table = (id, title, headers, rows, extras = {}) => section(id, title, [], { collapsible: true, table: { caption: title, headers, rows }, ...extras });

function createContext(structure) {
  const palaces = list(structure?.palaces), get = (index) => palaces.find((palace) => palace.index === index);
  // Keep the full mechanism on its first appearance (personality first), while
  // a newly encountered domain star still receives its own explanation.
  const explainedStars = new Set();
  const find = (palaceName) => palaces.find((palace) => palace.name === palaceName);
  const opposite = (palace) => {
    const triad = list(structure?.triads).find((item) => item.targetIndex === palace?.index);
    return triad ? get(triad.oppositeIndex) : null;
  };
  const reading = (palace) => {
    const original = stars(palace), borrowed = original.length ? [] : stars(opposite(palace));
    return { palace, original, borrowed, references: original.length ? original : borrowed, source: original.length ? palace : opposite(palace) };
  };
  const fact = (palace) => {
    if (!palace) return '해당 궁의 위치와 배치를 확인하지 못했습니다.';
    const basis = reading(palace);
    return `${name(palace)} ${location(palace)} · ${basis.original.length ? `본궁 주성 ${basis.original.map(starLabel).join(' / ')}` : `주성 없음(공궁)${basis.borrowed.length ? ` · 차성 출처: 대궁 ${name(basis.source)} ${location(basis.source)} · ${basis.borrowed.map((star) => star.name).join('·')}` : ' · 차성 출처 미확인'}`}`;
  };
  const lenses = (palace) => reading(palace).references.map((star) => ({ star, profile: PROFILES[star.name], basis: reading(palace) }));
  const claim = (palace, detailed = false, explainMechanism = false) => {
    if (!palace) return '자료가 없는 축은 맞춤 설명으로 채우지 않았습니다.';
    const basis = reading(palace), selected = lenses(palace);
    if (!selected.length) return `${name(palace)}의 주성 및 대궁 차성을 확인하지 못해 ${PALACE_TOPICS[palace.name] || '이 영역'}의 성향을 정하지 않았습니다.`;
    const wording = selected.map(({ star, profile }) => {
      const firstExplanation = !explainedStars.has(star.name);
      explainedStars.add(star.name);
      return `${star.name} · ${strength(profile)}.${firstExplanation ? `\n${profile[4]}` : ''}`;
    }).join('\n\n');
    return `${name(palace)} · ${PALACE_TOPICS[palace.name]}\n${PALACE_LENSES[palace.name]}\n\n${wording}${basis.borrowed.length ? `\n\n본궁의 별이 아니라 ${name(basis.source)}에서 참고한 관점입니다.${explainMechanism ? ' 본궁 고유의 성향으로 단정하지 않고, 마주 보는 환경과의 관계 속에서 읽습니다.' : ''}` : ''}${explainMechanism && detailed && selected.length > 1 ? '\n\n두 주성이 함께 놓여 있어 한 가지 성향만으로 설명하지 않습니다. 각 별의 역할은 함께 읽되, 별도 검증하지 않은 합성 격국을 만들어 붙이지 않았습니다.' : ''}`;
  };
  return { palaces, get, find, opposite, reading, fact, lenses, claim };
}

function mutagenFact(structure, indexes = null) {
  if (!structure?.mutagens) return '생년사화 정본을 확인하지 못했습니다.';
  const data = structure.mutagens;
  if (data.status === 'conflict' || list(data.conflicts).length) return `생년사화 정본과 궁내 표기가 충돌했습니다. ${list(data.conflicts).join(' ')} 해당 사화의 해석은 보류합니다.`;
  if (data.status !== 'verified') return '생년사화 정본을 완전히 교차 확인하지 못해 사화 해석은 보류합니다.';
  const items = list(data.items).filter((item) => item.verified === true && (!indexes || indexes.includes(item.palaceIndex)));
  return items.length ? `확인된 생년사화: ${items.map((item) => `${item.label || MUTAGEN_LENS[item.key]?.[0] || item.key} · ${item.star} · ${item.palaceName === '명궁' ? '명궁' : `${item.palaceName}궁`}`).join(' / ')}.` : '이 축에서 정본과 교차 확인된 생년사화는 없습니다. 사화가 없다는 뜻으로 바꾸어 읽지는 않습니다.';
}

function mutagenClaim(structure, indexes = null) {
  const data = structure?.mutagens;
  if (data?.status !== 'verified' || list(data.conflicts).length) return '';
  return list(data.items).filter((item) => item.verified === true && own(MUTAGEN_LENS, item.key) && (!indexes || indexes.includes(item.palaceIndex)))
    .map((item) => `${item.palaceName === '명궁' ? '명궁' : `${item.palaceName}궁`}의 ${item.star}에 확인된 ${MUTAGEN_LENS[item.key][0]} 표기는 ${MUTAGEN_LENS[item.key][1]}을 강조합니다.`).join(' ');
}

function supportFact(context, palaces) {
  const entries = palaces.filter(Boolean).flatMap((palace) => extraStars(palace).filter((star) => own(AUXILIARY, star.name)).map((star) => ({ palace, star, profile: AUXILIARY[star.name] })));
  return entries.length ? `본궁의 보조 자료: ${entries.slice(0, 8).map((entry) => `${name(entry.palace)} ${entry.star.name}(${entry.profile[0]})`).join(' / ')}. 보조성은 주성과 삼방사정의 판단을 대체하지 않습니다.` : '해당 본궁에서 분류 가능한 보조성은 확인되지 않았습니다. 보조 자료의 유무만으로 좋고 나쁨을 나누지 않습니다.';
}

function supportClaim(palaces) {
  const entries = palaces.filter(Boolean).flatMap((palace) => extraStars(palace).filter((star) => own(AUXILIARY, star.name)).map((star) => ({ palace, star })));
  const chosen = entries.filter((entry, index) => entries.findIndex((item) => item.star.name === entry.star.name) === index).slice(0, 2);
  return chosen.length ? `보조성의 역할\n${chosen.map(({ palace, star }) => `${name(palace)}에 놓인 ${star.name}의 보조 상징은 ${AUXILIARY[star.name][1]}입니다.`).join(' ')} 이는 실제 배치가 확인된 보완 설명이며, 길성·살성의 이름만으로 결과의 좋고 나쁨을 나눈 뜻은 아닙니다.` : '';
}

function basisTable(context, structure, number, targets, mode) {
  if (mode === 'QUICK') return null;
  const rows = [];
  for (const target of targets.filter(Boolean)) {
    const related = list(structure.triads).find((item) => item.targetIndex === target.index);
    if (!related) {
      rows.push([name(target), '삼방사정 미확인', `${name(target)} ${location(target)}`, '궁위 자료가 부족해 관련 궁을 추정하지 않았습니다.']);
      continue;
    }
    for (const [role, index] of [['본궁', related.targetIndex], ['대궁', related.oppositeIndex], ['삼합궁 1', related.wealthIndex], ['삼합궁 2', related.careerIndex]]) {
      const palace = context.get(index);
      if (!palace) continue;
      const ownStars = stars(palace).map(starLabel).join('\n') || '주성 없음(공궁)';
      const supports = mode === 'DEEP' ? extraStars(palace).map(starLabel).join('\n') : extraStars(palace).map((star) => star.name).join(' · ');
      rows.push([name(target), role, `${name(palace)} ${location(palace)}`, `${ownStars}${supports ? `\n보조 자료: ${supports}` : ''}`]);
    }
  }
  return rows.length ? table(`ziwei-basis-${String(number).padStart(2, '0')}`, `${number}단계 · 삼방사정 근거`, ['기준 궁', '관계', '실제 궁 · 위치', '확인한 주성·궁내 사화·보조성'], rows) : null;
}

function simpleBasis(context, structure, targets) {
  return targets.filter(Boolean).map((palace) => {
    const related = list(structure.triads).find((item) => item.targetIndex === palace.index);
    if (!related) return `${name(palace)}: 삼방사정 위치 미확인.`;
    return `${name(palace)}의 삼방사정 · ${[['본궁', related.targetIndex], ['대궁', related.oppositeIndex], ['삼합궁 1', related.wealthIndex], ['삼합궁 2', related.careerIndex]].map(([role, index]) => {
      const actual = context.get(index);
      return `${role} ${name(actual)} ${location(actual)}: ${stars(actual).map(starLabel).join('·') || '주성 없음'}${extraStars(actual).length ? ` / 보조 ${extraStars(actual).slice(0, 4).map((star) => star.name).join('·')}` : ''}`;
    }).join('; ')}.`;
  }).join('\n');
}

function triadClaim(context, structure, target) {
  const ref = list(structure.triads).find((item) => item.targetIndex === target?.index);
  if (!ref) return '';
  const connected = [ref.targetIndex, ref.oppositeIndex, ref.wealthIndex, ref.careerIndex].map(context.get);
  const themes = connected.filter(Boolean).map((palace) => {
    const named = stars(palace).map((star) => `${star.name}의 ${PROFILES[star.name][0]}`);
    return `${name(palace)}: ${named.join('·') || '본궁 주성 없음'}`;
  });
  return `삼방사정의 해석 연결\n${themes.join('\n')}\n${name(target)}을 중심으로 본궁·대궁·두 삼합궁의 실제 연결을 함께 읽었습니다. 별을 본궁에 옮겨 넣은 결과는 아닙니다.`;
}

function conditions(context, targets, mode) {
  const entries = targets.filter(Boolean).flatMap((palace) => context.lenses(palace)).filter((entry, index, all) => all.findIndex((item) => item.star.name === entry.star.name) === index);
  const chosen = entries.slice(0, mode === 'QUICK' ? 1 : mode === 'DEEP' ? 3 : 2);
  return chosen.length ? numbered(chosen, ({ star, profile, basis }) => `${name(basis.palace)} · ${star.name}\n잘 맞는 환경: ${profile[2]}. 이 조건에서는 ${strength(profile)}이 자연스럽게 쓰이는 해석입니다.\n부담으로 바뀌는 조건: ${profile[3]}.\n${profile[5]}`) : '관련 축의 주성·차성 자료가 없어 유리한 환경과 부담 조건을 개인별로 정하지 않았습니다.';
}

function practicalSignals(context, targets, mode) {
  const entries = targets.filter(Boolean).flatMap((palace) => context.lenses(palace));
  const chosen = entries.filter((entry, index) => entries.findIndex((item) => item.star.name === entry.star.name) === index).slice(0, mode === 'QUICK' ? 1 : 2);
  return chosen.length ? numbered(chosen, ({ star, profile, basis }) => `${name(basis.palace)} · ${star.name}의 이면\n${profile[3]}가 이 영역에서 강점과 함께 읽는 부담 조건입니다.`) : '주성 및 검증된 차성 자료가 없어 이 영역의 강점과 부담을 구체적으로 덧붙이지 않았습니다.';
}

function limitedReport(options) {
  const sections = [section('ziwei-guidance', '해석 안내', [], { text: GUIDANCE }), section('ziwei-input-state', '입력 상태', [
    `선택된 MODE: ${options.mode || 'STANDARD'} · 명반 데이터 상태: 자료 없음·불일치.`,
    '데이터 확인 낮음: 명궁과 열두 궁의 원문을 함께 확인하지 못했습니다. 전통적 해석의 맞춤 판단은 보류합니다.',
    '직업·학업·현재 고민: 미입력. 실제 가족사·질병·사건은 제공되지 않았으며 대신 만들어 넣지 않습니다.',
  ])];
  for (let number = 1; number <= 10; number++) {
    sections.push(stage(number, '명궁·신궁·12궁의 일관된 자료가 확인되지 않았습니다.', number === 9 ? '명반의 일관된 출생·궁위 자료를 확인하지 못해 기준일 대운을 특정할 수 없습니다.' : `${TITLES[number - 1]}의 개인별 해석은 보류합니다.`, '이 상태에서는 실제 자료와 해설의 연결 근거가 없으므로 성향이나 사건을 대신 만들어 설명하지 않았습니다.'));
  }
  sections.push(section('ziwei-final-disclosure', '해석을 마치며', [FINAL]));
  return { label: '자미두수 명반 정보 확인', intro: GUIDANCE, sections, notes: ['명반 데이터의 누락·모순으로 개인별 전통 해석을 보류했습니다.'] };
}

export function buildZiweiReport(result, input = null) {
  const requested = input?.ziweiReport ?? {};
  const structure = buildZiweiStructure(result, requested);
  if (!structure) return limitedReport({ mode: ['QUICK', 'STANDARD', 'DEEP'].includes(requested.mode) ? requested.mode : 'STANDARD' });
  const context = createContext(structure), { options } = structure;
  const mode = options.mode, deep = mode === 'DEEP';
  const soul = context.get(structure.anchors.soulIndex), body = context.get(structure.anchors.bodyIndex), spirit = context.get(structure.anchors.spiritIndex);
  const anchors = unique([soul, body, spirit].filter(Boolean));
  const anchorName = (palace) => [palace === soul ? '명궁' : '', palace === body ? `신궁${palace === soul ? '' : `(${name(palace)})`}` : '', palace === spirit && palace !== soul ? '복덕궁' : ''].filter(Boolean).join('·') || name(palace);
  const decadal = structure.decadals;
  const age = Number.isInteger(decadal.calculatedAge) ? decadal.calculatedAge : null;
  const ageLine = age !== null ? `${age}세(음력 연도 기준 허세 · 자동 계산)` : '자동 계산 확인 불가';
  const issues = list(structure.issues).map((item) => item.message).filter(Boolean);
  const scopeLine = issues.length ? issues.join(' ') : '명궁·신궁·12궁의 배열에서 확인된 충돌은 없습니다.';
  const sections = [section('ziwei-guidance', '해석 안내', [], { text: GUIDANCE }), section('ziwei-input-state', '입력 상태', [
    `선택된 MODE: ${mode}${mode === 'QUICK' ? ' · 10단계 핵심 요약' : mode === 'DEEP' ? ' · 10단계와 축별 상세 근거' : ' · 10단계 기본 보고서'}. 명반 출처: 이 사이트에 입력한 출생 정보로 계산한 iztro 본명 명반입니다. 명반 원문 붙여넣기를 판독한 결과는 아닙니다.`,
    `명반 데이터 상태: ${{ verified: '기호·배치 확인됨', partial: '일부 자료 확인 제한', conflict: '일부 자료 충돌' }[structure.status] || '확인 제한'}.\n\n해석 기준일: ${decadal.referenceDate || options.asOf || '미확인'}. 기준일 세는나이: ${ageLine}. 기준일 대운: ${decadal.current ? '표의 해당 구간 확인' : '특정 불가'}.\n\n${string(decadal.ageBasis) || '출생일과 기준일의 음력 연도를 함께 확인한 경우에만 세는나이를 사용합니다.'}`,
    `데이터 확인 높음은 기호·배치의 정합성이 확인됐다는 뜻입니다. 전통 해석 가능성 중간은 상징을 생활 관점으로 옮긴 부분이며 예측 정확도가 아닙니다. 자료 없음 낮음은 해당 판단을 보류한다는 뜻입니다. 분석 제한: ${scopeLine} 직업·학업·현재 고민·피하고 싶은 방식은 이번 화면에서 받지 않아 미입력 상태입니다.`,
  ])];
  const append = (number, targets, fact, claim, disclosure, extras = {}) => {
    const basis = basisTable(context, structure, number, targets, mode);
    if (basis) sections.push({ ...basis, groupLabel: `${String(number).padStart(2, '0')} · ${TITLES[number - 1]}` });
    const item = stage(number, mode === 'QUICK' ? `${simpleBasis(context, structure, targets)}\n\n${fact}` : fact,
      `${claim}${number >= 5 && number <= 9 && mode !== 'QUICK' ? `\n\n${triadClaim(context, structure, targets.find(Boolean))}` : ''}`, disclosure, { ...extras, ...(basis ? { groupLabel: '' } : {}) });
    const profiles = targets.filter(Boolean).flatMap((palace) => context.lenses(palace)).map(({ profile }) => profile);
    sections.push(withHighlights(item, profiles.flatMap((profile) => number === 3 || number === 10
      ? [profile[3], profile[5], strength(profile)] : [strength(profile), profile[2], profile[3], profile[4], profile[5]])));
  };
  sections.push(table('ziwei-palaces', '확인한 12궁 명반', ['궁 · 위치', '생활 주제', '실제 주성 · 밝기 · 궁내 사화', '보조성·잡요'], context.palaces.map((palace) => [
    `${name(palace)} ${location(palace)}${palace.isBodyPalace ? ' · 신궁' : ''}`, PALACE_TOPICS[palace.name] || '미확인',
    stars(palace).map(starLabel).join('\n') || '주성 없음(공궁)', extraStars(palace).map(starLabel).join('\n') || '표시된 별 없음',
  ])));
  append(1, anchors, `${numbered(anchors, (palace) => `${anchorName(palace)}\n${context.fact(palace)}`)}\n\n${mutagenFact(structure)}\n\n명궁은 자기 인식, 신궁은 행동과 에너지가 실리는 보조 축, 복덕궁은 만족과 회복의 주제입니다.`,
    `${numbered(anchors, (palace) => `${anchorName(palace)}의 중심 성향\n${context.lenses(palace).map(({ star, profile }) => `${star.name}의 중심 주제는 ${profile[0]}입니다. 이 축에서는 ${strength(profile)}을 주요 특성으로 설명했습니다.`).join('\n') || '주성 및 차성이 미확인이므로 성향 설명을 보류합니다.'}`)}\n\n명궁은 판단의 기준, 신궁은 힘이 실리는 행동 영역, 복덕궁은 만족과 회복의 방식입니다. 이 세 축을 나누었기 때문에 겉으로 보이는 행동과 속으로 원하는 바가 항상 같은 모습일 필요는 없습니다.\n\n${mutagenClaim(structure)}`.trim(),
    `${body?.index === soul?.index ? '이 명반에서는 신궁이 명궁과 같은 위치에 있습니다. 기본 기준과 행동의 무게를 같은 배치에서 읽되, 같은 별을 두 번 세어 성향이 두 배라고 해석하지 않았습니다.' : body ? `신궁은 ${name(body)}에 놓여 있습니다. 그 궁의 생활 영역이 행동의 무게를 설명하는 보조 축이라는 뜻이며, 명궁을 대신하는 두 번째 성격표는 아닙니다.` : '신궁 위치를 유일하게 확인하지 못해 행동 축의 맞춤 해석은 생략했습니다.'}\n\n복덕궁은 명궁의 성향이 옳고 그른지를 평가하는 칸이 아니라, 그 방식으로 살아갈 때 무엇에서 만족과 여유를 얻는지를 설명하는 별도의 축입니다.`);
  append(2, anchors, `${numbered(anchors, context.fact)}\n\n${supportFact(context, anchors)}`,
    `${numbered(anchors, (palace) => `${anchorName(palace)}\n${context.claim(palace, deep, true)}`)}\n\n${supportClaim(anchors)}`.trim(),
    `${conditions(context, [body, spirit], mode)}\n\n같은 주성도 명궁에서는 판단의 습관, 신궁이 놓인 영역에서는 행동의 우선순위, 복덕궁에서는 마음이 편해지는 조건으로 표현됩니다. 이 역할의 차이가 성격·감정·행동을 한 가지 단어로 묶지 않은 이유입니다.`);
  const themes = anchors.flatMap((palace) => context.lenses(palace)).filter((entry, index, all) => all.findIndex((item) => item.star.name === entry.star.name) === index).slice(0, mode === 'QUICK' ? 1 : deep ? 5 : 3);
  append(3, anchors, numbered(themes, ({ star, basis }) => `${star.name}의 부담 조건 근거\n${context.fact(basis.palace)}`),
    themes.length ? numbered(themes, ({ star, profile }) => `${star.name}의 강점이 좁아질 때\n${strength(profile)}은 이 명반에서 강점으로 읽은 부분입니다. 그 힘이 한쪽으로 집중되면 ${profile[3]}로 설명되는 부담도 생길 수 있다는 해석입니다.`) : '자료가 충분하지 않아 개인의 약점을 정하지 않았습니다.',
    themes.length ? `${numbered(themes, ({ profile }) => profile[5])}\n\n이 항목은 앞서 설명한 강점의 이면을 연결한 것이며, 별도로 확인된 결함이나 심리 진단의 목록은 아닙니다.` : '인격이나 불안·충동 같은 심리 상태를 별의 이름에서 진단하지 않았습니다.');
  append(4, anchors, `${themes.map(({ star, basis }) => `${name(basis.palace)} ${location(basis.palace)} · ${star.name}${basis.borrowed.length ? `(${name(basis.source)} 차성)` : ''}`).join('\n')}\n${mutagenFact(structure, anchors.map((palace) => palace.index))}`,
    themes.length ? numbered(themes, ({ star, profile }) => `${star.name}의 성장 자원\n${strength(profile)}. ${profile[0]}의 상징을 강점의 언어로 옮긴 설명입니다.\n그 힘이 드러나기 쉬운 조건은 ${profile[2]}입니다.`) : '확인되지 않은 능력을 강점으로 채우지 않았습니다.',
    '이 결과에서 강점은 남보다 우월하다는 점수보다 어떤 방식에 힘을 싣는가에 가깝습니다. 같은 능력도 역할·지원·결정권이 맞을 때와 그렇지 않을 때 다르게 드러납니다.');
  const domains = [
    [5, ['관록', '재백', '천이', '노복'], '역할·조직·협업', '일의 성향을 관록궁 하나로 정하지 않고 네 영역으로 나누었습니다. 관록궁은 맡은 역할, 재백궁은 자원 운영, 천이궁은 외부 환경에서의 반응, 교우궁은 협업의 방식을 보여 주는 축입니다. 그래서 성과를 내는 방식과 조직 안에서 편안한 방식이 다르게 설명될 수 있습니다.', '이 보고서가 설명하는 것은 역할을 대하는 태도이지 특정 직업의 적성 판정이 아닙니다. 실제 경력·기술·직무 조건을 입력받지 않았으므로 직업명이나 창업 성패로 연결하지 않았습니다.'],
    [6, ['재백', '전택', '복덕'], '자원·생활 기반·만족', '재백궁은 자원을 다루는 방식, 전택궁은 기반을 유지하는 태도, 복덕궁은 무엇에서 만족을 얻는지를 나눠 설명합니다. 세 영역의 성향이 다르면 성과를 늘리고 싶은 마음과 안정적으로 보유하고 싶은 마음이 동시에 놓인 해석이 됩니다.', '여기서 자원 성향은 실제 재산의 많고 적음과 다릅니다. 수입·지출·부채·계약 자료가 없으므로 자산 규모나 투자 결과는 판단하지 않았고, 생활 기반을 바라보는 태도까지만 설명했습니다.'],
    [7, ['부처', '자녀', '부모', '형제', '노복'], '친밀감·돌봄·역할의 거리', '관계의 성향을 하나로 묶지 않은 이유는 가까움에도 종류가 다르기 때문입니다. 부처궁은 동반 관계에서 바라는 교류, 자녀궁은 돌보는 태도, 부모궁은 기존 질서와의 거리, 형제궁·교우궁은 또래 및 팀 안의 역할을 설명합니다.', '이 배치는 관계 안에서 자신의 태도를 읽는 근거이지 상대방의 속마음이나 실제 가족사를 입증하지 않습니다. 동반자를 대하는 방식과 동료를 대하는 방식이 달라도 모순으로 보지 않으며, 혼인·이별·임신 시기는 다루지 않았습니다.'],
    [8, ['질액', '복덕', '천이'], '생활 리듬·과부하·회복', '질액궁은 생활 관리의 태도, 복덕궁은 심리적 만족과 휴식의 취향, 천이궁은 외부 자극을 받아들이는 방식을 설명하는 보조 축으로 사용했습니다. 활동할 때의 모습과 쉬어야 편안한 방식이 다른 까닭을 이 세 역할의 차이로 풀이한 것입니다.', '이 문단은 몸의 상태를 측정하거나 질병의 원인을 해석한 내용이 아닙니다. 장기·질병·사고·수명은 추정하지 않았습니다. 지속적인 신체·정신 증상이 있다면 이 해석이 아니라 의료 또는 상담 전문가와 상의해야 합니다.'],
  ];
  for (const [number, palaceNames, topic, explanation, disclosure] of domains) {
    const targets = palaceNames.map(context.find);
    append(number, targets, `${numbered(targets.filter(Boolean), context.fact)}\n\n${mutagenFact(structure, targets.filter(Boolean).map((palace) => palace.index))}${deep ? `\n\n${supportFact(context, targets)}` : ''}`,
      `${topic}\n${explanation}\n\n${numbered(targets.filter(Boolean).slice(0, mode === 'QUICK' ? 1 : deep ? 5 : 3), (palace) => context.claim(palace, deep))}\n\n${mutagenClaim(structure, targets.filter(Boolean).map((palace) => palace.index))}`.trim(),
      `${practicalSignals(context, targets, mode)}\n\n${disclosure}`);
  }
  const candidates = list(decadal.boundary?.candidates);
  const periods = unique([decadal.current, decadal.next].filter(Boolean));
  if (age === null || !periods.length || decadal.ageConflict === true) {
    const reason = decadal.status === 'reference-before-birth' ? '해석 기준일이 출생일보다 앞서므로 기준일 세는나이와 대운을 표시하지 않았습니다.'
      : decadal.ageConflict === true ? '출생 메타데이터 또는 호환 나이 값이 자동 계산과 충돌하여 판독을 보류합니다.'
      : decadal.status === 'conflict' ? '대운표의 범위 또는 궁위 자료가 충돌하여 현재 대운 판독을 보류합니다.'
      : decadal.status === 'out-of-range' ? '자동 계산한 기준일 세는나이가 제공된 대운표 범위 밖이어서 해당 대운을 특정하지 않습니다.'
      : decadal.status === 'invalid-age' ? '이전 화면의 호환 나이 값이 유효하지 않아 자동 계산과의 교차 확인을 보류합니다.'
      : decadal.status === 'missing' ? '대운표 자료 일부가 누락되어 현재 대운을 특정할 수 없습니다.'
      : decadal.status === 'calendar-unavailable' ? '실제 음력 연도 변환을 확인할 수 없어 나이와 대운을 달력 연도로 대신 추정하지 않았습니다.'
      : decadal.status === 'unsupported-age-convention' ? '대운표의 나이 기준을 확인하지 못해 계산한 나이와 연결하지 않았습니다.'
      : decadal.status === 'age-source-missing' ? '출생 기준 자료가 누락되어 세는나이 자동 계산과 대운 판독을 보류합니다.'
      : '유효한 해석 기준일을 확인하지 못해 세는나이와 기준일 대운을 특정할 수 없습니다.';
    sections.push(stage(9, `[대운 분석 제한]\n${reason}`, '기준일의 나이와 실제 대운표가 함께 확인되지 않아 현재·다음 구간의 성향 해설을 보류합니다.', '나머지 본명 해설과 대운 판독의 자료 상태는 별개입니다. 원국에서 확인된 별이 있다는 이유만으로 누락된 기간이나 전환일을 대신 만들지 않았습니다.'));
  } else {
    const targets = periods.map((period) => context.get(period.palaceIndex));
    const extraCandidates = candidates.filter((candidate) => !periods.some((period) => period.palaceIndex === candidate.palaceIndex));
    const periodLabel = (period) => period.palaceIndex === decadal.current?.palaceIndex ? '현재' : period.palaceIndex === decadal.next?.palaceIndex ? '다음' : '경계 참고';
    const cycleRows = [...periods, ...extraCandidates].map((period) => { const palace = context.get(period.palaceIndex); return [`${periodLabel(period)} · ${period.range[0]}~${period.range[1]}세(허세)`, name(palace), context.fact(palace), PALACE_TOPICS[palace?.name] || '미확인']; });
    const visiblePeriods = periods.map((period) => {
      const startDate = period.palaceIndex === decadal.current?.palaceIndex ? decadal.currentStartDate : period.palaceIndex === decadal.next?.palaceIndex ? decadal.nextTransitionDate : null;
      return `${periodLabel(period)}: ${period.range[0]}~${period.range[1]}세(허세) · ${name(context.get(period.palaceIndex))}${startDate ? ` · 시작 ${startDate}` : ''}`;
    }).join('\n\n');
    sections.push(table('ziwei-decadal-evidence', '자동 계산한 기준일 세는나이와 대운 구간', ['나이 범위', '활성 궁', '실제 본명 별·차성', '가능한 생활 주제'], cycleRows));
    append(9, targets, `해석 기준일 ${decadal.referenceDate}의 세는나이는 ${age}세(허세)입니다.\n\n${visiblePeriods}${!decadal.next ? '\n\n다음: 제공된 표에 다음 구간 없음.' : ''}${extraCandidates.length ? `\n\n경계 참고: ${extraCandidates.map((period) => `${period.range[0]}~${period.range[1]}세 · ${name(context.get(period.palaceIndex))}`).join(' / ')}. 현재·다음 구간과 구분한 보조 비교입니다.` : ''}\n\n${numbered(targets.filter(Boolean), context.fact)}`,
      `${numbered(periods, (period) => `${periodLabel(period)} 구간 · ${name(context.get(period.palaceIndex))}\n${context.claim(context.get(period.palaceIndex), deep)}`)}\n\n이 부분은 본명에 배치된 주제를 기준일의 대운 궁과 연결한 설명입니다. 원래 성격이 사라지고 다른 성격으로 바뀐다는 뜻이 아니라, 표의 해당 구간에서 어떤 생활 영역을 중심으로 해설했는지를 보여 줍니다.`,
      `${decadal.nextTransitionDate ? `다음 표 구간의 시작일: ${decadal.nextTransitionDate}. 이 날짜는 세는나이가 다음 시작 나이에 이르는 음력설 기준이며 사건의 발생일이 아닙니다.\n\n` : ''}${numbered(periods, (period) => {
        const palace = context.get(period.palaceIndex), lens = context.lenses(palace)[0];
        return `${periodLabel(period)} 구간의 부담 조건\n${lens ? `${lens.star.name}의 이면은 ${lens.profile[3]}로 설명했습니다.` : '실제 주성 및 검증된 차성이 없어 이 기간의 구체적인 성향은 덧붙이지 않았습니다.'}`;
      })}\n\n별도의 대운 사화·유년 자료가 없으므로 본명 사화를 대운 사화로 바꾸어 부르지 않습니다. 표시한 날짜는 음력 연도 기준 나이 범위의 시작일이며 사건이 발생하는 날을 예측한 값이 아닙니다.`);
  }
  const finalThemes = themes.slice(0, 3);
  const focusText = { all: '일·돈·관계·생활 리듬', career: '역할과 협업', money: '자원과 생활 기반', relationship: '친밀감과 역할의 거리', wellbeing: '생활 리듬과 회복' }[options.focus] || '일·돈·관계·생활 리듬';
  append(10, anchors, `핵심 구조: ${anchors.map(context.fact).join(' / ')}\n\n기준일 대운의 자료 상태: ${own(DECADAL_STATUS, decadal.status) ? DECADAL_STATUS[decadal.status] : '확인 제한'}. ${mutagenFact(structure)}`,
    `1. 중심 성향이 나온 이유\n${finalThemes.map(({ star, profile, basis }) => `${name(basis.palace)}${basis.borrowed.length ? `에서 ${name(basis.source)}의 주성을 차성해 읽은` : '에 놓인'} ${star.name}의 상징은 ${profile[0]}입니다. 이를 ${strength(profile)}으로 설명한 결과입니다.`).join('\n') || '맞춤 판단 보류'}\n\n2. 강점과 부담의 연결\n${finalThemes.map(({ profile }) => `${strength(profile)}과 ${profile[3]}는 서로 무관한 두 성격이 아니라 같은 상징을 강점과 이면에서 읽은 설명입니다.`).join('\n') || '맞춤 판단 보류'}\n\n3. 선택한 관심 영역\n${focusText}의 성향은 해당 궁의 역할과 실제 주성·사화·삼방사정이 연결되는 범위에서 설명했습니다.`,
    '1. 이 보고서가 하나의 성격표가 아닌 이유\n명궁은 판단의 기준, 신궁은 힘이 실리는 행동 영역, 복덕궁은 만족과 회복의 방식입니다. 세 축이 같으면 비슷한 주제가 여러 역할에서 되풀이되고, 다르면 생각·행동·만족의 차이로 읽습니다.\n\n2. 여러 성향이 함께 있는 이유\n주성은 궁의 기본 성향, 사화는 그 성향에 실리는 방향, 보조성은 표현을 보완하는 맥락입니다. 한 가지 표기로 전체 성향을 정하지 않은 이유입니다.\n\n3. 해석에 포함하지 않은 내용\n밝기는 전통적인 별의 상태 분류이지 성격 점수가 아닙니다. 공궁은 대궁을 참고하되 원래 별의 위치를 유지했고, 생년사화는 정본과 궁내 표기가 함께 맞는 경우만 사용했습니다. 실제 직업·재산·가족사나 앞으로의 사건은 이 결과에서 알아낸 정보가 아닙니다.');
  sections.push(section('ziwei-final-disclosure', '해석을 마치며', [FINAL]));
  const soulBasis = context.reading(soul);
  const soulLabel = soulBasis.original.length ? `명궁 ${soulBasis.original.map((star) => star.name).join('·')}`
    : `명궁 공궁${soulBasis.borrowed.length ? ` · 천이궁 ${soulBasis.borrowed.map((star) => star.name).join('·')} 차성` : ''}`;
  return { label: `${soulLabel} · 명궁·신궁·복덕궁으로 읽는 자미두수 보고서`, intro: GUIDANCE, sections,
    notes: unique([...list(structure.notes), ...list(decadal.notes), '밝기 표기는 명반 원문이 제공한 묘·왕·득·리·평·불·함의 전통 분류입니다. 실제 천체의 광도나 인생의 점수가 아닙니다.', '보조성·사화의 단독 표기로 성공·실패·질병·이별을 판단하지 않았습니다. 별의 상징을 궁의 역할과 연결한 성향 설명은 SAI가 직접 작성했습니다.']) };
}
