import { env } from "cloudflare:workers";
import { and, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { resolveAdminAccess } from "@/lib/access";
import { getDb } from "@/db";
import { readingRequests, requestRateLimits } from "@/db/schema";
import { validateReadingPdfDocument } from "@/public/experience/reading-pdf-document.js";
import { buildPdfEmail, sendPdfEmail } from "@/lib/pdf-mail";

export const CONSENT_VERSION = "2026-10-23-result-pdf-v2";
export const RESULT_PURPOSE = "요청한 성향 결과·상세 풀이 PDF의 저장 및 이메일 전달";
const MAX_BODY_BYTES = 24 * 1024;
const MAX_PDF_REQUEST_BYTES = 256 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const EMAIL = z.string().trim().max(254).email();
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const SINGLE_LINE_CONTROLS = /[\u0000-\u001f\u007f]/;
const SAFE_HEADERS = {
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export class ServiceError extends Error {
  constructor(public status: number, public code: string, message: string,
    public retryAfter?: number) {
    super(message);
  }
}

export function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: SAFE_HEADERS });
}

export async function apiRoute(action: () => Promise<Response>): Promise<Response> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ServiceError) {
      const response = jsonResponse({ error: { code: error.code, message: error.message } }, error.status);
      if (error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
      return response;
    }
    // Database/provider errors can contain contacts or credentials. Never echo or log them.
    return jsonResponse({ error: { code: "SERVICE_UNAVAILABLE", message: "지금은 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요." } }, 503);
  }
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null" || origin !== new URL(request.url).origin) {
    throw new ServiceError(403, "ORIGIN_REQUIRED", "같은 사이트에서 보낸 요청만 처리할 수 있습니다.");
  }
}

function getCollectionSettings() {
  const operatorName = env.OPERATOR_NAME?.trim() ?? "";
  const contact = EMAIL.safeParse(env.CONTACT_EMAIL ?? "");
  const retentionValue = env.RETENTION_DAYS ?? "";
  const retentionDays = /^\d{1,3}$/.test(retentionValue) ? Number(retentionValue) : 0;
  const valid = Boolean(env.DB) && operatorName.length > 0 && operatorName.length <= 120
    && !SINGLE_LINE_CONTROLS.test(operatorName) && contact.success
    && retentionDays >= 1 && retentionDays <= 365;
  return {
    enabled: env.COLLECTION_ENABLED === "true" && valid,
    valid,
    operatorName: valid ? operatorName : null,
    contactEmail: valid && contact.success ? contact.data : null,
    retentionDays: valid ? retentionDays : null,
  };
}

function senderSettings() {
  const key = env.RESEND_API_KEY?.trim() ?? "";
  const from = env.MAIL_FROM?.trim() ?? "";
  const mailbox = from.includes("<")
    ? /^[^<>\r\n]+<([^<>\s]+@[^<>\s]+)>$/.exec(from)?.[1]
    : from;
  const validFrom = from.length <= 320 && !SINGLE_LINE_CONTROLS.test(from)
    && Boolean(mailbox && EMAIL.safeParse(mailbox).success);
  return { enabled: key.length > 0 && validFrom, key, from };
}

function meetupSettings() {
  const description = env.MEETUP_DESCRIPTION?.trim() ?? "";
  const enabled = description.length > 0 && description.length <= 500 && !CONTROL_CHARACTERS.test(description);
  return {
    enabled,
    purpose: enabled ? `선택 동의 시에만 다음 일반 모임의 초대 연락: ${description}` : null,
  };
}

export async function purgeExpired(now = Date.now()): Promise<void> {
  if (!env.DB) return;
  const db = getDb();
  // Always execute, rather than only filtering expired data out of responses.
  await db.delete(readingRequests).where(lte(readingRequests.expiresAt, now));
  await db.delete(requestRateLimits).where(lte(requestRateLimits.expiresAt, now));
}

export async function publicConfig(): Promise<Response> {
  const settings = getCollectionSettings();
  const meetup = meetupSettings();
  let storageReady = Boolean(env.DB);
  try { await purgeExpired(); } catch { storageReady = false; }
  return jsonResponse({
    collectionEnabled: settings.enabled && storageReady,
    consentVersion: CONSENT_VERSION,
    operatorName: settings.operatorName,
    contactEmail: settings.contactEmail,
    retentionDays: settings.retentionDays,
    minimumAge: 14,
    purposes: { result: RESULT_PURPOSE, followup: meetup.purpose },
    followupEnabled: settings.enabled && storageReady && meetup.enabled,
    birthDataStorageOptional: true,
    deliveryConfigured: { email: senderSettings().enabled && Boolean(env.ASSETS), sms: false },
    disclaimer: "재미와 자기 탐색을 위한 해석이며 과학적 성격 검사·의학적 진단이 아닙니다.",
  });
}

const oneLine = (max: number) => z.string().trim().min(1).max(max)
  .refine((value) => !SINGLE_LINE_CONTROLS.test(value));
const longText = (max: number) => z.string().trim().min(1).max(max)
  .refine((value) => !CONTROL_CHARACTERS.test(value));

const requestSchema = z.object({
  mode: z.enum(["zodiac", "saju", "ziwei"]),
  nickname: z.string().trim().max(80).refine((value) => !SINGLE_LINE_CONTROLS.test(value)).optional(),
  storeBirthData: z.boolean(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  birthTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
  channel: z.enum(["email", "sms"]),
  contact: oneLine(254),
  result: z.object({
    type: z.string().regex(/^[IE][NS][FT][JP]$/),
    title: oneLine(160),
    summary: longText(2000),
    basis: z.array(oneLine(240)).min(1).max(8),
  }).strict(),
  requestKey: z.string().uuid(),
  document: z.unknown(),
  resultConsent: z.literal(true),
  followupConsent: z.boolean().optional().default(false),
  meetupTopics: z.array(z.enum(["mbti", "zodiac", "saju", "ziwei"])).max(4)
    .refine((topics) => new Set(topics).size === topics.length).optional().default([]),
  ageConfirm14: z.literal(true),
  consentVersion: z.literal(CONSENT_VERSION),
}).strict();

export type RequestPayload = z.infer<typeof requestSchema>;

export function validateRequestPayload(value: unknown, now = Date.now(), followupEnabled = false): RequestPayload {
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success) {
    throw new ServiceError(400, "INVALID_REQUEST", "입력 항목과 필수 동의, 동의서 버전을 확인해 주세요.");
  }
  const payload = parsed.data;
  if (payload.followupConsent && !followupEnabled) {
    throw new ServiceError(400, "FOLLOWUP_NOT_CONFIGURED", "일반 모임 설명이 설정되지 않아 초대 연락을 신청할 수 없습니다. 결과 전달만 신청할 수 있습니다.");
  }
  if (payload.followupConsent && payload.meetupTopics.length === 0) {
    throw new ServiceError(400, "MEETUP_TOPICS_REQUIRED", "초대받고 싶은 모임 주제를 한 개 이상 선택해 주세요.");
  }
  if (!payload.followupConsent && payload.meetupTopics.length > 0) {
    throw new ServiceError(400, "MEETUP_CONSENT_REQUIRED", "모임 관심 주제는 초대 연락에 별도로 동의한 경우에만 보낼 수 있습니다.");
  }
  if (!payload.storeBirthData && (payload.birthDate !== undefined || payload.birthTime !== undefined)) {
    throw new ServiceError(400, "BIRTH_STORAGE_CONSENT_REQUIRED", "생년월일·시간은 별도 저장 동의가 있을 때만 보낼 수 있습니다.");
  }
  if (payload.storeBirthData) {
    if (!payload.birthDate || !isRealBirthDate(payload.birthDate, now)) {
      throw new ServiceError(400, "INVALID_BIRTH_DATE", "1900년부터 오늘까지의 실제 양력 생년월일을 입력해 주세요.");
    }
    const today = new Date(now + 9 * HOUR_MS).toISOString().slice(0, 10);
    const fourteenthBirthday = `${Number(payload.birthDate.slice(0, 4)) + 14}${payload.birthDate.slice(4)}`;
    if (fourteenthBirthday > today) {
      throw new ServiceError(400, "MINIMUM_AGE_REQUIRED", "만 14세 이상만 결과 전달을 신청할 수 있습니다.");
    }
  }
  if (payload.channel === "email") {
    const email = EMAIL.safeParse(payload.contact);
    if (!email.success) throw new ServiceError(400, "INVALID_CONTACT", "받을 이메일 주소를 확인해 주세요.");
    payload.contact = email.data.toLowerCase();
  } else {
    const phone = payload.contact.replace(/[ ()-]/g, "");
    if (!/^(?:01[016789]\d{7,8}|\+[1-9]\d{7,14})$/.test(phone)) {
      throw new ServiceError(400, "INVALID_CONTACT", "연락받을 휴대전화 번호를 확인해 주세요.");
    }
    payload.contact = phone;
  }
  try {
    const document = validateReadingPdfDocument(payload.document, { includeBirthData: payload.storeBirthData });
    if (document.mode !== payload.mode) throw new Error("mode_mismatch");
    if ("birthData" in document) {
      // The shared JS validator has already checked this optional property's
      // exact shape; TypeScript infers only its always-present return keys.
      const birthData = document.birthData as { date: string; time: string | null };
      if (!payload.storeBirthData || birthData.date !== payload.birthDate
        || (birthData.time || "") !== (payload.birthTime || "")) throw new Error("birth_data_mismatch");
    }
    payload.document = document;
  } catch {
    throw new ServiceError(400, "INVALID_PDF_DOCUMENT", "PDF 내용 또는 출생정보 포함 선택을 확인해 주세요.");
  }
  return payload;
}

export function isRealBirthDate(value: string, now = Date.now()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const today = new Date(now + 9 * HOUR_MS).toISOString().slice(0, 10);
  return year >= 1900 && date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && value <= today;
}

export async function readSmallJson(request: Request, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  if (!/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    throw new ServiceError(415, "JSON_REQUIRED", "JSON 형식으로 요청해 주세요.");
  }
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)) {
    throw new ServiceError(413, "REQUEST_TOO_LARGE", "요청 크기가 허용 범위를 넘었습니다.");
  }
  if (!request.body) throw new ServiceError(400, "INVALID_JSON", "요청 내용이 없습니다.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new ServiceError(413, "REQUEST_TOO_LARGE", "요청 크기가 허용 범위를 넘었습니다.");
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw new ServiceError(400, "INVALID_JSON", "요청 형식을 확인해 주세요."); }
  } finally { reader.releaseLock(); }
}

async function enforceRateBucket(scope: string, identity: string, max: number, now: number): Promise<void> {
  const window = Math.floor(now / HOUR_MS) * HOUR_MS;
  const secret = env.RATE_LIMIT_SECRET?.trim();
  const source = new TextEncoder().encode(`result-request:${scope}:${window}:${identity}`);
  let digest: ArrayBuffer;
  if (secret) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    digest = await crypto.subtle.sign("HMAC", key, source);
  } else {
    // With no configured secret, still store only a fresh-hour hash, never raw IP.
    digest = await crypto.subtle.digest("SHA-256", source);
  }
  const key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const rows = await getDb().insert(requestRateLimits).values({ key, requestCount: 1, expiresAt: window + HOUR_MS })
    .onConflictDoUpdate({
      target: requestRateLimits.key,
      set: { requestCount: sql`${requestRateLimits.requestCount} + 1` },
      setWhere: sql`${requestRateLimits.requestCount} < ${max}`,
    }).returning({ count: requestRateLimits.requestCount });
  if (!rows.length) {
    throw new ServiceError(429, "RATE_LIMITED", "짧은 시간에 결과 이메일 신청이 많습니다. 잠시 후 다시 시도해 주세요.",
      Math.max(1, Math.ceil((window + HOUR_MS - now) / 1000)));
  }
}

async function enforceRateLimit(request: Request, recipient: string, now: number): Promise<void> {
  // Only Cloudflare's edge-supplied IP header. Both buckets persist only hourly
  // salted hashes: never raw IP/email in the rate-limit table or logs.
  await enforceRateBucket("ip", request.headers.get("cf-connecting-ip") ?? "unattributed", 5, now);
  await enforceRateBucket("recipient", recipient.trim().toLowerCase(), 3, now);
}

export async function createRequest(request: Request): Promise<Response> {
  requireSameOrigin(request);
  const settings = getCollectionSettings();
  if (!settings.enabled || settings.retentionDays === null) {
    throw new ServiceError(503, "COLLECTION_DISABLED", "현재 결과 전달 신청은 운영 준비 중입니다. 결과는 화면에서 확인할 수 있습니다.");
  }
  // Do not collect contacts while real delivery is unavailable, even if a caller
  // bypasses the disabled browser form. The inquiry mailbox is not a sender.
  if (!senderSettings().enabled) throw new ServiceError(503, "SENDER_NOT_CONFIGURED", "PDF 이메일 발송 연결이 준비 중입니다. 연락처를 저장하거나 발송하지 않았습니다.");
  const origin = new URL(request.url);
  if (!env.ASSETS && !(origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname))) {
    throw new ServiceError(503, "PDF_UNAVAILABLE", "PDF 제공 기능이 준비 중입니다. 연락처를 저장하거나 발송하지 않았습니다.");
  }
  await purgeExpired();
  const now = Date.now();
  const meetup = meetupSettings();
  const payload = validateRequestPayload(await readSmallJson(request, MAX_PDF_REQUEST_BYTES), now, meetup.enabled);
  if (payload.channel !== "email") throw new ServiceError(409, "SMS_NOT_CONFIGURED", "현재 PDF 결과는 이메일로만 전달합니다.");
  const db = getDb();
  const fingerprint = await requestFingerprint(payload);
  const replay = await db.select().from(readingRequests).where(eq(readingRequests.requestKey, payload.requestKey)).limit(1);
  if (replay.length) return replayRequest(request, replay[0], fingerprint);
  await enforceRateLimit(request, payload.contact, now);
  const id = crypto.randomUUID();
  const expiresAt = now + settings.retentionDays * DAY_MS;
  const status = "requested";
  const inserted = await db.insert(readingRequests).values({
    id, mode: payload.mode, nickname: payload.nickname || null,
    storeBirthData: payload.storeBirthData,
    birthDate: payload.storeBirthData ? payload.birthDate! : null,
    birthTime: payload.storeBirthData ? payload.birthTime ?? null : null,
    channel: payload.channel, contact: payload.contact,
    resultType: payload.result.type, resultTitle: payload.result.title,
    resultSummary: payload.result.summary, resultBasis: payload.result.basis,
    resultDocument: payload.document as Record<string, unknown>, requestKey: payload.requestKey, requestFingerprint: fingerprint,
    resultConsent: true, ageConfirm14: true,
    followupConsent: payload.followupConsent,
    followupPurpose: payload.followupConsent ? meetup.purpose : null,
    followupConsentAt: payload.followupConsent ? now : null,
    meetupTopics: payload.followupConsent ? payload.meetupTopics : null,
    consentVersion: CONSENT_VERSION,
    consentPurposes: { result: RESULT_PURPOSE },
    consentAt: now, retentionDays: settings.retentionDays, createdAt: now, expiresAt, status,
  }).onConflictDoNothing({ target: readingRequests.requestKey }).returning({ id: readingRequests.id });
  if (!inserted.length) {
    const [raced] = await db.select().from(readingRequests).where(eq(readingRequests.requestKey, payload.requestKey)).limit(1);
    if (!raced) throw new ServiceError(409, "REQUEST_CHANGED", "신청 상태가 변경되었습니다. 잠시 후 같은 신청으로 다시 시도해 주세요.");
    return replayRequest(request, raced, fingerprint);
  }
  const delivery = await deliverResult(request, id);
  return jsonResponse({ ...delivery, expiresAt: new Date(expiresAt).toISOString(), replayed: false }, 201);
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

async function requestFingerprint(payload: RequestPayload): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableJson(payload)));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function replayRequest(request: Request, row: StoredRequest, fingerprint: string): Promise<Response> {
  if (row.requestFingerprint !== fingerprint) throw new ServiceError(409, "REQUEST_KEY_CONFLICT", "이미 사용한 신청 번호의 내용이 달라졌습니다. 새 신청으로 다시 시도해 주세요.");
  if (row.status === "sent") return jsonResponse({ id: row.id, status: "sent", replayed: true,
    expiresAt: new Date(row.expiresAt).toISOString(), message: "발송 제공자가 이미 PDF 이메일을 접수했습니다. 수신함 도착 여부는 확인되지 않았습니다." });
  if (row.status === "sending") return jsonResponse({ id: row.id, status: "sending", replayed: true,
    message: "PDF 이메일을 처리 중입니다. 중복 발송하지 않았습니다." }, 202);
  return jsonResponse({ ...await deliverResult(request, row.id), replayed: true, expiresAt: new Date(row.expiresAt).toISOString() });
}

export async function requireAdmin(): Promise<void> {
  const access = await resolveAdminAccess();
  if (!access.allowed) {
    throw new ServiceError(403, "ADMIN_FORBIDDEN", "허용된 관리자 계정으로 로그인해 주세요.");
  }
}

type StoredRequest = typeof readingRequests.$inferSelect;

export function maskContact(contact: string, channel: "email" | "sms"): string {
  if (channel === "email") {
    const at = contact.lastIndexOf("@");
    if (at < 1) return "***";
    const domain = contact.slice(at + 1);
    const dot = domain.lastIndexOf(".");
    return `${contact[0]}***@${domain[0] ?? ""}***${dot > 0 ? domain.slice(dot) : ""}`;
  }
  return `${contact.startsWith("+") ? "+***" : "***"}-****-${contact.slice(-4)}`;
}

function recordView(row: StoredRequest, includePersonal: boolean) {
  const summary = {
    id: row.id, mode: row.mode, channel: row.channel,
    contactMasked: maskContact(row.contact, row.channel), status: row.status,
    resultType: row.resultType, storeBirthData: row.storeBirthData,
    resultConsent: row.resultConsent, followupConsent: row.followupConsent,
    meetupTopics: row.meetupTopics ?? [],
    consentVersion: row.consentVersion, consentAt: new Date(row.consentAt).toISOString(),
    createdAt: new Date(row.createdAt).toISOString(), expiresAt: new Date(row.expiresAt).toISOString(),
    sentAt: row.sentAt ? new Date(row.sentAt).toISOString() : null,
  };
  return includePersonal ? { ...summary, nickname: row.nickname, contact: row.contact,
    birthDate: row.birthDate, birthTime: row.birthTime, ageConfirm14: row.ageConfirm14,
    retentionDays: row.retentionDays, consentPurposes: row.consentPurposes,
    followupPurpose: row.followupPurpose,
    followupConsentAt: row.followupConsentAt ? new Date(row.followupConsentAt).toISOString() : null,
    result: { type: row.resultType, title: row.resultTitle, summary: row.resultSummary, basis: row.resultBasis },
    providerMessageId: row.providerMessageId,
  } : summary;
}

export async function listAdminRecords(request: Request): Promise<Response> {
  await requireAdmin();
  await purgeExpired();
  const query = new URL(request.url).searchParams;
  const includePersonal = query.get("includePersonal") === "true";
  const limit = query.has("limit") ? Number(query.get("limit")) : 50;
  const offset = query.has("offset") ? Number(query.get("offset")) : 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 100000) {
    throw new ServiceError(400, "INVALID_PAGINATION", "목록 범위를 확인해 주세요.");
  }
  const db = getDb();
  const groups = await db.select({ status: readingRequests.status, count: sql<number>`count(*)` })
    .from(readingRequests).groupBy(readingRequests.status);
  const [followups] = await db.select({ count: sql<number>`count(*)` }).from(readingRequests)
    .where(eq(readingRequests.followupConsent, true));
  const rows = await db.select().from(readingRequests).orderBy(desc(readingRequests.createdAt), desc(readingRequests.id))
    .limit(limit).offset(offset);
  const total = groups.reduce((sum, row) => sum + Number(row.count), 0);
  return jsonResponse({ summary: { total, byStatus: Object.fromEntries(groups.map((row) => [row.status, Number(row.count)])),
    followupConsented: Number(followups?.count ?? 0) },
    records: rows.map((row) => recordView(row, includePersonal)),
    pagination: { limit, offset, total, hasMore: offset + rows.length < total },
    personalDataIncluded: includePersonal, deliveryConfigured: { email: senderSettings().enabled && Boolean(env.ASSETS), sms: false } });
}

export function requireRecordId(id: string): void {
  if (!z.string().uuid().safeParse(id).success) throw new ServiceError(400, "INVALID_ID", "신청 번호를 확인해 주세요.");
}

export async function deleteAdminRecord(request: Request, id: string): Promise<Response> {
  await requireAdmin();
  requireSameOrigin(request);
  await purgeExpired();
  requireRecordId(id);
  const deleted = await getDb().delete(readingRequests).where(and(eq(readingRequests.id, id),
    sql`${readingRequests.status} != 'sending'`)).returning({ id: readingRequests.id });
  if (!deleted.length) {
    const [row] = await getDb().select({ status: readingRequests.status }).from(readingRequests).where(eq(readingRequests.id, id)).limit(1);
    if (row?.status === "sending") throw new ServiceError(409, "SEND_IN_PROGRESS", "현재 발송을 처리 중입니다. 처리 후 삭제해 주세요.");
    throw new ServiceError(404, "NOT_FOUND", "신청 내역을 찾을 수 없습니다.");
  }
  return jsonResponse({ deleted: true, id });
}

export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  // Spreadsheet formulas can start after whitespace, not just at index zero.
  if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function exportAdminRecords(): Promise<Response> {
  await requireAdmin();
  await purgeExpired();
  const rows = await getDb().select().from(readingRequests).orderBy(desc(readingRequests.createdAt));
  const columns = ["신청번호", "방식", "이름", "양력생년월일", "출생시간", "연락방식", "연락처", "유형", "제목", "결과", "근거", "결과전달동의", "일반모임초대동의", "모임관심주제", "동의한모임설명", "모임초대동의시각", "생년월일저장동의", "동의서버전", "동의시각", "신청시각", "파기예정시각", "발송상태", "제공자접수번호", "발송시각"];
  const lines = [columns.map(csvCell).join(","), ...rows.map((row) => [
    row.id, row.mode, row.nickname, row.birthDate, row.birthTime, row.channel, row.contact,
    row.resultType, row.resultTitle, row.resultSummary, row.resultBasis.join(" / "),
    row.resultConsent, row.followupConsent, row.meetupTopics?.join(" / ") ?? "", row.followupPurpose,
    row.followupConsentAt ? new Date(row.followupConsentAt).toISOString() : "",
    row.storeBirthData, row.consentVersion,
    new Date(row.consentAt).toISOString(), new Date(row.createdAt).toISOString(), new Date(row.expiresAt).toISOString(),
    row.status, row.providerMessageId, row.sentAt ? new Date(row.sentAt).toISOString() : "",
  ].map(csvCell).join(","))];
  return new Response(`\uFEFF${lines.join("\r\n")}\r\n`, { headers: {
    ...SAFE_HEADERS, "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="result-requests-${new Date().toISOString().slice(0, 10)}.csv"`,
  } });
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export async function sendAdminResult(request: Request, id: string): Promise<Response> {
  await requireAdmin();
  requireSameOrigin(request);
  await purgeExpired();
  requireRecordId(id);
  return jsonResponse(await deliverResult(request, id));
}

async function deliverResult(request: Request, id: string) {
  const sender = senderSettings();
  if (!sender.enabled) throw new ServiceError(503, "SENDER_NOT_CONFIGURED", "이메일 발송 서비스가 설정되지 않았습니다. 신청은 아직 발송되지 않았습니다.");
  const db = getDb();
  const [row] = await db.select().from(readingRequests).where(eq(readingRequests.id, id)).limit(1);
  if (!row) throw new ServiceError(404, "NOT_FOUND", "신청 내역을 찾을 수 없습니다.");
  if (!row.resultConsent) throw new ServiceError(409, "DELIVERY_CONSENT_REQUIRED", "결과 전달 동의가 없는 신청은 발송할 수 없습니다.");
  if (row.channel !== "email") throw new ServiceError(409, "SMS_NOT_CONFIGURED", "문자 발송은 아직 연결되지 않았습니다.");
  if (row.status === "sent") throw new ServiceError(409, "ALREADY_SENT", "이미 발송 제공자가 접수한 신청입니다.");
  if (row.status === "sending") throw new ServiceError(409, "SEND_IN_PROGRESS", "현재 발송을 처리 중입니다.");
  // Resend idempotency keys have a finite lifetime. An old uncertain attempt
  // must be reconciled at the provider instead of silently sending a duplicate.
  if (row.status === "failed" && row.sendAttemptedAt !== null
    && (row.resultDocument === null || Date.now() - row.sendAttemptedAt >= 23 * HOUR_MS)) {
    throw new ServiceError(409, "PROVIDER_CONFIRMATION_REQUIRED", "이전 발송의 제공자 접수 여부를 먼저 확인해 주세요. 중복 발송을 막기 위해 재발송하지 않았습니다.");
  }
  const claimed = await db.update(readingRequests).set({ status: "sending" })
    .where(and(eq(readingRequests.id, id), gt(readingRequests.expiresAt, Date.now()),
      inArray(readingRequests.status, ["requested", "awaiting_sender_setup", "failed"])))
    .returning({ id: readingRequests.id });
  if (!claimed.length) throw new ServiceError(409, "REQUEST_CHANGED", "신청 상태가 변경되었습니다. 목록을 새로 확인해 주세요.");
  let email;
  try {
    email = await buildPdfEmail({ mode: row.mode, nickname: row.nickname,
      result: { type: row.resultType, title: row.resultTitle, summary: row.resultSummary, basis: row.resultBasis },
      document: row.resultDocument, includeBirthData: row.storeBirthData }, new URL(request.url).origin);
  } catch {
    await db.update(readingRequests).set({ status: "failed" }).where(and(eq(readingRequests.id, id), eq(readingRequests.status, "sending")));
    throw new ServiceError(503, "PDF_UNAVAILABLE", "PDF를 준비하지 못해 발송하지 않았습니다. 같은 신청으로 다시 시도하거나 운영자에게 문의해 주세요.");
  }
  // The finite provider idempotency window starts at the first provider call,
  // not while fetching fonts or rendering a PDF that may never be sent.
  await db.update(readingRequests).set({ sendAttemptedAt: row.sendAttemptedAt ?? Date.now() })
    .where(and(eq(readingRequests.id, id), eq(readingRequests.status, "sending")));
  let providerId: string;
  try {
    providerId = await sendPdfEmail({ ...email, from: sender.from, to: row.contact, key: sender.key, requestId: id });
  } catch {
    await db.update(readingRequests).set({ status: "failed" }).where(and(eq(readingRequests.id, id), eq(readingRequests.status, "sending")));
    throw new ServiceError(502, "PROVIDER_UNCONFIRMED", "발송 제공자의 접수를 확인하지 못했습니다. 발송 완료로 표시하지 않았습니다.");
  }
  // Only the real provider acknowledgement can set `sent`. No inbox delivery claim.
  const sentAt = Date.now();
  await db.update(readingRequests).set({ status: "sent", providerMessageId: providerId, sentAt })
    .where(and(eq(readingRequests.id, id), eq(readingRequests.status, "sending")));
  return { id, status: "sent", providerMessageId: providerId,
    sentAt: new Date(sentAt).toISOString(), message: "발송 제공자가 PDF 이메일을 접수했습니다. 수신함 도착 여부는 확인되지 않았습니다." };
}
