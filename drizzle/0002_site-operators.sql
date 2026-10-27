CREATE TABLE `site_operators` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_operators_email_unique` ON `site_operators` (`email`);