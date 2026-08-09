import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CommandCategory } from '../../types/command';
import { economyService } from '../../services/economyService';
import { economyRepository } from '../../repositories/economyRepository';
import { embedBuilder } from '../../handlers/embedBuilder';
import { logger } from '../../utils/logger';
import { t, getGuildLocale } from '../../i18n';
import { getDatabase } from '../../database/connection';
import { economyCooldowns } from '../../database/schema/economy';
import { and, eq } from 'drizzle-orm';

export const isSubcommand = false;

export const data = new SlashCommandBuilder()
  .setName('vote')
  .setDescription('Vote for Pegasus to get a 1.2x XP multiplier (24h) and 3000-6000 Coins!');

export const category = CommandCategory.Economy;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const guildId = interaction.guildId!;
  const locale = getGuildLocale(interaction.guildId!);

  try {
    const db = getDatabase();
    const [cooldownRecord] = await db
      .select()
      .from(economyCooldowns)
      .where(
        and(
          eq(economyCooldowns.userId, userId),
          eq(economyCooldowns.guildId, 'global'),
          eq(economyCooldowns.commandType, 'vote')
        )
      )
      .limit(1);

    if (cooldownRecord && cooldownRecord.nextAvailable.getTime() > Date.now()) {
      const timeLeft = cooldownRecord.nextAvailable.getTime() - Date.now();
      const hours = Math.floor(timeLeft / 1000 / 60 / 60);
      const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
      
      await interaction.editReply({
        embeds: [embedBuilder.createErrorEmbed(`You can vote again in ${hours}h ${minutes}m! Vote at: https://top.gg/bot/1375140177961418774`)],
      });
      return;
    }

    // Check Top.gg API if token is provided
    if (process.env.TOPGG_TOKEN) {
      try {
        const response = await fetch(`https://top.gg/api/bots/1375140177961418774/check?userId=${userId}`, {
          headers: {
            Authorization: process.env.TOPGG_TOKEN
          }
        });
        
        if (response.ok) {
          const data = (await response.json()) as { voted: number };
          if (data.voted === 0) {
            await interaction.editReply({
              embeds: [
                embedBuilder.createErrorEmbed(
                  "You haven't voted yet! Please [click here to vote on Top.gg](https://top.gg/bot/1375140177961418774), then run `/vote` again to claim your rewards!"
                )
              ]
            });
            return;
          }
        } else {
          logger.warn(`Top.gg API returned status ${response.status}`);
        }
      } catch (error) {
        logger.error('Failed to check Top.gg API:', error);
      }
    }

    // Random coins between 3000 and 6000
    const amount = Math.floor(Math.random() * (6000 - 3000 + 1) + 3000);
    
    // Add money
    const result = await economyService.addMoney(
      userId,
      guildId,
      amount,
      'vote',
      'Voted on Top.gg'
    );

    if (!result.success) {
      await interaction.editReply({
        embeds: [embedBuilder.createErrorEmbed(result.error || 'Failed to claim vote reward.')],
      });
      return;
    }

    // Set 12h cooldown
    const now = new Date();
    const nextAvailable = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours
    
    await db
      .insert(economyCooldowns)
      .values({
        userId,
        guildId: 'global',
        commandType: 'vote',
        lastUsed: now,
        nextAvailable,
        streakDays: 0,
      })
      .onConflictDoUpdate({
        target: [economyCooldowns.userId, economyCooldowns.guildId, economyCooldowns.commandType],
        set: {
          lastUsed: now,
          nextAvailable,
        },
      });

    const settings = await economyRepository.ensureSettings(guildId);

    const embed = new EmbedBuilder()
      .setTitle('Thank you for voting! ❤️')
      .setDescription(`You voted for Pegasus and received your rewards!\n\n**Rewards:**\n- 💰 ${settings.currencySymbol} **${amount.toLocaleString()}**\n- ✨ **1.2x XP Multiplier** for 24 hours globally!\n\n[Vote again in 12 hours!](https://top.gg/bot/1375140177961418774)`)
      .setColor(0x2ecc71)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in vote command:', error);
    await interaction.editReply({
      embeds: [embedBuilder.createErrorEmbed('Failed to claim vote reward. Please try again later.')],
    });
  }
}
