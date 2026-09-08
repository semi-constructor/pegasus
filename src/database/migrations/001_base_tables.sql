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
    welcome_embed_color VARCHAR(7) DEFAULT '#0099FF',
    welcome_embed_title VARCHAR(255),
    welcome_embed_image VARCHAR(500),
    welcome_embed_thumbnail VARCHAR(500),
    welcome_dm_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    welcome_dm_message TEXT,
    goodbye_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    goodbye_channel VARCHAR(20),
    goodbye_message TEXT,
    goodbye_embed_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    goodbye_embed_color VARCHAR(7) DEFAULT '#FF0000',
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
    autorole_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    autorole_roles TEXT DEFAULT '[]' NOT NULL,
    security_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    security_alert_role VARCHAR(20),
    anti_raid_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    anti_spam_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    max_mentions INTEGER DEFAULT 5 NOT NULL,
    max_duplicates INTEGER DEFAULT 3 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

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

CREATE INDEX IF NOT EXISTS idx_members_guild ON members(guild_id);
CREATE INDEX IF NOT EXISTS idx_members_xp ON members(guild_id, xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_xp_guild ON user_xp(guild_id);
CREATE INDEX IF NOT EXISTS idx_user_xp_combined ON user_xp(guild_id, xp DESC);
