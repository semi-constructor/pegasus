import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalActionRowComponentBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import { Command } from '../../types/command';
import { TicketService } from '../../services/ticketService';
import { TicketRepository } from '../../repositories/ticketRepository';
import { t, getGuildLocale, withLocale } from '../../i18n';
import { createLocalizationMap, commandNames, commandDescriptions, subcommandDescriptions } from '../../utils/localization';
// import { GuildService } from '../../services/guildService';
import { CommandCategory } from '../../types/command';
import { ticketWorkflowService } from '../../services/ticketWorkflowService';
import { ticketWorkflowRepository } from '../../repositories/ticketWorkflowRepository';

interface PanelDraft {
  panelId: string;
  title: string;
  description: string;
  buttonLabel: string;
  buttonStyle: ButtonStyle;
  categoryId?: string;
  supportRoles: string[];
  maxTicketsPerUser: number;
  welcomeMessage?: string;
  imageUrl?: string;
  footer?: string;
  ticketNameFormat?: string;
}

function getButtonStyleLabel(style: ButtonStyle): string {
  switch (style) {
    case ButtonStyle.Primary:
      return t('tickets.buttonStyles.primary');
    case ButtonStyle.Secondary:
      return t('tickets.buttonStyles.secondary');
    case ButtonStyle.Success:
      return t('tickets.buttonStyles.success');
    case ButtonStyle.Danger:
      return t('tickets.buttonStyles.danger');
    case ButtonStyle.Link:
      return t('tickets.buttonStyles.link');
    default:
      return style.toString();
  }
}

function buildPanelPreviewEmbed(
  draft: PanelDraft,
  mode: 'create' | 'edit',
  options?: { isActive?: boolean }
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(mode === 'create' ? t('tickets.panelCreation') : t('tickets.editingPanel'))
    .setDescription(
      mode === 'create'
        ? t('tickets.configuringPanel', { id: draft.panelId })
        : t('tickets.editingPanelDesc', { id: draft.panelId })
    )
    .setColor(mode === 'create' ? 0x00ff00 : 0x5865f2)
    .addFields(
      { name: t('tickets.title'), value: draft.title, inline: true },
      { name: t('tickets.buttonLabel'), value: draft.buttonLabel, inline: true },
      {
        name: t('tickets.buttonStyleField'),
        value: getButtonStyleLabel(draft.buttonStyle),
        inline: true,
      },
      {
        name: t('tickets.maxTicketsPerUser'),
        value: draft.maxTicketsPerUser.toString(),
        inline: true,
      }
    );

  if (options?.isActive !== undefined) {
    embed.addFields({
      name: t('tickets.panelStatus'),
      value: options.isActive ? t('tickets.panelActive') : t('tickets.panelInactive'),
      inline: true,
    });
  }

  if (draft.categoryId) {
    embed.addFields({
      name: t('tickets.categoryField'),
      value: `<#${draft.categoryId}>`,
      inline: true,
    });
  }

  embed.addFields({
    name: t('tickets.supportRolesField'),
    value:
      draft.supportRoles.length > 0
        ? draft.supportRoles.map(roleId => `<@&${roleId}>`).join(', ')
        : t('tickets.noAdditionalRoles'),
    inline: false,
  });

  embed.addFields({
    name: t('tickets.imageField'),
    value: draft.imageUrl ? draft.imageUrl : t('tickets.imageNotSet'),
    inline: false,
  });

  embed.addFields({
    name: t('tickets.footerField'),
    value: draft.footer ? draft.footer : t('tickets.footerNotSet'),
    inline: false,
  });

  if (draft.welcomeMessage) {
    embed.addFields({
      name: t('tickets.welcomeMessageField'),
      value:
        draft.welcomeMessage.length > 256
          ? `${draft.welcomeMessage.slice(0, 253)}...`
          : draft.welcomeMessage,
      inline: false,
    });
  }

  return embed;
}

export const ticket: Command = {
  category: CommandCategory.Tickets,
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription(t('commands.ticket.description', { defaultValue: 'Manage ticket system' }))
    .setNameLocalizations(createLocalizationMap(commandNames.ticket))
    .setDescriptionLocalizations(createLocalizationMap(commandDescriptions.ticket))
    .addSubcommandGroup(group =>
      group
        .setName('panel')
        .setDescription(t('commands.ticket.subcommands.panel.description', { defaultValue: 'Manage ticket panels' }))
        .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.ticket.panel.group))
        .addSubcommand(subcommand =>
          subcommand
            .setName('create')
            .setDescription(t('commands.ticket.subcommands.panel.create.description', { defaultValue: 'Create a new ticket panel configuration' }))
            .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.ticket.panel.create))
            .addStringOption(option =>
              option
                .setName('panel_id')
                .setDescription('Unique ID for this panel')
                .setRequired(true)
                .setMinLength(3)
                .setMaxLength(20)
            )
            .addStringOption(option =>
              option
                .setName('title')
                .setDescription('Panel title')
                .setRequired(true)
                .setMaxLength(256)
            )
            .addStringOption(option =>
              option
                .setName('description')
                .setDescription('Panel description')
                .setRequired(true)
                .setMaxLength(4096)
            )
            .addStringOption(option =>
              option
                .setName('button_label')
                .setDescription('Label for the create ticket button')
                .setMaxLength(80)
            )
            .addIntegerOption(option =>
              option
                .setName('button_style')
                .setDescription('Button style')
                .addChoices(
                  { name: 'Primary (Blue)', value: ButtonStyle.Primary, name_localizations: { de: 'Primär (Blau)', 'es-ES': 'Primario (Azul)', fr: 'Primaire (Bleu)' } },
                  { name: 'Secondary (Gray)', value: ButtonStyle.Secondary, name_localizations: { de: 'Sekundär (Grau)', 'es-ES': 'Secundario (Gris)', fr: 'Secondaire (Gris)' } },
                  { name: 'Success (Green)', value: ButtonStyle.Success, name_localizations: { de: 'Erfolg (Grün)', 'es-ES': 'Éxito (Verde)', fr: 'Succès (Vert)' } },
                  { name: 'Danger (Red)', value: ButtonStyle.Danger, name_localizations: { de: 'Gefahr (Rot)', 'es-ES': 'Peligro (Rojo)', fr: 'Danger (Rouge)' } }
                )
            )
            .addChannelOption(option =>
              option
                .setName('category')
                .setDescription('Category to create tickets in')
                .addChannelTypes(ChannelType.GuildCategory)
            )
            .addRoleOption(option =>
              option.setName('support_role').setDescription('Support role that can see tickets')
            )
            .addIntegerOption(option =>
              option
                .setName('max_tickets')
                .setDescription('Maximum tickets per user')
                .setMinValue(1)
                .setMaxValue(10)
            )
            .addStringOption(option =>
              option
                .setName('welcome_message')
                .setDescription('Welcome message shown in new tickets')
                .setMaxLength(1024)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('load')
            .setDescription(t('commands.ticket.subcommands.panel.load.description', { defaultValue: 'Load and send a ticket panel' }))
            .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.ticket.panel.load))
            .addStringOption(option =>
              option.setName('panel_id').setDescription('ID of the panel to load').setRequired(true)
            )
            .addChannelOption(option =>
              option
                .setName('channel')
                .setDescription('Channel to send the panel to')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('delete')
            .setDescription(t('commands.ticket.subcommands.panel.delete.description', { defaultValue: 'Delete a ticket panel' }))
            .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.ticket.panel.delete))
            .addStringOption(option =>
              option
                .setName('panel_id')
                .setDescription('ID of the panel to delete')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('list')
            .setDescription(t('commands.ticket.subcommands.panel.list.description', { defaultValue: 'List all ticket panels in this server' }))
            .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.ticket.panel.list))
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('edit')
            .setDescription(t('commands.ticket.subcommands.panel.edit.description', { defaultValue: 'Edit an existing ticket panel' }))
            .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.ticket.panel.edit))
            .addStringOption(option =>
              option.setName('panel_id').setDescription('ID of the panel to edit').setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('add_dept')
            .setDescription(t('commands.ticket.subcommands.panel.add_dept.description', { defaultValue: 'Add a department to a ticket panel' }))
            .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.ticket.panel.add_dept))
            .addStringOption(option =>
              option.setName('panel_id').setDescription('ID of the panel').setRequired(true)
            )
            .addStringOption(option =>
              option.setName('dept_id').setDescription('Unique department ID').setRequired(true)
            )
            .addStringOption(option =>
              option.setName('name').setDescription('Department name').setRequired(true)
            )
            .addStringOption(option =>
              option.setName('description').setDescription('Department description').setRequired(true)
            )
            .addRoleOption(option =>
              option.setName('support_role').setDescription('Support role for this department')
            )
            .addChannelOption(option =>
              option.setName('category').setDescription('Category for this department').addChannelTypes(ChannelType.GuildCategory)
            )
            .addStringOption(option =>
              option.setName('welcome_message').setDescription('Welcome message for this department')
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('list_depts')
            .setDescription(t('commands.ticket.subcommands.panel.list_depts.description', { defaultValue: 'List all departments for a ticket panel' }))
            .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.ticket.panel.list_depts))
            .addStringOption(option =>
              option.setName('panel_id').setDescription('ID of the panel').setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('remove_dept')
            .setDescription(t('commands.ticket.subcommands.panel.remove_dept.description', { defaultValue: 'Remove a department from a ticket panel' }))
            .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.ticket.panel.remove_dept))
            .addStringOption(option =>
              option.setName('panel_id').setDescription('ID of the panel').setRequired(true)
            )
            .addStringOption(option =>
              option.setName('dept_id').setDescription('ID of the department to remove').setRequired(true)
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('claim')
        .setDescription(t('commands.ticket.subcommands.claim.description', { defaultValue: 'Claim a ticket (for support staff)' }))
        .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.ticket.claim))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('close')
        .setDescription(t('commands.ticket.subcommands.close.description', { defaultValue: 'Close a ticket' }))
        .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.ticket.close))
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for closing the ticket')
            .setMaxLength(1000)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('stats').setDescription('View ticket statistics for this server')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();
    const ticketService = new TicketService();
    const ticketRepository = new TicketRepository();
    const locale = interaction.guildId ? getGuildLocale(interaction.guildId) : 'en';

    await withLocale(locale, async () => {
      try {
        if (subcommandGroup === 'panel') {
          switch (subcommand) {
            case 'create':
              await handlePanelCreate(interaction, ticketService, locale);
              break;
            case 'load':
              await handlePanelLoad(interaction, ticketService, locale);
              break;
            case 'delete':
              await handlePanelDelete(interaction, ticketService, locale);
              break;
            case 'list':
              await handlePanelList(interaction, ticketRepository, locale);
              break;
            case 'edit':
              await handlePanelEdit(interaction, ticketService, locale);
              break;
            case 'add_dept':
              await handlePanelAddDept(interaction, locale);
              break;
            case 'list_depts':
              await handlePanelListDepts(interaction, locale);
              break;
            case 'remove_dept':
              await handlePanelRemoveDept(interaction, locale);
              break;
          }
        } else {
          switch (subcommand) {
            case 'claim':
              await handleClaim(interaction, ticketService, ticketRepository, locale);
              break;
            case 'close':
              await handleClose(interaction, ticketService, ticketRepository, locale);
              break;
            case 'stats':
              await handleStats(interaction, ticketRepository, locale);
              break;
          }
        }
      } catch (error: any) {
        await interaction.reply({
          content: t('common.error', { lng: locale }) + ': ' + t(error.message, { defaultValue: error.message, lng: locale }),
          ephemeral: true,
        });
      }
    });
  },
};

async function handlePanelCreate(
  interaction: ChatInputCommandInteraction,
  ticketService: TicketService,
  _locale: string
) {
  await interaction.deferReply({ ephemeral: true });

  const panelId = interaction.options.getString('panel_id', true);
  const title = interaction.options.getString('title', true);
  const description = interaction.options.getString('description', true);
  const buttonLabel = interaction.options.getString('button_label') || t('tickets.defaultButtonLabel', { defaultValue: 'Create Ticket' });
  const buttonStyle = interaction.options.getInteger('button_style') || ButtonStyle.Primary;
  const category = interaction.options.getChannel('category');
  const supportRole = interaction.options.getRole('support_role');
  const maxTickets = interaction.options.getInteger('max_tickets') || 1;
  const welcomeMessage = interaction.options.getString('welcome_message');

  const panelDraft: PanelDraft = {
    panelId,
    title,
    description,
    buttonLabel,
    buttonStyle: buttonStyle as ButtonStyle,
    categoryId: category?.id,
    supportRoles: supportRole ? [supportRole.id] : [],
    maxTicketsPerUser: maxTickets,
    welcomeMessage: welcomeMessage ?? undefined,
    imageUrl: undefined,
    footer: undefined,
  };

  const buildComponents = () => {
    const baseRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('panel_add_roles')
        .setLabel(t('tickets.addMoreRoles'))
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('panel_set_image')
        .setLabel(t('tickets.setImage'))
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('panel_set_footer')
        .setLabel(t('tickets.setFooter'))
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('panel_confirm')
        .setLabel(t('tickets.confirmCreate'))
        .setStyle(ButtonStyle.Success)
    );

    return [baseRow];
  };

  const message = await interaction.editReply({
    embeds: [buildPanelPreviewEmbed(panelDraft, 'create')],
    components: buildComponents(),
  });

  const updatePreview = async () => {
    await message.edit({
      embeds: [buildPanelPreviewEmbed(panelDraft, 'create')],
      components: buildComponents(),
    });
  };

  // Handle button interactions
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 300000, // 5 minutes
  });

  collector.on('collect', async buttonInteraction => {
    if (buttonInteraction.user.id !== interaction.user.id) {
      await buttonInteraction.reply({
        content: t('common.notYourButton'),
        ephemeral: true,
      });
      return;
    }

    switch (buttonInteraction.customId) {
      case 'panel_confirm':
        try {
          await ticketService.createPanel(interaction.guild!, {
            ...panelDraft,
            guildId: interaction.guildId!,
          });

          const successEmbed = new EmbedBuilder()
            .setTitle(t('tickets.panelCreated'))
            .setDescription(t('tickets.panelCreatedDesc', { id: panelId }))
            .setColor(0x00ff00)
            .addFields([
              {
                name: t('tickets.nextStep'),
                value: t('tickets.useLoadCommand', { id: panelId }),
              },
            ]);

          await buttonInteraction.update({
            embeds: [successEmbed],
            components: [],
          });
          collector.stop();
        } catch (error: any) {
          await buttonInteraction.reply({
            content: t('common.error') + ': ' + t(error.message, { defaultValue: error.message }),
            ephemeral: true,
          });
        }
        break;

      case 'panel_add_roles': {
        const modalId = `panel_add_roles_${interaction.id}`;
        const modal = new ModalBuilder()
          .setCustomId(modalId)
          .setTitle(t('tickets.modals.addRolesTitle'))
          .addComponents(
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('roleIds')
                .setLabel(t('tickets.modals.addRolesLabel'))
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder(t('tickets.modals.placeholders.roleId', { defaultValue: '123456789012345678' }))
                .setRequired(false)
            )
          );

        await buttonInteraction.showModal(modal);

        let modalInteraction: ModalSubmitInteraction | null = null;
        try {
          modalInteraction = await buttonInteraction.awaitModalSubmit({
            time: 300000,
            filter: submission =>
              submission.customId === modalId && submission.user.id === interaction.user.id,
          });
        } catch (error) {
          await buttonInteraction.followUp({
            content: t('tickets.modals.timeout'),
            ephemeral: true,
          });
          return;
        }

        const roleIdsInput = modalInteraction.fields.getTextInputValue('roleIds').trim();
        const roleIds = roleIdsInput
          ? Array.from(
              new Set(
                roleIdsInput
                  .split(/[\s,]+/)
                  .map(id => id.trim())
                  .filter(id => id.length > 0)
              )
            )
          : [];

        if (roleIds.length === 0) {
          await modalInteraction.reply({
            content: t('tickets.modals.noRolesProvided'),
            ephemeral: true,
          });
          return;
        }

        panelDraft.supportRoles = Array.from(new Set([...panelDraft.supportRoles, ...roleIds]));

        await modalInteraction.reply({
          content: t('tickets.modals.rolesAdded', { count: roleIds.length }),
          ephemeral: true,
        });

        await updatePreview();
        break;
      }

      case 'panel_set_image': {
        const modalId = `panel_set_image_${interaction.id}`;
        const modal = new ModalBuilder()
          .setCustomId(modalId)
          .setTitle(t('tickets.modals.imageTitle'))
          .addComponents(
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('imageUrl')
                .setLabel(t('tickets.modals.imageLabel'))
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(t('tickets.modals.placeholders.imageUrl', { defaultValue: 'https://example.com/panel.png' }))
                .setRequired(false)
                .setMaxLength(512)
            )
          );

        await buttonInteraction.showModal(modal);

        let modalInteraction: ModalSubmitInteraction | null = null;
        try {
          modalInteraction = await buttonInteraction.awaitModalSubmit({
            time: 300000,
            filter: submission =>
              submission.customId === modalId && submission.user.id === interaction.user.id,
          });
        } catch (error) {
          await buttonInteraction.followUp({
            content: t('tickets.modals.timeout'),
            ephemeral: true,
          });
          return;
        }

        const url = modalInteraction.fields.getTextInputValue('imageUrl').trim();

        if (url.length > 0) {
          try {
            const parsed = new URL(url);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
              throw new Error('Invalid protocol');
            }
            panelDraft.imageUrl = url;
            await modalInteraction.reply({
              content: t('tickets.modals.imageSet'),
              ephemeral: true,
            });
          } catch {
            await modalInteraction.reply({
              content: t('tickets.errors.invalidImageUrl'),
              ephemeral: true,
            });
            return;
          }
        } else {
          panelDraft.imageUrl = undefined;
          await modalInteraction.reply({
            content: t('tickets.modals.imageCleared'),
            ephemeral: true,
          });
        }

        await updatePreview();
        break;
      }

      case 'panel_set_footer': {
        const modalId = `panel_set_footer_${interaction.id}`;
        const modal = new ModalBuilder()
          .setCustomId(modalId)
          .setTitle(t('tickets.modals.footerTitle'))
          .addComponents(
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('footerText')
                .setLabel(t('tickets.modals.footerLabel'))
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(t('tickets.modals.footerPlaceholder'))
                .setRequired(false)
                .setMaxLength(256)
            )
          );

        await buttonInteraction.showModal(modal);

        let modalInteraction: ModalSubmitInteraction | null = null;
        try {
          modalInteraction = await buttonInteraction.awaitModalSubmit({
            time: 300000,
            filter: submission =>
              submission.customId === modalId && submission.user.id === interaction.user.id,
          });
        } catch (error) {
          await buttonInteraction.followUp({
            content: t('tickets.modals.timeout'),
            ephemeral: true,
          });
          return;
        }

        const footerText = modalInteraction.fields.getTextInputValue('footerText').trim();
        panelDraft.footer = footerText.length > 0 ? footerText : undefined;

        await modalInteraction.reply({
          content:
            footerText.length > 0
              ? t('tickets.modals.footerSet')
              : t('tickets.modals.footerCleared'),
          ephemeral: true,
        });

        await updatePreview();
        break;
      }

      default:
        await buttonInteraction.reply({
          content: t('common.featureNotImplemented'),
          ephemeral: true,
        });
    }
  });

  collector.on('end', () => {
    if (!collector.ended) {
      interaction.editReply({
        components: [],
      });
    }
  });
}

async function handlePanelLoad(
  interaction: ChatInputCommandInteraction,
  _ticketService: TicketService,
  _locale: string
) {
  await interaction.deferReply({ ephemeral: true });

  const panelId = interaction.options.getString('panel_id', true);
  const channel = interaction.options.getChannel('channel', true) as TextChannel;

  try {
    await ticketWorkflowService.sendPanelWithDepartments(interaction.guild!, channel, panelId);

    await interaction.editReply({
      content: t('tickets.panelLoaded', {
        id: panelId,
        channel: channel.toString(),
      }),
    });
  } catch (error: any) {
    await interaction.editReply({
      content: t('common.error', { error: t(error.message, { defaultValue: error.message }) }),
    });
  }
}

async function handlePanelAddDept(interaction: ChatInputCommandInteraction, _locale: string) {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId!;
  const panelCustomId = interaction.options.getString('panel_id', true);
  const departmentId = interaction.options.getString('dept_id', true);
  const name = interaction.options.getString('name', true);
  const description = interaction.options.getString('description', true);
  const supportRole = interaction.options.getRole('support_role');
  const category = interaction.options.getChannel('category');
  const welcomeMessage = interaction.options.getString('welcome_message');

  try {
    const panel = await ticketWorkflowRepository.getPanelByCustomId(guildId, panelCustomId);
    if (!panel) {
      await interaction.editReply({ content: t('tickets.panelNotFound') });
      return;
    }

    await ticketWorkflowRepository.createDepartment({
      guildId,
      panelId: panel.id,
      departmentId,
      name,
      description,
      supportRoles: supportRole ? [supportRole.id] : [],
      categoryId: category?.id,
      welcomeMessage: welcomeMessage ?? undefined,
    });

    await interaction.editReply({ content: `✅ Department **${name}** added successfully to panel **${panelCustomId}**.` });
  } catch (error: any) {
    await interaction.editReply({ content: t('common.error', { error: t(error.message, { defaultValue: error.message }) }) });
  }
}

async function handlePanelListDepts(interaction: ChatInputCommandInteraction, _locale: string) {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId!;
  const panelCustomId = interaction.options.getString('panel_id', true);

  try {
    const panel = await ticketWorkflowRepository.getPanelByCustomId(guildId, panelCustomId);
    if (!panel) {
      await interaction.editReply({ content: t('tickets.panelNotFound') });
      return;
    }

    const depts = await ticketWorkflowRepository.listDepartmentsByPanel(guildId, panel.id);
    if (depts.length === 0) {
      await interaction.editReply({ content: `No departments found for panel **${panelCustomId}**.` });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`Departments for Panel: ${panelCustomId}`)
      .setColor(0x5865f2)
      .setDescription(depts.map(d => `• **${d.name}** (\`${d.departmentId}\`): ${d.description}`).join('\n'));

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    await interaction.editReply({ content: t('common.error', { error: t(error.message, { defaultValue: error.message }) }) });
  }
}

async function handlePanelRemoveDept(interaction: ChatInputCommandInteraction, _locale: string) {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId!;
  const panelCustomId = interaction.options.getString('panel_id', true);
  const departmentId = interaction.options.getString('dept_id', true);

  try {
    const panel = await ticketWorkflowRepository.getPanelByCustomId(guildId, panelCustomId);
    if (!panel) {
      await interaction.editReply({ content: t('tickets.panelNotFound') });
      return;
    }

    const removed = await ticketWorkflowRepository.deleteDepartment(guildId, panel.id, departmentId);
    if (!removed) {
      await interaction.editReply({ content: `Department \`${departmentId}\` not found on panel **${panelCustomId}**.` });
      return;
    }

    await interaction.editReply({ content: `✅ Department \`${departmentId}\` removed from panel **${panelCustomId}**.` });
  } catch (error: any) {
    await interaction.editReply({ content: t('common.error', { error: t(error.message, { defaultValue: error.message }) }) });
  }
}

async function handlePanelDelete(
  interaction: ChatInputCommandInteraction,
  ticketService: TicketService,
  locale: string
) {
  await interaction.deferReply({ ephemeral: true });

  const panelId = interaction.options.getString('panel_id', true);

  try {
    await ticketService.deletePanel(interaction.guild!, panelId);

    await interaction.editReply({
      content: t('tickets.panelDeleted', { lng: locale, id: panelId }),
    });
  } catch (error: any) {
    await interaction.editReply({
      content: t('common.error', { lng: locale, error: t(error.message, { defaultValue: error.message, lng: locale }) }),
    });
  }
}

async function handlePanelList(
  interaction: ChatInputCommandInteraction,
  ticketRepository: TicketRepository,
  locale: string
) {
  await interaction.deferReply({ ephemeral: true });

  const panels = await ticketRepository.getGuildPanels(interaction.guildId!);

  if (panels.length === 0) {
    await interaction.editReply({
      content: t('tickets.noPanels', { lng: locale }),
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(t('tickets.panelList', { lng: locale }))
    .setColor(0x5865f2)
    .setDescription(
      panels
        .map(
          panel =>
            `**${panel.panelId}**\n` +
            `${t('tickets.title', { lng: locale })}: ${panel.title}\n` +
            `${t('tickets.status', { lng: locale })}: ${panel.isActive ? '✅' : '❌'}\n` +
            `${t('tickets.created', { lng: locale })}: <t:${Math.floor(panel.createdAt.getTime() / 1000)}:R>`
        )
        .join('\n\n')
    );

  await interaction.editReply({ embeds: [embed] });
}

async function handlePanelEdit(
  interaction: ChatInputCommandInteraction,
  ticketService: TicketService,
  _locale: string
) {
  await interaction.deferReply({ ephemeral: true });

  const panelId = interaction.options.getString('panel_id', true);

  const panel = await ticketService.getPanel(interaction.guild!, panelId);
  if (!panel) {
    await interaction.editReply({
      content: t('tickets.panelNotFound'),
    });
    return;
  }

  let currentPanel = panel;
  const supportRoles = (currentPanel.supportRoles as string[]) || [];
  const panelDraft: PanelDraft = {
    panelId: currentPanel.panelId,
    title: currentPanel.title,
    description: currentPanel.description,
    buttonLabel: currentPanel.buttonLabel,
    buttonStyle: (currentPanel.buttonStyle as ButtonStyle) ?? ButtonStyle.Primary,
    categoryId: currentPanel.categoryId ?? undefined,
    supportRoles,
    maxTicketsPerUser: currentPanel.maxTicketsPerUser ?? 1,
    welcomeMessage: currentPanel.welcomeMessage ?? undefined,
    imageUrl: currentPanel.imageUrl ?? undefined,
    footer: currentPanel.footer ?? undefined,
    ticketNameFormat: currentPanel.ticketNameFormat ?? undefined,
  };

  const selectMenuId = `panel_edit_field_${interaction.id}`;

  const buildComponents = () => {
    const selector = new StringSelectMenuBuilder()
      .setCustomId(selectMenuId)
      .setPlaceholder(t('tickets.selectFieldToEdit'))
      .addOptions(
        {
          label: t('tickets.fields.title'),
          value: 'title',
        },
        {
          label: t('tickets.fields.description'),
          value: 'description',
        },
        {
          label: t('tickets.fields.buttonLabel'),
          value: 'button_label',
        },
        {
          label: t('tickets.fields.buttonStyle'),
          value: 'button_style',
        },
        {
          label: t('tickets.fields.supportRoles'),
          value: 'support_roles',
        },
        {
          label: t('tickets.fields.image'),
          value: 'image',
        },
        {
          label: t('tickets.fields.footer'),
          value: 'footer',
        },
        {
          label: t('tickets.fields.category'),
          value: 'category',
        },
        {
          label: t('tickets.fields.maxTickets'),
          value: 'max_tickets',
        },
        {
          label: t('tickets.fields.welcomeMessage'),
          value: 'welcome_message',
        }
      );

    const selectorRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selector);

    const actionsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('panel_edit_toggle')
        .setLabel(currentPanel.isActive ? t('tickets.deactivatePanel') : t('tickets.activatePanel'))
        .setStyle(currentPanel.isActive ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('panel_edit_close')
        .setLabel(t('tickets.closeEditor'))
        .setStyle(ButtonStyle.Secondary)
    );

    return [selectorRow, actionsRow];
  };

  const message = await interaction.editReply({
    embeds: [buildPanelPreviewEmbed(panelDraft, 'edit', { isActive: currentPanel.isActive })],
    components: buildComponents(),
  });

  const refreshUI = async () => {
    await message.edit({
      embeds: [buildPanelPreviewEmbed(panelDraft, 'edit', { isActive: currentPanel.isActive })],
      components: buildComponents(),
    });
  };

  const awaitModal = async (
    component: ButtonInteraction | StringSelectMenuInteraction,
    modal: ModalBuilder,
    modalId: string
  ): Promise<ModalSubmitInteraction | null> => {
    await component.showModal(modal);
    try {
      const submission = await component.awaitModalSubmit({
        time: 300000,
        filter: interactionFilter =>
          interactionFilter.customId === modalId &&
          interactionFilter.user.id === interaction.user.id,
      });
      return submission;
    } catch (error) {
      if (component.isRepliable()) {
        await (component.deferred || component.replied
          ? component.followUp({
              content: t('tickets.modals.timeout'),
              ephemeral: true,
            })
          : component.reply({
              content: t('tickets.modals.timeout'),
              ephemeral: true,
            }));
      }
      return null;
    }
  };

  const collector = message.createMessageComponentCollector({
    time: 300000,
  });

  collector.on('collect', async componentInteraction => {
    if (componentInteraction.user.id !== interaction.user.id) {
      if (componentInteraction.isRepliable()) {
        await componentInteraction.reply({
          content: t('common.notYourButton'),
          ephemeral: true,
        });
      }
      return;
    }

    if (
      componentInteraction.customId === selectMenuId &&
      componentInteraction.isStringSelectMenu()
    ) {
      const value = componentInteraction.values[0];

      switch (value) {
        case 'title': {
          const modalId = `panel_edit_title_${interaction.id}`;
          const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle(t('tickets.modals.titleTitle'))
            .addComponents(
              new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId('value')
                  .setLabel(t('tickets.modals.titleLabel'))
                  .setStyle(TextInputStyle.Short)
                  .setValue(panelDraft.title)
                  .setMaxLength(256)
              )
            );

          const submission = await awaitModal(componentInteraction, modal, modalId);
          if (!submission) return;

          const newTitle = submission.fields.getTextInputValue('value').trim();
          if (newTitle.length === 0) {
            await submission.reply({
              content: t('tickets.errors.emptyField'),
              ephemeral: true,
            });
            return;
          }

          const updated = await ticketService.updatePanel(interaction.guild!, panelDraft.panelId, {
            title: newTitle,
          });
          currentPanel = updated;
          panelDraft.title = updated.title;

          await submission.reply({
            content: t('tickets.messages.titleUpdated'),
            ephemeral: true,
          });
          await refreshUI();
          break;
        }

        case 'description': {
          const modalId = `panel_edit_description_${interaction.id}`;
          const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle(t('tickets.modals.descriptionTitle'))
            .addComponents(
              new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId('value')
                  .setLabel(t('tickets.modals.descriptionLabel'))
                  .setStyle(TextInputStyle.Paragraph)
                  .setValue(panelDraft.description)
                  .setMaxLength(4096)
              )
            );

          const submission = await awaitModal(componentInteraction, modal, modalId);
          if (!submission) return;

          const newDescription = submission.fields.getTextInputValue('value').trim();
          if (newDescription.length === 0) {
            await submission.reply({
              content: t('tickets.errors.emptyField'),
              ephemeral: true,
            });
            return;
          }

          const updated = await ticketService.updatePanel(interaction.guild!, panelDraft.panelId, {
            description: newDescription,
          });
          currentPanel = updated;
          panelDraft.description = updated.description;

          await submission.reply({
            content: t('tickets.messages.descriptionUpdated'),
            ephemeral: true,
          });
          await refreshUI();
          break;
        }

        case 'button_label': {
          const modalId = `panel_edit_button_label_${interaction.id}`;
          const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle(t('tickets.modals.buttonLabelTitle'))
            .addComponents(
              new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId('value')
                  .setLabel(t('tickets.modals.buttonLabel'))
                  .setStyle(TextInputStyle.Short)
                  .setValue(panelDraft.buttonLabel)
                  .setMaxLength(80)
              )
            );

          const submission = await awaitModal(componentInteraction, modal, modalId);
          if (!submission) return;

          const newLabel = submission.fields.getTextInputValue('value').trim();
          if (newLabel.length === 0) {
            await submission.reply({
              content: t('tickets.errors.emptyField'),
              ephemeral: true,
            });
            return;
          }

          const updated = await ticketService.updatePanel(interaction.guild!, panelDraft.panelId, {
            buttonLabel: newLabel,
          });
          currentPanel = updated;
          panelDraft.buttonLabel = updated.buttonLabel;

          await submission.reply({
            content: t('tickets.messages.buttonLabelUpdated'),
            ephemeral: true,
          });
          await refreshUI();
          break;
        }

        case 'button_style': {
          const modalId = `panel_edit_button_style_${interaction.id}`;
          const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle(t('tickets.modals.buttonStyleTitle'))
            .addComponents(
              new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId('value')
                  .setLabel(t('tickets.modals.buttonStyleLabel'))
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder(t('tickets.modals.placeholders.buttonStyle', { defaultValue: 'primary | secondary | success | danger | link' }))
                  .setRequired(true)
              )
            );

          const submission = await awaitModal(componentInteraction, modal, modalId);
          if (!submission) return;

          const input = submission.fields.getTextInputValue('value').trim().toLowerCase();
          const styleMap: Record<string, ButtonStyle> = {
            primary: ButtonStyle.Primary,
            secondary: ButtonStyle.Secondary,
            success: ButtonStyle.Success,
            danger: ButtonStyle.Danger,
            link: ButtonStyle.Link,
          };

          const style = styleMap[input];
          if (!style) {
            await submission.reply({
              content: t('tickets.errors.invalidButtonStyle'),
              ephemeral: true,
            });
            return;
          }

          const updated = await ticketService.updatePanel(interaction.guild!, panelDraft.panelId, {
            buttonStyle: style,
          });
          currentPanel = updated;
          panelDraft.buttonStyle = style;

          await submission.reply({
            content: t('tickets.messages.buttonStyleUpdated'),
            ephemeral: true,
          });
          await refreshUI();
          break;
        }

        case 'support_roles': {
          const modalId = `panel_edit_support_roles_${interaction.id}`;
          const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle(t('tickets.modals.supportRolesTitle'))
            .addComponents(
              new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId('value')
                  .setLabel(t('tickets.modals.supportRolesLabel'))
                  .setStyle(TextInputStyle.Paragraph)
                  .setValue(panelDraft.supportRoles.join('\n'))
                  .setRequired(false)
              )
            );

          const submission = await awaitModal(componentInteraction, modal, modalId);
          if (!submission) return;

          const text = submission.fields.getTextInputValue('value').trim();
          const roles = text
            ? Array.from(
                new Set(
                  text
                    .split(/[\s,]+/)
                    .map(id => id.trim())
                    .filter(id => id.length > 0)
                )
              )
            : [];

          const updated = await ticketService.updatePanel(interaction.guild!, panelDraft.panelId, {
            supportRoles: roles,
          });
          currentPanel = updated;
          panelDraft.supportRoles = roles;

          await submission.reply({
            content: roles.length
              ? t('tickets.messages.supportRolesUpdated', { count: roles.length })
              : t('tickets.messages.supportRolesCleared'),
            ephemeral: true,
          });
          await refreshUI();
          break;
        }

        case 'image': {
          const modalId = `panel_edit_image_${interaction.id}`;
          const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle(t('tickets.modals.imageTitle'))
            .addComponents(
              new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId('value')
                  .setLabel(t('tickets.modals.imageLabel'))
                  .setStyle(TextInputStyle.Short)
                  .setValue(panelDraft.imageUrl ?? '')
                  .setPlaceholder(t('tickets.modals.placeholders.imageUrl', { defaultValue: 'https://example.com/panel.png' }))
                  .setRequired(false)
              )
            );

          const submission = await awaitModal(componentInteraction, modal, modalId);
          if (!submission) return;

          const url = submission.fields.getTextInputValue('value').trim();
          if (url.length > 0) {
            try {
              const parsed = new URL(url);
              if (!['http:', 'https:'].includes(parsed.protocol)) {
                throw new Error('Invalid protocol');
              }
            } catch {
              await submission.reply({
                content: t('tickets.errors.invalidImageUrl'),
                ephemeral: true,
              });
              return;
            }
          }

          const updated = await ticketService.updatePanel(interaction.guild!, panelDraft.panelId, {
            imageUrl: url.length > 0 ? url : null,
          });
          currentPanel = updated;
          panelDraft.imageUrl = url.length > 0 ? url : undefined;

          await submission.reply({
            content:
              url.length > 0 ? t('tickets.modals.imageSet') : t('tickets.modals.imageCleared'),
            ephemeral: true,
          });
          await refreshUI();
          break;
        }

        case 'footer': {
          const modalId = `panel_edit_footer_${interaction.id}`;
          const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle(t('tickets.modals.footerTitle'))
            .addComponents(
              new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId('value')
                  .setLabel(t('tickets.modals.footerLabel'))
                  .setStyle(TextInputStyle.Short)
                  .setValue(panelDraft.footer ?? '')
                  .setRequired(false)
                  .setMaxLength(256)
              )
            );

          const submission = await awaitModal(componentInteraction, modal, modalId);
          if (!submission) return;

          const footer = submission.fields.getTextInputValue('value').trim();
          const updated = await ticketService.updatePanel(interaction.guild!, panelDraft.panelId, {
            footer: footer.length > 0 ? footer : null,
          });
          currentPanel = updated;
          panelDraft.footer = footer.length > 0 ? footer : undefined;

          await submission.reply({
            content:
              footer.length > 0 ? t('tickets.modals.footerSet') : t('tickets.modals.footerCleared'),
            ephemeral: true,
          });
          await refreshUI();
          break;
        }

        case 'category': {
          const modalId = `panel_edit_category_${interaction.id}`;
          const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle(t('tickets.modals.categoryTitle'))
            .addComponents(
              new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId('value')
                  .setLabel(t('tickets.modals.categoryLabel'))
                  .setStyle(TextInputStyle.Short)
                  .setValue(panelDraft.categoryId ?? '')
                  .setPlaceholder(t('tickets.modals.categoryPlaceholder'))
                  .setRequired(false)
              )
            );

          const submission = await awaitModal(componentInteraction, modal, modalId);
          if (!submission) return;

          const categoryId = submission.fields.getTextInputValue('value').trim();
          const updated = await ticketService.updatePanel(interaction.guild!, panelDraft.panelId, {
            categoryId: categoryId.length > 0 ? categoryId : null,
          });
          currentPanel = updated;
          panelDraft.categoryId = categoryId.length > 0 ? categoryId : undefined;

          await submission.reply({
            content:
              categoryId.length > 0
                ? t('tickets.messages.categoryUpdated', { channel: `<#${categoryId}>` })
                : t('tickets.messages.categoryCleared'),
            ephemeral: true,
          });
          await refreshUI();
          break;
        }

        case 'max_tickets': {
          const modalId = `panel_edit_max_tickets_${interaction.id}`;
          const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle(t('tickets.modals.maxTicketsTitle'))
            .addComponents(
              new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId('value')
                  .setLabel(t('tickets.modals.maxTicketsLabel'))
                  .setStyle(TextInputStyle.Short)
                  .setValue(panelDraft.maxTicketsPerUser.toString())
                  .setRequired(true)
              )
            );

          const submission = await awaitModal(componentInteraction, modal, modalId);
          if (!submission) return;

          const parsed = Number(submission.fields.getTextInputValue('value').trim());
          if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
            await submission.reply({
              content: t('tickets.errors.invalidMaxTickets'),
              ephemeral: true,
            });
            return;
          }

          const updated = await ticketService.updatePanel(interaction.guild!, panelDraft.panelId, {
            maxTicketsPerUser: parsed,
          });
          currentPanel = updated;
          panelDraft.maxTicketsPerUser = parsed;

          await submission.reply({
            content: t('tickets.messages.maxTicketsUpdated', { count: parsed }),
            ephemeral: true,
          });
          await refreshUI();
          break;
        }

        case 'welcome_message': {
          const modalId = `panel_edit_welcome_${interaction.id}`;
          const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle(t('tickets.modals.welcomeTitle'))
            .addComponents(
              new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId('value')
                  .setLabel(t('tickets.modals.welcomeLabel'))
                  .setStyle(TextInputStyle.Paragraph)
                  .setValue(panelDraft.welcomeMessage ?? '')
                  .setRequired(false)
                  .setMaxLength(1024)
              )
            );

          const submission = await awaitModal(componentInteraction, modal, modalId);
          if (!submission) return;

          const welcome = submission.fields.getTextInputValue('value').trim();
          const updated = await ticketService.updatePanel(interaction.guild!, panelDraft.panelId, {
            welcomeMessage: welcome.length > 0 ? welcome : null,
          });
          currentPanel = updated;
          panelDraft.welcomeMessage = welcome.length > 0 ? welcome : undefined;

          await submission.reply({
            content:
              welcome.length > 0
                ? t('tickets.messages.welcomeUpdated')
                : t('tickets.messages.welcomeCleared'),
            ephemeral: true,
          });
          await refreshUI();
          break;
        }
      }
      return;
    }

    if (componentInteraction.isButton()) {
      switch (componentInteraction.customId) {
        case 'panel_edit_toggle': {
          await componentInteraction.deferReply({ ephemeral: true });
          const updated = await ticketService.updatePanel(interaction.guild!, panelDraft.panelId, {
            isActive: !currentPanel.isActive,
          });
          currentPanel = updated;
          await componentInteraction.editReply({
            content: updated.isActive
              ? t('tickets.messages.panelActivated')
              : t('tickets.messages.panelDeactivated'),
          });
          await refreshUI();
          break;
        }
        case 'panel_edit_close': {
          collector.stop('closed');
          await componentInteraction.update({
            embeds: [
              buildPanelPreviewEmbed(panelDraft, 'edit', { isActive: currentPanel.isActive }),
            ],
            components: [],
          });
          break;
        }
      }
    }
  });

  collector.on('end', async (_collected, reason) => {
    if (reason !== 'closed') {
      await interaction.editReply({
        embeds: [buildPanelPreviewEmbed(panelDraft, 'edit', { isActive: currentPanel.isActive })],
        components: [],
      });
    }
  });
}

async function handleClaim(
  interaction: ChatInputCommandInteraction,
  ticketService: TicketService,
  ticketRepository: TicketRepository,
  locale: string
) {
  // Check if in ticket channel
  const ticket = await ticketRepository.getTicketByChannel(interaction.channelId);
  if (!ticket) {
    await interaction.reply({
      content: t('tickets.notInTicket'),
      ephemeral: true,
    });
    return;
  }

  try {
    await ticketService.claimTicket(ticket.id, interaction.member as any, locale);

    await interaction.reply({
      content: t('tickets.claimSuccess'),
    });
  } catch (error: any) {
    await interaction.reply({
      content: t('common.error', { error: t(error.message, { defaultValue: error.message }) }),
      ephemeral: true,
    });
  }
}

async function handleClose(
  interaction: ChatInputCommandInteraction,
  ticketService: TicketService,
  ticketRepository: TicketRepository,
  locale: string
) {
  // Check if in ticket channel
  const ticket = await ticketRepository.getTicketByChannel(interaction.channelId);
  if (!ticket) {
    await interaction.reply({
      content: t('tickets.notInTicket'),
      ephemeral: true,
    });
    return;
  }

  const reason = interaction.options.getString('reason');

  try {
    await ticketService.closeTicket(
      ticket.id,
      interaction.member as any,
      reason || undefined,
      locale
    );

    await interaction.reply({
      content: t('tickets.closing'),
    });

    // Delete channel after 5 seconds
    setTimeout(async () => {
      try {
        await interaction.channel?.delete();
      } catch (error) {
        // Channel might already be deleted
      }
    }, 5000);
  } catch (error: any) {
    await interaction.reply({
      content: t('common.error', { error: t(error.message, { defaultValue: error.message }) }),
      ephemeral: true,
    });
  }
}

async function handleStats(
  interaction: ChatInputCommandInteraction,
  ticketRepository: TicketRepository,
  locale: string
) {
  await interaction.deferReply({ ephemeral: true });

  const stats = await ticketRepository.getTicketStats(interaction.guildId!);

  const embed = new EmbedBuilder()
    .setTitle(t('tickets.statistics', { lng: locale }))
    .setColor(0x5865f2)
    .addFields([
      {
        name: t('tickets.totalTickets', { lng: locale }),
        value: stats.total.toString(),
        inline: true,
      },
      {
        name: t('tickets.openTickets', { lng: locale }),
        value: stats.open.toString(),
        inline: true,
      },
      {
        name: t('tickets.claimedTickets', { lng: locale }),
        value: stats.claimed.toString(),
        inline: true,
      },
      {
        name: t('tickets.closedTickets', { lng: locale }),
        value: stats.closed.toString(),
        inline: true,
      },
      {
        name: t('tickets.lockedTickets', { lng: locale }),
        value: stats.locked.toString(),
        inline: true,
      },
      {
        name: t('tickets.frozenTickets', { lng: locale }),
        value: stats.frozen.toString(),
        inline: true,
      },
    ])
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// Export for command handler
export const data = ticket.data;
export const execute = ticket.execute;
