ALTER TABLE "guild_settings" ADD COLUMN IF NOT EXISTS "welcome_image_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "guild_settings" ADD COLUMN IF NOT EXISTS "goodbye_image_enabled" boolean DEFAULT false NOT NULL;
