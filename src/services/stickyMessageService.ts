import { Message, TextChannel } from 'discord.js';
import { getDatabase } from '../database/connection';
import { guildSettings } from '../database/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { EmbedFactory } from '../utils/EmbedFactory';

export class StickyMessageService {
  // In-memory tracking of the last sticky message ID per channel
  private lastStickyMessages = new Map<string, string>();

  private processingChannels = new Set<string>();

  /**
   * Evaluates if a message is sent in a sticky channel, deletes the old sticky,
   * and posts a new one at the bottom.
   */
  public async evaluateMessage(message: Message, settings: any): Promise<void> {
    if (!message.guild || message.author.bot) return;

    if (this.processingChannels.has(message.channel.id)) return;

    if (!settings || !settings.stickies) return;

    let stickiesArray: Array<{channelId: string, content: string}> = [];
    try {
      if (typeof settings.stickies === 'string') {
        stickiesArray = JSON.parse(settings.stickies);
      } else if (Array.isArray(settings.stickies)) {
        stickiesArray = settings.stickies;
      }
    } catch (e) {
      // Invalid JSON
      return;
    }

    const stickyObj = stickiesArray.find(s => s.channelId === message.channel.id);
    if (!stickyObj || !stickyObj.content) return;
    
    const stickyText = stickyObj.content;

    this.processingChannels.add(message.channel.id);

    try {
      const channel = message.channel as TextChannel;
      
      // Delete the old sticky if we track it in memory
      const lastStickyId = this.lastStickyMessages.get(channel.id);
      if (lastStickyId) {
        try {
          const oldMessage = await channel.messages.fetch(lastStickyId);
          if (oldMessage && oldMessage.deletable) {
            await oldMessage.delete();
          }
        } catch (e) {
          // Message might already be deleted
        }
      }

      // Send the new sticky
      const embed = EmbedFactory.info(stickyText).setFooter({ text: '📌 Sticky Message' });
      const newSticky = await channel.send({ embeds: [embed] });
      
      // Track the new sticky
      this.lastStickyMessages.set(channel.id, newSticky.id);
      
    } catch (error) {
      logger.error(`Error handling sticky message for channel ${message.channel.id}:`, error);
    } finally {
      setTimeout(() => {
        this.processingChannels.delete(message.channel.id);
      }, 3000);
    }
  }
}

export const stickyMessageService = new StickyMessageService();
