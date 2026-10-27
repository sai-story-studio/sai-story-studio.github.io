// Isolated dashboard UI contracts: synthetic identities, DOM and fetch only.
// Never reads environment credentials, reaches a server, downloads real data or sends mail.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const base = new URL('../public/experience/', import.meta.url);
const html = await readFile(new URL('operators.html', base), 'utf8');
const admin = await readFile(new URL('admin.js', base), 'utf8');
const operators = await readFile(new URL('operators.js', base), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
let checks = 0;
async function test(label, run) { await run(); checks += 1; console.log(`PASS ${label}`); }
class Node {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.listeners = {}; this.dataset = {}; this.value = ''; this.checked = false; this.disabled = false; this.hidden = true; this.open = false; this._text = ''; this.classList = { toggle() {} }; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(_) { throw new Error('HTML insertion is forbidden'); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; this._text = ''; }
  addEventListener(name, action) { (this.listeners[name] ??= []).push(action); }
  async emit(name, event = {}) { for (const action of this.listeners[name] ?? []) await action({ target: this, preventDefault() {}, ...event }); }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.tagName === 'button' && (selector.includes('data-remove') ? child.dataset.remove : child.dataset.action) ? [child] : []), ...child.querySelectorAll(selector)]); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  focus() { this.focused = true; }
  click() { this.clicked = true; }
  remove() { this.removed = true; }
  reportValidity() { return true; }
  reset() { if (this.elements) for (const node of Object.values(this.elements)) node.value = ''; }
}
const settle = async () => { for (let index = 0; index < 6; index += 1) await new Promise(resolve => setImmediate(resolve)); };
function harness({ owner = false, recordsStatus = 200, personalFlag = null, configured = true } = {}) {
  const nodes = new Map(ids.map(id => [id, new Node(id.endsWith('-dialog') ? 'dialog' : 'div')]));
  const node = id => nodes.get(id);
  node('operator-form').elements = { email: node('operator-email') };
  const common = { mode: 'saju', channel: 'email', resultType: 'INFP', contactMasked: 's***@example.test', createdAt: '2026-10-22T01:02:03Z', consentAt: '2026-10-22T01:02:03Z', expiresAt: '2027-01-20T01:02:03Z', resultConsent: true, followupConsent: false, meetupTopics: [], consentVersion: 'synthetic-only-v1', status: 'requested' };
  let records = [{ ...common, id: 'synthetic-request' }, { ...common, id: 'synthetic-sending', status: 'sending' }, { ...common, id: 'synthetic-sent', status: 'sent' }, { ...common, id: 'synthetic-sms', channel: 'sms' }];
  const requests = [], listeners = {}, body = new Node('body');
  const state = { owner, recordsStatus, personalFlag, configured, scenario: null, downloads: 0 };
  async function fetchMock(path, options = {}) {
    const request = { path, method: options.method || 'GET', options }; requests.push(request);
    if (state.scenario) { const response = await state.scenario(request); if (response) return response; }
    if (path === '/api/admin/operators') {
      if (!state.owner) return Response.json({ error: { message: '합성 소유자 전용' } }, { status: 403 });
      if (request.method === 'POST') return Response.json({ added: true, message: '합성 추가 완료' });
      return Response.json({ canManageOperators: true, operators: [{ id: 'operator-synthetic', email: 'synthetic@example.test', source: 'database', removable: true, createdAt: common.createdAt }], counts: { database: 1, environment: 0 }, maxDatabaseOperators: 20 });
    }
    if (path.startsWith('/api/admin/operators/') && request.method === 'DELETE') return Response.json({ removed: true, message: '합성 해제 완료' });
    if (state.recordsStatus !== 200) return Response.json({ error: { message: `합성 기록 권한 ${state.recordsStatus}` } }, { status: state.recordsStatus });
    if (path.startsWith('/api/admin/records?')) {
      const personal = new URL(path, 'https://synthetic.example.test').searchParams.get('includePersonal') === 'true';
      return Response.json({ records: records.map(record => personal ? { ...record, contact: 'synthetic@example.test', nickname: '합성 이름', birthDate: '2000-02-29', birthTime: '08:37', result: { title: '합성 결과', summary: '<img src=x onerror=notExecuted()>' } } : record), personalDataIncluded: state.personalFlag ?? personal, summary: { total: 29, byStatus: { sent: 1 }, followupConsented: 2 }, pagination: { total: 29, limit: 25, offset: 0, hasMore: true }, deliveryConfigured: { email: state.configured, sms: false } });
    }
    if (path === '/api/admin/export') return new Response('synthetic,csv');
    if (path.startsWith('/api/admin/send/') && request.method === 'POST') return Response.json({ accepted: true });
    if (path.startsWith('/api/admin/records/') && request.method === 'DELETE') { const id = decodeURIComponent(path.split('/').at(-1)); records = records.filter(record => record.id !== id); return Response.json({ removed: true }); }
    throw new Error(`Unexpected synthetic route ${request.method} ${path}`);
  }
  class SyntheticURL extends URL { static createObjectURL() { state.downloads += 1; return 'blob:synthetic'; } static revokeObjectURL() {} }
  const context = vm.createContext({ document: { getElementById: node, createElement: tag => new Node(tag), body }, window: { addEventListener: (event, listener) => { (listeners[event] ??= []).push(listener); }, setTimeout: action => action() }, fetch: fetchMock, AbortController, URL: SyntheticURL, Date, console });
  for (const source of [operators, admin]) vm.runInContext(`(() => {\n${source}\n})();`, context);
  return { node, state, requests, rows: () => node('records-body').children, ownerRows: () => node('operators-rows').children, async windowEvent(name, event = {}) { for (const action of listeners[name] ?? []) await action(event); await settle(); } };
}
function actions(h, row = 0) { return h.rows()[row].children.at(-1).children; }
async function click(h, id) { await h.node(id).emit('click'); await settle(); }
await test('dashboard contains one static entrance per area, unique IDs and legacy redirect only', async () => {
  assert.equal(new Set(ids).size, ids.length);
  assert.match(html, /id="delivery-management"/); assert.match(html, /id="access-management"/);
  const header = html.match(/<header class="operators-header">[\s\S]*?<\/header>/)[0];
  assert.doesNotMatch(header, /admin\.html|participants\.html|<nav/);
  assert.equal([...html.matchAll(/href="\.\/participants\.html"/g)].length, 1);
  assert.doesNotMatch(html, /operators-quick-links|<iframe/i);
  for (const asset of ['operators.js', 'admin.js', 'operators.css', 'admin-modern.css']) assert.ok(html.includes(`${asset}?v=27-management`));
  const legacy = await readFile(new URL('admin.html', base), 'utf8');
  assert.match(legacy, /http-equiv="refresh" content="0;url=\.\/operators\.html#delivery-management"/);
  assert.match(legacy, /href="\.\/operators\.html#delivery-management"/); assert.doesNotMatch(legacy, /admin-content|<script/);
  const participants = await readFile(new URL('participants.html', base), 'utf8');
  assert.match(participants, /href="\.\/operators\.html#delivery-management"/); assert.doesNotMatch(participants, /href="\.\/admin\.html"/);
  assert.doesNotMatch(await readFile(new URL('admin-navigation.js', base), 'utf8'), /document\.|append\(/);
});
await test('initial load is read-only; general operator records survive owner-only 403', async () => {
  const h = harness(); await settle();
  assert.equal(h.requests.length, 2); assert.ok(h.requests.every(request => request.method === 'GET'));
  assert.equal(h.node('admin-content').hidden, false); assert.equal(h.node('operators-content').hidden, true); assert.equal(h.node('operators-gate').hidden, false);
  assert.equal(h.node('operator-fields').disabled, true); assert.equal(h.rows().length, 4);
  assert.match(h.node('records-body').textContent, /s\*\*\*@example.test/); assert.doesNotMatch(h.node('records-body').textContent, /synthetic@example.test/);
  assert.equal(h.node('reveal-personal').checked, false); assert.equal(h.state.downloads, 0);
});
await test('owner gets both independent areas, add/revoke require explicit confirmations', async () => {
  const h = harness({ owner: true }); await settle(); assert.equal(h.node('operators-content').hidden, false); assert.equal(h.node('admin-content').hidden, false);
  h.node('operator-email').value = ' New@Example.Test '; await h.node('operator-form').emit('submit');
  assert.equal(h.node('operator-confirm-dialog').open, true); assert.equal(h.requests.filter(request => request.method === 'POST').length, 0);
  await click(h, 'operator-cancel'); await click(h, 'operator-confirm'); assert.equal(h.requests.filter(request => request.method === 'POST').length, 0);
  h.node('operator-email').value = 'New@Example.Test'; await h.node('operator-form').emit('submit'); await click(h, 'operator-confirm');
  assert.deepEqual(JSON.parse(h.requests.find(request => request.method === 'POST').options.body), { email: 'new@example.test' });
  await h.ownerRows()[0].children.at(-1).children[0].emit('click'); assert.equal(h.requests.filter(request => request.method === 'DELETE').length, 0);
  await click(h, 'operator-confirm'); assert.equal(h.requests.filter(request => request.method === 'DELETE').length, 1);
});
await test('masking response and current checkbox both gate full detail; uncheck erases open text', async () => {
  const h = harness(); await settle(); await actions(h)[0].emit('click');
  assert.doesNotMatch(h.node('record-detail').textContent, /2000-02-29|합성 이름/);
  h.node('reveal-personal').checked = true; await h.node('reveal-personal').emit('change'); await settle(); await actions(h)[0].emit('click');
  assert.match(h.node('record-detail').textContent, /2000-02-29/); assert.match(h.node('record-detail').textContent, /<img src=x/);
  h.node('reveal-personal').checked = false; await h.node('reveal-personal').emit('change');
  assert.equal(h.node('record-detail').textContent, ''); assert.equal(h.node('record-dialog').open, false); await settle();
  assert.doesNotMatch(h.node('records-body').textContent, /synthetic@example.test/);
});
await test('out-of-order full response cannot restore personal data after remasking', async () => {
  const h = harness(); await settle(); let release;
  const gate = new Promise(resolve => { release = resolve; });
  h.state.scenario = async request => { if (request.path.includes('includePersonal=true')) { await gate; return Response.json({ records: [], personalDataIncluded: true, summary: { total: 0, byStatus: {} }, pagination: { total: 0, hasMore: false }, deliveryConfigured: { email: true } }); } };
  h.node('reveal-personal').checked = true; await h.node('reveal-personal').emit('change'); await settle();
  h.node('reveal-personal').checked = false; await h.node('reveal-personal').emit('change'); await settle();
  assert.equal(h.rows().length, 4); release(); await settle(); assert.equal(h.rows().length, 4); assert.equal(h.node('reveal-personal').checked, false);
});
await test('a personal-data flag mismatch fails closed without exposing the response', async () => {
  const h = harness({ personalFlag: false }); await settle();
  h.node('reveal-personal').checked = true; await h.node('reveal-personal').emit('change'); await settle();
  assert.equal(h.node('admin-content').hidden, true); assert.equal(h.rows().length, 0); assert.equal(h.node('reveal-personal').checked, false); assert.match(h.node('admin-message').textContent, /응답 형식/);
});
for (const status of [401, 403]) await test(`list ${status} clears details, counts, pending confirmation and reveal`, async () => {
  const h = harness(); await settle(); h.node('reveal-personal').checked = true; await h.node('reveal-personal').emit('change'); await settle();
  await actions(h)[0].emit('click'); await actions(h)[2].emit('click'); assert.equal(h.node('confirm-dialog').open, true);
  h.state.recordsStatus = status; await click(h, 'refresh-records');
  assert.equal(h.node('admin-content').hidden, true); assert.equal(h.node('admin-access').hidden, false); assert.equal(h.rows().length, 0);
  assert.equal(h.node('record-dialog').open, false); assert.equal(h.node('record-detail').textContent, ''); assert.equal(h.node('confirm-dialog').open, false); assert.equal(h.node('confirm-text').textContent, '');
  assert.equal(h.node('stat-total').textContent, '—'); assert.equal(h.node('reveal-personal').checked, false);
  await click(h, 'confirm-action'); assert.equal(h.requests.filter(request => request.method !== 'GET').length, 0);
});
await test('send/delete restrictions and provider terminology remain unchanged', async () => {
  const h = harness(); await settle(); assert.equal(actions(h)[1].disabled, false); assert.equal(actions(h, 1)[1].disabled, true); assert.equal(actions(h, 1)[2].disabled, true); assert.equal(actions(h, 2)[1].disabled, true); assert.equal(actions(h, 3)[1].disabled, true);
  assert.match(h.rows()[2].textContent, /제공자 접수 완료/);
  await actions(h, 1)[2].emit('click'); await click(h, 'confirm-action'); assert.equal(h.requests.filter(request => request.method !== 'GET').length, 0);
  await actions(h)[1].emit('click'); assert.match(h.node('confirm-text').textContent, /한 건 발송/); assert.equal(h.requests.filter(request => request.method === 'POST').length, 0);
  await Promise.all([h.node('confirm-action').emit('click'), h.node('confirm-action').emit('click')]); await settle();
  assert.equal(h.requests.filter(request => request.path === '/api/admin/send/synthetic-request' && request.method === 'POST').length, 1);
  const unconfigured = harness({ configured: false }); await settle(); assert.ok(unconfigured.rows().every((_, index) => actions(unconfigured, index)[1].disabled));
});
await test('delete and CSV still require confirmation and use existing endpoints', async () => {
  const h = harness(); await settle(); await actions(h)[2].emit('click'); assert.match(h.node('confirm-text').textContent, /영구 삭제/);
  await click(h, 'cancel-action'); assert.equal(h.requests.filter(request => request.method === 'DELETE').length, 0);
  await actions(h)[2].emit('click'); await click(h, 'confirm-action'); assert.equal(h.requests.filter(request => request.method === 'DELETE').length, 1);
  await click(h, 'export-records'); assert.equal(h.state.downloads, 0); assert.match(h.node('confirm-text').textContent, /개인정보가 포함된 CSV/);
  await click(h, 'confirm-action'); assert.equal(h.state.downloads, 1); assert.equal(h.requests.filter(request => request.path === '/api/admin/export').length, 1);
});
for (const method of ['POST', 'DELETE', 'CSV']) await test(`pending ${method} denied after full detail erases all sensitive UI`, async () => {
  const h = harness(); await settle(); h.node('reveal-personal').checked = true; await h.node('reveal-personal').emit('change'); await settle(); await actions(h)[0].emit('click');
  h.state.scenario = async request => { if ((method === 'CSV' && request.path === '/api/admin/export') || request.method === method) return Response.json({ error: { message: '합성 변경 권한 거부' } }, { status: 403 }); };
  if (method === 'CSV') await click(h, 'export-records'); else await actions(h)[method === 'POST' ? 1 : 2].emit('click');
  await click(h, 'confirm-action'); assert.equal(h.node('admin-access').hidden, false); assert.equal(h.rows().length, 0); assert.equal(h.node('record-detail').textContent, ''); assert.equal(h.node('reveal-personal').checked, false); assert.equal(h.state.downloads, 0);
});
for (const type of ['CSV', 'DELETE', 'OWNER']) await test(`pagehide suppresses late ${type} response and stale confirmation work`, async () => {
  const h = harness({ owner: true }); await settle(); let release; const gate = new Promise(resolve => { release = resolve; });
  h.state.scenario = async request => {
    if ((type === 'CSV' && request.path === '/api/admin/export') || (type === 'DELETE' && request.method === 'DELETE') || (type === 'OWNER' && request.method === 'POST')) { await gate; return type === 'CSV' ? new Response('synthetic') : Response.json(type === 'OWNER' ? { added: true, message: '늦은 성공' } : { removed: true }); }
  };
  if (type === 'OWNER') { h.node('operator-email').value = 'synthetic@example.test'; await h.node('operator-form').emit('submit'); }
  else if (type === 'CSV') await click(h, 'export-records'); else await actions(h)[2].emit('click');
  const pending = h.node(type === 'OWNER' ? 'operator-confirm' : 'confirm-action').emit('click'); await settle(); const before = h.requests.length;
  await h.windowEvent('pagehide'); release(); await pending; await settle();
  assert.equal(h.requests.length, before); assert.equal(h.state.downloads, 0); assert.equal(h.rows().length, 0); assert.equal(h.ownerRows().length, 0); assert.equal(h.node('record-detail').textContent, ''); assert.equal(h.node('confirm-dialog').open, false); assert.equal(h.node('operator-confirm-dialog').open, false);
  assert.equal(h.node('admin-content').hidden, true); assert.equal(h.node('operators-content').hidden, true);
  await click(h, 'confirm-action'); await click(h, 'operator-confirm'); assert.equal(h.requests.length, before);
});
await test('owner refresh invalidates stale grant confirmation; denied reload is not overwritten by success', async () => {
  const h = harness({ owner: true }); await settle(); h.node('operator-email').value = 'synthetic@example.test'; await h.node('operator-form').emit('submit'); await click(h, 'operators-refresh'); await click(h, 'operator-confirm'); assert.equal(h.requests.filter(request => request.method === 'POST').length, 0);
  h.node('operator-email').value = 'synthetic@example.test'; await h.node('operator-form').emit('submit');
  h.state.scenario = async request => { if (request.path === '/api/admin/operators' && request.method === 'POST') { h.state.owner = false; return Response.json({ added: true, message: '합성 성공' }); } };
  await click(h, 'operator-confirm'); assert.equal(h.node('operators-gate').hidden, false); assert.match(h.node('operators-status').textContent, /소유자 전용/); assert.doesNotMatch(h.node('operators-status').textContent, /합성 성공/); assert.equal(h.node('admin-content').hidden, false);
});
for (const method of ['POST', 'DELETE']) for (const status of [401, 403]) await test(`owner ${method} non-JSON ${status} still clears private access data`, async () => {
  const h = harness({ owner: true }); await settle();
  h.node('operator-email').value = 'synthetic@example.test';
  if (method === 'POST') await h.node('operator-form').emit('submit');
  else await h.ownerRows()[0].children.at(-1).children[0].emit('click');
  h.state.scenario = async request => { if (request.method === method) return new Response('', { status }); };
  await click(h, 'operator-confirm');
  assert.equal(h.node('operators-gate').hidden, false); assert.equal(h.node('operators-content').hidden, true);
  assert.equal(h.ownerRows().length, 0); assert.equal(h.node('operator-email').value, ''); assert.equal(h.node('operator-fields').disabled, true);
  assert.equal(h.node('operator-confirm-dialog').open, false); assert.equal(h.node('operator-confirm-text').textContent, '');
  assert.equal(h.node('admin-content').hidden, false);
});
await test('bfcache restoration reloads both areas masked and lifecycle errors never send writes', async () => {
  const h = harness({ owner: true }); await settle(); h.node('reveal-personal').checked = true; await h.node('reveal-personal').emit('change'); await settle();
  await h.windowEvent('pagehide'); await h.windowEvent('pageshow', { persisted: true }); assert.equal(h.node('admin-content').hidden, false); assert.equal(h.node('operators-content').hidden, false); assert.equal(h.node('reveal-personal').checked, false); assert.ok(h.requests.every(request => request.method === 'GET'));
  for (const source of [admin, operators]) assert.doesNotMatch(source, /innerHTML|localStorage|sessionStorage|sendBeacon/);
});
console.log(`PASS ${checks} isolated admin-consolidation groups. Synthetic DOM/fetch only; no real API, DB, mail or downloads.`);
