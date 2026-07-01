import { modCaseRepository } from '../repositories/modCaseRepository';
import { logger } from '../utils/logger';
import type { Client } from 'discord.js';
import { t } from '../i18n';

interface TempBanSchedule {
  caseId: number;
  guildId: string;
  userId: string;
  expiresAt: Date;
}

class ModerationScheduler {
  private timers = new Map<number, NodeJS.Timeout>();
  private client: Client | null = null;

  attachClient(client: Client): void {
    this.client = client;
  }

  async initialize(): Promise<void> {
    await this.scheduleExistingBans();
  }

  async scheduleTempBan(payload: TempBanSchedule): Promise<void> {
    const delay = payload.expiresAt.getTime() - Date.now();
    if (delay <= 0) {
      await this.handleBanExpiry(payload);
      return;
    }

    const timeout = setTimeout(
      () => {
        void this.handleBanExpiry(payload);
      },
      Math.min(delay, 2147483647)
    );

    this.timers.set(payload.caseId, timeout);
  }

  private async scheduleExistingBans(): Promise<void> {
    const cases = await modCaseRepository.getActiveTempBans();
    for (const modCase of cases) {
      if (!modCase.expiresAt) continue;
      await this.scheduleTempBan({
        caseId: modCase.id,
        guildId: modCase.guildId,
        userId: modCase.userId,
        expiresAt: modCase.expiresAt,
      });
    }
    if (cases.length > 0) {
      logger.info(`Scheduled ${cases.length} pending temporary bans for automatic unban`);
    }
  }

  private async handleBanExpiry(payload: TempBanSchedule): Promise<void> {
    this.timers.delete(payload.caseId);

    try {
      if (!this.client) {
        logger.warn('Moderation scheduler attempted to unban without a client instance');
        return;
      }

      const guild =
        this.client.guilds.cache.get(payload.guildId) ||
        (await this.client.guilds.fetch(payload.guildId));

      if (guild) {
        const bans = await guild.bans.fetch().catch(() => null);
        const isBanned = bans?.has(payload.userId);

        if (isBanned) {
          await guild.members
            .unban(
              payload.userId,
              t('commands.moderation.subcommands.ban.expired', {
                defaultValue: 'Temporary ban expired',
              })
            )
            .catch(error =>
              logger.warn(`Failed to auto-unban ${payload.userId} in ${payload.guildId}:`, error)
            );
        }
      }
    } catch (error) {
      logger.error('Error handling temporary ban expiry:', error);
    } finally {
      await modCaseRepository.markTempBanCompleted(payload.caseId);
    }
  }
}

export const moderationScheduler = new ModerationScheduler();
