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
import { interactionRegistry } from '../handlers/InteractionRegistry';
import { securityMiddleware } from '../security/middleware';
import { SecurityErrorHandler } from '../security/errors';

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

async function preDeferInteraction(interaction: ChatInputCommandInteraction, ephemeral: boolean) {
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
    if (!interaction.isRepliable()) return;
    const handled = await interactionRegistry.handleButton(interaction);
    if (!handled && !interaction.replied && !interaction.deferred) {
      logger.warn(`No handler found for button: ${interaction.customId}`);
      await interaction.reply({ content: t('common.error'), ephemeral: true });
    }
  } catch (error) {
    logger.error(`Error handling button ${interaction.customId}:`, error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: t('common.error'), ephemeral: true }).catch(() => {});
    }
  }
}

async function handleModal(interaction: ModalSubmitInteraction) {
  try {
    if (!interaction.isRepliable()) return;
    const handled = await interactionRegistry.handleModal(interaction);
    if (!handled && !interaction.replied && !interaction.deferred) {
      logger.warn(`No handler found for modal: ${interaction.customId}`);
      await interaction.reply({ content: t('common.error'), ephemeral: true });
    }
  } catch (error) {
    logger.error(`Error handling modal ${interaction.customId}:`, error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: t('common.error'), ephemeral: true }).catch(() => {});
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
    if (!interaction.isRepliable()) return;
    const handled = await interactionRegistry.handleSelectMenu(interaction);
    if (!handled && !interaction.replied && !interaction.deferred) {
      logger.warn(`No handler found for select menu: ${interaction.customId}`);
      await interaction.reply({ content: t('common.error'), ephemeral: true });
    }
  } catch (error) {
    logger.error(`Error handling select menu ${interaction.customId}:`, error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: t('common.error'), ephemeral: true }).catch(() => {});
    }
  }
}
