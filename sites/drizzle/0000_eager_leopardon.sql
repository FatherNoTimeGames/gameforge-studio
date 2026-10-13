CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`fingerprint` text NOT NULL,
	`state` text NOT NULL,
	`blob_key` text NOT NULL,
	`result_key` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `requests_owner_created` ON `requests` (`owner`,`created_at`);--> statement-breakpoint
CREATE INDEX `requests_owner_fingerprint` ON `requests` (`owner`,`fingerprint`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`owner` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`blob_key` text NOT NULL,
	`updated_at` integer NOT NULL
);
