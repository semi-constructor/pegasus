import { StringSelectMenuInteraction } from 'discord.js';
import { jtcService } from '../../services/jtcService';
import { logger } from '../../utils/logger';

export async function handleJTCSelectMenus(interaction: StringSelectMenuInteraction) {
  try {
    if (interaction.customId === 'jtc_limit') {
      await jtcService.handleUserLimit(interaction);
    }
  } catch (error) {
    logger.error(`Error handling JTC select menu ${interaction.customId}:`, error);
  }
}
