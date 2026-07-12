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
  .setName('purge')
      .setDescription(t('commands.moderation.subcommands.purge.description'))
      .addIntegerOption(option =>
        option
          .setName('amount')
          .setDescription(t('commands.moderation.subcommands.purge.options.amount'))
          .setRequired(true)
          .setMinValue(2)
          .setMaxValue(100)
      )
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.moderation.subcommands.purge.options.user'))
          .setRequired(false)
      )
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription(t('commands.moderation.subcommands.purge.options.channel'))
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export const category = CommandCategory.Moderation;
export const cooldown = 3;
export const permissions = [PermissionFlagsBits.ManageMessages];

export async function execute(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply({ ephemeral: true });

  const amount = interaction.options.getInteger('amount', true);
  const targetUser = interaction.options.getUser('user');
  const selectedChannel = interaction.options.getChannel('channel') as GuildBasedChannel | null;
  const channel = resolveModerationChannel(interaction, selectedChannel);

  if (!channel) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.purge.invalidChannel'),
    });
  }

  const executor = interaction.member as GuildMember;
  const botMember = interaction.guild!.members.me!;

  if (!executor.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return interaction.editReply({
      content: t('commands.moderation.errors.missingManageMessages'),
    });
  }

  if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return interaction.editReply({
      content: t('commands.moderation.errors.botMissingManageMessages'),
    });
  }

  try {
    let deletedCount = 0;

    if (targetUser) {
      const fetched = await channel.messages.fetch({ limit: 100 });
      const filtered = new Collection<Snowflake, Message>();
      for (const msg of fetched.values()) {
        if (msg.author.id === targetUser.id) {
          filtered.set(msg.id, msg);
        }
        if (filtered.size === amount) {
          break;
        }
      }

      if (filtered.size === 0) {
        return interaction.editReply({
          content: t('commands.moderation.subcommands.purge.noMessages', { user: targetUser.tag }),
        });
      }

      await channel.bulkDelete(filtered, true);
      deletedCount = filtered.size;
    } else {
      const deleted = await channel.bulkDelete(amount, true);
      deletedCount = deleted.size;
    }

    await auditLogger.logAction({
      action: 'CHANNEL_PURGE',
      userId: interaction.user.id,
      guildId: interaction.guild!.id,
      targetId: channel.id,
      details: {
        amount: deletedCount,
        user: targetUser?.id,
      },
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(t('commands.moderation.subcommands.purge.success.title'))
      .setDescription(
        t('commands.moderation.subcommands.purge.success.description', {
          amount: deletedCount,
          channel: channel.toString(),
          moderator: interaction.user.tag,
        })
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error purging messages:', error);
    await interaction.editReply({
      content: t('commands.moderation.subcommands.purge.error'),
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

