// Synthetic local HTTP authorization checks only. Never target a deployed site.
// Apply local migration 0002 first. The unchanged Sites starter supplies only
// seedy@sites.test when __sites_local_auth=1; forged identity headers are stripped.
// OPERATORS_TEST_MODE=owner: OWNER_EMAIL=seedy@sites.test. Adds one unique
// example.test operator and deletes only that exact record in finally.
// OPERATORS_TEST_MODE=operator: OWNER_EMAIL=other-owner@example.test with seedy
// in ADMIN_EMAILS (or explicitly seeded as a local DB operator by the harness).
// OPERATORS_TEST_MODE=denied: seedy is neither owner, ADMIN_EMAILS, nor DB operator.
// This script never sends email/SMS or writes participant/result records.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = new URL(process.env.OPERATORS_TEST_BASE ?? 'http://127.0.0.1:5173');
const mode = process.env.OPERATORS_TEST_MODE ?? 'denied';
if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)
  || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
  throw new Error('OPERATORS_TEST_BASE must be a plain HTTP loopback origin.');
}
if (!['owner', 'operator', 'denied'].includes(mode)) throw new Error('Invalid OPERATORS_TEST_MODE.');
const created = new Set();
const syntheticEmail = `operator-http-${randomUUID()}@example.test`;
const missingId = '00000000-0000-4000-8000-000000000000';
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks += 1; };
async function call(path, { method = 'GET', payload, raw, auth = false, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (auth) requestHeaders.Cookie = '__sites_local_auth=1';
  if (method !== 'GET') {
    if (!Object.hasOwn(requestHeaders, 'Origin')) requestHeaders.Origin = base.origin;
    if (!Object.hasOwn(requestHeaders, 'Content-Type')) requestHeaders['Content-Type'] = 'application/json';
  }
  const response = await fetch(new URL(path, base), { method, headers: requestHeaders,
    redirect: 'error', signal: AbortSignal.timeout(15000),
    ...(raw !== undefined ? { body: raw } : payload !== undefined ? { body: JSON.stringify(payload) } : {}) });
  const text = await response.text();
  const data = response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : text;
  return { response, data };
}
async function expectError(label, path, options, status, code, frameworkOrigin = false) {
  const result = await call(path, options);
  assert.equal(result.response.status, status, `${label} status`); checks += 1;
  if (frameworkOrigin && result.data === 'Forbidden'
    && result.response.headers.get('content-type')?.startsWith('text/plain')) {
    check(!result.response.headers.has('access-control-allow-origin'), `${label} framework origin guard`);
    return;
  }
  assert.equal(result.data?.error?.code, code, `${label} code`); checks += 1;
  check(result.response.headers.get('cache-control')?.includes('no-store'), `${label} no-store`);
}
async function cleanup() {
  // Recover this run's exact unique fixture after an ambiguous local response.
  // Never delete unrelated rows, even if the server has other test records.
  if (mode === 'owner') {
    try {
      const listed = await call('/api/admin/operators', { auth: true });
      if (listed.response.status === 200 && Array.isArray(listed.data.operators)) {
        for (const row of listed.data.operators) {
          if (row.email === syntheticEmail && typeof row.id === 'string' && /^[0-9a-f-]{36}$/i.test(row.id)) created.add(row.id);
        }
      }
    } catch { /* Only known exact UUIDs are eligible for deletion below. */ }
  }
  for (const id of created) {
    try {
      const result = await call(`/api/admin/operators/${id}`, { method: 'DELETE', auth: true });
      if (result.response.status === 200 && result.data.removed === true) created.delete(id);
    } catch { /* No contact content is printed or persisted on failure. */ }
  }
}
try {
  await expectError('anonymous list', '/api/admin/operators', {}, 403, 'OWNER_REQUIRED');
  await expectError('anonymous add', '/api/admin/operators', { method: 'POST', payload: { email: syntheticEmail } }, 403, 'OWNER_REQUIRED');
  await expectError('anonymous remove', `/api/admin/operators/${missingId}`, { method: 'DELETE' }, 403, 'OWNER_REQUIRED');
  await expectError('forged header list', '/api/admin/operators', { headers: {
    'oai-authenticated-user-id': 'synthetic-forged', 'oai-authenticated-user-email': 'seedy@sites.test',
  } }, 403, 'OWNER_REQUIRED');
  const list = await call('/api/admin/operators', { auth: true });
  check(list.response.headers.get('cache-control')?.includes('no-store'), 'authenticated list no-store');
  if (mode === 'owner') {
    assert.equal(list.response.status, 200); checks += 1;
    check(list.data.canManageOperators === true && list.data.maxDatabaseOperators === 20, 'owner management scope');
    check(!JSON.stringify(list.data).includes('seedy@sites.test'), 'owner address absent from response');
    const before = list.data.counts.database;
    check(Number.isSafeInteger(before) && before < 20, 'local test has spare capacity');
    await expectError('cross-origin add', '/api/admin/operators', { method: 'POST', auth: true,
      payload: { email: syntheticEmail }, headers: { Origin: 'https://other.example.test' } }, 403, 'ORIGIN_REQUIRED', true);
    await expectError('missing-origin add', '/api/admin/operators', { method: 'POST', auth: true,
      payload: { email: syntheticEmail }, headers: { Origin: '' } }, 403, 'ORIGIN_REQUIRED');
    await expectError('wrong content type', '/api/admin/operators', { method: 'POST', auth: true,
      raw: '{}', headers: { 'Content-Type': 'text/plain' } }, 415, 'JSON_REQUIRED');
    await expectError('malformed JSON', '/api/admin/operators', { method: 'POST', auth: true, raw: '{' }, 400, 'INVALID_JSON');
    await expectError('invalid address', '/api/admin/operators', { method: 'POST', auth: true,
      payload: { email: 'invalid' } }, 400, 'INVALID_OPERATOR_EMAIL');
    await expectError('extra permission field', '/api/admin/operators', { method: 'POST', auth: true,
      payload: { email: syntheticEmail, role: 'owner' } }, 400, 'INVALID_OPERATOR_EMAIL');
    await expectError('owner duplicate', '/api/admin/operators', { method: 'POST', auth: true,
      payload: { email: 'SEEDY@SITES.TEST' } }, 409, 'OPERATOR_ALREADY_PERMANENT');
    const added = await call('/api/admin/operators', { method: 'POST', auth: true,
      payload: { email: `  ${syntheticEmail.toUpperCase()}  ` } });
    // Track only this new UUID before any later assertion so failures clean it.
    if (added.response.status === 201 && typeof added.data.id === 'string') created.add(added.data.id);
    assert.equal(added.response.status, 201); checks += 1;
    check(added.data.added === true && /^[0-9a-f-]{36}$/i.test(added.data.id), 'owner can add unique synthetic operator');
    const after = await call('/api/admin/operators', { auth: true });
    check(after.data.counts.database === before + 1 && after.data.operators.some((row) =>
      row.id === added.data.id && row.email === syntheticEmail && row.source === 'database' && row.removable), 'normalized DB record listed');
    await expectError('normalized duplicate', '/api/admin/operators', { method: 'POST', auth: true,
      payload: { email: syntheticEmail } }, 409, 'OPERATOR_EXISTS');
    await expectError('cross-origin remove', `/api/admin/operators/${added.data.id}`, { method: 'DELETE', auth: true,
      headers: { Origin: 'https://other.example.test' } }, 403, 'ORIGIN_REQUIRED', true);
    const removed = await call(`/api/admin/operators/${added.data.id}`, { method: 'DELETE', auth: true });
    check(removed.response.status === 200 && removed.data.removed === true, 'owner can remove exact synthetic operator');
    if (removed.response.status === 200) created.delete(added.data.id);
    await expectError('already removed', `/api/admin/operators/${added.data.id}`, { method: 'DELETE', auth: true }, 404, 'OPERATOR_NOT_FOUND');
    const final = await call('/api/admin/operators', { auth: true });
    check(final.data.counts.database === before && !final.data.operators.some((row) => row.email === syntheticEmail), 'operator fixture cleaned');
  } else {
    check(list.response.status === 403 && list.data.error?.code === 'OWNER_REQUIRED', 'non-owner cannot list operators');
    await expectError('non-owner add', '/api/admin/operators', { method: 'POST', auth: true,
      payload: { email: syntheticEmail } }, 403, 'OWNER_REQUIRED');
    await expectError('non-owner remove', `/api/admin/operators/${missingId}`, { method: 'DELETE', auth: true }, 403, 'OWNER_REQUIRED');
  }
  for (const path of ['/api/admin/participants', '/api/admin/records']) {
    const result = await call(path, { auth: true });
    assert.equal(result.response.status, mode === 'denied' ? 403 : 200, `${mode} existing admin route`); checks += 1;
    check(result.response.headers.get('cache-control')?.includes('no-store'), 'existing admin no-store');
  }
  console.log(`PASS ${checks} loopback HTTP checks (${mode}): authenticated roles, owner management, safe responses and synthetic-only cleanup. No messages sent.`);
} finally {
  await cleanup();
  if (created.size) throw new Error('Synthetic local operator cleanup failed; use the owner API to remove the exact test UUID(s) before ending QA.');
}
