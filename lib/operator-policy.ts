import { z } from "zod";

export const MAX_DATABASE_OPERATORS = 20;
const emailSchema = z.string().max(254).email();
const controlCharacters = /[\u0000-\u001f\u007f]/;

export function normalizeOperatorEmail(value: unknown): string | null {
  if (typeof value !== "string" || controlCharacters.test(value)) return null;
  const email = value.trim().toLowerCase();
  return emailSchema.safeParse(email).success ? email : null;
}

export function permanentAdminEmails(value: string | undefined): string[] {
  const entries = (value ?? "").split(/[,;\n]/).map((email) => email.trim()).filter(Boolean);
  const normalized = entries.map(normalizeOperatorEmail);
  // A malformed permanent allowlist does not silently enable its valid subset.
  if (normalized.some((email) => email === null)) return [];
  return [...new Set(normalized as string[])];
}

export function staticOperatorRole(email: string, ownerEmail: string | null, admins: string[]): "owner" | "environment" | null {
  if (ownerEmail && email === ownerEmail) return "owner";
  return admins.includes(email) ? "environment" : null;
}

export function operatorRemovalPolicy(email: string, ownerEmail: string | null, admins: string[]): "owner" | "environment" | "database" {
  return staticOperatorRole(email, ownerEmail, admins) ?? "database";
}

export const operatorPayloadSchema = z.object({
  email: z.string().max(300).transform((email) => normalizeOperatorEmail(email))
    .refine((email): email is string => email !== null, "유효한 이메일을 입력해 주세요."),
}).strict();
