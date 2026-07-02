import {
  pgTable,
  varchar,
  timestamp,
  boolean,
  jsonb,
  uuid,
  bigint,
  text,
  serial,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Security logs table
export const securityLogs = pgTable(
  'security_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: varchar('guild_id', { length: 20 }).notNull(),
    userId: varchar('user_id', { length: 20 }),
    action: varchar('action', { length: 100 }).notNull(),
    severity: varchar('severity', { length: 20 }).notNull(), // low, medium, high, critical
    description: text('description').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  table => {
    return {
      guildIdx: index('security_logs_guild_idx').on(table.guildId),
      userIdx: index('security_logs_user_idx').on(table.userId),
      actionIdx: index('security_logs_action_idx').on(table.action),
      severityIdx: index('security_logs_severity_idx').on(table.severity),
      createdAtIdx: index('security_logs_created_at_idx').on(table.createdAt),
    };
  }
);

// Blacklist table
export const blacklist = pgTable(
  'blacklist',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    entityType: varchar('entity_type', { length: 20 }).notNull(), // user, guild, role
    entityId: varchar('entity_id', { length: 20 }).notNull(),
    reason: text('reason').notNull(),
    addedBy: varchar('added_by', { length: 20 }).notNull(),
    active: boolean('active').notNull().default(true),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => {
    return {
      entityIdx: uniqueIndex('blacklist_entity_idx').on(table.entityType, table.entityId),
      activeIdx: index('blacklist_active_idx').on(table.active),
    };
  }
);

// Audit logs table (enhanced version)
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    action: varchar('action', { length: 100 }).notNull(),
    userId: varchar('user_id', { length: 20 }).notNull(),
    guildId: varchar('guild_id', { length: 20 }).notNull(),
    targetId: varchar('target_id', { length: 20 }),
    targetType: varchar('target_type', { length: 50 }),
    details: jsonb('details'),
    ipHash: varchar('ip_hash', { length: 64 }), // Hashed IP for security
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  table => {
    return {
      guildIdx: index('audit_logs_guild_idx').on(table.guildId),
      userIdx: index('audit_logs_user_idx').on(table.userId),
      targetIdx: index('audit_logs_target_idx').on(table.targetId),
      actionIdx: index('audit_logs_action_idx').on(table.action),
      createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
    };
  }
);

// Rate limit violations table
export const rateLimitViolations = pgTable(
  'rate_limit_violations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: varchar('user_id', { length: 20 }).notNull(),
    guildId: varchar('guild_id', { length: 20 }),
    endpoint: varchar('endpoint', { length: 100 }).notNull(),
    violations: bigint('violations', { mode: 'number' }).notNull().default(1),
    blocked: boolean('blocked').notNull().default(false),
    blockedUntil: timestamp('blocked_until'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => {
    return {
      userEndpointIdx: uniqueIndex('rate_limit_user_endpoint_idx').on(table.userId, table.endpoint),
      blockedIdx: index('rate_limit_blocked_idx').on(table.blocked),
    };
  }
);

// Security incidents table
export const securityIncidents = pgTable(
  'security_incidents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    incidentId: varchar('incident_id', { length: 20 }).notNull().unique(),
    guildId: varchar('guild_id', { length: 20 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    severity: varchar('severity', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('open'), // open, investigating, resolved, false_positive
    description: text('description').notNull(),
    affectedUsers: jsonb('affected_users').notNull().default('[]'),
    actions: jsonb('actions').notNull().default('[]'),
    resolvedBy: varchar('resolved_by', { length: 20 }),
    resolvedAt: timestamp('resolved_at'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => {
    return {
      guildIdx: index('security_incidents_guild_idx').on(table.guildId),
      typeIdx: index('security_incidents_type_idx').on(table.type),
      statusIdx: index('security_incidents_status_idx').on(table.status),
      severityIdx: index('security_incidents_severity_idx').on(table.severity),
    };
  }
);

// API keys table
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    userId: varchar('user_id', { length: 20 }).notNull(),
    permissions: jsonb('permissions').notNull().default('[]'),
    rateLimit: bigint('rate_limit', { mode: 'number' }).notNull().default(1000),
    expiresAt: timestamp('expires_at'),
    lastUsedAt: timestamp('last_used_at'),
    active: boolean('active').notNull().default(true),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => {
    return {
      userIdx: index('api_keys_user_idx').on(table.userId),
      activeIdx: index('api_keys_active_idx').on(table.active),
    };
  }
);

// Relations
export const securityLogsRelations = relations(securityLogs, () => ({
  // Add relations as needed
}));

export const blacklistRelations = relations(blacklist, () => ({
  // Add relations as needed
}));

export const auditLogsRelations = relations(auditLogs, () => ({
  // Add relations as needed
}));

export const rateLimitViolationsRelations = relations(rateLimitViolations, () => ({
  // Add relations as needed
}));

export const securityIncidentsRelations = relations(securityIncidents, () => ({
  // Add relations as needed
}));

export const apiKeysRelations = relations(apiKeys, () => ({
  // Add relations as needed
}));
