import { Client, GatewayIntentBits, Collection, ActivityType } from 'discord.js';
import chalk from 'chalk';
import { config } from './config/env';
import { initializeDatabase } from './database/connection';
import { loadCommands } from './handlers/commandHandler';
import { loadEvents } from './handlers/eventHandler';
import { initializeI18n } from './i18n';
import { logger } from './utils/logger';
import { startApiServer } from './api/server';
import type { Command } from './types/command';

// Extend the Discord.js Client
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, Command>;
    cooldowns: Collection<string, Collection<string, number>>;
  }
}

class PegasusBot extends Client {
  public commands: Collection<string, Command> = new Collection();
  public cooldowns: Collection<string, Collection<string, number>> = new Collection();

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildScheduledEvents,
        GatewayIntentBits.AutoModerationConfiguration,
        GatewayIntentBits.AutoModerationExecution,
      ],
      allowedMentions: {
        parse: ['users', 'roles'],
        repliedUser: true,
      },
      presence: {
        status: 'online',
        activities: [
          {
            name: 'Starting up...',
            type: ActivityType.Playing,
          },
        ],
      },
    });
  }

  public async start(): Promise<void> {
    try {
      // Initialize i18n
      logger.info(chalk.blue('Initializing i18n...'));
      await initializeI18n();

      // Initialize database
      logger.info(chalk.blue('Connecting to database...'));
      try {
        await initializeDatabase();
        logger.info(chalk.green('Database connected successfully'));
      } catch (error) {
        logger.warn(
          chalk.yellow('Database connection failed - bot will run with limited functionality')
        );
        logger.warn(
          chalk.yellow(
            'Some features like economy, XP, and moderation may not work without database'
          )
        );
        // Continue without database - bot can still run basic commands
      }

      // Load commands
      logger.info(chalk.blue('Loading commands...'));
      await loadCommands(this);

      // Load events
      logger.info(chalk.blue('Loading events...'));
      await loadEvents(this);

      // Login to Discord
      logger.info(chalk.blue('Logging in to Discord...'));
      await this.login(config.DISCORD_TOKEN);

      // Start API server if enabled
      if (config.ENABLE_API) {
        logger.info(chalk.blue('Starting API server...'));
        startApiServer();
      } else {
        logger.info(chalk.yellow('API server disabled - bot running in standalone mode'));
      }
    } catch (error) {
      logger.error(chalk.red('Failed to start bot:'), error);
      process.exit(1);
    }
  }
}

// Create bot instance
const bot = new PegasusBot();

// Handle process events
process.on('unhandledRejection', (error: Error) => {
  logger.error(chalk.red('Unhandled Rejection:'), error);
});

process.on('uncaughtException', (error: Error) => {
  logger.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

process.on('SIGINT', () => {
  logger.info(chalk.yellow('Received SIGINT, shutting down gracefully...'));
  bot.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info(chalk.yellow('Received SIGTERM, shutting down gracefully...'));
  bot.destroy();
  process.exit(0);
});

// Start the bot
void bot.start();

// Export client for API access
export const client = bot;
