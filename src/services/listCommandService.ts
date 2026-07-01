import { EmbedBuilder, Message } from 'discord.js';
import { t } from '../i18n';
import { readFileSync, watch } from 'node:fs';
import path from 'node:path';
import { logger } from '../utils/logger';

interface BaseCommandDefinition {
  trigger: string;
  title: string;
  description?: string;
}

interface ListCommandDefinition extends BaseCommandDefinition {
  kind: 'list';
  entries: Array<{ name: string; url: string }>;
}

interface HelpCommandDefinition extends BaseCommandDefinition {
  kind: 'help';
  commands: Array<{ name: string; description?: string }>;
}

type CommandDefinition = ListCommandDefinition | HelpCommandDefinition;

type ListCommandMap = Map<string, CommandDefinition>;

function formatTitleFromKey(key: string): string {
  const words = key.split('-').map(word => {
    if (word.length <= 3) {
      return word.toUpperCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
  return words.join(' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function loadListDefinitions(configPath: string): ListCommandMap {
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    const commands: ListCommandMap = new Map();

    const commandGroups = isRecord(data.commands) ? data.commands : {};

    Object.entries(commandGroups).forEach(([key, value]) => {
      if (!isRecord(value)) return;

      const prefix = typeof value.prefix === 'string' ? value.prefix.trim() : '';
      if (!prefix) {
        logger.warn(`Command "${key}" in lists.json is missing a valid prefix`);
        return;
      }

      if (!isRecord(value.items)) {
        logger.warn(`Command "${key}" in lists.json is missing item definitions`);
        return;
      }

      const entries = Object.entries(value.items)
        .filter(
          ([name, url]) =>
            typeof name === 'string' && typeof url === 'string' && url.trim().length > 0
        )
        .map(([name, url]) => ({
          name,
          url: url as string,
        }));

      if (entries.length === 0) {
        logger.warn(`Command "${key}" in lists.json has no valid entries`);
        return;
      }

      const title =
        typeof value.title === 'string' && value.title.trim().length > 0
          ? value.title.trim()
          : formatTitleFromKey(key);
      const description =
        typeof value.description === 'string' && value.description.trim().length > 0
          ? value.description.trim()
          : undefined;

      commands.set(prefix.toLowerCase(), {
        kind: 'list',
        trigger: prefix,
        title,
        description,
        entries,
      });
    });

    if (isRecord(data.help)) {
      const helpPrefix =
        typeof data.help.prefix === 'string' ? data.help.prefix.trim().toLowerCase() : '';
      const trigger = typeof data.help.prefix === 'string' ? data.help.prefix.trim() : '';

      if (helpPrefix && trigger) {
        const helpDescription =
          typeof data.help.description === 'string' && data.help.description.trim().length > 0
            ? data.help.description.trim()
            : undefined;

        const helpCommands: Array<{ name: string; description?: string }> = Array.isArray(
          data.help.commands
        )
          ? data.help.commands.reduce<Array<{ name: string; description?: string }>>(
              (acc, command) => {
                if (!isRecord(command)) {
                  return acc;
                }
                const name = typeof command.name === 'string' ? command.name.trim() : '';
                if (!name) {
                  return acc;
                }
                const cmdDescription =
                  typeof command.description === 'string' && command.description.trim().length > 0
                    ? command.description.trim()
                    : undefined;
                acc.push({ name, description: cmdDescription });
                return acc;
              },
              []
            )
          : [];

        commands.set(helpPrefix, {
          kind: 'help',
          trigger,
          title: formatTitleFromKey('help'),
          description: helpDescription,
          commands: helpCommands,
        });
      }
    }

    return commands;
  } catch (error) {
    logger.error('Failed to load lists.json for prefix commands:', error);
    return new Map();
  }
}

export class ListCommandService {
  private commands: ListCommandMap;
  private readonly configPath: string;
  private reloadTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.configPath = path.join(__dirname, '..', '..', 'lists.json');
    this.commands = loadListDefinitions(this.configPath);
    this.watchForUpdates();
  }

  async handle(message: Message): Promise<boolean> {
    if (!message.content) return false;

    const trigger = message.content.trim().toLowerCase();
    const definition = this.commands.get(trigger);

    if (!definition) {
      return false;
    }

    const embed = new EmbedBuilder().setColor(0x5865f2).setTimestamp();

    if (definition.kind === 'list') {
      const entriesDescription = definition.entries
        .map(entry => `• [${entry.name}](${entry.url})`)
        .join('\n');

      const description = definition.description
        ? `${definition.description}\n\n${entriesDescription}`
        : entriesDescription;

      embed.setTitle(definition.title).setDescription(description);
    } else {
      const description =
        definition.description ??
        t('commands.list.available', { defaultValue: 'Available list commands:' });

      embed.setTitle(definition.title).setDescription(description);

      definition.commands.slice(0, 25).forEach(command => {
        embed.addFields({
          name: command.name,
          value:
            command.description ??
            t('common.noDescription', { defaultValue: 'No description provided.' }),
        });
      });
    }

    if (!message.channel || !message.channel.isTextBased() || !('send' in message.channel)) {
      logger.warn(`Cannot send list embed for trigger "${definition.trigger}" in non-text channel`);
      return false;
    }

    try {
      const channel = message.channel;
      if (typeof channel.send !== 'function') {
        return false;
      }
      await channel.send({ embeds: [embed] });
      return true;
    } catch (error) {
      logger.error(`Failed to send list embed for trigger "${definition.trigger}":`, error);
      return false;
    }
  }

  private watchForUpdates(): void {
    try {
      watch(this.configPath, { persistent: false }, () => {
        if (this.reloadTimer) {
          clearTimeout(this.reloadTimer);
        }

        this.reloadTimer = setTimeout(() => {
          this.reloadTimer = null;
          try {
            const updated = loadListDefinitions(this.configPath);
            if (updated.size > 0) {
              this.commands.clear();
              updated.forEach((definition, trigger) => {
                this.commands.set(trigger, definition);
              });
              logger.info('List command definitions reloaded after lists.json change');
            } else {
              logger.warn('lists.json reload produced no list command definitions');
            }
          } catch (error) {
            logger.error('Failed to reload lists.json after change:', error);
          }
        }, 250);
      });
    } catch (error) {
      logger.error('Failed to watch lists.json for prefix command updates:', error);
    }
  }
}

export const listCommandService = new ListCommandService();
