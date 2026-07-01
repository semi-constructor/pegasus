import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t } from '../../i18n';
import { engagementRepository } from '../../repositories/engagementRepository';

export const data = new SlashCommandBuilder()
  .setName('quests')
  .setDescription('View active engagement quests and your progress');

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

  const activeQuests = await engagementRepository.getActiveQuests(guildId);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📜 Active Quests for ${interaction.user.username}`)
    .setThumbnail(interaction.user.displayAvatarURL());

  if (activeQuests.length === 0) {
    embed.setDescription('No active quests available at the moment. Check back later!');
  } else {
    const list: string[] = [];
    for (const q of activeQuests) {
      const progressObj = await engagementRepository.getUserQuestProgress(guildId, userId, q.id);
      const current = progressObj?.progress || 0;
      const isCompleted = progressObj?.completed || false;
      const status = isCompleted ? '✅ Completed' : `⏳ Progress: ${current} / ${q.targetValue}`;

      list.push(
        `**${q.title}** (${status})\n  ${q.description}\n  Rewards: ${q.rewardXp} XP | ${q.rewardCoins} Coins`
      );
    }

    embed.setDescription(list.join('\n\n'));
  }

  await interaction.editReply({ embeds: [embed] });
}
