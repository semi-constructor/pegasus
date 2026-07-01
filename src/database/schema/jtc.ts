import { pgTable, varchar, timestamp, uuid, boolean, integer } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';

export const jtcConfigs = pgTable('jtc_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: varchar('guild_id', { length: 20 })
    .references(() => guilds.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  baseVoiceChannelId: varchar('base_voice_channel_id', { length: 20 }).notNull(),
  categoryId: varchar('category_id', { length: 20 }).notNull(),
  panelChannelId: varchar('panel_channel_id', { length: 20 }).notNull(),
  panelMessageId: varchar('panel_message_id', { length: 20 }),
  channelNameFormat: varchar('channel_name_format', { length: 100 })
    .default("{user}'s Channel")
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const jtcChannels = pgTable('jtc_channels', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: varchar('guild_id', { length: 20 })
    .references(() => guilds.id, { onDelete: 'cascade' })
    .notNull(),
  channelId: varchar('channel_id', { length: 20 }).notNull().unique(),
  ownerId: varchar('owner_id', { length: 20 }).notNull(),
  baseVoiceChannelId: varchar('base_voice_channel_id', { length: 20 }).notNull(),
  isLocked: boolean('is_locked').default(false).notNull(),
  userLimit: integer('user_limit').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
