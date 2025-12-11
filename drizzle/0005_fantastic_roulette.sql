PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transcode_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transcode_id` integer,
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
PRAGMA foreign_keys=ON;