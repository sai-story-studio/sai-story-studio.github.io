// Real PDF + real bundled fonts through the same internal asset-binding API.
// No DB, browser, secret or HTTP. Transport behavior is tested separately.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { PDFDocument } from '../public/experience/vendor/pdf-lib.esm.min.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const fonts = Object.fromEntries(await Promise.all(['regular', 'bold'].map(async (name) => [
  `/experience/fonts/sai-pdf-${name}.ttf`, new Uint8Array(await readFile(new URL(`../public/experience/fonts/sai-pdf-${name}.ttf`, import.meta.url))),
])));
let fontCalls = 0;
globalThis.__pdfRenderingEnv = { ASSETS: { async fetch(request) {
  assert.ok(request.url.startsWith('https://assets.internal/experience/fonts/'));
  const font = fonts[new URL(request.url).pathname];
  assert.ok(font); fontCalls++;
  return new Response(font);
} } };
const bundle = await build({ stdin: { contents: 'export * from "./lib/pdf-mail";', resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'node22',
  plugins: [{ name: 'static-asset-only-env', setup(builder) {
    builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'pdf-real-test' }));
    builder.onLoad({ filter: /.*/, namespace: 'pdf-real-test' }, () => ({ loader: 'js', contents: 'export const env=globalThis.__pdfRenderingEnv;' }));
  } }],
});
const mail = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const oldFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('No network is permitted in real-PDF rendering test.'); };
try {
  const document = { version: 1, mode: 'saju', title: '사주 · 나를 읽는 이야기', subtitle: '합성 한글·한자 결과',
    summary: [{ label: 'INFP · 나의 성향', text: '계산된 상징을 쉽게 읽어요.' }], sections: [{ id: 'structure', title: '타고난 구조', chapter: '01 · 타고난 구조',
      text: '한글과 한자를 함께 볼 수 있어요.', paragraphs: ['정丁과 축丑의 상징을 일상 언어로 풀어봅니다.'], items: ['짧은 핵심을 구분해서 읽어요.'],
      table: { kind: 'manse', caption: '사주 원국', headers: ['항목', '생시', '생일', '생월', '생년'],
        rows: [['천간', '경庚\n+금', '정丁\n-화', '계癸\n-수', '기己\n-토'], ['지지', '술戌', '축丑', '유酉', '묘卯']] } }],
    notes: ['재미와 자기 탐색을 위한 상징 해석입니다.'] };
  const source = { mode: 'saju', nickname: '합성 사용자', result: { type: 'INFP', title: '합성', summary: '합성 결과', basis: ['합성 근거'] }, document, includeBirthData: false };
  const first = await mail.buildPdfEmail(source, 'https://pdf.example.test');
  const second = await mail.buildPdfEmail(source, 'https://pdf.example.test');
  assert.equal(first.attachments[0].content, second.attachments[0].content, 'same document -> byte-identical retry attachment');
  const bytes = Buffer.from(first.attachments[0].content, 'base64');
  assert.ok(bytes.toString('ascii', 0, 5) === '%PDF-');
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 1);
  assert.equal(pdf.getTitle(), document.title);
  assert.equal(pdf.getAuthor(), '사이(SAI STUDIO)');
  assert.ok(!first.attachments[0].filename.includes('2000') && !first.text.includes(document.sections[0].paragraphs[0]));
  assert.equal(fontCalls, 4);
  console.log(`PASS real server PDF attachment rendering: ${pdf.getPageCount()} page(s), ${bytes.length} bytes, Korean/Hanja font embedding, fixed metadata, byte-identical retry, internal assets only; zero HTTP/DB/provider calls.`);
} finally {
  globalThis.fetch = oldFetch; delete globalThis.__pdfRenderingEnv;
}
