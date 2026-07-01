import {
  pgTable,
  varchar,
  timestamp,
  integer,
  text,
  boolean,
  uuid,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

export const achievements = pgTable(
  'achievements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: varchar('guild_id', { length: 20 })
      .references(() => guilds.id, { onDelete: 'cascade' })
      .notNull(),
    achievementId: varchar('achievement_id', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),
    requirementType: varchar('requirement_type', { length: 50 }).notNull(),
    requirementValue: integer('requirement_value').notNull(),
    rewardXp: integer('reward_xp').default(0).notNull(),
    rewardCoins: integer('reward_coins').default(0).notNull(),
    customIcon: varchar('custom_icon', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    guildAchievementIdx: uniqueIndex('achievements_guild_id_idx').on(
      table.guildId,
      table.achievementId
    ),
  })
);

export const userAchievements = pgTable(
  'user_achievements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: varchar('guild_id', { length: 20 })
      .references(() => guilds.id, { onDelete: 'cascade' })
      .notNull(),
    userId: varchar('user_id', { length: 20 })
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    achievementId: uuid('achievement_id')
      .references(() => achievements.id, { onDelete: 'cascade' })
      .notNull(),
    unlockedAt: timestamp('unlocked_at').defaultNow().notNull(),
  },
  table => ({
    userGuildAchievementIdx: uniqueIndex('user_achievements_unique_idx').on(
      table.guildId,
      table.userId,
      table.achievementId
    ),
  })
);

export const engagementQuests = pgTable(
  'engagement_quests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: varchar('guild_id', { length: 20 })
      .references(() => guilds.id, { onDelete: 'cascade' })
      .notNull(),
    questId: varchar('quest_id', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    targetType: varchar('target_type', { length: 50 }).notNull(),
    targetValue: integer('target_value').notNull(),
    rewardXp: integer('reward_xp').default(0).notNull(),
    rewardCoins: integer('reward_coins').default(0).notNull(),
    activeUntil: timestamp('active_until').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    guildTypeIdx: index('engagement_quests_guild_type_idx').on(table.guildId, table.type),
  })
);

export const userQuestProgress = pgTable(
  'user_quest_progress',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: varchar('guild_id', { length: 20 })
      .references(() => guilds.id, { onDelete: 'cascade' })
      .notNull(),
    userId: varchar('user_id', { length: 20 })
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    questId: uuid('quest_id')
      .references(() => engagementQuests.id, { onDelete: 'cascade' })
      .notNull(),
    progress: integer('progress').default(0).notNull(),
    completed: boolean('completed').default(false).notNull(),
    completedAt: timestamp('completed_at'),
    lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  },
  table => ({
    userQuestIdx: uniqueIndex('user_quest_progress_unique_idx').on(
      table.guildId,
      table.userId,
      table.questId
    ),
  })
);

export const userReputation = pgTable(
  'user_reputation',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: varchar('guild_id', { length: 20 })
      .references(() => guilds.id, { onDelete: 'cascade' })
      .notNull(),
    userId: varchar('user_id', { length: 20 })
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    senderId: varchar('sender_id', { length: 20 })
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    guildUserIdx: index('user_reputation_guild_user_idx').on(table.guildId, table.userId),
    guildSenderIdx: index('user_reputation_guild_sender_idx').on(table.guildId, table.senderId),
  })
);
