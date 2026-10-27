import { env } from "cloudflare:workers";
import { and, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { participants, requestRateLimits } from "@/db/schema";
import {
  csvCell, isRealBirthDate, jsonResponse, maskContact,
  readSmallJson, requireAdmin, requireRecordId, requireSameOrigin, ServiceError,
} from "@/lib/service";

export const PARTICIPANT_CONSENT_VERSION = "participants-v1";
export const PARTICIPANT_PURPOSE = "MBTI·별자리·사주 등 성향을 나누는 일반 모임 참가 관심 신청 및 안내";
export const READING_LEAD_CONSENT_VERSION = "reading-leads-v1";
export const READING_LEAD_PURPOSE = "사이(SAI STUDIO)의 MBTI·별자리·사주·자미두수 모임 홍보 및 참가 제안";
export const READING_RECORD_CONSENT_VERSION = "reading-records-v1";
export const READING_RECORD_PURPOSE = "성향 체험 입력 기록(이름·휴대전화·생년월일·선택 주제) 관리 및 보관";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const CONTROL = /[\u0000-\u001f\u007f]/;
const DESCRIPTION_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const participantSchema = z.object({
  name: z.string().trim().min(1).max(30).refine((name) => !CONTROL.test(name)),
  phone: z.string().trim().min(1).max(40),
  topic: z.enum(["mbti", "zodiac", "saju", "ziwei"]).optional(),
  storeBirthData: z.boolean().optional().default(false),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  collectionConsent: z.literal(true),
  ageConfirm14: z.literal(true),
  consentVersion: z.literal(PARTICIPANT_CONSENT_VERSION),
}).strict();

export type ParticipantPayload = z.infer<typeof participantSchema>;

const readingRecordSchema = z.object({
  source: z.literal("reading"),
  name: z.string().trim().min(1).max(30).refine((name) => !CONTROL.test(name)),
  phone: z.string().trim().min(1).max(40),
  topic: z.enum(["mbti", "zodiac", "saju", "ziwei"]).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recordConsent: z.literal(true),
  consentVersion: z.literal(READING_RECORD_CONSENT_VERSION),
  requestKey: z.string().uuid(),
}).strict();
export type ReadingRecordPayload = z.infer<typeof readingRecordSchema>;

export function normalizeParticipantPhone(value: string): string {
  if (!/^[+\d ()-]+$/.test(value)) {
    throw new ServiceError(400, "INVALID_PHONE", "휴대전화는 010 번호 또는 +82 10 형식으로 입력해 주세요.");
  }
  let normalized = value.replace(/[ ()-]/g, "");
  if (normalized.startsWith("+82010")) normalized = `+8210${normalized.slice(6)}`;
  if (!/^(?:010\d{8}|\+8210\d{8})$/.test(normalized)) {
    throw new ServiceError(400, "INVALID_PHONE", "휴대전화는 010-0000-0000 또는 +82 10 0000 0000 형식으로 입력해 주세요.");
  }
  return normalized;
}

export function validateReadingRecordPayload(value: unknown, now = Date.now()): ReadingRecordPayload {
  const version = value && typeof value === "object" && "consentVersion" in value ? value.consentVersion : undefined;
  if (typeof version === "string" && version.startsWith("reading-leads-")) {
    throw new ServiceError(409, "CONSENT_VERSION_RETIRED", "이전 모임 홍보 신청은 더 이상 받지 않습니다. 새로고침 후 기록 저장 안내를 확인해 주세요.");
  }
  if (version !== READING_RECORD_CONSENT_VERSION) {
    throw new ServiceError(409, "CONSENT_VERSION_MISMATCH", "기록 저장 안내 버전이 바뀌었습니다. 새로고침 후 다시 확인해 주세요.");
  }
  const parsed = readingRecordSchema.safeParse(value);
  if (!parsed.success) throw new ServiceError(400, "INVALID_READING_RECORD", "이름·휴대전화·양력 생년월일과 기록 저장 요청을 확인해 주세요.");
  if (!isRealBirthDate(parsed.data.birthDate, now)) {
    throw new ServiceError(400, "INVALID_BIRTH_DATE", "1900년부터 오늘까지의 실제 양력 생년월일을 입력해 주세요.");
  }
  const today = new Date(now + 9 * HOUR_MS).toISOString().slice(0, 10);
  const fourteenthBirthday = `${Number(parsed.data.birthDate.slice(0, 4)) + 14}${parsed.data.birthDate.slice(4)}`;
  if (fourteenthBirthday > today) throw new ServiceError(400, "MINIMUM_AGE_REQUIRED", "입력한 생년월일 기준 만 14세 이상만 기록을 저장할 수 있습니다. 저장 없이 결과 보기는 이용할 수 있습니다.");
  const phone = normalizeParticipantPhone(parsed.data.phone);
  // One canonical form for equivalent 010/+82 inputs in retry fingerprints.
  return { ...parsed.data, phone: phone.startsWith("+8210") ? `010${phone.slice(5)}` : phone };
}

export function validateParticipantPayload(value: unknown, now = Date.now()): ParticipantPayload | ReadingRecordPayload {
  if (value && typeof value === "object" && "source" in value && value.source === "reading") {
    return validateReadingRecordPayload(value, now);
  }
  const parsed = participantSchema.safeParse(value);
  if (!parsed.success) {
    throw new ServiceError(400, "INVALID_PARTICIPANT", "이름·휴대전화와 필수 동의, 동의서 버전을 확인해 주세요.");
  }
  const payload = parsed.data;
  payload.phone = normalizeParticipantPhone(payload.phone);
  if (!payload.storeBirthData && payload.birthDate !== undefined) {
    throw new ServiceError(400, "BIRTH_STORAGE_CONSENT_REQUIRED", "생년월일은 별도 저장 동의가 있을 때만 보낼 수 있습니다.");
  }
  if (payload.storeBirthData) {
    if (!payload.birthDate || !isRealBirthDate(payload.birthDate, now)) {
      throw new ServiceError(400, "INVALID_BIRTH_DATE", "1900년부터 오늘까지의 실제 양력 생년월일을 입력해 주세요.");
    }
    const today = new Date(now + 9 * HOUR_MS).toISOString().slice(0, 10);
    const fourteenthBirthday = `${Number(payload.birthDate.slice(0, 4)) + 14}${payload.birthDate.slice(4)}`;
    if (fourteenthBirthday > today) {
      throw new ServiceError(400, "MINIMUM_AGE_REQUIRED", "만 14세 이상만 모임 참가 관심 신청을 할 수 있습니다.");
    }
  }
  return payload;
}

export async function purgeExpiredParticipants(now = Date.now()): Promise<void> {
  if (!env.DB) return;
  const db = getDb();
  await db.delete(participants).where(lte(participants.expiresAt, now));
  await db.delete(requestRateLimits).where(lte(requestRateLimits.expiresAt, now));
}

async function participantSettings() {
  // Participant registration is independent from legacy result delivery. In
  // particular, COLLECTION_ENABLED=false must not disable this separate flow,
  // and enabling participants must never enable email/SMS result collection.
  const participantEnv = env as typeof env & { PARTICIPANTS_COLLECTION_ENABLED?: string };
  const operatorName = env.OPERATOR_NAME?.trim() ?? "";
  const contact = z.string().trim().email().max(254).safeParse(env.CONTACT_EMAIL ?? "");
  const retentionValue = env.RETENTION_DAYS ?? "";
  const retentionDays = Number(retentionValue);
  const validOperator = operatorName.length > 0 && operatorName.length <= 120 && !CONTROL.test(operatorName);
  const validRetention = /^\d+$/.test(retentionValue) && Number.isInteger(retentionDays)
    && retentionDays >= 1 && retentionDays <= 365;
  const description = env.MEETUP_DESCRIPTION?.trim() ?? "";
  const validDescription = description.length > 0 && description.length <= 500
    && !DESCRIPTION_CONTROL.test(description);
  let storageReady = Boolean(env.DB);
  try {
    await purgeExpiredParticipants();
    // Resolve every schema-owned column without retrieving any personal rows.
    // A missing additive migration must not advertise a usable signup form.
    if (storageReady) await getDb().select().from(participants).limit(0);
  } catch { storageReady = false; }
  return {
    collectionEnabled: participantEnv.PARTICIPANTS_COLLECTION_ENABLED === "true"
      && validOperator && contact.success && validRetention && validDescription && storageReady,
    operatorName: validOperator ? operatorName : null,
    contactEmail: contact.success ? contact.data : null,
    retentionDays: validRetention ? retentionDays : null,
    meetupDescription: validDescription ? description : null,
  };
}

export async function participantConfig(): Promise<Response> {
  const settings = await participantSettings();
  return jsonResponse({
    ...settings, consentVersion: PARTICIPANT_CONSENT_VERSION, purpose: PARTICIPANT_PURPOSE,
    // Kept disabled for stale clients; no new advertising requests or replays.
    readingLead: { enabled: false, consentVersion: READING_LEAD_CONSENT_VERSION,
      purpose: READING_LEAD_PURPOSE, marketingPurpose: READING_LEAD_PURPOSE, channels: ["sms", "phone"] },
    readingRecord: { enabled: settings.collectionEnabled, consentVersion: READING_RECORD_CONSENT_VERSION,
      purpose: READING_RECORD_PURPOSE, minimumAge: 14,
      fields: { required: ["name", "phone", "birthDate", "recordConsent", "consentVersion", "requestKey"], optional: ["topic"] } },
    minimumAge: 14, automaticSending: false,
    fields: { required: ["name", "phone", "collectionConsent", "ageConfirm14", "consentVersion"],
      optional: ["topic"], separatelyConsented: ["birthDate"] },
  });
}

export async function readingRecordFingerprint(payload: ReadingRecordPayload): Promise<string> {
  // Integrity comparison, not anonymization. The random per-submission key
  // scopes retries; never deduplicate or disclose whether a phone is registered.
  const canonical = [payload.requestKey, payload.source, payload.consentVersion, payload.name, payload.phone,
    payload.birthDate, payload.topic ?? null, payload.recordConsent];
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canonical)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function replayReadingRecord(requestKey: string, fingerprint: string): Promise<Response | null> {
  const [row] = await getDb().select({ id: participants.id, source: participants.source,
    fingerprint: participants.requestFingerprint, version: participants.consentVersion,
    expiresAt: participants.expiresAt }).from(participants)
    .where(eq(participants.requestKey, requestKey)).limit(1);
  if (!row) return null;
  if (row.source !== "reading" || row.version !== READING_RECORD_CONSENT_VERSION || row.fingerprint !== fingerprint) {
    throw new ServiceError(409, "REQUEST_KEY_CONFLICT", "이미 사용한 신청 키의 내용이 달라졌습니다. 새 동의 내용을 확인한 뒤 다시 신청해 주세요.");
  }
  return jsonResponse({ id: row.id, source: "reading", status: "registered", replayed: true,
    expiresAt: new Date(row.expiresAt).toISOString(), message: "동일한 체험 입력 기록이 이미 저장되어 있습니다. 중복 저장하지 않았습니다." });
}

async function participantRateLimit(request: Request, now: number): Promise<void> {
  const windowStart = Math.floor(now / HOUR_MS) * HOUR_MS;
  const ip = request.headers.get("cf-connecting-ip") ?? "unattributed";
  const bytes = new TextEncoder().encode(`participant-request:${windowStart}:${ip}`);
  const secret = env.RATE_LIMIT_SECRET?.trim();
  let digest: ArrayBuffer;
  if (secret) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    digest = await crypto.subtle.sign("HMAC", key, bytes);
  } else {
    digest = await crypto.subtle.digest("SHA-256", bytes);
  }
  const key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const accepted = await getDb().insert(requestRateLimits)
    .values({ key, requestCount: 1, expiresAt: windowStart + HOUR_MS })
    .onConflictDoUpdate({ target: requestRateLimits.key,
      set: { requestCount: sql`${requestRateLimits.requestCount} + 1` },
      setWhere: sql`${requestRateLimits.requestCount} < 5`,
    }).returning({ count: requestRateLimits.requestCount });
  if (!accepted.length) {
    throw new ServiceError(429, "RATE_LIMITED", "한 시간에 최대 5회 신청할 수 있습니다. 잠시 후 다시 시도해 주세요.",
      Math.max(1, Math.ceil((windowStart + HOUR_MS - now) / 1000)));
  }
}

export async function createParticipant(request: Request): Promise<Response> {
  requireSameOrigin(request);
  const settings = await participantSettings();
  if (!settings.collectionEnabled || settings.retentionDays === null || settings.meetupDescription === null) {
    throw new ServiceError(503, "PARTICIPANTS_DISABLED", "현재 모임 참가 관심 신청은 운영 준비 중입니다. 아직 개인정보를 저장하지 않습니다.");
  }
  const now = Date.now();
  const payload = validateParticipantPayload(await readSmallJson(request), now);
  const readingRecord = "source" in payload && payload.source === "reading";
  const fingerprint = readingRecord ? await readingRecordFingerprint(payload) : null;
  if (readingRecord && fingerprint) {
    const replay = await replayReadingRecord(payload.requestKey, fingerprint);
    if (replay) return replay;
  }
  await participantRateLimit(request, now);
  const id = crypto.randomUUID();
  const expiresAt = now + settings.retentionDays * DAY_MS;
  const storeBirthData = readingRecord || ("storeBirthData" in payload && payload.storeBirthData);
  const birthDate = storeBirthData && "birthDate" in payload ? payload.birthDate! : null;
  const inserted = await getDb().insert(participants).values({
    id, name: payload.name, phone: payload.phone, topic: payload.topic ?? null,
    source: readingRecord ? "reading" : "join",
    storeBirthData, birthDate, birthConsentAt: storeBirthData ? now : null,
    // For records-v1 these columns mean explicit save-button authorization
    // and server-verified DOB age threshold, not invented checkbox evidence.
    collectionConsent: true, ageConfirm14: true,
    consentVersion: readingRecord ? READING_RECORD_CONSENT_VERSION : PARTICIPANT_CONSENT_VERSION,
    consentPurpose: readingRecord ? READING_RECORD_PURPOSE : PARTICIPANT_PURPOSE,
    marketingConsent: false, marketingChannels: [], marketingPurpose: null,
    marketingConsentVersion: null, marketingConsentAt: null,
    requestKey: readingRecord ? payload.requestKey : null, requestFingerprint: fingerprint,
    meetupDescription: readingRecord ? "" : settings.meetupDescription, consentAt: now,
    retentionDays: settings.retentionDays, createdAt: now, expiresAt, status: "registered",
  }).onConflictDoNothing({ target: participants.requestKey }).returning({ id: participants.id });
  if (!inserted.length && readingRecord && fingerprint) {
    const replay = await replayReadingRecord(payload.requestKey, fingerprint);
    if (replay) return replay;
    throw new ServiceError(503, "REGISTRATION_UNCONFIRMED", "저장 확인을 받지 못했습니다. 같은 신청 키로 다시 확인해 주세요.");
  }
  // Registration is not a sent message, booking, or confirmation of an event.
  return jsonResponse({ id, source: readingRecord ? "reading" : "join", status: "registered", replayed: false,
    expiresAt: new Date(expiresAt).toISOString(), message: readingRecord
      ? "성향 체험 입력 기록을 저장했습니다. 광고 수신 신청이나 문자·전화 발송은 하지 않습니다."
      : "모임 참가 관심 신청이 저장되었습니다. 문자나 안내 메시지는 아직 발송되지 않았습니다." }, 201);
}

type ParticipantRow = typeof participants.$inferSelect;

export function maskParticipantName(name: string): string {
  const characters = Array.from(name);
  return characters.length < 2 ? "*" : `${characters[0]}${"*".repeat(characters.length - 1)}`;
}

function participantView(row: ParticipantRow, includePersonal: boolean) {
  const summary = {
    id: row.id, nameMasked: maskParticipantName(row.name), phoneMasked: maskContact(row.phone, "sms"),
    topic: row.topic, storeBirthData: row.storeBirthData,
    source: row.source, marketingConsent: row.marketingConsent,
    marketingChannels: row.marketingChannels ?? [], marketingConsentVersion: row.marketingConsentVersion,
    marketingConsentAt: row.marketingConsentAt === null ? null : new Date(row.marketingConsentAt).toISOString(),
    collectionConsent: row.collectionConsent, ageConfirm14: row.ageConfirm14,
    consentVersion: row.consentVersion, consentAt: new Date(row.consentAt).toISOString(),
    createdAt: new Date(row.createdAt).toISOString(), expiresAt: new Date(row.expiresAt).toISOString(), status: row.status,
  };
  return includePersonal ? { ...summary, name: row.name, phone: row.phone, birthDate: row.birthDate,
    birthConsentAt: row.birthConsentAt ? new Date(row.birthConsentAt).toISOString() : null,
    consentPurpose: row.consentPurpose, marketingPurpose: row.marketingPurpose,
    meetupDescription: row.meetupDescription, retentionDays: row.retentionDays,
  } : summary;
}

export async function listParticipants(request: Request): Promise<Response> {
  await requireAdmin();
  await purgeExpiredParticipants();
  const query = new URL(request.url).searchParams;
  const rawLimit = query.get("limit") ?? "50";
  const rawOffset = query.get("offset") ?? "0";
  const limit = Number(rawLimit);
  const offset = Number(rawOffset);
  if (!/^\d+$/.test(rawLimit) || !/^\d+$/.test(rawOffset) || !Number.isSafeInteger(limit)
    || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0 || offset > 100000) {
    throw new ServiceError(400, "INVALID_PAGINATION", "목록 범위를 확인해 주세요.");
  }
  const includePersonal = query.get("includePersonal") === "true";
  const db = getDb();
  const groups = await db.select({ topic: participants.topic, count: sql<number>`count(*)` })
    .from(participants).groupBy(participants.topic);
  const [birthData] = await db.select({ count: sql<number>`count(*)` }).from(participants)
    .where(eq(participants.storeBirthData, true));
  const sources = await db.select({ source: participants.source, count: sql<number>`count(*)` }).from(participants)
    .groupBy(participants.source);
  const [marketing] = await db.select({ count: sql<number>`count(*)` }).from(participants)
    .where(eq(participants.marketingConsent, true));
  const rows = await db.select().from(participants)
    .orderBy(desc(participants.createdAt), desc(participants.id)).limit(limit).offset(offset);
  const total = groups.reduce((sum, row) => sum + Number(row.count), 0);
  return jsonResponse({
    summary: { total, byTopic: Object.fromEntries(groups.map((row) => [row.topic ?? "unspecified", Number(row.count)])),
      withBirthData: Number(birthData?.count ?? 0), marketingOptIn: Number(marketing?.count ?? 0),
      bySource: { join: 0, reading: 0, ...Object.fromEntries(sources.map((row) => [row.source, Number(row.count)])) } },
    records: rows.map((row) => participantView(row, includePersonal)), personalDataIncluded: includePersonal,
    pagination: { limit, offset, total, hasMore: offset + rows.length < total },
  });
}

export async function deleteParticipant(request: Request, id: string): Promise<Response> {
  await requireAdmin();
  requireSameOrigin(request);
  await purgeExpiredParticipants();
  requireRecordId(id);
  const deleted = await getDb().delete(participants).where(eq(participants.id, id)).returning({ id: participants.id });
  if (!deleted.length) throw new ServiceError(404, "NOT_FOUND", "참가 관심 신청을 찾을 수 없습니다.");
  return jsonResponse({ deleted: true, id });
}

const exportSelectionSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(50)
  .refine((ids) => new Set(ids).size === ids.length) }).strict();

export async function exportParticipants(request?: Request): Promise<Response> {
  await requireAdmin();
  let ids: string[] | null = null;
  if (request) {
    requireSameOrigin(request);
    const selected = exportSelectionSchema.safeParse(await readSmallJson(request));
    if (!selected.success) throw new ServiceError(400, "INVALID_SELECTION", "현재 페이지에서 1~50건의 기록을 선택해 주세요.");
    ids = selected.data.ids;
  }
  if (!ids) await purgeExpiredParticipants();
  const rows = await getDb().select().from(participants).where(ids ? and(inArray(participants.id, ids), gt(participants.expiresAt, Date.now())) : undefined)
    .orderBy(desc(participants.createdAt), desc(participants.id));
  if (ids && rows.length !== ids.length) throw new ServiceError(409, "SELECTION_CHANGED", "선택한 기록 중 만료되거나 삭제된 항목이 있어요. 새로고침 후 다시 선택해 주세요.");
  const columns = ["신청번호", "이름", "휴대전화", "관심주제", "양력생년월일", "생년월일저장선택", "생년월일저장요청시각",
    "개인정보수집이용·기록저장선택", "만14세이상기준충족", "안내·동의서버전", "수집목적", "모임설명", "요청·동의시각", "보관일수", "신청시각", "파기예정시각", "상태",
    "등록경로", "광고안내수신동의", "광고안내채널", "광고안내목적", "광고동의서버전", "광고동의시각", "저장선택근거"];
  const lines = [columns.map(csvCell).join(","), ...rows.map((row) => [
    row.id, row.name, row.phone, row.topic, row.birthDate, row.storeBirthData,
    row.birthConsentAt ? new Date(row.birthConsentAt).toISOString() : "", row.collectionConsent, row.ageConfirm14,
    row.consentVersion, row.consentPurpose, row.meetupDescription, new Date(row.consentAt).toISOString(),
    row.retentionDays, new Date(row.createdAt).toISOString(), new Date(row.expiresAt).toISOString(), row.status,
    row.source, row.marketingConsent, (row.marketingChannels ?? []).join("|"), row.marketingPurpose,
    row.marketingConsentVersion, row.marketingConsentAt === null ? "" : new Date(row.marketingConsentAt).toISOString(),
    row.source === "reading" && row.consentVersion === READING_RECORD_CONSENT_VERSION ? "기록 저장 버튼 요청·서버 생년월일 연령검증" : "기존 선택 동의",
  ].map(csvCell).join(","))];
  return new Response(`\uFEFF${lines.join("\r\n")}\r\n`, { headers: {
    "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="participants-${new Date().toISOString().slice(0, 10)}.csv"`,
  } });
}
