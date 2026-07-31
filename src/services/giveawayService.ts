import {
  EmbedBuilder,
  TextChannel,
  User,
  Guild,
  GuildMember,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { giveawayRepository } from '../repositories/giveawayRepository';
import { auditLogger } from '../security/audit';
import { t } from '../i18n';
import { logger } from '../utils/logger';
import { generateId } from '../utils/id';
import { xpRepository } from '../repositories/xpRepository';

export interface GiveawayRequirements {
  roleIds?: string[];
  minLevel?: number;
  minTimeInServer?: string;
}

export interface GiveawayBonusEntries {
  roles?: Record<string, number>;
  booster?: number;
}

export interface CreateGiveawayData {
  guildId: string;
  channelId: string;
  hostedBy: string;
  prize: string;
  winnerCount: number;
  endTime: Date;
  startTime?: Date | null;
  description: string | null;
  requirements: GiveawayRequirements;
  bonusEntries: GiveawayBonusEntries;
  embedTitle?: string | null;
  embedColor: number;
  embedImage?: string | null;
  embedThumbnail?: string | null;
}

export interface GiveawayResult {
  success: boolean;
  error?: string;
  winners?: string[];
}

export interface GiveawayEntry {
  userId: string;
  entries: number;
}

export interface GiveawayData {
  giveawayId: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  hostedBy: string;
  prize: string;
  winnerCount: number;
  status: 'active' | 'ended' | 'scheduled' | 'cancelled';
  endTime: Date;
  startTime?: Date | null;
  description: string | null;
  requirements: GiveawayRequirements;
  bonusEntries: GiveawayBonusEntries;
  embedColor: number;
  winners: string[];
  endedAt: Date | null;
  announcementSent?: boolean;
}

export class GiveawayService {
  private activeTimers = new Map<string, NodeJS.Timeout>();
  public startCommandEmbedCache = new Map<string, {embedTitle?: string|null, embedImage?: string|null, embedThumbnail?: string|null}>();

  async createGiveaway(data: CreateGiveawayData) {
    const giveawayId = `GW${generateId(10)}`;

    const isScheduled = data.startTime && data.startTime > new Date();

    const giveaway = await giveawayRepository.createGiveaway({
      giveawayId,
      ...data,
      status: isScheduled ? 'scheduled' : 'active',
      requirements: data.requirements as Record<string, unknown>,
      bonusEntries: data.bonusEntries as Record<string, unknown>,
    });

    if (!isScheduled) {
      // Schedule the giveaway end
      this.scheduleGiveawayEnd({
        giveawayId: giveaway.giveawayId,
        endTime: giveaway.endTime,
        status: giveaway.status,
      });
    }

    // Log the action
    await auditLogger.logAction({
      action: 'GIVEAWAY_CREATE',
      userId: data.hostedBy,
      guildId: data.guildId,
      details: {
        giveawayId: giveaway.giveawayId,
        prize: data.prize,
        winnerCount: data.winnerCount,
        endTime: data.endTime,
      },
    });

    return giveaway;
  }

  async updateGiveawayMessage(giveawayId: string, messageId: string) {
    await giveawayRepository.updateGiveaway(giveawayId, { messageId });
  }

  async getGiveaway(giveawayId: string) {
    return giveawayRepository.getGiveaway(giveawayId);
  }

  async enterGiveaway(
    giveawayId: string,
    userId: string,
    guild: Guild
  ): Promise<{ success: boolean; error?: string; entries?: number }> {
    const giveaway = await giveawayRepository.getGiveaway(giveawayId);

    if (!giveaway) {
      return { success: false, error: t('commands.giveaway.notFound') };
    }

    if (giveaway.status !== 'active') {
      return { success: false, error: t('commands.giveaway.notActive') };
    }

    // Check requirements
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      return { success: false, error: t('common.invalidUser') };
    }

    const requirementCheck = await this.checkRequirements(
      member,
      giveaway.requirements as GiveawayRequirements
    );
    if (!requirementCheck.met) {
      return { success: false, error: requirementCheck.reason };
    }

    // Calculate entries
    const bonusMultiplier = this.calculateBonusEntries(
      member,
      giveaway.bonusEntries as GiveawayBonusEntries
    );
    const totalEntries = 1 * bonusMultiplier;

    // Add entry
    await giveawayRepository.addEntry(giveawayId, userId, totalEntries);

    return { success: true, entries: totalEntries };
  }

  async removeEntry(
    giveawayId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const giveaway = await giveawayRepository.getGiveaway(giveawayId);

    if (!giveaway) {
      return { success: false, error: t('commands.giveaway.notFound') };
    }

    if (giveaway.status !== 'active') {
      return { success: false, error: t('commands.giveaway.notActive') };
    }

    await giveawayRepository.removeEntry(giveawayId, userId);
    return { success: true };
  }

  async endGiveaway(giveawayId: string, endedBy: User): Promise<GiveawayResult> {
    const giveaway = await giveawayRepository.getGiveaway(giveawayId);

    if (!giveaway) {
      return { success: false, error: t('commands.giveaway.notFound') };
    }

    if (giveaway.status !== 'active') {
      return { success: false, error: t('commands.giveaway.notActive') };
    }

    // Get entries and select winners
    const entries = await giveawayRepository.getEntries(giveawayId);
    const winners = this.selectWinners(entries, giveaway.winnerCount);

    // Update giveaway status
    await giveawayRepository.updateGiveaway(giveawayId, {
      status: 'ended',
      winners,
      endedAt: new Date(),
    });

    // Cancel timer
    const timer = this.activeTimers.get(giveawayId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(giveawayId);
    }

    // Get updated giveaway with ended status
    const updatedGiveaway = await giveawayRepository.getGiveaway(giveawayId);

    // Update the giveaway message
    if (updatedGiveaway) {
      await this.updateGiveawayEmbed(updatedGiveaway, winners);
    }

    // Log the action
    await auditLogger.logAction({
      action: 'GIVEAWAY_END',
      userId: endedBy.id,
      guildId: giveaway.guildId,
      details: {
        giveawayId,
        winners,
        entryCount: entries.length,
      },
    });

    return { success: true, winners };
  }

  async rerollGiveaway(
    giveawayId: string,
    rerolledBy: User,
    newWinnerCount?: number
  ): Promise<GiveawayResult> {
    const giveaway = await giveawayRepository.getGiveaway(giveawayId);

    if (!giveaway) {
      return { success: false, error: t('commands.giveaway.notFound') };
    }

    if (giveaway.status !== 'ended') {
      return { success: false, error: t('commands.giveaway.error') };
    }

    const winnerCount = newWinnerCount || giveaway.winnerCount;

    // Get entries and select new winners
    const entries = await giveawayRepository.getEntries(giveawayId);
    const winners = this.selectWinners(entries, winnerCount);

    // Update giveaway with new winners
    await giveawayRepository.updateGiveaway(giveawayId, {
      winners,
      winnerCount,
    });

    // Update the giveaway message
    await this.updateGiveawayEmbed(giveaway, winners);

    // Log the action
    await auditLogger.logAction({
      action: 'GIVEAWAY_REROLL',
      userId: rerolledBy.id,
      guildId: giveaway.guildId,
      details: {
        giveawayId,
        oldWinners: giveaway.winners,
        newWinners: winners,
      },
    });

    return { success: true, winners };
  }

  async updateGiveaway(giveawayId: string, updates: Partial<GiveawayData>, updatedBy: User) {
    const giveaway = await giveawayRepository.getGiveaway(giveawayId);

    if (!giveaway || giveaway.status !== 'active') {
      throw new Error(t('commands.giveaway.notFound'));
    }

    await giveawayRepository.updateGiveaway(giveawayId, updates);

    // Update the giveaway embed
    const updatedGiveaway = await giveawayRepository.getGiveaway(giveawayId);
    await this.updateGiveawayEmbed(updatedGiveaway);

    // Log the action
    await auditLogger.logAction({
      action: 'GIVEAWAY_UPDATE',
      userId: updatedBy.id,
      guildId: giveaway.guildId,
      details: {
        giveawayId,
        updates,
      },
    });
  }

  private async checkRequirements(
    member: GuildMember,
    requirements: GiveawayRequirements
  ): Promise<{ met: boolean; reason?: string }> {
    // Check role requirements
    if (requirements.roleIds && requirements.roleIds.length > 0) {
      const hasRequiredRole = requirements.roleIds.some((roleId: string) =>
        member.roles.cache.has(roleId)
      );
      if (!hasRequiredRole) {
        return { met: false, reason: t('commands.giveaway.requirementsNotMet') };
      }
    }

    // Check level requirement
    if (requirements.minLevel) {
      const userXP = await xpRepository.getUserXP(member.id, member.guild.id);
      const userLevel = userXP?.level || 0;
      if (userLevel < requirements.minLevel) {
        return { met: false, reason: t('commands.giveaway.requirementsNotMet') };
      }
    }

    // Check time in server requirement
    if (requirements.minTimeInServer) {
      const joinedAt = member.joinedAt;
      if (!joinedAt) {
        return { met: false, reason: t('commands.giveaway.requirementsNotMet') };
      }

      const timeInServer = Date.now() - joinedAt.getTime();
      const requiredTime = this.parseTimeRequirement(requirements.minTimeInServer);

      if (timeInServer < requiredTime) {
        return {
          met: false,
          reason: t('commands.giveaway.requirementsNotMet'),
        };
      }
    }

    return { met: true };
  }

  private calculateBonusEntries(member: GuildMember, bonusEntries: GiveawayBonusEntries): number {
    let multiplier = 1;

    // Check role bonuses
    if (bonusEntries.roles) {
      for (const [roleId, bonus] of Object.entries(bonusEntries.roles)) {
        if (member.roles.cache.has(roleId)) {
          multiplier = Math.max(multiplier, bonus);
        }
      }
    }

    // Check booster bonus
    if (bonusEntries.booster && member.premiumSince) {
      multiplier = Math.max(multiplier, bonusEntries.booster);
    }

    return multiplier;
  }

  private selectWinners(entries: GiveawayEntry[], count: number): string[] {
    if (entries.length === 0) return [];

    // Create weighted array
    const weightedEntries: string[] = [];
    for (const entry of entries) {
      for (let i = 0; i < entry.entries; i++) {
        weightedEntries.push(entry.userId);
      }
    }

    // Shuffle and select unique winners
    const shuffled = weightedEntries.sort(() => Math.random() - 0.5);
    const winners = new Set<string>();

    for (const userId of shuffled) {
      winners.add(userId);
      if (winners.size >= Math.min(count, entries.length)) break;
    }

    return Array.from(winners);
  }

  private async updateGiveawayEmbed(
    giveaway: {
      giveawayId: string;
      channelId: string;
      messageId: string | null;
      status: string;
      embedColor: number;
      description: string | null;
      prize: string;
      hostedBy: string;
      winnerCount: number;
      endTime: Date;
      announcementSent?: boolean;
      embedTitle?: string | null;
      embedImage?: string | null;
      embedThumbnail?: string | null;
    } | null,
    winners?: string[]
  ) {
    const client = (
      global as { client?: { channels: { fetch: (id: string) => Promise<unknown> } } }
    ).client;
    if (!client || !giveaway) return;

    try {
      const channel = (await client.channels
        .fetch(giveaway.channelId)
        .catch(() => null)) as TextChannel;
      if (!channel || !giveaway.messageId) return;

      const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (!message) return;

      const embed = new EmbedBuilder()
        .setColor(giveaway.status === 'active' ? giveaway.embedColor || 0x0099ff : 0x808080)
        .setTitle(
          giveaway.status === 'active'
            ? (giveaway.embedTitle || t('commands.giveaway.embed.title'))
            : t('commands.giveaway.embed.ended')
        )
        .setDescription(
          giveaway.description ||
            t('commands.giveaway.embed.description', { prize: giveaway.prize })
        )
        .addFields(
          {
            name: t('commands.giveaway.embed.hostedBy'),
            value: `<@${giveaway.hostedBy}>`,
            inline: true,
          },
          {
            name: t('commands.giveaway.embed.winners'),
            value: giveaway.winnerCount.toString(),
            inline: true,
          }
        )
        .setFooter({
          text: t('commands.giveaway.embed.footer', { id: giveaway.giveawayId }),
        })
        .setTimestamp();
        
      if (giveaway.embedImage) embed.setImage(giveaway.embedImage);
      if (giveaway.embedThumbnail) embed.setThumbnail(giveaway.embedThumbnail);

      if (giveaway.status === 'active') {
        embed.addFields({
          name: t('commands.giveaway.embed.endsAt'),
          value: `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`,
          inline: true,
        });
      } else if (winners && winners.length > 0) {
        embed.addFields({
          name: t('commands.giveaway.embed.winnersField'),
          value: winners.map(w => `<@${w}>`).join('\n'),
          inline: false,
        });
      } else {
        embed.addFields({
          name: t('commands.giveaway.embed.winnersField'),
          value: t('commands.giveaway.embed.noWinners'),
          inline: false,
        });
      }

      const components =
        giveaway.status === 'active'
          ? [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId(`gw_enter:${giveaway.giveawayId}`)
                  .setLabel(t('commands.giveaway.buttons.enter'))
                  .setStyle(ButtonStyle.Primary)
                  .setEmoji('🎉'),
                new ButtonBuilder()
                  .setCustomId(`gw_info:${giveaway.giveawayId}`)
                  .setLabel(t('commands.giveaway.buttons.info'))
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji('ℹ️')
              ),
            ]
          : [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId(`gw_enter:${giveaway.giveawayId}`)
                  .setLabel(t('commands.giveaway.buttons.enter'))
                  .setStyle(ButtonStyle.Primary)
                  .setEmoji('🎉')
                  .setDisabled(true),
                new ButtonBuilder()
                  .setCustomId(`gw_info:${giveaway.giveawayId}`)
                  .setLabel(t('commands.giveaway.buttons.info'))
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji('ℹ️')
                  .setDisabled(true)
              ),
            ];

      await message.edit({ embeds: [embed], components });

      // Send winner announcement
      if (
        giveaway.status === 'ended' &&
        winners &&
        winners.length > 0 &&
        !giveaway.announcementSent
      ) {
        const winnerMentions = winners.map(w => `<@${w}>`).join(', ');
        await channel
          .send({
            content: `🎉 **GIVEAWAY ENDED** 🎉\n\nCongratulations ${winnerMentions}! You won **${giveaway.prize}**!`,
            reply: { messageReference: giveaway.messageId },
          })
          .catch(() => {
            // Fallback without reply
            void channel.send({
              content: `🎉 **GIVEAWAY ENDED** 🎉\n\nCongratulations ${winnerMentions}! You won **${giveaway.prize}**!`,
            });
          });
        // Mark announcement as sent to prevent duplicates
        giveaway.announcementSent = true;
        await giveawayRepository.updateGiveaway(giveaway.giveawayId, { announcementSent: true });
      }
    } catch (error) {
      logger.error('Error updating giveaway embed:', error);
    }
  }

  private scheduleGiveawayEnd(giveaway: { giveawayId: string; endTime: Date; status?: string }) {
    const endTime = new Date(giveaway.endTime);
    const now = new Date();
    const timeUntilEnd = endTime.getTime() - now.getTime();

    logger.info(
      `Giveaway ${giveaway.giveawayId}: End time: ${endTime.toISOString()}, Now: ${now.toISOString()}, Time until end: ${timeUntilEnd}ms (${Math.floor(timeUntilEnd / 1000)}s)`
    );

    if (timeUntilEnd <= 0) {
      // Giveaway should have already ended
      logger.info(`Ending expired giveaway immediately: ${giveaway.giveawayId}`);
      void this.endGiveaway(giveaway.giveawayId, { id: 'system' } as User);
      return;
    }

    // Use Math.min to prevent issues with very large timeouts
    const timeoutValue = Math.min(timeUntilEnd, 2147483647); // Max setTimeout value

    const timer = setTimeout(() => {
      logger.info(`Timer triggered for giveaway: ${giveaway.giveawayId}`);
      void this.endGiveaway(giveaway.giveawayId, { id: 'system' } as User);
      this.activeTimers.delete(giveaway.giveawayId);
    }, timeoutValue);

    this.activeTimers.set(giveaway.giveawayId, timer);
    logger.info(
      `Scheduled giveaway ${giveaway.giveawayId} to end in ${Math.floor(timeUntilEnd / 1000)}s`
    );
  }

  async initializeActiveGiveaways() {
    const activeGiveaways = await giveawayRepository.getActiveGiveaways();

    logger.info(`Found ${activeGiveaways.length} active giveaways`);

    for (const giveaway of activeGiveaways) {
      this.scheduleGiveawayEnd({
        giveawayId: giveaway.giveawayId,
        endTime: giveaway.endTime,
        status: giveaway.status,
      });
    }

    // Start periodic check for expired giveaways (every minute)
    this.startPeriodicExpiredCheck();

    // Resume any pending winner announcements after restarts
    await this.processPendingAnnouncements();
  }

  private startPeriodicExpiredCheck() {
    setInterval(() => {
      void (async () => {
        try {
          await this.processExpiredGiveaways();
          await this.processScheduledGiveaways();
        } catch (error) {
          logger.error('Error processing expired giveaways:', error);
        }
      })();
    }, 60000); // Check every minute
  }

  private async processExpiredGiveaways() {
    const expiredGiveaways = await giveawayRepository.getExpiredGiveaways();

    for (const giveaway of expiredGiveaways) {
      logger.info(`Processing expired giveaway: ${giveaway.giveawayId}`);
      await this.endGiveaway(giveaway.giveawayId, { id: 'system' } as User);
    }
  }

  private async processScheduledGiveaways() {
    const scheduledGiveaways = await giveawayRepository.getScheduledGiveaways();

    for (const giveaway of scheduledGiveaways) {
      logger.info(`Processing scheduled giveaway: ${giveaway.giveawayId}`);
      
      // We update the embed first, this will send the message if messageId is null!
      // But wait! updateGiveawayEmbed returns early if messageId is null! 
      // I need to send the message here directly and then update DB.
      
      const client = (global as any).client;
      if (!client) continue;
      
      try {
        const channel = await client.channels.fetch(giveaway.channelId) as TextChannel;
        if (!channel) continue;
        
        const embed = new EmbedBuilder()
          .setTitle(giveaway.embedTitle || '🎉 GIVEAWAY 🎉')
          .setDescription(
            `**Prize:** ${giveaway.prize}\n${giveaway.description || ''}\n\nReact with 🎉 to enter!`
          )
          .addFields(
            { name: 'Ends', value: `<t:${Math.floor(new Date(giveaway.endTime).getTime() / 1000)}:R>`, inline: true },
            { name: 'Winners', value: giveaway.winnerCount.toString(), inline: true },
            { name: 'Hosted By', value: `<@${giveaway.hostedBy}>`, inline: true }
          )
          .setColor(giveaway.embedColor || 0x5865f2)
          .setFooter({ text: t('commands.giveaway.embed.footer', { id: giveaway.giveawayId, defaultValue: `Giveaway ID: ${giveaway.giveawayId}` }) })
          .setTimestamp(new Date(giveaway.endTime));

        if (giveaway.embedImage) embed.setImage(giveaway.embedImage);
        if (giveaway.embedThumbnail) embed.setThumbnail(giveaway.embedThumbnail);
        
        // Add roles to embed if there are requirements
        const reqs: any = giveaway.requirements || {};
        if (reqs.roleIds && reqs.roleIds.length > 0) {
           embed.addFields({ name: 'Required Role', value: `<@&${reqs.roleIds[0]}>`, inline: false });
        }

        const button = new ButtonBuilder()
          .setCustomId(`gw_enter:${giveaway.giveawayId}`)
          .setLabel(t('commands.giveaway.buttons.enter', { defaultValue: 'Enter' }))
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎉');

        const infoButton = new ButtonBuilder()
          .setCustomId(`gw_info:${giveaway.giveawayId}`)
          .setLabel(t('commands.giveaway.buttons.info', { defaultValue: 'Info' }))
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('ℹ️');

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button, infoButton);

        const message = await channel.send({ embeds: [embed], components: [row] });
        
        // Update DB
        await giveawayRepository.updateGiveaway(giveaway.giveawayId, {
          status: 'active',
          messageId: message.id
        });
        
        // Schedule end
        this.scheduleGiveawayEnd({
          giveawayId: giveaway.giveawayId,
          endTime: giveaway.endTime,
          status: 'active',
        });
        
      } catch (error) {
        logger.error(`Error sending scheduled giveaway ${giveaway.giveawayId}:`, error);
      }
    }
  }

  private async processPendingAnnouncements() {
    const pending = await giveawayRepository.getEndedGiveawaysPendingAnnouncement();
    for (const giveaway of pending) {
      const winners = Array.isArray(giveaway.winners) ? (giveaway.winners as string[]) : [];
      if (winners.length === 0) continue;
      logger.info(`Sending pending giveaway announcement for ${giveaway.giveawayId}`);
      await this.updateGiveawayEmbed(giveaway, winners);
    }
  }

  private parseTimeRequirement(time: string): number {
    const regex = /^(\d+)([dhm])$/;
    const match = time.match(regex);

    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'm':
        return value * 60 * 1000;
      default:
        return 0;
    }
  }
}

export const giveawayService = new GiveawayService();
