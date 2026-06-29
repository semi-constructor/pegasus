import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CommandCategory } from '../../types/command';
import { economyService } from '../../services/economyService';
import { economyRepository } from '../../repositories/economyRepository';
import { embedBuilder } from '../../handlers/embedBuilder';
import { logger } from '../../utils/logger';
import { t, getGuildLocale } from '../../i18n';
import { createLocalizationMap, subcommandDescriptions } from '../../utils/localization';

export const isSubcommand = true;

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription(t('commands.economy.subcommands.daily.description', { defaultValue: 'Claim your daily reward' }))
  .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.daily));

export const category = CommandCategory.Economy;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const guildId = interaction.guildId!;
  const locale = interaction.guildId ? getGuildLocale(interaction.guildId) : 'en';

  try {
    const result = await economyService.claimDaily(userId, guildId);

    if (!result.success) {
      await interaction.editReply({
        embeds: [embedBuilder.createErrorEmbed(result.error!)],
      });
      return;
    }

    const settings = await economyRepository.ensureSettings(guildId);
    const metadata = result.transaction?.metadata as any;
    const streakDays = metadata?.streakDays || 1;

    const embed = new EmbedBuilder()
      .setTitle(t('commands.economy.subcommands.daily.embed.title', { defaultValue: 'Daily Reward Claimed!', lng: locale }))
      .setDescription(t('commands.economy.subcommands.daily.embed.description', { defaultValue: 'You received your daily reward!', lng: locale }))
      .setColor(0x2ecc71)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        {
          name: t('commands.economy.subcommands.daily.embed.reward', { defaultValue: 'Reward', lng: locale }),
          value: `${settings.currencySymbol} ${result.transaction!.amount.toLocaleString()}`,
          inline: true,
        },
        {
          name: t('commands.economy.subcommands.daily.embed.streak', { defaultValue: 'Streak', lng: locale }),
          value: `${streakDays} ${t('commands.economy.subcommands.daily.embed.days', { defaultValue: streakDays > 1 ? 'days' : 'day', count: streakDays, lng: locale })}`,
          inline: true,
        },
        {
          name: t('commands.economy.subcommands.daily.embed.newBalance', { defaultValue: 'New Balance', lng: locale }),
          value: `${settings.currencySymbol} ${result.balance!.balance.toLocaleString()}`,
          inline: true,
        }
      )
      .setFooter({ text: t('commands.economy.subcommands.daily.embed.footer', { defaultValue: 'Come back tomorrow for more rewards!', lng: locale }) })
      .setTimestamp();

    if (streakDays > 1) {
      embed.addFields({
        name: t('commands.economy.subcommands.daily.embed.streakBonus', { defaultValue: 'Streak Bonus', lng: locale }),
        value: t('commands.economy.subcommands.daily.embed.streakBonusValue', {
          defaultValue: `You earned ${settings.currencySymbol}${settings.dailyStreakBonus * (streakDays - 1)} extra for your ${streakDays} day streak!`,
          amount: `${settings.currencySymbol}${settings.dailyStreakBonus * (streakDays - 1)}`,
          days: streakDays,
          lng: locale,
        }),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in daily command:', error);
    await interaction.editReply({
      embeds: [
        embedBuilder.createErrorEmbed(
          t('commands.economy.subcommands.daily.error', { defaultValue: 'Failed to claim daily reward. Please try again later.', lng: locale })
        ),
      ],
    });
  }
}
