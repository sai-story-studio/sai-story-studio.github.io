// Modal-local synthetic DOM tests only. No browser, requests, storage or data.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bindDetailNavigation, initDetailNavigation } from '../public/experience/detail-navigation.js';

class EventNode {
  constructor() { this.listeners = new Map(); this.hidden = true; }
  addEventListener(name, listener, options) { const list = this.listeners.get(name) || new Map(); list.set(listener, options); this.listeners.set(name, list); }
  removeEventListener(name, listener) { this.listeners.get(name)?.delete(listener); }
  emit(name, extra = {}) { const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...extra }; for (const listener of this.listeners.get(name)?.keys() || []) listener(event); return event; }
  count(name) { return this.listeners.get(name)?.size || 0; }
}
function harness({ open = false, reduced = false, hasObserver = true } = {}) {
  const dialog = new EventNode(), button = new EventNode(), view = new EventNode();
  const calls = [], observers = [];
  dialog.open = open; dialog.scrollTop = 370; dialog.scrollHeight = 10000; dialog.clientHeight = 650;
  dialog.querySelector = selector => selector === '[data-detail-top]' ? button : null;
  dialog.scrollTo = options => { calls.push({ ...options }); };
  view.pageScrollCalls = 0; view.scrollTo = () => { view.pageScrollCalls++; };
  view.reduced = reduced; view.matchMedia = query => { assert.equal(query, '(prefers-reduced-motion: reduce)'); return { matches: view.reduced }; };
  class Observer {
    constructor(action) { this.action = action; observers.push(this); }
    observe(node, options) { this.node = node; this.options = options; }
    disconnect() { this.disconnected = true; }
  }
  dialog.ownerDocument = { defaultView: view };
  if (hasObserver) view.MutationObserver = Observer;
  const controller = bindDetailNavigation(dialog);
  return { dialog, button, view, calls, observers, controller, open() { dialog.open = true; observers.forEach(observer => { if (!observer.disconnected) observer.action(); }); dialog.emit('toggle'); }, close() { dialog.open = false; dialog.emit('close'); observers.forEach(observer => { if (!observer.disconnected) observer.action(); }); }, scroll(top) { dialog.scrollTop = top; dialog.emit('scroll'); } };
}
let groups = 0;
function test(label, run) { run(); groups++; console.log(`PASS ${label}`); }
test('binding is safe for missing DOM and initializes closed or already open dialogs hidden at top', () => {
  assert.equal(bindDetailNavigation(null), null); assert.equal(bindDetailNavigation({}), null);
  assert.equal(initDetailNavigation(null), null);
  const missing = new EventNode(); missing.querySelector = () => null; assert.equal(bindDetailNavigation(missing), null);
  for (const open of [false, true]) { const h = harness({ open }); assert.equal(h.button.hidden, true); assert.equal(h.dialog.scrollTop, 0); assert.equal(h.calls.length, 0); }
});
test('native open observation resets retained scroll without wrapping showModal or stealing native events', () => {
  const h = harness(); h.dialog.scrollTop = 800; h.open(); assert.equal(h.dialog.scrollTop, 0); assert.equal(h.button.hidden, true);
  assert.equal(h.observers.length, 1); assert.equal(h.observers[0].node, h.dialog);
  assert.deepEqual(h.observers[0].options, { attributes: true, attributeFilter: ['open'] });
  assert.equal(h.dialog.count('click'), 0); assert.equal(h.dialog.count('cancel'), 0); assert.equal(h.dialog.showModal, undefined);
});
test('TOP appears only after 240px of the open modal, independently of the page and reading mode', () => {
  const h = harness(); h.scroll(1000); assert.equal(h.button.hidden, true); h.open();
  for (const mode of ['zodiac', 'saju', 'ziwei']) {
    h.dialog.dataset = { readingMode: mode };
    h.scroll(0); assert.equal(h.button.hidden, true); h.scroll(239); assert.equal(h.button.hidden, true);
    h.scroll(240); assert.equal(h.button.hidden, false); h.scroll(5000); assert.equal(h.button.hidden, false);
    h.scroll(100); assert.equal(h.button.hidden, true);
  }
  assert.equal(h.view.pageScrollCalls, 0); assert.equal(h.view.count('scroll'), 0);
  assert.deepEqual([...h.dialog.listeners.get('scroll').values()], [{ passive: true }]);
});
test('a click requests smooth scrolling on this dialog only; hidden or closed controls do nothing', () => {
  const h = harness(); h.button.emit('click'); assert.equal(h.calls.length, 0); h.open(); h.scroll(300);
  const event = h.button.emit('click'); assert.equal(event.defaultPrevented, true);
  assert.deepEqual(h.calls, [{ top: 0, behavior: 'smooth' }]); assert.equal(h.view.pageScrollCalls, 0);
  h.scroll(0); h.button.emit('click'); assert.equal(h.calls.length, 1);
  h.close(); h.button.emit('click'); assert.equal(h.calls.length, 1);
});
test('reduced-motion is read at activation, including a preference change during the modal session', () => {
  const h = harness({ reduced: true }); h.open(); h.scroll(800); h.button.emit('click');
  assert.deepEqual(h.calls[0], { top: 0, behavior: 'auto' });
  h.view.reduced = false; h.button.emit('click'); assert.deepEqual(h.calls[1], { top: 0, behavior: 'smooth' });
});
test('Esc and any native close reset the button; repeated opens never retain the previous scroll position', () => {
  const h = harness(); h.open(); h.scroll(1200); assert.equal(h.button.hidden, false);
  const cancel = h.dialog.emit('cancel'); assert.notEqual(cancel.defaultPrevented, true); h.close();
  assert.equal(h.button.hidden, true); assert.equal(h.dialog.scrollTop, 0);
  h.dialog.scrollTop = 950; h.open(); assert.equal(h.dialog.scrollTop, 0); assert.equal(h.button.hidden, true);
  h.scroll(350); h.close(); assert.equal(h.button.hidden, true);
});
test('idempotent binding never duplicates listeners, scrolling calls or observers', () => {
  const h = harness(); const again = bindDetailNavigation(h.dialog);
  assert.equal(again, h.controller); assert.equal(h.dialog.count('scroll'), 1); assert.equal(h.dialog.count('toggle'), 1); assert.equal(h.dialog.count('close'), 1); assert.equal(h.button.count('click'), 1); assert.equal(h.observers.length, 1);
  const root = { querySelector: selector => selector === '#reading-detail-dialog' ? h.dialog : null };
  assert.equal(initDetailNavigation(root), h.controller); h.open(); h.scroll(350); h.button.emit('click'); assert.equal(h.calls.length, 1);
});
test('cleanup removes all owned hooks and allows a clean rebind with no stale observer behavior', () => {
  const h = harness(); h.open(); h.scroll(1000); h.controller.cleanup(); h.controller.cleanup();
  assert.equal(h.button.hidden, true); assert.equal(h.dialog.scrollTop, 0); assert.equal(h.observers[0].disconnected, true);
  for (const name of ['scroll', 'toggle', 'close']) assert.equal(h.dialog.count(name), 0);
  assert.equal(h.button.count('click'), 0); assert.equal(h.view.count('pagehide'), 0);
  h.scroll(1000); h.observers[0].action(); h.button.emit('click'); assert.equal(h.button.hidden, true); assert.equal(h.calls.length, 0);
  const rebound = bindDetailNavigation(h.dialog); assert.notEqual(rebound, h.controller); assert.equal(h.dialog.count('scroll'), 1); assert.equal(h.observers.length, 2);
});
test('pagehide clears local navigation state without closing or changing modal semantics', () => {
  const h = harness(); h.open(); h.scroll(1200); h.view.emit('pagehide');
  assert.equal(h.button.hidden, true); assert.equal(h.dialog.scrollTop, 0); assert.equal(h.dialog.open, true); assert.equal(h.view.pageScrollCalls, 0);
});
test('native toggle plus explicit refresh remain safe without a MutationObserver', () => {
  const h = harness({ hasObserver: false }); assert.equal(h.observers.length, 0);
  h.open(); h.scroll(500); assert.equal(h.button.hidden, false); h.close(); assert.equal(h.button.hidden, true);
  h.dialog.open = true; h.controller.refresh(); assert.equal(h.button.hidden, true); assert.equal(h.dialog.scrollTop, 0);
});
const html = await readFile(new URL('../public/experience/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/experience/detail-navigation.css', import.meta.url), 'utf8');
const js = await readFile(new URL('../public/experience/detail-navigation.js', import.meta.url), 'utf8');
test('markup adds exactly one labelled native control as a sibling after the sheet in the same dialog', () => {
  assert.equal([...html.matchAll(/id="reading-detail-top"/g)].length, 1);
  assert.match(html, /<\/div><button id="reading-detail-top" class="reading-detail-top" type="button" data-detail-top aria-label="풀이 맨 위로 이동" hidden>[\s\S]*?<\/button><\/dialog>/);
  const detail = html.match(/<dialog id="reading-detail-dialog"[\s\S]*?<\/dialog>/)[0];
  assert.match(detail, /id="detail-download-pdf"/); assert.match(detail, /data-close aria-label="풀이 창 닫기"/);
  assert.match(html, /"\.\/detail-navigation\.js": "\.\/detail-navigation\.js\?v=32-birthplace-completion"/);
  assert.match(html, /href="\.\/detail-navigation\.css\?v=32-birthplace-completion"/);
  assert.match(html, /src="\.\/detail-navigation\.js\?v=32-birthplace-completion"/);
});
test('styling reserves a terminal control gutter, keeps modal scrolling and excludes invisible keyboard targets', () => {
  assert.match(css, /\.reading-detail-dialog > \.reading-detail-sheet\s*\{\s*padding-bottom:\s*84px/);
  assert.match(css, /position:\s*sticky/); assert.match(css, /width:\s*44px/); assert.match(css, /height:\s*44px/);
  assert.match(css, /\.reading-detail-top\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(css, /max-width:\s*600px/); assert.match(css, /bottom:\s*12px/); assert.match(css, /:focus-visible/); assert.match(css, /forced-colors:\s*active/);
  assert.doesNotMatch(css, /position:\s*fixed|overflow\s*:|overflow-y\s*:|max-height\s*:|\.back-to-top/);
  assert.doesNotMatch(js, /fetch\s*\(|localStorage|sessionStorage|sendBeacon|document\.(?:body|documentElement)\.scroll|window\.scrollTo/);
});
console.log(`PASS ${groups} isolated detail-navigation groups: all three modes, modal-only scrolling, threshold, native lifecycle, reduced motion, cleanup and markup/style contracts.`);
