// Isolated UI tests: synthetic records + a small DOM and fetch stand-in only.
// No HTTP request, server, real database, storage or personal data is used.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../public/experience/', import.meta.url);
const source = await readFile(new URL('participants.js', root), 'utf8');
const html = await readFile(new URL('participants.html', root), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length);
let checks = 0;
const test = async (label, action) => { await action(); checks += 1; console.log(`PASS ${label}`); };
class Node {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.listeners = {}; this.value = ''; this.checked = false; this.hidden = false; this.disabled = false; this.open = false; this._text = ''; this.className = ''; this.classList = { toggle() {} }; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map((node) => node.textContent).join(''); }
  set innerHTML(_) { throw new Error('HTML insertion is forbidden'); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; this._text = ''; }
  addEventListener(name, listener) { (this.listeners[name] ??= []).push(listener); }
  async emit(name, event = {}) { for (const listener of this.listeners[name] ?? []) await listener({ target: this, ...event }); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  click() { this.clicked = true; }
  remove() { this.removed = true; }
}
const nodes = new Map(ids.map((id) => [id, new Node(id.endsWith('-dialog') ? 'dialog' : 'div')]));
for (const id of ['participant-topic', 'participant-source', 'participant-marketing']) nodes.get(id).value = 'all';
const dialogs = [...nodes.values()].filter((node) => node.tagName === 'dialog');
const body = new Node('body');
const windowListeners = {};
const requests = [];
const common = { collectionConsent: true, ageConfirm14: true, consentVersion: 'participants-v1', consentAt: '2026-10-22T01:00:00.000Z', createdAt: '2026-10-22T01:00:00.000Z', expiresAt: '2027-01-20T01:00:00.000Z', storeBirthData: false, status: 'registered' };
let records = [
  { ...common, id: 'legacy', nameMasked: '구*', phoneMasked: '010-****-0000', name: '합성 기존', phone: '01000000000', topic: 'mbti' },
  { ...common, id: 'join', source: 'join', marketingConsent: false, marketingChannels: ['sms'], nameMasked: '모*', phoneMasked: '010-****-0001', name: '합성 모임', phone: '01000000001', topic: 'saju' },
  { ...common, id: 'sms', source: 'reading', consentVersion: 'reading-leads-v1', marketingConsent: true, marketingChannels: ['sms'], marketingConsentAt: '2026-10-22T02:03:04.000Z', marketingConsentVersion: 'reading-leads-v1', nameMasked: '문*', phoneMasked: '010-****-0002', name: '<img src=x onerror="notExecuted()">', phone: '01000000002', topic: 'zodiac' },
  { ...common, id: 'phone', source: 'reading', marketingConsent: true, marketingChannels: ['phone'], nameMasked: '전*', phoneMasked: '010-****-0003', name: '합성 전화', phone: '01000000003', topic: 'ziwei' },
  { ...common, id: 'both', source: 'reading', marketingConsent: true, marketingChannels: ['phone', 'sms', 'sms', 'email'], nameMasked: '둘*', phoneMasked: '010-****-0004', name: '합성 양쪽', phone: '01000000004' },
  { ...common, id: 'false-string', source: 'reading', marketingConsent: 'true', marketingChannels: ['sms'], nameMasked: '거*', phoneMasked: '010-****-0005', name: '합성 비정상 값', phone: '01000000005' },
  { ...common, id: 'missing-channel', source: 'reading', marketingConsent: true, marketingChannels: [], nameMasked: '확*', phoneMasked: '010-****-0006', name: '합성 채널 미상', phone: '01000000006' },
  { ...common, id: 'reading-record', source: 'reading', consentVersion: 'reading-records-v1', storeBirthData: true,
    birthDate: '1990-09-22', birthConsentAt: '2026-10-22T04:05:06.000Z', marketingConsent: false,
    marketingChannels: [], marketingConsentAt: null, marketingConsentVersion: null,
    nameMasked: '기*', phoneMasked: '010-****-0007', name: '합성 체험 기록', phone: '01000000007', topic: 'saju' },
  { ...common, id: 'join-birth', source: 'join', storeBirthData: true, birthDate: '1980-02-29', birthConsentAt: '2026-10-22T05:06:07.000Z',
    marketingConsent: false, marketingChannels: [], nameMasked: '생*', phoneMasked: '010-****-0008', name: '합성 기존 생일 선택', phone: '01000000008' },
];
let forbidden = false;
let fetchScenario = null;
const purpose = '합성 개인정보 수집 목적';
const marketingPurpose = '합성 광고 안내 목적 <문자와 전화>';
const recordPurpose = '성향 체험 입력 기록(이름·휴대전화·생년월일·선택 주제) 관리 및 보관';
async function fetchMock(path, options = {}) {
  const request = { path, method: options.method || 'GET', options }; requests.push(request);
  if (forbidden) return Response.json({ error: { code: 'ADMIN_FORBIDDEN', message: '합성 권한 거부' } }, { status: 403 });
  if (fetchScenario) { const response = await fetchScenario(request); if (response) return response; }
  if (path.startsWith('/api/admin/participants?')) {
    const personal = new URL(path, 'https://synthetic.example.test').searchParams.get('includePersonal') === 'true';
    return Response.json({ records: records.map((record) => {
      const { name, phone, birthDate, birthConsentAt, ...masked } = record;
      return personal ? { ...record, birthDate: birthDate ?? null, birthConsentAt: birthConsentAt ?? null, retentionDays: 90,
        consentPurpose: record.consentVersion === 'reading-records-v1' ? recordPurpose : purpose,
        marketingPurpose: record.marketingConsent === true ? marketingPurpose : null, meetupDescription: '합성 안내 설명' } : masked;
    }), summary: { total: 107, withBirthData: records.filter((record) => record.storeBirthData === true).length }, pagination: { total: 107, limit: 50, offset: 0, hasMore: true }, personalDataIncluded: personal });
  }
  if (path === '/api/admin/participants/export') return new Response('합성 CSV', { headers: { 'content-type': 'text/csv' } });
  if (request.method === 'DELETE' && path.startsWith('/api/admin/participants/')) {
    const id = decodeURIComponent(path.split('/').at(-1)); records = records.filter((record) => record.id !== id); return Response.json({ removed: true });
  }
  throw new Error('Unexpected mock path; no network fallback is permitted');
}
let csvDownloads = 0;
class SafeURL extends URL { static createObjectURL() { csvDownloads += 1; return 'blob:synthetic'; } static revokeObjectURL() {} }
const context = vm.createContext({ document: { getElementById: (id) => nodes.get(id), createElement: (tag) => new Node(tag), querySelectorAll: () => dialogs, body },
  window: { addEventListener: (name, listener) => { (windowListeners[name] ??= []).push(listener); }, setTimeout: (callback) => callback() },
  fetch: fetchMock, AbortController, URL: SafeURL, Date, console });
vm.runInContext(source.replace(/^import ['"]\.\/admin-navigation\.js['"];\r?\n/, ''), context);
const settle = async () => { for (let index = 0; index < 5; index += 1) await new Promise((resolve) => setImmediate(resolve)); };
const node = (id) => nodes.get(id);
const rows = () => node('participant-rows').children;
const details = () => Object.fromEntries(node('participant-detail').children.reduce((pairs, child, index, all) => {
  if (index % 2 === 0) pairs.push([child.textContent, all[index + 1].textContent]);
  return pairs;
}, []));
const setFilter = async (id, value) => { node(id).value = value; await node(id).emit('change'); await settle(); };
const resetFilters = async () => { for (const id of ['participant-topic', 'participant-source', 'participant-marketing']) node(id).value = 'all'; node('participant-search').value = ''; await node('participant-search').emit('input'); await settle(); };
await settle();

await test('default list remains masked; legacy joins never imply marketing consent', async () => {
  assert.equal(node('participants-content').hidden, false);
  assert.equal(rows().length, 9);
  assert.equal(rows()[0].children[2].textContent, '모임 관심 신청');
  assert.equal(rows()[0].children[7].textContent, '미동의');
  assert.equal(rows()[1].children[7].textContent, '미동의');
  assert.equal(rows()[5].children[7].textContent, '미동의');
  assert.equal(rows()[2].children[3].textContent, '문*');
  assert.ok(!node('participant-rows').textContent.includes('01000000002'));
  assert.equal(node('participant-total').textContent, '107');
  assert.equal(node('participant-birth-total').textContent, '2');
  assert.ok(!node('participant-rows').textContent.includes('1990-09-22'));
});
await test('source and channel filters affect only current page and never fetch/send', async () => {
  const before = requests.length;
  await setFilter('participant-source', 'join'); assert.equal(rows().length, 3);
  await setFilter('participant-source', 'reading'); assert.equal(rows().length, 6);
  await setFilter('participant-marketing', 'sms'); assert.equal(rows().length, 2);
  await setFilter('participant-marketing', 'phone'); assert.equal(rows().length, 2);
  await setFilter('participant-marketing', 'none'); assert.equal(rows().length, 2);
  await setFilter('participant-source', 'all'); assert.equal(rows().length, 5);
  await setFilter('participant-marketing', 'consented'); assert.equal(rows().length, 4);
  assert.equal(requests.length, before);
  assert.equal(node('participant-total').textContent, '107');
  assert.equal(node('participant-visible-total').textContent, '4');
  assert.ok(rows().some((row) => row.children[7].textContent === '동의 · 채널 확인 필요'));
  await resetFilters();
});
await test('search/topic/source/marketing intersect without disclosing unmasked contacts', async () => {
  await setFilter('participant-source', 'reading'); await setFilter('participant-marketing', 'sms'); await setFilter('participant-topic', 'zodiac');
  node('participant-search').value = '문*'; await node('participant-search').emit('input'); assert.equal(rows().length, 1);
  node('participant-search').value = '01000000002'; await node('participant-search').emit('input'); assert.equal(rows().length, 0);
  await resetFilters();
});
await test('masked details expose consent evidence but not full purposes/personal data', async () => {
  await rows()[2].children.at(-1).children[0].emit('click');
  const text = node('participant-detail').textContent;
  assert.ok(text.includes('메인 결과 보기') && text.includes('reading-leads-v1'));
  assert.ok(text.includes('광고 수신 동의 시각') && text.includes('문자'));
  assert.ok(!text.includes(marketingPurpose) && !text.includes('01000000002'));
  assert.equal(node('participant-detail-dialog').open, true);
});
await test('explicit full-data reload shows exact purpose safely; remasking clears dialog', async () => {
  node('participant-reveal').checked = true; await node('participant-reveal').emit('change'); await settle();
  assert.equal(rows()[2].children[3].textContent, '<img src=x onerror="notExecuted()">');
  await rows()[2].children.at(-1).children[0].emit('click');
  assert.ok(node('participant-detail').textContent.includes(marketingPurpose));
  assert.ok(node('participant-detail').textContent.includes(purpose));
  assert.equal(node('participant-detail').children.some((child) => child.tagName === 'img'), false);
  node('participant-reveal').checked = false; await node('participant-reveal').emit('change'); await settle();
  assert.equal(node('participant-detail-dialog').open, false);
  assert.equal(node('participant-detail').textContent, '');
  assert.equal(rows()[2].children[3].textContent, '문*');
});
await test('new record labels describe the save button and server age check, never checkbox or advertising consent', async () => {
  assert.match(rows()[7].children[2].textContent, /체험 입력 기록.*홍보 수신 미동의/);
  assert.equal(rows()[7].children[6].textContent, '기록 저장 요청');
  assert.equal(rows()[7].children[7].textContent, '미동의');
  await rows()[7].children.at(-1).children[0].emit('click');
  const detail = details();
  assert.equal(detail['상태'], '체험 입력 기록 저장 · 홍보 수신 미동의');
  assert.equal(detail['기록 저장 요청'], '기록 저장 버튼으로 요청');
  assert.equal(detail['기록 저장 안내 버전'], 'reading-records-v1');
  assert.equal(detail['생년월일 저장'], '기록 저장 버튼으로 저장');
  assert.match(detail['만 14세 이상 확인'], /입력 생년월일 기준.*서버 검증/);
  assert.equal(detail['광고 수신 동의 시각'], '—');
  assert.equal(detail['광고 수신 동의서 버전'], '—');
  assert.equal(Object.hasOwn(detail, '개인정보 수집·이용 동의'), false);
  assert.equal(Object.hasOwn(detail, '저장한 양력 생년월일'), false);
  assert.ok(!node('participant-detail').textContent.includes('1990-09-22'));
});
await test('new birthday is full-detail only; legacy birthday/ad consent evidence is preserved and remasking erases it', async () => {
  node('participant-reveal').checked = true; await node('participant-reveal').emit('change'); await settle();
  await rows()[7].children.at(-1).children[0].emit('click');
  const current = details();
  assert.equal(current['저장한 양력 생년월일'], '1990-09-22');
  assert.equal(current['기록 관리 목적'], recordPurpose);
  assert.ok(current['생년월일 저장 시각'] && current['생년월일 저장 시각'] !== '—');
  assert.equal(current['광고 안내 목적'], '광고 수신 미동의');
  assert.equal(Object.hasOwn(current, '모임 안내 내용'), false);
  await rows()[8].children.at(-1).children[0].emit('click');
  const legacyBirth = details();
  assert.equal(legacyBirth['생년월일 별도 저장'], '별도 선택 동의');
  assert.equal(legacyBirth['저장한 양력 생년월일'], '1980-02-29');
  assert.ok(legacyBirth['생년월일 동의 시각']);
  await rows()[2].children.at(-1).children[0].emit('click');
  const legacyAds = details();
  assert.equal(legacyAds['광고성 정보 수신 동의'], '별도 선택 동의');
  assert.equal(legacyAds['광고 수신 동의서 버전'], 'reading-leads-v1');
  assert.equal(legacyAds['개인정보 수집·이용 목적'], purpose);
  assert.equal(legacyAds['광고 안내 목적'], marketingPurpose);
  node('participant-reveal').checked = false; await node('participant-reveal').emit('change'); await settle();
  assert.equal(node('participant-detail').textContent, '');
  assert.equal(node('participant-detail-dialog').open, false);
  assert.ok(!node('participant-rows').textContent.includes('1990-09-22'));
});
await test('CSV and exact-record deletion still require confirmation and use existing APIs', async () => {
  await node('participant-export').emit('click'); assert.equal(csvDownloads, 0);
  await node('participant-confirm-action').emit('click'); await settle(); assert.equal(csvDownloads, 1);
  const before = requests.filter((request) => request.method === 'DELETE').length;
  await rows()[0].children.at(-1).children[1].emit('click');
  assert.equal(requests.filter((request) => request.method === 'DELETE').length, before);
  await node('participant-confirm-action').emit('click'); await settle();
  assert.equal(requests.at(-2).path, '/api/admin/participants/legacy');
  assert.equal(rows().length, 8);
  assert.ok(requests.every((request) => request.path.startsWith('/api/admin/participants')));
  assert.ok(requests.every((request) => ['GET', 'DELETE'].includes(request.method)));
});
await test('row selection, filtered select-all and cancellation never send a mutation', async () => {
  const before = requests.length;
  const input = rows()[0].children[0].children[0]; input.checked = true; await input.emit('change');
  assert.equal(node('participant-selected-count').textContent, '1건 선택');
  assert.equal(node('participant-select-all').indeterminate, true);
  assert.equal(node('participant-delete-selected').disabled, false);
  await node('participant-delete-selected').emit('click');
  assert.match(node('participant-confirm-text').textContent, /1건.*영구 삭제.*되돌릴 수 없/);
  await node('participant-cancel-action').emit('click');
  assert.equal(requests.length, before);
  await setFilter('participant-topic', 'saju');
  assert.equal(node('participant-selected-count').textContent, '0건 선택');
  node('participant-select-all').checked = true; await node('participant-select-all').emit('change');
  assert.equal(node('participant-selected-count').textContent, `${rows().length}건 선택`);
  assert.ok(rows().every((row) => row.children[0].children[0].checked));
  await node('participant-clear-selection').emit('click');
  assert.equal(node('participant-select-all').checked, false);
  await resetFilters();
});
await test('selected CSV uses POST with exactly the selected IDs, not the all-record GET', async () => {
  const wanted = records.slice(0, 2).map((record) => record.id);
  for (const row of rows().slice(0, 2)) { const input = row.children[0].children[0]; input.checked = true; await input.emit('change'); }
  const before = csvDownloads;
  await node('participant-export-selected').emit('click');
  assert.equal(csvDownloads, before);
  assert.match(node('participant-confirm-text').textContent, /2건.*전체 개인정보/);
  await node('participant-confirm-action').emit('click'); await settle();
  assert.equal(csvDownloads, before + 1);
  const request = requests.at(-1);
  assert.equal(request.method, 'POST'); assert.equal(request.path, '/api/admin/participants/export');
  assert.deepEqual(JSON.parse(request.options.body).ids, wanted);
  await node('participant-delete-selected').emit('click');
  await setFilter('participant-topic', 'ziwei');
  assert.equal(node('participant-confirm-dialog').open, false);
  const beforeDelete = requests.filter((item) => item.method === 'DELETE').length;
  await node('participant-confirm-action').emit('click'); await settle();
  assert.equal(requests.filter((item) => item.method === 'DELETE').length, beforeDelete);
  await resetFilters();
});
await test('confirmed bulk deletion targets only the selected snapshot and clears selection after reload', async () => {
  const wanted = records.slice(0, 2).map((record) => record.id);
  for (const row of rows().slice(0, 2)) { const input = row.children[0].children[0]; input.checked = true; await input.emit('change'); }
  const before = requests.length;
  await node('participant-delete-selected').emit('click');
  assert.equal(requests.length, before);
  await node('participant-confirm-action').emit('click'); await settle();
  const deleted = requests.slice(before).filter((request) => request.method === 'DELETE').map((request) => request.path.split('/').at(-1));
  assert.deepEqual(deleted, wanted);
  assert.equal(node('participant-selected-count').textContent, '0건 선택');
  assert.equal(node('participant-delete-selected').disabled, true);
  assert.equal(rows().length, 6);
});
await test('partial bulk deletion stops after first success and a 500, leaving every later ID untouched', async () => {
  await resetFilters();
  const wanted=records.slice(0,3).map(record=>record.id),before=records.map(record=>record.id),start=requests.length;
  for(const row of rows().slice(0,3)){const input=row.children[0].children[0];input.checked=true;await input.emit('change');}
  fetchScenario=async request=>request.method==='DELETE'&&request.path.endsWith('/'+wanted[1])
    ?Response.json({error:{message:'합성 일시 오류'}},{status:500}):undefined;
  try{
    await node('participant-delete-selected').emit('click');await node('participant-confirm-action').emit('click');await settle();
    const sent=requests.slice(start).filter(request=>request.method==='DELETE').map(request=>request.path.split('/').at(-1));
    assert.deepEqual(sent,wanted.slice(0,2));assert.deepEqual(records.map(record=>record.id),before.filter(id=>id!==wanted[0]));
    assert.ok(records.some(record=>record.id===wanted[1])&&records.some(record=>record.id===wanted[2]));
    assert.match(node('participants-status').textContent,/1건 삭제 완료/);assert.match(node('participants-status').textContent,/처리하지 못한 2건/);
    assert.equal(node('participant-selected-count').textContent,'0건 선택');assert.equal(node('participants-content').hidden,false);
    assert.ok(rows().every(row=>!row.children[0].children[0].disabled));
  }finally{fetchScenario=null;}
});
await test('rapid duplicate confirmation while first DELETE is pending sends exactly one request',async()=>{
  await resetFilters();const wanted=records[0].id,start=requests.length,before=records.length;
  const input=rows()[0].children[0].children[0];input.checked=true;await input.emit('change');
  let release;const gate=new Promise(resolve=>{release=resolve;});
  fetchScenario=async request=>{if(request.method==='DELETE'&&request.path.endsWith('/'+wanted))await gate;};
  let pending;
  try{
    await node('participant-delete-selected').emit('click');pending=node('participant-confirm-action').emit('click');await settle();
    assert.equal(requests.slice(start).filter(request=>request.method==='DELETE').length,1);
    assert.ok(rows().every(row=>row.children[0].children[0].disabled));assert.equal(node('participant-delete-selected').disabled,true);
    await node('participant-confirm-action').emit('click');await node('participant-delete-selected').emit('click');await settle();
    assert.equal(requests.slice(start).filter(request=>request.method==='DELETE').length,1);
    assert.equal(node('participant-confirm-dialog').open,false);
  }finally{release();await pending;fetchScenario=null;}
  await settle();assert.equal(records.length,before-1);assert.ok(!records.some(record=>record.id===wanted));
  assert.equal(requests.slice(start).filter(request=>request.method==='DELETE').length,1);
  assert.equal(node('participant-selected-count').textContent,'0건 선택');
});
await test('selected CSV 500 retains the same selection, restores controls, and retries only those IDs',async()=>{
  await resetFilters();const wanted=records.slice(0,2).map(record=>record.id),start=requests.length,downloads=csvDownloads,before=JSON.stringify(records);
  for(const row of rows().slice(0,2)){const input=row.children[0].children[0];input.checked=true;await input.emit('change');}
  fetchScenario=async request=>request.path==='/api/admin/participants/export'&&request.method==='POST'
    ?Response.json({error:{message:'합성 CSV 실패'}},{status:500}):undefined;
  try{
    await node('participant-export-selected').emit('click');await node('participant-confirm-action').emit('click');await settle();
    assert.equal(csvDownloads,downloads);assert.equal(JSON.stringify(records),before);
    assert.equal(node('participant-selected-count').textContent,'2건 선택');
    assert.ok(rows().slice(0,2).every(row=>row.children[0].children[0].checked&&!row.children[0].children[0].disabled));
    assert.equal(node('participant-export-selected').disabled,false);assert.equal(node('participant-delete-selected').disabled,false);
    assert.equal(node('participants-content').hidden,false);assert.match(node('participants-status').textContent,/합성 CSV 실패/);
    assert.equal(requests.slice(start).filter(request=>request.method==='DELETE').length,0);
    assert.equal(requests.slice(start).filter(request=>request.path.startsWith('/api/admin/participants?')).length,0);
  }finally{fetchScenario=null;}
  await node('participant-export-selected').emit('click');await node('participant-confirm-action').emit('click');await settle();
  assert.equal(csvDownloads,downloads+1);assert.deepEqual(JSON.parse(requests.at(-1).options.body).ids,wanted);
  assert.equal(JSON.stringify(records),before);await node('participant-clear-selection').emit('click');
});
await test('partial bulk deletion stops on 403 without reloading or deleting later IDs and keeps the access gate',async()=>{
  await resetFilters();const wanted=records.slice(0,3).map(record=>record.id),before=records.map(record=>record.id),start=requests.length;
  for(const row of rows().slice(0,3)){const input=row.children[0].children[0];input.checked=true;await input.emit('change');}
  fetchScenario=async request=>{
    if(request.method==='DELETE'&&request.path.endsWith('/'+wanted[1])){forbidden=true;return Response.json({error:{message:'합성 권한 상실'}},{status:403});}
  };
  try{
    await node('participant-delete-selected').emit('click');await node('participant-confirm-action').emit('click');await settle();
    assert.deepEqual(requests.slice(start).filter(request=>request.method==='DELETE').map(request=>request.path.split('/').at(-1)),wanted.slice(0,2));
    assert.deepEqual(records.map(record=>record.id),before.filter(id=>id!==wanted[0]));
    assert.equal(requests.slice(start).filter(request=>request.path.startsWith('/api/admin/participants?')).length,0);
    assert.equal(node('participants-access').hidden,false);assert.equal(node('participants-content').hidden,true);assert.equal(rows().length,0);
    assert.equal(node('participant-detail').textContent,'');assert.equal(node('participant-selected-count').textContent,'0건 선택');
    assert.equal(node('participant-delete-selected').disabled,true);assert.equal(node('participant-confirm-dialog').open,false);
  }finally{fetchScenario=null;forbidden=false;}
  await node('refresh-participants').emit('click');await settle();assert.equal(node('participants-content').hidden,false);
});
for(const deniedStatus of [401,403]) await test(`a pending selected CSV ${deniedStatus} after opening full details erases personal UI and preserves the access gate`,async()=>{
  await resetFilters();node('participant-reveal').checked=true;await node('participant-reveal').emit('change');await settle();
  const wanted=records[0].id,before=JSON.stringify(records),downloads=csvDownloads,start=requests.length;
  const input=rows()[0].children[0].children[0];input.checked=true;await input.emit('change');
  let release;const gate=new Promise(resolve=>{release=resolve;});
  fetchScenario=async request=>{
    if(request.path==='/api/admin/participants/export'&&request.method==='POST'){
      await gate;forbidden=true;return Response.json({error:{message:'합성 CSV 권한 거부'}},{status:deniedStatus});
    }
  };
  let pending;
  try{
    await node('participant-export-selected').emit('click');pending=node('participant-confirm-action').emit('click');await settle();
    assert.equal(node('participant-export-selected').disabled,true);
    await rows()[0].children.at(-1).children[0].emit('click');assert.equal(node('participant-detail-dialog').open,true);
    assert.ok(node('participant-detail').textContent.includes(records[0].phone));
  }finally{release();await pending;fetchScenario=null;}
  await settle();
  assert.equal(csvDownloads,downloads);assert.equal(JSON.stringify(records),before);
  assert.equal(requests.slice(start).filter(request=>request.method==='DELETE').length,0);
  assert.deepEqual(JSON.parse(requests.slice(start).find(request=>request.method==='POST').options.body).ids,[wanted]);
  assert.equal(node('participants-access').hidden,false);assert.equal(node('participants-content').hidden,true);
  assert.equal(rows().length,0);assert.equal(node('participant-detail-dialog').open,false);assert.equal(node('participant-detail').textContent,'');
  assert.equal(node('participant-selected-count').textContent,'0건 선택');
  assert.equal(node('participant-export-selected').disabled,true);assert.equal(node('participant-delete-selected').disabled,true);
  assert.equal(node('participant-reveal').checked,false);assert.equal(node('participant-search').value,'');
  assert.equal(requests.slice(start).filter(request=>request.path.startsWith('/api/admin/participants?')).length,0);
  forbidden=false;node('participant-reveal').checked=false;await node('participant-reveal').emit('change');await settle();
  assert.equal(node('participants-content').hidden,false);assert.equal(rows().length,records.length);
});
await test('successful single deletion followed by a denied reload does not replace the access error with success',async()=>{
  await resetFilters();const wanted=records[0].id,before=records.map(record=>record.id),start=requests.length;
  fetchScenario=async request=>{
    if(request.path.startsWith('/api/admin/participants?')){forbidden=true;return Response.json({error:{message:'합성 재조회 권한 거부'}},{status:403});}
  };
  try{
    await rows()[0].children.at(-1).children[1].emit('click');await node('participant-confirm-action').emit('click');await settle();
    assert.deepEqual(records.map(record=>record.id),before.filter(id=>id!==wanted));
    assert.equal(requests.slice(start).filter(request=>request.method==='DELETE').length,1);
    assert.equal(requests.slice(start).filter(request=>request.path.startsWith('/api/admin/participants?')).length,1);
    assert.equal(node('participants-access').hidden,false);assert.equal(node('participants-content').hidden,true);assert.equal(rows().length,0);
    assert.match(node('participants-status').textContent,/합성 재조회 권한 거부/);assert.doesNotMatch(node('participants-status').textContent,/삭제했습니다/);
  }finally{fetchScenario=null;forbidden=false;}
  await node('refresh-participants').emit('click');await settle();assert.equal(node('participants-content').hidden,false);
});
await test('pagehide removes visible data, and a later denied reload remains gated', async () => {
  await rows()[0].children.at(-1).children[0].emit('click');
  for (const listener of windowListeners.pagehide ?? []) listener();
  assert.equal(rows().length, 0); assert.equal(node('participant-detail').textContent, '');
  assert.equal(node('participants-content').hidden, true); assert.equal(node('participant-reveal').checked, false);
  forbidden = true; for (const listener of windowListeners.pageshow ?? []) listener({ persisted: true }); await settle();
  assert.equal(node('participants-access').hidden, false); assert.equal(node('participants-content').hidden, true); assert.equal(rows().length, 0);
});
assert.doesNotMatch(source, /innerHTML|localStorage|sessionStorage|sendBeacon/);
assert.match(html, /기존 모임 신청·개인정보 수집 동의를 문자·전화 광고 수신 동의로 간주하지 않습니다/);
console.log(`PASS ${checks} isolated lead-admin UI groups: record-button provenance and birthday privacy, legacy consent preservation, local filters, safe text, confirmation and revoked access. No real network or DB.`);
