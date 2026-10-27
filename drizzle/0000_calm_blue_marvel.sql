CREATE TABLE `reading_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`nickname` text,
	`birth_date` text,
	`birth_time` text,
	`store_birth_data` integer NOT NULL,
	`channel` text NOT NULL,
	`contact` text NOT NULL,
	`result_type` text NOT NULL,
	`result_title` text NOT NULL,
	`result_summary` text NOT NULL,
	`result_basis` text NOT NULL,
	`result_consent` integer NOT NULL,
	`followup_consent` integer DEFAULT false NOT NULL,
	`followup_purpose` text,
	`followup_consent_at` integer,
	`meetup_topics` text,
	`age_confirm_14` integer NOT NULL,
	`consent_version` text NOT NULL,
	`consent_purposes` text NOT NULL,
	`consent_at` integer NOT NULL,
	`retention_days` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`status` text NOT NULL,
	`provider_message_id` text,
	`send_attempted_at` integer,
	`sent_at` integer
);
--> statement-breakpoint
CREATE INDEX `reading_requests_expires_idx` ON `reading_requests` (`expires_at`);--> statement-breakpoint
CREATE INDEX `reading_requests_created_idx` ON `reading_requests` (`created_at`);--> statement-breakpoint
CREATE TABLE `request_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`request_count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `request_rate_limits_expires_idx` ON `request_rate_limits` (`expires_at`);