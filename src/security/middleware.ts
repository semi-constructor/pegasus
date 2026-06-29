import {
  ChatInputCommandInteraction,
  Message,
  GuildMember,
  PermissionFlagsBits,
  EmbedBuilder,
  ApplicationCommandOptionType,
} from 'discord.js';
import { checkCommandRateLimit, RateLimitResult } from './rateLimiter';
import { PermissionManager, PermissionCheck } from './permissions';
import { Validator, CommandSchemas, ValidationError } from './validator';
import { Sanitizer } from './sanitizer';
import { auditLogger } from './audit';
import { logger } from '../utils/logger';
import { t } from '../i18n';
import { securityService } from '../services/securityService';
import type { Command } from '../types/command';

export interface SecurityContext {
  userId: string;
  guildId: string;
  channelId: string;
  commandName: string;
  timestamp: number;
  isOwner: boolean;
  permissions: bigint;
}

export interface SecurityCheckResult {
  passed: boolean;
  error?: string;
  code?: 'RATE_LIMIT' | 'PERMISSION' | 'VALIDATION' | 'BLACKLIST' | 'MAINTENANCE';
  details?: Record<string, unknown>;
}

/**
 * Main security middleware for commands
 */
export async function securityMiddleware(
  interaction: ChatInputCommandInteraction,
  command: Command
): Promise<SecurityCheckResult> {
  const context: SecurityContext = {
    userId: interaction.user.id,
    guildId: interaction.guildId || '',
    channelId: interaction.channelId,
    commandName: `${command.data.name}`,
    timestamp: Date.now(),
    isOwner: PermissionManager.isBotOwner(interaction.user.id),
    permissions:
      interaction.member && 'permissions' in interaction.member
        ? (interaction.member as GuildMember).permissions.bitfield
        : 0n,
  };

  try {
    // 1. Check maintenance mode
    if (process.env.MAINTENANCE_MODE === 'true' && !context.isOwner) {
      return {
        passed: false,
        error: t('security.maintenance'),
        code: 'MAINTENANCE',
      };
    }

    // 2. Check blacklist
    const blacklistCheck = await checkBlacklist(context);
    if (!blacklistCheck.passed) {
      return blacklistCheck;
    }

    // 3. Check rate limits
    const rateLimitCheck = await checkRateLimit(context);
    if (!rateLimitCheck.passed) {
      await handleRateLimit(interaction, rateLimitCheck.details as unknown as RateLimitResult);
      return rateLimitCheck;
    }

    // 4. Check permissions
    if (command.permissions && command.permissions.length > 0) {
      // Convert PermissionResolvable[] to bigint[]
      const permissionBits = command.permissions.map(p => {
        if (typeof p === 'bigint') return p;
        if (typeof p === 'string') {
          // Handle string permissions - check if it's a permission flag name
          const permissionFlag = PermissionFlagsBits[p as keyof typeof PermissionFlagsBits];
          if (permissionFlag !== undefined) {
            return permissionFlag;
          }
          // Try to parse as bigint string
          try {
            return BigInt(p);
          } catch {
            // Invalid permission string
            return 0n;
          }
        }
        if (typeof p === 'number') return BigInt(p);
        // Handle arrays - combine permissions
        if (Array.isArray(p)) {
          return p.reduce((acc: bigint, perm) => {
            if (typeof perm === 'bigint') return acc | perm;
            if (typeof perm === 'string') {
              const flag = PermissionFlagsBits[perm as keyof typeof PermissionFlagsBits];
              return flag ? acc | flag : acc;
            }
            if (typeof perm === 'number') return acc | BigInt(perm);
            return acc;
          }, 0n);
        }
        // Default fallback
        return 0n;
      });
      const permissionCheck = await PermissionManager.checkCommandPermissions(
        interaction,
        permissionBits
      );

      if (!permissionCheck.allowed) {
        await handlePermissionDenied(interaction, permissionCheck);
        return {
          passed: false,
          error: permissionCheck.reason,
          code: 'PERMISSION',
          details: permissionCheck as unknown as Record<string, unknown>,
        };
      }
    }

    // 5. Validate input
    const validationCheck = validateCommandInput(interaction, command);
    if (!validationCheck.passed) {
      const error = validationCheck.error || 'Validation failed';
      await handleValidationError(interaction, error);
      return validationCheck;
    }

    // 6. Log command execution
    await auditLogger.logAction({
      action: 'COMMAND_EXECUTE',
      userId: context.userId,
      guildId: context.guildId,
      targetId: context.channelId,
      details: {
        command: context.commandName,
        options: sanitizeOptions([...interaction.options.data]),
      },
    });

    return { passed: true };
  } catch (error) {
    logger.error('Security middleware error:', error);
    return {
      passed: false,
      error: t('security.error'),
      code: 'VALIDATION',
    };
  }
}

/**
 * Check if user/guild is blacklisted
 */
async function checkBlacklist(context: SecurityContext): Promise<SecurityCheckResult> {
  // Check user blacklist
  const userBlacklisted = await securityService.isBlacklisted('user', context.userId);
  if (userBlacklisted) {
    return {
      passed: false,
      error: t('security.blacklisted.user'),
      code: 'BLACKLIST',
    };
  }

  // Check guild blacklist
  const guildBlacklisted = await securityService.isBlacklisted('guild', context.guildId);
  if (guildBlacklisted) {
    return {
      passed: false,
      error: t('security.blacklisted.guild'),
      code: 'BLACKLIST',
    };
  }

  return { passed: true };
}

/**
 * Check rate limits
 */
async function checkRateLimit(context: SecurityContext): Promise<SecurityCheckResult> {
  // Owners bypass rate limits
  if (context.isOwner) {
    return { passed: true };
  }

  // Check if user has rate limit bypass permission
  if (
    (context.permissions & PermissionFlagsBits.Administrator) ===
    PermissionFlagsBits.Administrator
  ) {
    return { passed: true };
  }

  const result = await checkCommandRateLimit(context.userId, context.guildId, context.commandName);

  if (!result.allowed) {
    return {
      passed: false,
      error: t('security.rateLimit', {
        seconds: Math.ceil(result.msBeforeNext / 1000),
      }),
      code: 'RATE_LIMIT',
      details: result as unknown as Record<string, unknown>,
    };
  }

  return { passed: true };
}

/**
 * Validate command input
 */
function validateCommandInput(
  interaction: ChatInputCommandInteraction,
  command: Command
): SecurityCheckResult {
  const commandName = command.data.name;
  const subcommand = interaction.options.getSubcommand(false);
  const subcommandGroup = interaction.options.getSubcommandGroup(false);

  // Get validation schema
  let schema = null;
  const commandSchemas = CommandSchemas as Record<string, Record<string, unknown>>;

  if (subcommandGroup && subcommand) {
    const groupSchemas = commandSchemas[commandName];
    if (groupSchemas && typeof groupSchemas === 'object') {
      const subcommandSchemas = groupSchemas[subcommandGroup];
      if (subcommandSchemas && typeof subcommandSchemas === 'object') {
        schema = (subcommandSchemas as Record<string, unknown>)[subcommand];
      }
    }
  } else if (subcommand) {
    const subcommandSchemas = commandSchemas[commandName];
    if (subcommandSchemas && typeof subcommandSchemas === 'object') {
      schema = subcommandSchemas[subcommand];
    }
  } else {
    const defaultSchemas = commandSchemas[commandName];
    if (defaultSchemas && typeof defaultSchemas === 'object') {
      schema = defaultSchemas['default'];
    }
  }

  if (!schema) {
    return { passed: true }; // No schema defined, skip validation
  }

  try {
    // Extract options
    const options: Record<string, unknown> = {};

    // Navigate through the command structure
    let targetOptions = interaction.options.data;

    // If there's a subcommand group, navigate to it
    if (subcommandGroup) {
      const group = targetOptions.find(
        opt =>
          opt.name === subcommandGroup && opt.type === ApplicationCommandOptionType.SubcommandGroup
      );
      if (group?.options) {
        targetOptions = group.options;
      }
    }

    // If there's a subcommand, navigate to it
    if (subcommand) {
      const sub = targetOptions.find(
        opt => opt.name === subcommand && opt.type === ApplicationCommandOptionType.Subcommand
      );
      if (sub?.options) {
        targetOptions = sub.options;
      }
    }

    // Now extract the actual option values
    targetOptions.forEach(opt => {
      // Map user option to userId for validation
      if (opt.name === 'user' && commandName === 'warn') {
        options['userId'] = opt.value;
      } else if (
        opt.name === 'user' &&
        (commandName === 'moderation' || commandName === 'blacklist')
      ) {
        options['userId'] = opt.value;
      } else {
        options[opt.name] = opt.value;
      }
    });

    // Validate
    Validator.validate(schema as Parameters<typeof Validator.validate>[0], options);

    // Additional security checks
    performSecurityChecks(options);

    return { passed: true };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        passed: false,
        error: error.message,
        code: 'VALIDATION',
      };
    }
    throw error;
  }
}

/**
 * Perform additional security checks on input
 */
function performSecurityChecks(options: Record<string, unknown>): void {
  for (const value of Object.values(options)) {
    if (typeof value === 'string') {
      // Check for mass mentions
      if (Sanitizer.hasMassMentions(value)) {
        throw new ValidationError('Mass mentions are not allowed');
      }

      // Check for spam patterns
      if (value.length > 100 && Sanitizer.isSpam(value)) {
        throw new ValidationError('Message appears to be spam');
      }

      // Check URLs if present
      const urlMatch = value.match(/https?:\/\/[^\s]+/gi);
      if (urlMatch) {
        for (const url of urlMatch) {
          if (!Validator.isUrlSafe(url)) {
            throw new ValidationError('Unsafe URL detected');
          }
        }
      }
    }
  }
}

/**
 * Handle rate limit response
 */
async function handleRateLimit(
  interaction: ChatInputCommandInteraction,
  result: RateLimitResult
): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('Rate Limit')
    .setDescription(t('security.rateLimit.description'))
    .addFields(
      {
        name: 'Time Remaining',
        value: `${Math.ceil(result.msBeforeNext / 1000)} seconds`,
        inline: true,
      },
      {
        name: 'Status',
        value: result.isBlocked ? 'Temporarily Blocked' : 'Rate Limited',
        inline: true,
      }
    )
    .setFooter({ text: 'Please slow down and try again later' })
    .setTimestamp();

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ embeds: [embed], ephemeral: true });
  } else {
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

/**
 * Handle permission denied response
 */
async function handlePermissionDenied(
  interaction: ChatInputCommandInteraction,
  check: PermissionCheck
): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('Permission Denied')
    .setDescription(check.reason || t('security.permission.denied'))
    .setTimestamp();

  if (check.missingPermissions && check.missingPermissions.length > 0) {
    embed.addFields({
      name: 'Missing Permissions',
      value: check.missingPermissions.join(', '),
      inline: false,
    });
  }

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ embeds: [embed], ephemeral: true });
  } else {
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

/**
 * Handle validation error response
 */
async function handleValidationError(
  interaction: ChatInputCommandInteraction,
  error: string
): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('Invalid Input')
    .setDescription(error)
    .setFooter({ text: 'Please check your input and try again' })
    .setTimestamp();

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ embeds: [embed], ephemeral: true });
  } else {
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

/**
 * Sanitize options for logging
 */
function sanitizeOptions(options: unknown[]): unknown[] {
  return options.map(opt => {
    if (typeof opt === 'object' && opt !== null && 'name' in opt && 'type' in opt) {
      const option = opt as { name: unknown; type: unknown; value?: unknown; options?: unknown[] };
      return {
        name: option.name,
        type: option.type,
        value:
          typeof option.value === 'string' ? Sanitizer.removeSensitive(option.value) : option.value,
        options: option.options ? sanitizeOptions(option.options) : undefined,
      };
    }
    return opt;
  });
}

/**
 * Message security middleware
 */
export async function messageSecurityMiddleware(message: Message): Promise<SecurityCheckResult> {
  // Skip bot messages
  if (message.author.bot) {
    return { passed: true };
  }

  // Skip DMs for now
  if (!message.guild) {
    return { passed: true };
  }

  const content = message.content;

  // Check for spam
  if (Sanitizer.isSpam(content)) {
    await message.delete().catch(() => {});
    return {
      passed: false,
      error: 'Message detected as spam',
      code: 'VALIDATION',
    };
  }

  // Check for mass mentions
  if (Sanitizer.hasMassMentions(content)) {
    await message.delete().catch(() => {});
    await message.member?.timeout(300000, 'Mass mention spam').catch(() => {});
    return {
      passed: false,
      error: 'Mass mentions detected',
      code: 'VALIDATION',
    };
  }

  return { passed: true };
}

/**
 * Create security report embed
 */
export function createSecurityReport(
  title: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: string,
  actions?: string[]
): EmbedBuilder {
  const colors = {
    low: 0x00ff00,
    medium: 0xffff00,
    high: 0xffa500,
    critical: 0xff0000,
  };

  const embed = new EmbedBuilder()
    .setColor(colors[severity])
    .setTitle(`Security Alert: ${title}`)
    .setDescription(details)
    .addFields({
      name: 'Severity',
      value: severity.toUpperCase(),
      inline: true,
    })
    .setTimestamp();

  if (actions && actions.length > 0) {
    embed.addFields({
      name: 'Recommended Actions',
      value: actions.map((a, i) => `${i + 1}. ${a}`).join('\n'),
      inline: false,
    });
  }

  return embed;
}
