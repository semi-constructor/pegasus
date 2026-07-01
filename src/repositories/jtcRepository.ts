import { eq, and } from 'drizzle-orm';
import { BaseRepository } from './baseRepository';
import { jtcConfigs, jtcChannels } from '../database/schema/jtc';

export interface JTCConfigData {
  baseVoiceChannelId: string;
  categoryId: string;
  panelChannelId: string;
  panelMessageId?: string | null;
  channelNameFormat?: string;
}

export interface JTCTempChannelData {
  guildId: string;
  channelId: string;
  ownerId: string;
  baseVoiceChannelId: string;
  isLocked?: boolean;
  userLimit?: number;
}

export class JTCRepository extends BaseRepository {
  async getConfig(guildId: string) {
    return this.executeQuery(`JTCRepository.getConfig(${guildId})`, async () => {
      const [config] = await this.db
        .select()
        .from(jtcConfigs)
        .where(eq(jtcConfigs.guildId, guildId))
        .limit(1);
      return config || null;
    });
  }

  async getConfigByBaseChannel(baseVoiceChannelId: string) {
    return this.executeQuery(
      `JTCRepository.getConfigByBaseChannel(${baseVoiceChannelId})`,
      async () => {
        const [config] = await this.db
          .select()
          .from(jtcConfigs)
          .where(eq(jtcConfigs.baseVoiceChannelId, baseVoiceChannelId))
          .limit(1);
        return config || null;
      }
    );
  }

  async upsertConfig(guildId: string, data: JTCConfigData) {
    return this.executeQuery(`JTCRepository.upsertConfig(${guildId})`, async () => {
      const [config] = await this.db
        .insert(jtcConfigs)
        .values({
          guildId,
          baseVoiceChannelId: data.baseVoiceChannelId,
          categoryId: data.categoryId,
          panelChannelId: data.panelChannelId,
          panelMessageId: data.panelMessageId,
          channelNameFormat: data.channelNameFormat ?? "{user}'s Channel",
        })
        .onConflictDoUpdate({
          target: jtcConfigs.guildId,
          set: {
            baseVoiceChannelId: data.baseVoiceChannelId,
            categoryId: data.categoryId,
            panelChannelId: data.panelChannelId,
            ...(data.panelMessageId !== undefined ? { panelMessageId: data.panelMessageId } : {}),
            ...(data.channelNameFormat !== undefined
              ? { channelNameFormat: data.channelNameFormat }
              : {}),
            updatedAt: new Date(),
          },
        })
        .returning();
      return config;
    });
  }

  async deleteConfig(guildId: string) {
    return this.executeQuery(`JTCRepository.deleteConfig(${guildId})`, async () => {
      const [deleted] = await this.db
        .delete(jtcConfigs)
        .where(eq(jtcConfigs.guildId, guildId))
        .returning();
      return deleted || null;
    });
  }

  async setPanelMessage(guildId: string, panelMessageId: string) {
    return this.executeQuery(`JTCRepository.setPanelMessage(${guildId})`, async () => {
      const [config] = await this.db
        .update(jtcConfigs)
        .set({ panelMessageId, updatedAt: new Date() })
        .where(eq(jtcConfigs.guildId, guildId))
        .returning();
      return config || null;
    });
  }

  async createTempChannel(data: JTCTempChannelData) {
    return this.executeQuery(`JTCRepository.createTempChannel(${data.channelId})`, async () => {
      const [channel] = await this.db
        .insert(jtcChannels)
        .values({
          guildId: data.guildId,
          channelId: data.channelId,
          ownerId: data.ownerId,
          baseVoiceChannelId: data.baseVoiceChannelId,
          isLocked: data.isLocked ?? false,
          userLimit: data.userLimit ?? 0,
        })
        .returning();
      return channel;
    });
  }

  async getTempChannel(channelId: string) {
    return this.executeQuery(`JTCRepository.getTempChannel(${channelId})`, async () => {
      const [channel] = await this.db
        .select()
        .from(jtcChannels)
        .where(eq(jtcChannels.channelId, channelId))
        .limit(1);
      return channel || null;
    });
  }

  async getTempChannelByOwner(guildId: string, ownerId: string) {
    return this.executeQuery(
      `JTCRepository.getTempChannelByOwner(${guildId}, ${ownerId})`,
      async () => {
        const [channel] = await this.db
          .select()
          .from(jtcChannels)
          .where(and(eq(jtcChannels.guildId, guildId), eq(jtcChannels.ownerId, ownerId)))
          .limit(1);
        return channel || null;
      }
    );
  }

  async updateTempChannel(
    channelId: string,
    updates: Partial<{ isLocked: boolean; userLimit: number; ownerId: string }>
  ) {
    return this.executeQuery(`JTCRepository.updateTempChannel(${channelId})`, async () => {
      const [channel] = await this.db
        .update(jtcChannels)
        .set(updates)
        .where(eq(jtcChannels.channelId, channelId))
        .returning();
      return channel || null;
    });
  }

  async deleteTempChannel(channelId: string) {
    return this.executeQuery(`JTCRepository.deleteTempChannel(${channelId})`, async () => {
      const [deleted] = await this.db
        .delete(jtcChannels)
        .where(eq(jtcChannels.channelId, channelId))
        .returning();
      return deleted || null;
    });
  }
}

export const jtcRepository = new JTCRepository();
