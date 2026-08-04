import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import ms from 'ms';
import { reminderService } from '../../services/reminderService';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('remind')
  .setDescription('Set a reminder')
  .addStringOption(option =>
    option
      .setName('time')
      .setDescription('When to remind you (e.g., 10m, 1h, 1d)')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('What to remind you about')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const timeStr = interaction.options.getString('time', true);
  const message = interaction.options.getString('message', true);

  const durationMs = ms(timeStr);
  if (!durationMs || durationMs < 1000) {
    await interaction.reply({
      content: 'Invalid time format. Please use something like `10m`, `1h`, or `1d`.',
      ephemeral: true,
    });
    return;
  }

  const fireAt = new Date(Date.now() + durationMs);

  try {
    await reminderService.createReminder(
      interaction.user.id,
      interaction.guildId,
      interaction.channelId,
      message,
      fireAt
    );

    const embed = new EmbedBuilder()
      .setTitle('⏰ Reminder Set')
      .setDescription(`I will remind you about **"${message}"** in ${ms(durationMs, { long: true })}.`)
      .setColor('#2ecc71')
      .setTimestamp(fireAt);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    logger.error('Failed to create reminder:', error);
    await interaction.reply({
      content: 'Failed to set reminder. Please try again later.',
      ephemeral: true,
    });
  }
}
