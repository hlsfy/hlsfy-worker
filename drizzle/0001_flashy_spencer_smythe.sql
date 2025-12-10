CREATE TABLE `transcode_action_outputs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transcode_action_id` integer,
	`output` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`transcode_action_id`) REFERENCES `transcode_actions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transcode_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transcode_id` integer,
	`action` text NOT NULL,
	`payload` text,
	`payload_from_action_id` integer,
	`status` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`transcode_id`) REFERENCES `transcodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payload_from_action_id`) REFERENCES `transcode_actions`(`id`) ON UPDATE no action ON DELETE no action
);
