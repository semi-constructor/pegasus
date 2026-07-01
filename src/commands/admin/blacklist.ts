import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t, getGuildLocale } from '../../i18n';
import { getDatabase } from '../../database/connection';
import { blacklist } from '../../database/schema/security';
import { eq, and, desc } from 'drizzle-orm';
import { isDeveloper } from '../../config/env';
import { createLocalizationMap, commandDescriptions } from '../../utils/localization';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('blacklist')
  .setDescription(t('commands.blacklist.description', { defaultValue: 'Manage bot blacklist' }))
  .setDescriptionLocalizations(createLocalizationMap(commandDescriptions.blacklist))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('user')
      .setDescription(t('commands.blacklist.subcommands.user.description'))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.blacklist.subcommands.user.options.user'))
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription(t('commands.blacklist.subcommands.user.options.reason'))
          .setRequired(false)
          .setMaxLength(500)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription(t('commands.blacklist.subcommands.view.description'))
      .addIntegerOption(option =>
        option
          .setName('page')
          .setDescription(t('commands.blacklist.subcommands.view.options.page'))
          .setRequired(false)
          .setMinValue(1)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription(t('commands.blacklist.subcommands.remove.description'))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.blacklist.subcommands.remove.options.user'))
          .setRequired(true)
      )
  );

export const category = CommandCategory.Admin;
export const cooldown = 5;
export const permissions = [PermissionFlagsBits.Administrator];

export async function execute(interaction: ChatInputCommandInteraction) {
  const locale = interaction.guildId ? getGuildLocale(interaction.guildId) : 'en';

  // Check if user is a developer
  if (!isDeveloper(interaction.user.id)) {
    return interaction.reply({
      content: t('common.devOnly', { lng: locale }),
      ephemeral: true,
    });
  }

  if (!interaction.guild) {
    return interaction.reply({
      content: t('common.guildOnly', { lng: locale }),
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'user':
      return handleBlacklistUser(interaction, locale);
    case 'view':
      return handleBlacklistView(interaction, locale);
    case 'remove':
      return handleBlacklistRemove(interaction, locale);
    default:
      return interaction.reply({
        content: t('common.invalidSubcommand', { lng: locale }),
        ephemeral: true,
      });
  }
}

async function handleBlacklistUser(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const reason =
    interaction.options.getString('reason') || t('common.noReasonProvided', { lng: locale });

  // Check if user is already blacklisted
  const db = getDatabase();
  const guildId = interaction.guild?.id;
  if (!guildId) {
    await interaction.editReply({
      content: t('common.guildOnly', { lng: locale }),
    });
    return;
  }

  const [existing] = await db
    .select()
    .from(blacklist)
    .where(and(eq(blacklist.entityId, user.id), eq(blacklist.entityType, 'user')))
    .limit(1);

  if (existing) {
    await interaction.editReply({
      content: t('commands.blacklist.subcommands.user.alreadyBlacklisted', { lng: locale }),
    });
    return;
  }

  // Check if user is trying to blacklist themselves
  if (user.id === interaction.user.id) {
    await interaction.editReply({
      content: t('commands.blacklist.subcommands.user.cannotBlacklistSelf', { lng: locale }),
    });
    return;
  }

  // Check if user is trying to blacklist the bot
  if (user.id === interaction.client.user!.id) {
    await interaction.editReply({
      content: t('commands.blacklist.subcommands.user.cannotBlacklistBot', { lng: locale }),
    });
    return;
  }

  try {
    // Add to blacklist
    await db.insert(blacklist).values({
      entityType: 'user',
      entityId: user.id,
      reason,
      addedBy: interaction.user.id,
    });

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(t('commands.blacklist.subcommands.user.success.title', { lng: locale }))
      .setDescription(
        t('commands.blacklist.subcommands.user.success.description', {
          user: user.tag,
          lng: locale,
        })
      )
      .addFields(
        {
          name: t('commands.blacklist.subcommands.user.success.reason', { lng: locale }),
          value: reason,
          inline: false,
        },
        {
          name: t('commands.blacklist.subcommands.user.success.blacklistedBy', { lng: locale }),
          value: interaction.user.tag,
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error blacklisting user:', error);
    await interaction.editReply({
      content: t('commands.blacklist.error', { lng: locale }),
    });
  }
  return;
}

async function handleBlacklistView(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  await interaction.deferReply();

  const page = interaction.options.getInteger('page') || 1;
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  // Get blacklisted users
  const db = getDatabase();
  const blacklistedUsers = await db
    .select()
    .from(blacklist)
    .where(eq(blacklist.entityType, 'user'))
    .orderBy(desc(blacklist.createdAt))
    .limit(pageSize)
    .offset(offset);

  if (blacklistedUsers.length === 0) {
    await interaction.editReply({
      content: t('commands.blacklist.subcommands.view.noBlacklisted', { lng: locale }),
    });
    return;
  }

  // Get total count
  const [{ count }] = await db
    .select({ count: blacklist.entityId })
    .from(blacklist)
    .where(eq(blacklist.entityType, 'user'));

  const totalPages = Math.ceil(Number(count) / pageSize);

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(t('commands.blacklist.subcommands.view.title', { lng: locale }))
    .setDescription(
      t('commands.blacklist.subcommands.view.description', {
        page,
        totalPages,
        lng: locale,
      })
    )
    .setTimestamp();

  // Add blacklisted users
  for (const entry of blacklistedUsers) {
    const user = await interaction.client.users.fetch(entry.entityId).catch(() => null);
    const blacklistedBy = await interaction.client.users.fetch(entry.addedBy).catch(() => null);

    embed.addFields({
      name: user ? user.tag : entry.entityId,
      value: [
        `**${t('commands.blacklist.subcommands.view.reason', { lng: locale })}:** ${entry.reason}`,
        `**${t('commands.blacklist.subcommands.view.blacklistedBy', { lng: locale })}:** ${blacklistedBy ? blacklistedBy.tag : entry.addedBy}`,
        `**${t('commands.blacklist.subcommands.view.date', { lng: locale })}:** <t:${Math.floor(entry.createdAt.getTime() / 1000)}:F>`,
      ].join('\n'),
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
  return;
}

async function handleBlacklistRemove(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);

  try {
    // Remove from blacklist
    const db = getDatabase();
    const deleted = await db
      .delete(blacklist)
      .where(and(eq(blacklist.entityId, user.id), eq(blacklist.entityType, 'user')))
      .returning();

    if (deleted.length === 0) {
      await interaction.editReply({
        content: t('commands.blacklist.subcommands.remove.notBlacklisted', { lng: locale }),
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(t('commands.blacklist.subcommands.remove.success.title', { lng: locale }))
      .setDescription(
        t('commands.blacklist.subcommands.remove.success.description', {
          user: user.tag,
          lng: locale,
        })
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error removing user from blacklist:', error);
    await interaction.editReply({
      content: t('commands.blacklist.error', { lng: locale }),
    });
  }
  return;
}
