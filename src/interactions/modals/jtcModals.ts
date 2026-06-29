import { ModalSubmitInteraction } from 'discord.js';
import { jtcService } from '../../services/jtcService';
import { logger } from '../../utils/logger';

export async function handleJTCModals(interaction: ModalSubmitInteraction) {
  try {
    if (interaction.customId === 'jtc_rename_modal') {
      await jtcService.handleRenameSubmit(interaction);
    }
  } catch (error) {
    logger.error(`Error handling JTC modal ${interaction.customId}:`, error);
  }
}
