import { Message, GuildMember, TextChannel } from 'discord.js';
import { engagementRepository } from '../repositories/engagementRepository';
import { economyRepository } from '../repositories/economyRepository';
import { xpService } from './xpService';
import { logger } from '../utils/logger';
import type { EngagementQuest, UserReputation } from '../types';
import { guildService } from './guildService';

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
        if (quest.targetType === 'messages_sent') {
          if (quest.requirementChannelId && message.channel.id !== quest.requirementChannelId) {
            continue;
          }
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

      // 2. Increment message count in members table and check achievements
      if (member) {
        const totalMessages = await engagementRepository.incrementMemberMetric(guildId, userId, 'messages', 1);
        
        await this.checkAchievements(
          guildId,
          userId,
          member,
          'messages_sent',
          totalMessages,
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
        if (quest.targetType === 'voice_minutes') {
          await this.progressQuest(guildId, userId, member, quest, minutes);
        }
      }

      // 2. Increment voice minutes and check voice achievements
      const totalVoiceMinutes = await engagementRepository.incrementMemberMetric(guildId, userId, 'voiceMinutes', minutes);
      await this.checkAchievements(guildId, userId, member, 'voice_minutes', totalVoiceMinutes);
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

        const notifyChannel = quest.channelId 
          ? (channel?.guild?.channels.cache.get(quest.channelId) as TextChannel) 
          : channel;

        if (notifyChannel) {
          await notifyChannel.send(
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
      const guildSettings = await guildService.getGuildSettings(guildId);

      for (const achievement of achievements) {
        if (unlockedIds.has(achievement.id)) continue;

        if (achievement.requirementChannelId && channel && channel.id !== achievement.requirementChannelId) {
          continue;
        }

        if (achievement.requirementType === metricType) {
          // Here we check if metric meets requirement value
          let currentMetric = incrementValue;
          if (metricType === 'reputation') {
            const reps = await engagementRepository.getUserReputation(guildId, userId);
            currentMetric = reps.length;
          } else if (metricType === 'messages_sent' || metricType === 'voice_minutes') {
            // currentMetric is already the total updated metric passed from the tracker
            currentMetric = incrementValue;
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

            let notifyChannel = channel;
            if (achievement.channelId) {
              notifyChannel = channel?.guild?.channels.cache.get(achievement.channelId) as TextChannel | undefined;
            } else if (guildSettings.achievementsChannel) {
              notifyChannel = channel?.guild?.channels.cache.get(guildSettings.achievementsChannel) as TextChannel | undefined;
            }

            if (notifyChannel) {
              await notifyChannel.send(
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
