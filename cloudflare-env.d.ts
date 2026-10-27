declare namespace Cloudflare {
  interface Env {
    ASSETS?: Fetcher;
    DB?: D1Database;
    BUCKET?: R2Bucket;
    COLLECTION_ENABLED?: string;
    PARTICIPANTS_COLLECTION_ENABLED?: string;
    OPERATOR_NAME?: string;
    CONTACT_EMAIL?: string;
    RETENTION_DAYS?: string;
    ADMIN_EMAILS?: string;
    OWNER_EMAIL?: string;
    RATE_LIMIT_SECRET?: string;
    RESEND_API_KEY?: string;
    MAIL_FROM?: string;
    MEETUP_DESCRIPTION?: string;
  }
}
