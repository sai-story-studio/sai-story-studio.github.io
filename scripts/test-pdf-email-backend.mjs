// Real service + in-memory SQLite. PDF layout has its own tests; this suite
// replaces only its binary renderer and mocks all HTTP at the fetch boundary.
// No local/production database, real recipient, secret or provider is accessed.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const memory = new DatabaseSync(':memory:');
for (const name of ['0000_calm_blue_marvel', '0001_broad_mach_iv', '0002_site-operators', '0003_flashy_lady_mastermind', '0004_useful_leo']) {
  memory.exec(await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), 'utf8'));
}
class Statement {
  constructor(query, values = []) { this.query = query; this.values = values; }
  bind(...values) { return new Statement(this.query, values); }
  async first(column) { const row = memory.prepare(this.query).get(...this.values); return column ? row?.[column] ?? null : row ?? null; }
  async all() { return { success: true, results: memory.prepare(this.query).all(...this.values), meta: {} }; }
  async raw() { const query = memory.prepare(this.query); query.setReturnArrays(true); return query.all(...this.values); }
  async run() { memory.prepare(this.query).run(...this.values); return { success: true, results: [], meta: {} }; }
}
const testEnv = { DB: { prepare: (sql) => new Statement(sql) }, COLLECTION_ENABLED: 'false',
  OPERATOR_NAME: '합성 운영자', CONTACT_EMAIL: 'operator@example.test', RETENTION_DAYS: '90',
  ADMIN_EMAILS: 'seedy@sites.test', RATE_LIMIT_SECRET: 'synthetic-in-memory-only' };
globalThis.__pdfMailEnv = testEnv; globalThis.__pdfMailUser = null;
const bundled = await build({ stdin: { contents: 'export * from "./lib/service";', resolveDir: root }, bundle: true,
  write: false, platform: 'node', format: 'esm', target: 'node22', plugins: [{ name: 'memory-only-pdf-mail', setup(builder) {
    builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'pdf-test' }));
    builder.onResolve({ filter: /^@\/app\/chatgpt-auth$/ }, () => ({ path: 'auth', namespace: 'pdf-test' }));
    builder.onResolve({ filter: /^(?:@\/public\/experience\/reading-pdf\.js)$/ }, () => ({ path: 'renderer', namespace: 'pdf-test' }));
    builder.onLoad({ filter: /.*/, namespace: 'pdf-test' }, ({ path }) => ({ loader: 'js', contents: path === 'env'
      ? 'export const env = globalThis.__pdfMailEnv;' : path === 'auth'
        ? 'export async function getChatGPTUser(){return globalThis.__pdfMailUser;}'
        : `export const PDF_FONT_PATHS={regular:'/experience/fonts/sai-pdf-regular.ttf',bold:'/experience/fonts/sai-pdf-bold.ttf'};
           export async function buildReadingPdf({document}){globalThis.__lastPdfDocument=document;return new TextEncoder().encode('%PDF-1.7\\nsynthetic renderer fixture');}` }));
  } }] });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const origin = 'https://pdf.example.test';
const document = { version: 1, mode: 'saju', title: '나의 사주 이야기', subtitle: '합성 결과',
  summary: [{ label: 'MBTI 스타일', text: 'INFP' }], sections: [{ id: 'reflection', title: '균형을 위한 질문',
    chapter: '', text: '요즘 내가 편안한 방식은 무엇인가요?', paragraphs: [], items: [] }], notes: ['자기 탐색을 위한 상징 해석입니다.'] };
const base = { mode: 'saju', nickname: '합성 요청', storeBirthData: false, channel: 'email', contact: 'synthetic@example.test',
  requestKey: randomUUID(), document, result: { type: 'INFP', title: '합성 제목', summary: '합성 결과', basis: ['계산된 전통 상징을 쉽게 풀이'] },
  resultConsent: true, ageConfirm14: true, consentVersion: '2026-10-23-result-pdf-v2' };
const request = (payload, ip = '192.0.2.1', requestOrigin = origin) => new Request(`${origin}/api/requests`, {
  method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify(payload) });
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
async function call(action) { const response = await api.apiRoute(action); return { status: response.status, data: await response.json() }; }
const post = (payload = base, ip, requestOrigin) => call(() => api.createRequest(request(payload, ip, requestOrigin)));
async function reject(payload, status, code, ip, requestOrigin) { const value = await post(payload, ip, requestOrigin);
  check(value.status === status && value.data.error?.code === code, code); }
const count = () => Number(memory.prepare('SELECT count(*) AS n FROM reading_requests').get().n);
const originalFetch = globalThis.fetch;
let providerCalls = 0, fontCalls = 0, providerMode = 'accepted', fontMode = 'ready', lastProviderBody, lastIdempotency;
const assetBinding = { async fetch(input) {
  const asset = new URL(input.url);
  check(asset.origin === 'https://assets.internal' && ['/experience/fonts/sai-pdf-regular.ttf', '/experience/fonts/sai-pdf-bold.ttf'].includes(asset.pathname),
    'only allowlisted internal static-font asset binding');
  check(input.redirect === 'error', 'asset redirects not followed'); fontCalls++;
  if (fontMode === 'missing') return new Response('missing', { status: 404 });
  return new Response(new Uint8Array([1, 2, 3]));
} };
globalThis.fetch = async (input, options) => {
  const url = String(input);
  if (url === `${origin}/experience/fonts/sai-pdf-regular.ttf` || url === `${origin}/experience/fonts/sai-pdf-bold.ttf`) {
    fontCalls++; check(options?.redirect === 'error', 'font redirect not followed'); return new Response(new Uint8Array([1, 2, 3]));
  }
  check(url === 'https://api.resend.com/emails', 'only fixed provider endpoint'); providerCalls++;
  lastProviderBody = JSON.parse(options.body); lastIdempotency = options.headers['Idempotency-Key'];
  if (providerMode === 'throw') throw new Error('synthetic network failure - not a real call');
  if (providerMode === 'bad') return Response.json({ secretLikeError: 'must not echo' }, { status: 502 });
  return Response.json({ id: 'synthetic-provider-id' });
};
try {
  await reject(base, 503, 'COLLECTION_DISABLED');
  testEnv.COLLECTION_ENABLED = 'true';
  await reject(base, 503, 'SENDER_NOT_CONFIGURED');
  check(count() === 0 && providerCalls === 0 && fontCalls === 0, 'unconfigured email stores and sends nothing');
  testEnv.RESEND_API_KEY = 'synthetic-not-a-real-key'; testEnv.MAIL_FROM = '사이 <mail@verified.example.test>';
  await reject(base, 503, 'PDF_UNAVAILABLE');
  check(count() === 0 && providerCalls === 0 && fontCalls === 0, 'missing production ASSETS binding never self-fetches or stores contact');
  testEnv.ASSETS = assetBinding;
  await reject(base, 403, 'ORIGIN_REQUIRED', undefined, 'https://other.example.test');
  for (const change of [ { requestKey: undefined }, { requestKey: 'bad' }, { resultConsent: false },
    { ageConfirm14: false }, { consentVersion: '2026-10-22-meetup-v1' } ]) await reject({ ...base, ...change }, 400, 'INVALID_REQUEST');
  await reject({ ...base, document: undefined }, 400, 'INVALID_PDF_DOCUMENT');
  await reject({ ...base, document: { ...document, mode: 'zodiac' } }, 400, 'INVALID_PDF_DOCUMENT');
  await reject({ ...base, document: { ...document, birthData: { date: '2000-01-01', time: null, calendar: 'solar' } } }, 400, 'INVALID_PDF_DOCUMENT');
  await reject({ ...base, document: { ...document, sections: [{ ...document.sections[0], id: 'calculation' }] } }, 400, 'INVALID_PDF_DOCUMENT');
  await reject({ ...base, document: { ...document, attachmentUrl: 'https://forbidden.example.test/file.pdf' } }, 400, 'INVALID_PDF_DOCUMENT');
  await reject({ ...base, attachments: [{ content: 'arbitrary base64 upload' }] }, 400, 'INVALID_REQUEST');
  await reject({ ...base, contact: 'invalid email' }, 400, 'INVALID_CONTACT');
  await reject({ ...base, document: { ...document, title: '<script>alert(1)</script>' } }, 400, 'INVALID_PDF_DOCUMENT');
  const oversized = new Request(`${origin}/api/requests`, { method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' }, body: 'x'.repeat(256 * 1024 + 1) });
  const oversizedResponse = await call(() => api.createRequest(oversized));
  check(oversizedResponse.status === 413 && oversizedResponse.data.error.code === 'REQUEST_TOO_LARGE', 'streamed request size bounded before parse');
  await reject({ ...base, birthDate: '2000-01-01' }, 400, 'BIRTH_STORAGE_CONSENT_REQUIRED');
  await reject({ ...base, channel: 'sms', contact: '01000000000' }, 409, 'SMS_NOT_CONFIGURED');
  check(count() === 0 && providerCalls === 0, 'invalid request creates no record or provider call');
  const created = await post();
  check(created.status === 201 && created.data.status === 'sent' && created.data.replayed === false, 'explicit valid submit invokes provider immediately');
  check(created.data.message.includes('수신함 도착 여부는 확인되지'), 'accepted never claims inbox arrival');
  check(count() === 1 && providerCalls === 1, 'one record one provider invocation');
  const row = memory.prepare('SELECT * FROM reading_requests WHERE id=?').get(created.data.id);
  check(row.status === 'sent' && row.provider_message_id === 'synthetic-provider-id' && row.sent_at > 0,
    'sent requires real-shaped acknowledgement, not local save');
  check(row.birth_date === null && row.birth_time === null && !JSON.stringify(globalThis.__lastPdfDocument).includes('2000-01-01'), 'unchecked birthday absent from stored PDF and renderer input');
  check(row.expires_at - row.created_at === 90 * 86400000 && row.consent_purposes.includes('PDF'), 'same disclosed retention and PDF purpose snapshot');
  check(lastProviderBody.to.length === 1 && lastProviderBody.to[0] === base.contact && !lastProviderBody.cc && !lastProviderBody.bcc,
    'single explicit recipient, no open relay routing fields');
  check(lastProviderBody.attachments.length === 1 && lastProviderBody.attachments[0].filename === 'sai-saju-reading.pdf'
    && Buffer.from(lastProviderBody.attachments[0].content, 'base64').toString().startsWith('%PDF-'), 'server-created PDF attachment not uploaded binary');
  check(!lastProviderBody.html.includes(base.result.summary) && !lastProviderBody.text.includes(base.result.summary), 'email body is short notice, not plaintext reading report');
  check(lastIdempotency === `result-pdf-v2/${created.data.id}`, 'provider request uses fixed record idempotency');
  const replay = await post({ ...base, contact: ' SYNTHETIC@EXAMPLE.TEST ' });
  check(replay.status === 200 && replay.data.replayed && providerCalls === 1 && count() === 1, 'same key/payload does not resend or duplicate');
  await reject({ ...base, contact: 'changed@example.test' }, 409, 'REQUEST_KEY_CONFLICT');
  const beforeRace = count();
  const racing = { ...base, contact: 'race@example.test', requestKey: randomUUID() };
  const race = await Promise.all(Array.from({ length: 3 }, () => post(racing, '192.0.2.2')));
  check(count() === beforeRace + 1 && race.filter((value) => value.status === 201).length === 1
    && race.every((value) => value.data.id === race[0].data.id), 'atomic concurrent idempotency retains exactly one row');
  providerMode = 'throw';
  const retryPayload = { ...base, contact: 'retry@example.test', requestKey: randomUUID() };
  const failed = await post(retryPayload, '192.0.2.3');
  check(failed.status === 502 && failed.data.error.code === 'PROVIDER_UNCONFIRMED' && !JSON.stringify(failed.data).includes('network failure'), 'unknown provider outcome is not sent or echoed');
  const failedRow = memory.prepare('SELECT * FROM reading_requests WHERE request_key=?').get(retryPayload.requestKey);
  check(failedRow.status === 'failed' && failedRow.sent_at === null && failedRow.provider_message_id === null, 'failed has no fake provider acceptance');
  const originalAttempt = failedRow.send_attempted_at;
  providerMode = 'accepted';
  const retry = await post(retryPayload, '192.0.2.3');
  check(retry.status === 200 && retry.data.status === 'sent' && retry.data.replayed && lastIdempotency === `result-pdf-v2/${failedRow.id}`,
    'uncertain retry reuses original provider key');
  check(memory.prepare('SELECT send_attempted_at FROM reading_requests WHERE id=?').get(failedRow.id).send_attempted_at === originalAttempt,
    'retry never extends provider idempotency lifetime');
  memory.prepare("UPDATE reading_requests SET status='failed',send_attempted_at=? WHERE id=?").run(Date.now() - 24 * 3600000, failedRow.id);
  await reject(retryPayload, 409, 'PROVIDER_CONFIRMATION_REQUIRED', '192.0.2.3');
  const birth = { ...base, contact: 'birth@example.test', requestKey: randomUUID(), storeBirthData: true, birthDate: '2000-01-01', birthTime: '08:30',
    document: { ...document, birthData: { date: '2000-01-01', time: '08:30', calendar: 'solar' } } };
  await reject({ ...birth, document: { ...birth.document, birthData: { ...birth.document.birthData, date: '2000-01-02' } } }, 400, 'INVALID_PDF_DOCUMENT');
  const birthSaved = await post(birth, '192.0.2.4');
  check(birthSaved.status === 201 && memory.prepare('SELECT birth_date FROM reading_requests WHERE id=?').get(birthSaved.data.id).birth_date === '2000-01-01',
    'explicit optional birthday included only with matching stored solar DOB');
  fontMode = 'missing';
  const noFont = { ...base, contact: 'nofont@example.test', requestKey: randomUUID() };
  const callsBeforeFontFailure = providerCalls;
  await reject(noFont, 503, 'PDF_UNAVAILABLE', '192.0.2.8');
  const noFontRow = memory.prepare('SELECT * FROM reading_requests WHERE request_key=?').get(noFont.requestKey);
  check(providerCalls === callsBeforeFontFailure && noFontRow.status === 'failed' && noFontRow.send_attempted_at === null,
    'font failure does not call provider or start idempotency clock');
  fontMode = 'ready';
  const renderedRetry = await post(noFont, '192.0.2.8');
  check(renderedRetry.data.status === 'sent' && renderedRetry.data.replayed, 'render-only failure can safely retry same request');
  for (let index = 0; index < 3; index++) {
    const limited = await post({ ...base, contact: 'limited@example.test', requestKey: randomUUID() }, `192.0.2.${10 + index}`);
    check(limited.status === 201, 'first three same-recipient requests from different IPs accepted');
  }
  await reject({ ...base, contact: 'LIMITED@example.test', requestKey: randomUUID() }, 429, 'RATE_LIMITED', '192.0.2.13');
  const callsBeforeReplay = providerCalls;
  const freeReplay = await post(base, '192.0.2.13');
  check(freeReplay.data.replayed && providerCalls === callsBeforeReplay, 'exact retry consumes no recipient slot and never resends');
  const anonymous = await call(() => api.sendAdminResult(new Request(`${origin}/api/admin/send/${row.id}`, { method: 'POST', headers: { Origin: origin } }), row.id));
  check(anonymous.status === 403, 'anonymous cannot invoke administrator resend');
  globalThis.__pdfMailUser = { userId: 'synthetic-user', email: 'seedy@sites.test', displayName: 'Synthetic', fullName: null };
  const legacy = { ...row, id: randomUUID(), result_document: null, request_key: null, request_fingerprint: null,
    status: 'requested', provider_message_id: null, send_attempted_at: null, sent_at: null };
  const legacyKeys = Object.keys(legacy);
  memory.prepare(`INSERT INTO reading_requests (${legacyKeys.map((key) => `"${key}"`).join(',')}) VALUES (${legacyKeys.map(() => '?').join(',')})`).run(...Object.values(legacy));
  const adminRequest = (id, requestOrigin = origin) => new Request(`${origin}/api/admin/send/${id}`, { method: 'POST', headers: { Origin: requestOrigin } });
  const legacySent = await call(() => api.sendAdminResult(adminRequest(legacy.id), legacy.id));
  check(legacySent.data.status === 'sent' && globalThis.__lastPdfDocument.subtitle.includes('이전 신청의 요약')
    && globalThis.__lastPdfDocument.sections.length === 1, 'legacy consent sends only original stored summary PDF');
  memory.prepare("UPDATE reading_requests SET status='failed',send_attempted_at=? WHERE id=?").run(Date.now() - 60000, legacy.id);
  const beforeLegacyRetry = providerCalls;
  const legacyRetry = await call(() => api.sendAdminResult(adminRequest(legacy.id), legacy.id));
  check(legacyRetry.status === 409 && legacyRetry.data.error.code === 'PROVIDER_CONFIRMATION_REQUIRED'
    && providerCalls === beforeLegacyRetry, 'uncertain legacy plaintext attempt never silently resends changed PDF payload');
  const crossOriginAdmin = await call(() => api.sendAdminResult(adminRequest(legacy.id, 'https://other.example.test'), legacy.id));
  check(crossOriginAdmin.status === 403, 'authorized admin still requires same-origin send');
  const listed = await call(() => api.listAdminRecords(new Request(`${origin}/api/admin/records`)));
  check(listed.status === 200 && listed.data.records.every((item) => !Object.hasOwn(item, 'resultDocument') && !Object.hasOwn(item, 'requestFingerprint') && !Object.hasOwn(item, 'contact')),
    'masked admin list excludes report, fingerprint and contact');
  memory.prepare('UPDATE reading_requests SET expires_at=? WHERE id=?').run(Date.now() - 1, row.id);
  await api.purgeExpired();
  check(!memory.prepare('SELECT id FROM reading_requests WHERE id=?').get(row.id), 'retention purge deletes full report and contact together');
  check(memory.prepare('SELECT key FROM request_rate_limits').all().every((item) => /^[a-f0-9]{64}$/.test(item.key)), 'rate-limit stores hashes, not raw IP');
  console.log(`PASS ${checks} isolated PDF-email backend checks. In-memory synthetic records; mocked fonts/rendering/provider; zero actual HTTP, production DB mutations or emails.`);
} finally {
  globalThis.fetch = originalFetch; delete globalThis.__pdfMailEnv; delete globalThis.__pdfMailUser; delete globalThis.__lastPdfDocument; memory.close();
}
