import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { getDatabase } from '../database/connection';
import { socialFeeds, userBirthdays, birthdaySettings, triviaGames } from '../database/schema';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { triviaService } from './triviaService';
import { socialFeedService } from './socialFeedService';

export class CronService {
  private client: Client;
  private birthdayInterval: NodeJS.Timeout | null = null;
  private triviaInterval: NodeJS.Timeout | null = null;
  private feedsInterval: NodeJS.Timeout | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  public startAll() {
    this.checkBirthdays();
    this.birthdayInterval = setInterval(() => this.checkBirthdays(), 60 * 60 * 1000); // Check every hour

    this.checkTrivia();
    this.triviaInterval = setInterval(() => this.checkTrivia(), 5 * 60 * 1000); // Check every 5 minutes

    this.checkFeeds();
    this.feedsInterval = setInterval(() => this.checkFeeds(), 15 * 60 * 1000); // Check every 15 minutes

    logger.info('CronService started for Birthdays, Trivia, and Feeds');
  }

  public stopAll() {
    if (this.birthdayInterval) clearInterval(this.birthdayInterval);
    if (this.triviaInterval) clearInterval(this.triviaInterval);
    if (this.feedsInterval) clearInterval(this.feedsInterval);
  }

  private async checkBirthdays() {
    try {
      const today = new Date();
      // Only process at a specific hour (e.g. 12 UTC) to avoid spamming
      if (today.getUTCHours() !== 12) return;

      const day = today.getUTCDate();
      const month = today.getUTCMonth() + 1; // 1-indexed

      const db = getDatabase();
      const birthdays = await db
        .select()
        .from(userBirthdays)
        .innerJoin(birthdaySettings, eq(userBirthdays.guildId, birthdaySettings.guildId))
        .where(
          and(
            eq(birthdaySettings.enabled, true),
            eq(userBirthdays.day, day),
            eq(userBirthdays.month, month)
          )
        );

      for (const b of birthdays) {
        if (!b.birthday_settings.channelId) continue;

        const channel = (await this.client.channels
          .fetch(b.birthday_settings.channelId)
          .catch(() => null)) as TextChannel;
        if (!channel || !channel.isTextBased()) continue;

        const msg = b.birthday_settings.message.replace('{user}', `<@${b.user_birthdays.userId}>`);

        await channel
          .send({
            content: msg,
          })
          .catch(() => null);
      }
    } catch (error) {
      logger.error('Error in checkBirthdays cron:', error);
    }
  }

  private async checkTrivia() {
    await triviaService.checkScheduledGames();
  }

  private async checkFeeds() {
    await socialFeedService.checkFeeds(this.client);
  }
}
