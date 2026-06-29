import { Router, Request, Response } from 'express';
import { statsAggregator } from '../services/statsAggregator';
import { logger } from '../../utils/logger';

const router = Router();

// Legacy function for backward compatibility
export function incrementCommandCount() {
  statsAggregator.incrementCommand();
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    // Get aggregated stats (already cached)
    let stats = statsAggregator.getStats();

    // If stats are not available or too old, force refresh
    if (!stats || statsAggregator.getStatsAge() > 5000) {
      stats = await statsAggregator.refresh();
    }

    if (!stats) {
      throw new Error('Failed to retrieve stats');
    }

    // Format response to match existing API structure
    const response = {
      status: stats.bot.status,
      uptime: stats.bot.uptime,
      started_at: stats.bot.startedAt,
      guilds: {
        total: stats.guilds.total,
        large: stats.guilds.large,
        voice_active: stats.guilds.voiceActive,
      },
      users: {
        total: stats.users.total,
        unique: stats.users.unique,
        active_today: stats.users.activeToday,
        online: stats.users.online,
      },
      commands: {
        total_executed: stats.commands.totalExecuted,
        today: stats.commands.today,
        this_hour: stats.commands.thisHour,
        per_minute: stats.commands.perMinute,
        most_used: stats.commands.topCommands,
      },
      system: {
        memory_usage: stats.system.memoryUsage,
        memory_total: stats.system.memoryTotal,
        cpu_usage: stats.system.cpuUsage,
        latency: stats.bot.latency,
        shard_count: stats.bot.shardCount,
      },
      features: {
        music: false,
        moderation: true,
        economy: true,
        leveling: true,
        giveaways: true,
        tickets: true,
        // Add feature activity stats
        activity: {
          economy: stats.features.economy,
          moderation: stats.features.moderation,
          tickets: stats.features.tickets,
          giveaways: stats.features.giveaways,
          xp: stats.features.xp,
        },
      },
      version: process.env.npm_package_version || '1.0.0',
      cache_age: statsAggregator.getStatsAge(),
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching bot stats:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch bot statistics',
    });
  }
});

export const statsRouter = router;
