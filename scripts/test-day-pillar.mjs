import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const experience = new URL('../public/experience/', import.meta.url);
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(await readFile(new URL('vendor/lunar.js', experience), 'utf8'), sandbox);
const originals = { Solar: globalThis.Solar, Lunar: globalThis.Lunar };
Object.assign(globalThis, { Solar: sandbox.Solar, Lunar: sandbox.Lunar });
const importSource = async (name) => import(new URL(name, experience));
const { calculateReading } = await importSource('reading-engine.js');
const { describeDayPillar } = await importSource('day-pillar.js');
try {
  for (const [birthDate, birthTime, label, elements] of [
    ['2000-01-20', '12:00', '정축(丁丑) 일주', ['화', '토']],
    ['2005-12-23', '08:37', '신사(辛巳) 일주', ['금', '화']],
    ['1988-02-15', '23:30', '경자(庚子) 일주', ['금', '수']],
  ]) {
    const reading = calculateReading({ mode: 'saju', birthDate, birthTime, calendar: 'solar', leapMonth: false, gender: null });
    const before = JSON.stringify(reading);
    const day = describeDayPillar(reading);
    assert.equal(day.label, label);
    assert.deepEqual([day.stem.element, day.branch.element], elements);
    assert.match(day.note, /자기 탐색.*상징 문안/);
    assert.equal(JSON.stringify(reading), before, 'Presentation must not mutate the reading');
    assert.deepEqual(day, describeDayPillar(reading));
  }
  const incomplete = { mode: 'saju', calculation: { details: { pillars: { day: '丁丑' } } } };
  assert.equal(describeDayPillar(incomplete).name, '정축');
  assert.equal(describeDayPillar(incomplete).shortDescription, '가까운 사람에게 세심한 관심과 온기를 건네는 이미지예요. 익숙한 자리에서 차근차근 자기만의 기반을 쌓아가요.');
  const descriptions = [];
  for (const [stemIndex, stem] of [...'甲乙丙丁戊己庚辛壬癸'].entries()) {
    for (const [branchIndex, branch] of [...'子丑寅卯辰巳午未申酉戌亥'].entries()) {
      if (stemIndex % 2 !== branchIndex % 2) continue;
      const text = describeDayPillar({ mode: 'saju', calculation: { details: { pillars: { day: stem + branch } } } }).shortDescription;
      assert.ok(text.length >= 40 && text.length <= 90, `keep ${stem + branch} brief`);
      assert.equal(text.split('.').filter((part) => part.trim()).length, 2);
      assert.match(text, /이미지예요\./);
      assert.doesNotMatch(text, /undefined|null|<|>|반드시|운명|재물운|질병/);
      descriptions.push(text);
    }
  }
  assert.equal(descriptions.length, 60);
  assert.equal(new Set(descriptions).size, 60, 'all sixty calculated day pillars have distinct short imagery');
  assert.equal(describeDayPillar({ mode: 'zodiac' }), null);
  assert.equal(describeDayPillar({ mode: 'saju' }), null);
  assert.equal(describeDayPillar({ mode: 'saju', calculation: { details: { pillars: { day: '甲丑' } } } }), null);
  assert.equal(describeDayPillar({ ...incomplete, chart: { pillars: [{ key: 'day', ganZhi: '甲子' }] } }), null);
  assert.equal(describeDayPillar({ ...incomplete, chart: { pillars: [{ key: 'day', ganZhi: '丁丑', elements: ['목', '수'] }] } }), null);
  console.log('PASS actual engine 정축/신사/경자 labels, element classifications, sixty distinct two-sentence symbolic descriptions, no result mutation, deterministic presentation, invalid/mismatched data rejection. Synthetic/public fixture dates only.');
} finally {
  for (const [name, value] of Object.entries(originals)) { if (value === undefined) delete globalThis[name]; else globalThis[name] = value; }
}
