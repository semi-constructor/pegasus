import { pgTable, varchar, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';

export const starboardSettings = pgTable('starboard_settings', {
  guildId: varchar('guild_id', { length: 20 })
    .primaryKey()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').default(false).notNull(),
  channelId: varchar('channel_id', { length: 20 }),
  threshold: integer('threshold').default(3).notNull(),
  emoji: varchar('emoji', { length: 50 }).default('⭐').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const starboardMessages = pgTable('starboard_messages', {
  messageId: varchar('message_id', { length: 20 }).primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  channelId: varchar('channel_id', { length: 20 }).notNull(),
  authorId: varchar('author_id', { length: 20 }).notNull(),
  starboardMessageId: varchar('starboard_message_id', { length: 20 }),
  stars: integer('stars').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
