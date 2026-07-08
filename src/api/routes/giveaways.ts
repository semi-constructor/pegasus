import { Router, Request, Response } from 'express';
import { client } from '../../index';
import { getDatabase } from '../../database/connection';
import { giveaways, giveawayEntries } from '../../database/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { z } from 'zod';
import { t } from '../../i18n';
import { v4 as uuidv4 } from 'uuid';
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from 'discord.js';
import { giveawayService } from '../../services/giveawayService';

const router = Router();

// Validation schemas
const createGiveawaySchema = z.object({
  prize: z.string().min(1).max(250),
  description: z.string().max(1000).optional(),
  channelId: z.string(),
  duration: z.number().min(60000), // Minimum 1 minute in milliseconds
  winnerCount: z.number().min(1).max(20),
  hostedBy: z.string(),
  requiredRole: z.string().optional(),
  bonusEntries: z
    .array(
      z.object({
        roleId: z.string(),
        entries: z.number().min(1).max(10),
      })
    )
    .optional(),
  allowedRoles: z.array(z.string()).optional(),
  blockedRoles: z.array(z.string()).optional(),
  embedTitle: z.string().max(255).optional(),
  embedColor: z.string().or(z.number()).optional(),
  embedImage: z.string().url().max(500).optional(),
  embedThumbnail: z.string().url().max(500).optional(),
});

const updateGiveawaySchema = z.object({
  prize: z.string().min(1).max(250).optional(),
  description: z.string().max(1000).optional(),
  winnerCount: z.number().min(1).max(20).optional(),
  endTime: z.string().datetime().optional(),
  requiredRole: z.string().optional(),
  bonusEntries: z
    .array(
      z.object({
        roleId: z.string(),
        entries: z.number().min(1).max(10),
      })
    )
    .optional(),
  embedTitle: z.string().max(255).optional(),
  embedColor: z.string().or(z.number()).optional(),
  embedImage: z.string().url().max(500).optional(),
  embedThumbnail: z.string().url().max(500).optional(),
});

// Helper function to select random winners (Removed as we use giveawayService)

// POST /guilds/{guildId}/giveaways - Create giveaway
router.post('/:guildId/giveaways', async (req: Request, res: Response) => {
  const { guildId } = req.params;

  try {
    const validation = createGiveawaySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const data = validation.data;
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Guild not found',
      });
    }

    const channel = guild.channels.cache.get(data.channelId) as TextChannel;
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid channel ID or channel is not text-based',
      });
    }

    const giveawayId = uuidv4();
    const endTime = new Date(Date.now() + data.duration);

    let color = typeof data.embedColor === 'string' ? parseInt(data.embedColor.replace('#', ''), 16) : (data.embedColor || 0x5865f2);
    if (isNaN(color)) color = 0x5865f2;

    // Create giveaway embed
    const embed = new EmbedBuilder()
      .setTitle(data.embedTitle || '🎉 GIVEAWAY 🎉')
      .setDescription(
        `**Prize:** ${data.prize}\n${data.description || ''}\n\nReact with 🎉 to enter!`
      )
      .addFields(
        { name: 'Ends', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: true },
        { name: 'Winners', value: data.winnerCount.toString(), inline: true },
        { name: 'Hosted By', value: `<@${data.hostedBy}>`, inline: true }
      )
      .setColor(color)
      .setFooter({ text: `Giveaway ID: ${giveawayId}` })
      .setTimestamp(endTime);

    if (data.embedImage) embed.setImage(data.embedImage);
    if (data.embedThumbnail) embed.setThumbnail(data.embedThumbnail);

    if (data.requiredRole) {
      embed.addFields({ name: 'Required Role', value: `<@&${data.requiredRole}>`, inline: false });
    }

    // Send giveaway message initially
    const message = await channel.send({
      embeds: [embed],
    });

    // Create giveaway using giveawayService
    const giveaway = await giveawayService.createGiveaway({
      guildId,
      channelId: data.channelId,
      hostedBy: data.hostedBy,
      prize: data.prize,
      winnerCount: data.winnerCount,
      endTime,
      description: data.description || null,
      requirements: data.requiredRole ? { roleIds: [data.requiredRole] } : {},
      bonusEntries: data.bonusEntries ? { roles: Object.fromEntries(data.bonusEntries.map(b => [b.roleId, b.entries])) } : {},
      embedTitle: data.embedTitle || null,
      embedColor: color,
      embedImage: data.embedImage || null,
      embedThumbnail: data.embedThumbnail || null,
    });

    // Update message ID in the database
    await giveawayService.updateGiveawayMessage(giveaway.giveawayId, message.id);

    // Also update our button customId to use gw_enter
    const button = new ButtonBuilder()
      .setCustomId(`gw_enter:${giveaway.giveawayId}`)
      .setLabel(t('commands.giveaway.buttons.enter', { defaultValue: 'Enter' }))
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎉');

    const infoButton = new ButtonBuilder()
      .setCustomId(`gw_info:${giveaway.giveawayId}`)
      .setLabel(t('commands.giveaway.buttons.info', { defaultValue: 'Info' }))
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('ℹ️');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button, infoButton);
    
    embed.setFooter({ text: t('commands.giveaway.embed.footer', { id: giveaway.giveawayId, defaultValue: `Giveaway ID: ${giveaway.giveawayId}` }) });
    
    await message.edit({ embeds: [embed], components: [row] });

    logger.info(`Created giveaway ${giveaway.giveawayId} in guild ${guildId}`);

    return res.status(201).json({
      success: true,
      giveaway: {
        id: giveaway.giveawayId,
        prize: data.prize,
        channelId: data.channelId,
        messageId: message.id,
        endTime: endTime.toISOString(),
        winnerCount: data.winnerCount,
      },
    });
  } catch (error) {
    logger.error('Error creating giveaway:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create giveaway',
    });
  }
});

// PATCH /guilds/{guildId}/giveaways/{giveawayId} - Update giveaway
router.patch('/:guildId/giveaways/:giveawayId', async (req: Request, res: Response) => {
  const { guildId, giveawayId } = req.params;

  try {
    const validation = updateGiveawaySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const db = getDatabase();
    const updates = validation.data;

    // Check if giveaway exists
    const [giveaway] = await db
      .select()
      .from(giveaways)
      .where(and(eq(giveaways.giveawayId, giveawayId), eq(giveaways.guildId, guildId)))
      .limit(1);

    if (!giveaway) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Giveaway not found',
      });
    }

    if (giveaway.status !== 'active') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot update ended giveaway',
      });
    }

    // Update giveaway
    const updateData: any = {};
    if (updates.prize) updateData.prize = updates.prize;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.winnerCount) updateData.winnerCount = updates.winnerCount;
    if (updates.endTime) updateData.endTime = new Date(updates.endTime);
    if (updates.requiredRole !== undefined)
      updateData.requirements = { requiredRole: updates.requiredRole };
    if (updates.bonusEntries) updateData.bonusEntries = updates.bonusEntries || {};
    if (updates.embedTitle !== undefined) updateData.embedTitle = updates.embedTitle;
    if (updates.embedColor !== undefined) {
      const parsedColor = typeof updates.embedColor === 'string' ? parseInt(updates.embedColor.replace('#', ''), 16) : updates.embedColor;
      if (!isNaN(parsedColor as number)) updateData.embedColor = parsedColor;
    }
    if (updates.embedImage !== undefined) updateData.embedImage = updates.embedImage;
    if (updates.embedThumbnail !== undefined) updateData.embedThumbnail = updates.embedThumbnail;

    await db
      .update(giveaways)
      .set(updateData)
      .where(and(eq(giveaways.giveawayId, giveawayId), eq(giveaways.guildId, guildId)));

    // Update the giveaway message
    const guild = client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(giveaway.channelId) as TextChannel;

    if (channel && giveaway.messageId) {
      try {
        const message = await channel.messages.fetch(giveaway.messageId);
        const endTime = updateData.endTime || giveaway.endTime;

        const embedColor = updateData.embedColor !== undefined ? updateData.embedColor : giveaway.embedColor;
        const embedTitle = updateData.embedTitle !== undefined ? updateData.embedTitle : giveaway.embedTitle;
        const embedImage = updateData.embedImage !== undefined ? updateData.embedImage : giveaway.embedImage;
        const embedThumbnail = updateData.embedThumbnail !== undefined ? updateData.embedThumbnail : giveaway.embedThumbnail;

        const embed = new EmbedBuilder()
          .setTitle(embedTitle || '🎉 GIVEAWAY 🎉')
          .setDescription(
            `**Prize:** ${updateData.prize || giveaway.prize}\n${updateData.description || giveaway.description || ''}\n\nReact with 🎉 to enter!`
          )
          .addFields(
            { name: 'Ends', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: true },
            {
              name: 'Winners',
              value: (updateData.winnerCount || giveaway.winnerCount).toString(),
              inline: true,
            },
            { name: 'Hosted By', value: `<@${giveaway.hostedBy}>`, inline: true }
          )
          .setColor(embedColor)
          .setFooter({ text: `Giveaway ID: ${giveawayId}` })
          .setTimestamp(endTime);

        if (embedImage) embed.setImage(embedImage);
        if (embedThumbnail) embed.setThumbnail(embedThumbnail);

        await message.edit({ embeds: [embed] });
      } catch (error) {
        logger.warn(`Could not update giveaway message: ${error}`);
      }
    }

    logger.info(`Updated giveaway ${giveawayId} in guild ${guildId}`);

    return res.json({
      success: true,
      message: 'Giveaway updated successfully',
    });
  } catch (error) {
    logger.error('Error updating giveaway:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update giveaway',
    });
  }
});

// DELETE /guilds/{guildId}/giveaways/{giveawayId} - Delete giveaway
router.delete('/:guildId/giveaways/:giveawayId', async (req: Request, res: Response) => {
  const { guildId, giveawayId } = req.params;

  try {
    const db = getDatabase();

    // Check if giveaway exists
    const [giveaway] = await db
      .select()
      .from(giveaways)
      .where(and(eq(giveaways.giveawayId, giveawayId), eq(giveaways.guildId, guildId)))
      .limit(1);

    if (!giveaway) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Giveaway not found',
      });
    }

    // Delete giveaway message
    const guild = client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(giveaway.channelId) as TextChannel;

    if (channel && giveaway.messageId) {
      try {
        const message = await channel.messages.fetch(giveaway.messageId);
        await message.delete();
      } catch (error) {
        logger.warn(`Could not delete giveaway message: ${error}`);
      }
    }

    // Delete giveaway and entries from database
    await db.transaction(async tx => {
      await tx.delete(giveawayEntries).where(eq(giveawayEntries.giveawayId, giveawayId));
      await tx.delete(giveaways).where(eq(giveaways.giveawayId, giveawayId));
    });

    logger.info(`Deleted giveaway ${giveawayId} from guild ${guildId}`);

    return res.json({
      success: true,
      message: 'Giveaway deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting giveaway:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete giveaway',
    });
  }
});

// Helper function to end a giveaway removed, use giveawayService

// POST /guilds/{guildId}/giveaways/{giveawayId}/end - End giveaway
router.post('/:guildId/giveaways/:giveawayId/end', async (req: Request, res: Response) => {
  const { guildId, giveawayId } = req.params;

  try {
    // API end request, mock the user
    const result = await giveawayService.endGiveaway(giveawayId, { id: 'api' } as any);

    if (!result.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: result.error || 'Giveaway not found or already ended',
      });
    }

    logger.info(`Ended giveaway ${giveawayId} in guild ${guildId}`);

    return res.json({
      success: true,
      winners: result.winners,
      message: 'Giveaway ended successfully',
    });
  } catch (error) {
    logger.error('Error ending giveaway:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to end giveaway',
    });
  }
});

// POST /guilds/{guildId}/giveaways/{giveawayId}/reroll - Reroll winner
router.post('/:guildId/giveaways/:giveawayId/reroll', async (req: Request, res: Response) => {
  const { guildId, giveawayId } = req.params;
  const { count = 1 } = req.body;
  try {
    const result = await giveawayService.rerollGiveaway(giveawayId, { id: 'api' } as any, count);

    if (!result.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: result.error || 'No eligible participants for reroll',
      });
    }

    logger.info(`Rerolled giveaway ${giveawayId} winners in guild ${guildId}`);

    return res.json({
      success: true,
      newWinners: result.winners,
      message: 'Giveaway rerolled successfully',
    });
  } catch (error) {
    logger.error('Error rerolling giveaway:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reroll giveaway',
    });
  }
});

export const giveawaysRouter = router;
