// Local, deterministic presentation tests. No server, network or persistent data.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { chunkCopyText } from '../public/experience/text-layout.js';
import { calculateReading } from '../public/experience/reading-engine.js';
import { buildReadingDetail } from '../public/experience/reading-detail.js';
import { describeDayPillar } from '../public/experience/day-pillar.js';

let checks = 0;
function check(label, action) { action(); checks += 1; console.log(`PASS ${label}`); }
const retain = (text) => {
  const chunks = chunkCopyText(text);
  assert.equal(chunks.join(''), text);
  assert.ok(chunks.every((part) => typeof part === 'string' && part.length > 0));
  assert.deepEqual(chunkCopyText(text), chunks);
  return chunks;
};
check('exact characters and whitespace survive every group', () => {
  for (const text of ['', ' ', '  앞 문장입니다.  다음 문장입니다.\n\t마지막입니다.  ',
    '\u00a0문장 앞뒤\u00a0', '마침표 없이 길게 이어지는 문장도 단어 중간에서 자르거나 새 글자를 넣지 않습니다',
    '한 문장입니다.', '짧아요. 좋아요. 돌아봐요. 쉬어요. 끝이에요.']) retain(text);
  assert.deepEqual(chunkCopyText(null), []);
});
check('short sentences pair, at most two per group, without word-count cuts', () => {
  assert.deepEqual(retain('하나예요. 둘이에요. 셋이에요. 넷이에요. 다섯이에요.'),
    ['하나예요. 둘이에요. ', '셋이에요. 넷이에요. ', '다섯이에요.']);
  const long = '한 문장이 길어지더라도 그 문장의 의미와 원래 글자는 그대로 유지하고 오직 문장이 끝난 다음에만 새로운 묶음을 시작합니다. ';
  assert.deepEqual(retain(`${long}짧은 질문인가요? 네, 천천히 읽어요.`), [long, '짧은 질문인가요? 네, 천천히 읽어요.']);
  const addressed = '나를 위한 이야기입니다. 작은 경험에서도 의미를 발견하고 상상과 진심으로 자기만의 이야기를 만드는 장면을 편안하게 읽어 보세요.';
  assert.deepEqual(retain(addressed), [addressed]);
});
check('date, decimal, version, URL and email punctuation never splits internally', () => {
  for (const token of ['1999.09.22', '2026-10-22', '1.5', '-0.25', '1,234.56', 'v1.7.7',
    'https://example.com/a.b?q=1.5#x', 'user.name+tag@example.co.kr']) {
    const text = `${token}은 표시 예시일 뿐이며 이 안의 마침표는 문장이 끝났다는 의미로 사용하지 않습니다. 다음 내용입니다.`;
    const chunks = retain(text);
    assert.ok(chunks.some((part) => part.includes(token)), `split token: ${token}`);
  }
  assert.deepEqual(retain('Dr. Example uses e.g. a decimal 1.5 in this complete sentence. Next sentence.'),
    ['Dr. Example uses e.g. a decimal 1.5 in this complete sentence. ', 'Next sentence.']);
});
check('closing punctuation, ellipses and Unicode remain attached and intact', () => {
  for (const text of ['“괜찮아요!”라고 말했다. 다음 생각도 천천히 읽어요.',
    '“이 인용문은 충분히 길고 닫는 따옴표까지 같은 문장에 붙여 보여 주어야 자연스럽습니다.” 다음 문장입니다.',
    '잠깐... 괜찮나요?! 네!! 이어 읽어요… 마지막입니다.',
    '👨‍👩‍👧‍👦의 이야기입니다. e\u0301와 한글을 그대로 두세요. 🌗도 그대로입니다.']) retain(text);
  const quoted = '“이 인용문은 충분히 길고 닫는 따옴표까지 같은 문장에 붙여 보여 주어야 자연스럽습니다.” ';
  assert.equal(chunkCopyText(`${quoted}다음 문장입니다.`)[0], quoted);
});
// Run only the display helper, not the app or any of its event/network code.
const appSource = await readFile(new URL('../public/experience/app.js', import.meta.url), 'utf8');
const functionSource = appSource.match(/function setCopyText\(node, text\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(functionSource);
class TextNode {
  constructor(tag = 'p') { this.tag = tag; this.children = []; this.value = ''; }
  set textContent(text) { this.value = String(text); this.children = []; }
  get textContent() { return this.children.length ? this.children.map((node) => node.textContent).join('') : this.value; }
  set innerHTML(_) { throw new Error('HTML rendering is forbidden'); }
  replaceChildren(...children) { this.children = children; this.value = ''; }
}
const renderCopy = vm.runInNewContext(`(${functionSource})`, { chunkCopyText,
  element: (tag, text, className) => { const node = new TextNode(tag); node.textContent = text; node.className = className; return node; } });
check('actual app renderer uses safe text spans and preserves desktop textContent', () => {
  for (const text of ['<img src=x onerror="alert(1)">. &nbsp;를 실제 문자로 표시합니다. 다음 문장입니다.',
    '<script>alert("not executed")</script>는 이름 예시입니다. 1999.09.22를 그대로 둡니다.',
    '하나예요. 둘이에요. 셋이에요. 넷이에요.']) {
    const node = new TextNode();
    assert.equal(renderCopy(node, text), node);
    assert.equal(node.textContent, text);
    assert.ok(node.children.every((span) => span.tag === 'span' && span.className === 'copy-sentence'));
  }
  assert.doesNotMatch(appSource, /\.innerHTML\s*=/);
});

const experience = new URL('../public/experience/', import.meta.url);
const sandbox = {}; sandbox.self = sandbox; sandbox.window = sandbox; vm.createContext(sandbox);
for (const file of ['lunar.js', 'iztro.min.js']) vm.runInContext(await readFile(new URL(`vendor/${file}`, experience), 'utf8'), sandbox);
const previous = { Solar: globalThis.Solar, Lunar: globalThis.Lunar, iztro: globalThis.iztro };
Object.assign(globalThis, { Solar: sandbox.Solar, Lunar: sandbox.Lunar, iztro: sandbox.iztro });
try {
  check('all three existing readings and popup copies retain exact text and data', () => {
    for (const mode of ['zodiac', 'saju', 'ziwei']) {
      const input = { mode, birthDate: '2005-12-23', birthTime: '08:37', calendar: 'solar', leapMonth: false, gender: 'female' };
      const result = calculateReading(input), detail = buildReadingDetail(result, input), day = describeDayPillar(result);
      const before = JSON.stringify({ result, detail, input });
      const texts = [result.summary, ...result.sections.map((section) => section.text), detail.intro,
        ...detail.sections.flatMap((section) => [section.text, ...(section.paragraphs || []), ...section.items]), ...detail.notes,
        ...(day ? [day.summary, day.note] : [])];
      for (const text of texts) {
        retain(text);
        const node = new TextNode(); renderCopy(node, text); assert.equal(node.textContent, text);
      }
      assert.equal(JSON.stringify({ result, detail, input }), before);
    }
  });
} finally { Object.assign(globalThis, previous); }
console.log(`PASS ${checks} text-layout groups: exact copy, safe spans, semantic grouping and unchanged three-engine results. No storage or network.`);
