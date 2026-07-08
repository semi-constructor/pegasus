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
  .setName('moderation')
  .setDescription(t('commands.moderation.description', { defaultValue: 'Moderation commands' }))
  .setNameLocalizations(createLocalizationMap(commandNames.moderation))
  .setDescriptionLocalizations(createLocalizationMap(commandDescriptions.moderation))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand(subcommand =>
    subcommand
      .setName('ban')
      .setDescription(t('commands.moderation.subcommands.ban.description'))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.moderation.subcommands.ban.options.user'))
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription(t('commands.moderation.subcommands.ban.options.reason'))
          .setRequired(false)
          .setMaxLength(500)
      )
      .addIntegerOption(option =>
        option
          .setName('delete_days')
          .setDescription(t('commands.moderation.subcommands.ban.options.deleteDays'))
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(7)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('kick')
      .setDescription(t('commands.moderation.subcommands.kick.description'))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.moderation.subcommands.kick.options.user'))
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription(t('commands.moderation.subcommands.kick.options.reason'))
          .setRequired(false)
          .setMaxLength(500)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('timeout')
      .setDescription(t('commands.moderation.subcommands.timeout.description'))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.moderation.subcommands.timeout.options.user'))
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('duration')
          .setDescription(t('commands.moderation.subcommands.timeout.options.duration'))
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(40320) // 28 days in minutes
          .addChoices(
            {
              name: '60 seconds',
              value: 1,
              name_localizations: { de: '60 Sekunden', 'es-ES': '60 segundos', fr: '60 secondes' },
            },
            {
              name: '5 minutes',
              value: 5,
              name_localizations: { de: '5 Minuten', 'es-ES': '5 minutos', fr: '5 minutes' },
            },
            {
              name: '10 minutes',
              value: 10,
              name_localizations: { de: '10 Minuten', 'es-ES': '10 minutos', fr: '10 minutes' },
            },
            {
              name: '30 minutes',
              value: 30,
              name_localizations: { de: '30 Minuten', 'es-ES': '30 minutos', fr: '30 minutes' },
            },
            {
              name: '1 hour',
              value: 60,
              name_localizations: { de: '1 Stunde', 'es-ES': '1 hora', fr: '1 heure' },
            },
            {
              name: '6 hours',
              value: 360,
              name_localizations: { de: '6 Stunden', 'es-ES': '6 horas', fr: '6 heures' },
            },
            {
              name: '12 hours',
              value: 720,
              name_localizations: { de: '12 Stunden', 'es-ES': '12 horas', fr: '12  heures' },
            },
            {
              name: '1 day',
              value: 1440,
              name_localizations: { de: '1 Tag', 'es-ES': '1 día', fr: '1 jour' },
            },
            {
              name: '3 days',
              value: 4320,
              name_localizations: { de: '3 Tage', 'es-ES': '3 días', fr: '3 jours' },
            },
            {
              name: '1 week',
              value: 10080,
              name_localizations: { de: '1 Woche', 'es-ES': '1 semana', fr: '1  semaine' },
            },
            {
              name: '2 weeks',
              value: 20160,
              name_localizations: { de: '2 Wochen', 'es-ES': '2 semanas', fr: '2  semaines' },
            },
            {
              name: '4 weeks',
              value: 40320,
              name_localizations: { de: '4 Wochen', 'es-ES': '4 semanas', fr: '4  semaines' },
            }
          )
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription(t('commands.moderation.subcommands.timeout.options.reason'))
          .setRequired(false)
          .setMaxLength(500)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
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
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('unmute')
      .setDescription(t('commands.moderation.subcommands.unmute.description'))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.moderation.subcommands.unmute.options.user'))
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription(t('commands.moderation.subcommands.unmute.options.reason'))
          .setRequired(false)
          .setMaxLength(500)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('unban')
      .setDescription(t('commands.moderation.subcommands.unban.description'))
      .addStringOption(option =>
        option
          .setName('user_id')
          .setDescription(t('commands.moderation.subcommands.unban.options.userId'))
          .setRequired(true)
          .setMinLength(17)
          .setMaxLength(20)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription(t('commands.moderation.subcommands.unban.options.reason'))
          .setRequired(false)
          .setMaxLength(500)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
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
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('lock')
      .setDescription(t('commands.moderation.subcommands.lock.description'))
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription(t('commands.moderation.subcommands.lock.options.channel'))
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription(t('commands.moderation.subcommands.lock.options.reason'))
          .setRequired(false)
          .setMaxLength(500)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
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
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('slowmode')
      .setDescription(t('commands.moderation.subcommands.slowmode.description'))
      .addIntegerOption(option =>
        option
          .setName('duration')
          .setDescription(t('commands.moderation.subcommands.slowmode.options.duration'))
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(21600)
      )
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription(t('commands.moderation.subcommands.slowmode.options.channel'))
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription(t('commands.moderation.subcommands.slowmode.options.reason'))
          .setRequired(false)
          .setMaxLength(500)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
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
  )
  .addSubcommandGroup(group =>
    group
      .setName('case')
      .setDescription(t('commands.moderation.subcommands.case.description'))
      .addSubcommand(subcommand =>
        subcommand
          .setName('view')
          .setDescription(t('commands.moderation.subcommands.case.view.description'))
          .addIntegerOption(option =>
            option
              .setName('id')
              .setDescription(t('commands.moderation.subcommands.case.view.options.id'))
              .setRequired(true)
              .setMinValue(1)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('delete')
          .setDescription(t('commands.moderation.subcommands.case.delete.description'))
          .addIntegerOption(option =>
            option
              .setName('id')
              .setDescription(t('commands.moderation.subcommands.case.delete.options.id'))
              .setRequired(true)
              .setMinValue(1)
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
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
  );

export const category = CommandCategory.Moderation;
export const cooldown = 3;
export const permissions = [PermissionFlagsBits.ModerateMembers];

export async function execute(interaction: ChatInputCommandInteraction): Promise<any> {
  if (!interaction.guild) {
    return interaction.reply({
      content: t('common.guildOnly'),
      ephemeral: true,
    });
  }

  const subcommandGroup = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();

  if (subcommandGroup === 'case') {
    switch (subcommand) {
      case 'view':
        return handleCaseView(interaction);
      case 'delete':
        return handleCaseDelete(interaction);
      default:
        return interaction.reply({
          content: t('common.unknownSubcommand'),
          ephemeral: true,
        });
    }
  }

  switch (subcommand) {
    case 'ban':
      return handleBan(interaction);
    case 'kick':
      return handleKick(interaction);
    case 'timeout':
      return handleTimeout(interaction);
    case 'mute':
      return handleMute(interaction);
    case 'unmute':
      return handleUnmute(interaction);
    case 'unban':
      return handleUnban(interaction);
    case 'purge':
      return handlePurge(interaction);
    case 'lock':
      return handleLock(interaction);
    case 'unlock':
      return handleUnlock(interaction);
    case 'slowmode':
      return handleSlowmode(interaction);
    case 'modlog':
      return handleModlog(interaction);
    case 'reset-xp':
      return handleResetXP(interaction);
    default:
      return interaction.reply({
        content: t('common.unknownSubcommand'),
        ephemeral: true,
      });
  }
}

async function handleBan(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || t('common.noReasonProvided');
  const deleteDays = interaction.options.getInteger('delete_days') || 0;

  // Ensure users and guild exist in database
  await ensureUserAndGuildExist(user, interaction.guild!);
  await ensureUserAndGuildExist(interaction.user, interaction.guild!);

  // Get member
  const member = await interaction.guild!.members.fetch(user.id).catch(() => null);

  if (!member) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.ban.memberNotFound'),
    });
  }

  // Check if user is trying to ban themselves
  if (user.id === interaction.user.id) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.ban.cannotBanSelf'),
    });
  }

  // Check if user is trying to ban the bot
  if (user.id === interaction.client.user!.id) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.ban.cannotBanBot'),
    });
  }

  // Check permissions and hierarchy
  const executorMember = interaction.member as GuildMember;
  const botMember = interaction.guild!.members.me!;

  if (!member.bannable) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.ban.cannotBan'),
    });
  }

  if (member.roles.highest.position >= executorMember.roles.highest.position) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.ban.higherRole'),
    });
  }

  if (member.roles.highest.position >= botMember.roles.highest.position) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.ban.botHierarchy'),
    });
  }

  try {
    // Try to DM the user before banning
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(t('commands.moderation.subcommands.ban.dmTitle'))
        .setDescription(
          t('commands.moderation.subcommands.ban.dmDescription', {
            guild: interaction.guild!.name,
            reason: reason,
          })
        )
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
    } catch (error) {
      // User has DMs disabled
    }

    // Ban the user
    await member.ban({
      reason: `${reason} | Banned by ${interaction.user.tag}`,
      deleteMessageSeconds: deleteDays * 24 * 60 * 60,
    });

    await recordModCase(interaction, user.id, 'ban', reason);

    // Log the action
    await auditLogger.logAction({
      action: 'MEMBER_BAN',
      userId: interaction.user.id,
      guildId: interaction.guild!.id,
      targetId: user.id,
      details: {
        reason,
        deleteDays,
      },
    });

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(t('commands.moderation.subcommands.ban.success.title'))
      .setDescription(
        t('commands.moderation.subcommands.ban.success.description', {
          user: user.tag,
          moderator: interaction.user.tag,
        })
      )
      .addFields({
        name: t('commands.moderation.subcommands.ban.success.reason'),
        value: reason,
        inline: false,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error banning member:', error);
    await interaction.editReply({
      content: t('commands.moderation.subcommands.ban.error'),
    });
  }
}

async function handleKick(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || t('common.noReasonProvided');

  // Ensure users and guild exist in database
  await ensureUserAndGuildExist(user, interaction.guild!);
  await ensureUserAndGuildExist(interaction.user, interaction.guild!);

  // Get member
  const member = await interaction.guild!.members.fetch(user.id).catch(() => null);

  if (!member) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.kick.memberNotFound'),
    });
  }

  // Check if user is trying to kick themselves
  if (user.id === interaction.user.id) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.kick.cannotKickSelf'),
    });
  }

  // Check if user is trying to kick the bot
  if (user.id === interaction.client.user!.id) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.kick.cannotKickBot'),
    });
  }

  // Check permissions and hierarchy
  const executorMember = interaction.member as GuildMember;
  const botMember = interaction.guild!.members.me!;

  if (!member.kickable) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.kick.cannotKick'),
    });
  }

  if (member.roles.highest.position >= executorMember.roles.highest.position) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.kick.higherRole'),
    });
  }

  if (member.roles.highest.position >= botMember.roles.highest.position) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.kick.botHierarchy'),
    });
  }

  try {
    // Try to DM the user before kicking
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle(t('commands.moderation.subcommands.kick.dmTitle'))
        .setDescription(
          t('commands.moderation.subcommands.kick.dmDescription', {
            guild: interaction.guild!.name,
            reason: reason,
          })
        )
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
    } catch (error) {
      // User has DMs disabled
    }

    // Kick the user
    await member.kick(`${reason} | Kicked by ${interaction.user.tag}`);

    await recordModCase(interaction, user.id, 'kick', reason);

    // Log the action
    await auditLogger.logAction({
      action: 'MEMBER_KICK',
      userId: interaction.user.id,
      guildId: interaction.guild!.id,
      targetId: user.id,
      details: {
        reason,
      },
    });

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle(t('commands.moderation.subcommands.kick.success.title'))
      .setDescription(
        t('commands.moderation.subcommands.kick.success.description', {
          user: user.tag,
          moderator: interaction.user.tag,
        })
      )
      .addFields({
        name: t('commands.moderation.subcommands.kick.success.reason'),
        value: reason,
        inline: false,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error kicking member:', error);
    await interaction.editReply({
      content: t('commands.moderation.subcommands.kick.error'),
    });
  }
}

async function handleTimeout(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const duration = interaction.options.getInteger('duration', true);
  const reason = interaction.options.getString('reason') || t('common.noReasonProvided');

  // Ensure users and guild exist in database
  await ensureUserAndGuildExist(user, interaction.guild!);
  await ensureUserAndGuildExist(interaction.user, interaction.guild!);

  // Get member
  const member = await interaction.guild!.members.fetch(user.id).catch(() => null);

  if (!member) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.timeout.memberNotFound'),
    });
  }

  // Check if user is trying to timeout themselves
  if (user.id === interaction.user.id) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.timeout.cannotTimeoutSelf'),
    });
  }

  // Check if user is trying to timeout the bot
  if (user.id === interaction.client.user!.id) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.timeout.cannotTimeoutBot'),
    });
  }

  // Check permissions and hierarchy
  const executorMember = interaction.member as GuildMember;
  const botMember = interaction.guild!.members.me!;

  if (!member.moderatable) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.timeout.cannotTimeout'),
    });
  }

  if (member.roles.highest.position >= executorMember.roles.highest.position) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.timeout.higherRole'),
    });
  }

  if (member.roles.highest.position >= botMember.roles.highest.position) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.timeout.botHierarchy'),
    });
  }

  try {
    // Calculate timeout duration in milliseconds
    const timeoutDuration = duration * 60 * 1000;

    // Timeout the user
    await member.timeout(timeoutDuration, `${reason} | Timed out by ${interaction.user.tag}`);

    await recordModCase(
      interaction,
      user.id,
      'timeout',
      reason,
      timeoutDuration,
      new Date(Date.now() + timeoutDuration)
    );

    // Try to DM the user
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle(t('commands.moderation.subcommands.timeout.dmTitle'))
        .setDescription(
          t('commands.moderation.subcommands.timeout.dmDescription', {
            guild: interaction.guild!.name,
            duration: formatDuration(duration),
            reason: reason,
          })
        )
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
    } catch (error) {
      // User has DMs disabled
    }

    // Log the action
    await auditLogger.logAction({
      action: 'MEMBER_TIMEOUT',
      userId: interaction.user.id,
      guildId: interaction.guild!.id,
      targetId: user.id,
      details: {
        duration,
        reason,
      },
    });

    const embed = new EmbedBuilder()
      .setColor(0x808080)
      .setTitle(t('commands.moderation.subcommands.timeout.success.title'))
      .setDescription(
        t('commands.moderation.subcommands.timeout.success.description', {
          user: user.tag,
          duration: formatDuration(duration),
          moderator: interaction.user.tag,
        })
      )
      .addFields({
        name: t('commands.moderation.subcommands.timeout.success.reason'),
        value: reason,
        inline: false,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error timing out member:', error);
    await interaction.editReply({
      content: t('commands.moderation.subcommands.timeout.error'),
    });
  }
}

async function handleMute(interaction: ChatInputCommandInteraction): Promise<any> {
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

  if (user.id === interaction.client.user!.id) {
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

async function handleUnmute(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply({ ephemeral: true });

  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || t('common.noReasonProvided');

  await ensureUserAndGuildExist(user, interaction.guild!);
  await ensureUserAndGuildExist(interaction.user, interaction.guild!);

  const member = await interaction.guild!.members.fetch(user.id).catch(() => null);

  if (!member) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.unmute.memberNotFound'),
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
    const muteRole = await getOrCreateMuteRole(interaction.guild!);

    if (!member.roles.cache.has(muteRole.id)) {
      return interaction.editReply({
        content: t('commands.moderation.subcommands.unmute.notMuted'),
      });
    }

    await member.roles.remove(muteRole, `${reason} | Unmuted by ${interaction.user.tag}`);

    await recordModCase(interaction, user.id, 'unmute', reason);

    await auditLogger.logAction({
      action: 'MEMBER_UNMUTE',
      userId: interaction.user.id,
      guildId: interaction.guild!.id,
      targetId: user.id,
      details: { reason },
    });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(t('commands.moderation.subcommands.unmute.success.title'))
      .setDescription(
        t('commands.moderation.subcommands.unmute.success.description', {
          user: user.tag,
          moderator: interaction.user.tag,
        })
      )
      .addFields({
        name: t('commands.moderation.subcommands.unmute.success.reason'),
        value: reason,
        inline: false,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error unmuting member:', error);
    await interaction.editReply({
      content: t('commands.moderation.subcommands.unmute.error'),
    });
  }
}

async function handleUnban(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply({ ephemeral: true });

  const userIdInput = interaction.options.getString('user_id', true);
  const reason = interaction.options.getString('reason') || t('common.noReasonProvided');
  const userId = userIdInput.replace(/[^\d]/g, '');

  if (userId.length < 17) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.unban.invalidUserId'),
    });
  }

  const executor = interaction.member as GuildMember;
  const botMember = interaction.guild!.members.me!;

  if (!executor.permissions.has(PermissionFlagsBits.BanMembers)) {
    return interaction.editReply({
      content: t('commands.moderation.errors.missingBanMembers'),
    });
  }

  if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
    return interaction.editReply({
      content: t('commands.moderation.errors.botMissingBanMembers'),
    });
  }

  try {
    const banInfo = await interaction.guild!.bans.fetch(userId).catch(() => null);

    if (!banInfo) {
      return interaction.editReply({
        content: t('commands.moderation.subcommands.unban.notBanned'),
      });
    }

    await interaction.guild!.members.unban(
      userId,
      `${reason} | Unbanned by ${interaction.user.tag}`
    );

    const user = banInfo.user;
    await ensureUserAndGuildExist(user, interaction.guild!);
    await recordModCase(interaction, user.id, 'unban', reason);

    await auditLogger.logAction({
      action: 'MEMBER_UNBAN',
      userId: interaction.user.id,
      guildId: interaction.guild!.id,
      targetId: user.id,
      details: { reason },
    });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(t('commands.moderation.subcommands.unban.success.title'))
      .setDescription(
        t('commands.moderation.subcommands.unban.success.description', {
          user: user.tag,
          moderator: interaction.user.tag,
        })
      )
      .addFields({
        name: t('commands.moderation.subcommands.unban.success.reason'),
        value: reason,
        inline: false,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error unbanning member:', error);
    await interaction.editReply({
      content: t('commands.moderation.subcommands.unban.error'),
    });
  }
}

async function handlePurge(interaction: ChatInputCommandInteraction): Promise<any> {
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

async function handleLock(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply({ ephemeral: true });

  const selectedChannel = interaction.options.getChannel('channel') as GuildBasedChannel | null;
  const channel = resolveModerationChannel(interaction, selectedChannel);
  const reason = interaction.options.getString('reason') || t('common.noReasonProvided');

  if (!channel) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.lock.invalidChannel'),
    });
  }

  const executor = interaction.member as GuildMember;
  const botMember = interaction.guild!.members.me!;

  if (!executor.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.editReply({
      content: t('commands.moderation.errors.missingManageChannels'),
    });
  }

  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.editReply({
      content: t('commands.moderation.errors.botMissingManageChannels'),
    });
  }

  try {
    const everyoneRole = interaction.guild!.roles.everyone;
    const overwrite = channel.permissionOverwrites.cache.get(everyoneRole.id);

    if (overwrite?.deny.has(PermissionFlagsBits.SendMessages)) {
      return interaction.editReply({
        content: t('commands.moderation.subcommands.lock.alreadyLocked'),
      });
    }

    await channel.permissionOverwrites.edit(everyoneRole, {
      SendMessages: false,
      AddReactions: false,
    });

    await auditLogger.logAction({
      action: 'CHANNEL_LOCK',
      userId: interaction.user.id,
      guildId: interaction.guild!.id,
      targetId: channel.id,
      details: { reason },
    });

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(t('commands.moderation.subcommands.lock.success.title'))
      .setDescription(
        t('commands.moderation.subcommands.lock.success.description', {
          channel: channel.toString(),
          moderator: interaction.user.tag,
        })
      )
      .addFields({
        name: t('commands.moderation.subcommands.lock.success.reason'),
        value: reason,
        inline: false,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error locking channel:', error);
    await interaction.editReply({
      content: t('commands.moderation.subcommands.lock.error'),
    });
  }
}

async function handleUnlock(interaction: ChatInputCommandInteraction): Promise<any> {
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

  if (!executor.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.editReply({
      content: t('commands.moderation.errors.missingManageChannels'),
    });
  }

  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.editReply({
      content: t('commands.moderation.errors.botMissingManageChannels'),
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

async function handleSlowmode(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply({ ephemeral: true });

  const duration = interaction.options.getInteger('duration', true);
  const selectedChannel = interaction.options.getChannel('channel') as GuildBasedChannel | null;
  const channel = resolveModerationChannel(interaction, selectedChannel);
  const reason = interaction.options.getString('reason') || t('common.noReasonProvided');

  if (!channel) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.slowmode.invalidChannel'),
    });
  }

  const executor = interaction.member as GuildMember;
  const botMember = interaction.guild!.members.me!;

  if (!executor.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.editReply({
      content: t('commands.moderation.errors.missingManageChannels'),
    });
  }

  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.editReply({
      content: t('commands.moderation.errors.botMissingManageChannels'),
    });
  }

  try {
    await channel.setRateLimitPerUser(duration, reason);

    await auditLogger.logAction({
      action: 'CHANNEL_SLOWMODE',
      userId: interaction.user.id,
      guildId: interaction.guild!.id,
      targetId: channel.id,
      details: { duration, reason },
    });

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(t('commands.moderation.subcommands.slowmode.success.title'))
      .setDescription(
        t('commands.moderation.subcommands.slowmode.success.description', {
          channel: channel.toString(),
          duration: duration
            ? t('commands.moderation.subcommands.slowmode.success.durationValue', {
                seconds: duration,
              })
            : t('commands.moderation.subcommands.slowmode.success.disabled'),
          moderator: interaction.user.tag,
        })
      )
      .addFields({
        name: t('commands.moderation.subcommands.slowmode.success.reason'),
        value: reason,
        inline: false,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error updating slowmode:', error);
    await interaction.editReply({
      content: t('commands.moderation.subcommands.slowmode.error'),
    });
  }
}

async function handleModlog(interaction: ChatInputCommandInteraction): Promise<any> {
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
                executor: executor,
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

async function handleCaseView(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply({ ephemeral: true });

  const caseId = interaction.options.getInteger('id', true);
  const record = await modCaseRepository.getById(interaction.guild!.id, caseId);

  if (!record) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.case.view.notFound', { id: caseId }),
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle(t('commands.moderation.subcommands.case.view.title', { id: record.id }))
    .addFields(
      {
        name: t('commands.moderation.subcommands.case.view.fields.user'),
        value: `<@${record.userId}>`,
        inline: true,
      },
      {
        name: t('commands.moderation.subcommands.case.view.fields.moderator'),
        value: `<@${record.moderatorId}>`,
        inline: true,
      },
      {
        name: t('commands.moderation.subcommands.case.view.fields.action'),
        value: record.type.toUpperCase(),
        inline: false,
      },
      {
        name: t('commands.moderation.subcommands.case.view.fields.reason'),
        value: record.reason || t('common.noReasonProvided'),
        inline: false,
      }
    )
    .setTimestamp(record.createdAt ?? new Date());

  if (record.duration) {
    embed.addFields({
      name: t('commands.moderation.subcommands.case.view.fields.duration'),
      value: formatDuration(Math.round(record.duration / 60000)),
      inline: true,
    });
  }

  if (record.expiresAt) {
    embed.addFields({
      name: t('commands.moderation.subcommands.case.view.fields.expires'),
      value: `<t:${Math.floor(new Date(record.expiresAt).getTime() / 1000)}:f>`,
      inline: true,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleCaseDelete(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply({ ephemeral: true });

  const executor = interaction.member as GuildMember;
  if (!executor.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.editReply({
      content: t('commands.moderation.errors.missingManageGuild'),
    });
  }

  const caseId = interaction.options.getInteger('id', true);
  const record = await modCaseRepository.getById(interaction.guild!.id, caseId);

  if (!record) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.case.delete.notFound', { id: caseId }),
    });
  }

  const success = await modCaseRepository.delete(interaction.guild!.id, caseId);

  if (!success) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.case.delete.error'),
    });
  }

  await auditLogger.logAction({
    action: 'MOD_CASE_DELETE',
    userId: interaction.user.id,
    guildId: interaction.guild!.id,
    targetId: record.userId,
    details: { caseId },
  });

  await interaction.editReply({
    content: t('commands.moderation.subcommands.case.delete.success', { id: caseId }),
  });
}

async function handleResetXP(interaction: ChatInputCommandInteraction): Promise<any> {
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
