import {
  pgTable,
  varchar,
  timestamp,
  integer,
  text,
  primaryKey,
  boolean,
} from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

export const userXp = pgTable(
  'user_xp',
  {
    userId: varchar('user_id', { length: 20 })
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    guildId: varchar('guild_id', { length: 20 })
      .references(() => guilds.id, { onDelete: 'cascade' })
      .notNull(),
    xp: integer('xp').default(0).notNull(),
    level: integer('level').default(0).notNull(),
    prestigeLevel: integer('prestige_level').default(0).notNull(),
    lastXpGain: timestamp('last_xp_gain').defaultNow().notNull(),
    lastVoiceActivity: timestamp('last_voice_activity'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    pk: primaryKey(table.userId, table.guildId),
  })
);

export const xpRewards = pgTable('xp_rewards', {
  guildId: varchar('guild_id', { length: 20 })
    .references(() => guilds.id, { onDelete: 'cascade' })
    .notNull(),
  level: integer('level').notNull(),
  roleId: varchar('role_id', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const xpMultipliers = pgTable('xp_multipliers', {
  guildId: varchar('guild_id', { length: 20 })
    .references(() => guilds.id, { onDelete: 'cascade' })
    .notNull(),
  targetId: varchar('target_id', { length: 20 }).notNull(), // role or channel ID
  targetType: varchar('target_type', { length: 10 }).notNull(), // 'role' or 'channel'
  multiplier: integer('multiplier').notNull(), // percentage (100 = 1x, 200 = 2x, etc.)
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const xpSettings = pgTable('xp_settings', {
  guildId: varchar('guild_id', { length: 20 })
    .primaryKey()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  ignoredChannels: text('ignored_channels').default('[]').notNull(), // JSON array
  ignoredRoles: text('ignored_roles').default('[]').notNull(), // JSON array
  noXpChannels: text('no_xp_channels').default('[]').notNull(), // JSON array
  doubleXpChannels: text('double_xp_channels').default('[]').notNull(), // JSON array
  roleMultipliers: text('role_multipliers').default('{}').notNull(), // JSON object
  levelUpRewardsEnabled: boolean('level_up_rewards_enabled').default(true).notNull(),
  stackRoleRewards: boolean('stack_role_rewards').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
