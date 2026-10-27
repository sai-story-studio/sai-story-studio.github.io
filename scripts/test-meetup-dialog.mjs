// Synthetic scoped DOM/fetch only. No HTTP, actual database, storage or PII.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initJoinForm } from '../public/experience/join.js';
import { initMeetupDialog } from '../public/experience/meetup-dialog.js';

class Node {
  constructor(tagName = 'DIV') {
    this.tagName = tagName; this.listeners = new Map(); this.value = ''; this.checked = false; this.disabled = false; this.required = false; this.hidden = false; this.textContent = ''; this.isConnected = true; this.type = 'text'; this.selectionStart = 0; this.selectionEnd = 0;
    this.classes = new Set(); this.classList = { add: (...names) => names.forEach(name => this.classes.add(name)), remove: (...names) => names.forEach(name => this.classes.delete(name)), contains: name => this.classes.has(name), toggle: (name, force) => { const on = force ?? !this.classes.has(name); on ? this.classes.add(name) : this.classes.delete(name); return on; } };
  }
  addEventListener(type, fn) { const set = this.listeners.get(type) || new Set(); set.add(fn); this.listeners.set(type, set); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  async emit(type, extra = {}) { const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...extra }; for (const fn of this.listeners.get(type) || []) await fn(event); return event; }
  focus() { this.focusCount = (this.focusCount || 0) + 1; }
  setCustomValidity(value) { this.validationMessage = value; }
  reportValidity() { this.reported = true; return !this.validationMessage; }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  closest() { return null; }
}
const ready = { collectionEnabled: true, operatorName: '합성 운영', contactEmail: 'fixture@example.test', retentionDays: 90, consentVersion: 'participants-v1', purpose: '합성 일반 모임 참가 관심 신청 및 안내' };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const settle = async () => { for (let index = 0; index < 5; index++) await new Promise(resolve => setImmediate(resolve)); };
function harness(respond = null) {
  const ids = ['join-form','join-fields','join-birth-field','join-message','refresh-join-state','join-state','join-purpose','join-consent-purpose','join-operator','join-contact','join-retention','join-entry','join-success','join-success-title'];
  const nodes = new Map(ids.map(id => [id, new Node()])), form = nodes.get('join-form');
  form.elements = Object.fromEntries(['name','phone','topic','birthDate','storeBirthData','collectionConsent','ageConfirm14'].map(key => [key,new Node('INPUT')]));
  form.elements.phone.type = 'tel';
  form.reset = () => { for (const field of Object.values(form.elements)) { field.value = ''; field.checked = false; } };
  const root = { querySelector: query => nodes.get(query.slice(1)) }, calls = [];
  let active = true;
  const fetchImpl = async (path, options) => { const call = { path, options }; calls.push(call); if (respond) return respond(call, calls.length); return Response.json(path.endsWith('/config') ? ready : { status: 'registered', id: 'synthetic-id' }); };
  const options = { fetchImpl, today: () => '2026-10-23', autoLoad: false, isActive: () => active };
  const controller = initJoinForm(root, options);
  const fill = () => { form.elements.name.value = '합성 신청'; form.elements.phone.value = '010-0000-0000'; form.elements.collectionConsent.checked = true; form.elements.ageConfirm14.checked = true; };
  return { root, nodes, form, fields: nodes.get('join-fields'), calls, controller, options, fill, setActive: value => { active = value; }, posts: () => calls.filter(call => call.options.method === 'POST') };
}
let groups = 0;
const test = async (label, run) => { await run(); groups++; console.log(`PASS ${label}`); };

await test('scoped lazy config, idempotent binding and the existing phone formatter never submit on input', async () => {
  assert.equal(initJoinForm(null), null);
  const h = harness(); assert.equal(h.calls.length,0); assert.equal(h.fields.disabled,true);
  assert.equal(initJoinForm(h.root,h.options),h.controller); assert.equal(h.form.listeners.get('submit').size,1);
  assert.equal(h.form.elements.phone.listeners.get('input').size,1);
  h.form.elements.phone.value='01000000000'; await h.form.elements.phone.emit('input');
  assert.equal(h.form.elements.phone.value,'010-0000-0000'); assert.equal(h.calls.length,0);
  await h.controller.refresh(); assert.equal(h.fields.disabled,false); assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].path,'/api/participants/config'); assert.equal(h.calls[0].options.credentials,'same-origin'); assert.equal(h.calls[0].options.cache,'no-store'); assert.equal(h.calls[0].options.body,undefined);
});
await test('disabled, incomplete and failed config all fail closed with no POST', async () => {
  for (const config of [{...ready,collectionEnabled:false},{...ready,collectionEnabled:'true'},{...ready,operatorName:''},{...ready,retentionDays:0},{...ready,retentionDays:1.5},{...ready,consentVersion:null}]) {
    const h=harness(async()=>Response.json(config)); await h.controller.refresh(); h.fill(); await h.form.emit('submit');
    assert.equal(h.fields.disabled,true); assert.equal(h.posts().length,0);
  }
  const h=harness(async()=>{throw new Error('synthetic offline');}); await h.controller.refresh(); h.fill(); await h.form.emit('submit');
  assert.equal(h.fields.disabled,true); assert.equal(h.posts().length,0); assert.match(h.nodes.get('join-state').textContent,/잠갔/);
});
await test('explicit signup uses only its own fields and omits unconsented birth data', async () => {
  const h=harness(); await h.controller.refresh(); h.fill();
  h.form.elements.birthDate.value='1980.01.01'; h.form.elements.topic.value='saju';
  await h.form.emit('submit'); const [request]=h.posts();
  assert.equal(request.path,'/api/participants'); assert.equal(request.options.credentials,'same-origin');
  assert.deepEqual(JSON.parse(request.options.body),{name:'합성 신청',phone:'01000000000',storeBirthData:false,collectionConsent:true,ageConfirm14:true,consentVersion:'participants-v1',topic:'saju'});
  assert.equal(h.form.elements.phone.value,''); assert.equal(h.form.elements.collectionConsent.checked,false);
  assert.match(h.nodes.get('join-message').textContent,/참가 확정이나 안내 문자 발송 완료를 뜻하지 않습니다/);
  assert.equal(h.controller.completed,true);assert.equal(h.nodes.get('join-entry').hidden,true);assert.equal(h.nodes.get('join-success').hidden,false);assert.equal(h.fields.disabled,true);assert.equal(h.nodes.get('join-success-title').focusCount,1);
});
await test('only a verified registration shows completion; completed views block duplicate submission and reset cleanly', async () => {
  const h=harness();await h.controller.refresh();h.fill();await h.form.emit('submit');
  h.fill();await h.form.emit('submit');await h.controller.refresh();assert.equal(h.posts().length,1);assert.equal(h.calls.length,2);
  h.controller.reset();assert.equal(h.controller.completed,false);assert.equal(h.nodes.get('join-entry').hidden,false);assert.equal(h.nodes.get('join-success').hidden,true);assert.equal(h.form.elements.phone.value,'');
  await h.controller.refresh();h.fill();await h.form.emit('submit');assert.equal(h.posts().length,2);assert.equal(h.controller.completed,true);
  for(const response of [{status:'registered'},{status:'pending',id:'synthetic-id'},{}]) {
    const failed=harness(async call=>Response.json(call.path.endsWith('/config')?ready:response));await failed.controller.refresh();failed.fill();await failed.form.emit('submit');
    assert.equal(failed.controller.completed,false);assert.equal(failed.nodes.get('join-success').hidden,true);assert.equal(failed.nodes.get('join-entry').hidden,false);assert.equal(failed.form.elements.name.value,'합성 신청');assert.equal(failed.fields.disabled,false);
  }
});
await test('required consent, age confirmation, valid name/phone and enum topic are checked before POST', async () => {
  for (const change of [h=>{h.form.elements.name.value='';},h=>{h.form.elements.name.value='x'.repeat(31);},h=>{h.form.elements.name.value='bad\u0000';},h=>{h.form.elements.phone.value='01000000000suffix';},h=>{h.form.elements.phone.value='';},h=>{h.form.elements.collectionConsent.checked=false;},h=>{h.form.elements.ageConfirm14.checked=false;},h=>{h.form.elements.topic.value='unknown';}]) {
    const h=harness(); await h.controller.refresh(); h.fill(); change(h); await h.form.emit('submit'); assert.equal(h.posts().length,0);
  }
});
await test('separate birth choice preserves dotted input, exact solar validation and fourteen-year boundary', async () => {
  for(const [value,allowed]of [['2000.02.29',true],['2012.10.23',true],['2012.10.24',false],['2000.02.30',false],['2027.01.01',false],['1899.12.31',false]]) {
    const h=harness(); await h.controller.refresh(); h.fill(); h.form.elements.storeBirthData.checked=true; await h.form.elements.storeBirthData.emit('change');
    assert.equal(h.nodes.get('join-birth-field').hidden,false); assert.equal(h.form.elements.birthDate.required,true);
    h.form.elements.birthDate.value=value; await h.form.emit('submit'); assert.equal(h.posts().length,Number(allowed),value);
    if(allowed)assert.equal(JSON.parse(h.posts()[0].options.body).birthDate,value.replaceAll('.','-'));
  }
  const h=harness(); h.form.elements.storeBirthData.checked=true; await h.form.elements.storeBirthData.emit('change');
  h.form.elements.birthDate.value='20000229'; await h.form.elements.birthDate.emit('input'); assert.equal(h.form.elements.birthDate.value,'2000.02.29');
  h.form.elements.storeBirthData.checked=false; await h.form.elements.storeBirthData.emit('change');
  assert.equal(h.form.elements.birthDate.value,'');assert.equal(h.form.elements.birthDate.disabled,true);assert.equal(h.form.elements.birthDate.required,false);
});
await test('pending submit rejects duplicate submits and close/reopen cannot resubmit or expose a stale success', async () => {
  const response=deferred();const h=harness(async call=>call.path.endsWith('/config')?Response.json(ready):response.promise);
  await h.controller.refresh();h.fill();const first=h.form.emit('submit');await settle();
  assert.equal(h.controller.pending,true);await h.form.emit('submit');await h.controller.refresh();assert.equal(h.posts().length,1);assert.equal(h.calls.length,2);
  h.setActive(false);h.controller.reset();assert.equal(h.form.elements.phone.value,'');assert.equal(h.fields.disabled,true);
  h.setActive(true);await h.controller.refresh();await h.form.emit('submit');assert.equal(h.posts().length,1);
  response.resolve(Response.json({status:'registered',id:'synthetic-id'}));await first;await settle();
  assert.equal(h.posts().length,1);assert.equal(h.fields.disabled,false);assert.equal(h.nodes.get('join-message').textContent,'');assert.equal(h.calls.length,3);
});
await test('config races/close invalidation cannot re-enable stale configuration; cleanup unbinds once', async () => {
  const first=deferred(),second=deferred();const h=harness(async(_call,count)=>count===1?first.promise:second.promise);
  const one=h.controller.refresh(),two=h.controller.refresh();assert.equal(h.calls[0].options.signal.aborted,true);
  second.resolve(Response.json({...ready,collectionEnabled:false}));await two;first.resolve(Response.json(ready));await one;assert.equal(h.fields.disabled,true);
  h.controller.destroy();h.controller.destroy();assert.equal(h.form.listeners.get('submit').size,0);assert.equal(h.form.elements.phone.listeners.get('input').size,0);
  const rebound=initJoinForm(h.root,h.options);assert.notEqual(rebound,h.controller);assert.equal(h.form.listeners.get('submit').size,1);
  rebound.destroy();
});
await test('POST failures preserve the form and never claim storage or sending succeeded', async () => {
  const h=harness(async call=>call.path.endsWith('/config')?Response.json(ready):Response.json({error:{message:'합성 신청 거부'}},{status:503}));
  await h.controller.refresh();h.fill();await h.form.emit('submit');assert.equal(h.form.elements.name.value,'합성 신청');assert.equal(h.fields.disabled,false);assert.match(h.nodes.get('join-message').textContent,/합성 신청 거부/);
  assert.equal(h.nodes.get('join-message').classList.contains('error'),true);
  assert.equal(h.nodes.get('join-success').hidden,true);assert.equal(h.nodes.get('join-entry').hidden,false);assert.equal(h.controller.completed,false);
});

function popup(hash='') {
  const dialog=new Node('DIALOG'),button=new Node('BUTTON'),body=new Node('BODY'),doc=new Node(),win=new Node();
  dialog.open=false;dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{if(dialog.open){dialog.open=false;void dialog.emit('close');}};
  doc.body=body;doc.activeElement=body;doc.getElementById=id=>id==='meetup-registration'?dialog:id==='open-meetup-registration'?button:null;
  win.location={hash};win.history={replaceState(_a,_b,next){win.location.hash=next;}};
  const calls={refresh:0,reset:0,destroy:0};const form={refresh(){calls.refresh++;},reset(){calls.reset++;},destroy(){calls.destroy++;}};
  const options={win,createForm:()=>form};const controller=initMeetupDialog(doc,options);
  return{dialog,button,body,doc,win,calls,controller,options};
}
await test('native modal scopes open/close, idempotent binding, backdrop and focus without changing menu lock', async () => {
  const h=popup();h.body.classList.add('menu-open');assert.equal(initMeetupDialog(h.doc,h.options),h.controller);
  assert.equal(h.controller.open(h.button),true);assert.equal(h.controller.open(h.button),false);assert.equal(h.calls.refresh,1);
  assert.equal(h.body.classList.contains('meetup-dialog-is-open'),true);
  await h.dialog.emit('click',{target:new Node()});assert.equal(h.dialog.open,true);
  await h.dialog.emit('click');assert.equal(h.dialog.open,false);assert.equal(h.calls.reset,1);assert.equal(h.button.focusCount,1);
  assert.equal(h.body.classList.contains('meetup-dialog-is-open'),false);assert.equal(h.body.classList.contains('menu-open'),true);
  h.controller.open(h.button);h.dialog.close();assert.equal(h.calls.reset,2,'native Escape close follows the same reset/focus path');
  h.controller.destroy();assert.equal(h.calls.destroy,1);assert.equal(h.doc.listeners.get('click').size,0);
});
await test('hash/legacy entry opens once, close returns to meetup, and delegated links never copy main values', async () => {
  const h=popup('#meetup-registration');assert.equal(h.dialog.open,true);assert.equal(h.calls.refresh,1);
  h.dialog.close();assert.equal(h.win.location.hash,'#meetup');assert.equal(h.button.focusCount,1);
  const link=new Node('A');link.closest=selector=>selector.includes('data-meetup-open')?link:null;
  const event=await h.doc.emit('click',{target:link,button:0});assert.equal(event.defaultPrevented,true);assert.equal(h.dialog.open,true);
  h.dialog.close();await h.doc.emit('click',{target:link,button:0,ctrlKey:true});assert.equal(h.dialog.open,false);
});
await test('static contract has unique IDs, independent form, cached entries, scoped sky design and no standalone collection page', async () => {
  const root=new URL('../public/experience/',import.meta.url);
  const [html,legacy,js,css,join]=await Promise.all(['index.html','join.html','meetup-dialog.js','meetup-dialog.css','join.js'].map(name=>readFile(new URL(name,root),'utf8')));
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);assert.equal(new Set(ids).size,ids.length);
  assert.match(html,/<dialog id="meetup-registration"[^>]*aria-labelledby="meetup-dialog-title"/);
  assert.match(html,/id="open-meetup-registration"[^>]*aria-haspopup="dialog"/);
  assert.equal((html.match(/<script type="module"/g)||[]).length,7);
  assert.match(html,/meetup-dialog\.js\?v=32-birthplace-completion/);assert.match(html,/meetup-dialog\.css\?v=32-birthplace-completion/);assert.match(html,/detail-themes\.css\?v=33-banner-weight/);
  assert.match(html,/"\.\/join\.js": "\.\/join\.js\?v=32-birthplace-completion"/);assert.doesNotMatch(html,/href="\.\/join\.html"/);
  assert.doesNotMatch(legacy,/<form|join\.js|participants\.css/);assert.match(legacy,/location\.replace\('\.\/index\.html#meetup-registration'\)/);assert.doesNotMatch(legacy,/location\.search|location\.href/);
  assert.match(css,/sai-sky-gathering\.png/);assert.match(css,/position: sticky/);assert.match(css,/overflow: auto/);assert.match(css,/93dvh/);
  assert.doesNotMatch(js+join,/innerHTML|localStorage|sessionStorage|sendBeacon|URLSearchParams|reading-form['"]|reading-phone|currentReading|currentInput/);
  assert.match(html,/id="join-success"[^>]*role="status"[^>]*hidden/);assert.match(html,/id="join-success-title" tabindex="-1"/);assert.ok(html.includes('확인 · 창 닫기'));assert.ok(html.includes('모임 관심 신청이<br>완료됐어요.'));
  assert.doesNotMatch(js,/fetch\s*\(|documentElement\.style/);assert.doesNotMatch(html,/<iframe/);
});
console.log(`${groups} meetup popup groups passed. Synthetic/mock only; no network, database or actual submissions.`);
