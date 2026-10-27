import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PAGES_ORIGIN, isAllowedPublicOrigin, publicEndpoint, publicPreflight } from '../lib/public-origin.ts';
import { PUBLIC_API_ORIGIN, resolvePublicApiRequest, publicApiFetch } from '../public/experience/api-client.js';

const backend = 'https://sai-story-studio-20261022.youngjaetag.chatgpt.site';
let checks = 0;
const check = (fn) => { fn(); checks++; };
function req(path = '/api/participants', method = 'POST', origin = PAGES_ORIGIN, headers = {}) {
  return new Request(`${backend}${path}`, { method, headers: { ...(origin === undefined ? {} : { Origin: origin }), ...headers } });
}

check(() => assert.equal(PUBLIC_API_ORIGIN, backend));
for (const [path, method] of [['/api/config','GET'], ['/api/participants/config','GET'], ['/api/participants','POST'], ['/api/requests','POST']]) {
  let called = false;
  const response = await publicEndpoint(req(path, method), async () => { called = true; return Response.json({ status: 'synthetic' }, { headers: { 'Cache-Control': 'no-store, private' } }); });
  check(() => {
    assert.equal(called, true); assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), PAGES_ORIGIN);
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
    assert.match(response.headers.get('Vary'), /Origin/); assert.match(response.headers.get('Cache-Control'), /no-store/);
  });
  const resolved = resolvePublicApiRequest(path, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' } }, PAGES_ORIGIN);
  check(() => { assert.equal(resolved.url, `${backend}${path}`); assert.equal(resolved.options.credentials, 'omit'); assert.equal(resolved.options.mode, 'cors'); assert.equal(resolved.options.redirect, 'error'); });
  const preflight = publicPreflight(req(path, 'OPTIONS', PAGES_ORIGIN, { 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': 'content-type' }));
  check(() => { assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), PAGES_ORIGIN); assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'), null); });
}

for (const origin of ['https://other.example.test', 'https://sai-story-studio.github.io.evil.test', 'http://sai-story-studio.github.io', 'null', '']) {
  let called = false;
  const request = req('/api/participants', 'POST', origin);
  check(() => assert.equal(isAllowedPublicOrigin(request), false));
  if (!origin) continue; // Service validator rejects missing Origin; GET config may omit it.
  const response = await publicEndpoint(request, async () => { called = true; return new Response('never'); });
  check(() => { assert.equal(called, false); assert.equal(response.status, 403); assert.equal(response.headers.get('Access-Control-Allow-Origin'), null); });
}
check(() => assert.equal(isAllowedPublicOrigin(req('/api/participants', 'POST', backend)), true));
const sameSite = await publicEndpoint(req('/api/config', 'GET', backend), async () => new Response('same site'));
check(() => { assert.equal(sameSite.status, 200); assert.equal(sameSite.headers.get('Access-Control-Allow-Origin'), null); });
const errorResponse = await publicEndpoint(req('/api/requests'), async () => Response.json({ error: { code: 'SYNTHETIC' } }, { status: 503 }));
check(() => { assert.equal(errorResponse.status, 503); assert.equal(errorResponse.headers.get('Access-Control-Allow-Origin'), PAGES_ORIGIN); });

for (const [path, method] of [['/api/admin/participants','GET'], ['/api/admin/requests','GET'], ['/api/operators','POST'], ['/api/participants','GET'], ['/api/participants','DELETE'], ['/api/requests?admin=1','POST'], ['https://evil.test/api/requests','POST']]) {
  check(() => assert.throws(() => resolvePublicApiRequest(path, { method }, PAGES_ORIGIN)));
  const response = publicPreflight(req(path, 'OPTIONS', PAGES_ORIGIN, { 'Access-Control-Request-Method': method }));
  if (path.startsWith('/api/admin') || path === '/api/operators' || method === 'DELETE' || method === 'GET') check(() => assert.equal(response.status, 403));
}
for (const name of ['Authorization', 'Cookie', 'oai-authenticated-user-id', 'oai-authenticated-user-email', 'X-Anything']) {
  check(() => assert.throws(() => resolvePublicApiRequest('/api/requests', { method: 'POST', headers: { [name]: 'synthetic' } }, PAGES_ORIGIN)));
  check(() => assert.equal(publicPreflight(req('/api/requests', 'OPTIONS', PAGES_ORIGIN, { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': name })).status, 403));
}
const localRequest = resolvePublicApiRequest('/api/participants', { method: 'POST', credentials: 'include' }, 'http://127.0.0.1:5173');
check(() => { assert.equal(localRequest.url, '/api/participants'); assert.equal(localRequest.options.credentials, 'same-origin'); });

const oldFetch = globalThis.fetch;
const oldLocation = globalThis.location;
let transport;
globalThis.location = { origin: PAGES_ORIGIN };
globalThis.fetch = async (url, options) => { transport = { url, options }; return new Response('synthetic'); };
try { await publicApiFetch('/api/config'); check(() => { assert.equal(transport.url, `${backend}/api/config`); assert.equal(transport.options.credentials, 'omit'); }); }
finally { globalThis.fetch = oldFetch; if (oldLocation === undefined) delete globalThis.location; else globalThis.location = oldLocation; }

const service = fs.readFileSync('lib/service.ts','utf8');
const participants = fs.readFileSync('lib/participants.ts','utf8');
check(() => assert.match(service, /function requireSameOrigin[\s\S]*?origin !== new URL\(request.url\).origin/));
check(() => assert.match(service, /function createRequest\([^]*?requirePublicOrigin\(request\)/));
check(() => assert.match(participants, /function createParticipant\([^]*?requirePublicOrigin\(request\)/));
for (const file of ['lib/operators.ts', 'app/api/admin/participants/route.ts', 'app/api/admin/records/route.ts']) {
  const source = fs.readFileSync(file, 'utf8');
  check(() => assert.doesNotMatch(source, /publicEndpoint|publicPreflight|requirePublicOrigin/));
}
console.log(`PASS ${checks} Pages public API bridge checks. Mocked requests only; no database writes or messages.`);
