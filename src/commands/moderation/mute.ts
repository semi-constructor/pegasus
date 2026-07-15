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
  .setName('mute')
      .setDescription(t('commands.moderation.subcommands.mute.description'))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.moderation.subcommands.mute.options.user'))
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('duration')
          .setDescription(t('commands.moderation.subcommands.mute.options.duration'))
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(10080)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription(t('commands.moderation.subcommands.mute.options.reason'))
          .setRequired(false)
          .setMaxLength(500)
      )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export const category = CommandCategory.Moderation;
export const cooldown = 3;
export const permissions = [PermissionFlagsBits.ModerateMembers];

export async function execute(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply({ ephemeral: true });

  const user = interaction.options.getUser('user', true);
  const durationMinutes = interaction.options.getInteger('duration') ?? null;
  const reason = interaction.options.getString('reason') || t('common.noReasonProvided');

  await ensureUserAndGuildExist(user, interaction.guild!);
  await ensureUserAndGuildExist(interaction.user, interaction.guild!);

  const member = await interaction.guild!.members.fetch(user.id).catch(() => null);

  if (!member) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.mute.memberNotFound'),
    });
  }

  if (user.id === interaction.user.id) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.mute.cannotMuteSelf'),
    });
  }

  if (user.id === interaction.client.user.id) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.mute.cannotMuteBot'),
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

  if (member.roles.highest.position >= executor.roles.highest.position) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.mute.higherRole'),
    });
  }

  if (member.roles.highest.position >= botMember.roles.highest.position) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.mute.botHierarchy'),
    });
  }

  try {
    const muteRole = await getOrCreateMuteRole(interaction.guild!);

    if (member.roles.cache.has(muteRole.id)) {
      return interaction.editReply({
        content: t('commands.moderation.subcommands.mute.alreadyMuted'),
      });
    }

    await member.roles.add(muteRole, `${reason} | Muted by ${interaction.user.tag}`);

    const durationMs = durationMinutes ? durationMinutes * 60 * 1000 : null;
    const expiresAt = durationMs ? new Date(Date.now() + durationMs) : null;

    const record = await recordModCase(interaction, user.id, 'mute', reason, durationMs ?? undefined, expiresAt);

    if (durationMs && record) {
      await moderationScheduler.scheduleTempAction({
        caseId: record.id,
        guildId: interaction.guild!.id,
        userId: user.id,
        expiresAt: expiresAt!,
        type: 'mute'
      });
    }

    await auditLogger.logAction({
      action: 'MEMBER_MUTE',
      userId: interaction.user.id,
      guildId: interaction.guild!.id,
      targetId: user.id,
      details: {
        duration: durationMinutes,
        reason,
      },
    });

    try {
      await user.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x808080)
            .setTitle(t('commands.moderation.subcommands.mute.dmTitle'))
            .setDescription(
              t('commands.moderation.subcommands.mute.dmDescription', {
                guild: interaction.guild!.name,
                reason,
                duration: durationMinutes ? formatDuration(durationMinutes) : t('common.none'),
              })
            )
            .setTimestamp(),
        ],
      });
    } catch {
      // User may have DMs disabled
    }

    const embed = new EmbedBuilder()
      .setColor(0x808080)
      .setTitle(t('commands.moderation.subcommands.mute.success.title'))
      .setDescription(
        t('commands.moderation.subcommands.mute.success.description', {
          user: user.tag,
          moderator: interaction.user.tag,
        })
      )
      .addFields(
        {
          name: t('commands.moderation.subcommands.mute.success.reason'),
          value: reason,
          inline: false,
        },
        {
          name: t('commands.moderation.subcommands.mute.success.duration'),
          value: durationMinutes ? formatDuration(durationMinutes) : t('common.none'),
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error muting member:', error);
    await interaction.editReply({
      content: t('commands.moderation.subcommands.mute.error'),
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

