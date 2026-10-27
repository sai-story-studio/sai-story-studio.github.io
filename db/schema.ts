import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export type ReadingMode = "zodiac" | "saju" | "ziwei";
export type MeetupTopic = "mbti" | "zodiac" | "saju" | "ziwei";
export type MarketingChannel = "sms" | "phone";
export type DeliveryStatus =
  | "requested"
  | "awaiting_sender_setup"
  | "sending"
  | "sent"
  | "failed";

// No record is created by calculation/viewing. This table is only for an
// explicit result-delivery request and its separately recorded consent.
export const readingRequests = sqliteTable("reading_requests", {
  id: text("id").primaryKey(),
  mode: text("mode").$type<ReadingMode>().notNull(),
  nickname: text("nickname"),
  birthDate: text("birth_date"),
  birthTime: text("birth_time"),
  storeBirthData: integer("store_birth_data", { mode: "boolean" }).notNull(),
  channel: text("channel").$type<"email" | "sms">().notNull(),
  contact: text("contact").notNull(),
  resultType: text("result_type").notNull(),
  resultTitle: text("result_title").notNull(),
  resultSummary: text("result_summary").notNull(),
  resultBasis: text("result_basis", { mode: "json" }).$type<string[]>().notNull(),
  // Bounded structured report, never an uploaded PDF/HTML/remote attachment.
  // Null preserves the original summary-only requests and their consent scope.
  resultDocument: text("result_document", { mode: "json" }).$type<Record<string, unknown>>(),
  requestKey: text("request_key"),
  requestFingerprint: text("request_fingerprint"),
  resultConsent: integer("result_consent", { mode: "boolean" }).notNull(),
  followupConsent: integer("followup_consent", { mode: "boolean" }).notNull().default(false),
  followupPurpose: text("followup_purpose"),
  followupConsentAt: integer("followup_consent_at"),
  meetupTopics: text("meetup_topics", { mode: "json" }).$type<MeetupTopic[]>(),
  ageConfirm14: integer("age_confirm_14", { mode: "boolean" }).notNull(),
  consentVersion: text("consent_version").notNull(),
  consentPurposes: text("consent_purposes", { mode: "json" })
    .$type<{ result: string }>().notNull(),
  consentAt: integer("consent_at").notNull(),
  retentionDays: integer("retention_days").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  status: text("status").$type<DeliveryStatus>().notNull(),
  providerMessageId: text("provider_message_id"),
  sendAttemptedAt: integer("send_attempted_at"),
  sentAt: integer("sent_at"),
}, (table) => [
  index("reading_requests_expires_idx").on(table.expiresAt),
  index("reading_requests_created_idx").on(table.createdAt),
  uniqueIndex("reading_requests_request_key_unique").on(table.requestKey),
]);

// Short-lived, hourly salted hashes only. Raw IP addresses are never stored.
export const requestRateLimits = sqliteTable("request_rate_limits", {
  key: text("key").primaryKey(),
  requestCount: integer("request_count").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("request_rate_limits_expires_idx").on(table.expiresAt)]);

// An explicit general-meetup interest registration, separate from result mail.
// Viewing/calculating a reading never creates a participant record.
export const participants = sqliteTable("participants", {
  id: text("id").primaryKey(),
  // Legacy rows remain meetup registrations, never advertising subscribers.
  source: text("source").$type<"join" | "reading">().notNull().default("join"),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  topic: text("topic").$type<MeetupTopic>(),
  storeBirthData: integer("store_birth_data", { mode: "boolean" }).notNull().default(false),
  birthDate: text("birth_date"),
  birthConsentAt: integer("birth_consent_at"),
  collectionConsent: integer("collection_consent", { mode: "boolean" }).notNull(),
  ageConfirm14: integer("age_confirm_14", { mode: "boolean" }).notNull(),
  consentVersion: text("consent_version").notNull(),
  consentPurpose: text("consent_purpose").notNull(),
  marketingConsent: integer("marketing_consent", { mode: "boolean" }).notNull().default(false),
  marketingChannels: text("marketing_channels", { mode: "json" }).$type<MarketingChannel[]>(),
  marketingPurpose: text("marketing_purpose"),
  marketingConsentVersion: text("marketing_consent_version"),
  marketingConsentAt: integer("marketing_consent_at"),
  requestKey: text("request_key"),
  requestFingerprint: text("request_fingerprint"),
  meetupDescription: text("meetup_description").notNull(),
  consentAt: integer("consent_at").notNull(),
  retentionDays: integer("retention_days").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  status: text("status").$type<"registered">().notNull().default("registered"),
}, (table) => [
  index("participants_expires_idx").on(table.expiresAt),
  index("participants_created_idx").on(table.createdAt),
  uniqueIndex("participants_request_key_unique").on(table.requestKey),
]);

// Additional database administrators. Only the separately configured owner may
// add/remove these rows. This does not invite anyone to a private Sites project.
export const siteOperators = sqliteTable("site_operators", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdByUserId: text("created_by_user_id").notNull(),
  createdAt: integer("created_at").notNull(),
});
