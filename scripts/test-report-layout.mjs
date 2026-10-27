import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { reportBlocks, reportSegments, reportParagraphRole } from '../public/experience/report-format.js';

// Exercise the production renderer without a browser, DB or request boundary.
class Node {
  constructor(tag, value = '') { this.tagName = tag; this.value = value; this.children = []; this.dataset = {}; }
  append(...nodes) { this.children.push(...nodes); }
  get textContent() { return this.value + this.children.map(node => node.textContent).join(''); }
  set textContent(value) { this.value = String(value); this.children = []; }
  set innerHTML(_) { throw new Error('Reports must never interpret HTML'); }
}
const element = (tag, text, className) => { const node = new Node(tag); if (text != null) node.textContent = text; node.className = className || ''; return node; };
const source = fs.readFileSync(new URL('../public/experience/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function reportParagraph('), end = source.indexOf('\nfunction renderList(', start);
assert.ok(start >= 0 && end > start);
const render = vm.runInNewContext(`${source.slice(start, end)}\nreportParagraph`, { element, reportBlocks, reportSegments, reportParagraphRole, document: { createTextNode: text => new Node('#text', text) } });
const flatten = node => [node, ...node.children.flatMap(flatten)];
const content = '1. 명궁\n완료 기준이 명확할 때 강점이 드러납니다.\n\n2. 복덕궁\n혼자 감당하며 휴식을 미루는 패턴은 주의가 필요합니다.';
const highlights = ['완료 기준이 명확할 때 강점', '혼자 감당하며 휴식을 미루는 패턴'];
const report = render(`Claim · 전통적 해석\n${content}`, 'ziwei-stage-02', 1, highlights);
assert.equal(report.tagName, 'div');
assert.equal(report.dataset.role, 'Claim · 전통적 해석');
assert.equal(report.children.length, 2);
assert.ok(report.children.every(node => node.tagName === 'p' && node.className === 'report-block'));
assert.deepEqual(report.children.map(node => node.textContent), reportBlocks(content));
assert.deepEqual(flatten(report).filter(node => node.className === 'report-keypoint').map(node => node.textContent), highlights);
assert.ok(!report.textContent.includes('Claim ·'));
assert.ok(flatten(report).filter(node => node.className === 'report-keypoint').every(node => node.tagName === 'strong'));

const saju = render('비겁과 관성의 근거입니다.\n\n책임을 분명히 하는 강점이 있지만 역할을 혼자 떠안으면 부담도 커집니다.', 'saju-domain-work', 2, ['역할을 혼자 떠안으면 부담도 커집니다']);
assert.equal(saju.dataset.role, '강점과 주의점');
assert.equal(saju.children.length, 2);
assert.equal(flatten(saju).filter(node => node.className === 'report-keypoint').length, 1);
const literal = '<script>alert(1)</script>와 **사용자 문구**는 텍스트입니다.';
const safe = render(literal, 'saju-domain-work', 1, [literal]);
assert.equal(safe.textContent, literal);
assert.ok(flatten(safe).every(node => !['script', 'img', 'iframe'].includes(node.tagName)));
assert.equal(render('', 'saju-conclusion', 0).children.length, 0);
console.log('PASS production paragraph renderer: separated palace blocks, visible role labels, meaningful safe bold spans, no markup interpretation. Synthetic DOM only.');
