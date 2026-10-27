// Production UI snippets with a synthetic form/DOM. No browser, server or PII.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { KOREAN_BIRTHPLACES, getKoreanBirthplace } from '../public/experience/birthplace-time.js';
const base = new URL('../public/experience/', import.meta.url);
const app = await readFile(new URL('app.js', base), 'utf8');
const html = await readFile(new URL('index.html', base), 'utf8');
const css = await readFile(new URL('style.css', base), 'utf8');
const updateStart = app.indexOf('function syncBirthplaceControls()');
const updateEnd = app.indexOf('for (const radio of form.querySelectorAll', updateStart);
const submitStart = app.indexOf("form.addEventListener('submit', (event) => {");
const submitEnd = app.indexOf('async function downloadCurrentPdf', submitStart);
assert.ok(updateStart > 0 && updateEnd > updateStart && submitEnd > submitStart);
const node = (name = '') => ({ name, value: '', checked: false, disabled: false, hidden: false, required: false, textContent: '', focusCalls: 0, focus() { this.focusCalls++; }, classes: new Set(), setAttribute() {}, classList: { toggle() {}, remove() {} } });
function harness(mode = 'saju') {
  const nodes = new Map(), get = id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
  const elements = Object.fromEntries(['mode','nickname','birthDate','birthTime','calendar','leapMonth','gender','birthplaceId','ziweiReportMode','ziweiAsOf','ziweiFocus'].map(key => [key,node(key)]));
  Object.assign(elements.mode, { value: mode }); Object.assign(elements.birthDate, { value: '2000-01-01' }); Object.assign(elements.birthTime, { value: '00:15' }); Object.assign(elements.calendar, { value: 'solar' }); Object.assign(elements.gender, { value: 'female' });
  elements.ziweiReportMode.value = 'STANDARD'; elements.ziweiFocus.value = 'all'; elements.ziweiAsOf.value = '2026-10-27';
  const details = { open: false }; get('ziwei-report-fields').querySelector = selector => { assert.equal(selector,'details'); return details; };
  get('saju-location-row').classList.toggle = (name, on) => on ? get('saju-location-row').classes.add(name) : get('saju-location-row').classes.delete(name);
  let handler; const calculations = [], views = [], saves = [];
  const state = { $: get, form: { elements, addEventListener: (type, callback) => { assert.equal(type,'submit'); handler = callback; } }, selectedMode: () => elements.mode.value,
    getKoreanBirthplace, document: { querySelector: () => get('calendar-field') }, modes: { zodiac: '별자리', saju: '사주', ziwei: '자미두수' }, help: { zodiac:'별자리',saju:'사주',ziwei:'자미' }, methodDescriptions: { zodiac:'별자리',saju:'사주',ziwei:'자미' },
    readingRecord: { pending: false, save: values => saves.push(values), viewOnly: () => views.push(true) }, deliveryForm: { reset() {} }, deliveryViewGeneration: 0,
    calculateReading: input => { calculations.push(structuredClone(input)); return { mode: input.mode }; }, renderReading() {}, console };
  vm.createContext(state); vm.runInContext(app.slice(updateStart,updateEnd),state); vm.runInContext(app.slice(submitStart,submitEnd),state);
  return { elements, get, details, calculations, views, saves, update() { vm.runInContext('updateMode()',state); }, sync() { vm.runInContext('syncBirthplaceControls()',state); }, submit(value = 'view') { handler({ preventDefault() {}, submitter: { value } }); } };
}
let groups = 0;
function test(label, run) { run(); groups++; console.log(`PASS ${label}`); }
test('form keeps optional city and has no correction checkbox; city selection applies correction automatically', () => {
  const form = html.split('<form id="reading-form"')[1].split('</form>')[0];
  assert.match(form, /id="saju-location-row" class="birth-context-row"/);
  assert.match(form, /name="birthplaceId"[^>]*disabled/); assert.doesNotMatch(form, /name="timeCorrection"/);
  assert.doesNotMatch(app, /form\.elements\.timeCorrection/);
  assert.match(form, /도시를 선택하면 지역 평균태양시 보정이 자동 적용/);
  assert.match(form, /균시차를 적용하는 진태양시는 아니에요/); assert.match(form, /출생지·보정 설정·풀이 결과는 입력 기록에 저장하지 않습니다/);
  assert.ok(KOREAN_BIRTHPLACES.length >= 10); assert.equal(new Set(KOREAN_BIRTHPLACES.map(city => city.id)).size,KOREAN_BIRTHPLACES.length);
  assert.match(app, /for \(const city of KOREAN_BIRTHPLACES\)/); assert.match(app, /element\('option', city.name\)/);
});
test('Saju gender and city remain exactly equal columns, even at 320px, without changing date controls', () => {
  assert.match(css, /\.birth-context-row\.is-saju\s*\{\s*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.birth-context-row > \.field, \.birth-context-row select\s*\{\s*min-width:\s*0;\s*width:\s*100%/);
  assert.match(css, /\.birth-context-row\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*minmax\(0,1fr\)/);
  assert.equal([...css.matchAll(/\.birth-context-row\.is-saju\s*\{/g)].length,1);
  assert.match(formLabels(), /aria-describedby="gender-help"/); assert.match(formLabels(), /aria-describedby="birthplace-help"/);
  function formLabels() { return html.match(/<div id="time-fields"[\s\S]*?<p id="time-warning"/)[0]; }
});
test('choosing and clearing a city updates automatic correction notice without a separate switch', () => {
  const h = harness(); h.update(); assert.equal(h.elements.birthplaceId.disabled,false);
  assert.equal(h.get('birthplace-field').hidden,false); assert.equal(h.get('birthplace-correction-field').hidden,false); assert.ok(h.get('saju-location-row').classes.has('is-saju'));
  h.elements.birthplaceId.value = 'seoul'; h.sync(); assert.match(h.get('time-warning').textContent,/지역 평균태양시를 자동 적용/);
  h.elements.birthplaceId.value = ''; h.sync(); assert.match(h.get('time-warning').textContent,/선택하지 않으면 입력한 시각을 그대로/);
});
test('Saju submit automatically carries city correction while preserving original date and clock', () => {
  const h = harness(); h.elements.birthplaceId.value = 'seoul'; h.update(); h.submit();
  assert.equal(h.calculations[0].birthplaceId,'seoul'); assert.equal(h.calculations[0].timeCorrection,'local-mean-solar');
  assert.equal(h.calculations[0].birthDate,'2000-01-01'); assert.equal(h.calculations[0].birthTime,'00:15'); assert.equal(h.views.length,1); assert.equal(h.saves.length,0);
  h.elements.birthplaceId.value = 'busan'; h.sync(); h.submit(); assert.equal(h.calculations[1].timeCorrection,'local-mean-solar'); assert.equal(h.calculations[1].birthplaceId,'busan');
  h.elements.birthplaceId.value = ''; h.sync(); h.submit(); assert.equal(h.calculations[2].birthplaceId,null); assert.equal(h.calculations[2].timeCorrection,'none');
});
test('Ziwei keeps full-width required gender, and Zodiac hides traditional inputs without leaking Saju state', () => {
  const h = harness(); h.elements.birthplaceId.value = 'seoul';
  for (const mode of ['ziwei','zodiac']) {
    h.elements.mode.value = mode; h.update(); h.submit();
    assert.equal(h.elements.birthplaceId.disabled,true); assert.equal(h.get('birthplace-field').hidden,true); assert.equal(h.get('birthplace-correction-field').hidden,true); assert.ok(!h.get('saju-location-row').classes.has('is-saju'));
    assert.ok(!Object.hasOwn(h.calculations.at(-1),'birthplaceId')); assert.ok(!Object.hasOwn(h.calculations.at(-1),'timeCorrection'));
    assert.equal(h.elements.gender.required,mode === 'ziwei'); assert.equal(h.elements.gender.disabled,mode === 'zodiac'); assert.equal(h.get('gender-field').hidden,mode === 'zodiac');
    for (const key of ['ziweiReportMode','ziweiFocus','ziweiAsOf']) assert.equal(h.elements[key].required,mode === 'ziwei');
    assert.equal(h.get('time-fields').hidden,mode === 'zodiac');
  }
  assert.equal(h.calculations.at(-1).birthTime,null); assert.equal(h.calculations.at(-1).calendar,'solar');
});
test('unknown clock and invalid city do not become fabricated input times or silently selected cities', () => {
  const h = harness(); h.elements.birthplaceId.value='seoul'; h.elements.birthTime.value=''; h.update(); h.submit();
  assert.equal(h.calculations[0].birthTime,null); assert.match(h.get('time-warning').textContent,/생시를 모르면/);
  assert.equal(h.calculations[0].timeCorrection,'local-mean-solar');
  h.elements.birthplaceId.value='not-a-city'; h.sync(); assert.equal(h.elements.birthplaceId.value,'not-a-city'); h.submit();
  assert.equal(h.calculations.at(-1).birthplaceId,'not-a-city'); assert.equal(h.calculations.at(-1).timeCorrection,'local-mean-solar'); // engine rejects unsupported city; UI never silently picks one.
});
test('Saju and Ziwei reject missing or invalid gender before calculation or record storage; Zodiac does not', () => {
  for (const mode of ['saju','ziwei']) for (const value of ['', 'unrecognised']) {
    const h=harness(mode); h.elements.gender.value=value; h.update(); h.submit('save');
    assert.equal(h.elements.gender.required,true); assert.match(h.get('gender-label').textContent,/필수/);
    assert.equal(h.calculations.length,0); assert.equal(h.saves.length,0); assert.equal(h.elements.gender.focusCalls,1); assert.match(h.get('form-error').textContent,/성별/);
  }
  const h=harness('zodiac'); h.elements.gender.value=''; h.update(); h.submit(); assert.equal(h.calculations.length,1); assert.equal(h.calculations[0].gender,null);
});
test('Ziwei report settings are visibly and natively required and defaults remain valid', () => {
  const fields=html.match(/<fieldset id="ziwei-report-fields"[\s\S]*?<\/fieldset>/)[0];
  assert.match(fields,/<legend>자미두수 풀이 설정[\s\S]*?필수/);
  for (const key of ['ziweiReportMode','ziweiFocus','ziweiAsOf']) assert.match(fields,new RegExp(`name="${key}"[^>]*\\brequired\\b`));
  const h=harness('ziwei'); h.update(); h.submit(); assert.equal(h.calculations.length,1); assert.equal(h.calculations[0].ziweiReport.mode,'STANDARD'); assert.equal(h.calculations[0].ziweiReport.focus,'all'); assert.equal(h.calculations[0].ziweiReport.asOf,'2026-10-27');
  for (const [key,message] of [['ziweiReportMode','풀이 깊이'],['ziweiFocus','궁금한 영역'],['ziweiAsOf','기준일']]) {
    const missing=harness('ziwei'); missing.update(); missing.elements[key].value=''; missing.submit('save');
    assert.equal(missing.calculations.length,0); assert.equal(missing.saves.length,0); assert.equal(missing.details.open,true); assert.equal(missing.elements[key].focusCalls,1); assert.ok(missing.get('form-error').textContent.includes(message));
  }
});
test('native invalid event reveals a closed report-settings details before browser error focus', () => {
  const start=app.indexOf("form.addEventListener('invalid'"); const end=app.indexOf("form.addEventListener('reset'",start); let callback;
  vm.runInNewContext(app.slice(start,end),{form:{addEventListener(type,fn,capture){assert.equal(type,'invalid');assert.equal(capture,true);callback=fn;}}});
  const details={open:false}; callback({target:{closest(selector){assert.equal(selector,'#ziwei-report-fields details');return details;}}}); assert.equal(details.open,true);
  callback({target:{closest(){return null;}}});
});
test('local PDF opts into private correction separately; delivery and record actions do not', () => {
  const local = app.slice(app.indexOf('async function downloadCurrentPdf'),app.indexOf("$('download-result').addEventListener"));
  assert.match(local, /downloadReadingPdf\(\{ reading, input, includeBirthData: true, localOnlyCorrection: true \}\)/);
  const delivery = app.slice(app.indexOf("deliveryForm.addEventListener('submit'"),app.indexOf('// Original, code-native 3D ornaments.'));
  assert.doesNotMatch(delivery,/localOnlyCorrection|birthplaceId|timeCorrection|longitude|correctedDateTime/);
  assert.match(delivery,/buildReadingPdfDocument\(\{ reading: deliveryReading, input: deliveryInput, includeBirthData: storeBirthData \}\)/);
  assert.match(app,/if \(action === 'save'\) void readingRecord.save\(\{ input, result \}\)/);
  assert.doesNotMatch(app,/localStorage|sessionStorage|geolocation/);
});
console.log(`PASS ${groups} birthplace UI groups. Production mode/submit functions, fixed equal columns and no new storage/network.`);
