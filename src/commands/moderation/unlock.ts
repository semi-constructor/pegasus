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
import { auditLogger } from '../../security/audit';

import { userXp } from '../../database/schema/xp';
import { eq, and } from 'drizzle-orm';
import { ensureUserAndGuildExist } from '../../utils/userUtils';
import { logger } from '../../utils/logger';
import { modCaseRepository } from '../../repositories/modCaseRepository';



export const data = new SlashCommandBuilder()
  .setName('unlock')
      .setDescription(t('commands.moderation.subcommands.unlock.description'))
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription(t('commands.moderation.subcommands.unlock.options.channel'))
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription(t('commands.moderation.subcommands.unlock.options.reason'))
          .setRequired(false)
          .setMaxLength(500)
      )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export const category = CommandCategory.Moderation;
export const cooldown = 3;
export const permissions = [PermissionFlagsBits.ManageRoles];

export async function execute(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply({ ephemeral: true });

  const selectedChannel = interaction.options.getChannel('channel') as GuildBasedChannel | null;
  const channel = resolveModerationChannel(interaction, selectedChannel);
  const reason = interaction.options.getString('reason') || t('common.noReasonProvided');

  if (!channel) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.unlock.invalidChannel'),
    });
  }

  const executor = interaction.member as GuildMember;
  const botMember = interaction.guild!.members.me!;

  if (!executor.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.editReply({
      content: t('commands.moderation.errors.missingManageRoles'),
    });
  }

  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.editReply({
      content: t('commands.moderation.errors.botMissingManageRoles'),
    });
  }

  try {
    const everyoneRole = interaction.guild!.roles.everyone;
    const overwrite = channel.permissionOverwrites.cache.get(everyoneRole.id);

    if (!overwrite || !overwrite.deny.has(PermissionFlagsBits.SendMessages)) {
      return interaction.editReply({
        content: t('commands.moderation.subcommands.unlock.notLocked'),
      });
    }

    await channel.permissionOverwrites.edit(everyoneRole, {
      SendMessages: null,
      AddReactions: null,
    });

    await auditLogger.logAction({
      action: 'CHANNEL_UNLOCK',
      userId: interaction.user.id,
      guildId: interaction.guild!.id,
      targetId: channel.id,
      details: { reason },
    });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(t('commands.moderation.subcommands.unlock.success.title'))
      .setDescription(
        t('commands.moderation.subcommands.unlock.success.description', {
          channel: channel.toString(),
          moderator: interaction.user.tag,
        })
      )
      .addFields({
        name: t('commands.moderation.subcommands.unlock.success.reason'),
        value: reason,
        inline: false,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error unlocking channel:', error);
    await interaction.editReply({
      content: t('commands.moderation.subcommands.unlock.error'),
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

