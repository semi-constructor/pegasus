import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { getDatabase } from '../database/connection';
import { userXp, xpMultipliers } from '../database/schema/xp';
import { users } from '../database/schema/users';
import { logger } from '../utils/logger';
import { configurationService } from './configurationService';
import { ensureUserExists } from '../utils/userUtils';
import type { GuildMember } from 'discord.js';
import { t } from '../i18n';

export interface XPGainResult {
  xpGained: number;
  totalXp: number;
  oldLevel: number;
  newLevel: number;
  leveledUp: boolean;
  rewardRoles?: string[];
}

export interface RankData {
  userId: string;
  guildId: string;
  username: string;
  avatarUrl?: string;
  xp: number;
  level: number;
  rank: number;
  nextLevelXp: number;
  currentLevelXp: number;
  progress: number;
  requiredXp?: number;
  totalXp?: number;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl?: string;
  xp: number;
  level: number;
  rank: number;
}

export interface RankCardCustomization {
  backgroundColor?: string;
  progressBarColor?: string;
  textColor?: string;
  accentColor?: string;
}

export class XPService {
  private readonly xpCooldowns = new Map<string, number>();
  private readonly voiceStates = new Map<string, number>();

  // Level calculation formula: level = floor(0.1 * sqrt(xp))
  calculateLevel(xp: number): number {
    return Math.floor(0.1 * Math.sqrt(xp));
  }

  // Calculate XP required for a specific level
  calculateXpForLevel(level: number): number {
    return Math.pow(level / 0.1, 2);
  }

  // Check if user is on cooldown
  isOnCooldown(userId: string, guildId: string, cooldownSeconds: number): boolean {
    const key = `${userId}-${guildId}`;
    const now = Date.now();
    const lastGain = this.xpCooldowns.get(key) || 0;

    return now - lastGain < cooldownSeconds * 1000;
  }

  // Set cooldown for user
  setCooldown(userId: string, guildId: string): void {
    const key = `${userId}-${guildId}`;
    this.xpCooldowns.set(key, Date.now());
  }

  // Calculate XP with multipliers
  async calculateXpWithMultipliers(
    baseXp: number,
    member: GuildMember,
    channelId?: string
  ): Promise<number> {
    try {
      const config = await configurationService.getXPConfig(member.guild.id);
      let multiplier = 1.0;

      // Check if channel is ignored or has special multipliers
      if (channelId) {
        if (config.ignoredChannels.includes(channelId)) return 0;
        if (config.noXpChannels.includes(channelId)) return 0;
        if (config.doubleXpChannels.includes(channelId)) multiplier *= 2.0;
      }

      // Check role multipliers
      const memberRoles = member.roles.cache.map(role => role.id);

      // Check if member has any ignored roles
      if (memberRoles.some(roleId => config.ignoredRoles.includes(roleId))) {
        return 0;
      }

      // Apply booster role multiplier
      if (config.boosterRole && memberRoles.includes(config.boosterRole)) {
        multiplier *= config.boosterMultiplier / 100;
      }

      // Apply custom role multipliers
      for (const roleId of memberRoles) {
        if (config.roleMultipliers[roleId]) {
          multiplier *= config.roleMultipliers[roleId] / 100;
        }
      }

      // Get database multipliers
      const dbMultipliers = await getDatabase()
        .select()
        .from(xpMultipliers)
        .where(eq(xpMultipliers.guildId, member.guild.id));

      // Apply database multipliers
      for (const dbMultiplier of dbMultipliers) {
        if (dbMultiplier.targetType === 'role' && memberRoles.includes(dbMultiplier.targetId)) {
          multiplier *= dbMultiplier.multiplier / 100;
        }
        if (dbMultiplier.targetType === 'channel' && channelId === dbMultiplier.targetId) {
          multiplier *= dbMultiplier.multiplier / 100;
        }
      }

      return Math.floor(baseXp * multiplier);
    } catch (error) {
      logger.error('Failed to calculate XP with multipliers:', error);
      return baseXp;
    }
  }

  // Add XP to user
  async addXP(
    userId: string,
    guildId: string,
    member: GuildMember,
    xpAmount: number,
    channelId?: string
  ): Promise<XPGainResult | null> {
    try {
      const config = await configurationService.getXPConfig(guildId);

      // Check if XP is enabled
      if (!config.enabled) return null;

      // Check cooldown for message XP
      if (channelId && this.isOnCooldown(userId, guildId, config.cooldown)) {
        return null;
      }

      // Calculate XP with multipliers
      const xpToAdd = await this.calculateXpWithMultipliers(xpAmount, member, channelId);
      if (xpToAdd === 0) return null;

      // Set cooldown
      if (channelId) {
        this.setCooldown(userId, guildId);
      }

      // Ensure user exists in database before XP operations
      await ensureUserExists(member.user);

      // Get or create user XP data
      const [userXpData] = await getDatabase()
        .select()
        .from(userXp)
        .where(and(eq(userXp.userId, userId), eq(userXp.guildId, guildId)))
        .limit(1);

      const oldXp = userXpData?.xp || 0;
      const oldLevel = userXpData?.level || 0;
      const newXp = oldXp + xpToAdd;
      const newLevel = this.calculateLevel(newXp);

      // Update or insert XP data
      if (userXpData) {
        await getDatabase()
          .update(userXp)
          .set({
            xp: newXp,
            level: newLevel,
            lastXpGain: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(userXp.userId, userId), eq(userXp.guildId, guildId)));
      } else {
        await getDatabase().insert(userXp).values({
          userId,
          guildId,
          xp: newXp,
          level: newLevel,
          lastXpGain: new Date(),
        });
      }

      // Check for level up
      const leveledUp = newLevel > oldLevel;
      let rewardRoles: string[] = [];

      if (leveledUp && config.levelUpRewardsEnabled) {
        // Get role rewards for levels between old and new
        const roleRewards = await configurationService.getXPRoleRewards(guildId);

        if (config.stackRoleRewards) {
          // Give all role rewards up to the new level
          rewardRoles = roleRewards
            .filter(reward => reward.level <= newLevel)
            .map(reward => reward.roleId);
        } else {
          // Give only the highest level role reward
          const applicableRewards = roleRewards.filter(reward => reward.level <= newLevel);
          if (applicableRewards.length > 0) {
            const highestReward = applicableRewards.reduce((prev, current) =>
              current.level > prev.level ? current : prev
            );
            rewardRoles = [highestReward.roleId];
          }
        }
      }

      return {
        xpGained: xpToAdd,
        totalXp: newXp,
        oldLevel,
        newLevel,
        leveledUp,
        rewardRoles: rewardRoles.length > 0 ? rewardRoles : undefined,
      };
    } catch (error) {
      logger.error(`Failed to add XP for user ${userId} in guild ${guildId}:`, error);
      return null;
    }
  }

  // Get user rank data
  async getUserRank(userId: string, guildId: string): Promise<RankData | null> {
    try {
      // Get user XP data
      const [userXpData] = await getDatabase()
        .select({
          userId: userXp.userId,
          guildId: userXp.guildId,
          xp: userXp.xp,
          level: userXp.level,
          username: users.username,
          avatarUrl: users.avatarUrl,
        })
        .from(userXp)
        .leftJoin(users, eq(users.id, userXp.userId))
        .where(and(eq(userXp.userId, userId), eq(userXp.guildId, guildId)))
        .limit(1);

      if (!userXpData) {
        return null;
      }

      // Get user rank
      const db3 = getDatabase();
      const [rankResult] = await db3
        .select({
          rank: sql<number>`COUNT(*) + 1`,
        })
        .from(userXp)
        .where(
          and(
            eq(userXp.guildId, guildId),
            gte(userXp.xp, userXpData.xp),
            sql`${userXp.userId} != ${userId}`
          )
        );

      const rank = rankResult?.rank || 1;

      // Calculate progress to next level
      const currentLevelXp = this.calculateXpForLevel(userXpData.level);
      const nextLevelXp = this.calculateXpForLevel(userXpData.level + 1);
      const progress = ((userXpData.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

      return {
        userId: userXpData.userId,
        guildId: userXpData.guildId,
        username: userXpData.username || t('common.unknownUser', { defaultValue: 'Unknown User' }),
        avatarUrl: userXpData.avatarUrl || undefined,
        xp: userXpData.xp,
        level: userXpData.level,
        rank,
        nextLevelXp,
        currentLevelXp,
        progress: Math.min(100, Math.max(0, progress)),
      };
    } catch (error) {
      logger.error(`Failed to get rank for user ${userId} in guild ${guildId}:`, error);
      return null;
    }
  }

  // Get leaderboard
  async getLeaderboard(
    guildId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    entries: LeaderboardEntry[];
    totalPages: number;
    currentPage: number;
  }> {
    try {
      const offset = (page - 1) * limit;

      // Get total count
      const [countResult] = await getDatabase()
        .select({ count: sql<number>`COUNT(*)` })
        .from(userXp)
        .where(eq(userXp.guildId, guildId));

      const totalCount = countResult?.count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      // Get leaderboard entries
      const entries = await getDatabase()
        .select({
          userId: userXp.userId,
          xp: userXp.xp,
          level: userXp.level,
          username: users.username,
          avatarUrl: users.avatarUrl,
        })
        .from(userXp)
        .leftJoin(users, eq(users.id, userXp.userId))
        .where(eq(userXp.guildId, guildId))
        .orderBy(desc(userXp.xp))
        .limit(limit)
        .offset(offset);

      // Add rank to entries
      const leaderboardEntries: LeaderboardEntry[] = entries.map((entry, index) => ({
        userId: entry.userId,
        username: entry.username || t('common.unknownUser', { defaultValue: 'Unknown User' }),
        avatarUrl: entry.avatarUrl || undefined,
        xp: entry.xp,
        level: entry.level,
        rank: offset + index + 1,
      }));

      return {
        entries: leaderboardEntries,
        totalPages,
        currentPage: page,
      };
    } catch (error) {
      logger.error(`Failed to get leaderboard for guild ${guildId}:`, error);
      return {
        entries: [],
        totalPages: 0,
        currentPage: 1,
      };
    }
  }

  // Reset user XP
  async resetUserXP(userId: string, guildId: string): Promise<boolean> {
    try {
      await getDatabase()
        .delete(userXp)
        .where(and(eq(userXp.userId, userId), eq(userXp.guildId, guildId)));

      return true;
    } catch (error) {
      logger.error(`Failed to reset XP for user ${userId} in guild ${guildId}:`, error);
      return false;
    }
  }

  // Get rank card customization
  async getRankCardCustomization(userId: string): Promise<RankCardCustomization> {
    try {
      const [user] = await getDatabase()
        .select({
          rankCardData: users.rankCardData,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user?.rankCardData) {
        return JSON.parse(user.rankCardData) as RankCardCustomization;
      }

      return {
        backgroundColor: '#23272A',
        progressBarColor: '#5865F2',
        textColor: '#FFFFFF',
        accentColor: '#EB459E',
      };
    } catch (error) {
      logger.error(`Failed to get rank card customization for user ${userId}:`, error);
      return {
        backgroundColor: '#23272A',
        progressBarColor: '#5865F2',
        textColor: '#FFFFFF',
        accentColor: '#EB459E',
      };
    }
  }

  // Save rank card customization
  async saveRankCardCustomization(
    userId: string,
    customization: RankCardCustomization
  ): Promise<boolean> {
    try {
      await getDatabase()
        .update(users)
        .set({
          rankCardData: JSON.stringify(customization),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return true;
    } catch (error) {
      logger.error(`Failed to save rank card customization for user ${userId}:`, error);
      return false;
    }
  }

  // Voice state tracking
  startVoiceTracking(userId: string, guildId: string): void {
    const key = `${userId}-${guildId}`;
    this.voiceStates.set(key, Date.now());
  }

  async stopVoiceTracking(
    userId: string,
    guildId: string,
    member: GuildMember
  ): Promise<XPGainResult | null> {
    const key = `${userId}-${guildId}`;
    const startTime = this.voiceStates.get(key);

    if (!startTime) return null;

    this.voiceStates.delete(key);

    const duration = Date.now() - startTime;
    const minutes = Math.floor(duration / 60000);

    if (minutes < 1) return null;

    const config = await configurationService.getXPConfig(guildId);
    const xpToAdd = minutes * config.perVoiceMinute;

    // Update last voice activity
    await getDatabase()
      .update(userXp)
      .set({
        lastVoiceActivity: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(userXp.userId, userId), eq(userXp.guildId, guildId)));

    return this.addXP(userId, guildId, member, xpToAdd);
  }

  // Get all voice states (for cleanup)
  getAllVoiceStates(): Map<string, number> {
    return this.voiceStates;
  }
}

// Export singleton instance
export const xpService = new XPService();
