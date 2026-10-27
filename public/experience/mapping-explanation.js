// Explain the existing SAI symbolic mapping without changing a single weight.
// These values are not questionnaire scores, percentages, or MBTI probabilities.
const AXES = [
  { pair: 'E/I', name: '관심의 방향', letters: ['E', 'I'], descriptions: ['바깥으로 표현하고 사람들과 주고받는 이미지가 앞섰어요.', '생각을 안에서 정리하고 깊이 집중하는 이미지가 앞섰어요.'] },
  { pair: 'N/S', name: '정보를 보는 방식', letters: ['N', 'S'], descriptions: ['눈앞의 사실에서 의미와 새로운 가능성을 찾는 쪽으로 이어졌어요.', '실제 경험과 구체적인 단서를 살피는 쪽으로 이어졌어요.'] },
  { pair: 'F/T', name: '판단의 초점', letters: ['F', 'T'], descriptions: ['판단할 때 관계와 소중한 가치를 고려하는 상징이 모였어요.', '판단할 때 기준과 원리를 분명히 하는 상징이 모였어요.'] },
  { pair: 'P/J', name: '움직임의 리듬', letters: ['P', 'J'], descriptions: ['선택지를 열어 두고 상황에 맞춰 바꾸는 흐름으로 연결했어요.', '계획과 순서를 세워 꾸준히 이어 가는 흐름으로 연결했어요.'] },
];
const TIES = ['I', 'N', 'F', 'P'];
const SOURCE = {
  saju: '원국의 본오행 글자 수에 일간을 한 번 더 반영한 연결값이에요. 대운·세운과 십성은 네 글자 계산에 넣지 않았어요.',
  ziwei: '명궁 주성의 상징을 같은 비중으로 더했어요. 명궁이 공궁이면 표시된 대궁의 주성을 참고해요.',
  zodiac: '별자리의 원소와 양상을 같은 비중으로 더했어요. 출생시각이나 다른 행성의 배치는 반영하지 않았어요.',
};
const safeText = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;

export function buildMappingExplanation(result) {
  const mapping = result?.calculation?.details?.mapping;
  if (!SOURCE[result?.mode] || !Array.isArray(mapping?.axes) || mapping.axes.length !== 4
    || !Array.isArray(mapping.symbols) || !mapping.symbols.length || mapping.symbols.length > 20
    || !/^[EI][NS][FT][PJ]$/.test(result?.type ?? '')) return null;
  const symbols = mapping.symbols;
  if (symbols.some((symbol) => !safeText(symbol?.label) || !safeText(symbol?.meaning)
    || !Number.isFinite(symbol.weight) || symbol.weight < 0 || symbol.weight > 100
    || !Array.isArray(symbol.vector) || symbol.vector.length !== 4
    || symbol.vector.some((value) => !Number.isFinite(value) || Math.abs(value) > 100))) return null;
  const rows = AXES.map((axis, index) => {
    const calculated = mapping.axes[index];
    const terms = symbols.map((symbol) => ({
      label: symbol.label, meaning: symbol.meaning, weight: symbol.weight,
      value: symbol.vector[index] * symbol.weight,
    })).filter((symbol) => symbol.value !== 0);
    const positive = terms.filter((term) => term.value > 0).reduce((sum, term) => sum + term.value, 0);
    const negative = terms.filter((term) => term.value < 0).reduce((sum, term) => sum - term.value, 0);
    const balance = positive - negative;
    const letter = balance > 0 ? axis.letters[0] : balance < 0 ? axis.letters[1] : TIES[index];
    if (calculated?.axis !== axis.pair || calculated?.symbolBalance !== balance
      || calculated?.result !== letter || result.type[index] !== letter) return null;
    const winning = balance === 0 ? [] : terms.filter((term) => balance > 0 ? term.value > 0 : term.value < 0)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const causes = winning.map((term) => `${term.label} ${term.weight}회`);
    return {
      name: axis.name, letter, pair: axis.pair, positive, negative, balance,
      values: `${axis.letters[0]} ${positive} · ${axis.letters[1]} ${negative}`,
      description: balance === 0 ? '두 방향의 연결값이 같아요. 동률일 때의 고정 규칙으로 이 글자를 표시했어요.'
        : axis.descriptions[axis.letters.indexOf(letter)],
      cause: balance === 0 ? 'I·N·F·P 순의 동률 규칙이며, 어느 성향이 더 강하다는 뜻은 아니에요.'
        : `${causes.join(' · ')}의 상징이 ${letter} 쪽에 반영됐어요.`,
      terms: terms.map((term) => `${term.label} × ${term.weight}회 → ${term.value > 0 ? axis.letters[0] : axis.letters[1]} ${Math.abs(term.value)} · ${term.meaning}`),
    };
  });
  if (rows.some((row) => !row)) return null;
  return {
    title: '네 글자로 연결한 이유', source: SOURCE[result.mode], axes: rows,
    note: '아래 숫자는 SAI 자체 상징표의 연결값이에요. 정식 MBTI 검사 점수나 성향의 확률이 아니에요.',
  };
}
