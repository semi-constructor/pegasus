import { Client, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';
import chalk from 'chalk';
import type { Command } from '../types/command';

interface ExtendedClient extends Client {
  __commands?: Array<ReturnType<Command['data']['toJSON']>>;
}

type CommandModule = {
  data?: Command['data'];
  execute?: Command['execute'];
  autocomplete?: Command['autocomplete'];
  isSubcommand?: boolean;
  default?: any;
};

export async function loadCommands(client: Client): Promise<void> {
  const commands: Array<ReturnType<Command['data']['toJSON']>> = [];
  const commandsPath = join(__dirname, '..', 'commands');
  const commandCategories = readdirSync(commandsPath);

  for (const category of commandCategories) {
    const categoryPath = join(commandsPath, category);
    const commandFiles = readdirSync(categoryPath).filter(
      file => file.endsWith('.ts') || file.endsWith('.js')
    );

    for (const file of commandFiles) {
      try {
        const filePath = join(categoryPath, file);
        const commandModule = (await import(filePath)) as CommandModule;

        if (commandModule.isSubcommand || (commandModule.default && commandModule.default.isSubcommand)) {
          continue;
        }

        if (commandModule.data && commandModule.execute) {
          const command = commandModule as Command;
          client.commands.set(command.data.name, command);
          commands.push(command.data.toJSON());
          logger.info(chalk.green(`Loaded command: ${command.data.name} (${category})`));
        } else {
          logger.warn(
            chalk.yellow(`Command at ${filePath} is missing required "data" or "execute" property`)
          );
        }
      } catch (error) {
        logger.error(chalk.red(`Failed to load command ${file}:`), error);
      }
    }
  }

  // Store commands for registration after bot is ready
  (client as ExtendedClient).__commands = commands;
  logger.info(
    chalk.green(`Loaded ${commands.length} commands, waiting for bot to be ready to register...`)
  );
}

export async function registerCommands(client: Client): Promise<void> {
  // Get stored commands
  const commands = (client as ExtendedClient).__commands || [];
  if (commands.length === 0) {
    logger.warn(chalk.yellow('No commands to register'));
    return;
  }

  // Register commands with Discord
  try {
    const token = process.env.DISCORD_TOKEN;
    if (!token) throw new Error('DISCORD_TOKEN is not defined');

    if (!client.user?.id) {
      throw new Error('Client user ID is not available');
    }

    const rest = new REST({ version: '10' }).setToken(token);

    const testGuildId = process.env.TEST_GUILD_ID;
    if (
      process.env.NODE_ENV === 'development' &&
      testGuildId &&
      testGuildId !== 'your_test_guild_id'
    ) {
      // Register commands to a specific guild for development
      await rest.put(Routes.applicationGuildCommands(client.user.id, testGuildId), {
        body: commands,
      });
      logger.info(chalk.green(`Registered ${commands.length} commands to guild ${testGuildId}`));
    } else {
      // Register commands globally for production
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
      logger.info(chalk.green(`Registered ${commands.length} commands globally`));
    }
  } catch (error) {
    logger.error(chalk.red('Failed to register commands:'), error);
    // Don't throw error, just log it
  }
}
