// Local synthetic reading/projection tests. No PDF generation, credentials,
// database, HTTP requests, external storage or email delivery is performed.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { calculateReading } from '../public/experience/reading-engine.js';
import { buildReadingDetail, sajuTimeCorrectionDisplay } from '../public/experience/reading-detail.js';
import { buildReadingPdfDocument, validateReadingPdfDocument } from '../public/experience/reading-pdf-document.js';
import { prepareReadingRecord, createReadingRecordController } from '../public/experience/reading-records.js';

const sandbox = {}; sandbox.self = sandbox; sandbox.window = sandbox; vm.createContext(sandbox);
for (const file of ['lunar.js','iztro.min.js']) vm.runInContext(await readFile(new URL(`../public/experience/vendor/${file}`,import.meta.url),'utf8'),sandbox);
const keys = ['Solar','Lunar','LunarUtil','iztro'];
const original = Object.fromEntries(keys.map(key => [key,globalThis[key]]));
Object.assign(globalThis,Object.fromEntries(keys.map(key => [key,sandbox[key]])));
let groups = 0;
async function test(label, run) { await run(); groups++; console.log(`PASS ${label}`); }
const input = { mode:'saju',birthDate:'2000-01-01',birthTime:'00:15',calendar:'solar',leapMonth:false,gender:'female',birthplaceId:'seoul',timeCorrection:'local-mean-solar' };
const options = { asOf:'2026-10-23 12:00:00' };
const config = { collectionEnabled:true,operatorName:'Synthetic',contactEmail:'fixture@example.test',retentionDays:90,readingRecord:{enabled:true,consentVersion:'reading-records-v1',purpose:'Synthetic',minimumAge:14} };
const values = { name:'Synthetic',phone:'010-0000-0000',topic:'saju' };
try {
  const reading = calculateReading(input,options);
  const metadata = reading.chart.timeCorrection;
  const beforeInput = JSON.stringify(input), beforeReading = JSON.stringify(reading);
  await test('midnight correction changes calculation clocks, never the original solar birthday', () => {
    assert.equal(metadata.applied,true); assert.equal(metadata.status,'applied');
    assert.equal(reading.chart.solarDate,'2000-01-01'); assert.equal(reading.calculation.details.solarDate,'2000-01-01');
    assert.equal(metadata.originalDateTime,'2000-01-01 00:15:00'); assert.match(metadata.correctedDateTime,/^1999-12-31 /);
    const policy = sajuTimeCorrectionDisplay(reading); assert.equal(policy.applied,true); assert.equal(policy.privateItems.length,0);
    assert.equal(sajuTimeCorrectionDisplay(reading,{includePrivate:'true'}).privateItems.length,0);
    assert.match(policy.policy,/균시차를 적용하지 않아 진태양시와 다르며/);
    const local = sajuTimeCorrectionDisplay(reading,{includePrivate:true});
    assert.equal(local.privateItems.length,4); assert.ok(local.privateItems.some(text => text.includes(metadata.city.name)));
    assert.ok(local.privateItems.some(text => text.includes(metadata.correctedDateTime)));
  });
  await test('report explains the selected correction and gives cycle periods the correct engine timezone', () => {
    const detail = buildReadingDetail(reading,input);
    const text = JSON.stringify(detail);
    assert.match(text,/지역 평균태양시 보정/); assert.match(text,/UTC\+08:00/);
    assert.doesNotMatch(text,/출생지·시간대·서머타임·진태양시를 보정하지 않습니다|한국 출생지·과거 표준시·서머타임·진태양시를 추가 보정한 전문 감정은 아닙니다/);
    assert.match(detail.sections.find(section => section.id === 'saju-cycle-flow').paragraphs[0],/기준 \(UTC\+08:00\)/);
    assert.doesNotMatch(text,new RegExp(metadata.correctedDateTime));
    assert.ok(!text.includes(metadata.city.sourceUrl));
  });
  await test('default/email PDF documents never include city, longitude, UTC or corrected birth clocks', () => {
    for (const includeBirthData of [false,true]) {
      const document = buildReadingPdfDocument({reading,input,includeBirthData});
      const text = JSON.stringify(document);
      assert.ok(!text.includes(metadata.city.name)); assert.ok(!text.includes(String(metadata.city.longitude)));
      for (const privateValue of [metadata.originalDateTime,metadata.correctedDateTime,metadata.utcDateTime,metadata.engineDateTime,metadata.city.sourceUrl]) assert.ok(!text.includes(privateValue),`private correction value excluded: ${privateValue}`);
      assert.ok(!document.sections.some(section => section.id === 'saju-local-time-basis'));
      if (includeBirthData) assert.deepEqual(document.birthData,{date:'2000-01-01',time:'00:15',calendar:'solar'});
      else { assert.ok(!Object.hasOwn(document,'birthData')); assert.doesNotMatch(text,/2000-01-01|00:15/); }
      if (includeBirthData) {
        const before=buildReadingDetail(reading,input).sections.find(section=>section.id==='calculation').items;
        const after=document.sections.find(section=>section.id==='calculation').items;
        assert.ok(after.length<=20); assert.ok(before.every(fact=>after.some(value=>value.includes(fact))),'all calculation facts survive bounded grouping');
      }
      assert.deepEqual(validateReadingPdfDocument(document,{includeBirthData}),document);
    }
  });
  await test('explicit local PDF contains separate original/corrected clocks while birthData remains original', () => {
    const document = buildReadingPdfDocument({reading,input,includeBirthData:true,localOnlyCorrection:true});
    const section = document.sections.find(section => section.id === 'saju-local-time-basis');
    assert.ok(section); assert.ok(section.items.some(text => text.includes(metadata.city.name))); assert.ok(section.items.some(text => text.includes(metadata.correctedDateTime)));
    assert.deepEqual(document.birthData,{date:'2000-01-01',time:'00:15',calendar:'solar'});
    for (const parameters of [{includeBirthData:false,localOnlyCorrection:true},{includeBirthData:true,localOnlyCorrection:'true'}]) {
      assert.ok(!buildReadingPdfDocument({reading,input,...parameters}).sections.some(section => section.id === 'saju-local-time-basis'));
    }
  });
  await test('injected metadata prose, city labels, source URLs or invalid clocks cannot leak through PDF projection', () => {
    const secret = 'SYNTHETIC_PRIVATE_LOCATION_DO_NOT_SEND';
    const injected = structuredClone(reading);
    Object.assign(injected.chart.timeCorrection,{city:{...metadata.city,name:secret,region:secret,sourceUrl:`https://example.test/${secret}`},sources:[{id:secret,title:secret,url:`https://example.test/${secret}`}],notes:[secret]});
    for (const includeBirthData of [false,true]) assert.ok(!JSON.stringify(buildReadingPdfDocument({reading:injected,input:{...input,birthplaceId:secret},includeBirthData})).includes(secret));
    assert.ok(!JSON.stringify(buildReadingPdfDocument({reading:injected,input,includeBirthData:true,localOnlyCorrection:true})).includes(secret),'local presentation uses canonical city labels, not arbitrary metadata prose');
    for (const patch of [{method:'constructor'},{originalDateTime:secret},{correctedDateTime:'2000-99-99 99:99:99'},{correctionSeconds:metadata.correctionSeconds+1},{city:{id:'constructor',name:secret}}]) {
      const bad=structuredClone(reading); Object.assign(bad.chart.timeCorrection,patch);
      assert.equal(sajuTimeCorrectionDisplay(bad,{includePrivate:true}).applied,false);
      assert.ok(!JSON.stringify(buildReadingPdfDocument({reading:bad,input,includeBirthData:true,localOnlyCorrection:true})).includes(secret));
      assert.ok(!buildReadingPdfDocument({reading:bad,input,includeBirthData:true,localOnlyCorrection:true}).sections.some(section => section.id === 'saju-local-time-basis'));
      assert.ok(!buildReadingDetail(bad,input).sections.find(section=>section.id==='saju-da-yun')?.table,'mismatched correction clocks cannot be relabelled as uncorrected cycles');
    }
  });
  await test('legacy and correction-off readings preserve report/PDF compatibility; other modes ignore city settings', () => {
    const legacyInput = {...input}; delete legacyInput.birthplaceId; delete legacyInput.timeCorrection;
    const legacy = calculateReading(legacyInput,options);
    const off = calculateReading({...input,timeCorrection:'none'},options);
    assert.deepEqual(legacy.chart.pillars,off.chart.pillars);
    assert.deepEqual(buildReadingPdfDocument({reading:legacy,input:legacyInput}),buildReadingPdfDocument({reading:off,input:{...input,timeCorrection:'none'}}));
    assert.equal(sajuTimeCorrectionDisplay(legacy).applied,false);
    for (const mode of ['zodiac','ziwei']) {
      const plainInput={...legacyInput,mode}; const plain=calculateReading(plainInput,options), extra=calculateReading({...plainInput,birthplaceId:'seoul',timeCorrection:'local-mean-solar'},options);
      assert.deepEqual(extra,plain); assert.deepEqual(buildReadingPdfDocument({reading:extra,input:plainInput}),buildReadingPdfDocument({reading:plain,input:plainInput}));
      assert.equal(sajuTimeCorrectionDisplay(extra),null);
    }
  });
  await test('unknown time remains unknown even with a city; it does not manufacture a corrected time or private section', () => {
    const unknownInput={...input,birthTime:null}; const unknown=calculateReading(unknownInput,options);
    assert.equal(unknown.chart.timeCorrection.status,'missing-time'); assert.equal(unknown.chart.pillars.length,3);
    assert.equal(sajuTimeCorrectionDisplay(unknown).applied,false); assert.match(sajuTimeCorrectionDisplay(unknown).summary,/생시를 몰라/);
    assert.ok(!buildReadingPdfDocument({reading:unknown,input:unknownInput,includeBirthData:true,localOnlyCorrection:true}).sections.some(section => section.id==='saju-local-time-basis'));
  });
  await test('record allowlist never adds city, correction, coordinates, times or result metadata', async () => {
    const prepared=prepareReadingRecord({...values,birthplaceId:input.birthplaceId,timeCorrection:input.timeCorrection,chart:reading.chart,birthTime:input.birthTime},config,reading.calculation.details.solarDate,new Date('2026-10-23T00:00:00Z'));
    assert.equal(prepared.kind,'ready'); assert.deepEqual(Object.keys(prepared.payload).sort(),['source','name','phone','birthDate','recordConsent','consentVersion','topic'].sort()); assert.equal(prepared.payload.birthDate,'2000-01-01');
    const nodes=new Map(); const get=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',disabled:false,classList:{toggle(){}}});return nodes.get(id);};
    const form={elements:{phone:{value:values.phone}},querySelectorAll:()=>[get('calculate-button')]}; const requests=[];
    const controller=createReadingRecordController({form,document:{getElementById:get},uuid:()=> '00000000-0000-4000-8000-000000000001',request:async(path,options)=>{requests.push({path,payload:JSON.parse(options.body)});return Response.json({status:'registered',id:'synthetic-receipt'});}});
    controller.setConfig(config); await controller.save({input:{...input,nickname:values.name},result:reading});
    assert.equal(requests.length,1); assert.equal(requests[0].path,'/api/participants'); assert.equal(requests[0].payload.birthDate,'2000-01-01');
    assert.deepEqual(Object.keys(requests[0].payload).sort(),[...Object.keys(prepared.payload),'requestKey'].sort());
  });
  await test('all display and document projections are deterministic and leave input/result untouched', () => {
    assert.equal(JSON.stringify(input),beforeInput); assert.equal(JSON.stringify(reading),beforeReading);
    const parameters={reading,input,includeBirthData:true,localOnlyCorrection:true}; assert.deepEqual(buildReadingPdfDocument(parameters),buildReadingPdfDocument(parameters));
    assert.equal(JSON.stringify(reading),beforeReading);
  });
} finally { Object.assign(globalThis,original); }
console.log(`PASS ${groups} birthplace display/PDF/privacy groups. Synthetic dates and mock record transport only; no actual DB, email or PDF creation.`);
