import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t } from '../../i18n';
import { engagementService } from '../../services/engagementService';

export const data = new SlashCommandBuilder()
  .setName('prestige')
  .setDescription('Trade in your max level for a prestige rank and exclusive rewards');

export const category = CommandCategory.XP;
export const cooldown = 10;

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: t('common.guildOnly'), ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: false });

  try {
    const result = await engagementService.prestigeUser(
      interaction.user.id,
      interaction.guildId!,
      interaction.member as GuildMember
    );

    await interaction.editReply({ content: result.message });
  } catch (error: any) {
    await interaction.editReply({ content: t('common.error') + ': ' + error.message });
  }
}
