-- Warning System Tables

-- Create warnings table
CREATE TABLE IF NOT EXISTS warnings (
    id SERIAL PRIMARY KEY,
    warn_id VARCHAR(20) UNIQUE NOT NULL,
    guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    user_id VARCHAR(20) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    moderator_id VARCHAR(20) NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    level INTEGER DEFAULT 1 NOT NULL CHECK (level >= 1 AND level <= 10),
    proof TEXT,
    active BOOLEAN DEFAULT true NOT NULL,
    edited_at TIMESTAMP,
    edited_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create warning automations table
CREATE TABLE IF NOT EXISTS warning_automations (
    id SERIAL PRIMARY KEY,
    automation_id VARCHAR(20) UNIQUE NOT NULL,
    guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('warn_count', 'warn_level')),
    trigger_value INTEGER NOT NULL CHECK (trigger_value > 0),
    actions JSONB NOT NULL,
    enabled BOOLEAN DEFAULT true NOT NULL,
    created_by VARCHAR(20) NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_triggered_at TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_warnings_warn_id ON warnings(warn_id);
CREATE INDEX IF NOT EXISTS idx_warning_automations_guild ON warning_automations(guild_id) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_warning_automations_automation_id ON warning_automations(automation_id);

-- Create audit logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    user_id VARCHAR(20) NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    target_id VARCHAR(20),
    target_type VARCHAR(50),
    details JSONB,
    ip_hash VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Columns that may be missing on existing databases
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_type VARCHAR(50);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_hash VARCHAR(64);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Create index for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_guild ON audit_logs(guild_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(guild_id, target_id);

-- Add constraint for valid actions
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

WITH sanitized AS (
    SELECT
        id,
        CASE
            WHEN action IS NULL OR btrim(action) = '' THEN 'UNKNOWN'
            ELSE REGEXP_REPLACE(UPPER(action), '[^A-Z0-9]+', '_', 'g')
        END AS new_action
    FROM audit_logs
), normalized AS (
    SELECT
        id,
        CASE
            WHEN length(new_action) < 3 THEN 'UNKNOWN'
            ELSE new_action
        END AS final_action
    FROM sanitized
)
UPDATE audit_logs AS a
SET action = n.final_action
FROM normalized AS n
WHERE a.id = n.id
  AND (a.action IS NULL OR a.action !~ '^[A-Z0-9_]{3,100}$');

ALTER TABLE audit_logs
ADD CONSTRAINT audit_logs_action_check
CHECK (action ~ '^[A-Z0-9_]{3,100}$');
