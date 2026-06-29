import { Events, VoiceState } from 'discord.js';
import { xpService } from '../services/xpService';
import { configurationService } from '../services/configurationService';
import { guildService } from '../services/guildService';
import { logger } from '../utils/logger';
import { jtcService } from '../services/jtcService';
import { engagementService } from '../services/engagementService';

export const name = Events.VoiceStateUpdate;
export const once = false;

export async function execute(oldState: VoiceState, newState: VoiceState) {
  // Ignore bot voice state changes
  if (newState.member?.user.bot) return;

  try {
    // User joined a voice channel
    if (!oldState.channel && newState.channel) {
      await handleVoiceJoin(newState);
    }
    // User left a voice channel
    else if (oldState.channel && !newState.channel) {
      await handleVoiceLeave(oldState);
    }
    // User moved between channels
    else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
      await handleVoiceLeave(oldState);
      await handleVoiceJoin(newState);
    }
  } catch (error) {
    logger.error('Error in voiceStateUpdate event:', error);
  }
}

async function handleVoiceJoin(state: VoiceState) {
  if (!state.guild || !state.member) return;

  await jtcService.handleVoiceJoin(state);

  try {
    // Ensure guild exists in database
    await guildService.ensureGuild(state.guild);

    const config = await configurationService.getXPConfig(state.guild.id);

    // Check if XP is enabled
    if (!config.enabled) return;

    // Check if channel is ignored
    if (state.channel && config.ignoredChannels.includes(state.channel.id)) return;

    // Don't track if user is muted or deafened
    if (state.mute || state.deaf || state.selfMute || state.selfDeaf) return;

    // Start tracking voice time
    xpService.startVoiceTracking(state.member.id, state.guild.id);
  } catch (error) {
    logger.error('Failed to handle voice join:', error);
  }
}

async function handleVoiceLeave(state: VoiceState) {
  if (!state.guild || !state.member) return;

  await jtcService.handleVoiceLeave(state);

  try {
    const voiceStates = xpService.getAllVoiceStates();
    const startTime = voiceStates.get(`${state.member.id}-${state.guild.id}`);
    if (startTime) {
      const minutes = Math.floor((Date.now() - startTime) / 60000);
      if (minutes > 0) {
        await engagementService.trackVoiceActivity(state.member.id, state.guild.id, state.member, minutes);
      }
    }

    // Stop tracking and award XP
    const result = await xpService.stopVoiceTracking(state.member.id, state.guild.id, state.member);


    // Handle level up if needed (similar to messageCreate)
    if (result && result.leveledUp) {
      // config is fetched but not used for level up announcements in voice state changes

      // Add role rewards
      if (result.rewardRoles && result.rewardRoles.length > 0) {
        for (const roleId of result.rewardRoles) {
          try {
            const role = state.guild.roles.cache.get(roleId);
            if (role && !state.member.roles.cache.has(roleId)) {
              await state.member.roles.add(role);
            }
          } catch (error) {
            logger.error(`Failed to add role ${roleId} to member ${state.member.id}:`, error);
          }
        }
      }
    }
  } catch (error) {
    logger.error('Failed to handle voice leave:', error);
  }
}

// Cleanup function for bot shutdown
export function cleanup() {
  const voiceStates = xpService.getAllVoiceStates();

  // Log any remaining voice states for debugging
  if (voiceStates.size > 0) {
    logger.info(`Cleaning up ${voiceStates.size} voice states on shutdown`);
  }
}
