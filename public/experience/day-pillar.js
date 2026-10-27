/**
 * Presentation of an already-calculated EightChar day pillar; no new astrology
 * or MBTI calculation is performed here.
 * Korean readings: https://unicode.org/cldr/charts/43/summary/ko.html
 * Stem/branch element classifications:
 * https://github.com/6tail/lunar-javascript/blob/v1.7.7/lunar.js
 * The short element narratives below are SAI's own reflection prompts, not
 * traditional claims about the personalities or fates of sixty day pillars.
 */
const STEMS = {
  甲: ['갑', '목'], 乙: ['을', '목'], 丙: ['병', '화'], 丁: ['정', '화'],
  戊: ['무', '토'], 己: ['기', '토'], 庚: ['경', '금'], 辛: ['신', '금'],
  壬: ['임', '수'], 癸: ['계', '수'],
};
const BRANCHES = {
  子: ['자', '수'], 丑: ['축', '토'], 寅: ['인', '목'], 卯: ['묘', '목'],
  辰: ['진', '토'], 巳: ['사', '화'], 午: ['오', '화'], 未: ['미', '토'],
  申: ['신', '금'], 酉: ['유', '금'], 戌: ['술', '토'], 亥: ['해', '수'],
};
const ELEMENTS = {
  목: { hanja: '木', meaning: '성장과 시도' },
  화: { hanja: '火', meaning: '표현과 온기' },
  토: { hanja: '土', meaning: '안정과 꾸준함' },
  금: { hanja: '金', meaning: '기준과 정리' },
  수: { hanja: '水', meaning: '숙고와 유연함' },
};

// SAI-authored character imagery, not a validated personality assessment or a
// traditional sixty-pillar verdict. Keep stem and branch voices distinct so
// even pillars sharing an element do not receive an identical description.
const STEM_IMAGERY = {
  甲: '먼저 방향을 정하고 새로운 일을 시작하는 이미지예요.',
  乙: '상대의 마음을 살피며 유연하게 길을 찾는 이미지예요.',
  丙: '솔직하게 자신을 표현하고 활기를 나누는 이미지예요.',
  丁: '가까운 사람에게 세심한 관심과 온기를 건네는 이미지예요.',
  戊: '중심을 지키며 주변에 안정감을 건네는 이미지예요.',
  己: '작은 필요를 놓치지 않고 현실적으로 챙기는 이미지예요.',
  庚: '문제를 분명하게 짚고 행동으로 옮기는 이미지예요.',
  辛: '세밀한 차이를 알아채고 자기 기준을 다듬는 이미지예요.',
  壬: '여러 가능성을 넓게 살피고 자유롭게 연결하는 이미지예요.',
  癸: '조용히 관찰하며 말과 감정의 결을 읽는 이미지예요.',
};
const BRANCH_IMAGERY = {
  子: '생각을 먼저 정리하고 마음을 천천히 드러내요.',
  丑: '익숙한 자리에서 차근차근 자기만의 기반을 쌓아가요.',
  寅: '기회가 보이면 주도적으로 움직이며 새 경험에서 힘을 얻어요.',
  卯: '관계의 분위기를 살피고 부드럽게 자기 뜻을 전해요.',
  辰: '생각을 오래 숙성시키고 때가 왔을 때 구체화해요.',
  巳: '관심 있는 일은 깊이 파고들며 표현할 순간을 신중히 골라요.',
  午: '마음이 움직이면 빠르게 몰입하고 사람들과 에너지를 나눠요.',
  未: '서두르기보다 소중한 사람과 일에 정성을 오래 쏟아요.',
  申: '상황이 달라져도 방법을 바꾸며 실용적인 답을 찾아가요.',
  酉: '완성도를 살피고 일과 관계의 경계를 깔끔하게 정리해요.',
  戌: '중요한 약속을 지키고 믿는 사람을 꾸준히 챙겨요.',
  亥: '혼자 충전할 여유를 두고 새로운 생각을 받아들여요.',
};

export function describeDayPillar(result) {
  if (result?.mode !== 'saju') return null;
  const chartDay = Array.isArray(result.chart?.pillars) ? result.chart.pillars.find((pillar) => pillar.key === 'day') : null;
  const hanja = result.calculation?.details?.pillars?.day ?? chartDay?.ganZhi;
  if (typeof hanja !== 'string' || !/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/.test(hanja)) return null;
  if (chartDay?.ganZhi && chartDay.ganZhi !== hanja) return null;
  const [stemHanja, branchHanja] = [...hanja];
  // Only sixty same-parity combinations exist in the sexagenary cycle.
  if (Object.keys(STEMS).indexOf(stemHanja) % 2 !== Object.keys(BRANCHES).indexOf(branchHanja) % 2) return null;
  const [stemName, stemElement] = STEMS[stemHanja];
  const [branchName, branchElement] = BRANCHES[branchHanja];
  if (chartDay?.elements && (chartDay.elements[0] !== stemElement || chartDay.elements[1] !== branchElement)) return null;
  const stemSymbol = ELEMENTS[stemElement], branchSymbol = ELEMENTS[branchElement];
  return {
    name: `${stemName}${branchName}`,
    hanja,
    label: `${stemName}${branchName}(${hanja}) 일주`,
    shortDescription: `${STEM_IMAGERY[stemHanja]} ${BRANCH_IMAGERY[branchHanja]}`,
    stem: { name: stemName, hanja: stemHanja, element: stemElement, elementHanja: stemSymbol.hanja },
    branch: { name: branchName, hanja: branchHanja, element: branchElement, elementHanja: branchSymbol.hanja },
    summary: `이 화면에서는 일간 ${stemName}(${stemHanja})의 ${stemElement}(${stemSymbol.hanja})를 ‘${stemSymbol.meaning}’, 일지 ${branchName}(${branchHanja})의 ${branchElement}(${branchSymbol.hanja})를 ‘${branchSymbol.meaning}’의 상징으로 풀었어요. 두 이미지가 나의 일상에 어떻게 닮았는지 가볍게 돌아보세요.`,
    note: '태어난 날의 실제 천간·지지를 표시했습니다. 오행 설명은 자기 탐색을 위해 직접 쓴 상징 문안이며 일주만으로 실제 성격이나 운명을 판단하지 않습니다.',
  };
}
