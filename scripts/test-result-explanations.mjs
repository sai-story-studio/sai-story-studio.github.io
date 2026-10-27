import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { calculateReading } from '../public/experience/reading-engine.js';
import { buildReadingDetail, readingResultSummary } from '../public/experience/reading-detail.js';
import { buildReadingPdfDocument } from '../public/experience/reading-pdf-document.js';
import { reportParagraphRole } from '../public/experience/report-format.js';

const realm = {}; realm.self = realm; realm.window = realm; vm.createContext(realm);
for (const file of ['lunar.js', 'iztro.min.js']) vm.runInContext(await fs.readFile(new URL(`../public/experience/vendor/${file}`, import.meta.url), 'utf8'), realm);
Object.assign(globalThis, { Solar: realm.Solar, Lunar: realm.Lunar, LunarUtil: realm.LunarUtil, iztro: realm.iztro });
const prose = (detail) => [detail.intro, ...detail.sections.flatMap(section => [section.title, section.text, ...(section.paragraphs || []), ...(section.items || [])])].join('\n');
const homework = /보세요|주세요|답해|적어\s*보|기록해|작성해|체크해|떠올려|남겨\s*두세요|자기 성찰 질문|균형을 위한 질문|실제 상황 선택|구체적인 실천|관찰 질문|90일\s*행동|[?？]/u;
let readings = 0;
for (const mode of ['saju', 'ziwei']) for (const birthDate of ['1992-02-16', '1999-09-22', '2000-08-16', '2005-12-23']) for (const gender of ['female', 'male']) {
  const input = { mode, birthDate, birthTime: '08:37', calendar: 'solar', leapMonth: false, gender };
  const reading = calculateReading(input, { asOf: '2026-10-23 12:00:00' }), snapshot = JSON.stringify(reading);
  const modes = mode === 'ziwei' ? ['QUICK', 'STANDARD', 'DEEP'] : ['STANDARD'];
  for (const reportMode of modes) {
    const options = { ...input, ziweiReport: { mode: reportMode, asOf: '2026-10-23', focus: 'all' } };
    const detail = buildReadingDetail(reading, options);
    assert.doesNotMatch(prose(detail), homework, `${mode}/${reportMode}/${birthDate}/${gender}: result prose must explain rather than assign homework`);
    assert.doesNotMatch(readingResultSummary(reading), homework);
    assert.match(prose(detail), /이유|관계|배치|기준|근거/u);
    assert.ok(detail.sections.filter(section => section.highlights?.length).length >= 5, 'meaningful authored emphasis is retained');
    const pdf = buildReadingPdfDocument({ reading, input: options });
    assert.doesNotMatch(prose({ intro: '', sections: pdf.sections }), homework, 'the PDF receives the same declarative explanation');
    assert.equal(JSON.stringify(reading), snapshot, 'presentation never mutates the calculation payload');
    assert.deepEqual(buildReadingDetail(reading, options), detail, 'editorial output is deterministic');
    readings++;
  }
}
const zodiac = calculateReading({ mode: 'zodiac', birthDate: '2000-08-16', calendar: 'solar' });
assert.equal(readingResultSummary(zodiac), zodiac.summary, 'zodiac summary is not rewritten');
assert.equal(reportParagraphRole('saju-domain-work', 1), '이 성향으로 해석한 이유');
assert.equal(reportParagraphRole('saju-domain-work', 2), '강점과 주의점');
assert.equal(reportParagraphRole('saju-year-2026', 2), '두드러지는 성향과 한계');
console.log(`PASS ${readings} deterministic Saju/Ziwei reports: explanatory result prose without homework/questions, real basis, emphasis, PDF parity, unchanged calculation and zodiac summary.`);
