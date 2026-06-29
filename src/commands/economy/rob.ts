import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CommandCategory } from '../../types/command';
import { economyService } from '../../services/economyService';
import { economyRepository } from '../../repositories/economyRepository';
import { embedBuilder } from '../../handlers/embedBuilder';
import { logger } from '../../utils/logger';
import { t, getGuildLocale } from '../../i18n';
import { createLocalizationMap, subcommandDescriptions, optionDescriptions } from '../../utils/localization';

export const isSubcommand = true;

export const data = new SlashCommandBuilder()
  .setName('rob')
  .setDescription(t('commands.economy.subcommands.rob.description', { defaultValue: 'Attempt to rob another user' }))
  .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.rob))
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription(t('commands.economy.subcommands.rob.options.user', { defaultValue: 'The user to rob' }))
      .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.robUser))
      .setRequired(true)
  );

export const category = CommandCategory.Economy;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const targetUser = interaction.options.getUser('user', true);
  const guildId = interaction.guildId!;
  const locale = interaction.guildId ? getGuildLocale(interaction.guildId) : 'en';

  if (targetUser.id === userId) {
    await interaction.editReply({
      embeds: [embedBuilder.createErrorEmbed(t('commands.economy.subcommands.rob.cannotRobSelf', { defaultValue: 'You cannot rob yourself!', lng: locale }))],
    });
    return;
  }

  if (targetUser.bot) {
    await interaction.editReply({
      embeds: [embedBuilder.createErrorEmbed(t('commands.economy.subcommands.rob.cannotRobBot', { defaultValue: 'You cannot rob bots!', lng: locale }))],
    });
    return;
  }

  try {
    const result = await economyService.rob(userId, targetUser.id, guildId);
    const settings = await economyRepository.ensureSettings(guildId);

    if (!result.success) {
      if (result.protected) {
        const embed = new EmbedBuilder()
          .setTitle(t('commands.economy.subcommands.rob.embed.protectedTitle', { defaultValue: 'Rob Failed - Protected!', lng: locale }))
          .setDescription(t('commands.economy.subcommands.rob.embed.protectedDescription', { defaultValue: `${targetUser.username} has rob protection! You cannot rob them.`, user: targetUser.username, lng: locale }))
          .setColor(0xe74c3c)
          .setThumbnail(targetUser.displayAvatarURL())
          .setFooter({ text: t('commands.economy.subcommands.rob.embed.protectedFooter', { defaultValue: 'Buy protection from the shop to protect yourself!', lng: locale }) })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({
          embeds: [embedBuilder.createErrorEmbed(result.error!)],
        });
      }
      return;
    }

    const embed = new EmbedBuilder()
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    if (result.amount && result.amount > 0) {
      // Successful rob
      embed
        .setTitle(t('commands.economy.subcommands.rob.embed.successTitle', { defaultValue: 'Robbery Successful!', lng: locale }))
        .setDescription(t('commands.economy.subcommands.rob.embed.successDescription', { defaultValue: `You successfully robbed ${targetUser.username}!`, user: targetUser.username, lng: locale }))
        .setColor(0x2ecc71)
        .addFields(
          {
            name: t('commands.economy.subcommands.rob.embed.amountStolen', { defaultValue: 'Amount Stolen', lng: locale }),
            value: `${settings.currencySymbol} ${result.amount.toLocaleString()}`,
            inline: true,
          },
          {
            name: t('commands.economy.subcommands.rob.embed.yourBalance', { defaultValue: 'Your Balance', lng: locale }),
            value: `${settings.currencySymbol} ${result.robberBalance!.balance.toLocaleString()}`,
            inline: true,
          },
          {
            name: t('commands.economy.subcommands.rob.embed.victimBalance', { defaultValue: 'Victim Balance', lng: locale }),
            value: `${settings.currencySymbol} ${result.victimBalance!.balance.toLocaleString()}`,
            inline: true,
          }
        );
    } else {
      // Failed rob with fine
      embed
        .setTitle(t('commands.economy.subcommands.rob.embed.failedTitle', { defaultValue: 'Robbery Failed!', lng: locale }))
        .setDescription(t('commands.economy.subcommands.rob.embed.failedDescription', { defaultValue: `You were caught trying to rob ${targetUser.username}!`, user: targetUser.username, lng: locale }))
        .setColor(0xe74c3c)
        .addFields(
          {
            name: t('commands.economy.subcommands.rob.embed.fine', { defaultValue: 'Fine', lng: locale }),
            value: `${settings.currencySymbol} ${Math.abs(result.amount || 0).toLocaleString()}`,
            inline: true,
          },
          {
            name: t('commands.economy.subcommands.rob.embed.yourBalance', { defaultValue: 'Your Balance', lng: locale }),
            value: `${settings.currencySymbol} ${result.robberBalance!.balance.toLocaleString()}`,
            inline: true,
          }
        );
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in rob command:', error);
    await interaction.editReply({
      embeds: [
        embedBuilder.createErrorEmbed(
          t('commands.economy.subcommands.rob.error', { defaultValue: 'Failed to complete robbery. Please try again later.', lng: locale })
        ),
      ],
    });
  }
}
