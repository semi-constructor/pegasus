import { Message } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { guildService } from './guildService';

class AIService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    if (config.GEMINI_API_KEY) {
      this.ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
    }
  }

  public async evaluateMessage(message: Message): Promise<boolean> {
    // Check if AI is configured at all
    if (!this.ai) return false;

    // Check if message is a mention to the bot
    if (!message.mentions.has(message.client.user!)) return false;

    // Get guild settings
    if (!message.guild) return false;
    const guildSettings = await guildService.getGuildSettings(message.guild.id);

    // AI must be enabled
    if (!guildSettings.aiEnabled) return false;

    // Optional channel restriction
    if (guildSettings.aiChannel && message.channel.id !== guildSettings.aiChannel) {
      return false;
    }

    try {
      // Start typing indicator
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      // Clean the message content by removing the bot mention
      const botMention = `<@${message.client.user!.id}>`;
      const botMentionNickname = `<@!${message.client.user!.id}>`;
      let content = message.content.replace(botMention, '').replace(botMentionNickname, '').trim();

      // Ensure there's actual content to respond to
      if (!content) {
        content = "Hello!";
      }

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: content }]
          }
        ],
        config: {
          systemInstruction: guildSettings.aiPersona || 'You are a helpful Discord bot assistant.',
        }
      });

      const replyContent = response.text;
      
      if (replyContent) {
        // Send reply but slice it if it exceeds Discord's 2000 char limit
        const chunk = replyContent.length > 2000 ? replyContent.slice(0, 1997) + '...' : replyContent;
        await message.reply(chunk);
      } else {
        await message.reply("I'm not sure how to respond to that.");
      }

      return true;
    } catch (error) {
      logger.error('Failed to generate AI response:', error);
      await message.reply("Sorry, I'm having trouble thinking right now.");
      return true; // We still handled the mention
    }
  }
}

export const aiService = new AIService();
