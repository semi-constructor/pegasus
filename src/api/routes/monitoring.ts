import { Router, Request, Response } from 'express';
import { cacheManager } from '../middleware/cache';
import { getRateLimiterStatus } from '../middleware/rateLimiter';
import { statsAggregator } from '../services/statsAggregator';
import { queryOptimizer } from '../utils/queryOptimizer';
import { logger } from '../../utils/logger';
import os from 'os';

const router = Router();

/**
 * GET /monitoring/health
 * Comprehensive health check
 */
router.get('/health', async (_req: Request, res: Response): Promise<void> => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: os.uptime(),
      services: {
        cache: cacheManager.getStats(),
        rateLimiter: getRateLimiterStatus(),
        statsAggregator: {
          running: true,
          lastUpdate: statsAggregator.getStatsAge(),
          stats: statsAggregator.getStats() !== null,
        },
        database: {
          pool: queryOptimizer.getPoolStats(),
        },
      },
      system: {
        memory: {
          used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
          total: Math.round(os.totalmem() / 1024 / 1024),
          system: Math.round(os.totalmem() / 1024 / 1024),
          free: Math.round(os.freemem() / 1024 / 1024),
        },
        cpu: {
          cores: os.cpus().length,
          model: os.cpus()[0]?.model,
          load: os.loadavg(),
        },
      },
    };

    res.json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /monitoring/metrics
 * Performance metrics
 */
router.get('/metrics', async (_req: Request, res: Response): Promise<void> => {
  try {
    const cacheStats = cacheManager.getStats();
    const rateLimitStats = getRateLimiterStatus();
    const queryMetrics = queryOptimizer.getMetrics();
    const slowQueries = queryOptimizer.getSlowQueries();
    const poolStats = queryOptimizer.getPoolStats();

    const metrics = {
      timestamp: new Date().toISOString(),
      cache: {
        ...cacheStats,
        efficiency: cacheStats.hitRate.toFixed(2) + '%',
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      },
      rateLimit: {
        ...rateLimitStats,
        description: 'Number of IP addresses being rate limited',
      },
      database: {
        pool: poolStats,
        queries: {
          total: queryMetrics.length,
          slowQueries: slowQueries.length,
          avgResponseTime:
            queryMetrics.length > 0
              ? (queryMetrics.reduce((sum, m) => sum + m.avgTime, 0) / queryMetrics.length).toFixed(
                  2
                ) + ' ms'
              : '0 ms',
        },
        topSlowQueries: slowQueries.slice(0, 5).map(q => ({
          name: q.query,
          avgTime: q.avgTime.toFixed(2) + ' ms',
          count: q.count,
          lastExecuted: q.lastExecuted.toISOString(),
        })),
      },
      aggregator: {
        updateInterval: '500ms',
        lastUpdate: statsAggregator.getStatsAge() + ' ms ago',
        healthy: statsAggregator.getStatsAge() < 2000,
      },
      api: {
        uptime: process.uptime(),
        requestsPerMinute: 'N/A', // Would need request tracking
        avgResponseTime: 'N/A', // Would need response time tracking
      },
    };

    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve metrics',
    });
  }
});

/**
 * GET /monitoring/cache
 * Cache statistics
 */
router.get('/cache', (_req: Request, res: Response): void => {
  const stats = cacheManager.getStats();

  res.json({
    ...stats,
    hitRate: `${stats.hitRate.toFixed(2)}%`,
    recommendation:
      stats.hitRate < 50
        ? 'Consider increasing cache TTL or reviewing cache keys'
        : 'Cache is performing well',
  });
});

/**
 * POST /monitoring/cache/clear
 * Clear cache (admin only)
 */
router.post('/cache/clear', (req: Request, res: Response): void => {
  const { pattern } = req.body;

  if (pattern) {
    const deleted = cacheManager.invalidatePattern(pattern);
    res.json({
      message: 'Cache entries cleared',
      pattern,
      deletedCount: deleted,
    });
  } else {
    cacheManager.clear();
    res.json({
      message: 'All cache entries cleared',
    });
  }
});

/**
 * GET /monitoring/queries
 * Database query performance
 */
router.get('/queries', (_req: Request, res: Response): void => {
  const metrics = queryOptimizer.getMetrics();
  const slowQueries = queryOptimizer.getSlowQueries();
  const poolStats = queryOptimizer.getPoolStats();

  res.json({
    pool: poolStats,
    totalQueries: metrics.length,
    queries: metrics.map(q => ({
      name: q.query,
      count: q.count,
      totalTime: `${q.totalTime.toFixed(2)} ms`,
      avgTime: `${q.avgTime.toFixed(2)} ms`,
      lastExecuted: q.lastExecuted.toISOString(),
    })),
    slowQueries: slowQueries.map(q => ({
      name: q.query,
      avgTime: `${q.avgTime.toFixed(2)} ms`,
      count: q.count,
      impact: q.totalTime > 1000 ? 'HIGH' : q.totalTime > 500 ? 'MEDIUM' : 'LOW',
    })),
    recommendations: generateQueryRecommendations(metrics, slowQueries),
  });
});

/**
 * POST /monitoring/queries/reset
 * Reset query metrics
 */
router.post('/queries/reset', (_req: Request, res: Response): void => {
  queryOptimizer.resetMetrics();
  res.json({
    message: 'Query metrics reset successfully',
  });
});

/**
 * GET /monitoring/rate-limits
 * Rate limiting status
 */
router.get('/rate-limits', (_req: Request, res: Response): void => {
  const status = getRateLimiterStatus();

  res.json({
    ...status,
    configuration: {
      global: '200 requests/minute per IP',
      perGuild: '10 requests/second per guild',
      stats: '2 requests/500ms (matching dashboard refresh)',
      batch: '5 requests/second',
    },
    recommendation:
      status.activeKeys > 100
        ? 'High number of rate-limited IPs. Consider reviewing rate limits or investigating potential abuse.'
        : 'Rate limiting is functioning normally',
  });
});

/**
 * GET /monitoring/dashboard
 * Combined monitoring dashboard data
 */
router.get('/dashboard', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [cacheStats, rateLimitStats, poolStats] = await Promise.all([
      Promise.resolve(cacheManager.getStats()),
      Promise.resolve(getRateLimiterStatus()),
      Promise.resolve(queryOptimizer.getPoolStats()),
    ]);

    const aggregatorStats = statsAggregator.getStats();

    res.json({
      timestamp: new Date().toISOString(),
      summary: {
        healthy: true,
        uptime: formatUptime(os.uptime()),
        cacheHitRate: `${cacheStats.hitRate.toFixed(1)}%`,
        activeConnections: poolStats.active,
        rateLimitedIPs: rateLimitStats.activeKeys,
      },
      performance: {
        cache: {
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          hitRate: cacheStats.hitRate,
          size: cacheStats.size,
        },
        database: {
          connections: `${poolStats.active}/${poolStats.total}`,
          waiting: poolStats.waitingRequests,
        },
        memory: {
          used: `${Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)} MB`,
          total: `${Math.round(os.totalmem() / 1024 / 1024)} MB`,
        },
      },
      traffic: {
        rateLimited: rateLimitStats.activeKeys,
        totalRateLimitKeys: rateLimitStats.totalKeys,
      },
      aggregator: aggregatorStats
        ? {
            guilds: aggregatorStats.guilds.total,
            users: aggregatorStats.users.total,
            commandsToday: aggregatorStats.commands.today,
            lastUpdate: `${statsAggregator.getStatsAge()}ms ago`,
          }
        : null,
    });
  } catch (error) {
    logger.error('Failed to get dashboard data:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve dashboard data',
    });
  }
});

/**
 * Helper function to generate query recommendations
 */
function generateQueryRecommendations(metrics: any[], slowQueries: any[]): string[] {
  const recommendations: string[] = [];

  if (slowQueries.length > 5) {
    recommendations.push(
      'Multiple slow queries detected. Consider adding indexes or optimizing query structure.'
    );
  }

  const highFrequencySlowQueries = metrics.filter(m => m.count > 100 && m.avgTime > 50);
  if (highFrequencySlowQueries.length > 0) {
    recommendations.push(
      `${highFrequencySlowQueries.length} high-frequency slow queries found. These should be prioritized for optimization.`
    );
  }

  const verySlowQueries = slowQueries.filter(q => q.avgTime > 500);
  if (verySlowQueries.length > 0) {
    recommendations.push(
      `${verySlowQueries.length} queries averaging over 500ms. Consider caching results or restructuring data access.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('Query performance is within acceptable parameters.');
  }

  return recommendations;
}

/**
 * Helper function to format uptime
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(' ') || '< 1m';
}

export const monitoringRouter = router;
