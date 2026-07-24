import { Client, Collection, EmbedBuilder } from 'discord.js';
import { t, withLocale } from '../i18n';
import { Command, CommandCategory } from '../types/command';
import { logger } from '../utils/logger';

// ─── Serialized Discord API option shapes (from .toJSON()) ────────────────────

interface JsonOption {
  type: number;
  name: string;
  description: string;
  required?: boolean;
  options?: JsonOption[];
}

// Discord ApplicationCommandOptionType values
const OPT_SUB_COMMAND       = 1;
const OPT_SUB_COMMAND_GROUP = 2;

// ─── Service ──────────────────────────────────────────────────────────────────

export class HelpService {
  /**
   * The client's command collection.
   * Populated lazily on first use via setClient() or directly.
   */
  private clientCommands: Collection<string, Command> | null = null;
  private commandsByCategory: Map<CommandCategory, Command[]> = new Map();

  // ─── Wiring ─────────────────────────────────────────────────────────────────

  private lastClient: Client | null = null;

  /**
   * Point the service at the Discord client so it can read already-loaded
   * commands (which were imported after i18n was initialized).
   * Rebuilds the category index only when the client reference changes.
   */
  setClient(client: Client): void {
    if (client === this.lastClient) return;
    if (!('commands' in client)) {
      logger.warn('HelpService: client.commands not available');
      return;
    }
    this.lastClient = client;
    this.clientCommands = (client as any).commands as Collection<string, Command>;
    this.rebuildCategoryIndex();
  }

  /**
   * Directly supply a pre-built collection (useful in tests or when the
   * client isn't available yet).
   */
  setCommands(commands: Collection<string, Command>): void {
    this.clientCommands = commands;
    this.rebuildCategoryIndex();
  }

  private get commands(): Collection<string, Command> {
    return this.clientCommands ?? new Collection();
  }

  private rebuildCategoryIndex(): void {
    this.commandsByCategory.clear();
    for (const cmd of this.commands.values()) {
      if (!this.commandsByCategory.has(cmd.category)) {
        this.commandsByCategory.set(cmd.category, []);
      }
      this.commandsByCategory.get(cmd.category)!.push(cmd);
    }
  }

  // ─── Core helper: serialize builder → plain JSON options ─────────────────

  /**
   * Calls `.toJSON()` on the Discord.js builder so we get plain objects
   * with numeric `type` fields, regardless of builder class.
   */
  private getJsonOptions(command: Command): JsonOption[] {
    try {
      const json = command.data.toJSON() as { options?: JsonOption[] };
      return json.options ?? [];
    } catch (err) {
      logger.warn(`HelpService: toJSON() failed for /${command.data.name}: ${err}`);
      return [];
    }
  }

  // ─── Overview embed ───────────────────────────────────────────────────────

  /**
   * Category overview — every subcommand leaf gets its own line so users can
   * see all available commands at a glance.
   */
  async getHelpMenu(locale: string): Promise<EmbedBuilder> {
    return withLocale(locale, () => {
      const embed = new EmbedBuilder()
        .setTitle(t('commands.help.title'))
        .setDescription(t('commands.help.description'))
        .setColor(0x5865f2)
        .setTimestamp();

      const categoryOrder: CommandCategory[] = [
        CommandCategory.Utility,
        CommandCategory.Moderation,
        CommandCategory.Economy,
        CommandCategory.XP,
        CommandCategory.Giveaways,
        CommandCategory.Tickets,
        CommandCategory.Fun,
        CommandCategory.Admin,
      ];

      for (const category of categoryOrder) {
        const cmds = this.commandsByCategory.get(category);
        if (!cmds || cmds.length === 0) continue;

        const lines: string[] = [];

        for (const cmd of cmds) {
          const options = this.getJsonOptions(cmd);
          const leaves  = this.flattenToLeaves(options);

          if (leaves.length > 0) {
            for (const leaf of leaves) {
              lines.push(`\`/${cmd.data.name} ${leaf.fullName}\` — ${leaf.description}`);
            }
          } else {
            lines.push(
              `\`/${cmd.data.name}\` — ${cmd.data.description || t('commands.help.noDescription')}`
            );
          }
        }

        const raw = lines.join('\n') || t('common.none');
        embed.addFields({
          name:   t(`commands.help.categories.${category}`),
          value:  raw.length > 1024 ? raw.slice(0, 1021) + '…' : raw,
          inline: false,
        });
      }

      embed.setFooter({ text: t('commands.help.menuFooter') });
      return Promise.resolve(embed);
    });
  }

  // ─── Per-command detail embed ─────────────────────────────────────────────

  /**
   * Detailed view for a single command.
   * Plain commands show their options; subcommand commands get one field per
   * subcommand (or per group child), each with its own options listed.
   */
  async getCommandHelp(commandName: string, locale: string): Promise<EmbedBuilder | null> {
    const command = this.commands.get(commandName);
    if (!command) return null;

    return withLocale(locale, () => {
      const embed = new EmbedBuilder()
        .setTitle(t('commands.help.commandInfo'))
        .setColor(0x5865f2)
        .setTimestamp();

      const options    = this.getJsonOptions(command);
      const hasSubcmds = options.some(
        o => o.type === OPT_SUB_COMMAND || o.type === OPT_SUB_COMMAND_GROUP
      );

      // ── Header: name | category | cooldown ───────────────────────────────
      embed.addFields(
        {
          name:   t('commands.help.commandName'),
          value:  `\`/${command.data.name}\``,
          inline: true,
        },
        {
          name:   t('commands.help.category'),
          value:  t(`commands.help.categories.${command.category}`),
          inline: true,
        },
        {
          name:   t('commands.help.cooldown'),
          value:  command.cooldown
            ? t('commands.help.cooldownValue', { seconds: command.cooldown })
            : t('commands.help.noCooldown'),
          inline: true,
        }
      );

      // ── Description ───────────────────────────────────────────────────────
      embed.addFields({
        name:   t('commands.help.description', { defaultValue: 'Description' }),
        value:  command.data.description || t('commands.help.noDescription'),
        inline: false,
      });

      // ── Required permissions ──────────────────────────────────────────────
      if (command.permissions && command.permissions.length > 0) {
        embed.addFields({
          name:   t('commands.help.permissions'),
          value:  command.permissions.map(p => `\`${String(p)}\``).join(', '),
          inline: false,
        });
      }

      // ── Options / subcommands ─────────────────────────────────────────────
      if (options.length === 0) {
        embed.addFields({
          name:   t('commands.help.usage'),
          value:  `\`/${command.data.name}\``,
          inline: false,
        });
      } else if (!hasSubcmds) {
        // Plain command with options only
        embed.addFields({
          name:   t('commands.help.usage'),
          value:  this.buildUsageLine(command.data.name, options),
          inline: false,
        });
        const optLines = this.renderOptions(options);
        if (optLines.length > 0) {
          embed.addFields({
            name:   t('commands.help.options'),
            value:  optLines.join('\n'),
            inline: false,
          });
        }
      } else {
        // One field per subcommand / group child
        for (const option of options) {
          if (option.type === OPT_SUB_COMMAND) {
            this.addSubcommandField(embed, command.data.name, option);
          } else if (option.type === OPT_SUB_COMMAND_GROUP) {
            this.addGroupFields(embed, command.data.name, option);
          }
        }
      }

      embed.setFooter({ text: t('commands.help.commandFooter') });
      return Promise.resolve(embed);
    });
  }

  // ─── Embed field builders ─────────────────────────────────────────────────

  private addSubcommandField(embed: EmbedBuilder, cmdName: string, sub: JsonOption): void {
    const lines: string[] = [
      sub.description || t('commands.help.noDescription'),
      `**${t('commands.help.usage')}:** ${this.buildUsageLine(`${cmdName} ${sub.name}`, sub.options ?? [])}`,
    ];

    const optLines = this.renderOptions(sub.options ?? []);
    if (optLines.length > 0) {
      lines.push('', ...optLines);
    }

    const value = lines.join('\n');
    embed.addFields({
      name:   `\`/${cmdName} ${sub.name}\``,
      value:  value.length > 1024 ? value.slice(0, 1021) + '…' : value,
      inline: false,
    });
  }

  private addGroupFields(embed: EmbedBuilder, cmdName: string, group: JsonOption): void {
    for (const child of group.options ?? []) {
      if (child.type !== OPT_SUB_COMMAND) continue;

      const lines: string[] = [
        child.description || t('commands.help.noDescription'),
        `**${t('commands.help.usage')}:** ${this.buildUsageLine(`${cmdName} ${group.name} ${child.name}`, child.options ?? [])}`,
      ];

      const optLines = this.renderOptions(child.options ?? []);
      if (optLines.length > 0) {
        lines.push('', ...optLines);
      }

      const value = lines.join('\n');
      embed.addFields({
        name:   `\`/${cmdName} ${group.name} ${child.name}\``,
        value:  value.length > 1024 ? value.slice(0, 1021) + '…' : value,
        inline: false,
      });
    }
  }

  // ─── Formatting helpers ───────────────────────────────────────────────────

  private renderOptions(options: JsonOption[]): string[] {
    return options
      .filter(o => o.type !== OPT_SUB_COMMAND && o.type !== OPT_SUB_COMMAND_GROUP)
      .map(o => {
        const req = o.required ? '`<required>`' : '`[optional]`';
        return `• **${o.name}** ${req} — ${o.description || t('commands.help.noDescription')}`;
      });
  }

  private buildUsageLine(fullName: string, options: JsonOption[]): string {
    const args = options
      .filter(o => o.type !== OPT_SUB_COMMAND && o.type !== OPT_SUB_COMMAND_GROUP)
      .map(o => (o.required ? `<${o.name}>` : `[${o.name}]`));

    return args.length > 0
      ? `\`/${fullName} ${args.join(' ')}\``
      : `\`/${fullName}\``;
  }

  private flattenToLeaves(options: JsonOption[]): Array<{ fullName: string; description: string }> {
    const result: Array<{ fullName: string; description: string }> = [];

    for (const opt of options) {
      if (opt.type === OPT_SUB_COMMAND) {
        result.push({
          fullName:    opt.name,
          description: opt.description || t('commands.help.noDescription'),
        });
      } else if (opt.type === OPT_SUB_COMMAND_GROUP) {
        for (const child of opt.options ?? []) {
          if (child.type === OPT_SUB_COMMAND) {
            result.push({
              fullName:    `${opt.name} ${child.name}`,
              description: child.description || t('commands.help.noDescription'),
            });
          }
        }
      }
    }

    return result;
  }

  // ─── Public utilities ─────────────────────────────────────────────────────

  async getCommandList(): Promise<string[]> {
    return Array.from(this.commands.keys()).sort();
  }

  getCategoryCommands(category: CommandCategory): Command[] {
    return this.commandsByCategory.get(category) ?? [];
  }

  getAllCategories(): CommandCategory[] {
    return Array.from(this.commandsByCategory.keys());
  }

  getCommandByName(name: string): Command | undefined {
    return this.commands.get(name);
  }
}
