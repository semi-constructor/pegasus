import {
  pgTable,
  varchar,
  timestamp,
  uuid,
  index,
  boolean,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { guilds } from './guilds';

export const socialFeeds = pgTable(
  'social_feeds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: varchar('guild_id', { length: 20 })
      .references(() => guilds.id, { onDelete: 'cascade' })
      .notNull(),
    feedType: varchar('feed_type', { length: 20 }).notNull(), // 'youtube' or 'rss'
    feedUrl: varchar('feed_url', { length: 500 }).notNull(),
    channelId: varchar('channel_id', { length: 20 }).notNull(),
    mentionRole: varchar('mention_role', { length: 20 }), // Role ID to ping
    customMessage: varchar('custom_message', { length: 2000 }),
    lastEntryId: varchar('last_entry_id', { length: 255 }), // to track what was last posted
    enabled: boolean('enabled').default(true).notNull(),
    youtubeLongformOnly: boolean('youtube_longform_only').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    guildTypeIdx: index('social_feeds_guild_type_idx').on(table.guildId, table.feedType),
  })
);
