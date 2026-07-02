import {
  pgTable,
  varchar,
  timestamp,
  integer,
  text,
  json,
  primaryKey,
  boolean,
} from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

export const giveaways = pgTable('giveaways', {
  giveawayId: varchar('giveaway_id', { length: 20 }).primaryKey(),
  guildId: varchar('guild_id', { length: 20 })
    .references(() => guilds.id, { onDelete: 'cascade' })
    .notNull(),
  channelId: varchar('channel_id', { length: 20 }).notNull(),
  messageId: varchar('message_id', { length: 20 }),
  hostedBy: varchar('hosted_by', { length: 20 })
    .references(() => users.id, { onDelete: 'set null' })
    .notNull(),
  prize: text('prize').notNull(),
  description: text('description'),
  winnerCount: integer('winner_count').default(1).notNull(),
  endTime: timestamp('end_time').notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(), // active, ended, cancelled
  entries: integer('entries').default(0).notNull(),
  requirements: json('requirements').default({}).notNull(),
  bonusEntries: json('bonus_entries').default({}).notNull(),
  embedTitle: varchar('embed_title', { length: 255 }),
  embedColor: integer('embed_color').default(0x0099ff).notNull(),
  embedImage: varchar('embed_image', { length: 500 }),
  embedThumbnail: varchar('embed_thumbnail', { length: 500 }),
  winners: json('winners'),
  endedAt: timestamp('ended_at'),
  announcementSent: boolean('announcement_sent').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const giveawayEntries = pgTable(
  'giveaway_entries',
  {
    giveawayId: varchar('giveaway_id', { length: 20 })
      .references(() => giveaways.giveawayId, { onDelete: 'cascade' })
      .notNull(),
    userId: varchar('user_id', { length: 20 })
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    entries: integer('entries').default(1).notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    pk: primaryKey(table.giveawayId, table.userId),
  })
);
