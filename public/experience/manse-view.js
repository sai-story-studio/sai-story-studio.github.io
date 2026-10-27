/**
 * Pure presentation of an already-calculated lunar-javascript 1.7.7 chart,
 * with explicitly scoped natal auspicious lookups on those checked pillars.
 * No chart is recalculated, no missing pillar is inferred, and no DOM/network/
 * storage API is used. Render the returned strings with textContent.
 * Names match the existing reading-detail view and the pinned vendor values.
 */
import { calculateNatalAuspicious } from './natal-auspicious.js';
const STEMS = {
  甲: ['갑', '목', '+'], 乙: ['을', '목', '-'], 丙: ['병', '화', '+'], 丁: ['정', '화', '-'],
  戊: ['무', '토', '+'], 己: ['기', '토', '-'], 庚: ['경', '금', '+'], 辛: ['신', '금', '-'],
  壬: ['임', '수', '+'], 癸: ['계', '수', '-'],
};
const BRANCHES = {
  子: ['자', '수', '+'], 丑: ['축', '토', '-'], 寅: ['인', '목', '+'], 卯: ['묘', '목', '-'],
  辰: ['진', '토', '+'], 巳: ['사', '화', '-'], 午: ['오', '화', '+'], 未: ['미', '토', '-'],
  申: ['신', '금', '+'], 酉: ['유', '금', '-'], 戌: ['술', '토', '+'], 亥: ['해', '수', '-'],
};
const TEN_GODS = {
  比肩: '비견', 劫财: '겁재', 食神: '식신', 伤官: '상관', 偏财: '편재', 正财: '정재',
  七杀: '편관·칠살', 正官: '정관', 偏印: '편인', 正印: '정인', 日主: '일간·나',
};
const CHARACTERS = { 財: '财', 傷: '伤', 殺: '杀' };
const STAGES = { 长生: '장생', 沐浴: '목욕', 冠带: '관대', 临官: '건록·임관', 帝旺: '제왕', 衰: '쇠', 病: '병', 死: '사', 墓: '묘', 绝: '절', 胎: '태', 养: '양' };
const NAYIN = {
  海中金: '해중금', 炉中火: '노중화', 大林木: '대림목', 路旁土: '노방토', 剑锋金: '검봉금', 山头火: '산두화',
  涧下水: '간하수', 城头土: '성두토', 白蜡金: '백랍금', 杨柳木: '양류목', 泉中水: '천중수', 屋上土: '옥상토',
  霹雳火: '벽력화', 松柏木: '송백목', 长流水: '장류수', 沙中金: '사중금', 山下火: '산하화', 平地木: '평지목',
  壁上土: '벽상토', 金箔金: '금박금', 覆灯火: '복등화', 天河水: '천하수', 大驿土: '대역토', 钗钏金: '채천금',
  桑柘木: '상자목', 大溪水: '대계수', 沙中土: '사중토', 天上火: '천상화', 石榴木: '석류목', 大海水: '대해수',
};
const ORDER = [['time', '생시'], ['day', '생일'], ['month', '생월'], ['year', '생년']];
const ELEMENTS = ['목', '화', '토', '금', '수'];
const text = (value) => typeof value === 'string' ? value.trim() : '';
const owns = (object, key) => Object.hasOwn(object, key);
const lookup = (object, key) => owns(object, key) ? object[key] : null;
const normalizedGod = (value) => text(value).replace(/[財傷殺]/g, (character) => CHARACTERS[character]);
const god = (value) => lookup(TEN_GODS, normalizedGod(value));
function glyph(value, names) {
  const entry = names[value];
  return entry ? { name: entry[0], glyph: value, element: entry[1], polarity: entry[2] } : null;
}
function actualPillar(pillar, expected) {
  if (typeof pillar?.ganZhi !== 'string' || pillar.ganZhi !== expected) return false;
  const pair = [...pillar.ganZhi];
  if (pair.length !== 2 || !owns(STEMS, pair[0]) || !owns(BRANCHES, pair[1])) return false;
  if (Object.keys(STEMS).indexOf(pair[0]) % 2 !== Object.keys(BRANCHES).indexOf(pair[1]) % 2) return false;
  return pillar.stem === pair[0] && pillar.branch === pair[1]
    && Array.isArray(pillar.elements) && pillar.elements.length === 2
    && pillar.elements[0] === STEMS[pair[0]][1] && pillar.elements[1] === BRANCHES[pair[1]][1];
}
function optionalArray(value, translate, maximum = 3) {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum) return [];
  const translated = Array.from(value, translate);
  return translated.every((item) => typeof item === 'string' && item.length) ? translated : [];
}
function column(key, label, pillar) {
  if (!pillar) return { key, label, missing: true, placeholder: '생시 모름', stem: null, branch: null,
    stemTenGod: null, branchTenGods: [], hiddenStems: [], growthStage: null, naYin: null, voidBranches: [], unavailable: [] };
  const hiddenStems = optionalArray(pillar.hiddenStems, (value) => STEMS[value]?.[0] || null);
  const branchTenGods = optionalArray(pillar.branchTenGods, (value) => normalizedGod(value) === '日主' ? null : god(value));
  // Hidden stems and their ten-god labels are parallel lists. Do not silently
  // filter an unknown item and shift the remaining labels into a false pair.
  if (hiddenStems.length && branchTenGods.length && hiddenStems.length !== branchTenGods.length) {
    hiddenStems.length = 0; branchTenGods.length = 0;
  }
  const voidText = text(pillar.voidBranches);
  const voidBranches = [...voidText].length === 2 ? optionalArray([...voidText], (value) => BRANCHES[value]?.[0] || null, 2) : [];
  const output = { key, label, missing: false, placeholder: null,
    stem: glyph(pillar.stem, STEMS), branch: glyph(pillar.branch, BRANCHES),
    stemTenGod: god(pillar.stemTenGod), branchTenGods, hiddenStems,
    growthStage: lookup(STAGES, text(pillar.growthStage)), naYin: lookup(NAYIN, text(pillar.naYin)), voidBranches,
    unavailable: [],
  };
  for (const field of ['stemTenGod', 'branchTenGods', 'hiddenStems', 'growthStage', 'naYin', 'voidBranches']) {
    if (output[field] === null || Array.isArray(output[field]) && output[field].length === 0) output.unavailable.push(field);
  }
  return output;
}
function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}
function weights(value) {
  if (!Array.isArray(value) || value.length !== 5 || new Set(value.map((item) => item?.label)).size !== 5) return null;
  const result = ELEMENTS.map((element) => {
    const entry = value.find((item) => item?.label === element);
    return entry && Number.isInteger(entry.count) && entry.count >= 0 ? { element, count: entry.count } : null;
  });
  return result.every(Boolean) ? result : null;
}

/**
 * Return null for missing/contradictory core natal data. Optional metadata stays
 * null/[] with its field listed in column.unavailable; [] never means "no such
 * traditional classification". The missing time column is explicitly separate.
 */
export function buildManseView(result) {
  const chart = result?.chart, details = result?.calculation?.details;
  if (result?.mode !== 'saju' || chart?.kind !== 'saju' || !details || details.sect !== 2
    || typeof details.birthTimeKnown !== 'boolean' || !details.pillars || !Array.isArray(chart.pillars)) return null;
  const keys = ['year', 'month', 'day', ...(details.birthTimeKnown ? ['time'] : [])];
  if (chart.pillars.length !== keys.length || chart.pillars.some((pillar) => !keys.includes(pillar?.key))
    || new Set(chart.pillars.map((pillar) => pillar.key)).size !== keys.length
    || !details.birthTimeKnown && details.pillars.time !== null) return null;
  const byKey = Object.fromEntries(chart.pillars.map((pillar) => [pillar.key, pillar]));
  if (!keys.every((key) => actualPillar(byKey[key], details.pillars[key]))) return null;
  if (text(byKey.day.stemTenGod) && god(byKey.day.stemTenGod) && normalizedGod(byKey.day.stemTenGod) !== '日主'
    || keys.some((key) => key !== 'day' && normalizedGod(byKey[key].stemTenGod) === '日主')) return null;

  const detailDate = details.solarDate == null ? null : isoDate(details.solarDate);
  const chartDate = chart.solarDate == null ? null : isoDate(chart.solarDate);
  if (details.solarDate != null && !detailDate || chart.solarDate != null && !chartDate
    || detailDate && chartDate && detailDate !== chartDate) return null;
  const literal = Object.fromEntries(ELEMENTS.map((element) => [element, 0]));
  for (const pillar of chart.pillars) for (const element of pillar.elements) literal[element]++;
  const literalCounts = ELEMENTS.map((element) => ({ element, count: literal[element] }));
  const rawWeights = [chart.elements, details.elements].filter((value) => value != null);
  const checkedWeights = rawWeights.map(weights);
  if (checkedWeights.some((value) => !value)) return null;
  if (checkedWeights.length === 2 && checkedWeights[0].some((entry, index) => entry.count !== checkedWeights[1][index].count)) return null;
  const mappingWeights = checkedWeights[0] || null;
  if (mappingWeights?.some((entry) => entry.count !== literal[entry.element] + (entry.element === STEMS[byKey.day.stem][1] ? 1 : 0))) return null;
  const lunarDate = text(chart.lunarDate);
  const auspicious = calculateNatalAuspicious(chart.pillars);
  if (!auspicious) return null;
  return {
    columns: ORDER.map(([key, label]) => ({ ...column(key, label, byKey[key]),
      auspiciousStars: auspicious.byPillar[key], auspiciousByLayer: auspicious.byLayer[key],
      twelveStars: auspicious.twelveByPillar[key] })),
    auspicious: { supported: auspicious.supported, notes: auspicious.notes,
      catalog: auspicious.catalog, matches: auspicious.matches, sources: auspicious.sources },
    facts: { solarDate: detailDate || chartDate, lunarDate: lunarDate && lunarDate.length <= 80 && !/[<>&\u0000-\u001f]/.test(lunarDate) ? lunarDate : null,
      birthTimeKnown: details.birthTimeKnown, literalCounts, literalTotal: keys.length * 2,
      mappingWeights, mappingTotal: mappingWeights ? mappingWeights.reduce((sum, item) => sum + item.count, 0) : null,
      weightingNote: '본오행 글자 수는 실제 천간·지지만 센 값입니다. SAI 연결 가중치는 일간을 한 번 더 반영한 별도 수치이며 강약·용신 판정이 아닙니다.',
    },
    notes: ['+는 양, −는 음입니다. 지지는 낱글자 자체의 음양 기준이며 지장간 본기의 음양과 별개입니다.',
      '십성은 실제 반환된 일간과 천간·지장간의 관계 이름입니다. 일간은 일간·나로 표시하며 비견으로 바꾸지 않습니다.',
      '빈 선택 항목은 자료 미확인입니다. 귀인·신살은 명시한 지원 규칙으로만 대조하며, 12신살은 연지와 일지 기준을 나눠 표시합니다.'],
  };
}
