import { and, eq } from 'drizzle-orm';
import { BaseRepository } from './baseRepository';
import { autoModRules, autoModInfractions, quarantineVault } from '../database/schema/automod';
import type { AutoModRule, AutoModInfraction, QuarantineVault } from '../types';

export class AutoModRepository extends BaseRepository {
  private rulesCache = new Map<string, { rules: AutoModRule[]; expiresAt: number }>();
  private readonly CACHE_TTL = 60 * 1000; // 1 minute cache TTL

  async getRulesByEvent(guildId: string, eventType: string): Promise<AutoModRule[]> {
    const cacheKey = `${guildId}:${eventType}`;
    const cached = this.rulesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.rules;
    }

    return this.executeQuery('getRulesByEvent', async () => {
      const records = await this.db
        .select()
        .from(autoModRules)
        .where(
          and(
            eq(autoModRules.guildId, guildId),
            eq(autoModRules.eventType, eventType),
            eq(autoModRules.enabled, true)
          )
        );
      const rules = records as unknown as AutoModRule[];
      this.rulesCache.set(cacheKey, { rules, expiresAt: Date.now() + this.CACHE_TTL });
      return rules;
    });
  }

  async listRules(guildId: string): Promise<AutoModRule[]> {
    return this.executeQuery('listRules', async () => {
      const records = await this.db
        .select()
        .from(autoModRules)
        .where(eq(autoModRules.guildId, guildId));
      return records as unknown as AutoModRule[];
    });
  }

  async createRule(data: {
    guildId: string;
    name: string;
    description?: string;
    eventType: string;
    triggerType: string;
    triggerMetadata?: Record<string, any>;
    conditions?: Record<string, any>;
    exemptRoles?: string[];
    exemptChannels?: string[];
    actions?: Record<string, any>[];
    enabled?: boolean;
    createdBy?: string;
  }): Promise<AutoModRule> {
    return this.executeQuery('createRule', async () => {
      const [record] = await this.db
        .insert(autoModRules)
        .values({
          guildId: data.guildId,
          name: data.name,
          description: data.description,
          eventType: data.eventType,
          triggerType: data.triggerType,
          triggerMetadata: data.triggerMetadata ?? {},
          conditions: data.conditions ?? {},
          exemptRoles: data.exemptRoles ?? [],
          exemptChannels: data.exemptChannels ?? [],
          actions: data.actions ?? [],
          enabled: data.enabled ?? true,
          createdBy: data.createdBy,
        })
        .returning();
      const rule = record as unknown as AutoModRule;
      this.rulesCache.delete(`${data.guildId}:${data.eventType}`);
      return rule;
    });
  }

  async updateRule(
    id: string,
    guildId: string,
    updates: Partial<AutoModRule>
  ): Promise<AutoModRule | null> {
    return this.executeQuery('updateRule', async () => {
      const [record] = await this.db
        .update(autoModRules)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(and(eq(autoModRules.id, id), eq(autoModRules.guildId, guildId)))
        .returning();
      const rule = (record as unknown as AutoModRule) || null;
      if (rule) {
        this.rulesCache.delete(`${guildId}:${rule.eventType}`);
      }
      return rule;
    });
  }

  async deleteRule(id: string, guildId: string): Promise<boolean> {
    return this.executeQuery('deleteRule', async () => {
      const [record] = await this.db
        .delete(autoModRules)
        .where(and(eq(autoModRules.id, id), eq(autoModRules.guildId, guildId)))
        .returning();
      const rule = record as unknown as AutoModRule;
      if (rule) {
        this.rulesCache.delete(`${guildId}:${rule.eventType}`);
      }
      return Boolean(record);
    });
  }

  async createInfraction(data: {
    guildId: string;
    userId: string;
    ruleId?: string;
    points?: number;
    actionTaken: string;
    reason?: string;
    expiresAt: Date;
  }): Promise<AutoModInfraction> {
    return this.executeQuery('createInfraction', async () => {
      const [record] = await this.db
        .insert(autoModInfractions)
        .values({
          guildId: data.guildId,
          userId: data.userId,
          ruleId: data.ruleId,
          points: data.points ?? 1,
          actionTaken: data.actionTaken,
          reason: data.reason,
          expiresAt: data.expiresAt,
        })
        .returning();
      return record as unknown as AutoModInfraction;
    });
  }

  async getActiveInfractions(guildId: string, userId: string): Promise<AutoModInfraction[]> {
    return this.executeQuery('getActiveInfractions', async () => {
      const records = await this.db
        .select()
        .from(autoModInfractions)
        .where(
          and(
            eq(autoModInfractions.guildId, guildId),
            eq(autoModInfractions.userId, userId),
            eq(autoModInfractions.active, true)
          )
        );
      // Filter out expired in code or query
      const now = new Date();
      return (records as unknown as AutoModInfraction[]).filter(r => new Date(r.expiresAt) > now);
    });
  }

  async getQuarantineStatus(guildId: string, userId: string): Promise<QuarantineVault | null> {
    return this.executeQuery('getQuarantineStatus', async () => {
      const [record] = await this.db
        .select()
        .from(quarantineVault)
        .where(
          and(
            eq(quarantineVault.guildId, guildId),
            eq(quarantineVault.userId, userId),
            eq(quarantineVault.released, false)
          )
        )
        .limit(1);
      return (record as unknown as QuarantineVault) || null;
    });
  }

  async quarantineUser(data: {
    guildId: string;
    userId: string;
    originalRoles: string[];
    reason?: string;
    jailedBy?: string;
  }): Promise<QuarantineVault> {
    return this.executeQuery('quarantineUser', async () => {
      const [record] = await this.db
        .insert(quarantineVault)
        .values({
          guildId: data.guildId,
          userId: data.userId,
          originalRoles: data.originalRoles,
          reason: data.reason,
          jailedBy: data.jailedBy,
        })
        .returning();
      return record as unknown as QuarantineVault;
    });
  }

  async releaseQuarantine(
    guildId: string,
    userId: string,
    releasedBy: string
  ): Promise<QuarantineVault | null> {
    return this.executeQuery('releaseQuarantine', async () => {
      const [record] = await this.db
        .update(quarantineVault)
        .set({
          released: true,
          releasedBy,
          releasedAt: new Date(),
        })
        .where(
          and(
            eq(quarantineVault.guildId, guildId),
            eq(quarantineVault.userId, userId),
            eq(quarantineVault.released, false)
          )
        )
        .returning();
      return (record as unknown as QuarantineVault) || null;
    });
  }
  async listQuarantinedUsers(guildId: string): Promise<QuarantineVault[]> {
    return this.executeQuery('listQuarantinedUsers', async () => {
      const records = await this.db
        .select()
        .from(quarantineVault)
        .where(and(eq(quarantineVault.guildId, guildId), eq(quarantineVault.released, false)));
      return records as unknown as QuarantineVault[];
    });
  }
}

export const autoModRepository = new AutoModRepository();
