import { ModalSubmitInteraction, EmbedBuilder } from 'discord.js';
import { xpService, type RankCardCustomization } from '../../services/xpService';
import { rankCardService } from '../../services/rankCardService';
import { logger } from '../../utils/logger';
import { getTranslation } from '../../i18n';

export async function handleXPModals(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId !== 'xp_card_customization') return;

  const locale = await getTranslation(interaction.guildId!, interaction.user.id);

  try {
    await interaction.deferReply({ ephemeral: true });

    // Get color values from modal
    const backgroundColor = interaction.fields.getTextInputValue('backgroundColor') || '#23272A';
    const progressBarColor = interaction.fields.getTextInputValue('progressBarColor') || '#5865F2';
    const textColor = interaction.fields.getTextInputValue('textColor') || '#FFFFFF';
    const accentColor = interaction.fields.getTextInputValue('accentColor') || '#EB459E';

    // Validate hex colors
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    const colors = { backgroundColor, progressBarColor, textColor, accentColor };

    for (const [name, value] of Object.entries(colors)) {
      if (!hexColorRegex.test(value)) {
        const colorLabel = (locale.commands.xp.card as any)[name] || name;
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setDescription(
            locale.commands.xp.card.invalidColor
              .replace('{{color}}', colorLabel)
              .replace('{{value}}', value)
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }
    }

    // Save customization
    const customization: RankCardCustomization = {
      backgroundColor,
      progressBarColor,
      textColor,
      accentColor,
    };

    const success = await xpService.saveRankCardCustomization(interaction.user.id, customization);

    if (!success) {
      const embed = new EmbedBuilder().setColor(0xff0000).setDescription(locale.common.error);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Generate preview
    const rankData = await xpService.getUserRank(interaction.user.id, interaction.guildId!);

    if (!rankData) {
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setDescription(locale.commands.xp.card.savedNoPreview);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Update avatar URL
    rankData.avatarUrl = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
    rankData.username = interaction.user.username;

    // Generate rank card with new customization
    const rankCard = await rankCardService.generateRankCard(rankData, customization);

    if (!rankCard) {
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setDescription(locale.commands.xp.card.savedNoPreview);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(locale.commands.xp.card.savedTitle)
      .setDescription(locale.commands.xp.card.savedDescription)
      .addFields(
        {
          name: locale.commands.xp.card.backgroundColor,
          value: backgroundColor,
          inline: true,
        },
        {
          name: locale.commands.xp.card.progressBarColor,
          value: progressBarColor,
          inline: true,
        },
        {
          name: locale.commands.xp.card.textColor,
          value: textColor,
          inline: true,
        },
        {
          name: locale.commands.xp.card.accentColor,
          value: accentColor,
          inline: true,
        }
      );

    await interaction.editReply({ embeds: [embed], files: [rankCard] });
  } catch (error) {
    logger.error('Failed to handle XP card customization modal:', error);

    const embed = new EmbedBuilder().setColor(0xff0000).setDescription(locale.common.error);

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
