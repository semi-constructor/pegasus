import { economyRepository } from '../repositories/economyRepository';
import { t } from '../i18n';
import type {
  EconomyBalance,
  EconomyTransaction,
  EconomyUserItem,
  EconomySettings,
  EconomyGamblingStats,
} from '../database/schema';
import { client } from '../index';
import { logger } from '../utils/logger';

export interface TransactionResult {
  success: boolean;
  balance?: EconomyBalance;
  transaction?: EconomyTransaction;
  error?: string;
}

export interface PurchaseResult {
  success: boolean;
  item?: EconomyUserItem;
  balance?: EconomyBalance;
  error?: string;
}

export interface RobResult {
  success: boolean;
  amount?: number;
  victimBalance?: EconomyBalance;
  robberBalance?: EconomyBalance;
  protected?: boolean;
  error?: string;
}

export interface GamblingResult {
  won: boolean;
  payout: number;
  profit: number;
  balance: EconomyBalance;
  stats: EconomyGamblingStats;
  details?: Record<string, unknown>;
}

export class EconomyService {
  // Balance management
  async getOrCreateBalance(userId: string, guildId: string): Promise<EconomyBalance> {
    let balance = await economyRepository.getBalance(userId, guildId);

    if (!balance) {
      const settings = await economyRepository.ensureSettings(guildId);
      balance = await economyRepository.createBalance({
        userId,
        guildId,
        balance: settings.startingBalance,
      });
    }

    return balance;
  }

  async addMoney(
    userId: string,
    guildId: string,
    amount: number,
    type: string,
    description?: string,
    metadata?: Record<string, unknown>
  ): Promise<TransactionResult> {
    try {
      await this.getOrCreateBalance(userId, guildId);

      const updatedBalance = await economyRepository.addToBalance(userId, guildId, amount);
      if (!updatedBalance) {
        return { success: false, error: t('commands.economy.errors.general') };
      }

      const transaction = await economyRepository.createTransaction({
        userId,
        guildId,
        type,
        amount,
        description,
        metadata: metadata ?? undefined,
      });

      return { success: true, balance: updatedBalance, transaction };
    } catch (error) {
      console.error('Error adding money:', error);
      return { success: false, error: t('commands.economy.errors.general') };
    }
  }

  async transferMoney(
    fromUserId: string,
    toUserId: string,
    guildId: string,
    amount: number,
    description?: string
  ): Promise<TransactionResult> {
    try {
      const fromBalance = await this.getOrCreateBalance(fromUserId, guildId);

      if (fromBalance.balance < amount) {
        return { success: false, error: t('commands.economy.errors.insufficientFunds') };
      }

      // Deduct from sender
      const senderResult = await this.addMoney(
        fromUserId,
        guildId,
        -amount,
        'transfer',
        description || `Transfer to user`,
        { relatedUserId: toUserId }
      );

      if (!senderResult.success) {
        return senderResult;
      }

      // Add to receiver
      await this.addMoney(
        toUserId,
        guildId,
        amount,
        'transfer',
        description || `Transfer from user`,
        { relatedUserId: fromUserId }
      );

      return senderResult;
    } catch (error) {
      console.error('Error transferring money:', error);
      return { success: false, error: t('commands.economy.errors.general') };
    }
  }

  // Daily rewards
  async claimDaily(userId: string, guildId: string): Promise<TransactionResult> {
    try {
      const isOnCooldown = await economyRepository.isOnCooldown(userId, guildId, 'daily');
      if (isOnCooldown) {
        const cooldown = await economyRepository.getCooldown(userId, guildId, 'daily');
        if (!cooldown) {
          return { success: false, error: t('common.error') };
        }
        const timeLeft = cooldown.nextAvailable.getTime() - Date.now();
        const hours = Math.floor(timeLeft / 1000 / 60 / 60);
        const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
        return {
          success: false,
          error: t('commands.economy.daily.cooldown', { hours, minutes }),
        };
      }

      const settings = await economyRepository.ensureSettings(guildId);

      // Calculate streak bonus
      const lastCooldown = await economyRepository.getCooldown(userId, guildId, 'daily');
      let streakDays = 1;
      let totalAmount = settings.dailyAmount;

      if (lastCooldown && settings.dailyStreak) {
        const lastClaimTime = lastCooldown.lastUsed.getTime();
        const timeSinceLastClaim = Date.now() - lastClaimTime;
        const oneDayMs = 24 * 60 * 60 * 1000;

        // If claimed within 48 hours, continue streak
        if (timeSinceLastClaim < oneDayMs * 2) {
          type CooldownWithMetadata = typeof lastCooldown & {
            streakDays?: number;
          };
          const metadata = lastCooldown as CooldownWithMetadata;
          streakDays = (metadata.streakDays ?? 0) + 1;
          totalAmount += settings.dailyStreakBonus * (streakDays - 1);
        }
      }

      // Set cooldown
      const now = new Date();
      const nextAvailable = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await economyRepository.setCooldown({
        userId,
        guildId,
        commandType: 'daily',
        lastUsed: now,
        nextAvailable,
      });

      // Add money
      const result = await this.addMoney(
        userId,
        guildId,
        totalAmount,
        'daily',
        `Daily reward (${streakDays} day streak)`,
        { streakDays }
      );

      return result;
    } catch (error) {
      console.error('Error claiming daily:', error);
      return { success: false, error: t('commands.economy.errors.general') };
    }
  }

  // Work command
  async work(userId: string, guildId: string): Promise<TransactionResult> {
    try {
      const settings = await economyRepository.ensureSettings(guildId);

      const isOnCooldown = await economyRepository.isOnCooldown(userId, guildId, 'work');
      if (isOnCooldown) {
        const cooldown = await economyRepository.getCooldown(userId, guildId, 'work');
        if (!cooldown) {
          return { success: false, error: t('common.error') };
        }
        const timeLeft = cooldown.nextAvailable.getTime() - Date.now();
        const minutes = Math.floor(timeLeft / 1000 / 60);
        const seconds = Math.floor((timeLeft / 1000) % 60);
        return { success: false, error: t('commands.economy.work.cooldown', { minutes, seconds }) };
      }

      // Random amount between min and max
      const amount = Math.floor(
        Math.random() * (settings.workMaxAmount - settings.workMinAmount + 1) +
          settings.workMinAmount
      );

      // Set cooldown
      const now = new Date();
      const nextAvailable = new Date(now.getTime() + settings.workCooldown * 1000);
      await economyRepository.setCooldown({
        userId,
        guildId,
        commandType: 'work',
        lastUsed: now,
        nextAvailable,
      });

      // Random work descriptions
      const workJobKeys = [
        'programmer',
        'pizza',
        'store',
        'freelance',
        'lawn',
        'lemonade',
        'dogwalker',
        'tutor',
      ];

      const jobKey = workJobKeys[Math.floor(Math.random() * workJobKeys.length)];
      const description = t(`commands.economy.work.jobs.${jobKey}`);

      return await this.addMoney(userId, guildId, amount, 'work', description);
    } catch (error) {
      console.error('Error working:', error);
      return { success: false, error: t('commands.economy.errors.general') };
    }
  }

  // Rob command
  async rob(robberId: string, victimId: string, guildId: string): Promise<RobResult> {
    try {
      const settings = await economyRepository.ensureSettings(guildId);

      if (!settings.robEnabled) {
        return { success: false, error: t('commands.economy.rob.disabled') };
      }

      const isOnCooldown = await economyRepository.isOnCooldown(robberId, guildId, 'rob');
      if (isOnCooldown) {
        const cooldown = await economyRepository.getCooldown(robberId, guildId, 'rob');
        if (!cooldown) {
          return { success: false, error: t('common.error') };
        }
        const timeLeft = cooldown.nextAvailable.getTime() - Date.now();
        const hours = Math.floor(timeLeft / 1000 / 60 / 60);
        const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
        return { success: false, error: t('commands.economy.rob.cooldown', { hours, minutes }) };
      }

      // Check if victim has protection
      const hasProtection = await economyRepository.hasActiveProtection(victimId, guildId);
      if (hasProtection) {
        // Set cooldown even if failed
        const now = new Date();
        const nextAvailable = new Date(now.getTime() + settings.robCooldown * 1000);
        await economyRepository.setCooldown({
          userId: robberId,
          guildId,
          commandType: 'rob',
          lastUsed: now,
          nextAvailable,
        });

        return { success: false, protected: true, error: t('commands.economy.rob.protectedText', { user: '' }) };
      }

      const victimBalance = await this.getOrCreateBalance(victimId, guildId);

      if (victimBalance.balance < settings.robMinAmount) {
        return { success: false, error: t('commands.economy.rob.notEnoughMoney') };
      }

      // Set cooldown
      const now = new Date();
      const nextAvailable = new Date(now.getTime() + settings.robCooldown * 1000);
      await economyRepository.setCooldown({
        userId: robberId,
        guildId,
        commandType: 'rob',
        lastUsed: now,
        nextAvailable,
      });

      // Calculate success
      const successRoll = Math.random() * 100;
      const success = successRoll < settings.robSuccessRate;

      if (success) {
        // Calculate amount to steal (10-50% of victim's balance, max 50% of robber's balance)
        const percentage = Math.random() * 0.4 + 0.1; // 10-50%
        let amount = Math.floor(victimBalance.balance * percentage);

        const robberBalance = await this.getOrCreateBalance(robberId, guildId);
        const maxSteal = Math.floor(robberBalance.balance * 0.5);
        amount = Math.min(amount, maxSteal);

        // Transfer money
        await this.addMoney(victimId, guildId, -amount, 'rob', 'Got robbed', { robberId });
        const robberResult = await this.addMoney(
          robberId,
          guildId,
          amount,
          'rob',
          'Successful robbery',
          { victimId }
        );

        const updatedVictimBalance = await economyRepository.getBalance(victimId, guildId);

        return {
          success: true,
          amount,
          victimBalance: updatedVictimBalance ?? ({} as EconomyBalance),
          robberBalance: robberResult.balance ?? ({} as EconomyBalance),
        };
      } else {
        // Failed rob - pay a fine
        const robberBalance = await this.getOrCreateBalance(robberId, guildId);
        const fine = Math.floor(robberBalance.balance * 0.2); // 20% fine

        if (fine > 0) {
          const result = await this.addMoney(
            robberId,
            guildId,
            -fine,
            'rob',
            'Failed robbery fine',
            { victimId }
          );
          return {
            success: false,
            amount: -fine,
            robberBalance: result.balance ?? ({} as EconomyBalance),
            error: t('commands.economy.rob.failedText', { user: '' }) + ` (${fine} ${settings.currencyName})`,
          };
        }

        return { success: false, error: t('commands.economy.rob.failedText', { user: '' }) };
      }
    } catch (error) {
      console.error('Error robbing:', error);
      return { success: false, error: t('commands.economy.errors.general') };
    }
  }

  // Shop operations
  async purchaseItem(
    userId: string,
    guildId: string,
    itemId: string,
    quantity = 1
  ): Promise<PurchaseResult> {
    try {
      const item = await economyRepository.getShopItem(itemId);
      if (!item || item.guildId !== guildId) {
        return { success: false, error: t('commands.economy.errors.itemNotFound') };
      }

      if (!item.enabled) {
        return { success: false, error: t('commands.economy.errors.itemNotFound') };
      }

      if (item.stock !== null && item.stock !== -1 && item.stock < quantity) {
        return { success: false, error: t('commands.economy.errors.notEnoughStock') };
      }

      const totalCost = item.price * quantity;
      const balance = await this.getOrCreateBalance(userId, guildId);

      if (balance.balance < totalCost) {
        return { success: false, error: t('commands.economy.errors.insufficientFunds') };
      }

      // Check role requirement
      if (item.requiresRole) {
        try {
          const guild = client.guilds.cache.get(guildId);
          if (guild) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member && !member.roles.cache.has(item.requiresRole)) {
              return { success: false, error: t('commands.economy.errors.missingRole') };
            }
          }
        } catch (err) {
          logger.error('Failed to check role requirements for shop item:', err);
        }
      }

      // Deduct money
      const transactionResult = await this.addMoney(
        userId,
        guildId,
        -totalCost,
        'shop',
        `Purchased ${quantity}x ${item.name}`,
        { itemId, quantity }
      );

      if (!transactionResult.success) {
        return { success: false, error: transactionResult.error };
      }

      // Check if user already has this item
      const existingItem = await economyRepository.getUserItem(userId, guildId, itemId);

      let userItem: EconomyUserItem;
      if (existingItem) {
        // Update quantity
        const updatedItem = await economyRepository.updateUserItem(existingItem.id, {
          quantity: existingItem.quantity + quantity,
        });
        if (!updatedItem) {
          return { success: false, error: t('commands.economy.errors.general') };
        }
        userItem = updatedItem;
      } else {
        // Calculate expiration if applicable
        let expiresAt: Date | undefined;
        if (item.effectType === 'rob_protection' && item.effectValue) {
          interface EffectValue {
            duration?: number;
          }
          const effectValue = item.effectValue as EffectValue;
          const duration = effectValue.duration ?? 86400;
          expiresAt = new Date(Date.now() + duration * 1000);
        }

        // Add item to user inventory
        userItem = await economyRepository.addUserItem({
          userId,
          guildId,
          itemId,
          quantity,
          expiresAt,
        });
      }

      // Update stock if not unlimited
      if (item.stock !== null && item.stock !== -1) {
        await economyRepository.updateShopItem(itemId, {
          stock: item.stock - quantity,
        });
      }

      return {
        success: true,
        item: userItem,
        balance: transactionResult.balance ?? ({} as EconomyBalance),
      };
    } catch (error) {
      console.error('Error purchasing item:', error);
      return { success: false, error: t('commands.economy.errors.general') };
    }
  }

  // Gambling helpers
  async canAffordBet(
    userId: string,
    guildId: string,
    amount: number
  ): Promise<{ canAfford: boolean; balance?: EconomyBalance; settings?: EconomySettings }> {
    const balance = await this.getOrCreateBalance(userId, guildId);
    const settings = await economyRepository.ensureSettings(guildId);

    if (amount < settings.minBet || amount > settings.maxBet) {
      return { canAfford: false };
    }

    return {
      canAfford: balance.balance >= amount,
      balance,
      settings,
    };
  }

  async processGamble(
    userId: string,
    guildId: string,
    gameType: string,
    wagered: number,
    won: boolean,
    multiplier: number,
    details?: Record<string, unknown>
  ): Promise<GamblingResult> {
    const payout = won ? Math.floor(wagered * multiplier) : 0;
    const profit = payout - wagered;

    // Update balance
    const balanceResult = await this.addMoney(
      userId,
      guildId,
      profit,
      'gamble',
      `${gameType} - ${won ? 'Won' : 'Lost'}`,
      { gameType, wagered, payout, won, details: details ?? undefined }
    );

    // Update gambling stats
    await economyRepository.addToBalance(userId, guildId, 0); // Ensure balance exists
    await economyRepository.updateBalance(userId, guildId, {
      totalGambled:
        ((await economyRepository.getBalance(userId, guildId))?.totalGambled ?? 0) + wagered,
    });

    const stats = await economyRepository.updateGamblingStats(
      userId,
      guildId,
      gameType,
      won,
      wagered,
      payout
    );

    return {
      won,
      payout,
      profit,
      balance: balanceResult.balance ?? ({} as EconomyBalance),
      stats,
      details: details ?? undefined,
    };
  }

  // Leaderboard
  async getLeaderboard(guildId: string, limit = 10): Promise<EconomyBalance[]> {
    return await economyRepository.getTopBalances(guildId, limit);
  }

  // Settings
  async getSettings(guildId: string): Promise<EconomySettings> {
    return await economyRepository.ensureSettings(guildId);
  }

  async updateSettings(
    guildId: string,
    updates: Partial<Omit<EconomySettings, 'guildId' | 'createdAt'>>
  ): Promise<EconomySettings | null> {
    return await economyRepository.updateSettings(guildId, updates);
  }
}

// Export singleton instance
export const economyService = new EconomyService();
