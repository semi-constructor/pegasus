import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
  TextChannel,
  NewsChannel,
  ChannelType,
  Collection,
  Snowflake,
  Message,
  Role,
  GuildBasedChannel,
  Guild,
  AuditLogEvent,
} from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t } from '../../i18n';
import { createLocalizationMap, commandNames, commandDescriptions } from '../../utils/localization';
import { getDatabase } from '../../database/connection';
import { auditLogger } from '../../security/audit';

import { userXp } from '../../database/schema/xp';
import { eq, and } from 'drizzle-orm';
import { ensureUserAndGuildExist } from '../../utils/userUtils';
import { logger } from '../../utils/logger';
import { modCaseRepository } from '../../repositories/modCaseRepository';



export const data = new SlashCommandBuilder()
  .setName('reset-xp')
      .setDescription(t('commands.moderation.subcommands.resetxp.description'))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.moderation.subcommands.resetxp.options.user'))
          .setRequired(true)
      )
      .addBooleanOption(option =>
        option
          .setName('confirm')
          .setDescription(t('commands.moderation.subcommands.resetxp.options.confirm'))
          .setRequired(true)
      )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export const category = CommandCategory.Moderation;
export const cooldown = 3;
export const permissions = [PermissionFlagsBits.ModerateMembers];

export async function execute(interaction: ChatInputCommandInteraction): Promise<any> {
  const db = getDatabase();
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const confirm = interaction.options.getBoolean('confirm', true);

  // Ensure users and guild exist in database
  await ensureUserAndGuildExist(user, interaction.guild!);
  await ensureUserAndGuildExist(interaction.user, interaction.guild!);

  if (!confirm) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.resetxp.notConfirmed'),
    });
  }

  // Check if user is trying to reset their own XP
  if (user.id === interaction.user.id) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.resetxp.cannotResetSelf'),
    });
  }

  try {
    // Reset user's XP
    await db
      .update(userXp)
      .set({
        xp: 0,
        level: 0,
        lastXpGain: new Date(),
      })
      .where(and(eq(userXp.userId, user.id), eq(userXp.guildId, interaction.guild!.id)));

    // Log the action
    await auditLogger.logAction({
      action: 'XP_RESET',
      userId: interaction.user.id,
      guildId: interaction.guild!.id,
      targetId: user.id,
      details: {},
    });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(t('commands.moderation.subcommands.resetxp.success.title'))
      .setDescription(
        t('commands.moderation.subcommands.resetxp.success.description', {
          user: user.tag,
          moderator: interaction.user.tag,
        })
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error resetting XP:', error);
    await interaction.editReply({
      content: t('commands.moderation.subcommands.resetxp.error'),
    });
  }
}



function formatDuration(minutes: number): string {
  const minStr = t('common.duration.minutes', {
    count: minutes,
    defaultValue: `${minutes} minute${minutes !== 1 ? 's' : ''}`,
  });
  if (minutes < 60) {
    return minStr;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const hrStr = t('common.duration.hours', {
    count: hours,
    defaultValue: `${hours} hour${hours !== 1 ? 's' : ''}`,
  });

  if (hours < 24) {
    if (remainingMinutes === 0) {
      return hrStr;
    }
    const remMinStr = t('common.duration.minutes', {
      count: remainingMinutes,
      defaultValue: `${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`,
    });
    return `${hrStr} ${remMinStr}`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const dayStr = t('common.duration.days', {
    count: days,
    defaultValue: `${days} day${days !== 1 ? 's' : ''}`,
  });

  if (remainingHours === 0) {
    return dayStr;
  }
  const remHrStr = t('common.duration.hours', {
    count: remainingHours,
    defaultValue: `${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`,
  });
  return `${dayStr} ${remHrStr}`;
}

type ModerationTextChannel = TextChannel | NewsChannel;

function resolveModerationChannel(
  interaction: ChatInputCommandInteraction,
  channel?: GuildBasedChannel | null
): ModerationTextChannel | null {
  if (channel && isModerationTextChannel(channel)) {
    return channel;
  }

  const currentChannel = interaction.channel as GuildBasedChannel | null;
  if (currentChannel && isModerationTextChannel(currentChannel)) {
    return currentChannel;
  }

  return null;
}

function isModerationTextChannel(
  channel: GuildBasedChannel | null
): channel is ModerationTextChannel {
  if (!channel) {
    return false;
  }

  return channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement;
}

async function getOrCreateMuteRole(guild: Guild): Promise<Role> {
  let muteRole = guild.roles.cache.find(role => role.name.toLowerCase() === 'muted') ?? null;

  if (!muteRole) {
    muteRole = await guild.roles.create({
      name: 'Muted',
      color: 0x808080,
      permissions: [],
      reason: 'Mute role required for moderation commands',
    });

    for (const channel of guild.channels.cache.values()) {
      if (!('permissionOverwrites' in channel)) {
        continue;
      }

      try {
        await channel.permissionOverwrites.edit(muteRole, {
          SendMessages: false,
          AddReactions: false,
          Speak: false,
          Connect: false,
        });
      } catch (error) {
        logger.debug(`Failed to set mute role permissions in channel ${channel.id}`, error);
      }
    }
  }

  return muteRole;
}

async function recordModCase(
  interaction: ChatInputCommandInteraction,
  userId: string,
  type: string,
  reason?: string,
  durationMs?: number,
  expiresAt?: Date | null
) {
  try {
    return await modCaseRepository.create({
      guildId: interaction.guild!.id,
      userId,
      moderatorId: interaction.user.id,
      type,
      reason,
      duration: durationMs ?? null,
      expiresAt: expiresAt ?? null,
    });
  } catch (error) {
    logger.error('Failed to record moderation case:', error);
    return null;
  }
}

