// Loopback-only, sender-unconfigured HTTP boundary checks. This script never
// creates a contact record or sends mail. Full enabled-path behavior uses
// test-pdf-email-backend.mjs with in-memory SQLite and a mocked provider.
const base = new URL(process.env.API_TEST_BASE ?? 'http://127.0.0.1:3000');
if (base.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
  || base.username || base.password || !['/', ''].includes(base.pathname)) throw new Error('Loopback origin required.');
const mode = process.env.API_TEST_MODE ?? 'disabled';
if (!['disabled', 'enabled'].includes(mode)) throw new Error('API_TEST_MODE must be disabled or enabled.');
const checks = [];
const check = (condition, name) => { if (!condition) throw new Error(`Check failed: ${name}`); checks.push(name); };
async function call(path, { method = 'GET', origin = base.origin, payload } = {}) {
  const response = await fetch(new URL(path, base), { method, redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: method === 'GET' ? {} : { Origin: origin, 'Content-Type': 'application/json' },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text();
  return { response, data };
}
const synthetic = { mode: 'zodiac', storeBirthData: false, channel: 'email', contact: 'synthetic@example.test',
  requestKey: '00000000-0000-4000-8000-000000000001',
  result: { type: 'INFP', title: '합성 결과', summary: '가상 테스트 결과', basis: ['가상 근거'] },
  document: { version: 1, mode: 'zodiac', title: '합성 결과', subtitle: '', summary: [], sections: [], notes: [] },
  resultConsent: true, ageConfirm14: true, consentVersion: '2026-10-23-result-pdf-v2' };
const config = await call('/api/config');
check(config.response.status === 200, 'config responds');
check(config.response.headers.get('cache-control')?.includes('no-store'), 'config private cache');
check(config.data.collectionEnabled === (mode === 'enabled'), 'explicit collection gate');
check(config.data.consentVersion === synthetic.consentVersion && config.data.purposes.result.includes('PDF'), 'current PDF scope/version');
check(config.data.deliveryConfigured?.email === false && config.data.deliveryConfigured?.sms === false,
  'real sender must remain absent during HTTP test');
check(!['ADMIN_EMAILS', 'RESEND_API_KEY', 'MAIL_FROM', 'userId', 'user'].some((key) => Object.hasOwn(config.data, key)), 'config does not expose secrets/identity');
for (const path of ['/api/admin/records', '/api/admin/export']) {
  const result = await call(path);
  check(result.response.status === 403, `anonymous ${path} denied`);
  check(result.response.headers.get('cache-control')?.includes('no-store'), 'denial no-store');
}
for (const origin of ['', 'null', 'https://other.example.test']) {
  const result = await call('/api/requests', { method: 'POST', origin, payload: synthetic });
  check(result.response.status === 403, 'untrusted origin denied');
  check(result.data?.error?.code === 'ORIGIN_REQUIRED' || result.data === 'Forbidden', 'framework or service origin guard');
}
const notStored = await call('/api/requests', { method: 'POST', payload: synthetic });
check(notStored.response.status === 503 && notStored.data.error?.code === (mode === 'enabled' ? 'SENDER_NOT_CONFIGURED' : 'COLLECTION_DISABLED'),
  'unconfigured email never stores contact or pretends sent');
check(notStored.response.headers.get('cache-control')?.includes('no-store'), 'refusal no-store');
console.log(JSON.stringify({ status: 'PASS', mode, checks: checks.length, providerCalls: 0,
  createdContactRecords: 0, realPersonalData: 0 }));
