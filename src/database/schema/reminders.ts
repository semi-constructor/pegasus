import { pgTable, varchar, timestamp, text, boolean, serial } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

export const reminders = pgTable('reminders', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 20 })
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  guildId: varchar('guild_id', { length: 20 })
    .references(() => guilds.id, { onDelete: 'cascade' }),
  channelId: varchar('channel_id', { length: 20 }).notNull(),
  message: text('message').notNull(),
  fireAt: timestamp('fire_at').notNull(),
  completed: boolean('completed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
