// Current record-storage contract, real services and :memory: SQLite only.
// Includes retired advertising-v1 regression: preserve history, reject all writes/replays.
// No HTTP request, local/prod DB, secret file or provider is accessed.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const memory = new DatabaseSync(':memory:');
for (const name of ['0000_calm_blue_marvel.sql', '0001_broad_mach_iv.sql', '0002_site-operators.sql']) {
  memory.exec(await readFile(new URL(`../drizzle/${name}`, import.meta.url), 'utf8'));
}
const oldId = randomUUID();
const now = Date.now();
const oldPurpose = 'MBTI·별자리·사주 등 성향을 나누는 일반 모임 참가 관심 신청 및 안내';
memory.prepare(`INSERT INTO participants
  (id,name,phone,store_birth_data,collection_consent,age_confirm_14,consent_version,consent_purpose,meetup_description,consent_at,retention_days,created_at,expires_at,status)
  VALUES (?,?,?,0,1,1,?,?,?,?,90,?,?,'registered')`)
  .run(oldId, '합성 기존 신청', '01000000000', 'participants-v1', oldPurpose, '합성 모임', now, now, now + 86400000);
memory.exec(await readFile(new URL('../drizzle/0003_flashy_lady_mastermind.sql', import.meta.url), 'utf8'));
const oldLeadId = randomUUID(), oldLeadKey = randomUUID();
const oldLeadPurpose = '사이(SAI STUDIO)의 MBTI·별자리·사주·자미두수 모임 홍보 및 참가 제안';
memory.prepare(`INSERT INTO participants
  (id,source,name,phone,store_birth_data,collection_consent,age_confirm_14,consent_version,consent_purpose,meetup_description,consent_at,retention_days,created_at,expires_at,status,marketing_consent,marketing_channels,marketing_purpose,marketing_consent_version,marketing_consent_at,request_key,request_fingerprint)
  SELECT ?,'reading',name,phone,0,1,1,'reading-leads-v1',?,meetup_description,consent_at,retention_days,created_at,expires_at,status,1,'["sms"]',?,'reading-leads-v1',consent_at,?,? FROM participants WHERE id=?`)
  .run(oldLeadId, oldLeadPurpose, oldLeadPurpose, oldLeadKey, 'a'.repeat(64), oldId);
const oldLeadSnapshot = JSON.stringify(memory.prepare('SELECT * FROM participants WHERE id=?').get(oldLeadId));
class Statement {
  constructor(query, values = []) { this.query = query; this.values = values; }
  bind(...values) { return new Statement(this.query, values); }
  async first(column) { const row = memory.prepare(this.query).get(...this.values); return column ? row?.[column] ?? null : row ?? null; }
  async all() { return { success: true, results: memory.prepare(this.query).all(...this.values), meta: {} }; }
  async raw() { const query = memory.prepare(this.query); query.setReturnArrays(true); return query.all(...this.values); }
  async run() { memory.prepare(this.query).run(...this.values); return { success: true, results: [], meta: {} }; }
}
const testEnv = { DB: { prepare: (sql) => new Statement(sql) }, COLLECTION_ENABLED: 'false',
  PARTICIPANTS_COLLECTION_ENABLED: 'true', OPERATOR_NAME: '합성 운영자', CONTACT_EMAIL: 'operator@example.test',
  RETENTION_DAYS: '1', MEETUP_DESCRIPTION: '합성 일반 모임', ADMIN_EMAILS: 'seedy@sites.test',
  RATE_LIMIT_SECRET: 'in-memory-synthetic-test-only' };
globalThis.__readingLeadTestEnv = testEnv;
globalThis.__readingLeadTestUser = null;
const bundled = await build({ stdin: { contents: 'export * from "./lib/participants"; export {apiRoute} from "./lib/service"; export {GET as participantsExportGET, POST as participantsExportPOST} from "./app/api/admin/participants/export/route";', resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'node22',
  plugins: [{ name: 'memory-only-bindings', setup(builder) {
    builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'reading-test' }));
    builder.onResolve({ filter: /^@\/app\/chatgpt-auth$/ }, () => ({ path: 'auth', namespace: 'reading-test' }));
    builder.onLoad({ filter: /.*/, namespace: 'reading-test' }, ({ path }) => ({ loader: 'js', contents: path === 'env'
      ? 'export const env = globalThis.__readingLeadTestEnv;'
      : 'export async function getChatGPTUser(){return globalThis.__readingLeadTestUser;}' }));
  } }],
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };
const lead = { source: 'reading', name: '=1+1', phone: '010-0000-0001', birthDate: '2000-01-01', topic: 'zodiac',
  recordConsent: true, consentVersion: 'reading-records-v1', requestKey: randomUUID() };
function request(payload, { origin = 'https://lead.example.test', type = 'application/json', raw, ip = '192.0.2.1' } = {}) {
  return new Request('https://lead.example.test/api/participants', { method: 'POST',
    headers: { Origin: origin, 'Content-Type': type, 'CF-Connecting-IP': ip }, body: raw ?? JSON.stringify(payload) });
}
async function call(action) {
  const response = await api.apiRoute(action);
  check(response.headers.get('cache-control')?.includes('no-store'), 'JSON response is no-store');
  return { status: response.status, data: await response.json() };
}
const post = (payload, options) => call(() => api.createParticipant(request(payload, options)));
async function reject(payload, status, code, options) {
  const result = await post(payload, options);
  assert.equal(result.status, status); assert.equal(result.data.error?.code, code); checks++;
}
const count = () => memory.prepare('SELECT COUNT(*) AS count FROM participants').get().count;
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('Unexpected network/provider access in isolated test'); };
try {
  const legacy = memory.prepare('SELECT * FROM participants WHERE id=?').get(oldId);
  check(legacy.source === 'join' && legacy.marketing_consent === 0 && legacy.marketing_channels === null
    && legacy.marketing_purpose === null && legacy.marketing_consent_at === null
    && legacy.marketing_consent_version === null && legacy.consent_version === 'participants-v1'
    && legacy.consent_purpose === oldPurpose, 'migration never reclassifies old consent as advertising');
  const config = await call(api.participantConfig);
  check(config.data.consentVersion === 'participants-v1' && config.data.purpose === oldPurpose, 'legacy public contract unchanged');
  check(config.data.readingLead.enabled === false && config.data.readingRecord.enabled
    && config.data.readingRecord.consentVersion === 'reading-records-v1'
    && config.data.readingRecord.purpose === '성향 체험 입력 기록(이름·휴대전화·생년월일·선택 주제) 관리 및 보관'
    && config.data.readingRecord.minimumAge === 14
    && config.data.readingRecord.fields.required.includes('birthDate'), 'server truth for record purpose/version/DOB, retired advertising disabled');
  for (const requestKey of [randomUUID(), oldLeadKey]) {
    await reject({ source:'reading', consentVersion:'reading-leads-v1', collectionConsent:true,
      marketingConsent:true, marketingChannels:['sms'], ageConfirm14:true, name:'합성 과거광고', phone:'01000000000', requestKey },
      409, 'CONSENT_VERSION_RETIRED');
  }
  check(JSON.stringify(memory.prepare('SELECT * FROM participants WHERE id=?').get(oldLeadId)) === oldLeadSnapshot,
    'retired advertising creates no new rows, replays never add DOB or change past consent');
  check(!Object.hasOwn(config.data, 'ADMIN_EMAILS') && !Object.hasOwn(config.data, 'RATE_LIMIT_SECRET'), 'public config has no secrets');
  testEnv.PARTICIPANTS_COLLECTION_ENABLED = 'false';
  await reject(lead, 503, 'PARTICIPANTS_DISABLED');
  testEnv.PARTICIPANTS_COLLECTION_ENABLED = 'true';
  const originalBinding = testEnv.DB;
  testEnv.DB = { prepare(query) {
    if (/^select/i.test(query.trim())) throw new Error('Synthetic missing-column failure');
    return originalBinding.prepare(query);
  } };
  const unavailable = await call(api.participantConfig);
  check(unavailable.data.collectionEnabled === false && unavailable.data.readingRecord.enabled === false,
    'unavailable/missing schema fails closed in config, no personal rows selected');
  await reject(lead, 503, 'PARTICIPANTS_DISABLED');
  testEnv.DB = originalBinding;
  const invalid = [
    [{ recordConsent:false }, 'INVALID_READING_RECORD'], [{ recordConsent:undefined }, 'INVALID_READING_RECORD'],
    [{ ageConfirm14:true }, 'INVALID_READING_RECORD'], [{ collectionConsent:true }, 'INVALID_READING_RECORD'],
    [{ marketingConsent:true }, 'INVALID_READING_RECORD'], [{ marketingChannels:['sms'] }, 'INVALID_READING_RECORD'],
    [{ storeBirthData:true }, 'INVALID_READING_RECORD'], [{ name:'' }, 'INVALID_READING_RECORD'],
    [{ name:'가'.repeat(31) }, 'INVALID_READING_RECORD'], [{ phone:'0212345678' }, 'INVALID_PHONE'],
    [{ birthDate:undefined }, 'INVALID_READING_RECORD'], [{ birthDate:'2000.01.01' }, 'INVALID_READING_RECORD'],
    [{ birthDate:'2001-02-29' }, 'INVALID_BIRTH_DATE'], [{ birthDate:'2999-01-01' }, 'INVALID_BIRTH_DATE'],
    [{ birthDate:'1899-12-31' }, 'INVALID_BIRTH_DATE'],
    [{ birthDate:new Date().toISOString().slice(0,10) }, 'MINIMUM_AGE_REQUIRED'],
    [{ consentVersion:'old' }, 'CONSENT_VERSION_MISMATCH'], [{ requestKey:undefined }, 'INVALID_READING_RECORD'],
    [{ requestKey:'invalid' }, 'INVALID_READING_RECORD'], [{ birthTime:'12:00' }, 'INVALID_READING_RECORD'],
    [{ gender:'female' }, 'INVALID_READING_RECORD'], [{ result:{type:'INFP'} }, 'INVALID_READING_RECORD'],
    [{ purpose:'client override' }, 'INVALID_READING_RECORD'],
  ];
  for (const [change,code] of invalid) await reject({...lead,...change},code==='CONSENT_VERSION_MISMATCH'?409:400,code);
  const fixedNow = Date.parse('2026-10-22T03:00:00Z');
  check(api.validateReadingRecordPayload({...lead,birthDate:'2012-10-22'},fixedNow).birthDate === '2012-10-22',
    'exact fourteenth birthday accepted using Korean date');
  assert.throws(()=>api.validateReadingRecordPayload({...lead,birthDate:'2012-10-23'},fixedNow),
    (error)=>error.code==='MINIMUM_AGE_REQUIRED'); checks++;
  await reject(lead, 403, 'ORIGIN_REQUIRED', { origin: '' });
  await reject(lead, 403, 'ORIGIN_REQUIRED', { origin: 'https://other.example.test' });
  await reject(lead, 415, 'JSON_REQUIRED', { type: 'text/plain' });
  await reject(lead, 400, 'INVALID_JSON', { raw: '{' });
  await reject(lead, 413, 'REQUEST_TOO_LARGE', { raw: 'x'.repeat(24577) });
  check(count() === 2, 'disabled/invalid/unrequested records create no personal record');
  const stored = await post(lead);
  check(stored.status === 201 && stored.data.source === 'reading' && stored.data.replayed === false
    && stored.data.status === 'registered' && !Object.hasOwn(stored.data, 'phone'), 'explicit lead accepted without echoing contact or claiming sent');
  const row = memory.prepare('SELECT * FROM participants WHERE id=?').get(stored.data.id);
  check(row.store_birth_data === 1 && row.birth_date === lead.birthDate && row.birth_consent_at === row.created_at
    && row.age_confirm_14 === 1 && row.collection_consent === 1, 'DOB stored only by explicit save request; server age threshold not fabricated checkbox');
  check(row.consent_version === 'reading-records-v1' && row.consent_purpose === config.data.readingRecord.purpose,
    'record-storage purpose and notice version, not an advertising registration');
  check(row.meetup_description === '', 'new record stores no obsolete meetup/advertising description');
  check(row.marketing_consent === 0 && row.marketing_purpose === null && row.marketing_consent_version === null
    && row.marketing_consent_at === null && JSON.parse(row.marketing_channels).length === 0, 'record save never opts into advertising');
  check(row.expires_at - row.created_at === 86400000, 'retention snapshot on first insertion');
  const repeated = await post({ ...lead, phone: '+82 10 0000 0001' });
  check(repeated.status === 200 && repeated.data.replayed && repeated.data.id === stored.data.id && count() === 3, 'same key/canonical payload retries do not duplicate');
  check(repeated.data.expiresAt === stored.data.expiresAt
    && memory.prepare('SELECT consent_at FROM participants WHERE id=?').get(row.id).consent_at === row.consent_at, 'retry never renews consent or retention');
  await reject({ ...lead, name: 'changed name' }, 409, 'REQUEST_KEY_CONFLICT');
  await reject({ ...lead, birthDate:'2000-01-02' }, 409, 'REQUEST_KEY_CONFLICT');
  await reject({ ...lead, requestKey:oldLeadKey }, 409, 'REQUEST_KEY_CONFLICT');
  const concurrent = { ...lead, requestKey: randomUUID(), name: '합성 동시 요청' };
  const raced = await Promise.all(Array.from({ length: 3 }, () => post(concurrent, { ip: '192.0.2.2' })));
  check(raced.filter((result) => result.status === 201).length === 1
    && raced.every((result) => result.data.id === raced[0].data.id) && count() === 4, 'concurrent identical requests stored exactly once');
  const sameContactNewConsent = await post({ ...lead, requestKey: randomUUID() }, { ip: '192.0.2.3' });
  check(sameContactNewConsent.status === 201 && sameContactNewConsent.data.id !== row.id, 'no global phone dedupe/consent overwrite or phone-existence disclosure');
  const join = { name: '합성 모임 신청', phone: '01000000002', collectionConsent: true,
    ageConfirm14: true, consentVersion: 'participants-v1', storeBirthData: false };
  const joined = await post(join, { ip: '192.0.2.4' });
  const joinedRow = memory.prepare('SELECT * FROM participants WHERE id=?').get(joined.data.id);
  check(joined.status === 201 && joinedRow.source === 'join' && joinedRow.marketing_consent === 0
    && joinedRow.marketing_purpose === null && joinedRow.marketing_consent_version === null
    && joinedRow.request_key === null && JSON.parse(joinedRow.marketing_channels).length === 0, 'new legacy-v1 join is still non-advertising');
  check(joinedRow.meetup_description === testEnv.MEETUP_DESCRIPTION
    && JSON.stringify(memory.prepare('SELECT * FROM participants WHERE id=?').get(oldLeadId)) === oldLeadSnapshot,
    'join keeps its description and historic advertising row remains unchanged');
  await reject({ ...join, marketingConsent: true }, 400, 'INVALID_PARTICIPANT');
  const anonymous = await call(() => api.listParticipants(new Request('https://lead.example.test/api/admin/participants')));
  check(anonymous.status === 403, 'anonymous list forbidden');
  globalThis.__readingLeadTestUser = { userId: 'synthetic-test-user', email: 'seedy@sites.test', displayName: 'Synthetic', fullName: null };
  const listed = await call(() => api.listParticipants(new Request('https://lead.example.test/api/admin/participants?limit=100')));
  const masked = listed.data.records.find((item) => item.id === row.id);
  check(masked.source === 'reading' && masked.marketingConsent === false && masked.marketingConsentVersion === null
    && masked.marketingChannels.length === 0 && masked.marketingConsentAt === null
    && masked.storeBirthData === true && !Object.hasOwn(masked,'birthDate')
    && !Object.hasOwn(masked, 'name') && !Object.hasOwn(masked, 'phone')
    && !Object.hasOwn(masked, 'marketingPurpose') && !Object.hasOwn(masked, 'requestKey'), 'masked DTO exposes only relevant consent metadata');
  check(listed.data.summary.total === count() && listed.data.summary.bySource.join === 2
    && listed.data.summary.bySource.reading === 4 && listed.data.summary.marketingOptIn === 1, 'actual record counts preserve exactly one historic advertising opt-in, new records not counted');
  const full = await call(() => api.listParticipants(new Request('https://lead.example.test/api/admin/participants?includePersonal=true&limit=100')));
  const fullRow = full.data.records.find((item) => item.id === row.id);
  check(fullRow.marketingPurpose === null && fullRow.consentPurpose === config.data.readingRecord.purpose
    && fullRow.phone === '01000000001' && fullRow.birthDate === lead.birthDate && fullRow.birthConsentAt
    && !Object.hasOwn(fullRow, 'requestFingerprint'), 'explicit admin reveal includes DOB and actual save purpose, no technical fingerprint');
  const csv = await api.exportParticipants();
  const bytes = new Uint8Array(await csv.arrayBuffer()); const csvText = new TextDecoder().decode(bytes);
  check(bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191 && csvText.includes('"\'=1+1"')
    && csvText.includes('"reading-records-v1"') && csvText.includes('"2000-01-01"')
    && csvText.includes(config.data.readingRecord.purpose) && csvText.includes('기록 저장 버튼 요청·서버 생년월일 연령검증')
    && csvText.includes(oldLeadPurpose), 'CSV save evidence and historic consent, BOM and formula protection');
  const countBeforeRace = count();
  const conflictingKey = randomUUID();
  const conflicting = await Promise.all(['합성 A', '합성 B'].map((name) => post({ ...lead, requestKey: conflictingKey, name }, { ip: '192.0.2.6' })));
  check(conflicting.filter((result) => result.status === 201).length === 1
    && conflicting.filter((result) => result.status === 409 && result.data.error?.code === 'REQUEST_KEY_CONFLICT').length === 1
    && count() === countBeforeRace + 1, 'concurrent same key/different body never overwrites consent or contact');
  for (let i = 0; i < 5; i++) {
    const result = await post({ ...lead, requestKey: randomUUID() }, { ip: '192.0.2.5' });
    check(result.status === 201, 'valid first five per-hour requests');
  }
  await reject({ ...lead, requestKey: randomUUID() }, 429, 'RATE_LIMITED', { ip: '192.0.2.5' });
  const limitedReplay = await post(lead, { ip: '192.0.2.5' });
  check(limitedReplay.status === 200 && limitedReplay.data.replayed && limitedReplay.data.id === row.id,
    'an already accepted identical retry does not consume a new rate-limit slot');
  check(memory.prepare('SELECT key FROM request_rate_limits').all().every((item) => /^[a-f0-9]{64}$/.test(item.key)), 'only hashed rate-limit keys persisted');
  memory.prepare('UPDATE participants SET expires_at=? WHERE id=?').run(Date.now() - 1, row.id);
  const afterExpiry = await call(() => api.listParticipants(new Request('https://lead.example.test/api/admin/participants')));
  check(!afterExpiry.data.records.some((item) => item.id === row.id)
    && !memory.prepare('SELECT id FROM participants WHERE id=?').get(row.id), 'expired record purged on authorized access');
  const removed = await call(() => api.deleteParticipant(new Request('https://lead.example.test/api/admin/participants/' + joined.data.id,
    { method: 'DELETE', headers: { Origin: 'https://lead.example.test' } }), joined.data.id));
  check(removed.status === 200 && !memory.prepare('SELECT id FROM participants WHERE id=?').get(joined.data.id), 'existing administrator deletion remains valid');

  // Selected export runs the real service against this process's :memory: DB.
  // Fixtures are direct synthetic inserts to avoid registration/rate-limit side effects.
  const exportIds = Array.from({length:51},()=>randomUUID());
  const formulaNames = ['=1+1','+SUM(1,1)','-1+2','@SUM(1,1)','\t=1+1','\r=1+1','  =1+1','\uFEFF=1+1','합성 "인용", 이름'];
  const insertExportFixture = memory.prepare(`INSERT INTO participants
    (id,source,name,phone,topic,store_birth_data,birth_date,birth_consent_at,collection_consent,age_confirm_14,consent_version,
      consent_purpose,meetup_description,consent_at,retention_days,created_at,expires_at,status,marketing_consent,marketing_channels)
    VALUES (?,'reading',?,?,?,1,'2000-01-01',?,1,1,'reading-records-v1',?,'',?,1,?,?,'registered',0,'[]')`);
  const exportNow=Date.now();
  for(const [index,id]of exportIds.entries())insertExportFixture.run(id,formulaNames[index]??`합성 CSV ${index}`,
    `0100000${String(index).padStart(4,'0')}`,'ziwei',exportNow,config.data.readingRecord.purpose,exportNow,exportNow+index,exportNow+2*86400000);
  const exportSnapshot=()=>JSON.stringify({
    participants:memory.prepare('SELECT * FROM participants ORDER BY id').all(),
    rates:memory.prepare('SELECT * FROM request_rate_limits ORDER BY key').all(),
    operators:memory.prepare('SELECT * FROM site_operators ORDER BY id').all(),
  });
  function exportRequest(payload,{origin='https://lead.example.test',type='application/json',raw}={}){
    return new Request('https://lead.example.test/api/admin/participants/export',{method:'POST',headers:{Origin:origin,'Content-Type':type},body:raw??JSON.stringify(payload)});
  }
  async function selectedExport(payload,options){return api.participantsExportPOST(exportRequest(payload,options));}
  async function exportReject(payload,status,code,options){
    const before=exportSnapshot(),response=await selectedExport(payload,options),data=await response.json();
    check(response.status===status&&data.error?.code===code,`selection rejects ${code}`);
    check(response.headers.get('cache-control')?.includes('no-store')&&!response.headers.get('content-disposition'), 'rejected selection is no-store JSON, never a fallback CSV');
    check(exportSnapshot()===before, 'rejected selection/authentication/origin does not change DB');
  }
  // Parse actual escaped CSV rather than checking names with substring matches.
  function parseCsv(text){
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){
      const char=text[i];
      if(char==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
      else if(char===','&&!quoted){row.push(cell);cell='';}
      else if((char==='\r'||char==='\n')&&!quoted){if(char==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
      else cell+=char;
    }
    if(cell||row.length){row.push(cell);rows.push(row);}return rows;
  }
  for(const ids of [[exportIds[0]],exportIds.slice(0,9).reverse(),exportIds.slice(0,50).reverse()]){
    const before=exportSnapshot(),response=await selectedExport({ids}),bytes=new Uint8Array(await response.arrayBuffer());
    check(response.status===200&&response.headers.get('content-type')?.startsWith('text/csv'), 'one through fifty selected UUIDs returns CSV');
    check(response.headers.get('cache-control')?.includes('no-store')&&response.headers.get('x-content-type-options')==='nosniff'
      &&response.headers.get('referrer-policy')==='no-referrer'&&response.headers.get('content-disposition')?.includes('attachment'), 'selected CSV uses download/private no-store security headers');
    check(bytes[0]===239&&bytes[1]===187&&bytes[2]===191,'selected CSV begins with UTF-8 BOM');
    const csvRows=parseCsv(new TextDecoder().decode(bytes));
    check(csvRows.length===ids.length+1&&csvRows[0][0]==='신청번호', 'CSV header plus exactly selected number of data rows');
    assert.deepEqual(csvRows.slice(1).map(r=>r[0]).sort(),[...ids].sort());checks++;
    for(const cells of csvRows.slice(1)){
      const record=memory.prepare('SELECT * FROM participants WHERE id=?').get(cells[0]);
      const expectedName=/^[\s\uFEFF]*[=+\-@]/.test(record.name)||/^[\t\r\n]/.test(record.name)?"'"+record.name:record.name;
      check(cells[1]===expectedName&&cells[2]===record.phone&&cells[4]===record.birth_date,'selected CSV contains only selected original contact/DOB with quoted formula-safe name');
    }
    check(!csvRows.slice(1).some(r=>r[0]===oldId||r[0]===oldLeadId), 'selection never falls back to unrelated rows');
    check(exportSnapshot()===before, 'successful selected CSV does not mutate records, consent, retention, rates or operators');
  }
  for(const payload of [null,{}, {ids:[]},{ids:[exportIds[0],exportIds[0]]},{ids:['invalid']},{ids:[null]},
    {ids:exportIds},{ids:[exportIds[0]],includePersonal:true},{ids:[exportIds[0]],source:'reading'}, {ids:'all'}, {ids:[exportIds[0]],all:true}]){
    await exportReject(payload,400,'INVALID_SELECTION');
  }
  await exportReject({ids:[exportIds[0]]},403,'ORIGIN_REQUIRED',{origin:'https://other.example.test'});
  await exportReject({ids:[exportIds[0]]},403,'ORIGIN_REQUIRED',{origin:''});
  await exportReject({ids:[exportIds[0]]},415,'JSON_REQUIRED',{type:'text/plain'});
  await exportReject({ids:[exportIds[0]]},400,'INVALID_JSON',{raw:'{'});
  await exportReject({ids:[exportIds[0]]},413,'REQUEST_TOO_LARGE',{raw:'x'.repeat(24577)});
  const exportAdmin=globalThis.__readingLeadTestUser;
  for(const user of [null,{userId:'synthetic-non-operator',email:'denied@example.test',displayName:'Synthetic denied',fullName:null}]){
    globalThis.__readingLeadTestUser=user;
    await exportReject({ids:[exportIds[0]]},403,'ADMIN_FORBIDDEN');
    const before=exportSnapshot(),all=await api.participantsExportGET(),data=await all.json();
    check(all.status===403&&data.error?.code==='ADMIN_FORBIDDEN'&&exportSnapshot()===before,'non-operator cannot export all or selected records');
  }
  globalThis.__readingLeadTestUser=exportAdmin;
  await exportReject({ids:[exportIds[0],randomUUID()]},409,'SELECTION_CHANGED');
  memory.prepare('UPDATE participants SET expires_at=? WHERE id=?').run(Date.now()-1,exportIds[50]);
  await exportReject({ids:[exportIds[0],exportIds[50]]},409,'SELECTION_CHANGED');
  check(Boolean(memory.prepare('SELECT id FROM participants WHERE id=?').get(exportIds[50])), 'selected export does not purge the expired synthetic row');
  const allExport=await api.participantsExportGET(),allRows=parseCsv(new TextDecoder().decode(await allExport.arrayBuffer()));
  check(allExport.status===200&&allRows.length===count()+1&&allRows.slice(1).some(r=>r[0]===oldId)
    &&allRows.slice(1).some(r=>r[0]===oldLeadId),'legacy full export still exports all eligible records without selection');
  console.log(`PASS ${checks} isolated reading-record checks: explicit save/DOB/age, retired advertising history preserved, no fake checkbox or marketing consent, atomic idempotency, no time/gender/results, masking/export, retention/rate limit. In-memory synthetic data only; zero HTTP/provider calls.`);
} finally {
  globalThis.fetch = originalFetch;
  delete globalThis.__readingLeadTestEnv; delete globalThis.__readingLeadTestUser; memory.close();
}
