import { getDatabase } from '../database/connection';
import {
  guilds,
  guildSettings,
  xpSettings,
  xpRewards,
  economySettings,
  economyShopItems,
} from '../database/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger';

export interface XPConfig {
  enabled: boolean;
  perMessage: number;
  perVoiceMinute: number;
  cooldown: number;
  announceLevelUp: boolean;
  levelUpChannel?: string | null;
  levelUpMessage?: string | null;
  boosterRole?: string;
  boosterMultiplier: number;
  ignoredChannels: string[];
  ignoredRoles: string[];
  noXpChannels: string[];
  doubleXpChannels: string[];
  roleMultipliers: Record<string, number>;
  levelUpRewardsEnabled: boolean;
  stackRoleRewards: boolean;
}

export interface WelcomeConfig {
  enabled: boolean;
  channel?: string;
  message?: string;
  embedEnabled: boolean;
  imageEnabled: boolean;
  embedColor: string;
  embedTitle?: string;
  embedImage?: string;
  embedThumbnail?: string;
  dmEnabled: boolean;
  dmMessage?: string;
}

export interface GoodbyeConfig {
  enabled: boolean;
  channel?: string;
  message?: string;
  embedEnabled: boolean;
  imageEnabled: boolean;
  embedColor: string;
  embedTitle?: string;
  embedImage?: string;
  embedThumbnail?: string;
}

export interface AutoroleConfig {
  enabled: boolean;
  roles: string[];
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  type: string;
  effectType?: string;
  effectValue?: unknown;
  stock: number | null;
  requiresRole?: string;
  enabled: boolean;
}

export class ConfigurationService {
  // XP Configuration Methods
  async getXPConfig(guildId: string): Promise<XPConfig> {
    try {
      let [settings] = await getDatabase()
        .select()
        .from(guildSettings)
        .where(eq(guildSettings.guildId, guildId))
        .limit(1);

      const [xpConfig] = await getDatabase()
        .select()
        .from(xpSettings)
        .where(eq(xpSettings.guildId, guildId))
        .limit(1);

      if (!settings) {
        // Create default guild settings
        const [newSettings] = await getDatabase()
          .insert(guildSettings)
          .values({ guildId })
          .returning();
        settings = newSettings;
      }

      return {
        enabled: settings.xpEnabled,
        perMessage: settings.xpPerMessage,
        perVoiceMinute: settings.xpPerVoiceMinute,
        cooldown: settings.xpCooldown,
        announceLevelUp: settings.xpAnnounceLevelUp,
        levelUpChannel: settings.levelUpChannel || undefined,
        levelUpMessage: settings.levelUpMessage || undefined,
        boosterRole: settings.xpBoosterRole || undefined,
        boosterMultiplier: settings.xpBoosterMultiplier,
        ignoredChannels:
          xpConfig && xpConfig.ignoredChannels
            ? (JSON.parse(xpConfig.ignoredChannels) as string[])
            : [],
        ignoredRoles:
          xpConfig && xpConfig.ignoredRoles ? (JSON.parse(xpConfig.ignoredRoles) as string[]) : [],
        noXpChannels:
          xpConfig && xpConfig.noXpChannels ? (JSON.parse(xpConfig.noXpChannels) as string[]) : [],
        doubleXpChannels:
          xpConfig && xpConfig.doubleXpChannels
            ? (JSON.parse(xpConfig.doubleXpChannels) as string[])
            : [],
        roleMultipliers:
          xpConfig && xpConfig.roleMultipliers
            ? (JSON.parse(xpConfig.roleMultipliers) as Record<string, number>)
            : {},
        levelUpRewardsEnabled: xpConfig?.levelUpRewardsEnabled ?? true,
        stackRoleRewards: xpConfig?.stackRoleRewards ?? false,
      };
    } catch (error) {
      logger.error(`Failed to get XP config for guild ${guildId}:`, error);
      throw error;
    }
  }

  async updateXPConfig(guildId: string, config: Partial<XPConfig>): Promise<void> {
    try {
      const updateData: Partial<typeof guildSettings.$inferInsert> = {};

      // Update guild settings fields
      if (config.enabled !== undefined) updateData.xpEnabled = config.enabled;
      if (config.perMessage !== undefined) updateData.xpPerMessage = config.perMessage;
      if (config.perVoiceMinute !== undefined) updateData.xpPerVoiceMinute = config.perVoiceMinute;
      if (config.cooldown !== undefined) updateData.xpCooldown = config.cooldown;
      if (config.announceLevelUp !== undefined)
        updateData.xpAnnounceLevelUp = config.announceLevelUp;
      if (config.levelUpChannel !== undefined)
        updateData.levelUpChannel = config.levelUpChannel ?? null;
      if (config.levelUpMessage !== undefined)
        updateData.levelUpMessage = config.levelUpMessage ?? null;
      if (config.boosterRole !== undefined) updateData.xpBoosterRole = config.boosterRole;
      if (config.boosterMultiplier !== undefined)
        updateData.xpBoosterMultiplier = config.boosterMultiplier;

      if (Object.keys(updateData).length > 0) {
        await getDatabase()
          .update(guildSettings)
          .set({ ...updateData, updatedAt: new Date() })
          .where(eq(guildSettings.guildId, guildId));
      }

      // Update xp settings fields
      const xpUpdateData: Partial<typeof xpSettings.$inferInsert> = {};
      if (config.ignoredChannels !== undefined)
        xpUpdateData.ignoredChannels = JSON.stringify(config.ignoredChannels);
      if (config.ignoredRoles !== undefined)
        xpUpdateData.ignoredRoles = JSON.stringify(config.ignoredRoles);
      if (config.noXpChannels !== undefined)
        xpUpdateData.noXpChannels = JSON.stringify(config.noXpChannels);
      if (config.doubleXpChannels !== undefined)
        xpUpdateData.doubleXpChannels = JSON.stringify(config.doubleXpChannels);
      if (config.roleMultipliers !== undefined)
        xpUpdateData.roleMultipliers = JSON.stringify(config.roleMultipliers);
      if (config.levelUpRewardsEnabled !== undefined)
        xpUpdateData.levelUpRewardsEnabled = config.levelUpRewardsEnabled;
      if (config.stackRoleRewards !== undefined)
        xpUpdateData.stackRoleRewards = config.stackRoleRewards;

      if (Object.keys(xpUpdateData).length > 0) {
        await getDatabase()
          .insert(xpSettings)
          .values({ guildId, ...xpUpdateData })
          .onConflictDoUpdate({
            target: xpSettings.guildId,
            set: { ...xpUpdateData, updatedAt: new Date() },
          });
      }
    } catch (error) {
      logger.error(`Failed to update XP config for guild ${guildId}:`, error);
      throw error;
    }
  }

  async setXPRoleReward(guildId: string, level: number, roleId: string): Promise<void> {
    try {
      await getDatabase()
        .insert(xpRewards)
        .values({ guildId, level, roleId })
        .onConflictDoNothing();
    } catch (error) {
      logger.error(`Failed to set XP role reward for guild ${guildId}:`, error);
      throw error;
    }
  }

  async removeXPRoleReward(guildId: string, level: number): Promise<void> {
    try {
      await getDatabase()
        .delete(xpRewards)
        .where(and(eq(xpRewards.guildId, guildId), eq(xpRewards.level, level)));
    } catch (error) {
      logger.error(`Failed to remove XP role reward for guild ${guildId}:`, error);
      throw error;
    }
  }

  async getXPRoleRewards(guildId: string): Promise<Array<{ level: number; roleId: string }>> {
    try {
      const rewards = await getDatabase()
        .select()
        .from(xpRewards)
        .where(eq(xpRewards.guildId, guildId))
        .orderBy(xpRewards.level);

      return rewards;
    } catch (error) {
      logger.error(`Failed to get XP role rewards for guild ${guildId}:`, error);
      throw error;
    }
  }

  // Economy Configuration Methods
  async getEconomyConfig(guildId: string) {
    try {
      const [settings] = await getDatabase()
        .select()
        .from(economySettings)
        .where(eq(economySettings.guildId, guildId))
        .limit(1);

      if (!settings) {
        // Create default settings
        const [newSettings] = await getDatabase()
          .insert(economySettings)
          .values({ guildId })
          .returning();
        return newSettings;
      }

      return settings;
    } catch (error) {
      logger.error(`Failed to get economy config for guild ${guildId}:`, error);
      throw error;
    }
  }

  async updateEconomyConfig(
    guildId: string,
    config: Partial<typeof economySettings.$inferInsert>
  ): Promise<void> {
    try {
      await getDatabase()
        .insert(economySettings)
        .values({ guildId, ...config })
        .onConflictDoUpdate({
          target: economySettings.guildId,
          set: { ...config, updatedAt: new Date() },
        });
    } catch (error) {
      logger.error(`Failed to update economy config for guild ${guildId}:`, error);
      throw error;
    }
  }

  async getShopItems(guildId: string): Promise<ShopItem[]> {
    try {
      const items = await getDatabase()
        .select()
        .from(economyShopItems)
        .where(eq(economyShopItems.guildId, guildId))
        .orderBy(economyShopItems.price);

      return items.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: Number(item.price),
        type: item.type,
        effectType: item.effectType || undefined,
        effectValue: item.effectValue,
        stock: item.stock,
        requiresRole: item.requiresRole || undefined,
        enabled: item.enabled,
      }));
    } catch (error) {
      logger.error(`Failed to get shop items for guild ${guildId}:`, error);
      throw error;
    }
  }

  async addShopItem(guildId: string, item: Omit<ShopItem, 'id'>): Promise<string> {
    try {
      const [newItem] = await getDatabase()
        .insert(economyShopItems)
        .values({
          guildId,
          name: item.name,
          description: item.description,
          price: item.price,
          type: item.type,
          effectType: item.effectType,
          effectValue: item.effectValue,
          stock: item.stock,
          requiresRole: item.requiresRole,
          enabled: item.enabled,
        })
        .returning();

      return newItem.id;
    } catch (error) {
      logger.error(`Failed to add shop item for guild ${guildId}:`, error);
      throw error;
    }
  }

  async updateShopItem(itemId: string, updates: Partial<Omit<ShopItem, 'id'>>): Promise<void> {
    try {
      await getDatabase()
        .update(economyShopItems)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(economyShopItems.id, itemId));
    } catch (error) {
      logger.error(`Failed to update shop item ${itemId}:`, error);
      throw error;
    }
  }

  async deleteShopItem(itemId: string): Promise<void> {
    try {
      await getDatabase().delete(economyShopItems).where(eq(economyShopItems.id, itemId));
    } catch (error) {
      logger.error(`Failed to delete shop item ${itemId}:`, error);
      throw error;
    }
  }

  // Welcome Configuration Methods
  async getWelcomeConfig(guildId: string): Promise<WelcomeConfig> {
    try {
      let [settings] = await getDatabase()
        .select()
        .from(guildSettings)
        .where(eq(guildSettings.guildId, guildId))
        .limit(1);

      if (!settings) {
        // Create default guild settings
        const [newSettings] = await getDatabase()
          .insert(guildSettings)
          .values({ guildId })
          .returning();
        settings = newSettings;
      }

      return {
        enabled: settings.welcomeEnabled,
        channel: settings.welcomeChannel || undefined,
        message: settings.welcomeMessage || undefined,
        embedEnabled: settings.welcomeEmbedEnabled,
        imageEnabled: settings.welcomeImageEnabled,
        embedColor: settings.welcomeEmbedColor || '#0099FF',
        embedTitle: settings.welcomeEmbedTitle || undefined,
        embedImage: settings.welcomeEmbedImage || undefined,
        embedThumbnail: settings.welcomeEmbedThumbnail || undefined,
        dmEnabled: settings.welcomeDmEnabled,
        dmMessage: settings.welcomeDmMessage || undefined,
      };
    } catch (error) {
      logger.error(`Failed to get welcome config for guild ${guildId}:`, error);
      throw error;
    }
  }

  async updateWelcomeConfig(guildId: string, config: Partial<WelcomeConfig>): Promise<void> {
    try {
      const updateData: Partial<typeof guildSettings.$inferInsert> = {};

      if (config.enabled !== undefined) updateData.welcomeEnabled = config.enabled;
      if (config.channel !== undefined) updateData.welcomeChannel = config.channel;
      if (config.message !== undefined) updateData.welcomeMessage = config.message;
      if (config.embedEnabled !== undefined) updateData.welcomeEmbedEnabled = config.embedEnabled;
      if (config.imageEnabled !== undefined) updateData.welcomeImageEnabled = config.imageEnabled;
      if (config.embedColor !== undefined) updateData.welcomeEmbedColor = config.embedColor;
      if (config.embedTitle !== undefined) updateData.welcomeEmbedTitle = config.embedTitle;
      if (config.embedImage !== undefined) updateData.welcomeEmbedImage = config.embedImage;
      if (config.embedThumbnail !== undefined)
        updateData.welcomeEmbedThumbnail = config.embedThumbnail;
      if (config.dmEnabled !== undefined) updateData.welcomeDmEnabled = config.dmEnabled;
      if (config.dmMessage !== undefined) updateData.welcomeDmMessage = config.dmMessage;

      await getDatabase()
        .update(guildSettings)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(guildSettings.guildId, guildId));
    } catch (error) {
      logger.error(`Failed to update welcome config for guild ${guildId}:`, error);
      throw error;
    }
  }

  // Goodbye Configuration Methods
  async getGoodbyeConfig(guildId: string): Promise<GoodbyeConfig> {
    try {
      let [settings] = await getDatabase()
        .select()
        .from(guildSettings)
        .where(eq(guildSettings.guildId, guildId))
        .limit(1);

      if (!settings) {
        // Create default guild settings
        const [newSettings] = await getDatabase()
          .insert(guildSettings)
          .values({ guildId })
          .returning();
        settings = newSettings;
      }

      return {
        enabled: settings.goodbyeEnabled,
        channel: settings.goodbyeChannel || undefined,
        message: settings.goodbyeMessage || undefined,
        embedEnabled: settings.goodbyeEmbedEnabled,
        imageEnabled: settings.goodbyeImageEnabled,
        embedColor: settings.goodbyeEmbedColor || '#FF0000',
        embedTitle: settings.goodbyeEmbedTitle || undefined,
        embedImage: settings.goodbyeEmbedImage || undefined,
        embedThumbnail: settings.goodbyeEmbedThumbnail || undefined,
      };
    } catch (error) {
      logger.error(`Failed to get goodbye config for guild ${guildId}:`, error);
      throw error;
    }
  }

  async updateGoodbyeConfig(guildId: string, config: Partial<GoodbyeConfig>): Promise<void> {
    try {
      const updateData: Partial<typeof guildSettings.$inferInsert> = {};

      if (config.enabled !== undefined) updateData.goodbyeEnabled = config.enabled;
      if (config.channel !== undefined) updateData.goodbyeChannel = config.channel;
      if (config.message !== undefined) updateData.goodbyeMessage = config.message;
      if (config.embedEnabled !== undefined) updateData.goodbyeEmbedEnabled = config.embedEnabled;
      if (config.imageEnabled !== undefined) updateData.goodbyeImageEnabled = config.imageEnabled;
      if (config.embedColor !== undefined) updateData.goodbyeEmbedColor = config.embedColor;
      if (config.embedTitle !== undefined) updateData.goodbyeEmbedTitle = config.embedTitle;
      if (config.embedImage !== undefined) updateData.goodbyeEmbedImage = config.embedImage;
      if (config.embedThumbnail !== undefined)
        updateData.goodbyeEmbedThumbnail = config.embedThumbnail;

      await getDatabase()
        .update(guildSettings)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(guildSettings.guildId, guildId));
    } catch (error) {
      logger.error(`Failed to update goodbye config for guild ${guildId}:`, error);
      throw error;
    }
  }

  // Autorole Configuration Methods
  async getAutoroleConfig(guildId: string): Promise<AutoroleConfig> {
    try {
      let [settings] = await getDatabase()
        .select()
        .from(guildSettings)
        .where(eq(guildSettings.guildId, guildId))
        .limit(1);

      if (!settings) {
        // Create default guild settings
        const [newSettings] = await getDatabase()
          .insert(guildSettings)
          .values({ guildId })
          .returning();
        settings = newSettings;
      }

      return {
        enabled: settings.autoroleEnabled,
        roles: settings.autoroleRoles ? (JSON.parse(settings.autoroleRoles) as string[]) : [],
      };
    } catch (error) {
      logger.error(`Failed to get autorole config for guild ${guildId}:`, error);
      throw error;
    }
  }

  async updateAutoroleConfig(guildId: string, config: Partial<AutoroleConfig>): Promise<void> {
    try {
      const updateData: Partial<typeof guildSettings.$inferInsert> = {};

      if (config.enabled !== undefined) updateData.autoroleEnabled = config.enabled;
      if (config.roles !== undefined) updateData.autoroleRoles = JSON.stringify(config.roles);

      await getDatabase()
        .update(guildSettings)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(guildSettings.guildId, guildId));
    } catch (error) {
      logger.error(`Failed to update autorole config for guild ${guildId}:`, error);
      throw error;
    }
  }

  // Language Configuration Methods
  async getGuildLanguage(guildId: string): Promise<string> {
    try {
      const [guild] = await getDatabase()
        .select()
        .from(guilds)
        .where(eq(guilds.id, guildId))
        .limit(1);

      return guild?.language || 'en';
    } catch (error) {
      logger.error(`Failed to get guild language for ${guildId}:`, error);
      throw error;
    }
  }

  async setGuildLanguage(guildId: string, language: string): Promise<void> {
    try {
      await getDatabase()
        .update(guilds)
        .set({ language, updatedAt: new Date() })
        .where(eq(guilds.id, guildId));
    } catch (error) {
      logger.error(`Failed to set guild language for ${guildId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const configurationService = new ConfigurationService();
