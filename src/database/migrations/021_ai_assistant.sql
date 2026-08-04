ALTER TABLE "guild_settings" ADD COLUMN IF NOT EXISTS "ai_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "guild_settings" ADD COLUMN IF NOT EXISTS "ai_channel" varchar(20);
ALTER TABLE "guild_settings" ADD COLUMN IF NOT EXISTS "ai_persona" text DEFAULT 'You are a helpful Discord bot assistant.';
