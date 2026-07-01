import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CommandCategory } from '../../types/command';
import { economyService } from '../../services/economyService';
import { economyRepository } from '../../repositories/economyRepository';
import { embedBuilder } from '../../handlers/embedBuilder';
import { t, getGuildLocale } from '../../i18n';
import { logger } from '../../utils/logger';
import {
  createLocalizationMap,
  subcommandDescriptions,
  optionDescriptions,
} from '../../utils/localization';

export const isSubcommand = true;

export const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription(
    t('commands.economy.subcommands.balance.description', {
      defaultValue: "Check your or another user's balance",
    })
  )
  .setNameLocalizations({
    'es-ES': 'saldo',
    fr: 'solde',
    de: 'guthaben',
  })
  .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.balance))
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription(
        t('commands.economy.subcommands.balance.options.user', {
          defaultValue: 'The user to check balance for',
        })
      )
      .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.balanceUser))
      .setRequired(false)
  );

export const category = CommandCategory.Economy;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const targetUser = interaction.options.getUser('user') || interaction.user;
  const guildId = interaction.guildId!;
  const locale = interaction.guildId ? getGuildLocale(interaction.guildId) : 'en';

  try {
    const balance = await economyService.getOrCreateBalance(targetUser.id, guildId);
    const settings = await economyRepository.ensureSettings(guildId);

    // Get recent transactions
    const transactions = await economyRepository.getTransactions(targetUser.id, guildId, 5);

    const embed = new EmbedBuilder()
      .setTitle(
        `${settings.currencySymbol} ${t('commands.economy.subcommands.balance.embed.title', { defaultValue: 'Balance', lng: locale })}`
      )
      .setDescription(
        `**${targetUser.username} - ${t('commands.economy.subcommands.balance.embed.description', { defaultValue: 'Balance', lng: locale })}**`
      )
      .setColor(0x2ecc71)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        {
          name: t('commands.economy.subcommands.balance.embed.wallet', {
            defaultValue: 'Wallet',
            lng: locale,
          }),
          value: `${settings.currencySymbol} ${balance.balance.toLocaleString()}`,
          inline: true,
        },
        {
          name: t('commands.economy.subcommands.balance.embed.bank', {
            defaultValue: 'Bank',
            lng: locale,
          }),
          value: `${settings.currencySymbol} ${balance.bankBalance.toLocaleString()}`,
          inline: true,
        },
        {
          name: t('commands.economy.subcommands.balance.embed.netWorth', {
            defaultValue: 'Net Worth',
            lng: locale,
          }),
          value: `${settings.currencySymbol} ${(balance.balance + balance.bankBalance).toLocaleString()}`,
          inline: true,
        },
        {
          name: t('commands.economy.subcommands.balance.embed.statistics', {
            defaultValue: 'Statistics',
            lng: locale,
          }),
          value:
            `${t('commands.economy.subcommands.balance.embed.totalEarned', { defaultValue: 'Total Earned', lng: locale })}: ${settings.currencySymbol} ${balance.totalEarned.toLocaleString()}\n` +
            `${t('commands.economy.subcommands.balance.embed.totalSpent', { defaultValue: 'Total Spent', lng: locale })}: ${settings.currencySymbol} ${balance.totalSpent.toLocaleString()}\n` +
            `${t('commands.economy.subcommands.balance.embed.totalGambled', { defaultValue: 'Total Gambled', lng: locale })}: ${settings.currencySymbol} ${balance.totalGambled.toLocaleString()}`,
          inline: false,
        }
      )
      .setFooter({
        text: `${t('commands.economy.subcommands.balance.embed.currency', { defaultValue: 'Currency', lng: locale })}: ${settings.currencyName}`,
      })
      .setTimestamp();

    // Add recent transactions if any
    if (transactions.length > 0) {
      const transactionList = transactions
        .map(tObj => {
          const prefix = tObj.amount > 0 ? '+' : '';
          const emoji = tObj.amount > 0 ? '📈' : '📉';
          return `${emoji} ${prefix}${settings.currencySymbol}${Math.abs(tObj.amount)} - ${tObj.description || tObj.type}`;
        })
        .join('\n');

      embed.addFields({
        name: t('commands.economy.subcommands.balance.embed.recentTransactions', {
          defaultValue: 'Recent Transactions',
          lng: locale,
        }),
        value: transactionList,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in balance command:', error);
    await interaction.editReply({
      embeds: [
        embedBuilder.createErrorEmbed(
          t('common.error', { defaultValue: 'Error', lng: locale }),
          t('commands.economy.subcommands.balance.error', {
            defaultValue: 'Failed to fetch balance. Please try again later.',
            lng: locale,
          })
        ),
      ],
    });
  }
}
