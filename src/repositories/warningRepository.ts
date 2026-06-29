import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { getDatabase } from '../database/connection';
import { warnings, warningAutomations } from '../database/schema';
import { generateId } from '../utils/id';

export interface CreateWarningData {
  guildId: string;
  userId: string;
  moderatorId: string;
  title: string;
  description?: string;
  level?: number;
  proof?: string;
}

export interface UpdateWarningData {
  title?: string;
  description?: string;
  editedBy: string;
}

export interface CreateAutomationData {
  guildId: string;
  name: string;
  description?: string;
  triggerType: 'warn_count' | 'warn_level';
  triggerValue: number;
  actions: Array<{
    type: 'ban' | 'kick' | 'mute' | 'timeout' | 'role' | 'message';
    duration?: number;
    roleId?: string;
    message?: string;
  }>;
  createdBy: string;
  notifyChannelId?: string;
  notifyMessage?: string;
}

export class WarningRepository {
  private get db() {
    return getDatabase();
  }

  async createWarning(data: CreateWarningData) {
    const warnId = `W${generateId(10)}`;

    const [warning] = await this.db
      .insert(warnings)
      .values({
        warnId,
        guildId: data.guildId,
        userId: data.userId,
        moderatorId: data.moderatorId,
        title: data.title,
        description: data.description ?? null,
        level: data.level || 1,
        proof: data.proof ?? null,
      })
      .returning();

    return warning;
  }

  async updateWarning(warnId: string, data: UpdateWarningData) {
    const updatePayload: Record<string, any> = { editedAt: new Date() };
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.description !== undefined) updatePayload.description = data.description ?? null;
    if (data.editedBy !== undefined) updatePayload.editedBy = data.editedBy;

    const [updated] = await this.db
      .update(warnings)
      .set(updatePayload)
      .where(eq(warnings.warnId, warnId))
      .returning();

    return updated;
  }

  async deactivateWarning(warnId: string, editedBy: string) {
    const [updated] = await this.db
      .update(warnings)
      .set({
        active: false,
        editedAt: new Date(),
        editedBy,
      })
      .where(eq(warnings.warnId, warnId))
      .returning();

    return updated;
  }

  async getWarningById(warnId: string) {
    const [warning] = await this.db
      .select()
      .from(warnings)
      .where(eq(warnings.warnId, warnId))
      .limit(1);

    return warning;
  }

  async getUserWarnings(guildId: string, userId: string) {
    return this.db
      .select()
      .from(warnings)
      .where(
        and(eq(warnings.guildId, guildId), eq(warnings.userId, userId), eq(warnings.active, true))
      )
      .orderBy(desc(warnings.createdAt));
  }

  async getUserWarningStats(guildId: string, userId: string) {
    const activeWarnings = await this.db
      .select({
        count: sql<number>`count(*)::int`,
        totalLevel: sql<number>`COALESCE(sum(${warnings.level}), 0)::int`,
      })
      .from(warnings)
      .where(
        and(eq(warnings.guildId, guildId), eq(warnings.userId, userId), eq(warnings.active, true))
      );

    return {
      count: activeWarnings[0]?.count || 0,
      totalLevel: activeWarnings[0]?.totalLevel || 0,
    };
  }

  async createAutomation(data: CreateAutomationData) {
    const automationId = `AUTO${generateId(8)}`;

    const [automation] = await this.db
      .insert(warningAutomations)
      .values({
        automationId,
        guildId: data.guildId,
        name: data.name,
        description: data.description ?? null,
        triggerType: data.triggerType,
        triggerValue: data.triggerValue,
        actions: data.actions,
        createdBy: data.createdBy,
        notifyChannelId: data.notifyChannelId ?? null,
        notifyMessage: data.notifyMessage ?? null,
      })
      .returning();

    return automation;
  }

  async getGuildAutomations(guildId: string) {
    return this.db
      .select()
      .from(warningAutomations)
      .where(eq(warningAutomations.guildId, guildId))
      .orderBy(desc(warningAutomations.createdAt));
  }

  async deleteAutomation(automationId: string) {
    const [deleted] = await this.db
      .delete(warningAutomations)
      .where(eq(warningAutomations.automationId, automationId))
      .returning();

    return deleted;
  }

  async getActiveAutomations(guildId: string) {
    return this.db
      .select()
      .from(warningAutomations)
      .where(and(eq(warningAutomations.guildId, guildId), eq(warningAutomations.enabled, true)));
  }

  async updateAutomationLastTriggered(automationId: string) {
    await this.db
      .update(warningAutomations)
      .set({ lastTriggeredAt: new Date() })
      .where(eq(warningAutomations.automationId, automationId));
  }

  async getRecentWarnings(guildId: string, userId: string, hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return this.db
      .select()
      .from(warnings)
      .where(
        and(
          eq(warnings.guildId, guildId),
          eq(warnings.userId, userId),
          eq(warnings.active, true),
          gte(warnings.createdAt, since)
        )
      );
  }

  async purgeWarnings(guildId: string, userId: string, moderatorId: string) {
    const updated = await this.db
      .update(warnings)
      .set({
        active: false,
        editedAt: new Date(),
        editedBy: moderatorId,
      })
      .where(and(eq(warnings.guildId, guildId), eq(warnings.userId, userId), eq(warnings.active, true)))
      .returning({ warnId: warnings.warnId });

    return {
      count: updated.length,
    };
  }
}

export const warningRepository = new WarningRepository();
