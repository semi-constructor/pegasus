import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t } from '../../i18n';
import { engagementRepository } from '../../repositories/engagementRepository';

export const data = new SlashCommandBuilder()
  .setName('achievements')
  .setDescription('View your unlocked and available achievements');

export const category = CommandCategory.XP;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: t('common.guildOnly'), ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: false });

  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  const allAchievements = await engagementRepository.listAchievements(guildId);
  const userUnlocked = await engagementRepository.getUserAchievements(guildId, userId);
  const unlockedIds = new Set(userUnlocked.map(a => a.achievementId));

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🏆 Achievements for ${interaction.user.username}`)
    .setThumbnail(interaction.user.displayAvatarURL());

  if (allAchievements.length === 0) {
    embed.setDescription('No achievements have been configured for this server yet.');
  } else {
    const list = allAchievements.map(a => {
      const isUnlocked = unlockedIds.has(a.id);
      const emoji = isUnlocked ? '✅' : '🔒';
      return `${emoji} **${a.title}**\n  ${a.description}\n  Rewards: ${a.rewardXp} XP | ${a.rewardCoins} Coins`;
    });

    embed.setDescription(list.join('\n\n'));
  }

  await interaction.editReply({ embeds: [embed] });
}
