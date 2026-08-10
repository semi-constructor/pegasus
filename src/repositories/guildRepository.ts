import { eq } from 'drizzle-orm';
import { getDatabase } from '../database/connection';
import { guilds, guildSettings } from '../database/schema';
import type { Guild, GuildSettings } from '../types';

export class GuildRepository {
  private get db() {
    return getDatabase();
  }

  async findById(id: string): Promise<Guild | null> {
    const result = await this.db.select().from(guilds).where(eq(guilds.id, id)).limit(1);

    if (!result[0]) return null;
    return {
      ...result[0],
      prefix: result[0].prefix ?? undefined,
      language: result[0].language ?? undefined,
    };
  }

  async create(guildId: string): Promise<Guild> {
    const [guild] = await this.db.insert(guilds).values({ id: guildId }).returning();

    return {
      ...guild,
      prefix: guild.prefix ?? undefined,
      language: guild.language ?? undefined,
    };
  }

  async update(
    guildId: string,
    data: Partial<Omit<Guild, 'id' | 'createdAt'>>
  ): Promise<Guild | null> {
    const [updated] = await this.db
      .update(guilds)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(guilds.id, guildId))
      .returning();

    if (!updated) return null;
    return {
      ...updated,
      prefix: updated.prefix ?? undefined,
      language: updated.language ?? undefined,
    };
  }

  async delete(guildId: string): Promise<boolean> {
    const result = await this.db.delete(guilds).where(eq(guilds.id, guildId));

    return result.count > 0;
  }

  async getSettings(guildId: string): Promise<GuildSettings | null> {
    const result = await this.db
      .select()
      .from(guildSettings)
      .where(eq(guildSettings.guildId, guildId))
      .limit(1);

    if (!result[0]) return null;

    // Map null values to undefined for optional fields
    const settings = result[0];
    return {
      ...settings,
      welcomeChannel: settings.welcomeChannel ?? undefined,
      welcomeMessage: settings.welcomeMessage ?? undefined,
      goodbyeChannel: settings.goodbyeChannel ?? undefined,
      goodbyeMessage: settings.goodbyeMessage ?? undefined,
      logsChannel: settings.logsChannel ?? undefined,
      levelUpMessage: settings.levelUpMessage ?? undefined,
      levelUpChannel: settings.levelUpChannel ?? undefined,
      honeypotChannelId: settings.honeypotChannelId ?? undefined,
      stickies: settings.stickies ? JSON.parse(settings.stickies) : undefined,
    } as GuildSettings;
  }

  async updateSettings(
    guildId: string,
    settings: Partial<Omit<GuildSettings, 'guildId' | 'createdAt'>>
  ): Promise<GuildSettings> {
    const dbSettings = {
      ...settings,
      stickies: settings.stickies ? JSON.stringify(settings.stickies) : undefined,
    };

    const [updated] = await this.db
      .insert(guildSettings)
      .values({ guildId, ...dbSettings })
      .onConflictDoUpdate({
        target: guildSettings.guildId,
        set: { ...dbSettings, updatedAt: new Date() },
      })
      .returning();

    // Map null values to undefined for optional fields
    return {
      ...updated,
      welcomeChannel: updated.welcomeChannel ?? undefined,
      welcomeMessage: updated.welcomeMessage ?? undefined,
      goodbyeChannel: updated.goodbyeChannel ?? undefined,
      goodbyeMessage: updated.goodbyeMessage ?? undefined,
      logsChannel: updated.logsChannel ?? undefined,
      levelUpMessage: updated.levelUpMessage ?? undefined,
      levelUpChannel: updated.levelUpChannel ?? undefined,
      honeypotChannelId: updated.honeypotChannelId ?? undefined,
      stickies: updated.stickies ? JSON.parse(updated.stickies) : undefined,
    } as GuildSettings;
  }
}

// Export singleton instance
export const guildRepository = new GuildRepository();
