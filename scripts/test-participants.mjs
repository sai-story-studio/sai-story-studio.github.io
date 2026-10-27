// Synthetic HTTP checks only. Refuses remote hosts; never sends any messages.
// Start the local Vinext server and apply local migration 0001 first.
// PARTICIPANTS_TEST_BASE=http://127.0.0.1:5173
// PARTICIPANTS_TEST_MODE=disabled (default) or enabled.
// Enabled local env: PARTICIPANTS_COLLECTION_ENABLED=true, COLLECTION_ENABLED=false,
// valid OPERATOR_NAME, CONTACT_EMAIL=operator@example.test, RETENTION_DAYS=1,
// MEETUP_DESCRIPTION=synthetic general meetup, ADMIN_EMAILS=seedy@sites.test.
// RATE_LIMIT_SECRET is recommended. Leave all sender credentials absent.
// The local starter mock cookie only works with an explicit local allowlist.

const base = new URL(process.env.PARTICIPANTS_TEST_BASE ?? "http://127.0.0.1:5173");
const mode = process.env.PARTICIPANTS_TEST_MODE ?? "disabled";
if (base.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)
  || base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
  throw new Error("PARTICIPANTS_TEST_BASE must be a plain HTTP loopback origin.");
}
if (!["disabled", "enabled"].includes(mode)) throw new Error("Invalid PARTICIPANTS_TEST_MODE.");
let checks = 0;
const createdIds = new Set();
const synthetic = { name: "=1+1", phone: "010-0000-0000", topic: "mbti", storeBirthData: false,
  collectionConsent: true, ageConfirm14: true, consentVersion: "participants-v1" };
function check(condition, label) {
  if (!condition) throw new Error(`Check failed: ${label}`);
  checks += 1;
}
async function call(path, { method = "GET", payload, raw, admin = false, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (admin) requestHeaders.Cookie = "__sites_local_auth=1";
  if (method !== "GET") {
    if (!Object.hasOwn(requestHeaders, "Origin")) requestHeaders.Origin = base.origin;
    if (!Object.hasOwn(requestHeaders, "Content-Type")) requestHeaders["Content-Type"] = "application/json";
  }
  const response = await fetch(new URL(path, base), { method, headers: requestHeaders, redirect: "error",
    signal: AbortSignal.timeout(15000), ...(raw !== undefined ? { body: raw }
      : payload !== undefined ? { body: JSON.stringify(payload) } : {}) });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  const data = response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : text;
  return { response, data, bytes };
}
async function expectError(label, options, status, code, frameworkOrigin = false) {
  const result = await call("/api/participants", { method: "POST", ...options });
  check(result.response.status === status, `${label} status`);
  // Vinext's dev-origin guard rejects external/opaque origins before routing.
  // Only accept its exact plain-text 403 boundary for those specific tests.
  if (frameworkOrigin && result.data === "Forbidden"
    && result.response.headers.get("content-type")?.startsWith("text/plain")) {
    check(!result.response.headers.has("access-control-allow-origin"), `${label} blocked by framework`);
    return;
  }
  check(result.data?.error?.code === code, `${label} error code`);
  check(result.response.headers.get("cache-control")?.includes("no-store"), `${label} no-store`);
}
async function cleanup() {
  for (const id of createdIds) {
    try {
      const deleted = await call(`/api/admin/participants/${id}`, { method: "DELETE", admin: true });
      if (deleted.response.status === 200) createdIds.delete(id);
    } catch { /* Never print or persist record contents, even on failure. */ }
  }
}
try {
  const config = await call("/api/participants/config");
  check(config.response.status === 200, "participant config available");
  check(config.response.headers.get("cache-control")?.includes("no-store"), "config no-store");
  check(config.data.collectionEnabled === (mode === "enabled"), "independent participant gate");
  check(config.data.consentVersion === "participants-v1" && config.data.automaticSending === false,
    "explicit participant consent, no automatic sending");
  check(typeof config.data.purpose === "string" && config.data.minimumAge === 14, "purpose and minimum age");
  check(!Object.hasOwn(config.data, "ADMIN_EMAILS") && !Object.hasOwn(config.data, "user")
    && !Object.hasOwn(config.data, "RATE_LIMIT_SECRET"), "config has no secrets or user identity");
  const alias = await call("/api/participants");
  check(alias.data.collectionEnabled === config.data.collectionEnabled, "GET alias consistent");
  const legacy = await call("/api/config");
  check(legacy.data.collectionEnabled === false, "participant flag never enables legacy result collection");
  check(legacy.data.deliveryConfigured?.email === false && legacy.data.deliveryConfigured?.sms === false,
    "no configured sender in synthetic test");
  for (const path of ["/api/admin/participants", "/api/admin/participants/export"]) {
    const anonymous = await call(path);
    check(anonymous.response.status === 403, "anonymous admin access denied");
    check(anonymous.response.headers.get("cache-control")?.includes("no-store"), "admin response no-store");
  }
  const fakeId = "00000000-0000-4000-8000-000000000000";
  const anonymousDelete = await call(`/api/admin/participants/${fakeId}`, { method: "DELETE" });
  check(anonymousDelete.response.status === 403, "anonymous deletion denied");
  const forged = await call("/api/admin/participants", { headers: {
    "oai-authenticated-user-id": "forged", "oai-authenticated-user-email": "seedy@sites.test" } });
  check(forged.response.status === 403, "forged identity headers denied");
  await expectError("external origin", { payload: synthetic, headers: { Origin: "https://other.example.test" } }, 403, "ORIGIN_REQUIRED", true);
  await expectError("opaque origin", { payload: synthetic, headers: { Origin: "null" } }, 403, "ORIGIN_REQUIRED", true);
  const anotherPort = new URL(base);
  anotherPort.port = String(Number(base.port || 80) === 65535 ? 65534 : Number(base.port || 80) + 1);
  await expectError("different local port", { payload: synthetic, headers: { Origin: anotherPort.origin } }, 403, "ORIGIN_REQUIRED");
  await expectError("missing origin", { payload: synthetic, headers: { Origin: "" } }, 403, "ORIGIN_REQUIRED");

  if (mode === "disabled") {
    await expectError("disabled collection", { payload: synthetic }, 503, "PARTICIPANTS_DISABLED");
  } else {
    check(typeof config.data.operatorName === "string" && typeof config.data.contactEmail === "string"
      && Number.isInteger(config.data.retentionDays) && Boolean(config.data.meetupDescription), "complete legal configuration");
    const initial = await call("/api/admin/participants", { admin: true });
    check(initial.response.status === 200 && initial.data.personalDataIncluded === false, "allowlisted admin, masked default");
    const initialTotal = initial.data.summary.total;
    const invalid = [
      ["blank name", { ...synthetic, name: " " }, "INVALID_PARTICIPANT"],
      ["long name", { ...synthetic, name: "가".repeat(31) }, "INVALID_PARTICIPANT"],
      ["control name", { ...synthetic, name: "a\nb" }, "INVALID_PARTICIPANT"],
      ["missing consent", { ...synthetic, collectionConsent: undefined }, "INVALID_PARTICIPANT"],
      ["false consent", { ...synthetic, collectionConsent: false }, "INVALID_PARTICIPANT"],
      ["missing age", { ...synthetic, ageConfirm14: undefined }, "INVALID_PARTICIPANT"],
      ["stale consent", { ...synthetic, consentVersion: "old" }, "INVALID_PARTICIPANT"],
      ["unknown suitability field", { ...synthetic, suitability: true }, "INVALID_PARTICIPANT"],
      ["wrong topic", { ...synthetic, topic: "unknown" }, "INVALID_PARTICIPANT"],
      ["invalid phone", { ...synthetic, phone: "010<script>" }, "INVALID_PHONE"],
      ["nonmobile phone", { ...synthetic, phone: "0212345678" }, "INVALID_PHONE"],
      ["birth without separate consent", { ...synthetic, birthDate: "2000-01-01" }, "BIRTH_STORAGE_CONSENT_REQUIRED"],
      ["birth missing", { ...synthetic, storeBirthData: true }, "INVALID_BIRTH_DATE"],
      ["invalid calendar", { ...synthetic, storeBirthData: true, birthDate: "2001-02-29" }, "INVALID_BIRTH_DATE"],
      ["future birth", { ...synthetic, storeBirthData: true, birthDate: "2999-01-01" }, "INVALID_BIRTH_DATE"],
      ["under age", { ...synthetic, storeBirthData: true, birthDate: new Date().toISOString().slice(0, 10) }, "MINIMUM_AGE_REQUIRED"],
    ];
    for (const [label, payload, code] of invalid) await expectError(label, { payload }, 400, code);
    await expectError("malformed JSON", { raw: "{" }, 400, "INVALID_JSON");
    await expectError("body size", { raw: "x".repeat(24577) }, 413, "REQUEST_TOO_LARGE");
    await expectError("wrong media", { payload: synthetic, headers: { "Content-Type": "text/plain" } }, 415, "JSON_REQUIRED");
    const created = await call("/api/participants", { method: "POST", payload: synthetic });
    check(created.response.status === 201 && typeof created.data.id === "string", "one synthetic registration stored");
    createdIds.add(created.data.id);
    check(created.data.status === "registered" && !Object.hasOwn(created.data, "phone"), "receipt does not pretend sent or echo phone");
    const masked = await call("/api/admin/participants?limit=100", { admin: true });
    const maskedRow = masked.data.records?.find((row) => row.id === created.data.id);
    check(masked.data.summary.total === initialTotal + 1, "summary counts real stored rows");
    check(Boolean(maskedRow?.nameMasked) && Boolean(maskedRow?.phoneMasked)
      && !Object.hasOwn(maskedRow, "name") && !Object.hasOwn(maskedRow, "phone")
      && !Object.hasOwn(maskedRow, "birthDate"), "default list masks personal data");
    const revealed = await call("/api/admin/participants?includePersonal=true&limit=100", { admin: true });
    const row = revealed.data.records?.find((record) => record.id === created.data.id);
    check(row?.name === synthetic.name && row.phone === "01000000000" && row.topic === "mbti", "explicit reveal and phone normalization");
    check(row?.birthDate === null && row.birthConsentAt === null && row.storeBirthData === false, "birth data not stored without consent");
    check(row?.consentPurpose === config.data.purpose && row.meetupDescription === config.data.meetupDescription
      && row.consentVersion === "participants-v1", "purpose and consent snapshot persisted");
    check(new Date(row.expiresAt).getTime() - new Date(row.createdAt).getTime()
      === config.data.retentionDays * 86400000, "expiration follows configured retention");
    const exported = await call("/api/admin/participants/export", { admin: true });
    check(exported.response.status === 200 && exported.response.headers.get("content-type")?.startsWith("text/csv"), "authorized CSV export");
    check(exported.bytes[0] === 0xef && exported.bytes[1] === 0xbb && exported.bytes[2] === 0xbf, "CSV BOM");
    check(exported.data.includes('"\'=1+1"') && exported.data.includes("01000000000"), "CSV formula neutralization");
    check(exported.response.headers.get("cache-control")?.includes("no-store"), "CSV not cached");
    const invalidPage = await call("/api/admin/participants?limit=101", { admin: true });
    check(invalidPage.response.status === 400 && invalidPage.data.error?.code === "INVALID_PAGINATION", "bounded pagination");
    const otherOriginDelete = await call(`/api/admin/participants/${created.data.id}`, { method: "DELETE", admin: true,
      headers: { Origin: anotherPort.origin } });
    check(otherOriginDelete.response.status === 403, "delete requires same origin after authentication");
    const deleted = await call(`/api/admin/participants/${created.data.id}`, { method: "DELETE", admin: true });
    check(deleted.response.status === 200 && deleted.data.deleted === true, "synthetic record deleted");
    createdIds.delete(created.data.id);
    const after = await call("/api/admin/participants?limit=100", { admin: true });
    check(after.data.summary.total === initialTotal && !after.data.records.some((record) => record.id === created.data.id), "deletion read back, counts restored");
  }
  console.log(JSON.stringify({ status: "PASS", mode, checks, providerCalls: 0, realPersonalData: 0, syntheticRecordsRemaining: createdIds.size }));
} catch (error) {
  await cleanup();
  console.error(JSON.stringify({ status: "FAIL", mode, checks,
    reason: error instanceof Error ? error.message : "unknown", syntheticRecordsRemaining: createdIds.size }));
  process.exitCode = 1;
}
