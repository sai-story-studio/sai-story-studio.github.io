/**
 * Deterministic editorial report over validated natal/cycle data only.
 * No chart calculation, remote AI, prediction, storage, or scoring is done here.
 * A cited symbol is an explanation anchor, not evidence that a life event or
 * psychological trait has been established. All copy is authored by SAI.
 */
const GROUPS = ['01 · 타고난 구조', '02 · 인생 흐름', '03 · 분야별 해석', '04 · 시기별 정리', '05 · 핵심 결론'];
const FAMILY = {
  比肩: 'peer', 劫财: 'peer', 食神: 'output', 伤官: 'output', 偏财: 'resource', 正财: 'resource',
  七杀: 'responsibility', 正官: 'responsibility', 偏印: 'learning', 正印: 'learning',
};
const FAMILY_LABEL = {
  peer: '비겁 · 자율성과 동료 관계', output: '식상 · 표현하고 만들어 내는 일', resource: '재성 · 시간·돈·자원의 관리',
  responsibility: '관성 · 역할·책임·규칙', learning: '인성 · 배우고 도움받는 기반',
};
const FOCUS = {
  比肩: ['자율성과 협력', '자기 판단을 지키면서 동료와 대등하게 관계를 맺는 성향', '타인의 반응에 쉽게 휩쓸리지 않는 일관성이 강점입니다.', '자기 기준이 단단한 만큼 다른 방식과의 타협에는 시간이 걸릴 수 있습니다.'],
  劫财: ['공동 자원과 경쟁', '사람과 자원을 모으고 공동의 성과에 적극적으로 참여하는 성향', '상황을 함께 움직이는 추진력과 관계의 활력이 돋보이는 해석입니다.', '공동의 목표와 개인의 몫이 섞이면 경쟁이나 분배의 긴장이 커지기 쉽습니다.'],
  食神: ['꾸준한 생산과 돌봄', '익숙한 기술과 편안한 표현을 안정적인 결과물로 이어 가는 성향', '무리한 속도보다 꾸준한 완성과 세심한 돌봄에서 장점이 드러납니다.', '익숙함을 유지하는 데 치우치면 긴급한 변화나 불편한 조정이 늦어질 수 있습니다.'],
  伤官: ['표현과 개선', '기존 방식의 빈틈을 발견하고 자기 언어로 대안을 드러내는 성향', '남들이 지나친 문제를 구체적인 개선안으로 바꾸는 감각이 강점입니다.', '표현이 앞서면 전달하려던 대안보다 비판의 인상이 더 크게 남을 수 있습니다.'],
  偏财: ['기회와 자원 연결', '바깥의 기회와 사람·정보·자원을 넓게 연결하는 성향', '여러 선택지를 빠르게 연결하고 상황에 맞게 자원을 배치하는 폭이 넓습니다.', '관심과 기회가 늘어날수록 유지할 일의 범위도 함께 커지는 부담이 있습니다.'],
  正财: ['생활 자원과 지속성', '정해진 자원과 약속을 세밀하게 유지하며 지속성을 중시하는 성향', '작은 약속과 반복되는 관리에서 신뢰가 쌓이는 구조로 해석됩니다.', '예측 가능한 상태를 중시할수록 계획 밖의 변화에 경직될 여지가 있습니다.'],
  七杀: ['도전과 부담 조절', '압박이 있는 과제에서 빠르게 판단하고 책임을 감당하려는 성향', '어려운 상황에서도 핵심을 좁혀 결단하는 힘과 집중력이 강점입니다.', '긴장과 책임이 한쪽으로 몰리면 혼자 감당하는 부담이 커질 수 있습니다.'],
  正官: ['책임과 약속', '역할·규칙·합의된 기대를 기준으로 행동을 정돈하는 성향', '주어진 역할을 안정적으로 이어 가며 신뢰를 형성하는 힘이 있습니다.', '외부의 기대를 지나치게 의식하면 자기 판단의 여유가 좁아질 수 있습니다.'],
  偏印: ['탐구와 관점 전환', '낯선 정보의 연결과 독자적인 이해 방식에 깊이 몰입하는 성향', '익숙한 설명 밖의 관점을 발견하고 복잡한 내용을 새롭게 묶는 감각이 장점입니다.', '생각이 정교해지는 속도와 실제 결과를 내는 속도 사이에 간격이 생길 수 있습니다.'],
  正印: ['배움과 기반 다지기', '지식과 조언을 받아들이고 안정적인 이해의 기반을 쌓는 성향', '경험을 배우고 정리하여 다음 판단의 토대로 삼는 힘이 있습니다.', '충분히 준비된 상태를 기다리다 자기 결정을 늦출 여지가 있습니다.'],
};
const STEM_STRUCTURE = {
  甲: ['방향을 세우고 자리를 잡는 큰 나무', '목표가 생겼을 때 먼저 큰 방향을 정하는 태도'],
  乙: ['주변에 맞춰 길을 찾는 풀과 덩굴', '한 방법이 막히면 다른 경로나 협력을 찾는 태도'],
  丙: ['넓게 비추는 햇빛', '생각과 관심을 밖으로 드러내고 함께 나누는 태도'],
  丁: ['가까이를 밝히는 불빛', '한 사람이나 한 작업에 집중해서 온기를 보태는 태도'],
  戊: ['넓은 기반을 이루는 산과 흙', '쉽게 바뀌지 않을 기준을 세우고 맡은 자리를 지키는 태도'],
  己: ['무언가를 기르는 밭의 흙', '필요한 것을 챙기며 생활에 맞게 세부를 조정하는 태도'],
  庚: ['형태를 다듬어 가는 단단한 금속', '애매한 문제를 정리하고 필요한 결정을 내리는 태도'],
  辛: ['작은 차이를 살린 세공 금속', '완성도를 살피고 자기 기준에 맞게 세밀하게 다듬는 태도'],
  壬: ['여러 길로 흐르는 큰 물', '넓게 정보를 받아들이고 상황에 맞는 길을 찾는 태도'],
  癸: ['조용히 스며드는 빗물과 이슬', '겉으로 드러나지 않은 사정을 관찰하고 생각을 모으는 태도'],
};
const STEM_TONE = {
  甲: ['큰 방향을 분명히 정하고 일의 중심을 유지하는 힘', '방향에 확신이 클수록 달라진 조건과 세부 차이를 늦게 받아들일 수 있습니다.'],
  乙: ['주변의 조건을 읽고 다른 경로나 협력을 찾는 유연함', '여러 입장을 수용하는 과정에서 자기 기준의 경계가 흐려질 수 있습니다.'],
  丙: ['관심과 생각을 밖으로 드러내 함께 움직이게 하는 개방성', '표현의 속도와 열의가 상대의 준비나 세밀한 사정보다 앞설 수 있습니다.'],
  丁: ['가까운 사람과 중요한 작업에 오래 집중하는 세심함', '집중하는 대상이 좁아질수록 작은 반응의 차이를 크게 받아들일 수 있습니다.'],
  戊: ['맡은 자리를 지키며 쉽게 흔들리지 않는 안정감', '기준을 유지하는 힘이 강할수록 방향을 다시 조정하는 데 시간이 걸릴 수 있습니다.'],
  己: ['생활의 필요를 세밀하게 챙기고 조건을 조정하는 감각', '챙겨야 할 사정을 넓게 받아들이면 자기 몫을 넘어선 부담이 쌓일 수 있습니다.'],
  庚: ['애매한 문제의 핵심을 가르고 결정을 내리는 명료함', '분명한 결론을 중시하는 만큼 중간 사정이나 감정의 차이를 단순화할 수 있습니다.'],
  辛: ['작은 차이를 구분하며 결과의 완성도를 높이는 정교함', '기준이 높아질수록 미완성이나 다른 방식에 대한 허용 폭이 좁아질 수 있습니다.'],
  壬: ['넓은 정보를 받아들이고 상황에 맞는 길을 찾는 적응력', '여러 가능성을 함께 보다가 집중할 방향이 분산될 수 있습니다.'],
  癸: ['드러나지 않은 사정을 읽고 생각을 깊이 모으는 섬세함', '속으로 정리한 내용이 많을수록 자기 뜻을 밖으로 드러내는 시점은 늦어질 수 있습니다.'],
};
const COPY = {
  money: {
    peer: ['비겁은 일간과 같은 오행의 관계라서 자율성과 동료 의식에 연결합니다. 금전 영역에서는 얼마를 가질지보다 지출의 결정권과 공동 비용의 경계에 민감한 성향으로 설명됩니다.', '독립적인 기준은 관계 분위기에 휩쓸리지 않는 관리의 바탕입니다. 반면 비교나 경쟁이 소비의 기준으로 들어오면 필요한 지출과 관계를 위한 지출의 구분이 흐려질 수 있습니다.'],
    output: ['식상은 일간이 만들어 내는 오행의 관계입니다. 금전 영역에서는 기술·아이디어·돌봄이 결과물과 가치로 바뀌는 과정에 관심이 실리는 성향으로 연결됩니다.', '재료와 경험을 쓸모 있는 결과로 바꾸는 생산성이 강점입니다. 완성의 만족이 투입한 시간과 비용보다 앞서면 결과물의 가치와 유지 비용 사이에 차이가 생길 수 있습니다.'],
    resource: ['재성은 일간이 다루는 오행의 관계입니다. 그래서 금전 영역에서는 자원의 크기를 예언하지 않고, 시간·돈·기회를 실제 조건에 맞게 배치하려는 성향으로 해석합니다.', '얻을 것과 유지할 것을 구체적으로 다루는 감각이 강점입니다. 다만 기회를 넓히는 욕구와 기반을 지키려는 욕구가 충돌하면 선택의 부담도 커집니다.'],
    responsibility: ['관성은 일간에 기준과 제약을 주는 관계입니다. 금전 영역에서는 계약·의무·공동의 약속을 중요하게 여기며 책임을 비용과 연결하는 성향으로 설명됩니다.', '합의된 지출과 책임을 일관되게 다루는 태도가 장점입니다. 의무감이 강해지면 타인의 몫까지 자기 부담으로 받아들이기 쉬운 점이 주의에 해당합니다.'],
    learning: ['인성은 일간을 돕는 오행의 관계입니다. 금전 영역에서는 지식·준비·도움받을 기반에 자원을 쓰며, 이해할 수 있는 조건을 확보하려는 성향으로 연결합니다.', '충분한 이해를 바탕으로 자원을 사용하는 신중함이 강점입니다. 준비의 완성도에 비해 실제 활용이 뒤처지면 배움이나 도구의 축적이 부담으로 남을 수 있습니다.'],
  },
  work: {
    peer: ['같은 오행의 비겁은 대등한 관계와 자기 기준을 뜻합니다. 업무에서는 맡은 부분을 독립적으로 결정하고 동료와 역할을 나누는 방식에 무게가 실립니다.', '자기 영역을 꾸준히 책임지는 힘이 강점입니다. 결정권의 경계가 흐린 조직에서는 자율성을 지키려는 태도가 협업의 마찰로 드러날 여지가 있습니다.'],
    output: ['일간이 만들어 내는 식상은 표현과 생산의 연결입니다. 직업 영역에서는 생각을 설명·제작·개선으로 옮기며 눈에 보이는 결과를 중시하는 성향으로 해석됩니다.', '아이디어를 구체화하고 기존 방식의 빈틈을 보완하는 감각이 장점입니다. 표현의 자유와 조직의 절차가 맞지 않으면 내용보다 전달 방식에서 긴장이 생길 수 있습니다.'],
    resource: ['일간이 다루는 재성은 사람·시간·도구의 배치와 연결됩니다. 업무에서는 추상적인 목표를 실제 자원과 성과의 조건으로 바꾸어 이해하는 성향을 나타내는 해석입니다.', '현실적인 조건을 파악하고 필요한 자원을 연결하는 힘이 있습니다. 동시에 관리할 범위가 넓어지면 성과를 내는 일과 유지하는 일의 부담이 함께 커질 수 있습니다.'],
    responsibility: ['일간에 기준을 주는 관성은 역할·마감·평가의 구조와 연결합니다. 직업 영역에서는 기대가 분명한 환경에서 책임의 범위를 정돈하려는 성향으로 설명됩니다.', '절차와 약속을 지켜 신뢰를 만드는 태도가 강점입니다. 모든 기대를 자기 책임으로 받아들이면 실제 업무의 경계가 좁아지거나 압박이 커질 수 있습니다.'],
    learning: ['일간을 돕는 인성은 배우고 이해하는 기반입니다. 업무에서는 자료의 맥락을 파악하고 지식을 쌓아 판단의 정확도를 높이는 방식에 관심이 실립니다.', '복잡한 정보를 정리하고 경험을 다음 작업에 연결하는 힘이 장점입니다. 이해가 충분해야 한다는 기준이 높으면 결과를 밖으로 내는 시점이 늦어질 수 있습니다.'],
  },
  love: {
    peer: ['대등한 관계를 뜻하는 비겁을 연애에 연결하면 친밀함 속에서도 자기 선택권을 유지하려는 성향입니다. 가까움과 독립을 동시에 중요하게 보는 해석입니다.', '상대에게 지나치게 의존하지 않는 자율성이 강점입니다. 반면 각자의 방식이 부딪힐 때는 마음의 차이보다 누가 옳은지의 경쟁이 앞설 수 있습니다.'],
    output: ['표현하고 만들어 내는 식상은 연애에서 마음을 말과 행동으로 드러내는 방식과 연결됩니다. 친밀감이 추상적인 생각보다 표현·돌봄·함께한 활동을 통해 구체화되는 성향입니다.', '작은 행동으로 애정을 전달하고 관계의 분위기를 만드는 힘이 있습니다. 전달한 의도와 상대가 받아들인 느낌이 다르면 표현의 양과 이해의 깊이 사이에 차이가 생길 수 있습니다.'],
    resource: ['자원을 다루는 재성을 연애에 연결하면 시간과 노력을 들여 관계를 구체적으로 유지하려는 성향입니다. 상대에게 무엇을 제공하고 함께 무엇을 할지가 친밀감의 표현과 이어집니다.', '관계를 현실적인 관심과 행동으로 이어 가는 점이 장점입니다. 베푼 만큼의 반응을 당연하게 기대하면 애정이 주고받는 양의 비교로 바뀔 여지가 있습니다.'],
    responsibility: ['기준과 약속의 관성은 연애에서 일관된 태도와 관계의 신뢰를 중시하는 성향으로 연결됩니다. 불분명한 상태보다 서로의 기대가 정돈된 관계를 편안하게 보는 해석입니다.', '약속을 지키며 관계에 안정감을 주는 태도가 강점입니다. 기준이 상대를 이해하는 틀보다 평가하는 잣대가 되면 친밀감의 여유가 줄어들 수 있습니다.'],
    learning: ['지지와 이해를 뜻하는 인성은 연애에서 마음을 들어 주고 보호받는 경험에 연결됩니다. 정서적인 안전감과 서로를 이해할 여유를 중시하는 성향입니다.', '상대의 사정을 받아들이고 관계의 정서적 기반을 지키는 힘이 있습니다. 도움과 조언이 많아질수록 상대의 선택권이나 직접적인 감정 표현이 가려질 수 있습니다.'],
  },
  marriage: {
    peer: ['공동생활에서 비겁은 각자의 자율성과 동등한 결정권을 뜻하는 해석입니다. 가까운 사이여도 개인의 방식과 공동의 영역을 분리하려는 성향으로 연결합니다.', '한쪽에만 의존하지 않는 대등함이 장점입니다. 서로 다른 생활 기준을 각자의 권리로만 고수하면 공동의 합의를 만드는 과정은 느려질 수 있습니다.'],
    output: ['공동생활에서 식상은 돌봄·표현·생활의 결과물을 만드는 관계입니다. 애정의 의도가 식사·정리·작은 배려처럼 반복되는 행동으로 이어지는 성향에 연결합니다.', '함께 사는 일상을 구체적으로 가꾸는 힘이 있습니다. 돌봄의 의도와 실제 노동의 분배가 다르면 고마움과 부담이 한쪽에만 쌓일 수 있는 점이 주의입니다.'],
    resource: ['공동생활의 재성은 시간·돈·주거 자원의 운영과 연결됩니다. 함께 유지할 기반을 현실적인 조건으로 이해하고 생활의 지속성을 중요하게 보는 성향입니다.', '막연한 기대를 실제 생활의 틀로 바꾸는 감각이 강점입니다. 자원 배분의 기준이 관계의 감정적 차이까지 모두 설명하는 도구가 되면 친밀함이 손익의 비교로 좁아질 수 있습니다.'],
    responsibility: ['관성은 공동생활에서 지킬 약속과 역할의 지속성을 뜻합니다. 관계의 안정감을 책임과 일관된 행동에서 찾으려는 성향으로 연결되는 해석입니다.', '공동의 기준을 지켜 생활을 안정시키는 힘이 있습니다. 책임을 지는 쪽이 기준까지 독점하면 신뢰의 구조가 지시와 순응의 구조로 바뀔 여지가 있습니다.'],
    learning: ['인성은 공동생활에서 서로의 준비와 회복을 지지하는 기반입니다. 의지할 수 있는 관계와 익숙한 생활의 안전감을 중시하는 성향으로 연결합니다.', '상대의 변화나 배움을 기다려 주는 포용성이 강점입니다. 보호와 지원이 중요한 결정을 대신하는 형태로 커지면 관계 안의 자율성이 약해질 수 있습니다.'],
  },
  rest: {
    peer: ['비겁은 생활 리듬에서도 자기 속도와 결정권을 지키려는 성향에 연결됩니다. 이 영역은 몸의 상태가 아니라 일정과 관계 속에서 개인의 여유를 대하는 방식을 설명합니다.', '타인의 흐름과 구분되는 자기 리듬이 장점입니다. 교류와 경쟁의 속도에 맞추려는 힘이 커지면 자율성과 휴식 사이에 긴장이 생길 수 있습니다. 지속되는 증상은 명반이 아니라 의료적 평가의 영역입니다.'],
    output: ['식상은 만들고 표현하는 활동이 생활의 만족과 연결되는 성향입니다. 편안한 몰입과 반복되는 결과를 중시하므로 생산의 리듬과 쉬는 리듬이 가까이 놓이는 해석입니다.', '즐거움과 활동을 자연스럽게 이어 가는 힘이 있습니다. 몰입의 만족이 크면 멈출 시점이 흐려지기 쉬우나, 이것이 체질이나 질병을 뜻하지는 않습니다. 지속되는 증상은 의료적 평가가 필요합니다.'],
    resource: ['재성은 유지할 일과 자원을 현실적으로 다루는 성향입니다. 생활 리듬에서는 해야 할 일을 관리하고 기반을 확보하려는 태도와 연결되며 장기나 질병의 판정은 아닙니다.', '일상의 조건을 구체적으로 파악하는 감각이 장점입니다. 관리할 항목이 늘어날수록 쉬는 시간까지 효율의 대상으로 다루는 부담이 생길 수 있습니다. 신체·정신 증상은 별도의 의료적 평가 영역입니다.'],
    responsibility: ['관성은 맡은 역할과 의무를 생활의 기준으로 삼는 성향입니다. 회복 영역에서는 역할을 끝내는 기준과 쉴 수 있다는 감각의 관계를 설명하는 데 사용합니다.', '규칙적인 생활을 유지하는 힘이 강점입니다. 의무를 마쳐야만 쉴 수 있다는 기준이 강해지면 긴장이 오래 이어질 수 있으나, 질환의 존재나 원인을 뜻하지는 않습니다. 증상의 판단은 의료 전문가의 영역입니다.'],
    learning: ['인성은 정리·이해·보호받는 환경을 편안함과 연결하는 성향입니다. 생활 리듬에서는 자극을 줄이고 익숙한 기반 안에서 안정을 얻는 방식으로 해석합니다.', '생각과 경험을 차분히 정돈하는 힘이 있습니다. 이해하려는 활동이 끊이지 않으면 정보를 다루는 시간과 실제 휴식이 섞일 수 있습니다. 이 설명은 심리 진단이 아니며 증상에는 전문적인 평가가 필요합니다.'],
  },
  family: {
    peer: ['가족 영역의 비겁은 가까운 관계에서도 각자의 몫과 선택권을 구분하는 성향입니다. 친밀함과 독립이 함께 놓인 구조로 설명되며 실제 가족의 성격을 추정하지 않습니다.', '가까운 사람을 동등한 주체로 대하는 태도가 장점입니다. 서로의 권리를 지키는 데만 집중하면 도움의 기대와 관계의 온도가 다르게 느껴질 수 있습니다.'],
    output: ['가족 영역의 식상은 돌봄과 표현을 통해 관계를 구체화하는 성향입니다. 마음을 추측하는 것보다 직접적인 도움과 생활의 행동에 애정이 실리는 해석입니다.', '가까운 사람의 필요를 실제 행동으로 채우는 힘이 있습니다. 말하지 않은 기대까지 돌봄으로 대신하면 도움의 의도와 상대가 원하는 방식이 어긋날 수 있습니다.'],
    resource: ['가족 영역의 재성은 함께 쓰는 시간·돈·공간을 운영하는 방식입니다. 친밀한 관계도 지속할 수 있는 자원의 조건 위에서 이해하려는 성향으로 연결합니다.', '가족의 필요를 현실적인 역할과 자원으로 바꾸는 감각이 장점입니다. 책임의 경계가 불분명하면 애정과 비용의 부담이 섞일 수 있지만, 재산의 상속이나 손실을 뜻하지는 않습니다.'],
    responsibility: ['가족 영역의 관성은 맡은 역할과 기대를 책임의 기준으로 받아들이는 성향입니다. 관계의 안정감을 의무의 이행에서 찾는 해석이며 실제 가족사를 말하는 것은 아닙니다.', '약속을 지켜 가까운 관계에 신뢰를 더하는 힘이 있습니다. 가족의 모든 기대를 자기 의무로 받아들이면 애정과 책임을 구분하는 여유가 좁아질 수 있습니다.'],
    learning: ['가족 영역의 인성은 지지와 돌봄을 관계의 기반으로 이해하는 성향입니다. 익숙한 관계 안에서 배움과 정서적 안전감을 중요하게 보는 해석입니다.', '서로의 사정을 이해하고 보호하는 포용성이 장점입니다. 가까운 사람을 위한다는 마음이 선택을 대신하는 형태로 커지면 지원과 간섭의 경계가 흐려질 수 있습니다.'],
  },
};
const DOMAIN_ORDER = [
  ['money', '금전 · 자원을 쓰고 지키는 방식', ['resource', 'output', 'peer', 'responsibility', 'learning']],
  ['work', '직업 · 역할을 맡고 결과를 만드는 과정', ['responsibility', 'output', 'learning', 'resource', 'peer']],
  ['love', '연애 · 마음을 전하고 차이를 조율하는 방식', ['peer', 'output', 'learning', 'responsibility', 'resource']],
  ['marriage', '결혼 · 함께 살아가는 생활의 기준', ['responsibility', 'resource', 'peer', 'learning', 'output']],
  ['rest', '건강 · 생활 리듬과 회복의 여유', ['responsibility', 'learning', 'output', 'peer', 'resource']],
  ['family', '가족 · 도움과 책임을 나누는 거리', ['learning', 'peer', 'responsibility', 'output', 'resource']],
];
const DOMAIN_LEAD = {
  money: '금전 영역의 성향을 설명하는 데', work: '업무와 역할의 성향을 설명하는 데', love: '친밀감과 애정 표현을 설명하는 데',
  marriage: '공동생활의 성향을 설명하는 데', rest: '생활 리듬과 회복의 성향을 설명하는 데', family: '가족 안의 역할과 거리를 설명하는 데',
};
const YEAR_CHECK = {
  比肩: '자기 기준을 유지하는 힘이 두드러지는 해석이지만, 서로 다른 방식의 우열을 가리려는 긴장도 함께 놓입니다.',
  劫财: '공동의 목표에 힘을 모으는 활력이 장점이며, 참여한 사람의 몫과 기대가 달라질 때 분배의 부담이 커질 수 있습니다.',
  食神: '안정적인 완성과 생활의 만족을 연결하는 성향입니다. 익숙한 흐름이 편안한 만큼 급한 변경에는 속도 차이가 생길 수 있습니다.',
  伤官: '표현과 개선의 감각이 부각되는 상징입니다. 새로운 대안의 가치와 별개로 전달 방식이 관계의 긴장으로 남을 여지도 있습니다.',
  偏财: '선택지를 연결하는 폭이 넓은 해석입니다. 기회를 넓히는 속도와 자원을 유지하는 능력은 별개이므로 수익이나 확장을 보장하지 않습니다.',
  正财: '작은 약속과 지속 가능한 운영을 중시하는 성향입니다. 계획의 일관성이 장점이지만 예외 상황에서는 유연성의 부담이 생길 수 있습니다.',
  七杀: '압박 속에서 결단하는 힘을 상징합니다. 과제의 난도를 감당하려는 태도가 모든 책임을 혼자 져야 한다는 뜻으로 확대되지는 않습니다.',
  正官: '역할과 절차를 통해 신뢰를 만드는 성향입니다. 외부 기대가 뚜렷할수록 자기 기준보다 평가를 앞세우는 긴장도 생길 수 있습니다.',
  偏印: '독자적인 해석과 관점의 연결이 장점입니다. 생각의 정교함이 실제 결과나 타인의 이해와 같은 속도로 이어지지는 않을 수 있습니다.',
  正印: '배운 내용을 토대로 안정적인 판단을 만드는 성향입니다. 준비의 깊이가 장점이지만 준비가 끝났다는 기준이 높으면 결정은 늦어질 수 있습니다.',
};
const DOMAIN_GODS = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];
// Each actual relation has a distinct declarative interpretation in each area.
const DOMAIN_THEMES = {
  money: [
    ['지출의 우선순위를 스스로 정하려는 성향', '결정권을 중시하는 만큼 공동 비용에서는 기준 차이에 민감할 수 있습니다.'],
    ['사람과 자원을 함께 움직여 기회를 만드는 성향', '공동의 이익에 적극적이지만 각자의 몫이 불분명하면 경쟁의 긴장이 생길 수 있습니다.'],
    ['익힌 기술과 결과물의 가치를 꾸준히 쌓는 성향', '완성하는 즐거움이 크지만 투입한 비용보다 만족이 앞설 여지가 있습니다.'],
    ['불합리한 비용 구조를 발견하고 바꾸려는 성향', '비효율을 줄이는 감각과 기존 기준에 대한 마찰이 함께 놓입니다.'],
    ['새 기회와 사람·정보를 자원의 가능성으로 연결하는 성향', '기회를 보는 폭이 넓은 만큼 동시에 유지할 범위가 커지기 쉽습니다.'],
    ['정해진 비용과 생활의 지속성을 세밀하게 관리하는 성향', '반복 관리에 강점이 있으나 예상 밖의 지출에는 부담을 크게 느낄 수 있습니다.'],
    ['큰 책임이 걸린 자원 문제에서 빠르게 판단하려는 성향', '결단의 속도가 장점이지만 책임과 비용을 혼자 떠안을 여지도 있습니다.'],
    ['계약과 공동의 약속을 자원 운영의 기준으로 삼는 성향', '합의된 기준에 충실한 만큼 의무의 경계가 흐릴 때 부담이 커질 수 있습니다.'],
    ['돈과 시간을 쓰기 전에 독자적으로 구조를 이해하려는 성향', '새로운 관점에 민감하지만 준비와 도구의 축적이 활용을 앞설 수 있습니다.'],
    ['배움과 도움받을 기반에 자원을 배치하는 성향', '이해한 조건을 신중하게 다루지만 준비된 상태를 유지하는 비용이 늘 수 있습니다.'],
  ],
  work: [
    ['업무의 결정권과 자기 역할을 독립적으로 지키려는 성향', '맡은 영역을 꾸준히 책임지지만 역할이 겹치는 조직에서는 마찰이 생길 수 있습니다.'],
    ['동료와 힘을 모아 공동 성과에 적극적으로 참여하는 성향', '협업을 움직이는 활력과 성과 배분에 대한 민감함이 함께 놓입니다.'],
    ['익숙한 기술로 반복 가능한 결과물을 완성하는 성향', '안정적인 생산성이 강점이지만 익숙한 방식의 변경에는 시간이 걸릴 수 있습니다.'],
    ['기존 절차의 문제를 발견하고 개선안을 제시하는 성향', '새 대안을 만드는 감각이 좋지만 표현이 거칠면 내용보다 반발이 앞설 수 있습니다.'],
    ['사람·도구·정보를 목표에 맞게 연결하는 성향', '현실적인 자원 감각이 장점이지만 관리할 일이 넓어지면 집중이 분산될 수 있습니다.'],
    ['작은 마감과 품질 기준을 지속해서 유지하는 성향', '반복되는 업무에서 신뢰가 쌓이는 반면 갑작스러운 우선순위 변경은 부담이 될 수 있습니다.'],
    ['난도가 높은 과제에서 핵심을 좁혀 결단하는 성향', '긴장된 상황의 집중력이 장점이지만 혼자 버티는 방식으로 굳어질 여지가 있습니다.'],
    ['역할·절차·평가 기준에 맞추어 업무를 정돈하는 성향', '공식적인 책임에 충실하지만 외부 평가가 자기 판단을 압도할 수 있습니다.'],
    ['낯선 정보를 연결하여 독자적인 해법을 만드는 성향', '관점의 새로움이 강점이며 생각을 공유 가능한 결과로 바꾸는 속도는 다를 수 있습니다.'],
    ['지식과 경험을 정리하여 업무 판단의 기반을 쌓는 성향', '맥락을 이해하는 깊이가 장점이지만 준비가 길어지면 결과를 내는 시점은 늦어질 수 있습니다.'],
  ],
  love: [
    ['친밀한 관계에서도 각자의 속도와 선택권을 중시하는 성향', '의존에 치우치지 않는 대등함이 장점이지만 방식의 차이가 자존심의 대립이 될 수 있습니다.'],
    ['함께한 경험과 관계의 활력에 적극적으로 반응하는 성향', '관계를 생기 있게 만드는 힘과 서로의 반응을 비교하는 민감함이 함께 놓입니다.'],
    ['작은 돌봄과 반복되는 행동으로 애정을 표현하는 성향', '편안한 친밀감을 쌓는 힘이 있으나 불편한 대화를 미루는 여지도 있습니다.'],
    ['솔직한 말과 자기만의 표현으로 마음을 드러내는 성향', '표현의 개성이 장점이지만 의도보다 말의 강도가 크게 전해질 수 있습니다.'],
    ['다양한 경험과 현실적인 제안으로 가까워지는 성향', '관심의 폭이 넓고 행동이 구체적이지만 관계에 들인 자원이 보답의 기대와 섞일 수 있습니다.'],
    ['작은 약속을 꾸준히 지키며 친밀감을 쌓는 성향', '일관성이 안정감을 주는 반면 관계의 예외적인 변화에는 적응이 느릴 수 있습니다.'],
    ['관계의 방향을 빠르게 정하고 책임지려는 성향', '분명한 태도가 장점이지만 친밀감의 속도 차이를 압박으로 만들 여지도 있습니다.'],
    ['연락과 만남에서 합의된 기준을 중요하게 보는 성향', '신뢰를 지키는 태도가 장점이며 기준이 엄격해지면 감정의 여유가 줄 수 있습니다.'],
    ['상대의 말에 담긴 맥락을 깊이 해석하려는 성향', '미묘한 차이를 알아보는 감각과 혼자 만든 해석이 커질 가능성이 함께 놓입니다.'],
    ['상대의 사정을 이해하고 정서적인 지지를 중시하는 성향', '포용성이 관계의 기반이 되지만 위로와 조언이 상대의 표현을 대신할 수도 있습니다.'],
  ],
  marriage: [
    ['공동생활에서도 개인의 결정 영역을 중요하게 보는 성향', '대등한 관계의 기반이 되지만 각자의 기준이 고정되면 합의가 늦어질 수 있습니다.'],
    ['함께 쓰는 자원과 각자의 기여에 민감한 성향', '공동의 생활을 움직이는 힘이 있으나 분담의 차이가 경쟁으로 번질 여지가 있습니다.'],
    ['돌봄과 생활의 작은 결과로 관계를 유지하는 성향', '일상을 가꾸는 힘이 장점이며 보이지 않는 노동의 쏠림에는 민감할 수 있습니다.'],
    ['불편한 생활 규칙을 바꾸고 새로운 방식을 제안하는 성향', '정체된 관계를 개선하는 감각과 상대의 기존 방식을 건드리는 마찰이 함께 놓입니다.'],
    ['새로운 생활 계획과 자원의 가능성을 넓게 보는 성향', '변화의 선택지를 만드는 힘이 있지만 계획을 유지할 비용도 커질 수 있습니다.'],
    ['생활비와 반복 일정의 안정성을 중시하는 성향', '예측 가능한 기반을 만드는 힘이 장점이며 변화에 대한 경직성이 주의입니다.'],
    ['공동생활의 어려운 결정을 책임지고 이끌려는 성향', '분명한 결단이 도움이 되지만 책임과 결정권이 한쪽으로 쏠릴 여지가 있습니다.'],
    ['지킬 약속과 공동생활의 질서를 중요하게 보는 성향', '일관된 역할이 안정감을 주지만 한쪽의 기준이 규칙 전체가 될 가능성도 있습니다.'],
    ['가까운 관계 안에서도 혼자 이해하고 정리할 공간을 중시하는 성향', '서로 다른 관점을 유지하는 힘과 생활의 공유가 적어질 여지가 함께 놓입니다.'],
    ['서로의 준비와 회복을 지지하는 안전한 기반을 중시하는 성향', '기다려 주는 포용성이 장점이지만 중요한 결정을 대신하는 보호로 커질 수 있습니다.'],
  ],
  rest: [
    ['관계와 일정 속에서도 자기 리듬을 유지하려는 성향', '자기 속도를 지키는 힘이 있으나 주변과의 비교가 쉬는 감각을 흐릴 수 있습니다.'],
    ['사람과 함께 움직이는 활동에서 활력을 얻는 성향', '교류의 생동감이 장점이지만 공동 일정이 개인의 여유를 잠식할 수 있습니다.'],
    ['편안한 몰입과 반복되는 생활의 만족을 중시하는 성향', '무리 없는 속도를 선호하지만 즐거운 작업에서는 멈추는 시점이 흐려질 수 있습니다.'],
    ['생각과 감정을 표현하면서 긴장을 해소하려는 성향', '표현의 통로가 분명한 반면 자극과 반응이 이어지면 조용한 휴식과 거리가 생길 수 있습니다.'],
    ['생활의 여러 활동과 자원을 넓게 운영하려는 성향', '다양한 일상을 연결하는 감각이 있지만 유지할 활동의 수만큼 부담도 늘 수 있습니다.'],
    ['수면·식사처럼 반복되는 생활의 예측 가능성을 중시하는 성향', '일정한 리듬이 안정감을 주지만 계획이 깨졌을 때의 부담도 클 수 있습니다.'],
    ['긴장된 과제에서 에너지를 집중하는 성향', '집중력이 장점이며 과제를 끝낼 때까지 회복을 미루는 경향으로 연결될 수 있습니다.'],
    ['해야 할 역할을 마친 뒤에야 휴식을 편안하게 느끼는 성향', '생활을 정돈하는 힘이 있지만 의무의 기준이 높으면 쉬는 여유가 좁아질 수 있습니다.'],
    ['혼자 생각을 정리하고 자극을 줄이는 상태를 중시하는 성향', '내면을 정돈하는 깊이와 정보를 놓지 못하는 부담이 함께 놓입니다.'],
    ['익숙한 환경과 지지받는 관계에서 안정을 얻는 성향', '정서적 기반을 유지하는 힘이 있지만 편안한 틀을 벗어나는 데 시간이 걸릴 수 있습니다.'],
  ],
  family: [
    ['가까운 관계에서도 각자의 몫과 선택권을 중시하는 성향', '서로를 동등하게 대하는 태도가 장점이며 도움의 기대가 다르면 거리감이 생길 수 있습니다.'],
    ['가족과 함께 쓰는 시간과 비용의 분배에 민감한 성향', '공동의 일을 움직이는 힘이 있으나 기여와 보답을 비교하는 긴장도 생길 수 있습니다.'],
    ['실제 도움과 작은 돌봄으로 애정을 드러내는 성향', '가까운 필요를 채우는 힘이 있지만 도움의 의도와 상대의 필요가 같지는 않을 수 있습니다.'],
    ['가족 안의 불합리한 기준을 직접 표현하려는 성향', '바꿀 지점을 분명히 드러내지만 표현이 사람 전체에 대한 평가로 들릴 여지가 있습니다.'],
    ['가족의 새로운 계획에 자원과 가능성을 연결하는 성향', '현실적인 지원의 폭이 넓지만 지원을 유지할 부담도 함께 커질 수 있습니다.'],
    ['지속할 수 있는 돌봄과 생활 기반을 중요하게 보는 성향', '반복되는 지원의 신뢰가 장점이며 변화한 사정에도 기존 역할을 고수할 수 있습니다.'],
    ['가족의 급한 문제에서 결단과 책임을 앞세우는 성향', '위기감 속 추진력이 장점이지만 모든 부담을 자기 몫으로 받아들일 여지도 있습니다.'],
    ['가족 안에서 맡은 역할과 기대에 충실하려는 성향', '책임의 일관성이 신뢰를 더하지만 합의하지 않은 기대까지 의무로 느낄 수 있습니다.'],
    ['말보다 사정과 맥락을 혼자 깊이 이해하려는 성향', '복잡한 상황을 받아들이는 감각과 확인되지 않은 해석이 커질 가능성이 함께 놓입니다.'],
    ['익숙한 관계의 지지와 돌봄을 중요한 기반으로 삼는 성향', '보호하고 기다리는 힘이 장점이며 지원과 간섭의 경계가 흐려질 수 있습니다.'],
  ],
};
const domainTheme = (id, key) => DOMAIN_THEMES[id][DOMAIN_GODS.indexOf(key)] || null;
const reportSection = (id, title, paragraphs, groupLabel = '') => ({ id, title, text: '', paragraphs, items: [], ...(groupLabel ? { groupLabel } : {}) });
const highlightSection = (section, candidates) => {
  if (section.highlights?.length) return section;
  if (!/^(?:symbols|saju-cycle-flow|saju-domain-.+|saju-year-\d+|saju-conclusion)$/.test(section.id)) return section;
  const content = [section.text, ...(section.paragraphs || []), ...(section.items || [])].join('\n');
  const highlights = [...new Set(candidates)].filter((phrase) => typeof phrase === 'string' && phrase.length >= 12 && phrase.length <= 180 && content.includes(phrase)).slice(0, 3);
  return highlights.length ? { ...section, highlights } : section;
};
const normalizedGod = (value) => typeof value === 'string' ? value.replace(/[財傷殺]/g, (char) => ({ 財: '财', 傷: '伤', 殺: '杀' }[char])) : '';
const focusFor = (value) => Object.hasOwn(FOCUS, normalizedGod(value)) ? FOCUS[normalizedGod(value)] : null;
const byId = (sections, id) => sections.find((item) => item.id === id);
const withGroup = (section, groupLabel, extras = {}) => ({ ...section, groupLabel, ...extras });

function collectEvidence(pillars, format) {
  const entries = [];
  for (const pillar of pillars) {
    const key = normalizedGod(pillar.stemTenGod);
    if (Object.hasOwn(FAMILY, key)) entries.push({ key, family: FAMILY[key], source: `${pillar.label} 천간 ${format.stem(pillar.stem)}`, hidden: false, hiddenIndex: -1 });
    if (!Array.isArray(pillar.hiddenStems) || !Array.isArray(pillar.branchTenGods)) continue;
    pillar.hiddenStems.forEach((stem, index) => {
      const hidden = normalizedGod(pillar.branchTenGods[index]);
      if (Object.hasOwn(FAMILY, hidden)) entries.push({ key: hidden, family: FAMILY[hidden], source: `${pillar.label} 지지 ${format.branch(pillar.branch)}의 지장간 ${format.stem(stem)}`, hidden: true, hiddenIndex: index });
    });
  }
  return entries;
}

/** Receives only the values admitted by reading-detail's existing guards. */
export function buildSajuReport({ day, pillars, professional, cycles, format }) {
  const chart = byId(professional, 'saju-chart');
  if (!day || !chart?.table) return [withGroup(chart, GROUPS[0]), reportSection('symbols', '확인된 구조부터 읽겠습니다', [
    '원국의 기둥이 서로 일치하는지 확인하지 못했습니다. 일부 기호만 보고 타고난 구조나 분야별 결론을 채우지 않겠습니다.',
    '계산된 원국표를 다시 확인한 뒤 일간·십성·대운을 같은 자료 안에서 연결하는 순서가 필요합니다.',
    '출생일과 생시 반영 여부의 정합성이 불충분하므로 확인되지 않은 성향이나 생애 사건은 제시하지 않습니다.',
  ]), reportSection('saju-conclusion', '지금 확인할 핵심', ['이 결과에서는 판독에 필요한 원국 자료가 충분히 일치하지 않습니다. 실제 기호를 확인한 뒤 다시 읽는 것이 먼저입니다.'], GROUPS[4])];
  const evidence = collectEvidence(pillars, format);
  const data = cycles.data ?? {};
  const daYun = data.daYun, annual = data.annual;
  const visible = evidence.filter((entry) => !entry.hidden);
  const distinct = visible.filter((entry, index) => visible.findIndex((item) => item.key === entry.key) === index);
  const month = pillars.find((item) => item.key === 'month');
  const literalTable = byId(professional, 'saju-elements')?.table;
  const countLine = literalTable?.rows.map((row) => `${row[0]} ${row[1]}`).join(' · ');
  const stemStory = STEM_STRUCTURE[day.stem.hanja];
  const stemTone = STEM_TONE[day.stem.hanja];
  const sections = [withGroup(chart, GROUPS[0]), reportSection('symbols', `${day.name} 일주에서 연결되는 성향의 구조`, [
    `1. 출생일의 구조\n${day.label}에서 일간은 ${format.stem(day.stem.hanja)}이며 ${day.stem.element}(${day.stem.elementHanja})에 속합니다. 일지는 ${format.branch(day.branch.hanja)}이며 ${day.branch.element}(${day.branch.elementHanja})에 속하는 출생일의 지지입니다.\n\n2. 월주와 오행 배치\n월주는 ${month.ganZhi}, 월간은 ${format.stem(month.stem)}, 월지는 ${format.branch(month.branch)}입니다. 본오행 글자 수는 ${countLine || '미확인'}입니다. 이 수치는 배치의 정보이며 기운의 강약이나 성격의 결함을 뜻하지 않습니다.`,
    `1. 일간을 성향에 연결한 이유\n${format.stem(day.stem.hanja)}의 전통적 비유는 ‘${stemStory[0]}’입니다. 이 비유의 움직임과 쓰임을 사람의 태도로 옮긴 것이 ${stemStory[1]}입니다.\n\n2. 다른 글자와의 관계\n${distinct.length ? distinct.map((entry, index) => `${index + 1}) ${entry.source}의 ${format.tenGod(entry.key)} · ${focusFor(entry.key)[1]}.`).join('\n\n') : '천간의 십성 원문이 충분하지 않아 관계별 성향은 확장하지 않았습니다.'}`,
    `1. 구조에서 읽는 강점\n${stemTone[0]}입니다. 일간은 해석의 중심이며, 십성은 이 중심이 표현·자원·책임·배움·동료 관계와 어떻게 연결되는지를 구분합니다.\n\n2. 주의가 필요한 방향\n${stemTone[1]} 천간, 지장간의 첫 항목인 본기, 나머지 지장간은 출처를 나누는 순서입니다. 이 읽기 순서는 힘의 우열이나 신강신약 판정이 아닙니다.`,
  ])];
  if (daYun) {
    const current = daYun.current, next = daYun.next;
    const currentKey = normalizedGod(current?.stemTenGod), nextKey = normalizedGod(next?.stemTenGod);
    const currentFocus = focusFor(currentKey), nextFocus = focusFor(nextKey);
    sections.push(reportSection('saju-cycle-flow', '원국은 기준이고, 대운은 시간의 구간입니다', [
      `${data.asOf} 기준 (${data.timeZone || 'Asia/Seoul'}). 대운은 기운일부터 약 10년씩 이어지는 간지 구간입니다. 첫 기운일은 ${daYun.startSolar}이며 ${daYun.direction === 'forward' ? '순행' : '역행'}합니다. ${current ? `현재는 ${format.cycleGanZhi(current)} 대운입니다.\n${format.cyclePeriod(current)}` : daYun.rangeStatus === 'before-first' ? '아직 첫 대운이 시작되기 전입니다. 실제 첫 기운일 전의 구간을 대운 하나로 만들어 표시하지 않습니다.' : '기준 시각이 제공된 목록의 범위를 벗어났습니다. 현재 대운을 연장해 만들지 않았습니다.'}`,
      current && currentFocus ? `1. 현재 구간을 성향과 연결한 이유\n천간 ${format.stem(current.stem)}의 관계 이름은 ${format.tenGod(currentKey)}입니다. 이를 ${currentFocus[1]}에 연결합니다.\n\n2. 강점과 긴장\n${currentFocus[2]} ${currentFocus[3]} 지장간에는 ${current.branchTenGods.map((god) => format.tenGod(god)).join(' · ')}도 있어 하나의 관계로 10년 전체의 행동을 단정하지 않습니다.` : '현재 대운이 확인되지 않아 이 구간의 성향 주제는 확정하지 않았습니다. 원국의 관계와 세운의 간지는 각각 확인된 범위 안에서 설명됩니다.',
      next && nextFocus ? `1. 다음 구간의 실제 자료\n${format.cycleGanZhi(next)} 대운입니다.\n${format.cyclePeriod(next)}\n\n2. 연결되는 특성\n천간의 관계는 ${format.tenGod(nextKey)}이며 ${nextFocus[1]}을 상징합니다. ${nextFocus[2]} ${nextFocus[3]} 교운은 간지 구간의 경계이지 성격이 바뀌거나 특정 사건이 반드시 생기는 날짜는 아닙니다.` : '제공된 목록 안에 다음 대운이 없어 다음 간지를 추정하지 않았습니다. 변곡점의 사건도 별도로 만들어 제시하지 않겠습니다.',
    ], GROUPS[1]));
  } else {
    const missing = byId(cycles.sections, 'saju-da-yun') || byId(cycles.sections, 'saju-cycles');
    sections.push(reportSection('saju-cycle-flow', '확인되는 흐름과 비어 있는 흐름', [
      missing?.items?.[0] || '대운의 기산과 기간을 확인하지 못해 현재·다음 대운을 정하지 않았습니다.',
      '대운이 비어 있을 때는 어린 시절부터 노년까지 어떤 일이 일어난다고 이어 쓰지 않습니다. 생시나 전통 계산용 성별을 모른다면 그 정보를 추정하는 대신, 확인된 원국과 연간의 주제를 분리해 읽겠습니다.',
      annual ? `세운은 독립 계산되어 ${annual.currentYear}년부터 다섯 입춘 구간을 확인할 수 있습니다. 아래 시기별 정리에서는 이 실제 연간 자료만 사용합니다.` : '세운도 확인되지 않은 경우에는 연도별 사건이나 중요한 해를 별도로 만들어 제시하지 않습니다.',
    ], GROUPS[1]));
  }
  for (const [id, title, priorities] of evidence.length ? DOMAIN_ORDER : []) {
    const rank = (entry) => !entry.hidden ? 0 : entry.hiddenIndex === 0 ? 1 : 2;
    const related = evidence.filter((entry) => priorities.slice(0, 3).includes(entry.family));
    const pool = [...(related.length ? related : evidence)].sort((left, right) => rank(left) - rank(right));
    const primary = pool[0];
    const secondary = pool.find((entry) => entry.key !== primary?.key)
      || evidence.find((entry) => entry.key !== primary?.key) || pool.find((entry) => entry !== primary);
    const selected = primary ? [primary, ...(secondary ? [secondary] : [])] : [];
    const family = primary?.family;
    const copy = COPY[id][family];
    const primaryTheme = primary ? domainTheme(id, primary.key) : '';
    const secondaryTheme = secondary && primary.key !== secondary.key ? domainTheme(id, secondary.key) : '';
    sections.push(reportSection(`saju-domain-${id}`, title, selected.length ? [
      `${DOMAIN_LEAD[id]} 참고한 항목입니다.\n\n${selected.map((entry, index) => `${index + 1}. ${entry.source}의 ${format.tenGod(entry.key)}`).join('\n\n')}\n\n다루는 주제: ${FAMILY_LABEL[family]}.`,
      `${copy[0]}\n\n1. ${format.tenGod(primary.key)}에 연결되는 성향\n${primaryTheme[0]}입니다.${secondaryTheme ? `\n\n2. 보조 관계 · ${format.tenGod(secondary.key)}\n${secondaryTheme[0]}도 함께 놓입니다.` : ''}`,
      `1. 이 분야의 강점과 주의\n${copy[1]}\n\n2. ${format.tenGod(primary.key)}에서 두드러지는 특성\n${primaryTheme[1]}${secondaryTheme ? `\n\n3. 보조 관계인 ${format.tenGod(secondary.key)}의 특성\n${secondaryTheme[1]}` : ''}`,
    ] : [
      '이 분야에 연결할 십성 원문이 충분히 확인되지 않았습니다. 날짜나 일간만으로 성향·생활 이력·미래의 결과를 보충하지 않겠습니다.',
      '표가 말해 주는 자료와 실제 삶에서 확인해야 할 자료를 나누어 두는 것이 필요합니다. 지금은 이 영역의 맞춤 결론을 미리 정하지 않겠습니다.',
      '자료가 비어 있는 상태에서는 성향의 강점과 주의점을 개인별 결과로 제시하지 않습니다.',
    ], id === 'money' ? GROUPS[2] : ''));
    if (selected.length) {
      const currentSection = sections.at(-1);
      currentSection.highlights = [primaryTheme[0], primaryTheme[1], secondaryTheme?.[1]].filter(Boolean);
    }
  }
  if (!evidence.length) sections.push(reportSection('saju-domains-unavailable', '분야별 해석을 더하지 않은 이유', [
    '분야별로 연결할 십성의 원문을 확인하지 못했습니다. 일간 하나만으로 금전·직업·관계·건강에 같은 설명을 반복하지 않겠습니다.',
    '원국표에 표시된 미확인은 그 기호가 없다는 확정과 다릅니다. 확인할 자료가 비어 있는 경우에는 부족한 성격이나 인생의 약점을 의미하지 않습니다.',
    '각 생활 영역의 강점과 주의점은 확인된 십성의 출처가 있을 때만 설명되며, 현재 상태에서는 그 연결을 제시하지 않습니다.',
  ], GROUPS[2]));
  const fullDaYun = byId(cycles.sections, 'saju-da-yun');
  if (fullDaYun?.table) sections.push(withGroup(fullDaYun, GROUPS[3], { collapsible: true }));
  const annualTable = byId(cycles.sections, 'saju-liu-nian');
  if (annualTable?.table && annual) {
    sections.push({ ...annualTable, items: [], ...(!fullDaYun?.table ? { groupLabel: GROUPS[3] } : {}) });
    for (const year of annual.years) {
      const key = normalizedGod(year.stemTenGod), focus = focusFor(key);
      if (!focus) continue;
      const matching = evidence.find((entry) => entry.key === key);
      const overlapping = daYun?.list.filter((period) => year.startSolar < period.endSolarExclusive && period.startSolar < year.endSolarExclusive) || [];
      const overlapText = overlapping.length ? `이 세운과 기간이 겹치는 대운은 ${overlapping.map((period) => `${format.cycleGanZhi(period)} · ${format.tenGod(period.stemTenGod)}`).join(' / ')}입니다.${overlapping.length > 1 ? ' 한 입춘 연도 안에 교운이 걸리므로 연도 전체를 하나의 대운으로 묶지 않았습니다.' : ''}` : '이 연간에 겹치는 대운 자료는 확인되지 않아 두 흐름을 억지로 합치지 않습니다.';
      sections.push(reportSection(`saju-year-${year.year}`, `${year.year}년 · ${focus[0]}`, [
        `${year.year}년 세운은 ${format.cycleGanZhi(year)}이며, 천간의 관계는 ${format.tenGod(key)}입니다.\n${format.cyclePeriod(year)}\n연도의 경계는 1월 1일이 아니라 엔진의 입춘 시각입니다.`,
        `1. 겹치는 대운\n${overlapText}\n\n2. 성향 설명과의 연결\n${format.tenGod(key)}의 전통적 관계를 ${focus[1]}에 연결한 해석입니다. ${matching ? `원국의 ${matching.source}에도 ${format.tenGod(key)} 관계가 있어 동일한 관계가 연간에 다시 놓였습니다. 이는 설명 주제가 겹치는 근거이지 사건의 반복이나 운의 상승을 뜻하지 않습니다.` : '원국에 같은 항목이 확인되지 않더라도 출생 성격 자체가 달라진다는 뜻은 아닙니다.'}`,
        `1. 이 관계의 강점\n${focus[2]}\n\n2. 성향의 긴장과 해석 범위\n${YEAR_CHECK[key]} 연간의 상징은 실제 사건이나 행동을 측정한 값이 아닙니다.`,
      ]));
    }
  } else sections.push(reportSection('saju-liu-nian', '연도별로 확인할 자료', [
    '입춘 연간 자료를 확인하지 못해 앞으로 다섯 해의 맞춤 흐름을 정리하지 않았습니다.',
    '현재 대운이 확인되더라도 그것만으로 특정 연도의 합격·이직·결혼·질병 같은 사건을 정할 수는 없습니다.',
    '확인되지 않은 연도에는 강점·주의점이나 생애 사건을 별도로 배정하지 않습니다.',
  ], !fullDaYun?.table ? GROUPS[3] : ''));
  const firstVisible = distinct[0] || evidence[0];
  const current = daYun?.current, currentFocus = focusFor(current?.stemTenGod);
  const currentYear = annual?.years?.[0], yearFocus = focusFor(currentYear?.stemTenGod);
  const natalFocus = focusFor(firstVisible?.key);
  sections.push(reportSection('saju-conclusion', '이 원국에서 연결되는 핵심 성향', [
    `해석의 중심은 ${day.label}의 일간 ${format.stem(day.stem.hanja)}입니다. ${firstVisible ? `${firstVisible.source}의 ${format.tenGod(firstVisible.key)} 관계를 함께 사용했으며, 이를 ${natalFocus[1]}과 연결했습니다.` : '다른 글자의 관계가 충분하지 않아 일간의 상징 범위 안에서만 설명했습니다.'} 원국의 기호, 기호 사이의 관계, 생활 영역의 의미를 순서대로 연결한 결과입니다.`,
    `강점의 중심은 ${stemTone[0]}입니다. ${natalFocus ? natalFocus[2] : '추가적인 십성 강점은 원문이 충분하지 않아 확대하지 않았습니다.'}\n\n${currentFocus ? `현재의 ${format.cycleGanZhi(current)} 대운에는 ${currentFocus[1]}의 주제가 놓입니다. 출생 원국과 시간 구간은 서로 다른 층위이며 한쪽이 다른 쪽의 성향을 지우지는 않습니다.` : '현재 대운이 확인되지 않아 시간 구간의 특성을 결론에 보충하지 않았습니다.'}`,
    `1. 일간과 관계의 주의점\n${stemTone[1]} ${natalFocus ? natalFocus[3] : ''}\n\n2. 결론의 해석 범위\n${yearFocus ? `${currentYear.year}년 ${format.cycleGanZhi(currentYear)}의 ${format.tenGod(currentYear.stemTenGod)}도 계산된 연간 자료입니다. 이 상징을 개인의 미래나 현실의 결과로 확정하지 않습니다.` : '세운 자료가 없어 특정 해의 변화를 결론에 배정하지 않았습니다.'} 이 보고서의 성향은 전통 관계의 설명이며 실제 능력·성격·생활 이력을 진단한 결과는 아닙니다.`,
  ], GROUPS[4]));
  const semanticPhrases = [stemStory[1], ...stemTone, ...Object.values(FOCUS).flatMap((focus) => focus.slice(1))];
  return sections.map((item) => highlightSection(item, semanticPhrases));
}
