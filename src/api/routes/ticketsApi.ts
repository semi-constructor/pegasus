import { Router, Request, Response } from 'express';
import { client } from '../../index';
import { getDatabase } from '../../database/connection';
import { tickets } from '../../database/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { EmbedBuilder, TextChannel } from 'discord.js';

const router = Router();

// Helper to extract ticketId and guildId from body or query
function getTicketParams(req: Request) {
  const ticketId = req.body.ticketId || req.query.ticketId;
  const guildId = req.body.guildId || req.query.guildId;
  const reason = req.body.reason || req.query.reason;
  const userId = req.body.userId || req.body.closedBy || req.body.lockedBy || req.body.frozenBy || req.body.claimedBy || req.query.userId;
  return { ticketId, guildId, reason, userId };
}

/**
 * POST /api/tickets/close
 * Close a ticket from the dashboard
 */
const handleClose = async (req: Request, res: Response) => {
  const { ticketId, guildId, reason, userId } = getTicketParams(req);

  if (!ticketId) {
    return res.status(400).json({ error: 'Bad Request', message: 'ticketId is required' });
  }

  try {
    const db = getDatabase();
    const whereClause = guildId ? and(eq(tickets.id, ticketId), eq(tickets.guildId, guildId)) : eq(tickets.id, ticketId);

    const [ticket] = await db.select().from(tickets).where(whereClause).limit(1);

    if (!ticket) {
      return res.status(404).json({ error: 'Not Found', message: 'Ticket not found' });
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({ error: 'Bad Request', message: 'Ticket is already closed' });
    }

    // Update ticket status in DB
    const [updatedTicket] = await db
      .update(tickets)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedBy: userId || null,
        closedReason: reason || null,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticket.id))
      .returning();

    const guild = client.guilds.cache.get(ticket.guildId);
    if (guild) {
      const channel = guild.channels.cache.get(ticket.channelId);
      if (channel) {
        try {
          if (channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('🔒 Ticket Closed')
              .setDescription(reason ? `Reason: ${reason}` : 'This ticket has been closed via the dashboard.')
              .setColor(0xff0000)
              .setTimestamp();

            await (channel as TextChannel).send({ embeds: [embed] });
            // Wait a moment before deleting
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          await channel.delete('Ticket closed via dashboard');
        } catch (error) {
          logger.warn(`Could not delete ticket channel: ${error}`);
        }
      }

      // Try to DM the ticket creator
      try {
        const user = await client.users.fetch(ticket.userId);
        await user.send({
          embeds: [
            {
              title: '🎫 Ticket Closed',
              description: `Your ticket in **${guild.name}** has been closed.`,
              fields: reason ? [{ name: 'Reason', value: reason }] : [],
              color: 0xff0000,
              timestamp: new Date().toISOString(),
            },
          ],
        });
      } catch (error) {
        logger.warn(`Could not DM user about ticket closure: ${error}`);
      }
    }

    logger.info(`Dashboard closed ticket ${ticket.id}`);

    return res.json({
      success: true,
      message: 'Ticket closed successfully',
      ticket: updatedTicket,
    });
  } catch (error) {
    logger.error('Error closing ticket via dashboard:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to close ticket' });
  }
};

router.post('/close', handleClose);
router.patch('/close', handleClose);

/**
 * POST /api/tickets/lock
 * Lock a ticket from the dashboard (prevent user from sending messages)
 */
const handleLock = async (req: Request, res: Response) => {
  const { ticketId, guildId, reason, userId } = getTicketParams(req);

  if (!ticketId) {
    return res.status(400).json({ error: 'Bad Request', message: 'ticketId is required' });
  }

  try {
    const db = getDatabase();
    const whereClause = guildId ? and(eq(tickets.id, ticketId), eq(tickets.guildId, guildId)) : eq(tickets.id, ticketId);

    const [ticket] = await db.select().from(tickets).where(whereClause).limit(1);

    if (!ticket) {
      return res.status(404).json({ error: 'Not Found', message: 'Ticket not found' });
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({ error: 'Bad Request', message: 'Cannot lock a closed ticket' });
    }

    // Update ticket status in DB
    const [updatedTicket] = await db
      .update(tickets)
      .set({
        status: 'locked',
        lockedAt: new Date(),
        lockedBy: userId || null,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticket.id))
      .returning();

    const guild = client.guilds.cache.get(ticket.guildId);
    if (guild) {
      const channel = guild.channels.cache.get(ticket.channelId) as TextChannel;
      if (channel && channel.isTextBased()) {
        try {
          // Update channel permissions to prevent user from sending messages
          await channel.permissionOverwrites.edit(ticket.userId, { SendMessages: false });

          const embed = new EmbedBuilder()
            .setTitle('🔒 Ticket Locked')
            .setDescription(reason ? `This ticket has been locked. Reason: ${reason}` : 'This ticket has been locked by a moderator.')
            .setColor(0xffa500)
            .setTimestamp();

          await channel.send({ embeds: [embed] });
        } catch (error) {
          logger.warn(`Could not lock ticket channel permissions: ${error}`);
        }
      }
    }

    logger.info(`Dashboard locked ticket ${ticket.id}`);

    return res.json({
      success: true,
      message: 'Ticket locked successfully',
      ticket: updatedTicket,
    });
  } catch (error) {
    logger.error('Error locking ticket via dashboard:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to lock ticket' });
  }
};

router.post('/lock', handleLock);
router.patch('/lock', handleLock);

/**
 * POST /api/tickets/freeze
 * Freeze a ticket from the dashboard (prevent user from sending messages or reacting)
 */
const handleFreeze = async (req: Request, res: Response) => {
  const { ticketId, guildId, reason, userId } = getTicketParams(req);

  if (!ticketId) {
    return res.status(400).json({ error: 'Bad Request', message: 'ticketId is required' });
  }

  try {
    const db = getDatabase();
    const whereClause = guildId ? and(eq(tickets.id, ticketId), eq(tickets.guildId, guildId)) : eq(tickets.id, ticketId);

    const [ticket] = await db.select().from(tickets).where(whereClause).limit(1);

    if (!ticket) {
      return res.status(404).json({ error: 'Not Found', message: 'Ticket not found' });
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({ error: 'Bad Request', message: 'Cannot freeze a closed ticket' });
    }

    // Update ticket status in DB
    const [updatedTicket] = await db
      .update(tickets)
      .set({
        status: 'frozen',
        frozenAt: new Date(),
        frozenBy: userId || null,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticket.id))
      .returning();

    const guild = client.guilds.cache.get(ticket.guildId);
    if (guild) {
      const channel = guild.channels.cache.get(ticket.channelId) as TextChannel;
      if (channel && channel.isTextBased()) {
        try {
          // Update channel permissions to freeze user interactions
          await channel.permissionOverwrites.edit(ticket.userId, { SendMessages: false, AddReactions: false });

          const embed = new EmbedBuilder()
            .setTitle('❄️ Ticket Frozen')
            .setDescription(reason ? `This ticket has been frozen. Reason: ${reason}` : 'This ticket has been frozen pending further administrative review.')
            .setColor(0x00ffff)
            .setTimestamp();

          await channel.send({ embeds: [embed] });
        } catch (error) {
          logger.warn(`Could not freeze ticket channel permissions: ${error}`);
        }
      }
    }

    logger.info(`Dashboard frozen ticket ${ticket.id}`);

    return res.json({
      success: true,
      message: 'Ticket frozen successfully',
      ticket: updatedTicket,
    });
  } catch (error) {
    logger.error('Error freezing ticket via dashboard:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to freeze ticket' });
  }
};

router.post('/freeze', handleFreeze);
router.patch('/freeze', handleFreeze);

/**
 * POST /api/tickets/claim
 * Claim a ticket from the dashboard
 */
const handleClaim = async (req: Request, res: Response) => {
  const { ticketId, guildId, userId } = getTicketParams(req);

  if (!ticketId) {
    return res.status(400).json({ error: 'Bad Request', message: 'ticketId is required' });
  }

  if (!userId) {
    return res.status(400).json({ error: 'Bad Request', message: 'userId / claimedBy is required to claim a ticket' });
  }

  try {
    const db = getDatabase();
    const whereClause = guildId ? and(eq(tickets.id, ticketId), eq(tickets.guildId, guildId)) : eq(tickets.id, ticketId);

    const [ticket] = await db.select().from(tickets).where(whereClause).limit(1);

    if (!ticket) {
      return res.status(404).json({ error: 'Not Found', message: 'Ticket not found' });
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({ error: 'Bad Request', message: 'Cannot claim a closed ticket' });
    }

    // Update ticket status in DB
    const [updatedTicket] = await db
      .update(tickets)
      .set({
        status: 'claimed',
        claimedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticket.id))
      .returning();

    const guild = client.guilds.cache.get(ticket.guildId);
    if (guild) {
      const channel = guild.channels.cache.get(ticket.channelId) as TextChannel;
      if (channel && channel.isTextBased()) {
        try {
          const embed = new EmbedBuilder()
            .setTitle('👋 Ticket Claimed')
            .setDescription(`This ticket has been claimed by <@${userId}>. They will be assisting you shortly.`)
            .setColor(0x5865f2)
            .setTimestamp();

          await channel.send({ embeds: [embed] });
        } catch (error) {
          logger.warn(`Could not send claim message to ticket channel: ${error}`);
        }
      }
    }

    logger.info(`Dashboard user ${userId} claimed ticket ${ticket.id}`);

    return res.json({
      success: true,
      message: 'Ticket claimed successfully',
      ticket: updatedTicket,
    });
  } catch (error) {
    logger.error('Error claiming ticket via dashboard:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to claim ticket' });
  }
};

router.post('/claim', handleClaim);
router.patch('/claim', handleClaim);

export const ticketsApiRouter = router;

