import { client } from '../index';
import { getDatabase } from '../database/connection';
import { triviaGames } from '../database/schema';
import { eq, and, lte } from 'drizzle-orm';
import { logger } from '../utils/logger';
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  ComponentType,
} from 'discord.js';
import { xpService } from './xpService';
import { economyService } from './economyService';
import { t } from '../i18n';

class TriviaService {
  public async checkScheduledGames() {
    try {
      const db = getDatabase();
      const now = new Date();

      const dueGames = await db
        .select()
        .from(triviaGames)
        .where(and(eq(triviaGames.status, 'scheduled'), lte(triviaGames.scheduledAt, now)));

      for (const game of dueGames) {
        await this.startGame(game.id);
      }
    } catch (error) {
      logger.error('Error checking scheduled trivia games:', error);
    }
  }

  public async startGame(gameId: string) {
    try {
      const db = getDatabase();
      const [game] = await db.select().from(triviaGames).where(eq(triviaGames.id, gameId));

      if (!game) return;

      // Ensure this shard is responsible for this guild
      if (!client.guilds.cache.has(game.guildId)) return;

      // Mark as active
      await db.update(triviaGames).set({ status: 'active' }).where(eq(triviaGames.id, gameId));

      const channel = (await client.channels
        .fetch(game.channelId)
        .catch(() => null)) as TextChannel;
      if (!channel || !channel.isTextBased()) {
        await db.update(triviaGames).set({ status: 'cancelled' }).where(eq(triviaGames.id, gameId));
        return;
      }

      const questions = game.questions as Array<{
        question: string;
        options: string[];
        correctIndex: number;
      }>;
      if (!questions || questions.length === 0) {
        await db.update(triviaGames).set({ status: 'cancelled' }).where(eq(triviaGames.id, gameId));
        return;
      }

      const scores: Record<string, number> = {};

      const askQuestion = async (qIndex: number) => {
        if (qIndex >= questions.length) {
          let topWinnerId: string | null = null;
          let maxScore = 0;
          for (const [uid, score] of Object.entries(scores)) {
            if (score > maxScore) {
              maxScore = score;
              topWinnerId = uid;
            }
          }
          await db
            .update(triviaGames)
            .set({
              status: 'completed',
              winnerId: topWinnerId,
            })
            .where(eq(triviaGames.id, gameId));

          const overEmbed = new EmbedBuilder().setTitle('🧠 Trivia Game Over!').setColor(0x9333ea);
          if (topWinnerId) {
            overEmbed.setDescription(
              `The overall winner is <@${topWinnerId}> with ${maxScore} correct answer(s)!\nThey received all the rewards accumulated!`
            );
            // Reward user for overall win (e.g. multiplied by maxScore if desired, but we'll just give base rewards or total rewards)
            const totalXp = game.rewardXp * maxScore;
            const totalCoins = game.rewardCoins * maxScore;
            const guildMember = await channel.guild.members.fetch(topWinnerId).catch(() => null);
            if (guildMember) {
              if (totalXp > 0) {
                await xpService.addXP(
                  topWinnerId,
                  game.guildId,
                  guildMember as any,
                  totalXp,
                  channel.id
                );
              }
              if (totalCoins > 0) {
                await economyService.addMoney(
                  topWinnerId,
                  game.guildId,
                  totalCoins,
                  'wallet',
                  'Trivia Win'
                );
              }
            }
          } else {
            overEmbed.setDescription('Nobody scored any points!');
          }
          await channel.send({ embeds: [overEmbed] });
          return;
        }

        const q = questions[qIndex];

        const embed = new EmbedBuilder()
          .setTitle(`🧠 Trivia Time! (Question ${qIndex + 1} of ${questions.length})`)
          .setDescription(`**${q.question}**\n\nYou have 30 seconds to answer!`)
          .setColor(0x9333ea)
          .addFields({
            name: 'Rewards Per Question',
            value: `⭐ ${game.rewardXp} XP | 💰 ${game.rewardCoins} Coins`,
          });

        const row = new ActionRowBuilder<ButtonBuilder>();
        q.options.forEach((opt, idx) => {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`trivia_${game.id}_${qIndex}_${idx}`)
              .setLabel(opt)
              .setStyle(ButtonStyle.Primary)
          );
        });

        const message = await channel.send({ embeds: [embed], components: [row] });

        const collector = message.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 30000,
          filter: i => i.customId.startsWith(`trivia_${game.id}_${qIndex}`),
        });

        let winnerId: string | null = null;

        collector.on('collect', async i => {
          if (winnerId) {
            await i.reply({ content: 'Someone already answered correctly!', ephemeral: true });
            return;
          }

          const answerIdx = parseInt(i.customId.split('_')[3]);
          if (answerIdx === q.correctIndex) {
            winnerId = i.user.id;
            scores[winnerId] = (scores[winnerId] || 0) + 1;

            await i.reply({ content: `🎉 Correct! You scored a point!` });
            collector.stop('winner');
          } else {
            await i.reply({ content: '❌ Incorrect answer!', ephemeral: true });
          }
        });

        collector.on('end', async (collected, reason) => {
          const disabledRow = new ActionRowBuilder<ButtonBuilder>();
          q.options.forEach((opt, idx) => {
            disabledRow.addComponents(
              new ButtonBuilder()
                .setCustomId(`trivia_${game.id}_${qIndex}_${idx}_disabled`)
                .setLabel(opt)
                .setStyle(
                  winnerId !== null && idx === q.correctIndex
                    ? ButtonStyle.Success
                    : ButtonStyle.Secondary
                )
                .setDisabled(true)
            );
          });

          const endEmbed = new EmbedBuilder()
            .setTitle(`🧠 Trivia (Question ${qIndex + 1}) Ended`)
            .setDescription(
              `**${q.question}**\n\nThe correct answer was: **${q.options[q.correctIndex]}**`
            )
            .setColor(winnerId ? 0x22c55e : 0xef4444);

          if (winnerId) {
            endEmbed.addFields({ name: 'Winner', value: `<@${winnerId}>` });
          } else {
            endEmbed.addFields({ name: 'Result', value: 'Nobody answered correctly in time!' });
          }

          await message.edit({ embeds: [endEmbed], components: [disabledRow] });

          setTimeout(() => askQuestion(qIndex + 1), 3000);
        });
      };

      await askQuestion(0);
    } catch (error) {
      logger.error(`Error starting trivia game ${gameId}:`, error);
    }
  }
}

export const triviaService = new TriviaService();
