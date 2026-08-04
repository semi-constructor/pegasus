import { Router, Request, Response } from 'express';
import { sql, eq, and, gte, desc } from 'drizzle-orm';
import { statsAggregator } from '../services/statsAggregator';
import { logger } from '../../utils/logger';
import { client } from '../../index';
import { crossShardService } from '../../services/crossShardService';
import { getDatabase } from '../../database/connection';
import {
  guilds as guildsTable,
  guildSettings,
  tickets,
  modCases,
  economyBalances,
  economyTransactions,
  members,
  userXp,
  xpRewards,
  ticketPanels,
} from '../../database/schema';

const router = Router();

router.get('/overview', async (_req: Request, res: Response) => {
  try {
    let stats = statsAggregator.getStats();

    if (!stats || statsAggregator.getStatsAge() > 5000) {
      stats = await statsAggregator.refresh();
    }

    if (!stats) {
      throw new Error('Aggregated statistics are unavailable');
    }

    const db = getDatabase();

    const [
      settingsCount,
      ticketTotals,
      moderationTotals,
      recentTickets,
      recentCases,
      recentTransactions,
    ] = await Promise.all([
      db
        .select({
          configured: sql<number>`COUNT(*)`,
        })
        .from(guildSettings)
        .execute()
        .then(rows => Number(rows?.[0]?.configured ?? 0)),
      db
        .select({
          total: sql<number>`COUNT(*)`,
          open: sql<number>`COUNT(*) FILTER (WHERE ${tickets.status} = 'open')`,
          closed: sql<number>`COUNT(*) FILTER (WHERE ${tickets.status} = 'closed')`,
        })
        .from(tickets)
        .execute()
        .then(rows => ({
          total: Number(rows?.[0]?.total ?? 0),
          open: Number(rows?.[0]?.open ?? 0),
          closed: Number(rows?.[0]?.closed ?? 0),
        })),
      db
        .select({
          total: sql<number>`COUNT(*)`,
          warnings: sql<number>`COUNT(*) FILTER (WHERE ${modCases.type} = 'warn')`,
          bans: sql<number>`COUNT(*) FILTER (WHERE ${modCases.type} = 'ban')`,
          mutes: sql<number>`COUNT(*) FILTER (WHERE ${modCases.type} = 'mute')`,
          kicks: sql<number>`COUNT(*) FILTER (WHERE ${modCases.type} = 'kick')`,
        })
        .from(modCases)
        .execute()
        .then(rows => ({
          total: Number(rows?.[0]?.total ?? 0),
          warnings: Number(rows?.[0]?.warnings ?? 0),
          bans: Number(rows?.[0]?.bans ?? 0),
          mutes: Number(rows?.[0]?.mutes ?? 0),
          kicks: Number(rows?.[0]?.kicks ?? 0),
        })),
      db
        .select({
          id: tickets.id,
          guildId: tickets.guildId,
          status: tickets.status,
          createdAt: tickets.createdAt,
        })
        .from(tickets)
        .orderBy(desc(tickets.createdAt))
        .limit(5),
      db
        .select({
          id: modCases.id,
          guildId: modCases.guildId,
          type: modCases.type,
          createdAt: modCases.createdAt,
        })
        .from(modCases)
        .orderBy(desc(modCases.createdAt))
        .limit(5),
      db
        .select({
          id: economyTransactions.id,
          guildId: economyTransactions.guildId,
          type: economyTransactions.type,
          amount: economyTransactions.amount,
          createdAt: economyTransactions.createdAt,
        })
        .from(economyTransactions)
        .orderBy(desc(economyTransactions.createdAt))
        .limit(5),
    ]);

    let topGuilds: any[] = [];
    if (crossShardService.isSharded(client)) {
      const nestedGuilds = await crossShardService.broadcastEval(client, (c: any) => {
        return c.guilds.cache.map((guild: any) => ({
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL({ size: 256 }) ?? null,
          memberCount: guild.memberCount,
          approximatePresence: guild.members.cache.filter(
            (member: any) =>
              !member.user.bot && member.presence?.status && member.presence.status !== 'offline'
          ).size,
          premiumTier: guild.premiumTier,
          boosters: guild.premiumSubscriptionCount ?? 0,
          large: guild.large,
        }));
      });
      topGuilds = nestedGuilds.flat();
    } else {
      topGuilds = client.guilds.cache.map(guild => ({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ size: 256 }) ?? null,
        memberCount: guild.memberCount,
        approximatePresence: guild.members.cache.filter(
          member =>
            !member.user.bot && member.presence?.status && member.presence.status !== 'offline'
        ).size,
        premiumTier: guild.premiumTier,
        boosters: guild.premiumSubscriptionCount ?? 0,
        large: guild.large,
      }));
    }

    topGuilds = topGuilds
      .sort((a: any, b: any) => (b.memberCount ?? 0) - (a.memberCount ?? 0))
      .slice(0, 5);

    res.json({
      bot: stats.bot,
      guilds: {
        ...stats.guilds,
        configured: settingsCount,
        top: topGuilds,
      },
      users: stats.users,
      commands: stats.commands,
      system: stats.system,
      features: stats.features,
      totals: {
        tickets: ticketTotals,
        moderation: moderationTotals,
        guildSettingsConfigured: settingsCount,
      },
      recentActivity: {
        tickets: recentTickets.map(entry => ({
          id: entry.id,
          guildId: entry.guildId,
          status: entry.status,
          createdAt: entry.createdAt.toISOString(),
        })),
        moderation: recentCases.map(entry => ({
          id: entry.id,
          guildId: entry.guildId,
          type: entry.type,
          createdAt: entry.createdAt.toISOString(),
        })),
        economy: recentTransactions.map(entry => ({
          id: entry.id,
          guildId: entry.guildId,
          type: entry.type,
          amount: Number(entry.amount ?? 0),
          createdAt: entry.createdAt.toISOString(),
        })),
      },
      cacheAge: statsAggregator.getStatsAge(),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error building dashboard overview:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to build dashboard overview',
    });
  }
});

router.get('/guilds', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const offset = Number(req.query.offset) || 0;
    const search = (req.query.search as string | undefined)?.toLowerCase();

    const db = getDatabase();
    const configuredGuilds = await db
      .select({ guildId: guildSettings.guildId })
      .from(guildSettings);
    const configuredSet = new Set(configuredGuilds.map(entry => entry.guildId));

    let guildsArray: any[] = [];
    if (crossShardService.isSharded(client)) {
      const nestedGuilds = await crossShardService.broadcastEval(
        client,
        (c: any, { confSet }) => {
          const set = new Set(confSet);
          return c.guilds.cache.map((guild: any) => ({
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL({ size: 128 }) ?? null,
            memberCount: guild.memberCount,
            textChannelCount: guild.channels.cache.filter((channel: any) => channel.isTextBased())
              .size,
            voiceChannelCount: guild.channels.cache.filter((channel: any) => channel.isVoiceBased())
              .size,
            roleCount: guild.roles.cache.size,
            large: guild.large,
            premiumTier: guild.premiumTier,
            boosters: guild.premiumSubscriptionCount ?? 0,
            configured: set.has(guild.id),
            onlineMembers: guild.members.cache.filter(
              (member: any) =>
                !member.user.bot && member.presence?.status && member.presence.status !== 'offline'
            ).size,
            botMembers: guild.members.cache.filter((member: any) => member.user.bot).size,
          }));
        },
        { confSet: Array.from(configuredSet) }
      );
      guildsArray = nestedGuilds.flat();
    } else {
      guildsArray = client.guilds.cache.map(guild => ({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ size: 128 }) ?? null,
        memberCount: guild.memberCount,
        textChannelCount: guild.channels.cache.filter(channel => channel.isTextBased()).size,
        voiceChannelCount: guild.channels.cache.filter(channel => channel.isVoiceBased()).size,
        roleCount: guild.roles.cache.size,
        large: guild.large,
        premiumTier: guild.premiumTier,
        boosters: guild.premiumSubscriptionCount ?? 0,
        configured: configuredSet.has(guild.id),
        onlineMembers: guild.members.cache.filter(
          member =>
            !member.user.bot && member.presence?.status && member.presence.status !== 'offline'
        ).size,
        botMembers: guild.members.cache.filter(member => member.user.bot).size,
      }));
    }

    if (search) {
      guildsArray = guildsArray.filter(
        guild => guild.name.toLowerCase().includes(search) || guild.id.includes(search)
      );
    }

    const total = guildsArray.length;
    const results = guildsArray.slice(offset, offset + limit);

    res.json({
      total,
      limit,
      offset,
      results,
    });
  } catch (error) {
    logger.error('Error fetching dashboard guild list:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch guild list',
    });
  }
});

router.get('/guilds/:guildId/overview', async (req: Request, res: Response) => {
  const { guildId } = req.params;

  try {
    let guild = client.guilds.cache.get(guildId) as any;
    if (!guild) {
      guild = await crossShardService.fetchGuild(client, guildId);
    }

    if (!guild) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Guild is not managed by this bot instance',
      });
      return;
    }

    const db = getDatabase();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      guildRecord,
      settings,
      moderationStats,
      ticketStats,
      economyStats,
      xpStats,
      ticketsPanelCount,
      recentModeration,
      recentTickets,
      recentEconomy,
      memberActivity,
      xpRewardCount,
    ] = await Promise.all([
      db
        .select()
        .from(guildsTable)
        .where(eq(guildsTable.id, guildId))
        .limit(1)
        .then(rows => rows[0] ?? null),
      db
        .select()
        .from(guildSettings)
        .where(eq(guildSettings.guildId, guildId))
        .limit(1)
        .then(rows => rows[0] ?? null),
      db
        .select({
          total: sql<number>`COUNT(*)`,
          warnings: sql<number>`COUNT(*) FILTER (WHERE ${modCases.type} = 'warn')`,
          bans: sql<number>`COUNT(*) FILTER (WHERE ${modCases.type} = 'ban')`,
          mutes: sql<number>`COUNT(*) FILTER (WHERE ${modCases.type} = 'mute')`,
          kicks: sql<number>`COUNT(*) FILTER (WHERE ${modCases.type} = 'kick')`,
        })
        .from(modCases)
        .where(eq(modCases.guildId, guildId))
        .execute()
        .then(rows => ({
          total: Number(rows?.[0]?.total ?? 0),
          warnings: Number(rows?.[0]?.warnings ?? 0),
          bans: Number(rows?.[0]?.bans ?? 0),
          mutes: Number(rows?.[0]?.mutes ?? 0),
          kicks: Number(rows?.[0]?.kicks ?? 0),
        })),
      db
        .select({
          total: sql<number>`COUNT(*)`,
          open: sql<number>`COUNT(*) FILTER (WHERE ${tickets.status} = 'open')`,
          closed: sql<number>`COUNT(*) FILTER (WHERE ${tickets.status} = 'closed')`,
          avgResolutionSeconds: sql<number>`
            COALESCE(AVG(EXTRACT(EPOCH FROM (${tickets.closedAt} - ${tickets.createdAt}))), 0)
          `,
        })
        .from(tickets)
        .where(eq(tickets.guildId, guildId))
        .execute()
        .then(rows => ({
          total: Number(rows?.[0]?.total ?? 0),
          open: Number(rows?.[0]?.open ?? 0),
          closed: Number(rows?.[0]?.closed ?? 0),
          avgResolutionSeconds: Number(rows?.[0]?.avgResolutionSeconds ?? 0),
        })),
      db
        .select({
          participants: sql<number>`COUNT(*)`,
          totalBalance: sql<number>`COALESCE(SUM(${economyBalances.balance} + ${economyBalances.bankBalance}), 0)`,
          averageBalance: sql<number>`COALESCE(AVG(${economyBalances.balance} + ${economyBalances.bankBalance}), 0)`,
        })
        .from(economyBalances)
        .where(eq(economyBalances.guildId, guildId))
        .execute()
        .then(rows => ({
          participants: Number(rows?.[0]?.participants ?? 0),
          totalBalance: Number(rows?.[0]?.totalBalance ?? 0),
          averageBalance: Number(rows?.[0]?.averageBalance ?? 0),
        })),
      db
        .select({
          tracked: sql<number>`COUNT(*)`,
          avgLevel: sql<number>`COALESCE(AVG(${userXp.level}), 0)`,
        })
        .from(userXp)
        .where(eq(userXp.guildId, guildId))
        .execute()
        .then(rows => ({
          tracked: Number(rows?.[0]?.tracked ?? 0),
          avgLevel: Number(rows?.[0]?.avgLevel ?? 0),
        })),
      db
        .select({
          count: sql<number>`COUNT(*)`,
        })
        .from(ticketPanels)
        .where(eq(ticketPanels.guildId, guildId))
        .execute()
        .then(rows => Number(rows?.[0]?.count ?? 0)),
      db
        .select({
          id: modCases.id,
          type: modCases.type,
          reason: modCases.reason,
          createdAt: modCases.createdAt,
        })
        .from(modCases)
        .where(eq(modCases.guildId, guildId))
        .orderBy(desc(modCases.createdAt))
        .limit(5),
      db
        .select({
          id: tickets.id,
          status: tickets.status,
          createdAt: tickets.createdAt,
        })
        .from(tickets)
        .where(eq(tickets.guildId, guildId))
        .orderBy(desc(tickets.createdAt))
        .limit(5),
      db
        .select({
          id: economyTransactions.id,
          type: economyTransactions.type,
          amount: economyTransactions.amount,
          createdAt: economyTransactions.createdAt,
        })
        .from(economyTransactions)
        .where(eq(economyTransactions.guildId, guildId))
        .orderBy(desc(economyTransactions.createdAt))
        .limit(5),
      db
        .select({
          activeMembers: sql<number>`COUNT(DISTINCT ${members.userId})`,
        })
        .from(members)
        .where(and(eq(members.guildId, guildId), gte(members.updatedAt, sevenDaysAgo))),
      db
        .select({
          rewards: sql<number>`COUNT(*)`,
        })
        .from(xpRewards)
        .where(eq(xpRewards.guildId, guildId))
        .execute()
        .then(rows => Number(rows?.[0]?.rewards ?? 0)),
    ]);

    const owner = await guild.fetchOwner().catch(() => null);

    res.json({
      guild: {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ size: 256 }) ?? null,
        memberCount: guild.memberCount,
        approximatePresence: guild.members?.cache
          ? guild.members.cache.filter(
              (member: any) =>
                !member.user?.bot && member.presence?.status && member.presence.status !== 'offline'
            ).size
          : 0,
        premiumTier: guild.premiumTier,
        boosters: guild.premiumSubscriptionCount ?? 0,
        shardId: guild.shardId,
        owner: owner
          ? {
              id: owner.id,
              tag: owner.user.tag,
            }
          : null,
        createdAt: guild.createdAt?.toISOString() ?? null,
      },
      settings: {
        prefix: guildRecord?.prefix ?? '!',
        language: guildRecord?.language ?? 'en',
        welcomeEnabled: settings?.welcomeEnabled ?? false,
        goodbyeEnabled: settings?.goodbyeEnabled ?? false,
        logsEnabled: settings?.logsEnabled ?? false,
        xpEnabled: settings?.xpEnabled ?? false,
        securityEnabled: settings?.securityEnabled ?? false,
        autoroleEnabled: settings?.autoroleEnabled ?? false,
      },
      metrics: {
        moderation: moderationStats,
        tickets: {
          ...ticketStats,
          panelsConfigured: ticketsPanelCount,
        },
        economy: economyStats,
        xp: {
          ...xpStats,
          rewardsConfigured: xpRewardCount,
        },
        engagement: {
          activeMembers7d: Number(memberActivity?.[0]?.activeMembers ?? 0),
        },
      },
      recentActivity: {
        moderation: recentModeration.map(entry => ({
          id: entry.id,
          type: entry.type,
          reason: entry.reason ?? null,
          createdAt: entry.createdAt.toISOString(),
        })),
        tickets: recentTickets.map(entry => ({
          id: entry.id,
          status: entry.status,
          createdAt: entry.createdAt.toISOString(),
        })),
        economy: recentEconomy.map(entry => ({
          id: entry.id,
          type: entry.type,
          amount: Number(entry.amount ?? 0),
          createdAt: entry.createdAt.toISOString(),
        })),
      },
      modules: {
        moderation: {
          enabled: true,
          totalCases: moderationStats.total,
          warnings: moderationStats.warnings,
        },
        tickets: {
          enabled: ticketStats.total > 0 || ticketsPanelCount > 0,
          openTickets: ticketStats.open,
          panelsConfigured: ticketsPanelCount,
        },
        economy: {
          enabled: economyStats.participants > 0,
          participants: economyStats.participants,
          totalBalance: economyStats.totalBalance,
        },
        xp: {
          enabled: settings?.xpEnabled ?? false,
          trackedUsers: xpStats.tracked,
          averageLevel: xpStats.avgLevel,
          rewardsConfigured: xpRewardCount,
        },
        onboarding: {
          welcomeEnabled: settings?.welcomeEnabled ?? false,
          goodbyeEnabled: settings?.goodbyeEnabled ?? false,
          autoroleEnabled: settings?.autoroleEnabled ?? false,
        },
        security: {
          enabled: settings?.securityEnabled ?? false,
        },
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Error fetching dashboard data for guild ${guildId}:`, error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch guild overview',
    });
  }
});

export const dashboardRouter = router;
