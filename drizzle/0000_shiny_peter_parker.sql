CREATE TABLE `transcode_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transcode_id` integer,
	`status` text NOT NULL,
	`home_folder` text NOT NULL,
	`source_file_path` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`transcode_id`) REFERENCES `transcodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transcodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`input_file_source` text NOT NULL,
	`input_file_url` text,
	`input_file_key` text,
	`input_storage` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
