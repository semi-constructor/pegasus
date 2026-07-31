import { eq, and, sql, lt, isNotNull } from 'drizzle-orm';
import { getDatabase } from '../database/connection';
import { giveaways, giveawayEntries } from '../database/schema/giveaways';

export interface CreateGiveawayData {
  giveawayId: string;
  guildId: string;
  channelId: string;
  messageId?: string;
  hostedBy: string;
  prize: string;
  winnerCount: number;
  endTime: Date;
  startTime?: Date | null;
  status?: string;
  description: string | null;
  requirements: Record<string, unknown>;
  bonusEntries: Record<string, unknown>;
  embedColor: number;
}

export class GiveawayRepository {
  private get db() {
    return getDatabase();
  }

  async createGiveaway(data: CreateGiveawayData) {
    const [giveaway] = await this.db
      .insert(giveaways)
      .values({
        ...data,
        requirements: data.requirements, // Already handled by Drizzle json() type
        bonusEntries: data.bonusEntries, // Already handled by Drizzle json() type
        status: data.status || 'active',
        startTime: data.startTime,
        entries: 0,
      })
      .returning();

    return giveaway;
  }

  async getGiveaway(giveawayId: string) {
    const [giveaway] = await this.db
      .select()
      .from(giveaways)
      .where(eq(giveaways.giveawayId, giveawayId))
      .limit(1);

    return giveaway;
  }

  async updateGiveaway(giveawayId: string, updates: Partial<typeof giveaways.$inferInsert>) {
    const [updated] = await this.db
      .update(giveaways)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(giveaways.giveawayId, giveawayId))
      .returning();

    return updated;
  }

  async addEntry(giveawayId: string, userId: string, entryCount: number) {
    // Check if user already has an entry
    const [existing] = await this.db
      .select()
      .from(giveawayEntries)
      .where(and(eq(giveawayEntries.giveawayId, giveawayId), eq(giveawayEntries.userId, userId)))
      .limit(1);

    if (existing) {
      // Update existing entry
      await this.db
        .update(giveawayEntries)
        .set({
          entries: entryCount,
          updatedAt: new Date(),
        })
        .where(and(eq(giveawayEntries.giveawayId, giveawayId), eq(giveawayEntries.userId, userId)));
    } else {
      // Create new entry
      await this.db.insert(giveawayEntries).values({
        giveawayId,
        userId,
        entries: entryCount,
      });

      // Increment entry count on giveaway
      await this.db
        .update(giveaways)
        .set({
          entries: sql`${giveaways.entries} + 1`,
        })
        .where(eq(giveaways.giveawayId, giveawayId));
    }
  }

  async removeEntry(giveawayId: string, userId: string) {
    const deleted = await this.db
      .delete(giveawayEntries)
      .where(and(eq(giveawayEntries.giveawayId, giveawayId), eq(giveawayEntries.userId, userId)))
      .returning();

    if (deleted.length > 0) {
      // Decrement entry count on giveaway
      await this.db
        .update(giveaways)
        .set({
          entries: sql`GREATEST(${giveaways.entries} - 1, 0)`,
        })
        .where(eq(giveaways.giveawayId, giveawayId));
    }
  }

  async getEntries(giveawayId: string) {
    return this.db.select().from(giveawayEntries).where(eq(giveawayEntries.giveawayId, giveawayId));
  }

  async getUserEntry(giveawayId: string, userId: string) {
    const [entry] = await this.db
      .select()
      .from(giveawayEntries)
      .where(and(eq(giveawayEntries.giveawayId, giveawayId), eq(giveawayEntries.userId, userId)))
      .limit(1);

    return entry;
  }

  async getActiveGiveaways() {
    const db = getDatabase();
    return db.select().from(giveaways).where(eq(giveaways.status, 'active'));
  }

  async getGuildGiveaways(guildId: string, status?: 'active' | 'ended' | 'cancelled') {
    const conditions = [eq(giveaways.guildId, guildId)];

    if (status) {
      conditions.push(eq(giveaways.status, status));
    }

    const db = getDatabase();
    return db
      .select()
      .from(giveaways)
      .where(and(...conditions))
      .orderBy(giveaways.createdAt);
  }

  async getExpiredGiveaways() {
    const db = getDatabase();
    return db
      .select()
      .from(giveaways)
      .where(and(eq(giveaways.status, 'active'), lt(giveaways.endTime, new Date())));
  }

  async getScheduledGiveaways() {
    const db = getDatabase();
    return db
      .select()
      .from(giveaways)
      .where(and(eq(giveaways.status, 'scheduled'), lt(giveaways.startTime, new Date())));
  }

  async getEndedGiveawaysPendingAnnouncement() {
    return this.db
      .select()
      .from(giveaways)
      .where(
        and(
          eq(giveaways.status, 'ended'),
          eq(giveaways.announcementSent, false),
          isNotNull(giveaways.winners)
        )
      );
  }

  async getUserGiveawayStats(userId: string) {
    const entries = await this.db
      .select({
        totalEntries: sql<number>`count(*)::int`,
        totalWins: sql<number>`count(case when ${giveaways.winners}::jsonb ? ${userId} then 1 end)::int`,
      })
      .from(giveawayEntries)
      .leftJoin(giveaways, eq(giveawayEntries.giveawayId, giveaways.giveawayId))
      .where(eq(giveawayEntries.userId, userId));

    return {
      totalEntries: entries[0]?.totalEntries || 0,
      totalWins: entries[0]?.totalWins || 0,
    };
  }
}

export const giveawayRepository = new GiveawayRepository();
