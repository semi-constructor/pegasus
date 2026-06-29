import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { logger } from '../utils/logger';
import * as schema from './schema';

let db: ReturnType<typeof drizzle>;
let connection: postgres.Sql;

async function createAllTables() {
  try {
    // Create users table
    await connection`
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
      )
    `;
    await connection`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS image VARCHAR(255)
    `;

    // Create guilds table
    await connection`
      CREATE TABLE IF NOT EXISTS guilds (
        id VARCHAR(20) PRIMARY KEY,
        prefix VARCHAR(10) DEFAULT '!' NOT NULL,
        language VARCHAR(5) DEFAULT 'en' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    // Create guild_settings table
    await connection`
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
      )
    `;

    // Create members table
    await connection`
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
      )
    `;

    // Create moderation tables
    await connection`
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
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS warnings (
        id SERIAL PRIMARY KEY,
        warn_id VARCHAR(20) UNIQUE NOT NULL,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        moderator_id VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        level INTEGER DEFAULT 1 NOT NULL,
        proof TEXT,
        active BOOLEAN DEFAULT TRUE NOT NULL,
        edited_at TIMESTAMP,
        edited_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS warning_automations (
        id SERIAL PRIMARY KEY,
        automation_id VARCHAR(20) UNIQUE NOT NULL,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        trigger_type VARCHAR(50) NOT NULL,
        trigger_value INTEGER NOT NULL,
        actions JSONB NOT NULL,
        enabled BOOLEAN DEFAULT TRUE NOT NULL,
        created_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        last_triggered_at TIMESTAMP
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS mod_log_settings (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        category VARCHAR(50) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT mod_log_settings_guild_category_unique UNIQUE (guild_id, category)
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS word_filter_rules (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        pattern TEXT NOT NULL,
        match_type VARCHAR(20) DEFAULT 'literal' NOT NULL,
        case_sensitive BOOLEAN DEFAULT FALSE NOT NULL,
        whole_word BOOLEAN DEFAULT TRUE NOT NULL,
        severity VARCHAR(20) DEFAULT 'medium' NOT NULL,
        auto_delete BOOLEAN DEFAULT TRUE NOT NULL,
        notify_channel_id VARCHAR(20),
        actions JSONB DEFAULT '[]'::jsonb NOT NULL,
        created_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    await connection`
      CREATE INDEX IF NOT EXISTS word_filter_rules_guild_idx ON word_filter_rules (guild_id)
    `;

    // Create XP tables
    await connection`
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
      )
    `;
    await connection`
      ALTER TABLE user_xp ADD COLUMN IF NOT EXISTS prestige_level INTEGER DEFAULT 0 NOT NULL
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS xp_rewards (
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        level INTEGER NOT NULL,
        role_id VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS xp_multipliers (
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        target_id VARCHAR(20) NOT NULL,
        target_type VARCHAR(10) NOT NULL,
        multiplier INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    await connection`
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
      )
    `;

    // Create economy tables
    await connection`
      CREATE TABLE IF NOT EXISTS economy_balances (
        user_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        balance BIGINT DEFAULT 0 NOT NULL,
        bank_balance BIGINT DEFAULT 0 NOT NULL,
        total_earned BIGINT DEFAULT 0 NOT NULL,
        total_spent BIGINT DEFAULT 0 NOT NULL,
        total_gambled BIGINT DEFAULT 0 NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (user_id, guild_id)
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS economy_transactions (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        amount BIGINT NOT NULL,
        description TEXT,
        metadata JSONB,
        related_user_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS economy_shop_items (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        price BIGINT NOT NULL,
        type VARCHAR(50) NOT NULL,
        effect_type VARCHAR(50),
        effect_value JSONB,
        stock INTEGER DEFAULT -1,
        requires_role VARCHAR(255),
        enabled BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE(guild_id, name)
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS economy_user_items (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        item_id VARCHAR(255) NOT NULL,
        quantity INTEGER DEFAULT 1 NOT NULL,
        purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        expires_at TIMESTAMP,
        active BOOLEAN DEFAULT TRUE NOT NULL
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS economy_cooldowns (
        user_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        command_type VARCHAR(50) NOT NULL,
        last_used TIMESTAMP NOT NULL,
        next_available TIMESTAMP NOT NULL,
        PRIMARY KEY (user_id, guild_id, command_type)
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS economy_gambling_stats (
        user_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        game_type VARCHAR(50) NOT NULL,
        games_played INTEGER DEFAULT 0 NOT NULL,
        games_won INTEGER DEFAULT 0 NOT NULL,
        total_wagered BIGINT DEFAULT 0 NOT NULL,
        total_won BIGINT DEFAULT 0 NOT NULL,
        biggest_win BIGINT DEFAULT 0 NOT NULL,
        biggest_loss BIGINT DEFAULT 0 NOT NULL,
        current_streak INTEGER DEFAULT 0 NOT NULL,
        best_streak INTEGER DEFAULT 0 NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (user_id, guild_id, game_type)
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS economy_settings (
        guild_id VARCHAR(255) PRIMARY KEY,
        currency_symbol VARCHAR(10) DEFAULT '💰' NOT NULL,
        currency_name VARCHAR(50) DEFAULT 'coins' NOT NULL,
        starting_balance BIGINT DEFAULT 100 NOT NULL,
        daily_amount BIGINT DEFAULT 100 NOT NULL,
        daily_streak BOOLEAN DEFAULT TRUE NOT NULL,
        daily_streak_bonus BIGINT DEFAULT 10 NOT NULL,
        work_min_amount BIGINT DEFAULT 50 NOT NULL,
        work_max_amount BIGINT DEFAULT 200 NOT NULL,
        work_cooldown INTEGER DEFAULT 3600 NOT NULL,
        rob_enabled BOOLEAN DEFAULT TRUE NOT NULL,
        rob_min_amount BIGINT DEFAULT 100 NOT NULL,
        rob_success_rate INTEGER DEFAULT 50 NOT NULL,
        rob_cooldown INTEGER DEFAULT 86400 NOT NULL,
        rob_protection_cost BIGINT DEFAULT 1000 NOT NULL,
        rob_protection_duration INTEGER DEFAULT 86400 NOT NULL,
        max_bet BIGINT DEFAULT 10000 NOT NULL,
        min_bet BIGINT DEFAULT 10 NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    // Create ticket tables
    await connection`
      CREATE TABLE IF NOT EXISTS ticket_panels (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        panel_id VARCHAR(20) UNIQUE NOT NULL,
        title VARCHAR(256) NOT NULL,
        description TEXT NOT NULL,
        image_url VARCHAR(512),
        footer VARCHAR(256),
        button_label VARCHAR(80) DEFAULT 'Create Ticket' NOT NULL,
        button_style INTEGER DEFAULT 1 NOT NULL,
        support_roles JSONB DEFAULT '[]' NOT NULL,
        category_id VARCHAR(20),
        ticket_name_format VARCHAR(100) DEFAULT 'ticket-{number}' NOT NULL,
        max_tickets_per_user INTEGER DEFAULT 1 NOT NULL,
        welcome_message TEXT,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        message_id VARCHAR(20),
        channel_id VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS tickets (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        panel_id UUID REFERENCES ticket_panels(id) ON DELETE SET NULL,
        ticket_number INTEGER NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'open' NOT NULL,
        claimed_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
        closed_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
        closed_reason TEXT,
        closed_at TIMESTAMP,
        locked_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
        locked_at TIMESTAMP,
        frozen_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
        frozen_at TIMESTAMP,
        transcript TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
        user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        content TEXT NOT NULL,
        attachments JSONB DEFAULT '[]' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    // Create giveaways table if it doesn't exist
    await connection`
      CREATE TABLE IF NOT EXISTS giveaways (
        giveaway_id VARCHAR(20) PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        message_id VARCHAR(20),
        hosted_by VARCHAR(20) NOT NULL,
        prize TEXT NOT NULL,
        description TEXT,
        winner_count INTEGER DEFAULT 1 NOT NULL,
        end_time TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'ended', 'cancelled')),
        entries INTEGER DEFAULT 0 NOT NULL,
        requirements JSON DEFAULT '{}' NOT NULL,
        bonus_entries JSON DEFAULT '{}' NOT NULL,
        embed_color INTEGER DEFAULT 39423 NOT NULL,
        winners JSON,
        ended_at TIMESTAMP,
        announcement_sent BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    await connection`
      ALTER TABLE IF EXISTS giveaways
      ADD COLUMN IF NOT EXISTS announcement_sent BOOLEAN DEFAULT FALSE NOT NULL
    `;

    // Create giveaway_entries table if it doesn't exist
    await connection`
      CREATE TABLE IF NOT EXISTS giveaway_entries (
        giveaway_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        entries INTEGER DEFAULT 1 NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (giveaway_id, user_id)
      )
    `;

    // Create audit_logs table aligned with Drizzle schema
    await connection`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        target_id VARCHAR(20),
        target_type VARCHAR(50),
        details JSONB,
        ip_hash VARCHAR(64),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    // Legacy audit logs migration
    await connection`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'audit_logs' AND column_name = 'timestamp'
        ) THEN
          ALTER TABLE audit_logs DROP COLUMN timestamp;
        END IF;
      EXCEPTION
        WHEN undefined_column THEN NULL;
      END $$;
    `;

    await connection`
      CREATE INDEX IF NOT EXISTS audit_logs_guild_idx ON audit_logs(guild_id)
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs(user_id)
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS audit_logs_target_idx ON audit_logs(target_id)
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action)
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at)
    `;

    // Create blacklist table aligned with Drizzle schema
    await connection`
      CREATE TABLE IF NOT EXISTS blacklist (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        entity_type VARCHAR(20) NOT NULL,
        entity_id VARCHAR(20) NOT NULL,
        reason TEXT NOT NULL,
        added_by VARCHAR(20) NOT NULL,
        active BOOLEAN DEFAULT TRUE NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    // Migrate legacy blacklist schema
    await connection`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'blacklist' AND column_name = 'id'
        ) THEN
          ALTER TABLE blacklist ADD COLUMN id UUID;
        END IF;
      EXCEPTION
        WHEN undefined_table THEN NULL;
      END $$;
    `;

    await connection`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'blacklist' AND column_name = 'entity_type'
        ) THEN
          ALTER TABLE blacklist ADD COLUMN entity_type VARCHAR(20);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'blacklist' AND column_name = 'entity_id'
        ) THEN
          ALTER TABLE blacklist ADD COLUMN entity_id VARCHAR(20);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'blacklist' AND column_name = 'added_by'
        ) THEN
          ALTER TABLE blacklist ADD COLUMN added_by VARCHAR(20);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'blacklist' AND column_name = 'active'
        ) THEN
          ALTER TABLE blacklist ADD COLUMN active BOOLEAN DEFAULT TRUE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'blacklist' AND column_name = 'metadata'
        ) THEN
          ALTER TABLE blacklist ADD COLUMN metadata JSONB;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'blacklist' AND column_name = 'updated_at'
        ) THEN
          ALTER TABLE blacklist ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        END IF;
      EXCEPTION
        WHEN undefined_table THEN NULL;
      END $$;
    `;

    await connection`
      UPDATE blacklist
      SET entity_type = 'user'
      WHERE entity_type IS NULL
    `;
    await connection`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'blacklist' AND column_name = 'user_id'
        ) THEN
          UPDATE blacklist
          SET entity_id = COALESCE(entity_id, user_id)
          WHERE entity_id IS NULL;
        END IF;
      END $$;
    `;
    await connection`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'blacklist' AND column_name = 'moderator_id'
        ) THEN
          UPDATE blacklist
          SET added_by = COALESCE(added_by, moderator_id)
          WHERE added_by IS NULL;
        END IF;
      END $$;
    `;
    await connection`
      UPDATE blacklist
      SET active = TRUE
      WHERE active IS NULL
    `;
    await connection`
      UPDATE blacklist
      SET id = gen_random_uuid()
      WHERE id IS NULL
    `;
    await connection`
      UPDATE blacklist
      SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
    `;

    await connection`
      ALTER TABLE blacklist ALTER COLUMN id SET DEFAULT gen_random_uuid()
    `;
    await connection`
      ALTER TABLE blacklist ALTER COLUMN id SET NOT NULL
    `;
    await connection`
      ALTER TABLE blacklist ALTER COLUMN entity_type SET NOT NULL
    `;
    await connection`
      ALTER TABLE blacklist ALTER COLUMN entity_id SET NOT NULL
    `;
    await connection`
      ALTER TABLE blacklist ALTER COLUMN added_by SET NOT NULL
    `;
    await connection`
      ALTER TABLE blacklist ALTER COLUMN active SET NOT NULL
    `;
    await connection`
      ALTER TABLE blacklist ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP
    `;
    await connection`
      ALTER TABLE blacklist ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP
    `;

    await connection`
      DO $$
      BEGIN
        ALTER TABLE blacklist DROP CONSTRAINT IF EXISTS blacklist_pkey;
        ALTER TABLE blacklist ADD PRIMARY KEY (id);
      EXCEPTION
        WHEN undefined_table THEN NULL;
      END $$;
    `;

    await connection`
      CREATE UNIQUE INDEX IF NOT EXISTS blacklist_entity_idx
      ON blacklist(entity_type, entity_id)
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS blacklist_active_idx
      ON blacklist(active)
    `;

    // Create security logs table
    await connection`
      CREATE TABLE IF NOT EXISTS security_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20),
        action VARCHAR(100) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        description TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS security_logs_guild_idx ON security_logs(guild_id)
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS security_logs_user_idx ON security_logs(user_id)
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS security_logs_action_idx ON security_logs(action)
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS security_logs_severity_idx ON security_logs(severity)
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS security_logs_created_at_idx ON security_logs(created_at)
    `;

    // Create rate limit violations table
    await connection`
      CREATE TABLE IF NOT EXISTS rate_limit_violations (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20),
        endpoint VARCHAR(100) NOT NULL,
        violations BIGINT DEFAULT 1 NOT NULL,
        blocked BOOLEAN DEFAULT FALSE NOT NULL,
        blocked_until TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;
    await connection`
      CREATE UNIQUE INDEX IF NOT EXISTS rate_limit_user_endpoint_idx
      ON rate_limit_violations(user_id, endpoint)
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS rate_limit_blocked_idx
      ON rate_limit_violations(blocked)
    `;

    // Create security incidents table
    await connection`
      CREATE TABLE IF NOT EXISTS security_incidents (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        incident_id VARCHAR(20) NOT NULL UNIQUE,
        guild_id VARCHAR(20) NOT NULL,
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'open' NOT NULL,
        description TEXT NOT NULL,
        affected_users JSONB DEFAULT '[]'::jsonb NOT NULL,
        actions JSONB DEFAULT '[]'::jsonb NOT NULL,
        resolved_by VARCHAR(20),
        resolved_at TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS security_incidents_guild_idx ON security_incidents(guild_id)
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS security_incidents_type_idx ON security_incidents(type)
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS security_incidents_status_idx ON security_incidents(status)
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS security_incidents_severity_idx ON security_incidents(severity)
    `;

    // Create API keys table
    await connection`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        key_hash VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        permissions JSONB DEFAULT '[]'::jsonb NOT NULL,
        rate_limit BIGINT DEFAULT 1000 NOT NULL,
        expires_at TIMESTAMP,
        last_used_at TIMESTAMP,
        active BOOLEAN DEFAULT TRUE NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys(user_id)
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS api_keys_active_idx ON api_keys(active)
    `;

    // Create JTC tables
    await connection`
      CREATE TABLE IF NOT EXISTS jtc_configs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL UNIQUE,
        base_voice_channel_id VARCHAR(20) NOT NULL,
        category_id VARCHAR(20) NOT NULL,
        panel_channel_id VARCHAR(20) NOT NULL,
        panel_message_id VARCHAR(20),
        channel_name_format VARCHAR(100) DEFAULT '{user}\''s Channel' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;
    await connection`
      CREATE TABLE IF NOT EXISTS jtc_channels (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        channel_id VARCHAR(20) NOT NULL UNIQUE,
        owner_id VARCHAR(20) NOT NULL,
        base_voice_channel_id VARCHAR(20) NOT NULL,
        is_locked BOOLEAN DEFAULT FALSE NOT NULL,
        user_limit INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    // Create AutoMod tables
    await connection`
      CREATE TABLE IF NOT EXISTS auto_mod_rules (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        event_type VARCHAR(50) NOT NULL,
        trigger_type VARCHAR(50) NOT NULL,
        trigger_metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
        conditions JSONB DEFAULT '{}'::jsonb NOT NULL,
        exempt_roles JSONB DEFAULT '[]'::jsonb NOT NULL,
        exempt_channels JSONB DEFAULT '[]'::jsonb NOT NULL,
        actions JSONB DEFAULT '[]'::jsonb NOT NULL,
        enabled BOOLEAN DEFAULT TRUE NOT NULL,
        created_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS auto_mod_rules_guild_event_idx ON auto_mod_rules(guild_id, event_type)
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS auto_mod_rules_enabled_idx ON auto_mod_rules(enabled)
    `;
    await connection`
      CREATE TABLE IF NOT EXISTS auto_mod_infractions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        rule_id UUID REFERENCES auto_mod_rules(id) ON DELETE SET NULL,
        points INTEGER DEFAULT 1 NOT NULL,
        action_taken VARCHAR(50) NOT NULL,
        reason TEXT,
        active BOOLEAN DEFAULT TRUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS auto_mod_infractions_guild_user_idx ON auto_mod_infractions(guild_id, user_id)
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS auto_mod_infractions_active_idx ON auto_mod_infractions(active)
    `;
    await connection`
      CREATE TABLE IF NOT EXISTS quarantine_vault (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        original_roles JSONB DEFAULT '[]'::jsonb NOT NULL,
        reason TEXT,
        jailed_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
        released BOOLEAN DEFAULT FALSE NOT NULL,
        released_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
        released_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS quarantine_vault_guild_user_active_idx ON quarantine_vault(guild_id, user_id, released)
    `;

    // Create Engagement tables
    await connection`
      CREATE TABLE IF NOT EXISTS achievements (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        achievement_id VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        requirement_type VARCHAR(50) NOT NULL,
        requirement_value INTEGER NOT NULL,
        reward_xp INTEGER DEFAULT 0 NOT NULL,
        reward_coins INTEGER DEFAULT 0 NOT NULL,
        custom_icon VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE(guild_id, achievement_id)
      )
    `;
    await connection`
      CREATE TABLE IF NOT EXISTS user_achievements (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE NOT NULL,
        unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE(guild_id, user_id, achievement_id)
      )
    `;
    await connection`
      CREATE TABLE IF NOT EXISTS engagement_quests (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        quest_id VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        type VARCHAR(20) NOT NULL,
        target_type VARCHAR(50) NOT NULL,
        target_value INTEGER NOT NULL,
        reward_xp INTEGER DEFAULT 0 NOT NULL,
        reward_coins INTEGER DEFAULT 0 NOT NULL,
        active_until TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS engagement_quests_guild_type_idx ON engagement_quests(guild_id, type)
    `;
    await connection`
      CREATE TABLE IF NOT EXISTS user_quest_progress (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        quest_id UUID REFERENCES engagement_quests(id) ON DELETE CASCADE NOT NULL,
        progress INTEGER DEFAULT 0 NOT NULL,
        completed BOOLEAN DEFAULT FALSE NOT NULL,
        completed_at TIMESTAMP,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE(guild_id, user_id, quest_id)
      )
    `;
    await connection`
      CREATE TABLE IF NOT EXISTS user_reputation (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        sender_id VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS user_reputation_guild_user_idx ON user_reputation(guild_id, user_id)
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS user_reputation_guild_sender_idx ON user_reputation(guild_id, sender_id)
    `;

    // Create Ticket Workflows tables
    await connection`
      CREATE TABLE IF NOT EXISTS ticket_departments (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        panel_id UUID REFERENCES ticket_panels(id) ON DELETE CASCADE NOT NULL,
        department_id VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NOT NULL,
        emoji VARCHAR(50),
        category_id VARCHAR(20),
        support_roles JSONB DEFAULT '[]'::jsonb NOT NULL,
        modal_fields JSONB DEFAULT '[]'::jsonb NOT NULL,
        welcome_message TEXT,
        sla_timeout_minutes INTEGER DEFAULT 60 NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS ticket_departments_panel_idx ON ticket_departments(panel_id)
    `;
    await connection`
      CREATE TABLE IF NOT EXISTS ticket_ratings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
        user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        claimed_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
        rating INTEGER NOT NULL,
        feedback TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS ticket_ratings_guild_staff_idx ON ticket_ratings(guild_id, claimed_by)
    `;
    await connection`
      CREATE INDEX IF NOT EXISTS ticket_ratings_ticket_idx ON ticket_ratings(ticket_id)
    `;

    await connection`
      ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES ticket_departments(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN DEFAULT FALSE NOT NULL,
      ADD COLUMN IF NOT EXISTS rating_id UUID REFERENCES ticket_ratings(id) ON DELETE SET NULL
    `;

    // Create indexes for better performance
    await connection`CREATE INDEX IF NOT EXISTS idx_members_guild ON members(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_members_xp ON members(guild_id, xp DESC)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_user_xp_guild ON user_xp(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_user_xp_combined ON user_xp(guild_id, xp DESC)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(user_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_warnings_guild ON warnings(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_giveaways_guild ON giveaways(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_giveaways_status ON giveaways(status)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_giveaways_end_time ON giveaways(end_time)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_giveaway_entries_user ON giveaway_entries(user_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_balances_user ON economy_balances(user_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_balances_guild ON economy_balances(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_balances_balance ON economy_balances(balance)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_transactions_user ON economy_transactions(user_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_transactions_guild ON economy_transactions(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_transactions_type ON economy_transactions(type)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_transactions_created_at ON economy_transactions(created_at)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_shop_items_guild ON economy_shop_items(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_shop_items_enabled ON economy_shop_items(enabled)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_user_items_user ON economy_user_items(user_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_user_items_guild ON economy_user_items(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_user_items_item ON economy_user_items(item_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_user_items_expires_at ON economy_user_items(expires_at)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_user_items_active ON economy_user_items(active)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_cooldowns_user ON economy_cooldowns(user_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_cooldowns_guild ON economy_cooldowns(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_cooldowns_next_available ON economy_cooldowns(next_available)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_gambling_stats_user ON economy_gambling_stats(user_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_gambling_stats_guild ON economy_gambling_stats(guild_id)`;

    logger.info('All database tables created/verified successfully');
  } catch (error) {
    logger.warn('Could not create tables (they may already exist):', error);
  }
}

export async function initializeDatabase() {
  try {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const parseNumber = (value: string | undefined, fallback: number) => {
      if (!value) {
        return fallback;
      }
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const maxConnections = parseNumber(process.env.DB_MAX_CONNECTIONS, 10);
    const idleTimeout = parseNumber(process.env.DB_IDLE_TIMEOUT, 20);
    const connectTimeout = parseNumber(process.env.DB_CONNECT_TIMEOUT, 10);

    const connectionOptions: Parameters<typeof postgres>[1] = {
      max: maxConnections,
      idle_timeout: idleTimeout,
      connect_timeout: connectTimeout,
      onnotice: () => {},
    };

    const sslPreference = process.env.DB_SSL?.toLowerCase();
    if (connectionString.includes('sslmode=require') || connectionString.includes('.neon.tech')) {
      connectionOptions.ssl = 'require';
    } else if (sslPreference === 'false') {
      connectionOptions.ssl = false;
    } else {
      connectionOptions.ssl = 'require';
    }

    // Create the connection
    connection = postgres(connectionString, connectionOptions);

    // Create the drizzle instance
    db = drizzle(connection, { schema });

    // Test the connection
    await connection`SELECT 1`;

    logger.info('Database connection established successfully');

    // Create all database tables if they don't exist
    await createAllTables();
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export async function closeDatabase() {
  if (connection) {
    await connection.end();
    logger.info('Database connection closed');
  }
}

// Export db as a getter function since it may not be initialized immediately
export { getDatabase as db };
