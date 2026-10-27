// Local synthetic module/DOM tests. No database, real network or personal data.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { prepareReadingRecord, recordConfigReady, createReadingRecordController } from '../public/experience/reading-records.js';
import { calculateReading } from '../public/experience/reading-engine.js';

const config = { collectionEnabled: true, operatorName: 'Synthetic', contactEmail: 'operator@example.test', retentionDays: 90,
  readingRecord: { enabled: true, consentVersion: 'reading-records-v1', purpose: 'Synthetic record management', minimumAge: 14 } };
const values = { name: 'Synthetic', phone: '010-0000-0000', topic: 'saju' }, now = new Date('2026-10-22T00:00:00Z');
let checks = 0;
function check(label, fn) { fn(); checks++; console.log(`PASS ${label}`); }
check('record config is independent of retired advertising settings and fails closed', () => {
  assert.equal(recordConfigReady(config), true);
  for (const candidate of [null, {}, { ...config, collectionEnabled: false }, { ...config, operatorName: '' },
    { ...config, readingRecord: { ...config.readingRecord, consentVersion: 'reading-leads-v1' } },
    { ...config, readingRecord: { ...config.readingRecord, minimumAge: 13 } }]) assert.equal(recordConfigReady(candidate), false);
});
check('record action requires valid name, phone and real birth date', () => {
  for (const extra of [{ name: '' }, { name: '가'.repeat(31) }, { name: 'a\nb' }, { phone: '' }, { phone: 'invalid' }]) assert.equal(prepareReadingRecord({ ...values, ...extra }, config, '1990-09-22', now).kind, 'error');
  for (const date of [null, '19900922', '1900-02-29', '2001-02-29', '1990-13-01', '1899-12-31', '2999-01-01']) assert.equal(prepareReadingRecord(values, config, date, now).kind, 'error');
});
check('age boundary follows Korean date without inventing an age checkbox', () => {
  assert.equal(prepareReadingRecord(values, config, '2012-10-22', now).kind, 'ready');
  assert.equal(prepareReadingRecord(values, config, '2012-10-23', now).kind, 'error');
  assert.equal(prepareReadingRecord(values, config, '2012-10-23', new Date('2026-10-22T15:00:00Z')).kind, 'ready');
});
check('payload contains solar birthday and named-action consent, not ads or result fields', () => {
  const payload = prepareReadingRecord({ ...values, marketingConsent: true, result: 'not transmitted', gender: 'female', birthTime: '12:00' }, config, '1990-09-22', now).payload;
  assert.deepEqual(Object.keys(payload).sort(), ['source', 'name', 'phone', 'birthDate', 'topic', 'recordConsent', 'consentVersion'].sort());
  assert.equal(payload.recordConsent, true); assert.equal(payload.birthDate, '1990-09-22');
  assert.equal(prepareReadingRecord({ ...values, phone: '+82 10 0000 0000' }, config, '1990-09-22', now).payload.phone, payload.phone);
});

const node = () => ({ textContent: '', disabled: false, classList: { toggle() {} } });
function fixture(request) {
  const nodes = new Map(), get = (id) => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
  const buttons = [get('calculate-button'), get('calculate-send-button'), get('calculate-view-only')];
  const form = { elements: { phone: { value: '010-0000-0000' } }, querySelectorAll: () => buttons };
  let keys = 0;
  const controller = createReadingRecordController({ form, document: { getElementById: get }, request,
    uuid: () => `00000000-0000-4000-8000-${String(++keys).padStart(12, '0')}` });
  return { controller, get, form, buttons, get keys() { return keys; } };
}
const input = { nickname: 'Synthetic', birthDate: '1990-09-22', calendar: 'solar' };
const result = { mode: 'saju', type: 'ISTP', calculation: { details: { solarDate: '1990-09-22' } } };
const sent = [];
const f = fixture(async (path, options) => { sent.push({ path, options, payload: JSON.parse(options.body) }); return { ok: true, json: async () => ({ status: 'registered', id: 'receipt' }) }; });
f.controller.viewOnly(); assert.equal(sent.length, 0); assert.equal(f.get('calculate-button').disabled, true); assert.equal(f.get('calculate-view-only').disabled, false);
checks++; console.log('PASS view-only works with unknown config and sends zero requests');
f.controller.setConfig(config); f.controller.viewOnly(); assert.equal(sent.length, 0);
await f.controller.save({ input, result });
assert.equal(sent.length, 1); assert.equal(sent[0].path, '/api/participants'); assert.equal(sent[0].payload.birthDate, '1990-09-22');
assert.equal(sent[0].payload.recordConsent, true); assert.equal(sent[0].options.credentials, 'same-origin');
assert.match(f.get('reading-record-status').textContent, /저장했어요/);
checks++; console.log('PASS explicitly named save action sends one birth-containing record and receives a receipt');
await f.controller.save({ input, result }); assert.equal(sent[1].payload.requestKey, sent[0].payload.requestKey);
f.form.elements.phone.value = '+82 10 0000 0000'; await f.controller.save({ input, result }); assert.deepEqual(sent[2].payload, sent[0].payload);
checks++; console.log('PASS unchanged input and equivalent phone formats reuse the exact idempotency key');
await f.controller.save({ input: { ...input, birthDate: '1990-09-23' }, result: { ...result, calculation: { details: { solarDate: '1990-09-23' } } } });
assert.notEqual(sent[3].payload.requestKey, sent[0].payload.requestKey); checks++; console.log('PASS changed birthday generates a new request key');
f.controller.viewOnly(); assert.equal(sent.length, 4); checks++; console.log('PASS choosing ordinary viewing after a save never resubmits');
await f.controller.save({ input: { ...input, calendar: 'lunar' }, result: { ...result, calculation: { details: {} } } });
assert.equal(sent.length, 4); checks++; console.log('PASS lunar input without a verified solar conversion cannot leak raw lunar DOB');

let release;
const waiting = fixture(() => new Promise((resolve) => { release = resolve; })); waiting.controller.setConfig(config);
const pending = waiting.controller.save({ input, result }); assert.equal(waiting.controller.pending, true); assert.ok(waiting.buttons.every((b) => b.disabled));
await waiting.controller.save({ input, result }); assert.equal(waiting.keys, 1);
release({ ok: true, json: async () => ({ id: 'receipt', status: 'registered' }) }); await pending;
assert.ok(waiting.buttons.every((b) => !b.disabled)); checks++; console.log('PASS pending blocks duplicate submit and restores all buttons');

const attempts = [];
const retry = fixture(async (_path, options) => { attempts.push(JSON.parse(options.body)); if (attempts.length === 1) throw new Error('Synthetic interrupted reply'); return { ok: true, json: async () => ({ id: 'receipt', status: 'registered' }) }; });
retry.controller.setConfig(config); await retry.controller.save({ input, result }); assert.match(retry.get('reading-record-status').textContent, /再|재확인/);
await retry.controller.save({ input, result }); assert.deepEqual(attempts[0], attempts[1]); retry.controller.suspend();
assert.equal(retry.get('calculate-button').disabled, true); assert.equal(retry.get('calculate-view-only').disabled, false);
checks++; console.log('PASS uncertain reply retries same body and navigation invalidates only storage readiness');

const app = await readFile(new URL('../public/experience/app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/experience/index.html', import.meta.url), 'utf8');
check('app saves only explicit save submitter, default/view/send never imply record consent', () => {
  assert.match(app, /const action = event\.submitter\?\.value \|\| 'view'/);
  assert.match(app, /if \(action === 'save'\) void readingRecord\.save\(\{ input, result \}\)/);
  assert.ok(app.indexOf('renderReading(result, input);') < app.indexOf('void readingRecord.save'));
});
check('main notice is native closed disclosure, has no consent checkboxes or obsolete phone label', () => {
  const readingForm = html.split('<form id="reading-form"')[1]?.split('</form>')[0];
  assert.ok(readingForm, 'main reading form exists');
  assert.match(readingForm, /<input id="reading-phone" name="phone" type="tel"[^>]*>/);
  assert.doesNotMatch(readingForm.match(/<input id="reading-phone"[^>]*>/)[0], /\brequired\b/);
  assert.match(html, /<details id="reading-record-details" class="reading-record-details">/);
  for (const old of ['leadCollectionConsent', 'leadSms', 'leadPhone', 'leadAgeConfirm', '선택 · 모임 소식을 받을 때만', '모임 소식도 받아볼까요?']) assert.ok(!html.includes(old));
  assert.match(html, /id="calculate-button"[^>]+value="save"/); assert.match(html, /id="calculate-view-only"[^>]+value="view"/);
});

const sandbox = {}; sandbox.self = sandbox; sandbox.window = sandbox; vm.createContext(sandbox);
for (const file of ['lunar.js', 'iztro.min.js']) vm.runInContext(await readFile(new URL(`../public/experience/vendor/${file}`, import.meta.url), 'utf8'), sandbox);
const original = { Solar: globalThis.Solar, Lunar: globalThis.Lunar, iztro: globalThis.iztro };
Object.assign(globalThis, { Solar: sandbox.Solar, Lunar: sandbox.Lunar, iztro: sandbox.iztro });
try {
  check('three real reading modes store their equivalent solar day, never the raw lunar date', () => {
    for (const mode of ['zodiac', 'saju', 'ziwei']) {
      const birthInput = { mode, nickname: 'Synthetic', birthDate: '2005-11-23', calendar: mode === 'zodiac' ? 'solar' : 'lunar', birthTime: '08:37', gender: 'female', leapMonth: false };
      const reading = calculateReading(birthInput);
      const prepared = prepareReadingRecord({ ...values, topic: mode }, config, reading.calculation.details.solarDate, now);
      assert.equal(prepared.kind, 'ready'); assert.equal(prepared.payload.birthDate, reading.calculation.details.solarDate);
      if (mode !== 'zodiac') assert.notEqual(prepared.payload.birthDate, birthInput.birthDate);
    }
  });
} finally { Object.assign(globalThis, original); }
console.log(`PASS ${checks} reading-record groups. Synthetic modules/DOM only; no network or DB.`);
