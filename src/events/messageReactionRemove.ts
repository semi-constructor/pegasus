import { Events, MessageReaction, User, PartialMessageReaction, PartialUser, Message } from 'discord.js';
import { starboardService } from '../services/starboardService';
import { logger } from '../utils/logger';

export const name = Events.MessageReactionRemove;
export const once = false;

export async function execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
  if (user.bot) return;
  if (!reaction.message.guild) return;

  try {
    // When a reaction is received, check if the structure is partial
    if (reaction.partial) {
      await reaction.fetch();
    }
    if (reaction.message.partial) {
      await reaction.message.fetch();
    }
    
    const emojiName = reaction.emoji.name;
    if (!emojiName) return;

    // Use starboard service
    await starboardService.handleReaction(
      reaction.message as Message,
      emojiName,
      reaction.count || 0
    );
  } catch (error) {
    logger.error('Error in messageReactionRemove event:', error);
  }
}
