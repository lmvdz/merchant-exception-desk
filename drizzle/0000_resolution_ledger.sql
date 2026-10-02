CREATE TABLE `operations` (
 `id` text PRIMARY KEY NOT NULL,
 `session` text NOT NULL,
 `case_id` text NOT NULL,
 `mode` text NOT NULL,
 `amount` integer NOT NULL,
 `request_id` text NOT NULL,
 `capture_id` text NOT NULL,
 `provider_payload` text NOT NULL,
 `status` text NOT NULL,
 `refund_id` text,
 `provider_status` text,
 `created_at` text NOT NULL,
 `updated_at` text NOT NULL,
 `attempts` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operations_request_id_unique` ON `operations` (`request_id`);
--> statement-breakpoint
CREATE TABLE `audit` (
 `id` text PRIMARY KEY NOT NULL,
 `session` text NOT NULL,
 `case_id` text NOT NULL,
 `event` text NOT NULL,
 `detail` text NOT NULL,
 `created_at` text NOT NULL
);
