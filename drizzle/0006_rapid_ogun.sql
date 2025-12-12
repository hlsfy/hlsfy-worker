PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transcode_action_outputs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text,
	`transcode_action_id` integer NOT NULL,
	`output` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`transcode_action_id`) REFERENCES `transcode_actions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_transcode_action_outputs`("id", "external_id", "transcode_action_id", "output", "created_at", "updated_at") SELECT "id", "external_id", "transcode_action_id", "output", "created_at", "updated_at" FROM `transcode_action_outputs`;--> statement-breakpoint
DROP TABLE `transcode_action_outputs`;--> statement-breakpoint
ALTER TABLE `__new_transcode_action_outputs` RENAME TO `transcode_action_outputs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_transcode_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transcode_id` integer NOT NULL,
	`action` text NOT NULL,
	`payload` text,
	`max_attempts` integer NOT NULL,
	`delay` integer NOT NULL,
	`current_attempt` integer DEFAULT 0 NOT NULL,
	`payload_from_action_id` integer,
	`external_id` text,
	`status` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`transcode_id`) REFERENCES `transcodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payload_from_action_id`) REFERENCES `transcode_actions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_transcode_actions`("id", "transcode_id", "action", "payload", "max_attempts", "delay", "current_attempt", "payload_from_action_id", "external_id", "status", "created_at", "updated_at") SELECT "id", "transcode_id", "action", "payload", "max_attempts", "delay", "current_attempt", "payload_from_action_id", "external_id", "status", "created_at", "updated_at" FROM `transcode_actions`;--> statement-breakpoint
DROP TABLE `transcode_actions`;--> statement-breakpoint
ALTER TABLE `__new_transcode_actions` RENAME TO `transcode_actions`;--> statement-breakpoint
CREATE TABLE `__new_transcode_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transcode_id` integer NOT NULL,
	`status` text NOT NULL,
	`home_folder` text NOT NULL,
	`source_file_path` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`transcode_id`) REFERENCES `transcodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_transcode_sessions`("id", "transcode_id", "status", "home_folder", "source_file_path", "created_at", "updated_at") SELECT "id", "transcode_id", "status", "home_folder", "source_file_path", "created_at", "updated_at" FROM `transcode_sessions`;--> statement-breakpoint
DROP TABLE `transcode_sessions`;--> statement-breakpoint
ALTER TABLE `__new_transcode_sessions` RENAME TO `transcode_sessions`;