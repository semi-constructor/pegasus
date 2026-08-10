import { interactionRegistry } from './InteractionRegistry';

// Buttons
import { handleWarningActionButtons } from '../interactions/buttons/warningActions';
import { handleConfigButton } from '../interactions/buttons/configButtons';
import { handleWordFilterActionButtons } from '../interactions/buttons/wordFilterActions';
import { handleTicketButton } from '../interactions/buttons/ticketButtons';
import { handleXPButtons } from '../interactions/buttons/xpButtons';
import { handleGiveawayButtons } from '../interactions/buttons/giveawayButtons';
import { handleJTCButtons } from '../interactions/buttons/jtcButtons';
import { handleRoleButtons } from '../interactions/buttons/roleButtons';
import { ticketWorkflowService } from '../services/ticketWorkflowService';

// Modals
import { handleWarningModals } from '../interactions/modals/warningModals';
import { handleConfigModal } from '../interactions/modals/configModals';
import { handleTicketModal } from '../interactions/modals/ticketModals';
import { handleXPModals } from '../interactions/modals/xpModals';
import { handleGiveawayModals } from '../interactions/modals/giveawayModals';
import { handleJTCModals } from '../interactions/modals/jtcModals';

// Select Menus
import { handleConfigSelectMenu } from '../interactions/selectMenus/configSelectMenus';
import { handleJTCSelectMenus } from '../interactions/selectMenus/jtcSelectMenus';

export async function registerAllInteractions() {
  // --- BUTTONS ---
  interactionRegistry.registerButton('warn_action:', handleWarningActionButtons);
  interactionRegistry.registerButton('warn_view:', handleWarningActionButtons);
  interactionRegistry.registerButton('warn_automation_modal:', handleWarningActionButtons);
  interactionRegistry.registerButton('config_', handleConfigButton);
  interactionRegistry.registerButton('filter_action|', handleWordFilterActionButtons);
  interactionRegistry.registerButton('ticket_', handleTicketButton);
  interactionRegistry.registerButton('xp_', handleXPButtons);
  interactionRegistry.registerButton('gw_enter:', handleGiveawayButtons);
  interactionRegistry.registerButton('gw_leave:', handleGiveawayButtons);
  interactionRegistry.registerButton('gw_info:', handleGiveawayButtons);
  interactionRegistry.registerButton('jtc_', handleJTCButtons);
  interactionRegistry.registerButton('role_toggle:', handleRoleButtons);
  
  interactionRegistry.registerButton('ticket_rate:', async (interaction) => {
    const parts = interaction.customId.split(':');
    const ticketId = parts[1];
    const rating = parseInt(parts[2], 10);
    await ticketWorkflowService.handleTicketRating(interaction, ticketId, rating);
  });
  
  // Dynamic import for trade buttons
  interactionRegistry.registerButton('trade_', async (interaction) => {
    const { handleTradeButtons } = await import('../interactions/buttons/tradeButtons');
    await handleTradeButtons(interaction);
  });

  // --- MODALS ---
  interactionRegistry.registerModal('warn_edit:', handleWarningModals);
  interactionRegistry.registerModal('warn_automation_create', handleWarningModals);
  interactionRegistry.registerModal('config_', handleConfigModal);
  interactionRegistry.registerModal('ticket_', handleTicketModal);
  interactionRegistry.registerModal('xp_card_customization', handleXPModals);
  interactionRegistry.registerModal('gw_', handleGiveawayModals);
  interactionRegistry.registerModal('jtc_', handleJTCModals);
  
  interactionRegistry.registerModal('ticket_modal_dept:', async (interaction) => {
    const parts = interaction.customId.split(':');
    const panelDbId = parts[1];
    const departmentId = parts[2];
    const reason = interaction.fields.getTextInputValue('reason');
    await ticketWorkflowService.createDepartmentTicket(interaction, panelDbId, departmentId, reason);
  });
  
  interactionRegistry.registerModal('trade_', async (interaction) => {
    const { handleTradeModal } = await import('../interactions/buttons/tradeButtons');
    await handleTradeModal(interaction);
  });

  // --- SELECT MENUS ---
  interactionRegistry.registerSelect('config_', handleConfigSelectMenu);
  interactionRegistry.registerSelect('jtc_', async (interaction) => {
    if (interaction.isStringSelectMenu()) {
      await handleJTCSelectMenus(interaction);
    }
  });
  
  interactionRegistry.registerSelect('ticket_dept_select:', async (interaction) => {
    if (interaction.isStringSelectMenu()) {
      const parts = interaction.customId.split(':');
      const panelDbId = parts[1];
      const departmentId = interaction.values[0];
      await ticketWorkflowService.handleDepartmentSelect(interaction, panelDbId, departmentId);
    }
  });
}
