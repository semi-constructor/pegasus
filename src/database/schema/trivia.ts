import {
  pgTable,
  varchar,
  timestamp,
  uuid,
  index,
  jsonb,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';
import { guilds } from './guilds';

export const triviaGames = pgTable(
  'trivia_games',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: varchar('guild_id', { length: 20 })
      .references(() => guilds.id, { onDelete: 'cascade' })
      .notNull(),
    channelId: varchar('channel_id', { length: 20 }).notNull(),
    allowedRoles: jsonb('allowed_roles').default('[]').notNull(), // Array of role IDs, empty means everyone
    questions: jsonb('questions').notNull(), // Array of { question, options, correctIndex }
    rewardXp: integer('reward_xp').default(0).notNull(),
    rewardCoins: integer('reward_coins').default(0).notNull(),
    scheduledAt: timestamp('scheduled_at').notNull(),
    status: varchar('status', { length: 20 }).default('scheduled').notNull(), // scheduled, active, completed, cancelled
    winnerId: varchar('winner_id', { length: 20 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    guildStatusIdx: index('trivia_games_guild_status_idx').on(table.guildId, table.status),
    scheduledAtIdx: index('trivia_games_scheduled_at_idx').on(table.scheduledAt),
  })
);
