ALTER TABLE `reading_requests` ADD `result_document` text;--> statement-breakpoint
ALTER TABLE `reading_requests` ADD `request_key` text;--> statement-breakpoint
ALTER TABLE `reading_requests` ADD `request_fingerprint` text;--> statement-breakpoint
CREATE UNIQUE INDEX `reading_requests_request_key_unique` ON `reading_requests` (`request_key`);