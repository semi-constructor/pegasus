-- Base tables required by all other migrations

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(20) PRIMARY KEY,
    global_name VARCHAR(32),
    username VARCHAR(32) NOT NULL,
    discriminator VARCHAR(4) NOT NULL,
    avatar VARCHAR(64),
    avatar_url VARCHAR(255),
    bot BOOLEAN DEFAULT FALSE NOT NULL,
    rank_card_data TEXT,
    preferred_locale VARCHAR(5) DEFAULT 'en',
    name VARCHAR(255),
    email VARCHAR(255),
    "emailVerified" TIMESTAMP,
    image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS guilds (
    id VARCHAR(20) PRIMARY KEY,
    prefix VARCHAR(10) DEFAULT '!' NOT NULL,
    language VARCHAR(5) DEFAULT 'en' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id VARCHAR(20) PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
    welcome_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    welcome_channel VARCHAR(20),
    welcome_message TEXT,
    welcome_embed_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    welcome_image_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    welcome_embed_color VARCHAR(7) DEFAULT '#8B5CF6',
    welcome_embed_title VARCHAR(255),
    welcome_embed_image VARCHAR(500),
    welcome_embed_thumbnail VARCHAR(500),
    welcome_dm_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    welcome_dm_message TEXT,
    goodbye_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    goodbye_channel VARCHAR(20),
    goodbye_message TEXT,
    goodbye_embed_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    goodbye_image_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    goodbye_embed_color VARCHAR(7) DEFAULT '#F43F5E',
    goodbye_embed_title VARCHAR(255),
    goodbye_embed_image VARCHAR(500),
    goodbye_embed_thumbnail VARCHAR(500),
    logs_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    logs_channel VARCHAR(20),
    xp_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    xp_rate INTEGER DEFAULT 1 NOT NULL,
    xp_per_message INTEGER DEFAULT 5 NOT NULL,
    xp_per_voice_minute INTEGER DEFAULT 10 NOT NULL,
    xp_cooldown INTEGER DEFAULT 60 NOT NULL,
    xp_announce_level_up BOOLEAN DEFAULT TRUE NOT NULL,
    xp_booster_role VARCHAR(20),
    xp_booster_multiplier INTEGER DEFAULT 200 NOT NULL,
    level_up_message TEXT,
    level_up_channel VARCHAR(20),
    achievements_channel VARCHAR(20),
    achievements_ignored_channels TEXT DEFAULT '[]' NOT NULL,
    custom_commands TEXT DEFAULT '[]' NOT NULL,
    custom_commands_channel VARCHAR(20),
    ai_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    ai_channel VARCHAR(20),
    ai_persona TEXT DEFAULT 'You are a helpful Discord bot assistant.',
    autorole_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    autorole_roles TEXT DEFAULT '[]' NOT NULL,
    security_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    security_alert_role VARCHAR(20),
    anti_raid_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    anti_spam_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    max_mentions INTEGER DEFAULT 5 NOT NULL,
    max_duplicates INTEGER DEFAULT 3 NOT NULL,
    honeypot_channel_id VARCHAR(20),
    stickies TEXT DEFAULT '[]' NOT NULL,
    public_levels BOOLEAN DEFAULT FALSE NOT NULL,
    public_eco BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Columns that may be missing on existing databases
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS welcome_image_enabled BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS goodbye_image_enabled BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS achievements_channel VARCHAR(20);
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS achievements_ignored_channels TEXT DEFAULT '[]' NOT NULL;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS custom_commands TEXT DEFAULT '[]' NOT NULL;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS custom_commands_channel VARCHAR(20);
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS ai_channel VARCHAR(20);
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS ai_persona TEXT DEFAULT 'You are a helpful Discord bot assistant.';
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS honeypot_channel_id VARCHAR(20);
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS stickies TEXT DEFAULT '[]' NOT NULL;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS public_levels BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS public_eco BOOLEAN DEFAULT FALSE NOT NULL;

CREATE TABLE IF NOT EXISTS members (
    user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
    nickname VARCHAR(32),
    joined_at TIMESTAMP NOT NULL,
    xp INTEGER DEFAULT 0 NOT NULL,
    level INTEGER DEFAULT 0 NOT NULL,
    messages INTEGER DEFAULT 0 NOT NULL,
    voice_minutes INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE IF NOT EXISTS mod_cases (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
    user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    moderator_id VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    type VARCHAR(20) NOT NULL,
    reason TEXT,
    duration INTEGER,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS user_xp (
    user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
    xp INTEGER DEFAULT 0 NOT NULL,
    level INTEGER DEFAULT 0 NOT NULL,
    prestige_level INTEGER DEFAULT 0 NOT NULL,
    last_xp_gain TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_voice_activity TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE IF NOT EXISTS xp_rewards (
    guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
    level INTEGER NOT NULL,
    role_id VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS xp_multipliers (
    guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
    target_id VARCHAR(20) NOT NULL,
    target_type VARCHAR(10) NOT NULL,
    multiplier INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS xp_settings (
    guild_id VARCHAR(20) PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
    ignored_channels TEXT DEFAULT '[]' NOT NULL,
    ignored_roles TEXT DEFAULT '[]' NOT NULL,
    no_xp_channels TEXT DEFAULT '[]' NOT NULL,
    double_xp_channels TEXT DEFAULT '[]' NOT NULL,
    role_multipliers TEXT DEFAULT '{}' NOT NULL,
    level_up_rewards_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    stack_role_rewards BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    channel_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'open' NOT NULL,
    claimed_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
    closed_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
    closed_at TIMESTAMP,
    transcript TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id VARCHAR(20) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]' NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_members_guild ON members(guild_id);
CREATE INDEX IF NOT EXISTS idx_members_xp ON members(guild_id, xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_xp_guild ON user_xp(guild_id);
CREATE INDEX IF NOT EXISTS idx_user_xp_combined ON user_xp(guild_id, xp DESC);
