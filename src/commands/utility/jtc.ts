import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t } from '../../i18n';
import { jtcService } from '../../services/jtcService';
import { jtcRepository } from '../../repositories/jtcRepository';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('jtc')
  .setDescription(t('commands.jtc.description'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('setup')
      .setDescription(t('commands.jtc.setup.description'))
      .addChannelOption((option) =>
        option
          .setName('base_voice')
          .setDescription(t('commands.jtc.setup.baseVoice'))
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(true)
      )
      .addChannelOption((option) =>
        option
          .setName('category')
          .setDescription(t('commands.jtc.setup.category'))
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true)
      )
      .addChannelOption((option) =>
        option
          .setName('panel_channel')
          .setDescription(t('commands.jtc.setup.panelChannel'))
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('name_format')
          .setDescription(t('commands.jtc.setup.nameFormat'))
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('disable')
      .setDescription(t('commands.jtc.disable.description'))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('panel')
      .setDescription(t('commands.jtc.panel.description'))
  );

export const category = CommandCategory.Utility;
export const cooldown = 5;

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: t('common.guildOnly'), flags: MessageFlags.Ephemeral });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  try {
    if (subcommand === 'setup') {
      const baseVoice = interaction.options.getChannel('base_voice', true);
      const categoryChannel = interaction.options.getChannel('category', true);
      const panelChannel = interaction.options.getChannel('panel_channel', true);
      const nameFormat = interaction.options.getString('name_format') ?? undefined;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await jtcService.setupJTC(
        interaction.guild,
        baseVoice.id,
        categoryChannel.id,
        panelChannel.id,
        nameFormat
      );
      await interaction.editReply({ content: t('jtc.success.setup') });
    } else if (subcommand === 'disable') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await jtcRepository.deleteConfig(interaction.guild.id);
      await interaction.editReply({ content: t('jtc.success.disabled') });
    } else if (subcommand === 'panel') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await jtcService.sendOrUpdatePanel(interaction.guild);
      await interaction.editReply({ content: t('jtc.success.panelUpdated') });
    }
  } catch (error) {
    logger.error(`Error executing /jtc ${subcommand}:`, error);
    if (interaction.deferred) {
      await interaction.editReply({ content: t('common.error') });
    } else {
      await interaction.reply({ content: t('common.error'), flags: MessageFlags.Ephemeral });
    }
  }
}
