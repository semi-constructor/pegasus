import {
  Events,
  BaseInteraction,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  RoleSelectMenuInteraction,
} from 'discord.js';
import { logger } from '../utils/logger';
import { resolveLocale, t, withLocale } from '../i18n';
import type { Command } from '../types/command';
import { handleWarningActionButtons } from '../interactions/buttons/warningActions';
import { handleWarningModals } from '../interactions/modals/warningModals';
import { handleConfigButton } from '../interactions/buttons/configButtons';
import { handleConfigModal } from '../interactions/modals/configModals';
import { handleConfigSelectMenu } from '../interactions/selectMenus/configSelectMenus';
import { handleTicketButton } from '../interactions/buttons/ticketButtons';
import { handleTicketModal } from '../interactions/modals/ticketModals';
import { handleXPButtons } from '../interactions/buttons/xpButtons';
import { handleXPModals } from '../interactions/modals/xpModals';
import { handleGiveawayModals } from '../interactions/modals/giveawayModals';
import { handleGiveawayButtons } from '../interactions/buttons/giveawayButtons';
import { handleWordFilterActionButtons } from '../interactions/buttons/wordFilterActions';
import { securityMiddleware } from '../security/middleware';
import { SecurityErrorHandler } from '../security/errors';
import { handleJTCButtons } from '../interactions/buttons/jtcButtons';
import { handleJTCModals } from '../interactions/modals/jtcModals';
import { handleJTCSelectMenus } from '../interactions/selectMenus/jtcSelectMenus';
import { ticketWorkflowService } from '../services/ticketWorkflowService';

export const name = Events.InteractionCreate;

export async function execute(interaction: BaseInteraction) {
  try {
    const locale = await resolveLocale(interaction.user?.id, interaction.guildId);

    await withLocale(locale, async () => {
      if (interaction.isChatInputCommand()) {
        await handleCommand(interaction);
      } else if (interaction.isAutocomplete()) {
        await handleAutocomplete(interaction);
      } else if (interaction.isButton()) {
        await handleButton(interaction);
      } else if (interaction.isModalSubmit()) {
        await handleModal(interaction);
      } else if (
        interaction.isStringSelectMenu() ||
        interaction.isChannelSelectMenu() ||
        interaction.isRoleSelectMenu()
      ) {
        await handleSelectMenu(interaction);
      }
    });
  } catch (error) {
    logger.error('Error in interaction handler:', error);
  }
}

async function handleCommand(interaction: ChatInputCommandInteraction) {
  logger.info(`Command received: ${interaction.commandName} from user ${interaction.user.tag}`);

  const command = interaction.client.commands.get(interaction.commandName) as Command;

  if (!command) {
    logger.error(`No command matching ${interaction.commandName} was found.`);
    await interaction.reply({ content: t('commands.help.commandNotFound'), ephemeral: true });
    return;
  }

  if (command.preDefer) {
    await preDeferInteraction(interaction, command.preDefer.ephemeral ?? false);
  }

  try {
    logger.info(`Executing security checks for command: ${interaction.commandName}`);

    // Apply security middleware
    const securityCheck = await securityMiddleware(interaction, command);
    if (!securityCheck.passed) {
      logger.warn(
        `Security check failed for command ${interaction.commandName}: ${securityCheck.error}`
      );
      await sendSecurityFailureResponse(interaction, securityCheck.error);
      return;
    }

    logger.info(`Security checks passed, executing command: ${interaction.commandName}`);
    // Execute the command
    await command.execute(interaction);
    logger.info(`Command ${interaction.commandName} executed successfully`);
  } catch (error) {
    logger.error(`Error executing command ${interaction.commandName}:`, error);

    // Handle security errors specially
    const errorResponse = SecurityErrorHandler.handle(error as Error);

    // Send error response based on interaction state
    try {
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({
          content: errorResponse.message,
          embeds: errorResponse.embed ? [errorResponse.embed] : undefined,
        });
      } else if (interaction.replied) {
        await interaction.followUp({
          content: errorResponse.message,
          embeds: errorResponse.embed ? [errorResponse.embed] : undefined,
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: errorResponse.message,
          embeds: errorResponse.embed ? [errorResponse.embed] : undefined,
          ephemeral: true,
        });
      }
    } catch (replyError) {
      logger.error('Failed to send error response:', replyError);
    }
  }
}

async function preDeferInteraction(
  interaction: ChatInputCommandInteraction,
  ephemeral: boolean
) {
  if (interaction.deferred || interaction.replied) {
    return;
  }

  try {
    await interaction.deferReply({ ephemeral });
  } catch (error) {
    logger.warn('Failed to defer interaction before security checks:', error);
  }
}

async function sendSecurityFailureResponse(
  interaction: ChatInputCommandInteraction,
  message?: string
) {
  const content = message || t('common.noPermission');

  if (interaction.deferred && !interaction.replied) {
    try {
      await interaction.deleteReply();
    } catch {
      // ignore if already deleted
    }
    await interaction.followUp({ content, ephemeral: true });
    return;
  }

  if (interaction.replied) {
    await interaction.followUp({ content, ephemeral: true });
    return;
  }

  await interaction.reply({ content, ephemeral: true });
}

async function handleAutocomplete(interaction: AutocompleteInteraction) {
  const command = interaction.client.commands.get(interaction.commandName) as Command;

  if (!command || !command.autocomplete) {
    return;
  }

  try {
    await command.autocomplete(interaction);
  } catch (error) {
    logger.error(`Error handling autocomplete for ${interaction.commandName}:`, error);
  }
}

async function handleButton(interaction: ButtonInteraction) {
  try {
    // Check if interaction is still valid (not timed out)
    if (!interaction.isRepliable()) {
      return; // Interaction has expired, silently fail
    }

    // Handle warning action buttons
    if (
      interaction.customId.startsWith('warn_action:') ||
      interaction.customId.startsWith('warn_view:') ||
      interaction.customId.startsWith('warn_automation_modal:')
    ) {
      await handleWarningActionButtons(interaction);
      return;
    }

    // Handle config buttons
    if (interaction.customId.startsWith('config_')) {
      await handleConfigButton(interaction);
      return;
    }

    if (interaction.customId.startsWith('filter_action|')) {
      await handleWordFilterActionButtons(interaction);
      return;
    }

    // Handle ticket rate buttons
    if (interaction.customId.startsWith('ticket_rate:')) {
      const parts = interaction.customId.split(':');
      const ticketId = parts[1];
      const rating = parseInt(parts[2], 10);
      await ticketWorkflowService.handleTicketRating(interaction, ticketId, rating);
      return;
    }

    // Handle ticket buttons
    if (interaction.customId.startsWith('ticket_')) {
      await handleTicketButton(interaction);
      return;
    }

    // Handle XP buttons
    if (interaction.customId.startsWith('xp_')) {
      await handleXPButtons(interaction);
      return;
    }

    // Handle giveaway buttons
    if (
      interaction.customId.startsWith('gw_enter:') ||
      interaction.customId.startsWith('gw_leave:') ||
      interaction.customId.startsWith('gw_info:')
    ) {
      await handleGiveawayButtons(interaction);
      return;
    }

    if (interaction.customId.startsWith('jtc_')) {
      await handleJTCButtons(interaction);
      return;
    }

    // Add other button handlers here as needed
  } catch (error) {
    logger.error(`Error handling button ${interaction.customId}:`, error);

    // Only attempt to reply if interaction is still repliable
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: t('common.error'),
          ephemeral: true,
        });
      } catch (replyError) {
        logger.error('Failed to reply to button interaction:', replyError);
      }
    }
  }
}

async function handleModal(interaction: ModalSubmitInteraction) {
  try {
    // Check if interaction is still valid (not timed out)
    if (!interaction.isRepliable()) {
      return; // Interaction has expired, silently fail
    }

    // Handle warning modals
    if (
      interaction.customId.startsWith('warn_edit:') ||
      interaction.customId.startsWith('warn_automation_create')
    ) {
      await handleWarningModals(interaction);
      return;
    }

    // Handle config modals
    if (interaction.customId.startsWith('config_')) {
      await handleConfigModal(interaction);
      return;
    }

    // Handle ticket department modal submit
    if (interaction.customId.startsWith('ticket_modal_dept:')) {
      const parts = interaction.customId.split(':');
      const panelDbId = parts[1];
      const departmentId = parts[2];
      const reason = interaction.fields.getTextInputValue('reason');
      await ticketWorkflowService.createDepartmentTicket(interaction, panelDbId, departmentId, reason);
      return;
    }

    // Handle ticket modals
    if (interaction.customId.startsWith('ticket_')) {
      await handleTicketModal(interaction);
      return;
    }

    // Handle XP modals
    if (interaction.customId === 'xp_card_customization') {
      await handleXPModals(interaction);
      return;
    }

    // Handle giveaway modals
    if (interaction.customId.startsWith('gw_')) {
      await handleGiveawayModals(interaction);
      return;
    }

    if (interaction.customId.startsWith('jtc_')) {
      await handleJTCModals(interaction);
      return;
    }

    // Add other modal handlers here as needed
  } catch (error) {
    logger.error(`Error handling modal ${interaction.customId}:`, error);

    // Only attempt to reply if interaction is still repliable
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: t('common.error'),
          ephemeral: true,
        });
      } catch (replyError) {
        logger.error('Failed to reply to modal interaction:', replyError);
      }
    }
  }
}

async function handleSelectMenu(
  interaction:
    | StringSelectMenuInteraction
    | ChannelSelectMenuInteraction
    | RoleSelectMenuInteraction
) {
  try {
    // Handle config select menus
    if (interaction.customId.startsWith('config_')) {
      await handleConfigSelectMenu(interaction);
      return;
    }

    // Handle ticket department select menu
    if (interaction.customId.startsWith('ticket_dept_select:')) {
      if (interaction.isStringSelectMenu()) {
        const parts = interaction.customId.split(':');
        const panelDbId = parts[1];
        const departmentId = interaction.values[0];
        await ticketWorkflowService.handleDepartmentSelect(interaction, panelDbId, departmentId);
      }
      return;
    }

    if (interaction.customId.startsWith('jtc_')) {
      if (interaction.isStringSelectMenu()) {
        await handleJTCSelectMenus(interaction);
      }
      return;
    }

    // Add other select menu handlers here as needed
  } catch (error) {
    logger.error(`Error handling select menu ${interaction.customId}:`, error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: t('common.error'),
        ephemeral: true,
      });
    }
  }
}

