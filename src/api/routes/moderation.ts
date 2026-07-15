import { Router, Request, Response } from 'express';
import { client } from '../../index';
import { getDatabase } from '../../database/connection';
import { modCases, guildSettings } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { z } from 'zod';
import { Guild, GuildMember, PermissionFlagsBits } from 'discord.js';
import { warningService } from '../../services/warningService';
import { moderationScheduler } from '../../services/moderationScheduler';

const router = Router();

// Validation schemas
const warnSchema = z.object({
  userId: z.string(),
  moderatorId: z.string(),
  reason: z.string().min(1).max(500),
  level: z.number().min(1).max(5).optional(),
});

const banSchema = z.object({
  userId: z.string(),
  moderatorId: z.string(),
  reason: z.string().min(1).max(500),
  duration: z.number().optional(), // Duration in days for temp ban
  deleteMessageDays: z.number().min(0).max(7).optional(),
});

const kickSchema = z.object({
  userId: z.string(),
  moderatorId: z.string(),
  reason: z.string().min(1).max(500),
});

const muteSchema = z.object({
  userId: z.string(),
  moderatorId: z.string(),
  reason: z.string().min(1).max(500),
  duration: z.number().min(1).optional(), // Duration in minutes
});

const moderationSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  autoModEnabled: z.boolean().optional(),
  logChannelId: z.string().optional(),
  muteRoleId: z.string().optional(),
  warnThresholdBan: z.number().min(1).optional(),
  warnThresholdMute: z.number().min(1).optional(),
  antiSpamEnabled: z.boolean().optional(),
  antiLinksEnabled: z.boolean().optional(),
  antiInvitesEnabled: z.boolean().optional(),
});

// Helper function to log moderation action
async function logModAction(
  guildId: string,
  userId: string,
  moderatorId: string,
  type: string,
  reason: string,
  durationSeconds?: number
) {
  const db = getDatabase();
  const expiresAt =
    durationSeconds && durationSeconds > 0 ? new Date(Date.now() + durationSeconds * 1000) : null;

  const [newCase] = await db
    .insert(modCases)
    .values({
      guildId,
      userId,
      moderatorId,
      type,
      reason,
      duration: durationSeconds ?? null,
      expiresAt,
      createdAt: new Date(),
    })
    .returning();

  if (type === 'ban' && expiresAt) {
    await moderationScheduler.scheduleTempAction({
      caseId: newCase.id,
      guildId,
      userId,
      expiresAt,
      type: 'ban',
    });
  }

  return newCase.id;
}

async function requireModeratorPermission(
  guild: Guild,
  moderatorId: string,
  permission: bigint
): Promise<{ member: GuildMember | null; error?: { status: number; message: string } }> {
  const member = await guild.members.fetch(moderatorId).catch(() => null);
  if (!member) {
    return {
      member: null,
      error: { status: 404, message: 'Moderator not found in guild' },
    };
  }

  if (!member.permissions.has(permission)) {
    return {
      member: null,
      error: { status: 403, message: 'Moderator lacks the required permission' },
    };
  }

  return { member };
}

// POST /guilds/{guildId}/moderation/warn - Issue warning
router.post('/:guildId/moderation/warn', async (req: Request, res: Response) => {
  const { guildId } = req.params;

  try {
    const validation = warnSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const { userId, moderatorId, reason, level = 1 } = validation.data;

    // Get guild and users
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Guild not found',
      });
    }

    const user = await client.users.fetch(userId).catch(() => null);
    const moderator = await client.users.fetch(moderatorId).catch(() => null);

    if (!user || !moderator) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User or moderator not found',
      });
    }

    const warnPermission = await requireModeratorPermission(
      guild,
      moderatorId,
      PermissionFlagsBits.ModerateMembers
    );
    if (warnPermission.error) {
      return res.status(warnPermission.error.status).json({
        error: 'Forbidden',
        message: warnPermission.error.message,
      });
    }

    // Create warning using the warning service
    const warning = await warningService.createWarning(
      guild,
      user,
      moderator,
      reason,
      undefined,
      level
    );

    // Log the moderation action
    const caseId = await logModAction(guildId, userId, moderatorId, 'warn', reason);

    // Try to DM the user
    try {
      await user.send({
        embeds: [
          {
            title: '⚠️ Warning Received',
            description: `You have been warned in **${guild.name}**`,
            fields: [
              { name: 'Reason', value: reason, inline: false },
              { name: 'Level', value: level.toString(), inline: true },
            ],
            color: 0xffcc00,
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (error) {
      logger.warn(`Could not DM user ${userId} about warning`);
    }

    logger.info(`User ${userId} warned in guild ${guildId} by ${moderatorId}`);

    return res.json({
      success: true,
      warning: {
        id: warning.warnId,
        caseId,
        userId,
        moderatorId,
        reason,
        level,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error issuing warning:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to issue warning',
    });
  }
});

// POST /guilds/{guildId}/moderation/ban - Ban user
router.post('/:guildId/moderation/ban', async (req: Request, res: Response) => {
  const { guildId } = req.params;

  try {
    const validation = banSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const { userId, moderatorId, reason, duration, deleteMessageDays = 0 } = validation.data;

    // Get guild
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Guild not found',
      });
    }

    // Check if bot has permission to ban
    const botMember = guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.BanMembers)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Bot does not have permission to ban members',
      });
    }

    const banPermission = await requireModeratorPermission(
      guild,
      moderatorId,
      PermissionFlagsBits.BanMembers
    );
    if (banPermission.error) {
      return res.status(banPermission.error.status).json({
        error: 'Forbidden',
        message: banPermission.error.message,
      });
    }

    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    // Try to DM the user before banning
    try {
      await user.send({
        embeds: [
          {
            title: '🔨 You have been banned',
            description: `You have been banned from **${guild.name}**`,
            fields: [
              { name: 'Reason', value: reason, inline: false },
              {
                name: 'Duration',
                value: duration ? `${duration} days` : 'Permanent',
                inline: true,
              },
            ],
            color: 0xff0000,
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (error) {
      logger.warn(`Could not DM user ${userId} about ban`);
    }

    // Ban the user
    await guild.members.ban(userId, {
      reason: `${reason} | Banned by ${moderatorId}`,
      deleteMessageSeconds: deleteMessageDays * 24 * 60 * 60,
    });

    // Log the moderation action
    const durationSeconds = duration ? duration * 86400 : undefined;
    const caseId = await logModAction(guildId, userId, moderatorId, 'ban', reason, durationSeconds);

    // If it's a temporary ban, store it for later unbanning
    if (duration) {
      const unbanDate = new Date();
      unbanDate.setDate(unbanDate.getDate() + duration);

      // Store temp ban info (you would need a scheduled job to check and unban)
      // This is a simplified version - in production you'd want a proper scheduled jobs system
    }

    logger.info(`User ${userId} banned from guild ${guildId} by ${moderatorId}`);

    return res.json({
      success: true,
      ban: {
        caseId,
        userId,
        moderatorId,
        reason,
        duration,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error banning user:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to ban user',
    });
  }
});

// POST /guilds/{guildId}/moderation/kick - Kick user
router.post('/:guildId/moderation/kick', async (req: Request, res: Response) => {
  const { guildId } = req.params;

  try {
    const validation = kickSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const { userId, moderatorId, reason } = validation.data;

    // Get guild
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Guild not found',
      });
    }

    // Check if bot has permission to kick
    const botMember = guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.KickMembers)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Bot does not have permission to kick members',
      });
    }

    const kickPermission = await requireModeratorPermission(
      guild,
      moderatorId,
      PermissionFlagsBits.KickMembers
    );
    if (kickPermission.error) {
      return res.status(kickPermission.error.status).json({
        error: 'Forbidden',
        message: kickPermission.error.message,
      });
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Member not found in guild',
      });
    }

    // Check if member can be kicked
    if (!member.kickable) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot kick this member (higher role or owner)',
      });
    }

    // Try to DM the user before kicking
    try {
      await member.send({
        embeds: [
          {
            title: '👢 You have been kicked',
            description: `You have been kicked from **${guild.name}**`,
            fields: [{ name: 'Reason', value: reason, inline: false }],
            color: 0xffa500,
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (error) {
      logger.warn(`Could not DM user ${userId} about kick`);
    }

    // Kick the member
    await member.kick(`${reason} | Kicked by ${moderatorId}`);

    // Log the moderation action
    const caseId = await logModAction(guildId, userId, moderatorId, 'kick', reason);

    logger.info(`User ${userId} kicked from guild ${guildId} by ${moderatorId}`);

    return res.json({
      success: true,
      kick: {
        caseId,
        userId,
        moderatorId,
        reason,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error kicking user:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to kick user',
    });
  }
});

// POST /guilds/{guildId}/moderation/mute - Mute user
router.post('/:guildId/moderation/mute', async (req: Request, res: Response) => {
  const { guildId } = req.params;

  try {
    const validation = muteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const { userId, moderatorId, reason, duration } = validation.data;

    // Get guild
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Guild not found',
      });
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Member not found in guild',
      });
    }

    // Check if bot has permission to manage roles
    const botMember = guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Bot does not have permission to manage roles',
      });
    }

    const mutePermission = await requireModeratorPermission(
      guild,
      moderatorId,
      PermissionFlagsBits.ManageRoles
    );
    if (mutePermission.error) {
      return res.status(mutePermission.error.status).json({
        error: 'Forbidden',
        message: mutePermission.error.message,
      });
    }

    // Get or create muted role
    let muteRole = guild.roles.cache.find(r => r.name === 'Muted');

    if (!muteRole) {
      // Create mute role if it doesn't exist
      muteRole = await guild.roles.create({
        name: 'Muted',
        color: 0x808080,
        permissions: [],
        reason: 'Auto-created mute role',
      });

      // Update all channels to deny send messages for muted role
      for (const channel of guild.channels.cache.values()) {
        if (channel.isTextBased() && 'permissionOverwrites' in channel) {
          await channel.permissionOverwrites
            .create(muteRole.id, {
              SendMessages: false,
              AddReactions: false,
              Speak: false,
            })
            .catch(() => {});
        }
      }
    }

    // Apply mute role
    await member.roles.add(muteRole, `${reason} | Muted by ${moderatorId}`);

    // Log the moderation action
    const muteDurationSeconds = duration ? duration * 60 : undefined;
    const caseId = await logModAction(
      guildId,
      userId,
      moderatorId,
      'mute',
      reason,
      muteDurationSeconds
    );

    // If it's a temporary mute, schedule unmute
    if (duration) {
      setTimeout(
        async () => {
          try {
            await member.roles.remove(muteRole.id, 'Mute duration expired');
            logger.info(`Unmuted user ${userId} in guild ${guildId} (duration expired)`);
          } catch (error) {
            logger.error(`Failed to unmute user ${userId}:`, error);
          }
        },
        duration * 60 * 1000
      );
    }

    // Try to DM the user
    try {
      await member.send({
        embeds: [
          {
            title: '🔇 You have been muted',
            description: `You have been muted in **${guild.name}**`,
            fields: [
              { name: 'Reason', value: reason, inline: false },
              {
                name: 'Duration',
                value: duration ? `${duration} minutes` : 'Indefinite',
                inline: true,
              },
            ],
            color: 0x808080,
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (error) {
      logger.warn(`Could not DM user ${userId} about mute`);
    }

    logger.info(`User ${userId} muted in guild ${guildId} by ${moderatorId}`);

    return res.json({
      success: true,
      mute: {
        caseId,
        userId,
        moderatorId,
        reason,
        duration,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error muting user:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to mute user',
    });
  }
});

// PATCH /guilds/{guildId}/moderation/settings - Update mod settings
router.patch('/:guildId/moderation/settings', async (req: Request, res: Response) => {
  const { guildId } = req.params;

  try {
    const validation = moderationSettingsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const db = getDatabase();
    const updates = validation.data;

    // Update settings that exist in guildSettings table
    const [existingSettings] = await db
      .select()
      .from(guildSettings)
      .where(eq(guildSettings.guildId, guildId))
      .limit(1);

    const settingUpdates: any = {
      updatedAt: new Date(),
    };

    if (updates.antiSpamEnabled !== undefined)
      settingUpdates.antiSpamEnabled = updates.antiSpamEnabled;
    if (updates.logChannelId !== undefined) settingUpdates.logsChannel = updates.logChannelId;

    if (!existingSettings) {
      // Create settings if they don't exist
      await db.insert(guildSettings).values({
        guildId,
        antiSpamEnabled: updates.antiSpamEnabled || false,
        logsChannel: updates.logChannelId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else if (Object.keys(settingUpdates).length > 1) {
      // Update existing settings
      await db.update(guildSettings).set(settingUpdates).where(eq(guildSettings.guildId, guildId));
    }

    logger.info(`Updated moderation settings for guild ${guildId}`);

    return res.json({
      success: true,
      message: 'Moderation settings updated successfully',
    });
  } catch (error) {
    logger.error('Error updating moderation settings:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update moderation settings',
    });
  }
});

export const moderationRouter = router;
