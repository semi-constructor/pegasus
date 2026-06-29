import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalActionRowComponentBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionReplyOptions,
  InteractionDeferReplyOptions,
  ChannelType,
} from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t } from '../../i18n';
import { warningService } from '../../services/warningService';
import type { WarningAction } from '../../services/warningService';
import { warningRepository } from '../../repositories/warningRepository';
import {
  createLocalizationMap,
  commandDescriptions,
  subcommandDescriptions,
  optionDescriptions,
} from '../../utils/localization';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Manage user warnings')
  .setDescriptionLocalizations(createLocalizationMap(commandDescriptions.warn))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Issue a warning to a user')
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.warn.create))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('The user to warn')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.user))
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('title')
          .setDescription('Title of the warning')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.title))
          .setRequired(true)
          .setMaxLength(255)
      )
      .addStringOption(option =>
        option
          .setName('description')
          .setDescription('Description of the warning')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.description))
          .setRequired(false)
          .setMaxLength(1000)
      )
      .addIntegerOption(option =>
        option
          .setName('level')
          .setDescription('Warning level (1-10)')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.level))
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(10)
      )
      .addAttachmentOption(option =>
        option
          .setName('proof')
          .setDescription('Proof attachment')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.proof))
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('edit')
      .setDescription('Edit an existing warning')
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.warn.edit))
      .addStringOption(option =>
        option
          .setName('warnid')
          .setDescription('The warning ID to edit')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.warnid))
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('lookup')
      .setDescription('Look up a specific warning')
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.warn.lookup))
      .addStringOption(option =>
        option
          .setName('warnid')
          .setDescription('The warning ID to look up')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.warnid))
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Delete a warning by ID')
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.warn.delete))
      .addStringOption(option =>
        option
          .setName('warnid')
          .setDescription('The warning ID to delete')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.warnid))
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('View all warnings for a user')
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.warn.view))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('The user to view warnings for')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.user))
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('purge')
      .setDescription('Remove all warnings for a user')
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.warn.purge))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('The user whose warnings will be purged')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.user))
          .setRequired(true)
      )
  )
  .addSubcommandGroup(group =>
    group
      .setName('automation')
      .setDescription('Manage warning automations')
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.warn.automation.group))
      .addSubcommand(subcommand =>
        subcommand
          .setName('create')
          .setDescription('Create a warning automation')
          .setDescriptionLocalizations(
            createLocalizationMap(subcommandDescriptions.warn.automation.create)
          )
          .addStringOption(option =>
            option
              .setName('trigger_type')
              .setDescription('When this automation should trigger')
              .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.triggerType))
              .setRequired(true)
              .addChoices(
                { name: 'Warn Count', value: 'warn_count', name_localizations: { de: 'Warnungsanzahl', 'es-ES': 'Conteo de advertencias', fr: "Nombre d'avertissements" } },
                { name: 'Warn Level', value: 'warn_level', name_localizations: { de: 'Warnungsstufe', 'es-ES': 'Nivel de advertencia', fr: "Niveau d'avertissement" } }
              )
          )
          .addIntegerOption(option =>
            option
              .setName('trigger_value')
              .setDescription('Threshold that triggers the automation')
              .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.triggerValue))
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(100)
          )
          .addChannelOption(option =>
            option
              .setName('notify_channel')
              .setDescription('Channel that receives automation alerts')
              .setDescriptionLocalizations(
                createLocalizationMap(optionDescriptions.notifyChannel)
              )
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(false)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('view')
          .setDescription('View all warning automations')
          .setDescriptionLocalizations(
            createLocalizationMap(subcommandDescriptions.warn.automation.view)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('delete')
          .setDescription('Delete a warning automation')
          .setDescriptionLocalizations(
            createLocalizationMap(subcommandDescriptions.warn.automation.delete)
          )
          .addStringOption(option =>
            option
              .setName('automationid')
              .setDescription('The automation ID to delete')
              .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.automationid))
              .setRequired(true)
          )
      )
  );

export const category = CommandCategory.Moderation;
export const cooldown = 3;
export const permissions = [PermissionFlagsBits.ModerateMembers];
export const preDefer = {
  ephemeral: false,
};

type CommandChannelOption = ReturnType<ChatInputCommandInteraction['options']['getChannel']>;

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await respondEphemeral(interaction, {
      content: t('common.guildOnly'),
    });
    return;
  }

  const subcommandGroup = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  // Handle automation subcommands
  if (subcommandGroup === 'automation') {
    switch (subcommand) {
      case 'create':
        return handleAutomationCreate(interaction);
      case 'view':
        return handleAutomationView(interaction);
      case 'delete':
        return handleAutomationDelete(interaction);
    }
    return;
  }

  // Handle main warn subcommands
  switch (subcommand) {
    case 'create':
      return handleWarnCreate(interaction);
    case 'edit':
      return handleWarnEdit(interaction);
    case 'lookup':
      return handleWarnLookup(interaction);
    case 'delete':
      return handleWarnDelete(interaction);
    case 'view':
      return handleWarnView(interaction);
    case 'purge':
      return handleWarnPurge(interaction);
    default:
      // Show help embed with all available commands
      return handleWarnHelp(interaction);
  }
}

async function handleWarnHelp(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(t('commands.warn.subcommands.help.title', { defaultValue: 'Warning System Commands' }))
    .setDescription(t('commands.warn.subcommands.help.description', { defaultValue: 'Available warning commands:' }))
    .addFields(
      {
        name: '/warn create',
        value: t('commands.warn.subcommands.help.create', { defaultValue: 'Warn a user with title, description, level, and proof' }),
        inline: false,
      },
      {
        name: '/warn edit',
        value: t('commands.warn.subcommands.help.edit', { defaultValue: 'Edit an existing warning' }),
        inline: false,
      },
      {
        name: '/warn lookup',
        value: t('commands.warn.subcommands.help.lookup', { defaultValue: 'Lookup a specific warning by ID' }),
        inline: false,
      },
      {
        name: '/warn delete',
        value: t('commands.warn.subcommands.help.delete', { defaultValue: 'Delete a warning by ID' }),
        inline: false,
      },
      {
        name: '/warn view',
        value: t('commands.warn.subcommands.help.view', { defaultValue: 'View all warnings for a user' }),
        inline: false,
      },
      {
        name: '/warn automation create',
        value: t('commands.warn.subcommands.help.automationCreate', { defaultValue: 'Create an automation for warning thresholds' }),
        inline: false,
      },
      {
        name: '/warn automation view',
        value: t('commands.warn.subcommands.help.automationView', { defaultValue: 'View all configured automations' }),
        inline: false,
      },
      {
        name: '/warn automation delete',
        value: t('commands.warn.subcommands.help.automationDelete', { defaultValue: 'Delete an automation' }),
        inline: false,
      }
    )
    .setTimestamp();

  await respondEphemeral(interaction, { embeds: [embed] });
}

async function handleWarnCreate(interaction: ChatInputCommandInteraction): Promise<any> {
  await ensureDeferred(interaction);

  const user = interaction.options.getUser('user', true);
  const title = interaction.options.getString('title', true);
  const description = interaction.options.getString('description');
  const level = interaction.options.getInteger('level') || 1;
  const proof = interaction.options.getAttachment('proof');

  // Check if user is trying to warn themselves
  if (user.id === interaction.user.id) {
    return interaction.editReply({
      content: t('common.cannotWarnSelf'),
    });
  }

  // Check if user is trying to warn a bot
  if (user.bot) {
    return interaction.editReply({
      content: t('common.cannotWarnBot'),
    });
  }

  try {
    const warning = await warningService.createWarning(
      interaction.guild!,
      user,
      interaction.user,
      title,
      description || undefined,
      level,
      proof?.url
    );

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle(t('commands.warn.subcommands.create.embed.title'))
      .setDescription(t('commands.warn.subcommands.create.success', { user: user.tag }))
      .addFields(
        {
          name: t('commands.warn.subcommands.create.embed.warnId'),
          value: warning.warnId,
          inline: true,
        },
        {
          name: t('commands.warn.subcommands.create.embed.level'),
          value: level.toString(),
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Try to DM the user
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle(t('commands.warn.dm.title', { defaultValue: 'You have been warned' }))
        .setDescription(t('commands.warn.dm.description', { defaultValue: 'You have been warned in **{{guild}}**', guild: interaction.guild!.name }))
        .addFields(
          {
            name: t('commands.warn.dm.fields.title', { defaultValue: 'Title' }),
            value: title,
            inline: false,
          },
          {
            name: t('commands.warn.dm.fields.description', { defaultValue: 'Description' }),
            value: description || t('commands.warn.dm.noDescription', { defaultValue: 'No description provided' }),
            inline: false,
          },
          {
            name: t('commands.warn.dm.fields.level', { defaultValue: 'Level' }),
            value: level.toString(),
            inline: true,
          }
        )
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
    } catch (error) {
      // User has DMs disabled
    }
  } catch (error) {
    logger.error('Error creating warning:', error);
    await interaction.editReply({
      content: t('common.error'),
    });
  }
}

async function handleWarnEdit(interaction: ChatInputCommandInteraction): Promise<any> {
  const warnId = interaction.options.getString('warnid', true);

  // Get the warning
  const warning = await warningRepository.getWarningById(warnId);
  if (!warning || warning.guildId !== interaction.guild!.id) {
    await respondEphemeral(interaction, {
      content: t('commands.warn.subcommands.edit.notFound'),
    });
    return;
  }

  // Create modal
  const modal = new ModalBuilder()
    .setCustomId(`warn_edit:${warnId}`)
    .setTitle(t('commands.warn.subcommands.edit.modal.title'));

  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel(t('commands.warn.subcommands.edit.modal.titleField'))
    .setStyle(TextInputStyle.Short)
    .setValue(warning.title)
    .setRequired(true)
    .setMaxLength(255);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel(t('commands.warn.subcommands.edit.modal.descriptionField'))
    .setStyle(TextInputStyle.Paragraph)
    .setValue(warning.description || '')
    .setRequired(false)
    .setMaxLength(1000);

  const titleRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(titleInput);
  const descriptionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
    descriptionInput
  );

  modal.addComponents(titleRow, descriptionRow);

  await interaction.showModal(modal);
}

async function handleWarnLookup(interaction: ChatInputCommandInteraction): Promise<any> {
  await ensureDeferred(interaction);

  const warnId = interaction.options.getString('warnid', true);

  const warning = await warningRepository.getWarningById(warnId);
  if (!warning || warning.guildId !== interaction.guild!.id) {
    return interaction.editReply({
      content: t('commands.warn.subcommands.lookup.notFound', { warnId }),
    });
  }

  const embed = await warningService.getWarningEmbed(warning, interaction.guild!);
  await interaction.editReply({ embeds: [embed] });
}

async function handleWarnDelete(interaction: ChatInputCommandInteraction): Promise<any> {
  await ensureDeferred(interaction, { ephemeral: true });

  const warnId = interaction.options.getString('warnid', true);

  try {
    const deleted = await warningService.deleteWarning(warnId, interaction.user);

    if (!deleted) {
      await respondEphemeral(interaction, {
        content: t('commands.warn.subcommands.delete.notFound', { warnId }),
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(t('commands.warn.subcommands.delete.success.title'))
      .setDescription(t('commands.warn.subcommands.delete.success.description', { warnId }))
      .addFields(
        {
          name: t('commands.warn.subcommands.delete.success.target'),
          value: `<@${deleted.userId}>`,
          inline: true,
        },
        {
          name: t('commands.warn.subcommands.delete.success.moderator'),
          value: interaction.user.tag,
          inline: true,
        }
      )
      .setTimestamp();

    await respondEphemeral(interaction, { embeds: [embed] });
  } catch (error) {
    logger.error('Error deleting warning:', error);
    await respondEphemeral(interaction, {
      content: t('commands.warn.subcommands.delete.error'),
    });
  }
}

async function handleWarnView(interaction: ChatInputCommandInteraction): Promise<any> {
  await ensureDeferred(interaction);

  const user = interaction.options.getUser('user', true);
  const warnings = await warningRepository.getUserWarnings(interaction.guild!.id, user.id);
  const stats = await warningRepository.getUserWarningStats(interaction.guild!.id, user.id);

  if (warnings.length === 0) {
    return interaction.editReply({
      content: t('commands.warn.subcommands.view.noWarnings', { user: user.tag }),
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0xffa500)
    .setTitle(t('commands.warn.subcommands.view.title', { user: user.tag }))
    .setDescription(
      t('commands.warn.subcommands.view.stats', {
        count: stats.count,
        level: stats.totalLevel,
      })
    )
    .setTimestamp();

  // Add warning fields (max 10)
  const warningsToShow = warnings.slice(0, 10);
  for (const warning of warningsToShow) {
    embed.addFields({
      name: t('commands.warn.subcommands.view.warningHeader', { defaultValue: '{{id}} - Level {{level}}', id: warning.warnId, level: warning.level }),
      value: `**${warning.title}**\n${warning.description || t('commands.warn.subcommands.view.noDescription', { defaultValue: 'No description' })}\n<t:${Math.floor(warning.createdAt.getTime() / 1000)}:R>`,
      inline: false,
    });
  }

  if (warnings.length > 10) {
    embed.setFooter({
      text: t('commands.warn.subcommands.view.footer', { defaultValue: 'Showing 10 of {{total}} warnings', total: warnings.length }),
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleWarnPurge(interaction: ChatInputCommandInteraction): Promise<any> {
  await ensureDeferred(interaction);

  const target = interaction.options.getUser('user', true);

  try {
    const result = await warningService.purgeWarnings(interaction.guild!, target, interaction.user);

    if (result.count === 0) {
      await interaction.editReply({
        content: translateOrFallback(
          'commands.warn.subcommands.purge.noWarnings',
          params => `${params?.user ?? 'This user'} has no active warnings to purge.`,
          { user: target.tag }
        ),
      });
      return;
    }

    const descriptionParams = { user: target.tag, count: result.count };

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(
        translateOrFallback(
          'commands.warn.subcommands.purge.success.title',
          () => 'Warnings Purged'
        )
      )
      .setDescription(
        translateOrFallback(
          'commands.warn.subcommands.purge.success.description',
          params => `Removed ${params?.count ?? 0} warning(s) for ${params?.user ?? 'user'}.`,
          descriptionParams
        )
      )
      .addFields(
        {
          name: translateOrFallback(
            'commands.warn.subcommands.purge.success.target',
            () => 'Target'
          ),
          value: `<@${target.id}>`,
          inline: true,
        },
        {
          name: translateOrFallback(
            'commands.warn.subcommands.purge.success.moderator',
            () => 'Moderator'
          ),
          value: interaction.user.tag,
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error purging warnings:', error);
    await interaction.editReply({
      content: t('common.error'),
    });
  }
}

async function handleAutomationCreate(interaction: ChatInputCommandInteraction): Promise<any> {
  const triggerType = interaction.options.getString('trigger_type', true) as
    | 'warn_count'
    | 'warn_level';
  const triggerValue = interaction.options.getInteger('trigger_value', true);
  const notifyChannel = interaction.options.getChannel('notify_channel');
const notifyChannelId = resolveNotifyChannelId(notifyChannel);

  const button = new ButtonBuilder()
    .setCustomId(
      `warn_automation_modal:${interaction.user.id}:${triggerType}:${triggerValue}:${notifyChannelId ?? 'none'}`
    )
    .setLabel(t('commands.warn.subcommands.automation.create.button'))
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  await respondEphemeral(interaction, {
    content: t('commands.warn.subcommands.automation.create.prompt'),
    components: [row],
  });
}

async function handleAutomationView(interaction: ChatInputCommandInteraction): Promise<any> {
  await ensureDeferred(interaction);

  const automations = await warningRepository.getGuildAutomations(interaction.guild!.id);

  if (automations.length === 0) {
    return interaction.editReply({
      content: t('commands.warn.subcommands.automation.view.noAutomations'),
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(t('commands.warn.subcommands.automation.view.title'))
    .setTimestamp();

  for (const automation of automations) {
    const triggerLabel = automation.triggerType === 'warn_count' ? t('commands.warn.subcommands.automation.view.triggerCount', { defaultValue: 'Count' }) : t('commands.warn.subcommands.automation.view.triggerLevel', { defaultValue: 'Level' });
    const triggerText = `${triggerLabel} >= ${automation.triggerValue}`;
    const actionsText = (automation.actions as WarningAction[])
      .map(action => formatAutomationAction(action))
      .join(', ');
    const statusText = automation.enabled ? t('common.enabled') : t('common.disabled');
    const lastTriggered = automation.lastTriggeredAt
      ? `<t:${Math.floor(automation.lastTriggeredAt.getTime() / 1000)}:R>`
      : t('common.none');
    const channelText = automation.notifyChannelId
      ? `<#${automation.notifyChannelId}>`
      : t('common.none');

    embed.addFields({
      name: `${automation.name} (${automation.automationId})`,
      value: [
        `**${t('commands.warn.subcommands.automation.view.fields.trigger')}:** ${triggerText}`,
        `**${t('commands.warn.subcommands.automation.view.fields.actions')}:** ${actionsText}`,
        `**${t('commands.warn.subcommands.automation.view.fields.status')}:** ${statusText}`,
        `**${t('commands.warn.subcommands.automation.view.fields.lastTriggered')}:** ${lastTriggered}`,
        `**${t('commands.warn.subcommands.automation.view.fields.channel')}:** ${channelText}`,
        automation.description ? `\n${automation.description}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleAutomationDelete(interaction: ChatInputCommandInteraction): Promise<any> {
  await ensureDeferred(interaction);

  const automationId = interaction.options.getString('automationid', true);

  const deleted = await warningService.deleteAutomation(automationId, interaction.user);

  if (!deleted) {
    return interaction.editReply({
      content: t('commands.warn.subcommands.automation.delete.notFound'),
    });
  }

  await interaction.editReply({
    content: t('commands.warn.subcommands.automation.delete.success', { automationId }),
  });
}

function formatAutomationAction(action: WarningAction): string {
  switch (action.type) {
    case 'ban':
      return t('commands.warn.subcommands.automation.actions.ban', { defaultValue: 'Ban' });
    case 'kick':
      return t('commands.warn.subcommands.automation.actions.kick', { defaultValue: 'Kick' });
    case 'timeout':
      return action.duration ? t('commands.warn.subcommands.automation.actions.timeoutDuration', { defaultValue: 'Timeout ({{duration}})', duration: formatAutomationDuration(action.duration) }) : t('commands.warn.subcommands.automation.actions.timeout', { defaultValue: 'Timeout' });
    case 'mute':
      return action.duration ? t('commands.warn.subcommands.automation.actions.muteDuration', { defaultValue: 'Mute ({{duration}})', duration: formatAutomationDuration(action.duration) }) : t('commands.warn.subcommands.automation.actions.mute', { defaultValue: 'Mute' });
    case 'message':
      return t('commands.warn.subcommands.automation.actions.message', { defaultValue: 'Send Message' });
    case 'role':
      return t('commands.warn.subcommands.automation.actions.role', { defaultValue: 'Role Action' });
    default:
      return action.type;
  }
}

function formatAutomationDuration(minutes?: number): string {
  if (!minutes || Number.isNaN(minutes)) {
    return t('common.na', { defaultValue: 'N/A' });
  }

  if (minutes % (60 * 24 * 7) === 0) {
    const weeks = minutes / (60 * 24 * 7);
    return t('common.durationShort.weeks', { defaultValue: '{{count}}w', count: weeks });
  }

  if (minutes % (60 * 24) === 0) {
    const days = minutes / (60 * 24);
    return t('common.durationShort.days', { defaultValue: '{{count}}d', count: days });
  }

  if (minutes % 60 === 0) {
    return t('common.durationShort.hours', { defaultValue: '{{count}}h', count: minutes / 60 });
  }

  return t('common.durationShort.minutes', { defaultValue: '{{count}}m', count: minutes });
}

async function ensureDeferred(
  interaction: ChatInputCommandInteraction,
  options?: InteractionDeferReplyOptions
) {
  if (interaction.deferred || interaction.replied) {
    return;
  }

  await interaction.deferReply(options);
}

async function respondEphemeral(
  interaction: ChatInputCommandInteraction,
  response: InteractionReplyOptions
) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.reply({
      ...response,
      ephemeral: true,
    });
    return;
  }

  await deleteInitialReply(interaction);

  await interaction.followUp({
    ...response,
    ephemeral: true,
  });
}

async function deleteInitialReply(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deleteReply();
  } catch {
    // If the original reply is already gone, ignore the error
  }
}

function resolveNotifyChannelId(channel: CommandChannelOption): string | undefined {
  if (!channel) {
    return undefined;
  }

  if ('type' in channel && channel.type === ChannelType.GuildText) {
    return channel.id;
  }

  if ('isTextBased' in channel && typeof channel.isTextBased === 'function') {
    return channel.isTextBased() ? channel.id : undefined;
  }

  return undefined;
}

function translateOrFallback(
  key: string,
  fallback: (params?: Record<string, string | number>) => string,
  params?: Record<string, string | number>
) {
  const value = t(key, params as never);
  return value === key ? fallback(params) : value;
}
