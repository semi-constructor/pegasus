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
  .setName('work')
  .setDescription(t('commands.economy.subcommands.work.description', { defaultValue: 'Work to earn money' }))
  .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.work));

export const category = CommandCategory.Economy;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const guildId = interaction.guildId!;
  const locale = interaction.guildId ? getGuildLocale(interaction.guildId) : 'en';

  try {
    const result = await economyService.work(userId, guildId);

    if (!result.success) {
      await interaction.editReply({
        embeds: [embedBuilder.createErrorEmbed(result.error!)],
      });
      return;
    }

    const settings = await economyRepository.ensureSettings(guildId);

    const embed = new EmbedBuilder()
      .setTitle(t('commands.economy.subcommands.work.embed.title', { defaultValue: 'Work Complete!', lng: locale }))
      .setDescription(result.transaction!.description!)
      .setColor(0x3498db)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        {
          name: t('commands.economy.subcommands.work.embed.earned', { defaultValue: 'Earned', lng: locale }),
          value: `${settings.currencySymbol} ${result.transaction!.amount.toLocaleString()}`,
          inline: true,
        },
        {
          name: t('commands.economy.subcommands.work.embed.newBalance', { defaultValue: 'New Balance', lng: locale }),
          value: `${settings.currencySymbol} ${result.balance!.balance.toLocaleString()}`,
          inline: true,
        }
      )
      .setFooter({ text: t('commands.economy.subcommands.work.embed.footer', { defaultValue: `You can work again in ${settings.workCooldown / 60} minutes`, minutes: settings.workCooldown / 60, lng: locale }) })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in work command:', error);
    await interaction.editReply({
      embeds: [
        embedBuilder.createErrorEmbed(
          t('commands.economy.subcommands.work.error', { defaultValue: 'Failed to complete work. Please try again later.', lng: locale })
        ),
      ],
    });
  }
}
