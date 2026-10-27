CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`topic` text,
	`store_birth_data` integer DEFAULT false NOT NULL,
	`birth_date` text,
	`birth_consent_at` integer,
	`collection_consent` integer NOT NULL,
	`age_confirm_14` integer NOT NULL,
	`consent_version` text NOT NULL,
	`consent_purpose` text NOT NULL,
	`meetup_description` text NOT NULL,
	`consent_at` integer NOT NULL,
	`retention_days` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`status` text DEFAULT 'registered' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `participants_expires_idx` ON `participants` (`expires_at`);--> statement-breakpoint
CREATE INDEX `participants_created_idx` ON `participants` (`created_at`);