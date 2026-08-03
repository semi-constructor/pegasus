import { Router, Request, Response } from 'express';
import { client } from '../../index';
import { db } from '../../database/connection';
import { sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { getDetailedSystemInfo, getProcessInfo } from '../utils/systemInfo';
import { crossShardService } from '../../services/crossShardService';

const router = Router();

interface SystemStatus {
  bot: {
    username: string | null;
    id: string | null;
    status: string;
    uptime: number;
    guilds: number;
    users: number;
    channels: number;
    commands: number;
    ping: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  system: any;
  cpu: any;
  memory: any;
  gpu: any;
  disk: any;
  network: any;
  processes: any;
  docker: any;
  services: {
    discord: {
      connected: boolean;
      latency: number;
      shards: Array<{
        id: number;
        status: string;
        ping: number;
      }>;
    };
    database: {
      connected: boolean;
      latency: number;
      size: number;
      pool: {
        total: number;
        idle: number;
        waiting: number;
      };
    };
    apis: {
      steam: {
        available: boolean;
        latency: number | null;
      };
      weather: {
        available: boolean;
        latency: number | null;
      };
      news: {
        available: boolean;
        latency: number | null;
      };
    };
  };
  timestamp: string;
}

async function getDatabaseLatency(): Promise<number> {
  const start = Date.now();
  try {
    const database = db();
    await database.select().from(sql`(SELECT 1) as t`);
    return Date.now() - start;
  } catch (error) {
    logger.error('Database ping failed:', error);
    return -1;
  }
}

async function getDatabaseSize(): Promise<number> {
  try {
    const database = db();
    const result = await database.execute(sql`SELECT pg_database_size(current_database()) as size`);
    return Number(result[0].size);
  } catch (error) {
    logger.error('Database size query failed:', error);
    return 0;
  }
}

async function getApiLatency(url: string): Promise<number | null> {
  if (!url) return null;

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    await fetch(url, {
      signal: controller.signal,
      method: 'HEAD',
    });

    clearTimeout(timeout);
    return Date.now() - start;
  } catch {
    return null;
  }
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const systemInfo = await getDetailedSystemInfo();
    const botProcess = await getProcessInfo(process.pid);

    const dbLatency = await getDatabaseLatency();
    const dbSize = await getDatabaseSize();

    const steamLatency = process.env.STEAM_API_KEY
      ? await getApiLatency('https://api.steampowered.com/ISteamWebAPIUtil/GetServerInfo/v1/')
      : null;

    const weatherLatency = process.env.WEATHER_API_KEY
      ? await getApiLatency('https://api.openweathermap.org/data/2.5/weather?q=London')
      : null;

    const newsLatency = process.env.NEWS_API_KEY
      ? await getApiLatency('https://newsapi.org/v2/top-headlines?country=us')
      : null;

    const botMemory = botProcess
      ? {
          used: botProcess.memoryRss || 0,
          total: systemInfo.memory.total,
          percentage: botProcess.memoryRss
            ? (botProcess.memoryRss / systemInfo.memory.total) * 100
            : 0,
        }
      : {
          used: 0,
          total: systemInfo.memory.total,
          percentage: 0,
        };

    const [totalGuilds, totalUsers, totalChannels, shardStats] = await Promise.all([
      crossShardService.getTotalGuildsCount(client),
      crossShardService.getTotalUsersCount(client),
      crossShardService.getTotalChannelsCount(client),
      crossShardService.getShardStats(client),
    ]);

    const avgPing =
      shardStats.length > 0
        ? Math.round(shardStats.reduce((a, b) => a + (b.ping < 0 ? 0 : b.ping), 0) / shardStats.length)
        : client.ws.ping;

    const status: SystemStatus = {
      bot: {
        username: client.user?.username || null,
        id: client.user?.id || null,
        status: client.user ? 'online' : 'offline',
        uptime: client.uptime || 0,
        guilds: totalGuilds,
        users: totalUsers,
        channels: totalChannels,
        commands: client.commands?.size || 0,
        ping: avgPing,
        memory: botMemory,
      },
      system: systemInfo.os,
      cpu: systemInfo.cpu,
      memory: systemInfo.memory,
      gpu: systemInfo.gpu,
      disk: systemInfo.disk,
      network: systemInfo.network,
      processes: systemInfo.processes,
      docker: systemInfo.docker,
      services: {
        discord: {
          connected: client.ws.status === 0,
          latency: avgPing,
          shards: shardStats.map(s => ({
            id: s.id,
            status: s.statusText,
            ping: s.ping,
          })),
        },
        database: {
          connected: dbLatency >= 0,
          latency: dbLatency,
          size: dbSize,
          pool: {
            total: 20,
            idle: 0,
            waiting: 0,
          },
        },
        apis: {
          steam: {
            available: !!process.env.STEAM_API_KEY,
            latency: steamLatency,
          },
          weather: {
            available: !!process.env.WEATHER_API_KEY,
            latency: weatherLatency,
          },
          news: {
            available: !!process.env.NEWS_API_KEY,
            latency: newsLatency,
          },
        },
      },
      timestamp: new Date().toISOString(),
    };

    res.json(status);
  } catch (error) {
    logger.error('Error fetching system status:', error);
    res.status(500).json({
      error: 'Failed to fetch system status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as statusRouter };
