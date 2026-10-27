ALTER TABLE `participants` ADD `source` text DEFAULT 'join' NOT NULL;--> statement-breakpoint
ALTER TABLE `participants` ADD `marketing_consent` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `participants` ADD `marketing_channels` text;--> statement-breakpoint
ALTER TABLE `participants` ADD `marketing_purpose` text;--> statement-breakpoint
ALTER TABLE `participants` ADD `marketing_consent_version` text;--> statement-breakpoint
ALTER TABLE `participants` ADD `marketing_consent_at` integer;--> statement-breakpoint
ALTER TABLE `participants` ADD `request_key` text;--> statement-breakpoint
ALTER TABLE `participants` ADD `request_fingerprint` text;--> statement-breakpoint
CREATE UNIQUE INDEX `participants_request_key_unique` ON `participants` (`request_key`);