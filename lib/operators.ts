import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { siteOperators } from "@/db/schema";
import { configuredOwnerEmail, configuredPermanentAdmins } from "./access";
import { MAX_DATABASE_OPERATORS, normalizeOperatorEmail, operatorPayloadSchema, operatorRemovalPolicy } from "./operator-policy";
import { jsonResponse, readSmallJson, requireSameOrigin, ServiceError } from "./service";

async function requireOwner() {
  const owner = configuredOwnerEmail();
  if (!owner) throw new ServiceError(403, "OWNER_NOT_CONFIGURED", "사이트 소유자 계정이 서버에 설정되지 않았습니다.");
  const user = await getChatGPTUser();
  if (!user || normalizeOperatorEmail(user.email) !== owner) {
    throw new ServiceError(403, "OWNER_REQUIRED", "운영자 추가·해제는 사이트 소유자 계정만 할 수 있습니다.");
  }
  return user;
}

function requireOperatorStorage() {
  if (!env.DB) throw new ServiceError(503, "OPERATOR_STORAGE_UNAVAILABLE", "운영자 권한 DB가 준비되지 않았습니다.");
  return env.DB;
}

export async function listOperators(): Promise<Response> {
  await requireOwner();
  requireOperatorStorage();
  const owner = configuredOwnerEmail();
  const permanent = configuredPermanentAdmins().filter((email) => email !== owner);
  const rows = await getDb().select().from(siteOperators).orderBy(desc(siteOperators.createdAt));
  const database = rows.filter((row) => row.email !== owner);
  return jsonResponse({
    canManageOperators: true,
    maxDatabaseOperators: MAX_DATABASE_OPERATORS,
    counts: { database: rows.length, environment: permanent.length },
    operators: [
      ...permanent.map((email) => ({ id: null, email, source: "environment", removable: false, createdAt: null })),
      ...database.map((row) => ({ id: row.id, email: row.email, source: "database",
        removable: operatorRemovalPolicy(row.email, owner, permanent) === "database",
        createdAt: new Date(row.createdAt).toISOString() })),
    ],
    notice: "운영자 등록은 사이트 내부 DB 관리 권한만 부여합니다. 비공개 Sites의 초대·접속 허용은 별도로 설정해야 합니다.",
  });
}

export async function addOperator(request: Request): Promise<Response> {
  const user = await requireOwner();
  requireSameOrigin(request);
  const binding = requireOperatorStorage();
  const parsed = operatorPayloadSchema.safeParse(await readSmallJson(request));
  if (!parsed.success) throw new ServiceError(400, "INVALID_OPERATOR_EMAIL", "추가할 운영자의 올바른 이메일 주소만 입력해 주세요.");
  const email = parsed.data.email;
  if (operatorRemovalPolicy(email, configuredOwnerEmail(), configuredPermanentAdmins()) !== "database") {
    throw new ServiceError(409, "OPERATOR_ALREADY_PERMANENT", "소유자 또는 서버에 고정 등록된 운영자는 별도로 추가할 수 없습니다.");
  }
  const id = crypto.randomUUID();
  // The count guard and insert are a single SQLite statement, so concurrent
  // requests cannot cross the twenty-row limit. UNIQUE protects duplicates.
  const inserted = await binding.prepare(`
    INSERT INTO site_operators (id, email, created_by_user_id, created_at)
    SELECT ?, ?, ?, ?
    WHERE (SELECT COUNT(*) FROM site_operators) < ?
    ON CONFLICT(email) DO NOTHING
    RETURNING id
  `).bind(id, email, user.userId, Date.now(), MAX_DATABASE_OPERATORS).first<{ id: string }>();
  if (!inserted) {
    const [existing] = await getDb().select({ id: siteOperators.id }).from(siteOperators)
      .where(eq(siteOperators.email, email)).limit(1);
    if (existing) throw new ServiceError(409, "OPERATOR_EXISTS", "이미 등록된 운영자 이메일입니다.");
    throw new ServiceError(409, "OPERATOR_LIMIT_REACHED", `DB 운영자는 최대 ${MAX_DATABASE_OPERATORS}명까지 추가할 수 있습니다.`);
  }
  return jsonResponse({ id: inserted.id, added: true,
    message: "운영자 DB 관리 권한을 추가했습니다. 비공개 사이트의 초대·접속 허용은 별도입니다." }, 201);
}

export async function removeOperator(request: Request, id: string): Promise<Response> {
  await requireOwner();
  requireSameOrigin(request);
  requireOperatorStorage();
  if (!z.string().uuid().safeParse(id).success) throw new ServiceError(400, "INVALID_OPERATOR_ID", "운영자 식별자를 확인해 주세요.");
  const db = getDb();
  const [row] = await db.select().from(siteOperators).where(eq(siteOperators.id, id)).limit(1);
  if (!row) throw new ServiceError(404, "OPERATOR_NOT_FOUND", "해당 DB 운영자를 찾을 수 없습니다.");
  const policy = operatorRemovalPolicy(row.email, configuredOwnerEmail(), configuredPermanentAdmins());
  if (policy === "owner") throw new ServiceError(403, "OWNER_REMOVAL_FORBIDDEN", "소유자 본인의 권한은 이 화면에서 해제할 수 없습니다.");
  if (policy === "environment") throw new ServiceError(409, "OPERATOR_MANAGED_BY_ENV", "서버에 고정 등록된 운영자는 서버 설정으로 관리해야 합니다.");
  const deleted = await db.delete(siteOperators).where(eq(siteOperators.id, id)).returning({ id: siteOperators.id });
  if (!deleted.length) throw new ServiceError(404, "OPERATOR_NOT_FOUND", "이미 해제된 운영자입니다.");
  return jsonResponse({ removed: true, id,
    message: "해당 계정의 DB 운영 권한을 해제했습니다. 비공개 사이트의 기존 초대 상태는 변경하지 않았습니다." });
}
