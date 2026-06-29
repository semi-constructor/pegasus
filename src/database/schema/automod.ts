import { pgTable, varchar, timestamp, integer, text, boolean, jsonb, index, uuid } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

export const autoModRules = pgTable('auto_mod_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).references(() => guilds.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  triggerType: varchar('trigger_type', { length: 50 }).notNull(),
  triggerMetadata: jsonb('trigger_metadata').default('{}').notNull(),
  conditions: jsonb('conditions').default('{}').notNull(),
  exemptRoles: jsonb('exempt_roles').default('[]').notNull(),
  exemptChannels: jsonb('exempt_channels').default('[]').notNull(),
  actions: jsonb('actions').default('[]').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  createdBy: varchar('created_by', { length: 20 }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => ({
  guildEventIdx: index('auto_mod_rules_guild_event_idx').on(table.guildId, table.eventType, table.enabled),
  enabledIdx: index('auto_mod_rules_enabled_idx').on(table.enabled),
}));

export const autoModInfractions = pgTable('auto_mod_infractions', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).references(() => guilds.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar('user_id', { length: 20 }).references(() => users.id, { onDelete: 'cascade' }).notNull(),
  ruleId: uuid('rule_id').references(() => autoModRules.id, { onDelete: 'set null' }),
  points: integer('points').default(1).notNull(),
  actionTaken: varchar('action_taken', { length: 50 }).notNull(),
  reason: text('reason'),
  active: boolean('active').default(true).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  guildUserIdx: index('auto_mod_infractions_guild_user_idx').on(table.guildId, table.userId),
  activeIdx: index('auto_mod_infractions_active_idx').on(table.active),
}));

export const quarantineVault = pgTable('quarantine_vault', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).references(() => guilds.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar('user_id', { length: 20 }).references(() => users.id, { onDelete: 'cascade' }).notNull(),
  originalRoles: jsonb('original_roles').default('[]').notNull(),
  reason: text('reason'),
  jailedBy: varchar('jailed_by', { length: 20 }).references(() => users.id, { onDelete: 'set null' }),
  released: boolean('released').default(false).notNull(),
  releasedBy: varchar('released_by', { length: 20 }).references(() => users.id, { onDelete: 'set null' }),
  releasedAt: timestamp('released_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  guildUserActiveIdx: index('quarantine_vault_guild_user_active_idx').on(table.guildId, table.userId, table.released),
}));
