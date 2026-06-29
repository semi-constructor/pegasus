import os from 'os';
import * as si from 'systeminformation';
import { client } from '../../index';
import { getDatabase } from '../../database/connection';
import { economyTransactions, members, modCases, tickets, giveaways } from '../../database/schema';
import { sql, gte } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { cacheManager, CacheTTL } from '../middleware/cache';

interface AggregatedStats {
  bot: {
    status: string;
    uptime: number;
    startedAt: string;
    latency: number;
    shardCount: number;
  };
  guilds: {
    total: number;
    large: number;
    voiceActive: number;
  };
  users: {
    total: number;
    unique: number;
    activeToday: number;
    online: number;
  };
  commands: {
    totalExecuted: number;
    today: number;
    thisHour: number;
    perMinute: number;
    topCommands: Array<{ name: string; count: number }>;
  };
  system: {
    memoryUsage: number;
    memoryTotal: number;
    cpuUsage: number;
  };
  features: {
    economy: { active: number; transactions: number };
    moderation: { cases: number; activeWarnings: number };
    tickets: { open: number; total: number };
    giveaways: { active: number; participants: number };
    xp: { activeUsers: number };
  };
}

class StatsAggregator {
  private stats: AggregatedStats | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private intervalMs: number = 5000;
  private commandStats = {
    total: 0,
    today: 0,
    thisHour: 0,
    lastHourReset: Date.now(),
    lastDayReset: Date.now(),
    recentCommands: [] as number[],
    commandCounts: new Map<string, number>(),
  };
  private botStartTime = Date.now();
  private lastUpdate = 0;

  /**
   * Start the aggregator with specified interval
   */
  start(intervalMs: number = 5000): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.intervalMs = intervalMs;

    // Initial update
    this.updateStats();

    // Schedule periodic updates
    this.updateInterval = setInterval(() => {
      this.updateStats();
    }, intervalMs);

    logger.info(`Stats aggregator started with ${intervalMs}ms interval`);
  }

  /**
   * Stop the aggregator
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    logger.info('Stats aggregator stopped');
  }

  /**
   * Update all statistics
   */
  private async updateStats(): Promise<void> {
    try {
      const startTime = Date.now();

      // Update time-based resets
      this.resetTimeBasedCounters();

      // Gather all stats in parallel
      const [botStats, guildStats, userStats, commandStats, systemStats, featureStats] =
        await Promise.all([
          this.getBotStats(),
          this.getGuildStats(),
          this.getUserStats(),
          this.getCommandStats(),
          this.getSystemStats(),
          this.getFeatureStats(),
        ]);

      this.stats = {
        bot: botStats,
        guilds: guildStats,
        users: userStats,
        commands: commandStats,
        system: systemStats,
        features: featureStats,
      };

      // Cache the aggregated stats
      cacheManager.set('stats:aggregated', this.stats, CacheTTL.STATS);

      this.lastUpdate = Date.now();
      const updateTime = Date.now() - startTime;

      // Only warn if aggregation takes more than 80% of the interval
      // or if it takes more than 2 seconds regardless of interval
      const warningThreshold = Math.min(this.intervalMs * 0.8, 2000);

      if (updateTime > warningThreshold) {
        logger.warn(`Stats aggregation took ${updateTime}ms (interval: ${this.intervalMs}ms)`);
      } else if (updateTime > this.intervalMs * 0.5) {
        // Debug level for moderately slow aggregations (more than 50% of interval)
        logger.debug(`Stats aggregation took ${updateTime}ms`);
      }
    } catch (error) {
      logger.error('Error updating stats:', error);
    }
  }

  /**
   * Get bot statistics
   */
  private async getBotStats() {
    return {
      status: client.ws.status === 0 ? 'online' : 'connecting',
      uptime: Date.now() - this.botStartTime,
      startedAt: new Date(this.botStartTime).toISOString(),
      latency: client.ws.ping,
      shardCount: client.ws.shards.size,
    };
  }

  /**
   * Get guild statistics
   */
  private async getGuildStats() {
    const guilds = client.guilds.cache;

    return {
      total: guilds.size,
      large: guilds.filter(g => g.large).size,
      voiceActive: guilds.filter(g => g.members.cache.some(m => m.voice.channel)).size,
    };
  }

  /**
   * Get user statistics
   */
  private async getUserStats() {
    const guilds = client.guilds.cache;
    const totalUsers = guilds.reduce((acc, guild) => acc + guild.memberCount, 0);

    const uniqueUsers = new Set<string>();
    let onlineUsers = 0;

    guilds.forEach(guild => {
      guild.members.cache.forEach(member => {
        if (!member.user.bot) {
          uniqueUsers.add(member.user.id);
          if (member.presence?.status !== 'offline') {
            onlineUsers++;
          }
        }
      });
    });

    // Get active users from database (cached query)
    let activeToday = 0;

    try {
      const db = getDatabase();
      const twentyFourHoursAgo = new Date(Date.now() - 86400000);

      const activeUsersResult = await db
        .select({ count: sql<number>`COUNT(DISTINCT user_id)` })
        .from(members)
        .where(gte(members.updatedAt, twentyFourHoursAgo))
        .execute();

      if (activeUsersResult[0]) {
        activeToday = Number(activeUsersResult[0].count) || 0;
      }
    } catch (error) {
      logger.debug('Failed to get active users from database');
    }

    return {
      total: totalUsers,
      unique: uniqueUsers.size,
      activeToday,
      online: onlineUsers,
    };
  }

  /**
   * Get command statistics
   */
  private async getCommandStats() {
    // Calculate commands per minute from recent commands
    const oneMinuteAgo = Date.now() - 60000;
    const recentCommands = this.commandStats.recentCommands.filter(t => t > oneMinuteAgo);
    this.commandStats.recentCommands = recentCommands;

    // Get top commands
    const topCommands = Array.from(this.commandStats.commandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Only return actual executed commands without mock defaults

    return {
      totalExecuted: this.commandStats.total,
      today: this.commandStats.today,
      thisHour: this.commandStats.thisHour,
      perMinute: recentCommands.length,
      topCommands: topCommands.slice(0, 5),
    };
  }

  /**
   * Get system statistics
   */
  private async getSystemStats() {
    const memTotal = os.totalmem();
    const memFree = os.freemem();
    const memUsage = memTotal - memFree;

    // Real CPU usage calculation using systeminformation
    const cpuUsageData = await si.currentLoad().catch(() => ({ currentLoad: 0 }));

    return {
      memoryUsage: memUsage,
      memoryTotal: memTotal,
      cpuUsage: Math.round(cpuUsageData.currentLoad),
    };
  }

  /**
   * Get feature statistics
   */
  private async getFeatureStats() {
    const stats = {
      economy: { active: 0, transactions: 0 },
      moderation: { cases: 0, activeWarnings: 0 },
      tickets: { open: 0, total: 0 },
      giveaways: { active: 0, participants: 0 },
      xp: { activeUsers: 0 },
    };

    try {
      const db = getDatabase();
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

      // Run queries in parallel
      const [economyStats, moderationStats, ticketStats, giveawayStats, xpStats] =
        await Promise.all([
          // Economy stats
          db
            .select({
              transactions: sql<number>`COUNT(*)`,
              active: sql<number>`COUNT(DISTINCT user_id)`,
            })
            .from(economyTransactions)
            .where(gte(economyTransactions.createdAt, sevenDaysAgo))
            .execute(),

          // Moderation stats
          db
            .select({
              cases: sql<number>`COUNT(*)`,
              warnings: sql<number>`COUNT(*) FILTER (WHERE type = 'warn')`,
            })
            .from(modCases)
            .where(gte(modCases.createdAt, sevenDaysAgo))
            .execute(),

          // Ticket stats
          db
            .select({
              open: sql<number>`COUNT(*) FILTER (WHERE status = 'open')`,
              total: sql<number>`COUNT(*)`,
            })
            .from(tickets)
            .execute(),

          // Giveaway stats
          db
            .select({
              active: sql<number>`COUNT(*) FILTER (WHERE status = 'active' AND end_time > NOW())`,
              total: sql<number>`COUNT(*)`,
            })
            .from(giveaways)
            .execute(),

          // XP stats
          db
            .select({
              active: sql<number>`COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '7 days')`,
            })
            .from(members)
            .execute(),
        ]);

      // Update stats object
      if (economyStats[0]) {
        stats.economy.transactions = Number(economyStats[0].transactions) || 0;
        stats.economy.active = Number(economyStats[0].active) || 0;
      }

      if (moderationStats[0]) {
        stats.moderation.cases = Number(moderationStats[0].cases) || 0;
        stats.moderation.activeWarnings = Number(moderationStats[0].warnings) || 0;
      }

      if (ticketStats[0]) {
        stats.tickets.open = Number(ticketStats[0].open) || 0;
        stats.tickets.total = Number(ticketStats[0].total) || 0;
      }

      if (giveawayStats[0]) {
        stats.giveaways.active = Number(giveawayStats[0].active) || 0;
      }

      if (xpStats[0]) {
        stats.xp.activeUsers = Number(xpStats[0].active) || 0;
      }
    } catch (error) {
      logger.debug('Failed to get feature stats from database, using defaults');
    }

    return stats;
  }

  /**
   * Reset time-based counters
   */
  private resetTimeBasedCounters(): void {
    const now = Date.now();

    // Reset hourly counter
    if (now - this.commandStats.lastHourReset > 3600000) {
      this.commandStats.thisHour = 0;
      this.commandStats.lastHourReset = now;
    }

    // Reset daily counter
    if (now - this.commandStats.lastDayReset > 86400000) {
      this.commandStats.today = 0;
      this.commandStats.lastDayReset = now;
    }
  }

  /**
   * Increment command counter
   */
  incrementCommand(commandName?: string): void {
    this.commandStats.total++;
    this.commandStats.today++;
    this.commandStats.thisHour++;
    this.commandStats.recentCommands.push(Date.now());

    if (commandName) {
      const current = this.commandStats.commandCounts.get(commandName) || 0;
      this.commandStats.commandCounts.set(commandName, current + 1);
    }

    // Keep recent commands list under control
    if (this.commandStats.recentCommands.length > 100) {
      const oneMinuteAgo = Date.now() - 60000;
      this.commandStats.recentCommands = this.commandStats.recentCommands.filter(
        t => t > oneMinuteAgo
      );
    }
  }

  /**
   * Get current aggregated stats
   */
  getStats(): AggregatedStats | null {
    // Return cached stats if available and fresh
    const cached = cacheManager.get('stats:aggregated');
    if (cached) {
      return cached as AggregatedStats;
    }

    return this.stats;
  }

  /**
   * Force refresh stats
   */
  async refresh(): Promise<AggregatedStats | null> {
    await this.updateStats();
    return this.stats;
  }

  /**
   * Get stats age
   */
  getStatsAge(): number {
    return Date.now() - this.lastUpdate;
  }
}

// Export singleton instance
export const statsAggregator = new StatsAggregator();

// Export function to track commands (to be called from command handler)
export function trackCommand(commandName: string): void {
  statsAggregator.incrementCommand(commandName);
}
