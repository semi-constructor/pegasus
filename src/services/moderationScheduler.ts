import { modCaseRepository } from '../repositories/modCaseRepository';
import { logger } from '../utils/logger';
import type { Client } from 'discord.js';
import { t } from '../i18n';

interface TempActionSchedule {
  caseId: number;
  guildId: string;
  userId: string;
  expiresAt: Date;
  type: string;
}

class ModerationScheduler {
  private timers = new Map<number, NodeJS.Timeout>();
  private client: Client | null = null;

  attachClient(client: Client): void {
    this.client = client;
  }

  async initialize(): Promise<void> {
    await this.scheduleExistingActions();
  }

  async scheduleTempAction(payload: TempActionSchedule): Promise<void> {
    const delay = payload.expiresAt.getTime() - Date.now();
    if (delay <= 0) {
      await this.handleActionExpiry(payload);
      return;
    }

    const timeout = setTimeout(
      () => {
        void this.handleActionExpiry(payload);
      },
      Math.min(delay, 2147483647)
    );

    this.timers.set(payload.caseId, timeout);
  }

  private async scheduleExistingActions(): Promise<void> {
    const cases = await modCaseRepository.getActiveTempActions();
    for (const modCase of cases) {
      if (!modCase.expiresAt) continue;
      await this.scheduleTempAction({
        caseId: modCase.id,
        guildId: modCase.guildId,
        userId: modCase.userId,
        expiresAt: modCase.expiresAt,
        type: modCase.type,
      });
    }
    if (cases.length > 0) {
      logger.info(`Scheduled ${cases.length} pending temporary actions`);
    }
  }

  private async handleActionExpiry(payload: TempActionSchedule): Promise<void> {
    this.timers.delete(payload.caseId);

    try {
      if (!this.client) {
        logger.warn('Moderation scheduler attempted to auto-action without a client instance');
        return;
      }

      const guild =
        this.client.guilds.cache.get(payload.guildId) ||
        (await this.client.guilds.fetch(payload.guildId));

      if (guild) {
        if (payload.type === 'ban') {
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
        } else if (payload.type === 'mute') {
          const member = await guild.members.fetch(payload.userId).catch(() => null);
          if (member) {
            const muteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
            if (muteRole && member.roles.cache.has(muteRole.id)) {
              await member.roles.remove(muteRole.id, 'Temporary mute expired')
                .catch(error => logger.warn(`Failed to auto-unmute ${payload.userId}`, error));
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error handling temporary action expiry:', error);
    } finally {
      await modCaseRepository.markTempActionCompleted(payload.caseId);
    }
  }
}

export const moderationScheduler = new ModerationScheduler();
