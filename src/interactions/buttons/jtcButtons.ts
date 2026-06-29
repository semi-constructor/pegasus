import { ButtonInteraction } from 'discord.js';
import { jtcService } from '../../services/jtcService';
import { logger } from '../../utils/logger';

export async function handleJTCButtons(interaction: ButtonInteraction) {
  try {
    switch (interaction.customId) {
      case 'jtc_lock':
        await jtcService.handleLock(interaction);
        break;
      case 'jtc_unlock':
        await jtcService.handleUnlock(interaction);
        break;
      case 'jtc_rename':
        await jtcService.handleRenameModal(interaction);
        break;
      case 'jtc_claim':
        await jtcService.handleClaim(interaction);
        break;
      default:
        break;
    }
  } catch (error) {
    logger.error(`Error handling JTC button ${interaction.customId}:`, error);
  }
}
