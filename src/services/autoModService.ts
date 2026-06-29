import { Message, GuildMember } from 'discord.js';
import { autoModRepository } from '../repositories/autoModRepository';
import { logger } from '../utils/logger';
import type { AutoModRule, QuarantineVault } from '../types';

export class AutoModService {
  async evaluateMessage(message: Message): Promise<boolean> {
    if (!message.guild || message.author.bot) return false;

    try {
      const rules = await autoModRepository.getRulesByEvent(message.guild.id, 'messageCreate');
      if (!rules || rules.length === 0) return false;

      const member = message.member;
      const channelId = message.channel.id;

      for (const rule of rules) {
        // Check exempt channels
        if (rule.exemptChannels && rule.exemptChannels.includes(channelId)) continue;

        // Check exempt roles
        if (member && rule.exemptRoles && rule.exemptRoles.some(roleId => member.roles.cache.has(roleId))) {
          continue;
        }

        const isTriggered = this.checkRuleMatch(message, rule);
        if (isTriggered) {
          await this.executeActions(message, rule);
          return true; // Stop evaluating further rules if one is triggered and actions are executed
        }
      }
    } catch (error) {
      logger.error(`Error evaluating AutoMod for message ${message.id}:`, error);
    }

    return false;
  }

  private checkRuleMatch(message: Message, rule: AutoModRule): boolean {
    const { triggerType, triggerMetadata } = rule;
    const content = message.content;

    switch (triggerType) {
      case 'KEYWORD': {
        const keywords: string[] = triggerMetadata?.keywords || [];
        return keywords.some(keyword => content.toLowerCase().includes(keyword.toLowerCase()));
      }
      case 'REGEX': {
        const patterns: string[] = triggerMetadata?.regexPatterns || [];
        return patterns.some(pattern => {
          try {
            const regex = new RegExp(pattern, 'i');
            return regex.test(content);
          } catch {
            return false;
          }
        });
      }
      case 'MENTION_SPAM': {
        const threshold: number = triggerMetadata?.mentionTotalLimit || 5;
        return message.mentions.users.size + message.mentions.roles.size >= threshold;
      }
      case 'ATTACHMENT_SPAM': {
        const threshold: number = triggerMetadata?.attachmentLimit || 5;
        return message.attachments.size >= threshold;
      }
      default:
        return false;
    }
  }

  private async executeActions(message: Message, rule: AutoModRule): Promise<void> {
    const { actions } = rule;
    const guildId = message.guild!.id;
    const userId = message.author.id;

    for (const action of actions) {
      switch (action.type) {
        case 'DELETE_MESSAGE': {
          try {
            if (message.deletable) {
              await message.delete();
            }
          } catch (error) {
            logger.warn(`AutoMod failed to delete message ${message.id}:`, error);
          }
          break;
        }
        case 'WARN_USER': {
          try {
            const reason = action.metadata?.reason || `Triggered AutoMod rule: ${rule.name}`;
            if ('send' in message.channel) {
              await message.channel.send(`⚠️ <@${userId}>, you have received a warning: ${reason}`);
            }
          } catch (error) {
            logger.warn(`AutoMod failed to warn user ${userId}:`, error);
          }
          break;
        }
        case 'TIMEOUT_USER': {
          try {
            const duration = action.metadata?.durationSeconds || 60;
            if (message.member && message.member.moderatable) {
              await message.member.timeout(duration * 1000, `AutoMod rule: ${rule.name}`);
            }
          } catch (error) {
            logger.warn(`AutoMod failed to timeout user ${userId}:`, error);
          }
          break;
        }
        case 'ADD_INFRACTION': {
          try {
            const points = action.metadata?.points || 1;
            const expiresHours = action.metadata?.expiresHours || 24;
            const expiresAt = new Date(Date.now() + expiresHours * 3600 * 1000);

            await autoModRepository.createInfraction({
              guildId,
              userId,
              ruleId: rule.id,
              points,
              actionTaken: action.type,
              reason: `Triggered AutoMod rule: ${rule.name}`,
              expiresAt,
            });

            // Check if user exceeded quarantine threshold
            const activeInfractions = await autoModRepository.getActiveInfractions(guildId, userId);
            const totalPoints = activeInfractions.reduce((acc, curr) => acc + curr.points, 0);
            const quarantineThreshold = action.metadata?.quarantineThreshold || 10;

            if (totalPoints >= quarantineThreshold) {
              await this.quarantineUser(guildId, userId, message.member, `Exceeded infraction threshold (${totalPoints}/${quarantineThreshold})`, 'AutoMod');
            }
          } catch (error) {
            logger.error(`AutoMod failed to add infraction for user ${userId}:`, error);
          }
          break;
        }
      }
    }
  }

  async quarantineUser(
    guildId: string,
    userId: string,
    member: GuildMember | null,
    reason: string,
    jailedBy?: string
  ): Promise<QuarantineVault | null> {
    try {
      const existing = await autoModRepository.getQuarantineStatus(guildId, userId);
      if (existing) return existing; // Already in quarantine

      let originalRoles: string[] = [];
      if (member) {
        // Backup original roles (ignoring @everyone)
        originalRoles = member.roles.cache.filter(r => r.id !== guildId).map(r => r.id);

        try {
          // Attempt to strip roles
          await member.roles.remove(originalRoles, `Quarantined: ${reason}`);
          
          // Look for a quarantine role to add if exists
          const quarantineRole = member.guild.roles.cache.find(r => r.name.toLowerCase().includes('quarantine') || r.name.toLowerCase().includes('jailed'));
          if (quarantineRole) {
            await member.roles.add(quarantineRole, `Quarantined: ${reason}`);
          }
        } catch (error) {
          logger.warn(`Failed to modify roles for quarantined member ${userId}:`, error);
        }
      }

      return await autoModRepository.quarantineUser({
        guildId,
        userId,
        originalRoles,
        reason,
        jailedBy,
      });
    } catch (error) {
      logger.error(`Error quarantining user ${userId}:`, error);
      throw error;
    }
  }

  async releaseQuarantine(
    guildId: string,
    userId: string,
    member: GuildMember | null,
    releasedBy: string
  ): Promise<QuarantineVault | null> {
    try {
      const record = await autoModRepository.releaseQuarantine(guildId, userId, releasedBy);
      if (!record) return null;

      if (member) {
        try {
          // Remove quarantine role if present
          const quarantineRole = member.guild.roles.cache.find(r => r.name.toLowerCase().includes('quarantine') || r.name.toLowerCase().includes('jailed'));
          if (quarantineRole) {
            await member.roles.remove(quarantineRole, `Released from quarantine by ${releasedBy}`);
          }

          // Restore original roles
          if (record.originalRoles && record.originalRoles.length > 0) {
            await member.roles.add(record.originalRoles, `Released from quarantine by ${releasedBy}`);
          }
        } catch (error) {
          logger.warn(`Failed to restore roles for released member ${userId}:`, error);
        }
      }

      return record;
    } catch (error) {
      logger.error(`Error releasing quarantine for user ${userId}:`, error);
      throw error;
    }
  }
}

export const autoModService = new AutoModService();
