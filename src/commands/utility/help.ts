import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from 'discord.js';
import { Command, CommandCategory } from '../../types/command';
import { t, resolveLocale } from '../../i18n';
import { HelpService } from '../../services/helpService';
import { logger } from '../../utils/logger';
import {
  createLocalizationMap,
  optionDescriptions,
} from '../../utils/localization';

const helpService = new HelpService();

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription(
    t('commands.help.description', { defaultValue: 'Get help for commands' })
  )
  .addStringOption(option =>
    option
      .setName('command')
      .setDescription(
        t('commands.utils.subcommands.help.options.command', {
          defaultValue: 'The command to get help for',
        })
      )
      .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.command))
      .setRequired(false)
      .setAutocomplete(true)
  );

export const category = CommandCategory.Utility;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  // Wire the client into the HelpService on first use so it reads from
  // client.commands (loaded after i18n was initialized) rather than
  // re-importing command files when i18n is uninitialized.
  helpService.setClient(interaction.client);

  // Resolve locale: user preference first, then guild, then 'en'
  const locale = await resolveLocale(interaction.user.id, interaction.guildId);

  try {
    const commandName = interaction.options.getString('command');

    if (commandName) {
      const commandHelp = await helpService.getCommandHelp(commandName, locale);

      if (!commandHelp) {
        await interaction.reply({
          content: t('commands.help.commandNotFound', { lng: locale }),
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({ embeds: [commandHelp] });
    } else {
      const helpMenu = await helpService.getHelpMenu(locale);
      await interaction.reply({ embeds: [helpMenu] });
    }
  } catch (error) {
    logger.error('Error in help command:', error);
    const errorMessage = t('common.error', { lng: locale });

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  helpService.setClient(interaction.client);

  const focused = interaction.options.getFocused();

  const commands = await helpService.getCommandList();
  const filtered = commands
    .filter(cmd => cmd.toLowerCase().includes(focused.toLowerCase()))
    .slice(0, 25);

  await interaction.respond(filtered.map(cmd => ({ name: cmd, value: cmd })));
}

export default {
  data,
  category,
  cooldown,
  execute,
  autocomplete,
} as Command;
