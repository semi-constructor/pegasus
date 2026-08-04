import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from 'discord.js';
import { CommandCategory } from '../../types/command';
import { starboardService } from '../../services/starboardService';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('starboard')
  .setDescription('Configure the starboard system')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('setup')
      .setDescription('Enable and setup starboard channel')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('The starboard channel')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('disable').setDescription('Disable starboard')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('threshold')
      .setDescription('Set the number of stars required')
      .addIntegerOption(option =>
        option
          .setName('count')
          .setDescription('Number of stars')
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('emoji')
      .setDescription('Set the starboard emoji')
      .addStringOption(option =>
        option
          .setName('emoji')
          .setDescription('Emoji to use (e.g., ⭐)')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('info').setDescription('View current starboard settings')
  );

export const category = CommandCategory.Admin;
export const cooldown = 3;
export const permissions = [PermissionFlagsBits.ManageGuild];

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  await interaction.deferReply({ ephemeral: true });

  try {
    if (subcommand === 'setup') {
      const channel = interaction.options.getChannel('channel', true);
      await starboardService.enable(interaction.guild.id, channel.id);
      await interaction.editReply(`Starboard enabled and channel set to <#${channel.id}>.`);
    } else if (subcommand === 'disable') {
      await starboardService.disable(interaction.guild.id);
      await interaction.editReply('Starboard has been disabled.');
    } else if (subcommand === 'threshold') {
      const count = interaction.options.getInteger('count', true);
      await starboardService.updateThreshold(interaction.guild.id, count);
      await interaction.editReply(`Starboard threshold updated to **${count}**.`);
    } else if (subcommand === 'emoji') {
      const emoji = interaction.options.getString('emoji', true);
      await starboardService.updateEmoji(interaction.guild.id, emoji);
      await interaction.editReply(`Starboard emoji updated to ${emoji}.`);
    } else if (subcommand === 'info') {
      const settings = await starboardService.getSettings(interaction.guild.id);
      if (!settings) {
        await interaction.editReply('Starboard is not configured for this server.');
        return;
      }
      
      const embed = new EmbedBuilder()
        .setColor(0xFFAC33)
        .setTitle('Starboard Configuration')
        .addFields(
          { name: 'Status', value: settings.enabled ? 'Enabled' : 'Disabled', inline: true },
          { name: 'Channel', value: settings.channelId ? `<#${settings.channelId}>` : 'None', inline: true },
          { name: 'Threshold', value: settings.threshold.toString(), inline: true },
          { name: 'Emoji', value: settings.emoji, inline: true }
        );
        
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    
    return;
  } catch (error) {
    logger.error('Error in starboard command:', error);
    await interaction.editReply('An error occurred while executing this command.');
    return;
  }
}
