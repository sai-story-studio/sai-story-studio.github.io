import assert from 'node:assert/strict';
import { reportSegments, reportParagraphRole, reportBlocks } from '../public/experience/report-format.js';
for (const text of ['', '일반 본문은 원문 그대로예요.', '편재와 정재, 일간·지장간을 2026년에 읽습니다.',
  '<img onerror="alert(1)">일간</img> &amp; **대운** <script>세운</script>', '2026.10.23 · 2027년\n정인과 편인']) {
  const segments = reportSegments(text);
  assert.equal(segments.map(s => s.text).join(''), text);
  assert.ok(segments.every(s => typeof s.text === 'string' && typeof s.strong === 'boolean'));
  assert.deepEqual(reportSegments(text), segments);
  assert.ok(segments.filter(s => s.strong).every(s => !/[<>*&]/.test(s.text)));
}
assert.deepEqual(reportSegments('대운 원문'), [{ text: '대운', strong: true }, { text: ' 원문', strong: false }]);
assert.equal(reportParagraphRole('saju-domain-money', 0), '원국에서 확인한 근거');
assert.equal(reportParagraphRole('saju-domain-money', 2), '강점과 주의점');
assert.equal(reportParagraphRole('saju-year-2026', 1), '흐름을 해석한 이유');
assert.equal(reportParagraphRole('saju-conclusion', 0), '');
assert.equal(reportParagraphRole('saju-domain-money', 3), '');
const copy = '명궁의 실행력은 완료 기준이 명확할 때 강점입니다. 다만 효율을 앞세워 관계의 설명을 줄이지 않도록 주의하세요.';
const phrases = ['완료 기준이 명확할 때 강점', '효율을 앞세워 관계의 설명을 줄이지 않도록'];
const highlighted = reportSegments(copy, phrases);
assert.equal(highlighted.map(part => part.text).join(''), copy);
assert.deepEqual(highlighted.filter(part => part.semantic).map(part => part.text), phrases);
assert.ok(highlighted.filter(part => part.semantic).every(part => part.strong));
assert.deepEqual(reportSegments(copy, phrases), highlighted);
const overlapping = reportSegments('차근차근 완성하는 힘과 완성하는 힘', ['차근차근 완성하는', '완성하는 힘', '완성하는 힘']);
assert.equal(overlapping.map(part => part.text).join(''), '차근차근 완성하는 힘과 완성하는 힘');
assert.deepEqual(overlapping.filter(part => part.semantic).map(part => part.text), ['차근차근 완성하는 힘', '완성하는 힘']);
assert.deepEqual(reportSegments('원문 보존', ['없는 문구', '', null]), reportSegments('원문 보존'));
assert.deepEqual(reportBlocks('1. 명궁\n실행과 관리.\n\n2. 복덕궁\n휴식과 만족.\n\n'), ['1. 명궁\n실행과 관리.', '2. 복덕궁\n휴식과 만족.']);
assert.deepEqual(reportBlocks('처음\r\n\r\n다음'), ['처음', '다음']);
assert.deepEqual(reportBlocks(''), []);
console.log('PASS plain-text preservation, authored semantic highlights, overlap/repetition safety, deliberate numbered paragraph blocks and role labels. No requests or storage.');
