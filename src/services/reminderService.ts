import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { getDatabase } from '../database/connection';
import { reminders } from '../database/schema';
import { eq, lt, and } from 'drizzle-orm';
import { logger } from '../utils/logger';

export class ReminderService {
  private timer: NodeJS.Timeout | null = null;
  private client: Client | null = null;

  public init(client: Client) {
    this.client = client;
    // Check every minute
    this.timer = setInterval(() => this.checkReminders(), 60 * 1000);
    // Check immediately on startup
    void this.checkReminders();
  }

  public async checkReminders() {
    if (!this.client) return;

    try {
      const db = getDatabase();
      const now = new Date();

      const pendingReminders = await db
        .select()
        .from(reminders)
        .where(and(eq(reminders.completed, false), lt(reminders.fireAt, now)));

      for (const reminder of pendingReminders) {
        try {
          if (reminder.guildId && !this.client.guilds.cache.has(reminder.guildId)) continue;

          const channel = await this.client.channels.fetch(reminder.channelId).catch(() => null);
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('⏰ Reminder')
              .setDescription(reminder.message)
              .setColor('#3498db')
              .setTimestamp(reminder.createdAt);

            await (channel as TextChannel).send({
              content: `<@${reminder.userId}>, here is your reminder!`,
              embeds: [embed],
            });
          }

          // Mark as completed
          await db.update(reminders).set({ completed: true }).where(eq(reminders.id, reminder.id));
        } catch (err) {
          logger.error(`Failed to process reminder ${reminder.id}:`, err);
        }
      }
    } catch (err) {
      logger.error('Failed to check reminders:', err);
    }
  }

  public async createReminder(
    userId: string,
    guildId: string | null,
    channelId: string,
    message: string,
    fireAt: Date
  ) {
    const db = getDatabase();
    await db.insert(reminders).values({
      userId,
      guildId,
      channelId,
      message,
      fireAt,
    });
  }

  public destroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}

export const reminderService = new ReminderService();
