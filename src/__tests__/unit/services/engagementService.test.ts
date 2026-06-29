import { engagementService } from '../../../services/engagementService';
import { engagementRepository } from '../../../repositories/engagementRepository';
import { Message, GuildMember } from 'discord.js';

jest.mock('../../../repositories/engagementRepository');
jest.mock('../../../repositories/economyRepository');
jest.mock('../../../services/xpService');
jest.mock('../../../utils/logger');

describe('EngagementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('trackMessageActivity', () => {
    it('should progress active quests for messages', async () => {
      const mockMessage = {
        guild: { id: 'guild123' },
        author: { bot: false, id: 'user123' },
        member: { id: 'user123', user: { bot: false } },
        channel: { id: 'channel123', send: jest.fn().mockResolvedValue(true) },
      } as unknown as Message;

      (engagementRepository.getActiveQuests as jest.Mock).mockResolvedValue([
        {
          id: 'quest1',
          targetType: 'messages',
          targetValue: 10,
          rewardXp: 50,
          rewardCoins: 100,
        },
      ]);

      (engagementRepository.getUserQuestProgress as jest.Mock).mockResolvedValue({
        progress: 9,
        completed: false,
      });

      (engagementRepository.listAchievements as jest.Mock).mockResolvedValue([]);
      (engagementRepository.getUserAchievements as jest.Mock).mockResolvedValue([]);

      await engagementService.trackMessageActivity(mockMessage);

      expect(engagementRepository.updateUserQuestProgress).toHaveBeenCalledWith(
        'guild123',
        'user123',
        'quest1',
        10,
        true
      );
    });
  });

  describe('prestigeUser', () => {
    it('should fail if user level is below threshold', async () => {
      const mockMember = { id: 'user123', user: { bot: false } } as unknown as GuildMember;

      (engagementRepository.getUserPrestige as jest.Mock).mockResolvedValue({
        userId: 'user123',
        guildId: 'guild123',
        level: 10,
        prestigeLevel: 0,
      });

      const result = await engagementService.prestigeUser('user123', 'guild123', mockMember);
      expect(result.success).toBe(false);
      expect(result.message).toContain('You must reach level 50 to prestige');
    });

    it('should succeed if user level meets threshold', async () => {
      const mockMember = { id: 'user123', user: { bot: false } } as unknown as GuildMember;

      (engagementRepository.getUserPrestige as jest.Mock).mockResolvedValue({
        userId: 'user123',
        guildId: 'guild123',
        level: 50,
        prestigeLevel: 1,
      });

      const result = await engagementService.prestigeUser('user123', 'guild123', mockMember);
      expect(result.success).toBe(true);
      expect(result.newPrestige).toBe(2);
      expect(result.message).toContain('Prestige Level 2');
    });
  });
});
