import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { crossShardService } from '../../../services/crossShardService';

describe('CrossShardService', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      ws: {
        status: 0,
        ping: 35,
        shards: new Map([
          [0, { id: 0, status: 0, ping: 35 }],
        ]),
      },
      uptime: 123456,
      guilds: {
        cache: new Map([
          [
            '123456789012345678',
            {
              id: '123456789012345678',
              name: 'Guild 1',
              icon: null,
              memberCount: 100,
              ownerId: '999999',
              joinedAt: new Date('2024-01-01'),
              banner: null,
              description: 'Test guild 1',
              features: new Set(['COMMUNITY']),
              large: false,
              vanityURLCode: null,
              members: {
                cache: new Map([
                  ['999999', { id: '999999', user: { bot: false }, presence: { status: 'online' } }],
                ]),
              },
              channels: { cache: new Map([['channel1', { size: 1 }]]) },
            },
          ],
        ]),
      },
      users: {
        cache: new Map([
          [
            '999999',
            {
              id: '999999',
              username: 'testuser',
              discriminator: '0000',
              avatar: null,
              tag: 'testuser#0000',
              bot: false,
            },
          ],
        ]),
        fetch: jest.fn(),
      },
      shard: null,
    };
  });

  describe('isSharded', () => {
    it('returns false when client.shard is null', () => {
      expect(crossShardService.isSharded(mockClient)).toBe(false);
    });

    it('returns true when client.shard is present', () => {
      mockClient.shard = { count: 2, ids: [0] };
      expect(crossShardService.isSharded(mockClient)).toBe(true);
    });
  });

  describe('getShardIdForGuild', () => {
    it('correctly calculates shard ID based on guild snowflake', () => {
      const guildId = '381880193251475464';
      const shardId = crossShardService.getShardIdForGuild(guildId, 4);
      expect(typeof shardId).toBe('number');
      expect(shardId).toBeGreaterThanOrEqual(0);
      expect(shardId).toBeLessThan(4);
    });

    it('handles invalid guild IDs gracefully', () => {
      expect(crossShardService.getShardIdForGuild('invalid', 4)).toBe(0);
    });
  });

  describe('getTotalGuildsCount', () => {
    it('returns local cache size when not sharded', async () => {
      const count = await crossShardService.getTotalGuildsCount(mockClient);
      expect(count).toBe(1);
    });

    it('sums guild counts across shards when sharded', async () => {
      mockClient.shard = {
        count: 2,
        ids: [0],
        fetchClientValues: jest.fn().mockResolvedValue([10, 15] as never),
      };

      const count = await crossShardService.getTotalGuildsCount(mockClient);
      expect(count).toBe(25);
    });
  });

  describe('getTotalUsersCount', () => {
    it('calculates total members from local cache when not sharded', async () => {
      const count = await crossShardService.getTotalUsersCount(mockClient);
      expect(count).toBe(100);
    });

    it('sums user counts across shards when sharded', async () => {
      mockClient.shard = {
        count: 2,
        ids: [0],
        broadcastEval: jest.fn().mockResolvedValue([100, 200] as never),
      };

      const count = await crossShardService.getTotalUsersCount(mockClient);
      expect(count).toBe(300);
    });
  });

  describe('fetchGuild', () => {
    it('fetches guild from local cache if present', async () => {
      const guild = await crossShardService.fetchGuild(mockClient, '123456789012345678');
      expect(guild).not.toBeNull();
      expect(guild?.name).toBe('Guild 1');
      expect(guild?.memberCount).toBe(100);
    });

    it('returns null if guild not found in non-sharded mode', async () => {
      const guild = await crossShardService.fetchGuild(mockClient, '000000000000000000');
      expect(guild).toBeNull();
    });

    it('queries other shards when sharded and guild is not in local cache', async () => {
      mockClient.shard = {
        count: 2,
        ids: [0],
        broadcastEval: jest.fn().mockResolvedValue([
          null,
          {
            id: '888888888888888888',
            name: 'Remote Guild',
            icon: null,
            memberCount: 50,
            ownerId: '111111',
            shardId: 1,
          },
        ] as never),
      };

      const guild = await crossShardService.fetchGuild(mockClient, '888888888888888888');
      expect(guild).not.toBeNull();
      expect(guild?.name).toBe('Remote Guild');
      expect(guild?.shardId).toBe(1);
    });
  });

  describe('getShardStats', () => {
    it('returns single shard info when not sharded', async () => {
      const stats = await crossShardService.getShardStats(mockClient);
      expect(stats.length).toBe(1);
      expect(stats[0].id).toBe(0);
      expect(stats[0].guildCount).toBe(1);
      expect(stats[0].userCount).toBe(100);
    });

    it('returns stats for all shards when sharded', async () => {
      mockClient.shard = {
        count: 2,
        ids: [0],
        broadcastEval: jest.fn().mockResolvedValue([
          { id: 0, status: 0, ping: 30, guildCount: 5, userCount: 500, uptime: 1000, memoryUsage: 5000 },
          { id: 1, status: 0, ping: 40, guildCount: 8, userCount: 800, uptime: 1000, memoryUsage: 6000 },
        ] as never),
      };

      const stats = await crossShardService.getShardStats(mockClient);
      expect(stats.length).toBe(2);
      expect(stats[0].guildCount).toBe(5);
      expect(stats[1].guildCount).toBe(8);
    });
  });
});
