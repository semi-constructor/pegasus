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
  ComponentType 
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
        .where(
          and(
            eq(triviaGames.status, 'scheduled'),
            lte(triviaGames.scheduledAt, now)
          )
        );

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
      const [game] = await db
        .select()
        .from(triviaGames)
        .where(eq(triviaGames.id, gameId));

      if (!game) return;

      // Mark as active
      await db
        .update(triviaGames)
        .set({ status: 'active' })
        .where(eq(triviaGames.id, gameId));

      const channel = await client.channels.fetch(game.channelId).catch(() => null) as TextChannel;
      if (!channel || !channel.isTextBased()) {
        await db.update(triviaGames).set({ status: 'cancelled' }).where(eq(triviaGames.id, gameId));
        return;
      }

      // Handle the first question (assuming 1 question for simplicity in this implementation)
      const questions = game.questions as Array<{ question: string; options: string[]; correctIndex: number }>;
      if (!questions || questions.length === 0) return;
      
      const q = questions[0];

      const embed = new EmbedBuilder()
        .setTitle('🧠 Trivia Time!')
        .setDescription(`**${q.question}**\n\nYou have 30 seconds to answer!`)
        .setColor(0x9333ea)
        .addFields(
          { name: 'Rewards', value: `⭐ ${game.rewardXp} XP | 💰 ${game.rewardCoins} Coins` }
        );

      const row = new ActionRowBuilder<ButtonBuilder>();
      q.options.forEach((opt, idx) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`trivia_${game.id}_${idx}`)
            .setLabel(opt)
            .setStyle(ButtonStyle.Primary)
        );
      });

      const message = await channel.send({ embeds: [embed], components: [row] });

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000,
        filter: i => i.customId.startsWith(`trivia_${game.id}`)
      });

      let winnerId: string | null = null;

      collector.on('collect', async i => {
        if (winnerId) {
          await i.reply({ content: 'Someone already answered correctly!', ephemeral: true });
          return;
        }

        const answerIdx = parseInt(i.customId.split('_')[2]);
        if (answerIdx === q.correctIndex) {
          winnerId = i.user.id;
          
          // Reward user
          if (game.rewardXp > 0) {
            await xpService.addXP(i.user.id, game.guildId, i.member as any, game.rewardXp, channel.id);
          }
          if (game.rewardCoins > 0) {
            await economyService.addMoney(i.user.id, game.guildId, game.rewardCoins, 'wallet', 'Trivia Win');
          }

          await i.reply({ content: `🎉 Correct! You won the trivia and received your rewards!` });
          collector.stop('winner');
        } else {
          await i.reply({ content: '❌ Incorrect answer!', ephemeral: true });
        }
      });

      collector.on('end', async (collected, reason) => {
        // Update game status
        await db
          .update(triviaGames)
          .set({ 
            status: 'completed',
            winnerId: winnerId
          })
          .where(eq(triviaGames.id, gameId));

        // Disable buttons
        const disabledRow = new ActionRowBuilder<ButtonBuilder>();
        q.options.forEach((opt, idx) => {
          disabledRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`trivia_${game.id}_${idx}_disabled`)
              .setLabel(opt)
              .setStyle(winnerId !== null && idx === q.correctIndex ? ButtonStyle.Success : ButtonStyle.Secondary)
              .setDisabled(true)
          );
        });

        const endEmbed = new EmbedBuilder()
          .setTitle('🧠 Trivia Ended')
          .setDescription(`**${q.question}**\n\nThe correct answer was: **${q.options[q.correctIndex]}**`)
          .setColor(winnerId ? 0x22c55e : 0xef4444);

        if (winnerId) {
          endEmbed.addFields({ name: 'Winner', value: `<@${winnerId}>` });
        } else {
          endEmbed.addFields({ name: 'Result', value: 'Nobody answered correctly in time!' });
        }

        await message.edit({ embeds: [endEmbed], components: [disabledRow] });
      });

    } catch (error) {
      logger.error(`Error starting trivia game ${gameId}:`, error);
    }
  }
}

export const triviaService = new TriviaService();
