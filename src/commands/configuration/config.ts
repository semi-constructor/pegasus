import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
} from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t } from '../../i18n';
import { configurationService } from '../../services/configurationService';
import { modLogService } from '../../services/modLogService';
import type { ModLogCategory } from '../../types';
import { logger } from '../../utils/logger';

const MOD_LOG_CATEGORIES: Array<{
  key: ModLogCategory;
  nameKey: string;
  descriptionKey: string;
}> = [
  {
    key: 'message',
    nameKey: 'config.modlogs.categories.message.name',
    descriptionKey: 'config.modlogs.categories.message.description',
  },
  {
    key: 'member',
    nameKey: 'config.modlogs.categories.member.name',
    descriptionKey: 'config.modlogs.categories.member.description',
  },
  {
    key: 'moderation',
    nameKey: 'config.modlogs.categories.moderation.name',
    descriptionKey: 'config.modlogs.categories.moderation.description',
  },
  {
    key: 'wordFilter',
    nameKey: 'config.modlogs.categories.wordFilter.name',
    descriptionKey: 'config.modlogs.categories.wordFilter.description',
  },
];

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription(t('commands.config.description'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(subcommand =>
    subcommand.setName('xp').setDescription(t('commands.config.subcommands.xp.description'))
  )
  .addSubcommand(subcommand =>
    subcommand.setName('eco').setDescription(t('commands.config.subcommands.eco.description'))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('lang')
      .setDescription(t('commands.config.subcommands.lang.description'))
      .addStringOption(option =>
        option
          .setName('language')
          .setDescription(t('commands.config.subcommands.lang.options.language'))
          .setRequired(true)
          .addChoices(
            {
              name: 'English',
              value: 'en',
              name_localizations: { de: 'Englisch', 'es-ES': 'Inglés', fr: 'Anglais' },
            },
            {
              name: 'Deutsch',
              value: 'de',
              name_localizations: { 'en-US': 'German', 'es-ES': 'Alemán', fr: 'Allemand' },
            },
            {
              name: 'Español',
              value: 'es',
              name_localizations: { 'en-US': 'Spanish', de: 'Spanisch', fr: 'Espagnol' },
            },
            {
              name: 'Français',
              value: 'fr',
              name_localizations: { 'en-US': 'French', de: 'Französisch', 'es-ES': 'Francés' },
            }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('welcome')
      .setDescription(t('commands.config.subcommands.welcome.description'))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('autorole')
      .setDescription(t('commands.config.subcommands.autorole.description'))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('goodbye')
      .setDescription(t('commands.config.subcommands.goodbye.description'))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('modlogs')
      .setDescription(t('commands.config.subcommands.modlogs.description'))
  );

export const category = CommandCategory.Admin;
export const cooldown = 3;
export const permissions = [PermissionFlagsBits.ManageGuild];

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: t('common.guildOnly'),
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'xp':
      return handleXPConfig(interaction);
    case 'eco':
      return handleEcoConfig(interaction);
    case 'lang':
      return handleLangConfig(interaction);
    case 'welcome':
      return handleWelcomeConfig(interaction);
    case 'autorole':
      return handleAutoroleConfig(interaction);
    case 'goodbye':
      return handleGoodbyeConfig(interaction);
    case 'modlogs':
      return handleModLogsConfig(interaction);
  }
}

async function handleModLogsConfig(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const response = await buildModLogsConfigResponse(interaction.guild!.id);
    await interaction.editReply(response);
  } catch (error) {
    logger.error('Error in mod logs config:', error);
    await interaction.editReply({
      content: t('common.error'),
    });
  }
}

export async function buildModLogsConfigResponse(guildId: string) {
  const settings = await modLogService.getSettings(guildId);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(t('config.modlogs.embed.title'))
    .setDescription(t('config.modlogs.embed.description'))
    .setTimestamp();

  for (const category of MOD_LOG_CATEGORIES) {
    const setting = settings.get(category.key);
    const status = setting?.enabled ? t('common.enabled') : t('common.disabled');
    const channelMention = setting?.channelId ? `<#${setting.channelId}>` : t('common.none');
    const description = t(category.descriptionKey);
    const statusLine = t('config.modlogs.embed.status', { status });
    const channelLine = t('config.modlogs.embed.channel', { channel: channelMention });

    embed.addFields({
      name: t(category.nameKey),
      value: `${description}\n${statusLine}\n${channelLine}`,
      inline: false,
    });
  }

  const components: Array<
    ActionRowBuilder<ChannelSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>
  > = [];

  for (const category of MOD_LOG_CATEGORIES) {
    const select = new ChannelSelectMenuBuilder()
      .setCustomId(`config_modlogs_select_${category.key}`)
      .setPlaceholder(t('config.modlogs.select.placeholder', { category: t(category.nameKey) }))
      .setMinValues(1)
      .setMaxValues(1);

    components.push(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(select));
  }

  const toggleRow = new ActionRowBuilder<ButtonBuilder>();

  for (const category of MOD_LOG_CATEGORIES) {
    const setting = settings.get(category.key);
    const labelKey = setting?.enabled
      ? 'config.modlogs.buttons.disable'
      : 'config.modlogs.buttons.enable';
    const label = t(labelKey, { category: t(category.nameKey) });

    toggleRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`config_modlogs_toggle_${category.key}`)
        .setLabel(label)
        .setStyle(setting?.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
        .setDisabled(!setting)
    );
  }

  if (toggleRow.components.length > 0) {
    components.push(toggleRow);
  }

  return {
    embeds: [embed],
    components,
  };
}

async function handleXPConfig(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const config = await configurationService.getXPConfig(interaction.guild!.id);
    const roleRewards = await configurationService.getXPRoleRewards(interaction.guild!.id);

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(t('commands.config.subcommands.xp.embed.title'))
      .setDescription(t('commands.config.subcommands.xp.embed.description'))
      .addFields(
        {
          name: t('commands.config.subcommands.xp.embed.fields.status'),
          value: config.enabled ? t('common.enabled') : t('common.disabled'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.xp.embed.fields.perMessage'),
          value: `${config.perMessage} XP`,
          inline: true,
        },
        {
          name: t('commands.config.subcommands.xp.embed.fields.perVoiceMinute'),
          value: `${config.perVoiceMinute} XP`,
          inline: true,
        },
        {
          name: t('commands.config.subcommands.xp.embed.fields.cooldown'),
          value: `${config.cooldown} ${t('common.seconds')}`,
          inline: true,
        },
        {
          name: t('commands.config.subcommands.xp.embed.fields.levelUpAnnounce'),
          value: config.announceLevelUp ? t('common.yes') : t('common.no'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.xp.embed.fields.levelUpChannel'),
          value: config.levelUpChannel ? `<#${config.levelUpChannel}>` : t('common.none'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.xp.embed.fields.boosterRole'),
          value: config.boosterRole ? `<@&${config.boosterRole}>` : t('common.none'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.xp.embed.fields.boosterMultiplier'),
          value: `${config.boosterMultiplier}%`,
          inline: true,
        },
        {
          name: t('commands.config.subcommands.xp.embed.fields.roleRewards'),
          value:
            roleRewards.length > 0
              ? roleRewards
                  .map(
                    r =>
                      `${t('common.level', { defaultValue: 'Level' })} ${r.level}: <@&${r.roleId}>`
                  )
                  .join('\n')
              : t('common.none'),
          inline: false,
        }
      )
      .setTimestamp();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('config_xp_toggle')
        .setLabel(config.enabled ? t('common.disable') : t('common.enable'))
        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('config_xp_rates')
        .setLabel(t('commands.config.subcommands.xp.buttons.rates'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_xp_channels')
        .setLabel(t('commands.config.subcommands.xp.buttons.channels'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_xp_roles')
        .setLabel(t('commands.config.subcommands.xp.buttons.roles'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_xp_rewards')
        .setLabel(t('commands.config.subcommands.xp.buttons.rewards'))
        .setStyle(ButtonStyle.Primary)
    );

    const levelUpChannelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('config_xp_levelup_channel')
        .setPlaceholder(
          config.levelUpChannel
            ? t('commands.config.subcommands.xp.placeholders.levelUpChannelSet', {
                channel: `<#${config.levelUpChannel}>`,
              })
            : t('commands.config.subcommands.xp.placeholders.levelUpChannelUnset')
        )
        .setMinValues(1)
        .setMaxValues(1)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    );

    const announcementControlsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('config_xp_announce_toggle')
        .setLabel(
          config.announceLevelUp
            ? t('commands.config.subcommands.xp.buttons.disableAnnouncements')
            : t('commands.config.subcommands.xp.buttons.enableAnnouncements')
        )
        .setStyle(config.announceLevelUp ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('config_xp_announce_clear')
        .setLabel(t('commands.config.subcommands.xp.buttons.clearAnnouncementChannel'))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!config.levelUpChannel)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row1, levelUpChannelRow, announcementControlsRow],
    });
  } catch (error) {
    logger.error('Error in XP config:', error);
    await interaction.editReply({
      content: t('common.error'),
    });
  }
}

async function handleEcoConfig(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const config = await configurationService.getEconomyConfig(interaction.guild!.id);
    const shopItems = await configurationService.getShopItems(interaction.guild!.id);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(t('commands.config.subcommands.eco.embed.title'))
      .setDescription(t('commands.config.subcommands.eco.embed.description'))
      .addFields(
        {
          name: t('commands.config.subcommands.eco.embed.fields.currency'),
          value: `${config.currencySymbol} ${config.currencyName}`,
          inline: true,
        },
        {
          name: t('commands.config.subcommands.eco.embed.fields.startingBalance'),
          value: `${config.currencySymbol} ${config.startingBalance}`,
          inline: true,
        },
        {
          name: t('commands.config.subcommands.eco.embed.fields.dailyAmount'),
          value: `${config.currencySymbol} ${config.dailyAmount}`,
          inline: true,
        },
        {
          name: t('commands.config.subcommands.eco.embed.fields.workReward'),
          value: `${config.currencySymbol} ${config.workMinAmount} - ${config.workMaxAmount}`,
          inline: true,
        },
        {
          name: t('commands.config.subcommands.eco.embed.fields.robEnabled'),
          value: config.robEnabled ? t('common.yes') : t('common.no'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.eco.embed.fields.shopItems'),
          value:
            shopItems.length > 0
              ? `${shopItems.length} ${t('commands.config.subcommands.eco.embed.fields.itemsConfigured')}`
              : t('common.none'),
          inline: true,
        }
      )
      .setTimestamp();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('config_eco_currency')
        .setLabel(t('commands.config.subcommands.eco.buttons.currency'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_eco_rewards')
        .setLabel(t('commands.config.subcommands.eco.buttons.rewards'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_eco_rob')
        .setLabel(t('commands.config.subcommands.eco.buttons.rob'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_eco_shop')
        .setLabel(t('commands.config.subcommands.eco.buttons.shop'))
        .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row1],
    });
  } catch (error) {
    logger.error('Error in economy config:', error);
    await interaction.editReply({
      content: t('common.error'),
    });
  }
}

async function handleLangConfig(interaction: ChatInputCommandInteraction) {
  const language = interaction.options.getString('language', true);

  await interaction.deferReply();

  try {
    await configurationService.setGuildLanguage(interaction.guild!.id, language);

    // Update the guild's language in the i18n system
    const { setGuildLocale } = await import('../../i18n');
    setGuildLocale(interaction.guild!.id, language);

    const languageNames: Record<string, string> = {
      en: t('languages.en', { defaultValue: 'English' }),
      de: t('languages.de', { defaultValue: 'Deutsch' }),
      es: t('languages.es', { defaultValue: 'Español' }),
      fr: t('languages.fr', { defaultValue: 'Français' }),
    };

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(t('commands.config.subcommands.lang.success.title'))
      .setDescription(
        t('commands.config.subcommands.lang.success.description', {
          language: languageNames[language],
        })
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error setting language:', error);
    await interaction.editReply({
      content: t('common.error'),
    });
  }
}

async function handleWelcomeConfig(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const config = await configurationService.getWelcomeConfig(interaction.guild!.id);

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(t('commands.config.subcommands.welcome.embed.title'))
      .setDescription(t('commands.config.subcommands.welcome.embed.description'))
      .addFields(
        {
          name: t('commands.config.subcommands.welcome.embed.fields.status'),
          value: config.enabled ? t('common.enabled') : t('common.disabled'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.welcome.embed.fields.channel'),
          value: config.channel ? `<#${config.channel}>` : t('common.none'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.welcome.embed.fields.embedEnabled'),
          value: config.embedEnabled ? t('common.yes') : t('common.no'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.welcome.embed.fields.dmEnabled'),
          value: config.dmEnabled ? t('common.yes') : t('common.no'),
          inline: true,
        }
      );

    if (config.message) {
      embed.addFields({
        name: t('commands.config.subcommands.welcome.embed.fields.message'),
        value: config.message.substring(0, 1024),
        inline: false,
      });
    }

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('config_welcome_toggle')
        .setLabel(config.enabled ? t('common.disable') : t('common.enable'))
        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('config_welcome_channel')
        .setLabel(t('commands.config.subcommands.welcome.buttons.channel'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_welcome_message')
        .setLabel(t('commands.config.subcommands.welcome.buttons.message'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_welcome_embed')
        .setLabel(t('commands.config.subcommands.welcome.buttons.embed'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_welcome_dm')
        .setLabel(t('commands.config.subcommands.welcome.buttons.dm'))
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row1],
    });
  } catch (error) {
    logger.error('Error in welcome config:', error);
    await interaction.editReply({
      content: t('common.error'),
    });
  }
}

async function handleAutoroleConfig(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const config = await configurationService.getAutoroleConfig(interaction.guild!.id);

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(t('commands.config.subcommands.autorole.embed.title'))
      .setDescription(t('commands.config.subcommands.autorole.embed.description'))
      .addFields(
        {
          name: t('commands.config.subcommands.autorole.embed.fields.status'),
          value: config.enabled ? t('common.enabled') : t('common.disabled'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.autorole.embed.fields.roles'),
          value:
            config.roles.length > 0
              ? config.roles.map(r => `<@&${r}>`).join('\n')
              : t('common.none'),
          inline: false,
        }
      )
      .setTimestamp();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('config_autorole_toggle')
        .setLabel(config.enabled ? t('common.disable') : t('common.enable'))
        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('config_autorole_add')
        .setLabel(t('commands.config.subcommands.autorole.buttons.add'))
        .setStyle(ButtonStyle.Primary)
        .setDisabled(config.roles.length >= 10),
      new ButtonBuilder()
        .setCustomId('config_autorole_remove')
        .setLabel(t('commands.config.subcommands.autorole.buttons.remove'))
        .setStyle(ButtonStyle.Danger)
        .setDisabled(config.roles.length === 0),
      new ButtonBuilder()
        .setCustomId('config_autorole_clear')
        .setLabel(t('commands.config.subcommands.autorole.buttons.clear'))
        .setStyle(ButtonStyle.Danger)
        .setDisabled(config.roles.length === 0)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row1],
    });
  } catch (error) {
    logger.error('Error in autorole config:', error);
    await interaction.editReply({
      content: t('common.error'),
    });
  }
}

async function handleGoodbyeConfig(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const config = await configurationService.getGoodbyeConfig(interaction.guild!.id);

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(t('commands.config.subcommands.goodbye.embed.title'))
      .setDescription(t('commands.config.subcommands.goodbye.embed.description'))
      .addFields(
        {
          name: t('commands.config.subcommands.goodbye.embed.fields.status'),
          value: config.enabled ? t('common.enabled') : t('common.disabled'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.goodbye.embed.fields.channel'),
          value: config.channel ? `<#${config.channel}>` : t('common.none'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.goodbye.embed.fields.embedEnabled'),
          value: config.embedEnabled ? t('common.yes') : t('common.no'),
          inline: true,
        }
      );

    if (config.message) {
      embed.addFields({
        name: t('commands.config.subcommands.goodbye.embed.fields.message'),
        value: config.message.substring(0, 1024),
        inline: false,
      });
    }

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('config_goodbye_toggle')
        .setLabel(config.enabled ? t('common.disable') : t('common.enable'))
        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('config_goodbye_channel')
        .setLabel(t('commands.config.subcommands.goodbye.buttons.channel'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_goodbye_message')
        .setLabel(t('commands.config.subcommands.goodbye.buttons.message'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_goodbye_embed')
        .setLabel(t('commands.config.subcommands.goodbye.buttons.embed'))
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row1],
    });
  } catch (error) {
    logger.error('Error in goodbye config:', error);
    await interaction.editReply({
      content: t('common.error'),
    });
  }
}
