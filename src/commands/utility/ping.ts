import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t, getGuildLocale } from '../../i18n';
import { createLocalizationMap, commandNames, commandDescriptions } from '../../utils/localization';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription(t('commands.ping.description', { defaultValue: 'Check bot latency' }))
  .setNameLocalizations(createLocalizationMap(commandNames.ping))
  .setDescriptionLocalizations(createLocalizationMap(commandDescriptions.ping));

export const category = CommandCategory.Utility;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  const sent = await interaction.deferReply({ fetchReply: true });
  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  const apiLatency = Math.round(interaction.client.ws.ping);
  const locale = getGuildLocale(interaction.guildId ?? '');

  await interaction.editReply(
    t('commands.ping.response', {
      lng: locale,
      latency,
      apiLatency,
      defaultValue: `Pong! Latency: ${latency}ms. API Latency: ${apiLatency}ms.`,
    })
  );
}
