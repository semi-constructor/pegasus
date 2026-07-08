import {
  pgTable,
  varchar,
  bigint,
  timestamp,
  text,
  boolean,
  integer,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// User economy balances
export const economyBalances = pgTable(
  'economy_balances',
  {
    userId: varchar('user_id', { length: 255 }).notNull(),
    guildId: varchar('guild_id', { length: 255 }).notNull(),
    balance: bigint('balance', { mode: 'number' }).notNull().default(0),
    bankBalance: bigint('bank_balance', { mode: 'number' }).notNull().default(0),
    totalEarned: bigint('total_earned', { mode: 'number' }).notNull().default(0),
    totalSpent: bigint('total_spent', { mode: 'number' }).notNull().default(0),
    totalGambled: bigint('total_gambled', { mode: 'number' }).notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    pk: primaryKey({ columns: [table.userId, table.guildId] }),
    userIdIdx: index('economy_balances_user_id_idx').on(table.userId),
    guildIdIdx: index('economy_balances_guild_id_idx').on(table.guildId),
    balanceIdx: index('economy_balances_balance_idx').on(table.balance),
  })
);

// Transaction history
export const economyTransactions = pgTable(
  'economy_transactions',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    userId: varchar('user_id', { length: 255 }).notNull(),
    guildId: varchar('guild_id', { length: 255 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(), // daily, work, gamble, rob, shop, transfer, admin
    amount: bigint('amount', { mode: 'number' }).notNull(),
    description: text('description'),
    metadata: jsonb('metadata'), // Additional data like gambling game results, shop item purchased, etc.
    relatedUserId: varchar('related_user_id', { length: 255 }), // For transfers and robs
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    userIdIdx: index('economy_transactions_user_id_idx').on(table.userId),
    guildIdIdx: index('economy_transactions_guild_id_idx').on(table.guildId),
    typeIdx: index('economy_transactions_type_idx').on(table.type),
    createdAtIdx: index('economy_transactions_created_at_idx').on(table.createdAt),
  })
);

// Shop items
export const economyShopItems = pgTable(
  'economy_shop_items',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    guildId: varchar('guild_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').notNull(),
    price: bigint('price', { mode: 'number' }).notNull(),
    type: varchar('type', { length: 50 }).notNull(), // protection, booster, role, custom
    effectType: varchar('effect_type', { length: 50 }), // rob_protection, xp_boost, etc.
    effectValue: jsonb('effect_value'), // { duration: 86400, multiplier: 2, roleId: "..." }
    stock: integer('stock').default(-1), // -1 = unlimited
    requiresRole: varchar('requires_role', { length: 255 }),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    guildIdIdx: index('economy_shop_items_guild_id_idx').on(table.guildId),
    enabledIdx: index('economy_shop_items_enabled_idx').on(table.enabled),
    uniqueNamePerGuild: uniqueIndex('economy_shop_items_guild_name_unique').on(
      table.guildId,
      table.name
    ),
  })
);

// User purchased items
export const economyUserItems = pgTable(
  'economy_user_items',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    userId: varchar('user_id', { length: 255 }).notNull(),
    guildId: varchar('guild_id', { length: 255 }).notNull(),
    itemId: varchar('item_id', { length: 255 })
      .notNull()
      .references(() => economyShopItems.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(1),
    purchasedAt: timestamp('purchased_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at'), // For time-limited items
    active: boolean('active').notNull().default(true),
  },
  table => ({
    userIdIdx: index('economy_user_items_user_id_idx').on(table.userId),
    guildIdIdx: index('economy_user_items_guild_id_idx').on(table.guildId),
    itemIdIdx: index('economy_user_items_item_id_idx').on(table.itemId),
    expiresAtIdx: index('economy_user_items_expires_at_idx').on(table.expiresAt),
    activeIdx: index('economy_user_items_active_idx').on(table.active),
  })
);

// Cooldowns for various economy commands
export const economyCooldowns = pgTable(
  'economy_cooldowns',
  {
    userId: varchar('user_id', { length: 255 }).notNull(),
    guildId: varchar('guild_id', { length: 255 }).notNull(),
    commandType: varchar('command_type', { length: 50 }).notNull(), // daily, work, rob
    lastUsed: timestamp('last_used').notNull(),
    nextAvailable: timestamp('next_available').notNull(),
    streakDays: integer('streak_days').notNull().default(0),
  },
  table => ({
    pk: primaryKey({ columns: [table.userId, table.guildId, table.commandType] }),
    userIdIdx: index('economy_cooldowns_user_id_idx').on(table.userId),
    guildIdIdx: index('economy_cooldowns_guild_id_idx').on(table.guildId),
    nextAvailableIdx: index('economy_cooldowns_next_available_idx').on(table.nextAvailable),
  })
);

// Gambling game statistics
export const economyGamblingStats = pgTable(
  'economy_gambling_stats',
  {
    userId: varchar('user_id', { length: 255 }).notNull(),
    guildId: varchar('guild_id', { length: 255 }).notNull(),
    gameType: varchar('game_type', { length: 50 }).notNull(), // dice, coinflip, slots, blackjack, roulette
    gamesPlayed: integer('games_played').notNull().default(0),
    gamesWon: integer('games_won').notNull().default(0),
    totalWagered: bigint('total_wagered', { mode: 'number' }).notNull().default(0),
    totalWon: bigint('total_won', { mode: 'number' }).notNull().default(0),
    biggestWin: bigint('biggest_win', { mode: 'number' }).notNull().default(0),
    biggestLoss: bigint('biggest_loss', { mode: 'number' }).notNull().default(0),
    currentStreak: integer('current_streak').notNull().default(0),
    bestStreak: integer('best_streak').notNull().default(0),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    pk: primaryKey({ columns: [table.userId, table.guildId, table.gameType] }),
    userIdIdx: index('economy_gambling_stats_user_id_idx').on(table.userId),
    guildIdIdx: index('economy_gambling_stats_guild_id_idx').on(table.guildId),
  })
);

// Economy settings per guild
export const economySettings = pgTable('economy_settings', {
  guildId: varchar('guild_id', { length: 255 }).primaryKey().notNull(),
  currencySymbol: varchar('currency_symbol', { length: 10 }).notNull().default('💰'),
  currencyName: varchar('currency_name', { length: 50 }).notNull().default('coins'),
  startingBalance: bigint('starting_balance', { mode: 'number' }).notNull().default(100),
  dailyAmount: bigint('daily_amount', { mode: 'number' }).notNull().default(100),
  dailyStreak: boolean('daily_streak').notNull().default(true),
  dailyStreakBonus: bigint('daily_streak_bonus', { mode: 'number' }).notNull().default(10),
  workMinAmount: bigint('work_min_amount', { mode: 'number' }).notNull().default(50),
  workMaxAmount: bigint('work_max_amount', { mode: 'number' }).notNull().default(200),
  workCooldown: integer('work_cooldown').notNull().default(3600), // seconds
  robEnabled: boolean('rob_enabled').notNull().default(true),
  robMinAmount: bigint('rob_min_amount', { mode: 'number' }).notNull().default(100),
  robSuccessRate: integer('rob_success_rate').notNull().default(50), // percentage
  robCooldown: integer('rob_cooldown').notNull().default(86400), // 24 hours
  robProtectionCost: bigint('rob_protection_cost', { mode: 'number' }).notNull().default(1000),
  robProtectionDuration: integer('rob_protection_duration').notNull().default(86400), // 24 hours
  maxBet: bigint('max_bet', { mode: 'number' }).notNull().default(10000),
  minBet: bigint('min_bet', { mode: 'number' }).notNull().default(10),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const economyBalancesRelations = relations(economyBalances, ({ many }) => ({
  transactions: many(economyTransactions),
  userItems: many(economyUserItems),
  cooldowns: many(economyCooldowns),
  gamblingStats: many(economyGamblingStats),
}));

export const economyTransactionsRelations = relations(economyTransactions, ({ one }) => ({
  balance: one(economyBalances, {
    fields: [economyTransactions.userId, economyTransactions.guildId],
    references: [economyBalances.userId, economyBalances.guildId],
  }),
}));

export const economyShopItemsRelations = relations(economyShopItems, ({ many }) => ({
  userItems: many(economyUserItems),
}));

export const economyUserItemsRelations = relations(economyUserItems, ({ one }) => ({
  item: one(economyShopItems, {
    fields: [economyUserItems.itemId],
    references: [economyShopItems.id],
  }),
  balance: one(economyBalances, {
    fields: [economyUserItems.userId, economyUserItems.guildId],
    references: [economyBalances.userId, economyBalances.guildId],
  }),
}));

// Type exports
export type EconomyBalance = typeof economyBalances.$inferSelect;
export type NewEconomyBalance = typeof economyBalances.$inferInsert;
export type EconomyTransaction = typeof economyTransactions.$inferSelect;
export type NewEconomyTransaction = typeof economyTransactions.$inferInsert;
export type EconomyShopItem = typeof economyShopItems.$inferSelect;
export type NewEconomyShopItem = typeof economyShopItems.$inferInsert;
export type EconomyUserItem = typeof economyUserItems.$inferSelect;
export type NewEconomyUserItem = typeof economyUserItems.$inferInsert;
export type EconomyCooldown = typeof economyCooldowns.$inferSelect;
export type NewEconomyCooldown = typeof economyCooldowns.$inferInsert;
export type EconomyGamblingStats = typeof economyGamblingStats.$inferSelect;
export type NewEconomyGamblingStats = typeof economyGamblingStats.$inferInsert;
export type EconomySettings = typeof economySettings.$inferSelect;
export type NewEconomySettings = typeof economySettings.$inferInsert;
