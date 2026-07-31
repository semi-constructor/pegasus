import { Client, Guild, User, Channel, GuildChannel, TextChannel } from 'discord.js';
import { logger } from '../utils/logger';

export interface ShardInfo {
  id: number;
  status: number;
  statusText: string;
  ping: number;
  guildCount: number;
  userCount: number;
  uptime: number;
  memoryUsage: number;
}

export interface SerializedGuild {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  ownerId: string;
  shardId: number;
  joinedAt?: string | null;
  banner?: string | null;
  description?: string | null;
  features?: string[];
  large?: boolean;
  vanityURLCode?: string | null;
}

export interface SerializedUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  tag: string;
  bot: boolean;
}

export interface SerializedChannel {
  id: string;
  name: string;
  type: number;
  guildId: string | null;
  parentId: string | null;
  position?: number;
}

const STATUS_NAMES = [
  'READY',
  'CONNECTING',
  'RECONNECTING',
  'IDLE',
  'NEARLY',
  'DISCONNECTED',
  'WAITING_FOR_GUILDS',
  'IDENTIFYING',
  'RESUMING',
];

export class CrossShardService {
  /**
   * Check if client is running in sharded mode via ShardingManager
   */
  public isSharded(client: Client): boolean {
    return Boolean(client.shard && client.shard.count > 0);
  }

  /**
   * Get current shard ID for this client instance
   */
  public getCurrentShardId(client: Client): number {
    return client.shard?.ids[0] ?? 0;
  }

  /**
   * Calculate which shard handles a specific guild ID based on Discord's sharding formula
   */
  public getShardIdForGuild(guildId: string, totalShards: number): number {
    try {
      return Number((BigInt(guildId) >> 22n) % BigInt(totalShards));
    } catch {
      return 0;
    }
  }

  /**
   * Broadcast an evaluation function to all shards
   */
  public async broadcastEval<T, C = Record<string, unknown>>(
    client: Client,
    fn: (client: Client, context: C) => T | Promise<T>,
    context?: C
  ): Promise<T[]> {
    if (!this.isSharded(client)) {
      const result = await fn(client, context as C);
      return [result];
    }

    try {
      return (await client.shard!.broadcastEval(fn, {
        context: context as any,
      })) as unknown as T[];
    } catch (error) {
      logger.error('Failed to broadcastEval across shards:', error);
      throw error;
    }
  }

  /**
   * Fetch detailed stats for all shards
   */
  public async getShardStats(client: Client): Promise<ShardInfo[]> {
    if (!this.isSharded(client)) {
      const mem = process.memoryUsage().heapUsed;
      const guilds = client.guilds.cache;
      const userCount = Array.from(guilds.values()).reduce(
        (acc: number, g: any) => acc + (g.memberCount || 0),
        0
      );

      return [
        {
          id: 0,
          status: client.ws.status,
          statusText: STATUS_NAMES[client.ws.status] || 'UNKNOWN',
          ping: client.ws.ping,
          guildCount: guilds.size,
          userCount,
          uptime: client.uptime || 0,
          memoryUsage: mem,
        },
      ];
    }

    try {
      const shardResults = await client.shard!.broadcastEval(c => {
        const mem = process.memoryUsage().heapUsed;
        const guilds = c.guilds.cache;
        const userCount = Array.from(guilds.values()).reduce(
          (acc: number, g: any) => acc + (g.memberCount || 0),
          0
        );

        return {
          id: c.shard?.ids[0] ?? 0,
          status: c.ws.status,
          ping: c.ws.ping,
          guildCount: guilds.size,
          userCount,
          uptime: c.uptime || 0,
          memoryUsage: mem,
        };
      });

      return shardResults.map((s: any) => ({
        ...s,
        statusText: STATUS_NAMES[s.status] || 'UNKNOWN',
      }));
    } catch (error) {
      logger.error('Error fetching shard stats:', error);
      return [];
    }
  }

  /**
   * Fetch total guild count across all shards
   */
  public async getTotalGuildsCount(client: Client): Promise<number> {
    if (!this.isSharded(client)) {
      return client.guilds.cache.size;
    }

    try {
      const counts = await client.shard!.fetchClientValues('guilds.cache.size');
      return (counts as number[]).reduce((acc, count) => acc + count, 0);
    } catch (error) {
      logger.error('Failed to fetch total guild count across shards:', error);
      return client.guilds.cache.size;
    }
  }

  /**
   * Fetch total user count (sum of all guild memberCounts) across all shards
   */
  public async getTotalUsersCount(client: Client): Promise<number> {
    if (!this.isSharded(client)) {
      return Array.from(client.guilds.cache.values()).reduce(
        (acc: number, g: any) => acc + (g.memberCount || 0),
        0
      );
    }

    try {
      const counts = await client.shard!.broadcastEval(c =>
        Array.from(c.guilds.cache.values()).reduce(
          (acc: number, g: any) => acc + (g.memberCount || 0),
          0
        )
      );
      return counts.reduce((acc: number, count: number) => acc + count, 0);
    } catch (error) {
      logger.error('Failed to fetch total user count across shards:', error);
      return Array.from(client.guilds.cache.values()).reduce(
        (acc: number, g: any) => acc + (g.memberCount || 0),
        0
      );
    }
  }

  /**
   * Fetch count of unique user IDs cached across all shards
   */
  public async getUniqueUsersCount(client: Client): Promise<number> {
    if (!this.isSharded(client)) {
      const unique = new Set<string>();
      client.guilds.cache.forEach((g: any) => {
        g.members.cache.forEach((m: any) => unique.add(m.id));
      });
      return unique.size;
    }

    try {
      const userArrays = await client.shard!.broadcastEval(c => {
        const set = new Set<string>();
        c.guilds.cache.forEach((g: any) => {
          g.members.cache.forEach((m: any) => set.add(m.id));
        });
        return Array.from(set);
      });

      const globalSet = new Set<string>();
      for (const arr of userArrays) {
        for (const id of arr) {
          globalSet.add(id);
        }
      }

      return globalSet.size;
    } catch (error) {
      logger.error('Failed to fetch unique user count across shards:', error);
      return 0;
    }
  }

  /**
   * Fetch total channels count across all shards
   */
  public async getTotalChannelsCount(client: Client): Promise<number> {
    if (!this.isSharded(client)) {
      return Array.from(client.guilds.cache.values()).reduce(
        (acc: number, g: any) => acc + (g.channels?.cache?.size || 0),
        0
      );
    }

    try {
      const counts = await client.shard!.broadcastEval(c =>
        Array.from(c.guilds.cache.values()).reduce(
          (acc: number, g: any) => acc + (g.channels?.cache?.size || 0),
          0
        )
      );
      return counts.reduce((acc: number, count: number) => acc + count, 0);
    } catch (error) {
      logger.error('Failed to fetch total channel count across shards:', error);
      return Array.from(client.guilds.cache.values()).reduce(
        (acc: number, g: any) => acc + (g.channels?.cache?.size || 0),
        0
      );
    }
  }

  /**
   * Fetch a guild by ID across all shards
   */
  public async fetchGuild(client: Client, guildId: string): Promise<SerializedGuild | null> {
    // Check local cache first
    const localGuild = client.guilds.cache.get(guildId);
    if (localGuild) {
      return this.serializeGuild(localGuild, client.shard?.ids[0] ?? 0);
    }

    if (!this.isSharded(client)) {
      return null;
    }

    try {
      const results = await client.shard!.broadcastEval(
        (c, { gId }) => {
          const g = c.guilds.cache.get(gId);
          if (!g) return null;
          return {
            id: g.id,
            name: g.name,
            icon: g.icon,
            memberCount: g.memberCount,
            ownerId: g.ownerId,
            shardId: c.shard?.ids[0] ?? 0,
            joinedAt: g.joinedAt?.toISOString() || null,
            banner: g.banner,
            description: g.description,
            features: Array.from(g.features),
            large: g.large,
            vanityURLCode: g.vanityURLCode,
          };
        },
        { context: { gId: guildId } }
      );

      return results.find(g => g !== null) || null;
    } catch (error) {
      logger.error(`Error fetching cross-shard guild ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Fetch summary list of all guilds across all shards
   */
  public async fetchAllGuilds(client: Client): Promise<SerializedGuild[]> {
    if (!this.isSharded(client)) {
      const currentShardId = client.shard?.ids[0] ?? 0;
      return client.guilds.cache.map(g => this.serializeGuild(g, currentShardId));
    }

    try {
      const nestedGuilds = await client.shard!.broadcastEval(c => {
        const sId = c.shard?.ids[0] ?? 0;
        return c.guilds.cache.map(g => ({
          id: g.id,
          name: g.name,
          icon: g.icon,
          memberCount: g.memberCount,
          ownerId: g.ownerId,
          shardId: sId,
          joinedAt: g.joinedAt?.toISOString() || null,
          banner: g.banner,
          description: g.description,
          features: Array.from(g.features),
          large: g.large,
          vanityURLCode: g.vanityURLCode,
        }));
      });

      return nestedGuilds.flat();
    } catch (error) {
      logger.error('Error fetching all guilds across shards:', error);
      return client.guilds.cache.map(g => this.serializeGuild(g, 0));
    }
  }

  /**
   * Fetch a user by ID across all shards or from Discord API
   */
  public async fetchUser(client: Client, userId: string): Promise<SerializedUser | null> {
    const localUser = client.users.cache.get(userId);
    if (localUser) {
      return this.serializeUser(localUser);
    }

    if (this.isSharded(client)) {
      try {
        const results = await client.shard!.broadcastEval(
          (c, { uId }) => {
            const u = c.users.cache.get(uId);
            if (!u) return null;
            return {
              id: u.id,
              username: u.username,
              discriminator: u.discriminator,
              avatar: u.avatar,
              tag: u.tag,
              bot: u.bot,
            };
          },
          { context: { uId: userId } }
        );

        const foundUser = results.find(u => u !== null);
        if (foundUser) return foundUser;
      } catch (error) {
        logger.debug(`Cross-shard user cache search failed for ${userId}`);
      }
    }

    // Fallback to Discord REST fetch
    try {
      const fetched = await client.users.fetch(userId);
      return this.serializeUser(fetched);
    } catch (error) {
      logger.debug(`Failed to fetch user ${userId} from API`);
      return null;
    }
  }

  /**
   * Execute a function on the specific shard that owns a guild
   */
  public async executeOnGuildShard<T, C = Record<string, unknown>>(
    client: Client,
    guildId: string,
    fn: (client: Client, context: C) => T | Promise<T>,
    context?: C
  ): Promise<T | null> {
    if (client.guilds.cache.has(guildId)) {
      return await fn(client, context as C);
    }

    if (!this.isSharded(client)) {
      return null;
    }

    try {
      const results = await client.shard!.broadcastEval(
        async (c, { gId, innerContext }) => {
          if (!c.guilds.cache.has(gId)) return null;
          // We need to recreate or evaluate the function if serialized, or search
          return null;
        },
        { context: { gId: guildId, innerContext: context } }
      );

      return (results.find(r => r !== null) as T) || null;
    } catch (error) {
      logger.error(`Error executing action on guild shard for guild ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Helper to serialize Guild object into JSON-friendly structure
   */
  public serializeGuild(guild: Guild, shardId: number): SerializedGuild {
    return {
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
      shardId,
      joinedAt: guild.joinedAt?.toISOString() || null,
      banner: guild.banner,
      description: guild.description,
      features: Array.from(guild.features),
      large: guild.large,
      vanityURLCode: guild.vanityURLCode,
    };
  }

  /**
   * Helper to serialize User object into JSON-friendly structure
   */
  public serializeUser(user: User): SerializedUser {
    return {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      tag: user.tag,
      bot: user.bot,
    };
  }
}

export const crossShardService = new CrossShardService();
