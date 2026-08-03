CREATE TABLE IF NOT EXISTS "social_feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" varchar(20) NOT NULL,
	"feed_type" varchar(20) NOT NULL,
	"feed_url" varchar(500) NOT NULL,
	"channel_id" varchar(20) NOT NULL,
	"mention_role" varchar(20),
	"custom_message" varchar(2000),
	"last_entry_id" varchar(255),
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "birthday_settings" (
	"guild_id" varchar(20) PRIMARY KEY NOT NULL,
	"channel_id" varchar(20),
	"message" varchar(2000) DEFAULT 'Happy Birthday <@user>! 🎉' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL
);
CREATE TABLE IF NOT EXISTS "user_birthdays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(20) NOT NULL,
	"guild_id" varchar(20) NOT NULL,
	"month" integer NOT NULL,
	"day" integer NOT NULL,
	"year" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "trivia_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" varchar(20) NOT NULL,
	"channel_id" varchar(20) NOT NULL,
	"allowed_roles" jsonb DEFAULT '[]' NOT NULL,
	"questions" jsonb NOT NULL,
	"reward_xp" integer DEFAULT 0 NOT NULL,
	"reward_coins" integer DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"winner_id" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "economy_trades" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"guild_id" varchar(255) NOT NULL,
	"initiator_id" varchar(255) NOT NULL,
	"receiver_id" varchar(255) NOT NULL,
	"initiator_offer" jsonb NOT NULL,
	"receiver_offer" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "xp_settings" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;
ALTER TABLE "economy_settings" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;