import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from 'discord.js';
import { Command, CommandCategory } from '../../types/command';
import { t, getGuildLocale } from '../../i18n';
import { HelpService } from '../../services/helpService';
import { logger } from '../../utils/logger';
import {
  createLocalizationMap,
  subcommandDescriptions,
  optionDescriptions,
} from '../../utils/localization';

const helpService = new HelpService();

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription(t('commands.utils.subcommands.help.description', { defaultValue: 'Get help for commands' }))
  .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.utils.help))
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
  const locale = interaction.guildId ? getGuildLocale(interaction.guildId) : 'en';

  try {
    const commandName = interaction.options.getString('command');

    if (commandName) {
      const commandHelp = await helpService.getCommandHelp(commandName, locale);

      if (!commandHelp) {
        await interaction.reply({
          content: t('commands.utils.help.commandNotFound', { lng: locale }),
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
