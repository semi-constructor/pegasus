import { Client } from 'discord.js';
import { Player } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';
import { logger } from '../utils/logger';

export class MusicService {
  public player: Player | null = null;

  public async init(client: Client) {
    try {
      this.player = new Player(client);

      // Load default extractors (YouTube, Spotify, SoundCloud, etc)
      await this.player.extractors.loadMulti(DefaultExtractors);
      logger.info('Music player initialized with extractors.');
    } catch (error) {
      logger.error('Failed to initialize music player:', error);
    }
  }
}

export const musicService = new MusicService();
