import assert from 'node:assert/strict';
import { buildMappingExplanation } from '../public/experience/mapping-explanation.js';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const sample = () => ({ mode: 'saju', type: 'INFP', calculation: { details: { mapping: {
  axes: [
    { axis: 'E/I', result: 'I', symbolBalance: -4 },
    { axis: 'N/S', result: 'N', symbolBalance: 4 },
    { axis: 'F/T', result: 'F', symbolBalance: 2 },
    { axis: 'P/J', result: 'P', symbolBalance: 4 },
  ], symbols: [{ label: '수(水)', meaning: '숙고·상상·유연함', vector: [-2, 2, 1, 2], weight: 2 }],
} } } });
const result = sample(), before = JSON.stringify(result);
const detail = buildMappingExplanation(result);
assert.equal(detail.axes.length, 4);
assert.equal(detail.axes[0].negative, 4);
assert.match(detail.axes[0].cause, /수\(水\) 2회/);
assert.match(detail.axes[0].terms[0], /I 4/);
assert.equal(JSON.stringify(result), before);
assert.match(detail.note, /확률이 아니/);
for (const mode of ['ziwei', 'zodiac']) assert.ok(buildMappingExplanation({ ...sample(), mode }));
const tie = sample();
tie.calculation.details.mapping.symbols = [
  { label: 'A', meaning: '한 방향', vector: [1, 1, 1, 1], weight: 1 },
  { label: 'B', meaning: '다른 방향', vector: [-1, -1, -1, -1], weight: 1 },
];
tie.calculation.details.mapping.axes.forEach((axis) => { axis.symbolBalance = 0; });
assert.ok(buildMappingExplanation(tie).axes.every((axis) => axis.balance === 0 && /동률/.test(axis.description)));
for (const change of [
  (r) => { r.type = 'ENFP'; },
  (r) => { r.calculation.details.mapping.axes[0].axis = 'I/E'; },
  (r) => { r.calculation.details.mapping.axes[0].symbolBalance = -3; },
  (r) => { r.calculation.details.mapping.symbols[0].weight = NaN; },
  (r) => { r.calculation.details.mapping.symbols[0].weight = -1; },
  (r) => { r.calculation.details.mapping.symbols[0].vector[0] = Infinity; },
  (r) => { r.calculation.details.mapping.symbols = []; },
  (r) => { delete r.calculation.details.mapping; },
]) { const r = sample(); change(r); assert.equal(buildMappingExplanation(r), null); }
assert.equal(buildMappingExplanation(null), null);
const sandbox = { console }; sandbox.self = sandbox; sandbox.window = sandbox; vm.createContext(sandbox);
for (const name of ['lunar.js', 'iztro.min.js']) vm.runInContext(await readFile(new URL(`../public/experience/vendor/${name}`, import.meta.url), 'utf8'), sandbox);
const old = { Solar: globalThis.Solar, Lunar: globalThis.Lunar, LunarUtil: globalThis.LunarUtil, iztro: globalThis.iztro };
Object.assign(globalThis, { Solar: sandbox.Solar, Lunar: sandbox.Lunar, LunarUtil: sandbox.LunarUtil, iztro: sandbox.iztro });
try {
  const { calculateReading } = await import('../public/experience/reading-engine.js');
  for (const mode of ['saju', 'ziwei', 'zodiac']) {
    for (let month = 1; month <= 12; month++) {
      const reading = calculateReading({ mode, birthDate: `2000-${String(month).padStart(2, '0')}-16`, birthTime: '08:37', calendar: 'solar', gender: 'female' }, { asOf: '2026-10-22T00:00:00Z' });
      const explanation = buildMappingExplanation(reading);
      assert.ok(explanation, `${mode} ${month}`);
      assert.equal(explanation.axes.map((axis) => axis.letter).join(''), reading.type);
      explanation.axes.forEach((axis, index) => assert.equal(axis.balance, reading.calculation.details.mapping.axes[index].symbolBalance));
    }
  }
} finally { Object.assign(globalThis, old); }
console.log('PASS mapping explanations: 36 real readings, recomputed values, sources, ties, mismatch guards and immutability');
