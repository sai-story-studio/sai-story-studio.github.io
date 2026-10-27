import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { siteOperators } from "@/db/schema";
import { normalizeOperatorEmail, permanentAdminEmails, staticOperatorRole } from "./operator-policy";

export function configuredOwnerEmail(): string | null {
  const accessEnv = env as typeof env & { OWNER_EMAIL?: string };
  return normalizeOperatorEmail(accessEnv.OWNER_EMAIL);
}

export function configuredPermanentAdmins(): string[] {
  return permanentAdminEmails(env.ADMIN_EMAILS);
}

export async function resolveAdminAccess() {
  const user = await getChatGPTUser();
  const email = normalizeOperatorEmail(user?.email);
  if (!user || !email) return { allowed: false, role: null } as const;
  const staticRole = staticOperatorRole(email, configuredOwnerEmail(), configuredPermanentAdmins());
  // Existing environment administrators and the owner do not depend on the
  // new table having been migrated, or on its availability during a request.
  if (staticRole) return { allowed: true, role: staticRole } as const;
  if (!env.DB) return { allowed: false, role: null } as const;
  try {
    const [operator] = await getDb().select({ id: siteOperators.id }).from(siteOperators)
      .where(eq(siteOperators.email, email)).limit(1);
    return operator ? { allowed: true, role: "database" } as const : { allowed: false, role: null } as const;
  } catch {
    // A missing migration or unavailable database must never grant access.
    return { allowed: false, role: null } as const;
  }
}
