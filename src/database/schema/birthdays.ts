import {
  pgTable,
  varchar,
  timestamp,
  uuid,
  index,
  boolean,
  uniqueIndex,
  integer,
} from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

export const birthdaySettings = pgTable('birthday_settings', {
  guildId: varchar('guild_id', { length: 20 })
    .primaryKey()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  channelId: varchar('channel_id', { length: 20 }),
  message: varchar('message', { length: 2000 }).default('Happy Birthday <@user>! 🎉').notNull(),
  enabled: boolean('enabled').default(false).notNull(),
});

export const userBirthdays = pgTable(
  'user_birthdays',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: varchar('user_id', { length: 20 })
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    guildId: varchar('guild_id', { length: 20 })
      .references(() => guilds.id, { onDelete: 'cascade' })
      .notNull(),
    month: integer('month').notNull(), // 1-12
    day: integer('day').notNull(), // 1-31
    year: integer('year'), // Optional
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    guildUserIdx: uniqueIndex('user_birthdays_guild_user_idx').on(table.guildId, table.userId),
    monthDayIdx: index('user_birthdays_month_day_idx').on(table.month, table.day),
  })
);
