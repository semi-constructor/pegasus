import { Message, GuildMember, TextChannel } from 'discord.js';
import { engagementRepository } from '../repositories/engagementRepository';
import { economyRepository } from '../repositories/economyRepository';
import { xpService } from './xpService';
import { logger } from '../utils/logger';
import type { EngagementQuest, UserReputation } from '../types';

export class EngagementService {
  async trackMessageActivity(message: Message): Promise<void> {
    if (!message.guild || message.author.bot) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const member = message.member;

    try {
      // 1. Check active quests for messages
      const activeQuests = await engagementRepository.getActiveQuests(guildId);
      for (const quest of activeQuests) {
        if (quest.targetType === 'messages') {
          await this.progressQuest(
            guildId,
            userId,
            member,
            quest,
            1,
            message.channel as TextChannel
          );
        }
      }

      // 2. Check achievements (e.g., messages sent count)
      // For simplicity and decoupling from message count queries every message, we can evaluate specific milestone checks or triggers
      if (member) {
        await this.checkAchievements(
          guildId,
          userId,
          member,
          'messages',
          1,
          message.channel as TextChannel
        );
      }
    } catch (error) {
      logger.error(`Error tracking message activity for user ${userId}:`, error);
    }
  }

  async trackVoiceActivity(
    userId: string,
    guildId: string,
    member: GuildMember | null,
    minutes: number
  ): Promise<void> {
    if (!member || member.user.bot || minutes <= 0) return;

    try {
      // 1. Check active quests for voice
      const activeQuests = await engagementRepository.getActiveQuests(guildId);
      for (const quest of activeQuests) {
        if (quest.targetType === 'voiceMinutes') {
          await this.progressQuest(guildId, userId, member, quest, minutes);
        }
      }

      // 2. Check voice achievements
      await this.checkAchievements(guildId, userId, member, 'voiceMinutes', minutes);
    } catch (error) {
      logger.error(`Error tracking voice activity for user ${userId}:`, error);
    }
  }

  private async progressQuest(
    guildId: string,
    userId: string,
    member: GuildMember | null,
    quest: EngagementQuest,
    amount: number,
    channel?: TextChannel
  ): Promise<void> {
    try {
      const progressObj = await engagementRepository.getUserQuestProgress(guildId, userId, quest.id);
      if (progressObj?.completed) return; // Already completed

      const newProgress = (progressObj?.progress || 0) + amount;
      const completed = newProgress >= quest.targetValue;

      await engagementRepository.updateUserQuestProgress(
        guildId,
        userId,
        quest.id,
        newProgress,
        completed
      );

      if (completed && member) {
        // Grant quest rewards
        if (quest.rewardCoins > 0) {
          await economyRepository.addToBalance(userId, guildId, quest.rewardCoins);
        }
        if (quest.rewardXp > 0) {
          await xpService.addXP(userId, guildId, member, quest.rewardXp);
        }

        if (channel) {
          await channel.send(
            `🎉 <@${userId}> has completed the quest **${quest.title}**! Earned ${quest.rewardXp} XP and ${quest.rewardCoins} coins.`
          );
        }
      }
    } catch (error) {
      logger.error(`Error progressing quest ${quest.questId} for user ${userId}:`, error);
    }
  }

  async checkAchievements(
    guildId: string,
    userId: string,
    member: GuildMember,
    metricType: string,
    incrementValue: number,
    channel?: TextChannel
  ): Promise<void> {
    try {
      const achievements = await engagementRepository.listAchievements(guildId);
      const userUnlocked = await engagementRepository.getUserAchievements(guildId, userId);
      const unlockedIds = new Set(userUnlocked.map(a => a.achievementId));

      for (const achievement of achievements) {
        if (unlockedIds.has(achievement.id)) continue;

        if (achievement.requirementType === metricType) {
          // Here we check if metric meets requirement value
          // E.g., if metric is 'reputation', we can check user reputation count
          let currentMetric = incrementValue;
          if (metricType === 'reputation') {
            const reps = await engagementRepository.getUserReputation(guildId, userId);
            currentMetric = reps.length;
          }

          if (currentMetric >= achievement.requirementValue) {
            await engagementRepository.unlockAchievement(guildId, userId, achievement.id);

            // Grant rewards
            if (achievement.rewardCoins > 0) {
              await economyRepository.addToBalance(userId, guildId, achievement.rewardCoins);
            }
            if (achievement.rewardXp > 0) {
              await xpService.addXP(userId, guildId, member, achievement.rewardXp);
            }

            if (channel) {
              await channel.send(
                `🏆 <@${userId}> unlocked the achievement **${achievement.title}**! (${achievement.description})`
              );
            }
          }
        }
      }
    } catch (error) {
      logger.error(`Error checking achievements for user ${userId}:`, error);
    }
  }

  async giveThanks(
    guildId: string,
    userId: string,
    senderId: string,
    member: GuildMember,
    reason?: string,
    channel?: TextChannel
  ): Promise<UserReputation> {
    const rep = await engagementRepository.addReputation(guildId, userId, senderId, reason);
    await this.checkAchievements(guildId, userId, member, 'reputation', 1, channel);
    return rep;
  }

  async prestigeUser(
    userId: string,
    guildId: string,
    _member: GuildMember
  ): Promise<{ success: boolean; newPrestige: number; message: string }> {
    const userXpData = await engagementRepository.getUserPrestige(userId, guildId);
    if (!userXpData) {
      return { success: false, newPrestige: 0, message: 'You do not have any XP yet.' };
    }

    const requiredLevel = 50; // Configurable prestige level threshold
    if (userXpData.level < requiredLevel) {
      return {
        success: false,
        newPrestige: userXpData.prestigeLevel,
        message: `You must reach level ${requiredLevel} to prestige. Current level: ${userXpData.level}.`,
      };
    }

    const newPrestige = userXpData.prestigeLevel + 1;
    await engagementRepository.updateUserPrestige(userId, guildId, newPrestige, 0, 0);

    return {
      success: true,
      newPrestige,
      message: `🎉 Congratulations! You have reached Prestige Level ${newPrestige}! Your XP has been reset to 0.`,
    };
  }
}

export const engagementService = new EngagementService();
