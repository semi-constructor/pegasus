import { and, desc, eq, gt, isNotNull, or } from 'drizzle-orm';
import { getDatabase } from '../database/connection';
import { modCases } from '../database/schema';
import type { ModActionType, ModCase } from '../types';

export interface CreateModCaseInput {
  guildId: string;
  userId: string;
  moderatorId: string;
  type: ModActionType | string;
  reason?: string;
  duration?: number | null;
  expiresAt?: Date | null;
}

export class ModCaseRepository {
  private get db() {
    return getDatabase();
  }

  private mapCase(record: typeof modCases.$inferSelect): ModCase {
    return {
      id: record.id,
      guildId: record.guildId,
      userId: record.userId,
      moderatorId: record.moderatorId,
      type: record.type as ModActionType,
      reason: record.reason ?? undefined,
      duration: record.duration ?? undefined,
      expiresAt: record.expiresAt ?? undefined,
      createdAt: record.createdAt,
    };
  }

  async create(data: CreateModCaseInput): Promise<ModCase> {
    const [created] = await this.db
      .insert(modCases)
      .values({
        guildId: data.guildId,
        userId: data.userId,
        moderatorId: data.moderatorId,
        type: data.type,
        reason: data.reason,
        duration: data.duration ?? null,
        expiresAt: data.expiresAt ?? null,
      })
      .returning();

    return this.mapCase(created);
  }

  async getById(guildId: string, caseId: number): Promise<ModCase | null> {
    const [record] = await this.db
      .select()
      .from(modCases)
      .where(and(eq(modCases.guildId, guildId), eq(modCases.id, caseId)))
      .limit(1);

    return record ? this.mapCase(record) : null;
  }

  async delete(guildId: string, caseId: number): Promise<boolean> {
    const [deleted] = await this.db
      .delete(modCases)
      .where(and(eq(modCases.guildId, guildId), eq(modCases.id, caseId)))
      .returning();

    return Boolean(deleted);
  }

  async getByUser(guildId: string, userId: string, limit = 10): Promise<ModCase[]> {
    const results = await this.db
      .select()
      .from(modCases)
      .where(and(eq(modCases.guildId, guildId), eq(modCases.userId, userId)))
      .orderBy(desc(modCases.createdAt))
      .limit(limit);

    return results.map(record => this.mapCase(record));
  }

  async getByUserOrModerator(guildId: string, userId: string, limit = 10): Promise<ModCase[]> {
    const results = await this.db
      .select()
      .from(modCases)
      .where(
        and(
          eq(modCases.guildId, guildId),
          or(eq(modCases.userId, userId), eq(modCases.moderatorId, userId))
        )
      )
      .orderBy(desc(modCases.createdAt))
      .limit(limit);

    return results.map(record => this.mapCase(record));
  }

  async getRecent(guildId: string, limit = 10): Promise<ModCase[]> {
    const results = await this.db
      .select()
      .from(modCases)
      .where(eq(modCases.guildId, guildId))
      .orderBy(desc(modCases.createdAt))
      .limit(limit);

    return results.map(record => this.mapCase(record));
  }

  async getActiveTempActions(): Promise<ModCase[]> {
    const results = await this.db
      .select()
      .from(modCases)
      .where(
        and(
          or(eq(modCases.type, 'ban'), eq(modCases.type, 'mute')),
          isNotNull(modCases.expiresAt),
          gt(modCases.expiresAt, new Date())
        )
      );

    return results.map(record => this.mapCase(record));
  }

  async markTempActionCompleted(caseId: number): Promise<void> {
    await this.db
      .update(modCases)
      .set({
        duration: null,
        expiresAt: null,
      })
      .where(eq(modCases.id, caseId));
  }
}

export const modCaseRepository = new ModCaseRepository();
