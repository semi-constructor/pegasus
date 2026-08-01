import { pgTable, varchar, timestamp, boolean, text } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: varchar('id', { length: 20 }).primaryKey(),
  globalName: varchar('global_name', { length: 32 }),
  username: varchar('username', { length: 32 }).notNull(),
  discriminator: varchar('discriminator', { length: 4 }).notNull(),
  avatar: varchar('avatar', { length: 64 }),
  avatarUrl: varchar('avatar_url', { length: 255 }),
  bot: boolean('bot').default(false).notNull(),
  rankCardData: text('rank_card_data'),
  preferredLocale: varchar('preferred_locale', { length: 5 }).default('en'),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: varchar("image", { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
