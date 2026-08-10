import { Message, Guild, GuildMember, EmbedBuilder } from 'discord.js';
import { modLogService } from './modLogService';
import { logger } from '../utils/logger';
import { EmbedFactory } from '../utils/EmbedFactory';

export async function evaluateHoneypot(message: Message, settings: any): Promise<boolean> {
  // Check if honeypot is configured and enabled
  if (!settings || !settings.honeypotChannelId) {
    return false;
  }

  // If the message is not in the honeypot channel, do nothing
  if (message.channel.id !== settings.honeypotChannelId) {
    return false;
  }

  // Admins or bots usually bypass honeypot, but for safety let's just make sure it's a normal member
  if (message.member?.permissions.has('Administrator') || message.author.bot) {
    return false;
  }

  try {
    // 1. Timeout the user for 24 hours
    const timeoutDurationMs = 24 * 60 * 60 * 1000;
    await message.member?.timeout(timeoutDurationMs, 'Triggered Scammer Honeypot');

    // 2. Delete their message immediately
    if (message.deletable) {
      await message.delete();
    }

    // 3. Notify moderators
    if (message.guild) {
      const embed = EmbedFactory.error(
        `User ${message.author} (\`${message.author.id}\`) triggered the honeypot in <#${message.channel.id}>.\nThey have been automatically timed out for 24 hours.\n\n**Message Content:**\n\`\`\`\n${message.content}\n\`\`\``,
        '🍯 Honeypot Triggered'
      );
      
      // Sending to a generic moderation channel if modLogService supports it, or generic alert
      await modLogService.sendLog(message.guild, 'moderation', { embeds: [embed] });
    }

    return true; // Indicate that the pipeline should stop
  } catch (error) {
    logger.error(`Failed to execute honeypot action on ${message.author.id}:`, error);
    return false;
  }
}
