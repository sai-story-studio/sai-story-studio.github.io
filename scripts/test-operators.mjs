// Isolated authorization/SQL tests. Only :memory: SQLite and synthetic identities
// are used. No HTTP server, local environment file, real DB, or network is read.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const memory = new DatabaseSync(':memory:');
memory.exec(await readFile(new URL('../drizzle/0002_site-operators.sql', import.meta.url), 'utf8'));
class Statement {
  constructor(db, query, values = []) { this.db = db; this.query = query; this.values = values; }
  bind(...values) { return new Statement(this.db, this.query, values); }
  async first(column) { const row = this.db.prepare(this.query).get(...this.values); return column ? row?.[column] ?? null : row ?? null; }
  async all() { return { success: true, results: this.db.prepare(this.query).all(...this.values), meta: {} }; }
  async raw() { const statement = this.db.prepare(this.query); statement.setReturnArrays(true); return statement.all(...this.values); }
  async run() { this.db.prepare(this.query).run(...this.values); return { success: true, results: [], meta: {} }; }
}
const binding = { prepare: (query) => new Statement(memory, query) };
const testEnv = { OWNER_EMAIL: 'owner@example.test', ADMIN_EMAILS: 'owner@example.test; permanent@example.test', DB: binding };
globalThis.__operatorTestEnv = testEnv;
globalThis.__operatorTestUser = null;
const bundled = await build({
  stdin: { contents: 'export * from "./lib/operators"; export { requireAdmin, apiRoute } from "./lib/service"; export * from "./lib/operator-policy";', resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'node22',
  plugins: [{ name: 'isolated-test-bindings', setup(builder) {
    builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'environment', namespace: 'operator-test' }));
    builder.onResolve({ filter: /^@\/app\/chatgpt-auth$/ }, () => ({ path: 'identity', namespace: 'operator-test' }));
    builder.onLoad({ filter: /.*/, namespace: 'operator-test' }, ({ path }) => ({
      contents: path === 'environment' ? 'export const env = globalThis.__operatorTestEnv;' : 'export async function getChatGPTUser() { return globalThis.__operatorTestUser; }',
      loader: 'js',
    }));
  } }],
});
const module = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks += 1; };
const identity = (email) => { globalThis.__operatorTestUser = email ? { userId: `synthetic:${email}`, email, displayName: 'Synthetic operator', fullName: null } : null; };
const request = (method, payload, { origin = 'https://operators.example.test', type = 'application/json', raw } = {}) => new Request('https://operators.example.test/api/admin/operators', {
  method, headers: { Origin: origin, 'Content-Type': type }, ...(method === 'POST' ? { body: raw ?? JSON.stringify(payload) } : {}),
});
async function call(action) { const response = await module.apiRoute(action); const data = await response.json(); check(response.headers.get('cache-control')?.includes('no-store'), 'all responses are no-store'); return { status: response.status, data }; }
async function error(action, expected, code) { const result = await call(action); assert.equal(result.status, expected); assert.equal(result.data.error?.code, code); checks += 1; }

try {
  assert.equal(module.normalizeOperatorEmail('  New.Operator@Example.Test  '), 'new.operator@example.test');
  assert.deepEqual(module.permanentAdminEmails('A@example.test;a@example.test\nb@example.test'), ['a@example.test', 'b@example.test']);
  assert.deepEqual(module.permanentAdminEmails('a@example.test,not-an-email'), []);
  for (const email of ['', 'not-email', 'a@example.test\r\n', 'a@', 'a b@example.test']) assert.equal(module.normalizeOperatorEmail(email), null);
  check(!module.operatorPayloadSchema.safeParse({ email: 'a@example.test', owner: true }).success, 'extra permission fields rejected');

  identity(null);
  await error(module.listOperators, 403, 'OWNER_REQUIRED');
  await assert.rejects(module.requireAdmin, /허용된 관리자/);
  identity('permanent@example.test');
  await module.requireAdmin(); checks += 1;
  await error(module.listOperators, 403, 'OWNER_REQUIRED');
  await error(() => module.addOperator(request('POST', { email: 'fake@example.test' })), 403, 'OWNER_REQUIRED');
  await error(() => module.removeOperator(request('DELETE'), '00000000-0000-4000-8000-000000000001'), 403, 'OWNER_REQUIRED');

  identity('OWNER@EXAMPLE.TEST');
  await module.requireAdmin(); checks += 1;
  const initial = await call(module.listOperators);
  assert.equal(initial.status, 200);
  assert.equal(initial.data.counts.database, 0);
  check(!JSON.stringify(initial.data).includes('owner@example.test'), 'owner email is not returned');
  check(initial.data.operators.some((operator) => operator.email === 'permanent@example.test' && !operator.removable), 'permanent administrator cannot be removed');
  await error(() => module.addOperator(request('POST', { email: 'a@example.test' }, { origin: 'https://elsewhere.example.test' })), 403, 'ORIGIN_REQUIRED');
  await error(() => module.addOperator(request('POST', { email: 'a@example.test' }, { type: 'text/plain' })), 415, 'JSON_REQUIRED');
  await error(() => module.addOperator(request('POST', null, { raw: '{' })), 400, 'INVALID_JSON');
  await error(() => module.addOperator(request('POST', { email: 'invalid' })), 400, 'INVALID_OPERATOR_EMAIL');
  await error(() => module.addOperator(request('POST', { email: 'a@example.test', role: 'owner' })), 400, 'INVALID_OPERATOR_EMAIL');
  await error(() => module.addOperator(request('POST', { email: 'owner@example.test' })), 409, 'OPERATOR_ALREADY_PERMANENT');
  await error(() => module.addOperator(request('POST', { email: 'PERMANENT@EXAMPLE.TEST' })), 409, 'OPERATOR_ALREADY_PERMANENT');
  await error(() => module.addOperator(request('POST', { email: 'a'.repeat(25 * 1024) })), 413, 'REQUEST_TOO_LARGE');

  const added = await call(() => module.addOperator(request('POST', { email: '  Operator.One@Example.Test  ' })));
  assert.equal(added.status, 201);
  const operatorId = added.data.id;
  assert.equal(memory.prepare('SELECT email FROM site_operators WHERE id = ?').get(operatorId).email, 'operator.one@example.test');
  await error(() => module.addOperator(request('POST', { email: 'OPERATOR.ONE@EXAMPLE.TEST' })), 409, 'OPERATOR_EXISTS');
  identity('operator.one@example.test');
  await module.requireAdmin(); checks += 1;
  await error(module.listOperators, 403, 'OWNER_REQUIRED');
  identity('owner@example.test');
  await error(() => module.removeOperator(request('DELETE', null, { origin: 'https://elsewhere.example.test' }), operatorId), 403, 'ORIGIN_REQUIRED');
  await error(() => module.removeOperator(request('DELETE'), 'invalid-id'), 400, 'INVALID_OPERATOR_ID');

  const ownerRow = '00000000-0000-4000-8000-000000000002';
  const fixedRow = '00000000-0000-4000-8000-000000000003';
  memory.prepare('INSERT INTO site_operators VALUES (?, ?, ?, ?)').run(ownerRow, 'owner@example.test', 'synthetic-owner', 1);
  memory.prepare('INSERT INTO site_operators VALUES (?, ?, ?, ?)').run(fixedRow, 'permanent@example.test', 'synthetic-owner', 1);
  await error(() => module.removeOperator(request('DELETE'), ownerRow), 403, 'OWNER_REMOVAL_FORBIDDEN');
  await error(() => module.removeOperator(request('DELETE'), fixedRow), 409, 'OPERATOR_MANAGED_BY_ENV');
  memory.prepare('DELETE FROM site_operators WHERE id IN (?, ?)').run(ownerRow, fixedRow);
  const removed = await call(() => module.removeOperator(request('DELETE'), operatorId));
  assert.equal(removed.status, 200);
  identity('operator.one@example.test');
  await assert.rejects(module.requireAdmin, /허용된 관리자/); checks += 1;

  identity('owner@example.test');
  const racing = await Promise.all(Array.from({ length: 40 }, (_, index) => call(() => module.addOperator(request('POST', { email: `synthetic-${index}@example.test` })))));
  assert.equal(racing.filter((result) => result.status === 201).length, 20);
  assert.equal(racing.filter((result) => result.status === 409 && result.data.error?.code === 'OPERATOR_LIMIT_REACHED').length, 20);
  assert.equal(memory.prepare('SELECT count(*) AS count FROM site_operators').get().count, 20);
  checks += 1;

  testEnv.DB = undefined;
  identity('owner@example.test'); await module.requireAdmin();
  identity('permanent@example.test'); await module.requireAdmin();
  identity('synthetic-0@example.test'); await assert.rejects(module.requireAdmin, /허용된 관리자/); checks += 1;
  testEnv.OWNER_EMAIL = undefined;
  identity('permanent@example.test'); await module.requireAdmin();
  await error(module.listOperators, 403, 'OWNER_NOT_CONFIGURED');
  console.log(`PASS ${checks} isolated checks: owner/static/DB roles, management restrictions, no owner-email response, normalization/duplicates, same-origin/JSON, self/permanent removal, immediate revocation, atomic 20-row limit, fail-closed DB loss. In-memory synthetic data only.`);
} finally {
  delete globalThis.__operatorTestEnv; delete globalThis.__operatorTestUser; memory.close();
}
