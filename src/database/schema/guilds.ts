import { pgTable, varchar, timestamp, boolean, integer, text } from 'drizzle-orm/pg-core';

export const guilds = pgTable('guilds', {
  id: varchar('id', { length: 20 }).primaryKey(),
  prefix: varchar('prefix', { length: 10 }).default('!'),
  language: varchar('language', { length: 5 }).default('en'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const guildSettings = pgTable('guild_settings', {
  guildId: varchar('guild_id', { length: 20 })
    .primaryKey()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  // Welcome configuration
  welcomeEnabled: boolean('welcome_enabled').default(false).notNull(),
  welcomeChannel: varchar('welcome_channel', { length: 20 }),
  welcomeMessage: text('welcome_message'),
  welcomeEmbedEnabled: boolean('welcome_embed_enabled').default(false).notNull(),
  welcomeEmbedColor: varchar('welcome_embed_color', { length: 7 }).default('#0099FF'),
  welcomeEmbedTitle: varchar('welcome_embed_title', { length: 255 }),
  welcomeEmbedImage: varchar('welcome_embed_image', { length: 500 }),
  welcomeEmbedThumbnail: varchar('welcome_embed_thumbnail', { length: 500 }),
  welcomeDmEnabled: boolean('welcome_dm_enabled').default(false).notNull(),
  welcomeDmMessage: text('welcome_dm_message'),
  // Goodbye configuration
  goodbyeEnabled: boolean('goodbye_enabled').default(false).notNull(),
  goodbyeChannel: varchar('goodbye_channel', { length: 20 }),
  goodbyeMessage: text('goodbye_message'),
  goodbyeEmbedEnabled: boolean('goodbye_embed_enabled').default(false).notNull(),
  goodbyeEmbedColor: varchar('goodbye_embed_color', { length: 7 }).default('#FF0000'),
  goodbyeEmbedTitle: varchar('goodbye_embed_title', { length: 255 }),
  goodbyeEmbedImage: varchar('goodbye_embed_image', { length: 500 }),
  goodbyeEmbedThumbnail: varchar('goodbye_embed_thumbnail', { length: 500 }),
  // Logging configuration
  logsEnabled: boolean('logs_enabled').default(false).notNull(),
  logsChannel: varchar('logs_channel', { length: 20 }),
  // XP configuration
  xpEnabled: boolean('xp_enabled').default(true).notNull(),
  xpRate: integer('xp_rate').default(1).notNull(),
  xpPerMessage: integer('xp_per_message').default(5).notNull(),
  xpPerVoiceMinute: integer('xp_per_voice_minute').default(10).notNull(),
  xpCooldown: integer('xp_cooldown').default(60).notNull(),
  xpAnnounceLevelUp: boolean('xp_announce_level_up').default(true).notNull(),
  xpBoosterRole: varchar('xp_booster_role', { length: 20 }),
  xpBoosterMultiplier: integer('xp_booster_multiplier').default(200).notNull(),
  levelUpMessage: text('level_up_message'),
  levelUpChannel: varchar('level_up_channel', { length: 20 }),
  // Custom commands
  customCommands: text('custom_commands').default('[]').notNull(),
  // Autorole configuration
  autoroleEnabled: boolean('autorole_enabled').default(false).notNull(),
  autoroleRoles: text('autorole_roles').default('[]').notNull(), // JSON array of role IDs
  // Security configuration
  securityEnabled: boolean('security_enabled').default(true).notNull(),
  securityAlertRole: varchar('security_alert_role', { length: 20 }),
  antiRaidEnabled: boolean('anti_raid_enabled').default(true).notNull(),
  antiSpamEnabled: boolean('anti_spam_enabled').default(true).notNull(),
  maxMentions: integer('max_mentions').default(5).notNull(),
  maxDuplicates: integer('max_duplicates').default(3).notNull(),
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
