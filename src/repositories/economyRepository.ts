import { eq, and, desc, asc, gte, sql, or, isNull } from 'drizzle-orm';
import { getDatabase } from '../database/connection';
import {
  economyBalances,
  economyTransactions,
  economyShopItems,
  economyUserItems,
  economyCooldowns,
  economyGamblingStats,
  economySettings,
  type EconomyBalance,
  type NewEconomyBalance,
  type EconomyTransaction,
  type NewEconomyTransaction,
  type EconomyShopItem,
  type NewEconomyShopItem,
  type EconomyUserItem,
  type NewEconomyUserItem,
  type EconomyCooldown,
  type NewEconomyCooldown,
  type EconomyGamblingStats,
  type EconomySettings,
  type NewEconomySettings,
} from '../database/schema';

export class EconomyRepository {
  private get db() {
    return getDatabase();
  }

  // Balance operations
  async getBalance(userId: string, guildId: string): Promise<EconomyBalance | null> {
    const result = await this.db
      .select()
      .from(economyBalances)
      .where(and(eq(economyBalances.userId, userId), eq(economyBalances.guildId, guildId)))
      .limit(1);

    return result[0] || null;
  }

  async createBalance(data: NewEconomyBalance): Promise<EconomyBalance> {
    const [balance] = await this.db.insert(economyBalances).values(data).returning();

    return balance;
  }

  async updateBalance(
    userId: string,
    guildId: string,
    updates: Partial<Omit<EconomyBalance, 'userId' | 'guildId' | 'createdAt'>>
  ): Promise<EconomyBalance | null> {
    const [updated] = await this.db
      .update(economyBalances)
      .set(updates)
      .where(and(eq(economyBalances.userId, userId), eq(economyBalances.guildId, guildId)))
      .returning();

    return updated || null;
  }

  async addToBalance(
    userId: string,
    guildId: string,
    amount: number
  ): Promise<EconomyBalance | null> {
    const conditions = [
      eq(economyBalances.userId, userId),
      eq(economyBalances.guildId, guildId)
    ];
    
    if (amount < 0) {
      conditions.push(gte(economyBalances.balance, Math.abs(amount)));
    }

    const [updated] = await this.db
      .update(economyBalances)
      .set({
        balance: sql`${economyBalances.balance} + ${amount}`,
        totalEarned: amount > 0 ? sql`${economyBalances.totalEarned} + ${amount}` : undefined,
        totalSpent:
          amount < 0 ? sql`${economyBalances.totalSpent} + ${Math.abs(amount)}` : undefined,
      })
      .where(and(...conditions))
      .returning();

    return updated || null;
  }

  async getTopBalances(guildId: string, limit = 10): Promise<EconomyBalance[]> {
    return await this.db
      .select()
      .from(economyBalances)
      .where(eq(economyBalances.guildId, guildId))
      .orderBy(desc(economyBalances.balance))
      .limit(limit);
  }

  // Transaction operations
  async createTransaction(data: NewEconomyTransaction): Promise<EconomyTransaction> {
    const [transaction] = await this.db.insert(economyTransactions).values(data).returning();

    return transaction;
  }

  async getTransactions(
    userId: string,
    guildId: string,
    limit = 10
  ): Promise<EconomyTransaction[]> {
    return await this.db
      .select()
      .from(economyTransactions)
      .where(and(eq(economyTransactions.userId, userId), eq(economyTransactions.guildId, guildId)))
      .orderBy(desc(economyTransactions.createdAt))
      .limit(limit);
  }

  // Shop operations
  async getShopItems(guildId: string, enabled = true): Promise<EconomyShopItem[]> {
    return await this.db
      .select()
      .from(economyShopItems)
      .where(and(eq(economyShopItems.guildId, guildId), eq(economyShopItems.enabled, enabled)))
      .orderBy(asc(economyShopItems.price));
  }

  async getShopItem(itemId: string): Promise<EconomyShopItem | null> {
    const result = await this.db
      .select()
      .from(economyShopItems)
      .where(eq(economyShopItems.id, itemId))
      .limit(1);

    return result[0] || null;
  }

  async createShopItem(data: NewEconomyShopItem): Promise<EconomyShopItem> {
    const [item] = await this.db.insert(economyShopItems).values(data).returning();

    return item;
  }

  async updateShopItem(
    itemId: string,
    updates: Partial<Omit<EconomyShopItem, 'id' | 'createdAt'>>
  ): Promise<EconomyShopItem | null> {
    const [updated] = await this.db
      .update(economyShopItems)
      .set(updates)
      .where(eq(economyShopItems.id, itemId))
      .returning();

    return updated || null;
  }

  async consumeShopItemStock(itemId: string, quantity: number): Promise<boolean> {
    const [updated] = await this.db
      .update(economyShopItems)
      .set({ stock: sql`${economyShopItems.stock} - ${quantity}` })
      .where(and(eq(economyShopItems.id, itemId), gte(economyShopItems.stock, quantity)))
      .returning();

    return !!updated;
  }

  // User items operations
  async getUserItems(
    userId: string,
    guildId: string,
    active = true
  ): Promise<(EconomyUserItem & { item: EconomyShopItem })[]> {
    const results = await this.db
      .select()
      .from(economyUserItems)
      .innerJoin(economyShopItems, eq(economyUserItems.itemId, economyShopItems.id))
      .where(
        and(
          eq(economyUserItems.userId, userId),
          eq(economyUserItems.guildId, guildId),
          eq(economyUserItems.active, active)
        )
      );

    return results.map(r => ({ ...r.economy_user_items, item: r.economy_shop_items }));
  }

  async getUserItem(
    userId: string,
    guildId: string,
    itemId: string
  ): Promise<EconomyUserItem | null> {
    const result = await this.db
      .select()
      .from(economyUserItems)
      .where(
        and(
          eq(economyUserItems.userId, userId),
          eq(economyUserItems.guildId, guildId),
          eq(economyUserItems.itemId, itemId),
          eq(economyUserItems.active, true)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  async addUserItem(data: NewEconomyUserItem): Promise<EconomyUserItem> {
    const [item] = await this.db.insert(economyUserItems).values(data).returning();

    return item;
  }

  async updateUserItem(
    id: string,
    updates: Partial<Omit<EconomyUserItem, 'id' | 'purchasedAt'>>
  ): Promise<EconomyUserItem | null> {
    const [updated] = await this.db
      .update(economyUserItems)
      .set(updates)
      .where(eq(economyUserItems.id, id))
      .returning();

    return updated || null;
  }

  async hasActiveProtection(userId: string, guildId: string): Promise<boolean> {
    const result = await this.db
      .select()
      .from(economyUserItems)
      .innerJoin(economyShopItems, eq(economyUserItems.itemId, economyShopItems.id))
      .where(
        and(
          eq(economyUserItems.userId, userId),
          eq(economyUserItems.guildId, guildId),
          eq(economyUserItems.active, true),
          eq(economyShopItems.effectType, 'rob_protection'),
          or(isNull(economyUserItems.expiresAt), gte(economyUserItems.expiresAt, new Date()))
        )
      )
      .limit(1);

    return result.length > 0;
  }

  // Cooldown operations
  async getCooldown(
    userId: string,
    guildId: string,
    commandType: string
  ): Promise<EconomyCooldown | null> {
    const result = await this.db
      .select()
      .from(economyCooldowns)
      .where(
        and(
          eq(economyCooldowns.userId, userId),
          eq(economyCooldowns.guildId, guildId),
          eq(economyCooldowns.commandType, commandType)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  async setCooldown(data: NewEconomyCooldown): Promise<EconomyCooldown> {
    const [cooldown] = await this.db
      .insert(economyCooldowns)
      .values(data)
      .onConflictDoUpdate({
        target: [economyCooldowns.userId, economyCooldowns.guildId, economyCooldowns.commandType],
        set: {
          lastUsed: data.lastUsed,
          nextAvailable: data.nextAvailable,
          streakDays: data.streakDays,
        },
      })
      .returning();

    return cooldown;
  }

  async isOnCooldown(userId: string, guildId: string, commandType: string): Promise<boolean> {
    const cooldown = await this.getCooldown(userId, guildId, commandType);
    if (!cooldown) return false;

    return cooldown.nextAvailable > new Date();
  }

  // Gambling statistics operations
  async getGamblingStats(
    userId: string,
    guildId: string,
    gameType: string
  ): Promise<EconomyGamblingStats | null> {
    const result = await this.db
      .select()
      .from(economyGamblingStats)
      .where(
        and(
          eq(economyGamblingStats.userId, userId),
          eq(economyGamblingStats.guildId, guildId),
          eq(economyGamblingStats.gameType, gameType)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  async updateGamblingStats(
    userId: string,
    guildId: string,
    gameType: string,
    won: boolean,
    wagered: number,
    payout: number
  ): Promise<EconomyGamblingStats> {
    const netAmount = payout - wagered;
    const isWin = netAmount > 0;
    const netAbs = Math.abs(netAmount);

    const [updated] = await this.db
      .insert(economyGamblingStats)
      .values({
        userId,
        guildId,
        gameType,
        gamesPlayed: 1,
        gamesWon: won ? 1 : 0,
        totalWagered: wagered,
        totalWon: isWin ? netAmount : 0,
        biggestWin: isWin ? netAmount : 0,
        biggestLoss: !isWin ? netAbs : 0,
        currentStreak: won ? 1 : 0,
        bestStreak: won ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: [
          economyGamblingStats.userId,
          economyGamblingStats.guildId,
          economyGamblingStats.gameType,
        ],
        set: {
          gamesPlayed: sql`${economyGamblingStats.gamesPlayed} + 1`,
          gamesWon: sql`${economyGamblingStats.gamesWon} + ${won ? 1 : 0}`,
          totalWagered: sql`${economyGamblingStats.totalWagered} + ${wagered}`,
          totalWon: sql`${economyGamblingStats.totalWon} + ${isWin ? netAmount : 0}`,
          biggestWin: sql`GREATEST(${economyGamblingStats.biggestWin}, ${isWin ? netAmount : 0})`,
          biggestLoss: sql`GREATEST(${economyGamblingStats.biggestLoss}, ${!isWin ? netAbs : 0})`,
          currentStreak: won ? sql`${economyGamblingStats.currentStreak} + 1` : 0,
          bestStreak: won ? sql`GREATEST(${economyGamblingStats.bestStreak}, ${economyGamblingStats.currentStreak} + 1)` : economyGamblingStats.bestStreak,
          updatedAt: new Date(),
        },
      })
      .returning();

    return updated;
  }

  async getRecentGambles(userId: string, guildId: string, seconds: number): Promise<number> {
    const since = new Date(Date.now() - seconds * 1000);
    const result = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(economyTransactions)
      .where(
        and(
          eq(economyTransactions.userId, userId),
          eq(economyTransactions.guildId, guildId),
          eq(economyTransactions.type, 'gamble'),
          gte(economyTransactions.createdAt, since)
        )
      )
      .limit(1);

    return result[0]?.count || 0;
  }

  // Settings operations
  async getSettings(guildId: string): Promise<EconomySettings | null> {
    const result = await this.db
      .select()
      .from(economySettings)
      .where(eq(economySettings.guildId, guildId))
      .limit(1);

    return result[0] || null;
  }

  async createSettings(data: NewEconomySettings): Promise<EconomySettings> {
    const [settings] = await this.db.insert(economySettings).values(data).returning();

    return settings;
  }

  async updateSettings(
    guildId: string,
    updates: Partial<Omit<EconomySettings, 'guildId' | 'createdAt'>>
  ): Promise<EconomySettings | null> {
    const [updated] = await this.db
      .update(economySettings)
      .set(updates)
      .where(eq(economySettings.guildId, guildId))
      .returning();

    return updated || null;
  }

  async ensureSettings(guildId: string): Promise<EconomySettings> {
    const existing = await this.getSettings(guildId);
    if (existing) return existing;

    return await this.createSettings({ guildId });
  }
}

// Export singleton instance
export const economyRepository = new EconomyRepository();
