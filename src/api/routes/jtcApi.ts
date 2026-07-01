import { Router, Request, Response } from 'express';
import { client } from '../../index';
import { getDatabase } from '../../database/connection';
import { jtcConfigs, jtcChannels } from '../../database/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  VoiceChannel,
} from 'discord.js';

const router = Router();

// Helper to extract common params
function getParams(req: Request) {
  const guildId = req.body.guildId || req.query.guildId || req.params.guildId;
  const channelId = req.body.channelId || req.query.channelId;
  return { guildId, channelId };
}

/**
 * GET /api/jtc/config
 * Get JTC config for a guild
 */
const handleGetConfig = async (req: Request, res: Response) => {
  const { guildId } = getParams(req);

  if (!guildId) {
    return res.status(400).json({ error: 'Bad Request', message: 'guildId is required' });
  }

  try {
    const db = getDatabase();
    const [config] = await db
      .select()
      .from(jtcConfigs)
      .where(eq(jtcConfigs.guildId, guildId))
      .limit(1);

    if (!config) {
      return res
        .status(404)
        .json({ error: 'Not Found', message: 'JTC configuration not found for this guild' });
    }

    return res.json({ success: true, config });
  } catch (error) {
    logger.error('Error fetching JTC config:', error);
    return res
      .status(500)
      .json({ error: 'Internal Server Error', message: 'Failed to fetch JTC configuration' });
  }
};

router.get('/config', handleGetConfig);

/**
 * GET /api/jtc/config/:guildId
 */
router.get('/config/:guildId', async (req: Request, res: Response) => {
  req.query.guildId = req.params.guildId;
  return handleGetConfig(req, res);
});

/**
 * POST /api/jtc/config
 * Create or update JTC config and post/update panel message
 */
const handlePostConfig = async (req: Request, res: Response) => {
  const { guildId } = getParams(req);
  const {
    baseVoiceChannelId,
    categoryId,
    panelChannelId,
    channelNameFormat,
    panelTitle,
    panelDescription,
  } = req.body;

  if (!guildId || !baseVoiceChannelId || !categoryId || !panelChannelId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'guildId, baseVoiceChannelId, categoryId, and panelChannelId are required',
    });
  }

  try {
    const db = getDatabase();
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: 'Not Found', message: 'Guild not found in bot cache' });
    }

    const panelChannel = guild.channels.cache.get(panelChannelId) as TextChannel;
    if (!panelChannel || !panelChannel.isTextBased()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid panelChannelId or channel is not text-based',
      });
    }

    // Check existing config
    const [existingConfig] = await db
      .select()
      .from(jtcConfigs)
      .where(eq(jtcConfigs.guildId, guildId))
      .limit(1);

    let messageId = existingConfig?.panelMessageId;

    // Create embed and buttons for JTC management panel
    const embed = new EmbedBuilder()
      .setTitle(panelTitle || '🔊 Join to Create Voice Channel')
      .setDescription(
        panelDescription ||
          `Join <#${baseVoiceChannelId}> to instantly create your own temporary voice channel!\n\nUse the buttons below to manage your channel's privacy and user limit.`
      )
      .setColor(0x5865f2)
      .setFooter({ text: 'JTC Voice Management' })
      .setTimestamp();

    const lockBtn = new ButtonBuilder()
      .setCustomId('jtc_lock')
      .setLabel('Lock Channel')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒');
    const unlockBtn = new ButtonBuilder()
      .setCustomId('jtc_unlock')
      .setLabel('Unlock Channel')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🔓');
    const limitBtn = new ButtonBuilder()
      .setCustomId('jtc_limit')
      .setLabel('Set User Limit')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👥');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(lockBtn, unlockBtn, limitBtn);

    if (messageId) {
      try {
        const existingMsg = await panelChannel.messages.fetch(messageId);
        await existingMsg.edit({ embeds: [embed], components: [row] });
      } catch (e) {
        // Message deleted or not found, send new one
        const newMsg = await panelChannel.send({ embeds: [embed], components: [row] });
        messageId = newMsg.id;
      }
    } else {
      const newMsg = await panelChannel.send({ embeds: [embed], components: [row] });
      messageId = newMsg.id;
    }

    let updatedConfig;

    if (existingConfig) {
      [updatedConfig] = await db
        .update(jtcConfigs)
        .set({
          baseVoiceChannelId,
          categoryId,
          panelChannelId,
          panelMessageId: messageId,
          channelNameFormat: channelNameFormat || existingConfig.channelNameFormat,
          updatedAt: new Date(),
        })
        .where(eq(jtcConfigs.guildId, guildId))
        .returning();
    } else {
      [updatedConfig] = await db
        .insert(jtcConfigs)
        .values({
          guildId,
          baseVoiceChannelId,
          categoryId,
          panelChannelId,
          panelMessageId: messageId,
          channelNameFormat: channelNameFormat || "{user}'s Channel",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
    }

    logger.info(`Updated JTC config for guild ${guildId}`);

    return res.json({
      success: true,
      message: 'JTC configuration saved successfully',
      config: updatedConfig,
    });
  } catch (error) {
    logger.error('Error saving JTC config:', error);
    return res
      .status(500)
      .json({ error: 'Internal Server Error', message: 'Failed to save JTC configuration' });
  }
};

router.post('/config', handlePostConfig);
router.patch('/config', handlePostConfig);

/**
 * POST /api/jtc/panel/update
 * Update the JTC panel message in Discord
 */
const handlePanelUpdate = async (req: Request, res: Response) => {
  const { guildId } = getParams(req);
  const { title, description } = req.body;

  if (!guildId) {
    return res.status(400).json({ error: 'Bad Request', message: 'guildId is required' });
  }

  try {
    const db = getDatabase();
    const [config] = await db
      .select()
      .from(jtcConfigs)
      .where(eq(jtcConfigs.guildId, guildId))
      .limit(1);

    if (!config || !config.panelChannelId || !config.panelMessageId) {
      return res
        .status(404)
        .json({ error: 'Not Found', message: 'JTC panel configuration not found for this guild' });
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Not Found', message: 'Guild not found in bot cache' });
    }

    const panelChannel = guild.channels.cache.get(config.panelChannelId) as TextChannel;
    if (panelChannel && panelChannel.isTextBased()) {
      const existingMsg = await panelChannel.messages.fetch(config.panelMessageId);

      const embed = new EmbedBuilder()
        .setTitle(title || '🔊 Join to Create Voice Channel')
        .setDescription(
          description ||
            `Join <#${config.baseVoiceChannelId}> to instantly create your own temporary voice channel!\n\nUse the buttons below to manage your channel's privacy and user limit.`
        )
        .setColor(0x5865f2)
        .setFooter({ text: 'JTC Voice Management' })
        .setTimestamp();

      await existingMsg.edit({ embeds: [embed] });

      logger.info(`Updated JTC panel message for guild ${guildId}`);
      return res.json({ success: true, message: 'JTC panel message updated successfully' });
    }

    return res
      .status(400)
      .json({ error: 'Bad Request', message: 'Could not fetch panel channel or message' });
  } catch (error) {
    logger.error('Error updating JTC panel:', error);
    return res
      .status(500)
      .json({ error: 'Internal Server Error', message: 'Failed to update JTC panel message' });
  }
};

router.post('/panel/update', handlePanelUpdate);
router.patch('/panel/update', handlePanelUpdate);

/**
 * POST /api/jtc/channels/lock
 * Lock a specific active JTC voice channel
 */
const handleChannelsLock = async (req: Request, res: Response) => {
  const { guildId, channelId } = getParams(req);

  if (!guildId || !channelId) {
    return res
      .status(400)
      .json({ error: 'Bad Request', message: 'guildId and channelId are required' });
  }

  try {
    const db = getDatabase();
    const [jtcChannel] = await db
      .select()
      .from(jtcChannels)
      .where(and(eq(jtcChannels.channelId, channelId), eq(jtcChannels.guildId, guildId)))
      .limit(1);

    if (!jtcChannel) {
      return res
        .status(404)
        .json({ error: 'Not Found', message: 'Active JTC channel not found in database' });
    }

    const guild = client.guilds.cache.get(guildId);
    if (guild) {
      const voiceChannel = guild.channels.cache.get(channelId) as VoiceChannel;
      if (voiceChannel && voiceChannel.isVoiceBased()) {
        await voiceChannel.permissionOverwrites.edit(guild.id, { Connect: false });
      }
    }

    await db
      .update(jtcChannels)
      .set({ isLocked: true })
      .where(and(eq(jtcChannels.channelId, channelId), eq(jtcChannels.guildId, guildId)));

    logger.info(`Dashboard locked JTC channel ${channelId}`);
    return res.json({ success: true, message: 'JTC channel locked successfully' });
  } catch (error) {
    logger.error('Error locking JTC channel:', error);
    return res
      .status(500)
      .json({ error: 'Internal Server Error', message: 'Failed to lock JTC channel' });
  }
};

router.post('/channels/lock', handleChannelsLock);
router.patch('/channels/lock', handleChannelsLock);

/**
 * POST /api/jtc/channels/unlock
 * Unlock a specific active JTC voice channel
 */
const handleChannelsUnlock = async (req: Request, res: Response) => {
  const { guildId, channelId } = getParams(req);

  if (!guildId || !channelId) {
    return res
      .status(400)
      .json({ error: 'Bad Request', message: 'guildId and channelId are required' });
  }

  try {
    const db = getDatabase();
    const [jtcChannel] = await db
      .select()
      .from(jtcChannels)
      .where(and(eq(jtcChannels.channelId, channelId), eq(jtcChannels.guildId, guildId)))
      .limit(1);

    if (!jtcChannel) {
      return res
        .status(404)
        .json({ error: 'Not Found', message: 'Active JTC channel not found in database' });
    }

    const guild = client.guilds.cache.get(guildId);
    if (guild) {
      const voiceChannel = guild.channels.cache.get(channelId) as VoiceChannel;
      if (voiceChannel && voiceChannel.isVoiceBased()) {
        await voiceChannel.permissionOverwrites.edit(guild.id, { Connect: null });
      }
    }

    await db
      .update(jtcChannels)
      .set({ isLocked: false })
      .where(and(eq(jtcChannels.channelId, channelId), eq(jtcChannels.guildId, guildId)));

    logger.info(`Dashboard unlocked JTC channel ${channelId}`);
    return res.json({ success: true, message: 'JTC channel unlocked successfully' });
  } catch (error) {
    logger.error('Error unlocking JTC channel:', error);
    return res
      .status(500)
      .json({ error: 'Internal Server Error', message: 'Failed to unlock JTC channel' });
  }
};

router.post('/channels/unlock', handleChannelsUnlock);
router.patch('/channels/unlock', handleChannelsUnlock);

/**
 * POST /api/jtc/channels/limit
 * Set user limit for a JTC voice channel
 */
const handleChannelsLimit = async (req: Request, res: Response) => {
  const { guildId, channelId } = getParams(req);
  const { userLimit } = req.body;

  if (!guildId || !channelId || userLimit === undefined) {
    return res
      .status(400)
      .json({ error: 'Bad Request', message: 'guildId, channelId, and userLimit are required' });
  }

  const limit = parseInt(userLimit, 10);
  if (isNaN(limit) || limit < 0 || limit > 99) {
    return res
      .status(400)
      .json({ error: 'Bad Request', message: 'userLimit must be a number between 0 and 99' });
  }

  try {
    const db = getDatabase();
    const [jtcChannel] = await db
      .select()
      .from(jtcChannels)
      .where(and(eq(jtcChannels.channelId, channelId), eq(jtcChannels.guildId, guildId)))
      .limit(1);

    if (!jtcChannel) {
      return res
        .status(404)
        .json({ error: 'Not Found', message: 'Active JTC channel not found in database' });
    }

    const guild = client.guilds.cache.get(guildId);
    if (guild) {
      const voiceChannel = guild.channels.cache.get(channelId) as VoiceChannel;
      if (voiceChannel && voiceChannel.isVoiceBased()) {
        await voiceChannel.setUserLimit(limit);
      }
    }

    await db
      .update(jtcChannels)
      .set({ userLimit: limit })
      .where(and(eq(jtcChannels.channelId, channelId), eq(jtcChannels.guildId, guildId)));

    logger.info(`Dashboard set user limit ${limit} for JTC channel ${channelId}`);
    return res.json({ success: true, message: `JTC channel user limit set to ${limit}` });
  } catch (error) {
    logger.error('Error setting JTC channel limit:', error);
    return res
      .status(500)
      .json({ error: 'Internal Server Error', message: 'Failed to set JTC channel user limit' });
  }
};

router.post('/channels/limit', handleChannelsLimit);
router.patch('/channels/limit', handleChannelsLimit);

export const jtcApiRouter = router;
