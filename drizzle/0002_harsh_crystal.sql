PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transcodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text,
	`input_file_source` text NOT NULL,
	`input_file_url` text,
	`input_file_key` text,
	`input_storage` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_transcodes`("id", "external_id", "input_file_source", "input_file_url", "input_file_key", "input_storage", "created_at", "updated_at") SELECT "id", "external_id", "input_file_source", "input_file_url", "input_file_key", "input_storage", "created_at", "updated_at" FROM `transcodes`;--> statement-breakpoint
DROP TABLE `transcodes`;--> statement-breakpoint
ALTER TABLE `__new_transcodes` RENAME TO `transcodes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `transcode_action_outputs` ADD `external_id` text;--> statement-breakpoint
ALTER TABLE `transcode_actions` ADD `external_id` text;