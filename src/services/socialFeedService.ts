import { getDatabase } from '../database/connection';
import { socialFeeds } from '../database/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { Client, TextChannel } from 'discord.js';
import Parser from 'rss-parser';

export class SocialFeedService {
  private parser = new Parser();

  public async checkFeeds(client: Client) {
    try {
      const db = getDatabase();
      const feeds = await db.select().from(socialFeeds).where(eq(socialFeeds.enabled, true));

      for (const feed of feeds) {
        try {
          const parsed = await this.parser.parseURL(feed.feedUrl);
          if (!parsed.items || parsed.items.length === 0) continue;

          // Check newest item
          const newestItem = parsed.items[0];

          if (
            newestItem.guid === feed.lastEntryId ||
            newestItem.id === feed.lastEntryId ||
            newestItem.link === feed.lastEntryId
          ) {
            continue; // Already posted
          }

          const channel = (await client.channels
            .fetch(feed.channelId)
            .catch(() => null)) as TextChannel;
          if (!channel || !channel.isTextBased()) continue;

          let messageContent =
            feed.customMessage || `New post from ${parsed.title || 'Feed'}: ${newestItem.link}`;
          if (feed.mentionRole) {
            messageContent = `<@&${feed.mentionRole}> ${messageContent}`;
          }

          await channel.send({ content: messageContent });

          // Update lastEntryId
          await db
            .update(socialFeeds)
            .set({ lastEntryId: newestItem.guid || newestItem.id || newestItem.link })
            .where(eq(socialFeeds.id, feed.id));
        } catch (error) {
          logger.error(`Error processing feed ${feed.feedUrl}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error checking social feeds:', error);
    }
  }
}

export const socialFeedService = new SocialFeedService();
