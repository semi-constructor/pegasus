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
import { getDatabase } from '../../database/connection';
import { userXp } from '../../database/schema/xp';
import { eq, and } from 'drizzle-orm';
import { ensureUserAndGuildExist } from '../../utils/userUtils';
import { logger } from '../../utils/logger';
import { modCaseRepository } from '../../repositories/modCaseRepository';
import { moderationScheduler } from '../../services/moderationScheduler';


export const data = new SlashCommandBuilder()
  .setName('modlog')
      .setDescription(t('commands.moderation.subcommands.modlog.description'))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.moderation.subcommands.modlog.options.user'))
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName('limit')
          .setDescription(t('commands.moderation.subcommands.modlog.options.limit'))
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(25)
      )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export const category = CommandCategory.Moderation;
export const cooldown = 3;
export const permissions = [PermissionFlagsBits.ModerateMembers];

export async function execute(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply({ ephemeral: true });

  const targetUser = interaction.options.getUser('user');
  const limit = interaction.options.getInteger('limit') ?? 10;

  const cases = targetUser
    ? await modCaseRepository.getByUserOrModerator(interaction.guild!.id, targetUser.id, limit)
    : await modCaseRepository.getRecent(interaction.guild!.id, limit);

  let auditEntries: any[] = [];
  try {
    const auditLogs = await interaction.guild!.fetchAuditLogs({
      limit: targetUser ? 100 : limit,
    });

    const entries = Array.from(auditLogs.entries.values());
    if (targetUser) {
      auditEntries = entries
        .filter(entry => entry.executorId === targetUser.id || entry.targetId === targetUser.id)
        .slice(0, limit);
    } else {
      auditEntries = entries.slice(0, limit);
    }
  } catch (error) {
    logger.warn('Failed to fetch audit logs for modlog command:', error);
  }

  if (cases.length === 0 && auditEntries.length === 0) {
    return interaction.editReply({
      content: targetUser
        ? t('commands.moderation.subcommands.modlog.noUserCases', { user: targetUser.tag })
        : t('commands.moderation.subcommands.modlog.noCases'),
    });
  }

  const botEmbed = new EmbedBuilder()
    .setColor(0x95a5a6)
    .setTitle(
      targetUser
        ? t('commands.moderation.subcommands.modlog.titleUser', { user: targetUser.tag })
        : t('commands.moderation.subcommands.modlog.titleRecent', {
            guild: interaction.guild!.name,
          })
    )
    .setDescription(
      cases.length > 0
        ? cases
            .map(record => {
              const timestamp = Math.floor(new Date(record.createdAt).getTime() / 1000);
              return t('commands.moderation.subcommands.modlog.entry', {
                id: record.id,
                type: record.type.toUpperCase(),
                user: `<@${record.userId}>`,
                moderator: `<@${record.moderatorId}>`,
                reason: record.reason || t('common.noReasonProvided'),
                time: `<t:${timestamp}:R>`,
              });
            })
            .join('\n')
        : t('commands.moderation.subcommands.modlog.noBotActions')
    )
    .setFooter({
      text: t('commands.moderation.subcommands.modlog.footer', { count: cases.length }),
    })
    .setTimestamp();

  const auditEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(
      targetUser
        ? t('commands.moderation.subcommands.modlog.titleAuditUser', { user: targetUser.tag })
        : t('commands.moderation.subcommands.modlog.titleAuditRecent', {
            guild: interaction.guild!.name,
          })
    )
    .setDescription(
      auditEntries.length > 0
        ? auditEntries
            .map(entry => {
              const timestamp = Math.floor(entry.createdTimestamp / 1000);
              const actionName =
                AuditLogEvent[entry.action as AuditLogEvent] ?? `Action (${entry.action})`;
              const executor = entry.executorId ? `<@${entry.executorId}>` : t('common.unknown');

              let targetStr = t('common.unknown');
              if (entry.target) {
                if ('tag' in entry.target) {
                  targetStr = entry.target.tag;
                } else if ('user' in entry.target && entry.target.user) {
                  targetStr = entry.target.user.tag;
                } else if ('name' in entry.target) {
                  targetStr = `${entry.target.name} (ID: ${entry.targetId})`;
                } else if (entry.targetId) {
                  targetStr = `ID: ${entry.targetId}`;
                }
              } else if (entry.targetId) {
                targetStr = `ID: ${entry.targetId}`;
              }

              return t('commands.moderation.subcommands.modlog.auditEntry', {
                action: actionName,
                target: targetStr,
                executor,
                reason: entry.reason || t('common.noReasonProvided'),
                time: `<t:${timestamp}:R>`,
              });
            })
            .join('\n')
        : t('commands.moderation.subcommands.modlog.noAuditActions')
    )
    .setFooter({
      text: t('commands.moderation.subcommands.modlog.footer', { count: auditEntries.length }),
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [botEmbed, auditEmbed] });
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



