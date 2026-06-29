import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  TextChannel,
} from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t } from '../../i18n';
import { engagementService } from '../../services/engagementService';

export const data = new SlashCommandBuilder()
  .setName('thanks')
  .setDescription('Give thanks and reputation to another user')
  .addUserOption(option =>
    option.setName('user').setDescription('The user to thank').setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason').setDescription('Reason for thanking them')
  );

export const category = CommandCategory.XP;
export const cooldown = 10;

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: t('common.guildOnly'), ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';

  if (targetUser.id === interaction.user.id) {
    await interaction.reply({ content: 'You cannot thank yourself!', ephemeral: true });
    return;
  }

  if (targetUser.bot) {
    await interaction.reply({ content: 'You cannot thank a bot!', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: false });

  const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) {
    await interaction.editReply({ content: 'User not found in this server.' });
    return;
  }

  try {
    await engagementService.giveThanks(
      interaction.guildId!,
      targetUser.id,
      interaction.user.id,
      targetMember as GuildMember,
      reason,
      interaction.channel as TextChannel
    );

    await interaction.editReply({
      content: `💖 <@${interaction.user.id}> gave thanks to <@${targetUser.id}>! Reason: ${reason}`,
    });
  } catch (error: any) {
    await interaction.editReply({ content: t('common.error') + ': ' + error.message });
  }
}
