import { and, eq, desc, sql } from 'drizzle-orm';
import { BaseRepository } from './baseRepository';
import {
  achievements,
  userAchievements,
  engagementQuests,
  userQuestProgress,
  userReputation,
} from '../database/schema/engagement';
import { userXp } from '../database/schema/xp';
import type {
  Achievement,
  UserAchievement,
  EngagementQuest,
  UserQuestProgress,
  UserReputation,
  UserXp,
} from '../types';

export class EngagementRepository extends BaseRepository {
  async getAchievement(guildId: string, achievementId: string): Promise<Achievement | null> {
    return this.executeQuery('getAchievement', async () => {
      const [record] = await this.db
        .select()
        .from(achievements)
        .where(
          and(eq(achievements.guildId, guildId), eq(achievements.achievementId, achievementId))
        )
        .limit(1);
      return (record as unknown as Achievement) || null;
    });
  }

  async listAchievements(guildId: string): Promise<Achievement[]> {
    return this.executeQuery('listAchievements', async () => {
      const records = await this.db
        .select()
        .from(achievements)
        .where(eq(achievements.guildId, guildId));
      return records as unknown as Achievement[];
    });
  }

  async createAchievement(data: {
    guildId: string;
    achievementId: string;
    title: string;
    description: string;
    requirementType: string;
    requirementValue: number;
    rewardXp?: number;
    rewardCoins?: number;
    customIcon?: string;
  }): Promise<Achievement> {
    return this.executeQuery('createAchievement', async () => {
      const [record] = await this.db
        .insert(achievements)
        .values({
          guildId: data.guildId,
          achievementId: data.achievementId,
          title: data.title,
          description: data.description,
          requirementType: data.requirementType,
          requirementValue: data.requirementValue,
          rewardXp: data.rewardXp ?? 0,
          rewardCoins: data.rewardCoins ?? 0,
          customIcon: data.customIcon,
        })
        .returning();
      return record as unknown as Achievement;
    });
  }

  async getUserAchievements(guildId: string, userId: string): Promise<UserAchievement[]> {
    return this.executeQuery('getUserAchievements', async () => {
      const records = await this.db
        .select()
        .from(userAchievements)
        .where(and(eq(userAchievements.guildId, guildId), eq(userAchievements.userId, userId)));
      return records as unknown as UserAchievement[];
    });
  }

  async unlockAchievement(
    guildId: string,
    userId: string,
    achievementDbId: string
  ): Promise<UserAchievement> {
    return this.executeQuery('unlockAchievement', async () => {
      const [record] = await this.db
        .insert(userAchievements)
        .values({
          guildId,
          userId,
          achievementId: achievementDbId,
          unlockedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning();
      return record as unknown as UserAchievement;
    });
  }

  async getActiveQuests(guildId: string): Promise<EngagementQuest[]> {
    return this.executeQuery('getActiveQuests', async () => {
      const records = await this.db
        .select()
        .from(engagementQuests)
        .where(eq(engagementQuests.guildId, guildId));
      const now = new Date();
      return (records as unknown as EngagementQuest[]).filter(r => new Date(r.activeUntil) > now);
    });
  }

  async createQuest(data: {
    guildId: string;
    questId: string;
    title: string;
    description: string;
    type: string;
    targetType: string;
    targetValue: number;
    rewardXp?: number;
    rewardCoins?: number;
    activeUntil: Date;
  }): Promise<EngagementQuest> {
    return this.executeQuery('createQuest', async () => {
      const [record] = await this.db
        .insert(engagementQuests)
        .values({
          guildId: data.guildId,
          questId: data.questId,
          title: data.title,
          description: data.description,
          type: data.type,
          targetType: data.targetType,
          targetValue: data.targetValue,
          rewardXp: data.rewardXp ?? 0,
          rewardCoins: data.rewardCoins ?? 0,
          activeUntil: data.activeUntil,
        })
        .returning();
      return record as unknown as EngagementQuest;
    });
  }

  async getUserQuestProgress(
    guildId: string,
    userId: string,
    questDbId: string
  ): Promise<UserQuestProgress | null> {
    return this.executeQuery('getUserQuestProgress', async () => {
      const [record] = await this.db
        .select()
        .from(userQuestProgress)
        .where(
          and(
            eq(userQuestProgress.guildId, guildId),
            eq(userQuestProgress.userId, userId),
            eq(userQuestProgress.questId, questDbId)
          )
        )
        .limit(1);
      return (record as unknown as UserQuestProgress) || null;
    });
  }

  async updateUserQuestProgress(
    guildId: string,
    userId: string,
    questDbId: string,
    progress: number,
    completed: boolean
  ): Promise<UserQuestProgress> {
    return this.executeQuery('updateUserQuestProgress', async () => {
      const [record] = await this.db
        .insert(userQuestProgress)
        .values({
          guildId,
          userId,
          questId: questDbId,
          progress,
          completed,
          completedAt: completed ? new Date() : null,
          lastUpdated: new Date(),
        })
        .onConflictDoUpdate({
          target: [userQuestProgress.guildId, userQuestProgress.userId, userQuestProgress.questId],
          set: {
            progress,
            completed,
            completedAt: completed ? new Date() : sql`${userQuestProgress.completedAt}`,
            lastUpdated: new Date(),
          },
        })
        .returning();
      return record as unknown as UserQuestProgress;
    });
  }

  async addReputation(
    guildId: string,
    userId: string,
    senderId: string,
    reason?: string
  ): Promise<UserReputation> {
    return this.executeQuery('addReputation', async () => {
      const [record] = await this.db
        .insert(userReputation)
        .values({
          guildId,
          userId,
          senderId,
          reason,
        })
        .returning();
      return record as unknown as UserReputation;
    });
  }

  async getUserReputation(guildId: string, userId: string): Promise<UserReputation[]> {
    return this.executeQuery('getUserReputation', async () => {
      const records = await this.db
        .select()
        .from(userReputation)
        .where(and(eq(userReputation.guildId, guildId), eq(userReputation.userId, userId)))
        .orderBy(desc(userReputation.createdAt));
      return records as unknown as UserReputation[];
    });
  }

  async getUserPrestige(userId: string, guildId: string): Promise<UserXp | null> {
    return this.executeQuery('getUserPrestige', async () => {
      const [record] = await this.db
        .select()
        .from(userXp)
        .where(and(eq(userXp.userId, userId), eq(userXp.guildId, guildId)))
        .limit(1);
      return (record as unknown as UserXp) || null;
    });
  }

  async updateUserPrestige(
    userId: string,
    guildId: string,
    prestigeLevel: number,
    newXp: number,
    newLevel: number
  ): Promise<boolean> {
    return this.executeQuery('updateUserPrestige', async () => {
      await this.db
        .insert(userXp)
        .values({
          userId,
          guildId,
          xp: newXp,
          level: newLevel,
          prestigeLevel,
          lastXpGain: new Date(),
        })
        .onConflictDoUpdate({
          target: [userXp.userId, userXp.guildId],
          set: {
            xp: newXp,
            level: newLevel,
            prestigeLevel,
            updatedAt: new Date(),
          },
        });
      return true;
    });
  }
}

export const engagementRepository = new EngagementRepository();
