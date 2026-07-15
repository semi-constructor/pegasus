import { Router, Request, Response } from 'express';
import { client } from '../../index';
import { getDatabase } from '../../database/connection';
import {
  guilds as guildsTable,
  guildSettings,
  members,
  economyBalances,
} from '../../database/schema';
import { inArray, desc, eq, sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { cacheManager, CacheTTL } from '../middleware/cache';

const router = Router();

interface BatchGuildRequest {
  guildIds: string[];
  fields?: string[]; // Optional: specify which fields to return
}

interface GuildSummary {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  onlineCount: number;
  features: {
    economy: boolean;
    moderation: boolean;
    tickets: boolean;
    xp: boolean;
    giveaways: boolean;
  };
  settings?: {
    prefix: string;
    language: string;
  };
  stats?: {
    totalMembers: number;
    activeMembers: number;
    economyBalance: number;
  };
}

/**
 * POST /batch/guilds
 * Fetch data for multiple guilds in a single request
 */
router.post('/guilds', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid request body' });
      return;
    }

    const { guildIds, fields = ['basic', 'features'] } = req.body as BatchGuildRequest;

    if (!guildIds || !Array.isArray(guildIds) || guildIds.length === 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'guildIds array is required',
      });
      return;
    }

    // Limit to prevent abuse
    if (guildIds.length > 50) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Maximum 50 guilds per batch request',
      });
      return;
    }

    const results: GuildSummary[] = [];
    const db = getDatabase();

    // Check cache first
    const uncachedGuildIds: string[] = [];
    for (const guildId of guildIds) {
      const cacheKey = `batch:guild:${guildId}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        results.push(cached as GuildSummary);
      } else {
        uncachedGuildIds.push(guildId);
      }
    }

    // Fetch uncached guild data
    if (uncachedGuildIds.length > 0) {
      // Get Discord guild data
      const discordGuilds = uncachedGuildIds
        .map(id => {
          const guild = client.guilds.cache.get(id);
          if (!guild) return null;

          const onlineMembers = guild.members.cache.filter(m => m.presence?.status !== 'offline');

          return {
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            memberCount: guild.memberCount,
            onlineCount: onlineMembers.size,
          };
        })
        .filter(Boolean);

      // Get database data in parallel
      const [dbGuilds, dbSettings] = await Promise.all([
        db.select().from(guildsTable).where(inArray(guildsTable.id, uncachedGuildIds)).execute(),

        db
          .select()
          .from(guildSettings)
          .where(inArray(guildSettings.guildId, uncachedGuildIds))
          .execute(),
      ]);

      // Create guild ID maps for quick lookup
      const settingsMap = new Map(dbSettings.map(s => [s.guildId, s]));
      const dbGuildMap = new Map(dbGuilds.map(g => [g.id, g]));

      // Get additional stats if requested
      const statsMap = new Map<string, any>();
      if (fields.includes('stats')) {
        const memberStats = await db
          .select({
            guildId: members.guildId,
            totalMembers: sql<number>`COUNT(*)`,
            activeMembers: sql<number>`COUNT(*) FILTER (WHERE ${members.updatedAt} > NOW() - INTERVAL '7 days')`,
          })
          .from(members)
          .where(inArray(members.guildId, uncachedGuildIds))
          .groupBy(members.guildId)
          .execute();

        const economyStats = await db
          .select({
            guildId: economyBalances.guildId,
            totalBalance: sql<number>`SUM(balance + bank_balance)`,
          })
          .from(economyBalances)
          .where(inArray(economyBalances.guildId, uncachedGuildIds))
          .groupBy(economyBalances.guildId)
          .execute();

        memberStats.forEach(stat => {
          statsMap.set(stat.guildId, {
            totalMembers: Number(stat.totalMembers) || 0,
            activeMembers: Number(stat.activeMembers) || 0,
          });
        });

        economyStats.forEach(stat => {
          const existing = statsMap.get(stat.guildId) || {};
          statsMap.set(stat.guildId, {
            ...existing,
            economyBalance: Number(stat.totalBalance) || 0,
          });
        });
      }

      // Combine all data
      for (const discordGuild of discordGuilds) {
        if (!discordGuild) continue;

        const dbGuild = dbGuildMap.get(discordGuild.id);
        const settings = settingsMap.get(discordGuild.id);
        const stats = statsMap.get(discordGuild.id);

        const guildSummary: GuildSummary = {
          id: discordGuild.id,
          name: discordGuild.name,
          icon: discordGuild.icon,
          memberCount: discordGuild.memberCount,
          onlineCount: discordGuild.onlineCount,
          features: {
            economy: true, // Default enabled, would need separate feature flags table
            moderation: true,
            tickets: true,
            xp: settings?.xpEnabled ?? true,
            giveaways: true,
          },
        };

        if (fields.includes('settings')) {
          guildSummary.settings = {
            prefix: dbGuild?.prefix || '!',
            language: dbGuild?.language || 'en',
          };
        }

        if (fields.includes('stats') && stats) {
          guildSummary.stats = stats;
        }

        // Cache the result
        const cacheKey = `batch:guild:${discordGuild.id}`;
        cacheManager.set(cacheKey, guildSummary, CacheTTL.GUILD_DATA);

        results.push(guildSummary);
      }
    }

    res.json({
      guilds: results,
      total: results.length,
      cached: guildIds.length - uncachedGuildIds.length,
    });
  } catch (error) {
    logger.error('Error in batch guild request:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch batch guild data',
    });
  }
});

/**
 * POST /batch/members
 * Fetch member data for multiple guilds
 */
router.post('/members', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid request body' });
      return;
    }

    const { guildIds, limit = 10 } = req.body;

    if (!guildIds || !Array.isArray(guildIds) || guildIds.length === 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'guildIds array is required',
      });
      return;
    }

    if (guildIds.length > 20) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Maximum 20 guilds per batch request',
      });
      return;
    }

    const db = getDatabase();
    const results: Record<string, any> = {};

    // Fetch top members for each guild individually to prevent global limit overriding
    await Promise.all(
      guildIds.map(async (guildId: string) => {
        const topMembers = await db
          .select({
            userId: members.userId,
            xp: members.xp,
            level: members.level,
            messages: members.messages,
          })
          .from(members)
          .where(eq(members.guildId, guildId))
          .orderBy(desc(members.xp))
          .limit(limit)
          .execute();

        results[guildId] = topMembers.map(m => ({
          userId: m.userId,
          xp: m.xp || 0,
          level: m.level || 0,
          messages: m.messages || 0,
        }));
      })
    );

    res.json({
      guilds: results,
      total: Object.keys(results).length,
    });
  } catch (error) {
    logger.error('Error in batch members request:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch batch member data',
    });
  }
});

/**
 * POST /batch/stats
 * Fetch aggregated stats for multiple guilds
 */
router.post('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid request body' });
      return;
    }
    const { guildIds } = req.body;

    if (!guildIds || !Array.isArray(guildIds) || guildIds.length === 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'guildIds array is required',
      });
      return;
    }

    if (guildIds.length > 30) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Maximum 30 guilds per batch request',
      });
      return;
    }

    const results: Record<string, any> = {};

    // Check cache and Discord data
    for (const guildId of guildIds) {
      const cacheKey = `batch:stats:${guildId}`;
      const cached = cacheManager.get(cacheKey);

      if (cached) {
        results[guildId] = cached;
      } else {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          const stats = {
            memberCount: guild.memberCount,
            onlineCount: guild.members.cache.filter(m => m.presence?.status !== 'offline').size,
            boostLevel: guild.premiumTier,
            boostCount: guild.premiumSubscriptionCount || 0,
            channelCount: guild.channels.cache.size,
            roleCount: guild.roles.cache.size,
          };

          cacheManager.set(cacheKey, stats, CacheTTL.GUILD_DATA);
          results[guildId] = stats;
        }
      }
    }

    res.json({
      guilds: results,
      total: Object.keys(results).length,
    });
  } catch (error) {
    logger.error('Error in batch stats request:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch batch stats',
    });
  }
});

export const batchRouter = router;
