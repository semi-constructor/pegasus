import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { Command, CommandCategory } from '../../types/command';
import { xpService } from '../../services/xpService';
import { rankCardService } from '../../services/rankCardService';
import { configurationService } from '../../services/configurationService';
import { logger } from '../../utils/logger';
import { getTranslation, type LocaleObject } from '../../i18n';
import { createLocalizationMap, commandNames, commandDescriptions, subcommandDescriptions, optionDescriptions } from '../../utils/localization';

const xpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('XP system commands')
    .setNameLocalizations(createLocalizationMap(commandNames.xp))
    .setDescriptionLocalizations(createLocalizationMap(commandDescriptions.xp))
    .addSubcommand(subcommand =>
      subcommand
        .setName('rank')
        .setDescription('View your XP rank card')
        .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.xp.rank))
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to view rank for')
            .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.user))
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('leaderboard')
        .setDescription('View the server XP leaderboard')
        .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.xp.leaderboard))
        .addIntegerOption(option =>
          option
            .setName('page')
            .setDescription('Page number to view')
            .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.page))
            .setRequired(false)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('configuration')
        .setDescription('View current XP configuration')
        .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.xp.configuration))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('card')
        .setDescription('Customize your rank card colors')
        .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.xp.card))
    ),
  category: CommandCategory.XP,
  cooldown: 5,
  guildOnly: true,
  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const locale = await getTranslation(interaction.guildId!, interaction.user.id);

    switch (subcommand) {
      case 'rank':
        await handleRankCommand(interaction, locale);
        break;
      case 'leaderboard':
        await handleLeaderboardCommand(interaction, locale);
        break;
      case 'configuration':
        await handleConfigurationCommand(interaction, locale);
        break;
      case 'card':
        await handleCardCustomizationCommand(interaction, locale);
        break;
    }
  },
};

async function handleRankCommand(interaction: ChatInputCommandInteraction, locale: LocaleObject) {
  try {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const rankData = await xpService.getUserRank(targetUser.id, interaction.guildId!);

    if (!rankData) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setDescription(locale.commands.xp.rank.noData.replace('{{user}}', targetUser.toString()));

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Ensure avatar and username are up to date
    rankData.avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
    rankData.username = targetUser.username;

    // Get customization
    const customization = await xpService.getRankCardCustomization(targetUser.id);

    // Generate rank card
    const rankCard = await rankCardService.generateRankCard(rankData, customization);

    if (!rankCard) {
      const embed = new EmbedBuilder().setColor(0xff0000).setDescription(locale.common.error);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    await interaction.editReply({ files: [rankCard] });
  } catch (error) {
    logger.error('Failed to handle rank command:', error);

    const embed = new EmbedBuilder().setColor(0xff0000).setDescription(locale.common.error);

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}

async function handleLeaderboardCommand(
  interaction: ChatInputCommandInteraction,
  locale: LocaleObject
) {
  try {
    await interaction.deferReply();

    const page = interaction.options.getInteger('page') || 1;
    const leaderboardData = await xpService.getLeaderboard(interaction.guildId!, page, 10);

    if (leaderboardData.entries.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setDescription(locale.commands.xp.leaderboard.noData);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Update avatar URLs
    for (const entry of leaderboardData.entries) {
      const member = await interaction.guild!.members.fetch(entry.userId).catch(() => null);
      if (member) {
        entry.avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 64 });
        entry.username = member.displayName;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(locale.commands.xp.leaderboard.title.replace('{{guild}}', interaction.guild!.name))
      .setDescription(
        leaderboardData.entries
          .map(entry => {
            const medal =
              entry.rank === 1
                ? (locale.commands.xp.leaderboard as any).medals?.first || '🥇'
                : entry.rank === 2
                  ? (locale.commands.xp.leaderboard as any).medals?.second || '🥈'
                  : entry.rank === 3
                    ? (locale.commands.xp.leaderboard as any).medals?.third || '🥉'
                    : `**${entry.rank}.**`;
            return `${medal} @${entry.userId} - ${locale.commands.xp.leaderboard.entry
              .replace('{{level}}', entry.level.toString())
              .replace('{{xp}}', entry.xp.toLocaleString())}`;
          })
          .join('\n')
      )
      .setFooter({
        text: locale.commands.xp.leaderboard.footer
          .replace('{{page}}', page.toString())
          .replace('{{total}}', leaderboardData.totalPages.toString()),
      })
      .setTimestamp();

    // Create navigation buttons
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`xp_leaderboard_prev_${page}`)
        .setLabel(locale.commands.xp.leaderboard.previous)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 1),
      new ButtonBuilder()
        .setCustomId(`xp_leaderboard_next_${page}`)
        .setLabel(locale.commands.xp.leaderboard.next)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= leaderboardData.totalPages)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    logger.error('Failed to handle leaderboard command:', error);

    const embed = new EmbedBuilder().setColor(0xff0000).setDescription(locale.common.error);

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}

async function handleConfigurationCommand(
  interaction: ChatInputCommandInteraction,
  locale: LocaleObject
) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const config = await configurationService.getXPConfig(interaction.guildId!);
    const roleRewards = await configurationService.getXPRoleRewards(interaction.guildId!);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(locale.commands.xp.configuration.title)
      .setDescription(locale.commands.xp.configuration.description)
      .addFields(
        {
          name: locale.commands.xp.configuration.status,
          value: config.enabled ? locale.common.enabled : locale.common.disabled,
          inline: true,
        },
        {
          name: locale.commands.xp.configuration.perMessage,
          value: `${config.perMessage} XP`,
          inline: true,
        },
        {
          name: locale.commands.xp.configuration.perVoiceMinute,
          value: `${config.perVoiceMinute} XP`,
          inline: true,
        },
        {
          name: locale.commands.xp.configuration.cooldown,
          value: `${config.cooldown} ${locale.common.seconds}`,
          inline: true,
        },
        {
          name: locale.commands.xp.configuration.levelUpAnnounce,
          value: config.announceLevelUp ? locale.common.enabled : locale.common.disabled,
          inline: true,
        },
        {
          name: locale.commands.xp.configuration.levelUpChannel,
          value: config.levelUpChannel ? `<#${config.levelUpChannel}>` : locale.common.none,
          inline: true,
        }
      );

    // Add booster role info
    if (config.boosterRole) {
      embed.addFields({
        name: locale.commands.xp.configuration.boosterRole,
        value: `<@&${config.boosterRole}> (${config.boosterMultiplier}% ${locale.commands.xp.configuration.multiplier})`,
        inline: false,
      });
    }

    // Add role rewards
    if (roleRewards.length > 0) {
      embed.addFields({
        name: locale.commands.xp.configuration.roleRewards,
        value:
          roleRewards
            .slice(0, 10)
            .map(
              reward =>
                `${locale.commands.xp.configuration.level} ${reward.level}: <@&${reward.roleId}>`
            )
            .join('\n') +
          (roleRewards.length > 10 ? `\n... ${locale.commands.xp.configuration.andMore}` : ''),
        inline: false,
      });
    }

    // Add special channels info
    const specialChannelsInfo = [];
    if (config.ignoredChannels.length > 0) {
      specialChannelsInfo.push(
        `**${locale.commands.xp.configuration.ignoredChannels}:** ${config.ignoredChannels.length} ${locale.commands.xp.configuration.channels}`
      );
    }
    if (config.noXpChannels.length > 0) {
      specialChannelsInfo.push(
        `**${locale.commands.xp.configuration.noXpChannels}:** ${config.noXpChannels.length} ${locale.commands.xp.configuration.channels}`
      );
    }
    if (config.doubleXpChannels.length > 0) {
      specialChannelsInfo.push(
        `**${locale.commands.xp.configuration.doubleXpChannels}:** ${config.doubleXpChannels.length} ${locale.commands.xp.configuration.channels}`
      );
    }

    if (specialChannelsInfo.length > 0) {
      embed.addFields({
        name: locale.commands.xp.configuration.specialChannels,
        value: specialChannelsInfo.join('\n'),
        inline: false,
      });
    }

    embed.setFooter({
      text: locale.commands.xp.configuration.footer,
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Failed to handle configuration command:', error);

    const embed = new EmbedBuilder().setColor(0xff0000).setDescription(locale.common.error);

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}

async function handleCardCustomizationCommand(
  interaction: ChatInputCommandInteraction,
  locale: any
) {
  try {
    const modal = new ModalBuilder()
      .setCustomId('xp_card_customization')
      .setTitle(locale.commands.xp.card.modalTitle);

    const currentCustomization = await xpService.getRankCardCustomization(interaction.user.id);

    const bgColorInput = new TextInputBuilder()
      .setCustomId('backgroundColor')
      .setLabel(locale.commands.xp.card.backgroundColor)
      .setStyle(TextInputStyle.Short)
      .setValue(currentCustomization.backgroundColor || '#23272A')
      .setPlaceholder((locale.commands.xp.card as any).placeholders?.backgroundColor || '#23272A')
      .setRequired(false)
      .setMaxLength(7)
      .setMinLength(7);

    const progressColorInput = new TextInputBuilder()
      .setCustomId('progressBarColor')
      .setLabel(locale.commands.xp.card.progressBarColor)
      .setStyle(TextInputStyle.Short)
      .setValue(currentCustomization.progressBarColor || '#5865F2')
      .setPlaceholder((locale.commands.xp.card as any).placeholders?.progressBarColor || '#5865F2')
      .setRequired(false)
      .setMaxLength(7)
      .setMinLength(7);

    const textColorInput = new TextInputBuilder()
      .setCustomId('textColor')
      .setLabel(locale.commands.xp.card.textColor)
      .setStyle(TextInputStyle.Short)
      .setValue(currentCustomization.textColor || '#FFFFFF')
      .setPlaceholder((locale.commands.xp.card as any).placeholders?.textColor || '#FFFFFF')
      .setRequired(false)
      .setMaxLength(7)
      .setMinLength(7);

    const accentColorInput = new TextInputBuilder()
      .setCustomId('accentColor')
      .setLabel(locale.commands.xp.card.accentColor)
      .setStyle(TextInputStyle.Short)
      .setValue(currentCustomization.accentColor || '#EB459E')
      .setPlaceholder((locale.commands.xp.card as any).placeholders?.accentColor || '#EB459E')
      .setRequired(false)
      .setMaxLength(7)
      .setMinLength(7);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(bgColorInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(progressColorInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(textColorInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(accentColorInput)
    );

    await interaction.showModal(modal);
  } catch (error) {
    logger.error('Failed to handle card customization command:', error);

    const embed = new EmbedBuilder().setColor(0xff0000).setDescription(locale.common.error);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
export const data = xpCommand.data;
export const execute = xpCommand.execute;
export const category = xpCommand.category;
export const cooldown = xpCommand.cooldown;
export const guildOnly = xpCommand.guildOnly;
