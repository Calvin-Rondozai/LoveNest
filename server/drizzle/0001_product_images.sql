CREATE TABLE `image` (
	`id` text PRIMARY KEY NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "image_size_limit" CHECK("image"."size" <= 2097152)
);
