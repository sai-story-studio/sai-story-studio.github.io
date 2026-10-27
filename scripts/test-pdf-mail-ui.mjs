// Regression-test the production email submit callback, replacing only its
// module/network/DOM boundaries. No browser, real recipient, service or DB runs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/experience/app.js', import.meta.url), 'utf8');
const submitStart = source.indexOf("deliveryForm.addEventListener('submit', async (event) => {");
const submitEnd = source.indexOf('// Original, code-native 3D ornaments.', submitStart);
assert.ok(submitStart >= 0 && submitEnd > submitStart, 'production submit callback is present');
const callback = source.slice(submitStart, submitEnd)
  .replace("await import('./reading-pdf-document.js')", 'await loadPdfModule()');
const configStart = source.indexOf('async function updateServiceConfig()');
const configEnd = source.indexOf('async function updateParticipantInfo()', configStart);
assert.ok(configStart >= 0 && configEnd > configStart, 'production config refresh is present');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const reading = (mode = 'saju', title = '합성 결과') => ({ mode, type: 'INFP', title,
  summary: '합성 자료만 사용하는 UI 검수', keywords: ['합성'], calculation: { details: { solarDate: '2005-12-23' } } });
const input = (nickname = '합성 입력') => ({ nickname, birthDate: '2005-12-23', birthTime: '08:37', calendar: 'solar' });
const config = () => ({ collectionEnabled: true, deliveryConfigured: { email: true, sms: false },
  consentVersion: 'synthetic-v2', operatorName: '합성 운영자', contactEmail: 'operator@example.test', retentionDays: 90, followupEnabled: false });

function harness() {
  const nodes = new Map(), calls = [], pending = [], documents = [];
  const getNode = (id) => {
    if (!nodes.has(id)) nodes.set(id, { textContent: '', disabled: false, open: true,
      classList: { values: new Set(), add(value) { this.values.add(value); }, remove(value) { this.values.delete(value); } } });
    return nodes.get(id);
  };
  const fields = { channel: { value: 'email' }, contact: { value: 'synthetic@example.test' },
    storeBirthData: { checked: false }, followupConsent: { checked: false }, resultConsent: { checked: true }, ageConfirm14: { checked: true } };
  let handler, resets = 0, uuid = 0, configValue = config();
  const deliveryForm = { elements: fields, addEventListener(name, callback) { assert.equal(name, 'submit'); handler = callback; },
    querySelectorAll() { return []; }, reset() { resets++; fields.contact.value = ''; fields.resultConsent.checked = false; } };
  const state = {
    $: getNode, deliveryForm, currentReading: reading(), currentInput: input(), serviceConfig: config(),
    deliveryViewGeneration: 1, pendingDelivery: false, deliveryAttempt: null, deliveryDocuments: new WeakMap(),
    modes: { saju: '사주', ziwei: '자미두수', zodiac: '별자리' },
    crypto: { randomUUID() { return `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`; } },
    document: { querySelectorAll() { return []; } },
    async fetch(url, options) {
      if (url === '/api/config') return { ok: true, async json() { return configValue; } };
      assert.equal(url, '/api/requests');
      assert.equal(options.method, 'POST'); assert.equal(options.credentials, 'same-origin');
      calls.push(JSON.parse(options.body));
      const response = deferred(); pending.push(response); return response.promise;
    },
    async loadPdfModule() { return { buildReadingPdfDocument(values) {
      documents.push(values);
      return { version: 1, mode: values.reading.mode, title: values.reading.title,
        birthData: values.includeBirthData ? { date: values.input.birthDate, time: values.input.birthTime } : null };
    } }; },
  };
  const context = vm.createContext(state);
  vm.runInContext(`${source.slice(configStart, configEnd)}\n${callback}`, context, { filename: 'production-pdf-email-ui.js' });
  return { state, fields, nodes, calls, pending, documents, node: getNode,
    get resets() { return resets; }, get uuidCount() { return uuid; },
    submit() { return handler({ preventDefault() {} }); },
    async waitForPost(count = 1) {
      for (let attempt = 0; attempt < 20 && calls.length < count; attempt++) await Promise.resolve();
      assert.equal(calls.length, count, 'expected mocked POST is reached');
    },
    accept(index = 0, data = { status: 'sent' }, ok = true) { pending[index].resolve({ ok, async json() { return data; } }); },
    fail(index = 0) { pending[index].reject(new Error('합성 네트워크 오류')); },
    async refresh(next = config()) { configValue = next; return vm.runInContext('updateServiceConfig()', context); },
    newView({ sameReading = false } = {}) {
      if (!sameReading) { state.currentReading = reading('zodiac', '다음 합성 결과'); state.currentInput = input('다음 입력'); }
      state.deliveryViewGeneration++;
      fields.contact.value = 'next@example.test'; fields.resultConsent.checked = true;
      getNode('delivery-message').textContent = '새 결과 신청 화면'; getNode('delivery-dialog').open = true;
    },
  };
}

let checks = 0;
async function check(label, action) { await action(); checks++; console.log(`PASS ${label}`); }

await check('unconfigured sender fails closed without creating a document or POST', async () => {
  const h = harness(); h.state.serviceConfig.deliveryConfigured.email = false;
  await h.submit(); assert.equal(h.calls.length, 0); assert.equal(h.documents.length, 0); assert.equal(h.resets, 0);
});
await check('normal sent acknowledgement resets only its own form and excludes original birth fields', async () => {
  const h = harness(), task = h.submit(); await h.waitForPost();
  assert.equal(h.state.pendingDelivery, true); assert.equal(h.node('delivery-fields').disabled, true);
  assert.equal(h.calls[0].storeBirthData, false); assert.ok(!('birthDate' in h.calls[0])); assert.ok(!('birthTime' in h.calls[0]));
  assert.equal(h.documents[0].includeBirthData, false);
  h.accept(); await task; assert.equal(h.resets, 1); assert.equal(h.state.pendingDelivery, false);
  assert.match(h.node('delivery-message').textContent, /접수/); assert.equal(h.node('delivery-fields').disabled, false);
});
await check('double submit is suppressed and config refresh cannot unlock a pending form', async () => {
  const h = harness(), task = h.submit(); await h.waitForPost(); await h.submit();
  assert.equal(h.calls.length, 1); await h.refresh(); assert.equal(h.node('delivery-fields').disabled, true);
  h.accept(); await task;
});
await check('old successful POST cannot clear new-result contact or claim its delivery', async () => {
  const h = harness(), task = h.submit(); await h.waitForPost(); h.newView();
  h.accept(); await task; assert.equal(h.resets, 0); assert.equal(h.fields.contact.value, 'next@example.test');
  assert.equal(h.fields.resultConsent.checked, true); assert.match(h.node('delivery-message').textContent, /이전 요청/);
  assert.doesNotMatch(h.node('delivery-message').textContent, /PDF 이메일을 접수/);
});
await check('reopening the same reading creates a distinct view and avoids an old reset', async () => {
  const h = harness(), task = h.submit(); await h.waitForPost(); h.newView({ sameReading: true });
  h.accept(); await task; assert.equal(h.resets, 0); assert.equal(h.fields.contact.value, 'next@example.test');
});
await check('stale server and network errors do not overwrite a new view with an old error', async () => {
  for (const network of [false, true]) {
    const h = harness(), task = h.submit(); await h.waitForPost(); h.newView();
    if (network) h.fail(); else h.accept(0, { error: { message: '이전 서버 오류' } }, false);
    await task; assert.equal(h.resets, 0); assert.equal(h.fields.contact.value, 'next@example.test');
    assert.doesNotMatch(h.node('delivery-message').textContent, /네트워크 오류|이전 서버 오류/);
  }
});
await check('a same-payload retry reuses both its PDF document and idempotency key', async () => {
  const h = harness(), first = h.submit(); await h.waitForPost(); h.fail(); await first;
  const second = h.submit(); await h.waitForPost(2);
  assert.equal(h.calls[0].requestKey, h.calls[1].requestKey); assert.equal(h.documents.length, 1); assert.equal(h.uuidCount, 1);
  h.accept(1); await second;
});
await check('recipient change gets a new key but reuses the same non-birth document', async () => {
  const h = harness(), first = h.submit(); await h.waitForPost(); h.fail(); await first;
  h.fields.contact.value = 'another@example.test'; const second = h.submit(); await h.waitForPost(2);
  assert.notEqual(h.calls[0].requestKey, h.calls[1].requestKey); assert.equal(h.documents.length, 1);
  h.accept(1); await second;
});
await check('birth inclusion changes the document/key and uses the equivalent solar date', async () => {
  const h = harness(), first = h.submit(); await h.waitForPost(); h.fail(); await first;
  h.fields.storeBirthData.checked = true; const second = h.submit(); await h.waitForPost(2);
  assert.notEqual(h.calls[0].requestKey, h.calls[1].requestKey); assert.equal(h.documents.length, 2);
  assert.equal(h.documents[1].includeBirthData, true); assert.equal(h.calls[1].birthDate, '2005-12-23'); assert.equal(h.calls[1].birthTime, '08:37');
  h.accept(1); await second;
});
await check('unconfirmed acceptance keeps contact/consent for a safe same-key retry', async () => {
  const h = harness(), task = h.submit(); await h.waitForPost(); h.accept(0, { status: 'sending', message: '처리 중' });
  await task; assert.equal(h.resets, 0); assert.equal(h.fields.contact.value, 'synthetic@example.test');
  assert.equal(h.node('delivery-message').textContent, '처리 중');
});
await check('service disabled during POST remains disabled when the old request finishes', async () => {
  const h = harness(), task = h.submit(); await h.waitForPost();
  h.state.serviceConfig = { ...config(), collectionEnabled: false }; h.accept(); await task;
  assert.equal(h.node('delivery-fields').disabled, true);
});
await check('document-module delay retains the submitted reading/input snapshot', async () => {
  const h = harness(), moduleGate = deferred(), originalLoader = h.state.loadPdfModule;
  h.state.loadPdfModule = () => moduleGate.promise;
  const oldReading = h.state.currentReading, oldInput = h.state.currentInput, task = h.submit();
  h.newView(); moduleGate.resolve(await originalLoader()); await h.waitForPost();
  assert.equal(h.documents[0].reading, oldReading); assert.equal(h.documents[0].input, oldInput);
  assert.equal(h.calls[0].mode, 'saju'); assert.equal(h.calls[0].document.title, '합성 결과');
  h.accept(); await task; assert.equal(h.resets, 0); assert.equal(h.fields.contact.value, 'next@example.test');
});

assert.ok(source.includes('deliveryViewGeneration++;') && source.includes('const generation = ++deliveryViewGeneration;'),
  'result/open transitions invalidate old UI views');
console.log(`${checks} production-callback PDF mail UI regression groups passed. All network, DOM and document-building boundaries were mocked; no email, DB or browser was accessed.`);
