import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t } from '../../i18n';
import { wordFilterService } from '../../services/wordFilterService';
import type { WordFilterRule, WordFilterSeverity, WordFilterMatchType } from '../../types';
import { logger } from '../../utils/logger';

const SEVERITY_CHOICES: Array<{ name: string; value: WordFilterSeverity; name_localizations?: Record<string, string> }> = [
  { name: 'Low', value: 'low', name_localizations: { es: 'Bajo', fr: 'Faible', de: 'Niedrig' } },
  { name: 'Medium', value: 'medium', name_localizations: { es: 'Medio', fr: 'Moyen', de: 'Mittel' } },
  { name: 'High', value: 'high', name_localizations: { es: 'Alto', fr: 'Élevé', de: 'Hoch' } },
  { name: 'Critical', value: 'critical', name_localizations: { es: 'Crítico', fr: 'Critique', de: 'Kritisch' } },
];

const MATCH_TYPE_CHOICES: Array<{ name: string; value: WordFilterMatchType; name_localizations?: Record<string, string> }> = [
  { name: 'Literal', value: 'literal', name_localizations: { es: 'Literal', fr: 'Littéral', de: 'Literal' } },
  { name: 'Regex', value: 'regex', name_localizations: { es: 'Regex', fr: 'Regex', de: 'Regex' } },
];

export const data = new SlashCommandBuilder()
  .setName('filter')
  .setDescription(t('commands.filter.description'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription(t('commands.filter.add.description'))
      .addStringOption(option =>
        option
          .setName('pattern')
          .setDescription(t('commands.filter.add.options.pattern'))
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('match_type')
          .setDescription(t('commands.filter.add.options.matchType'))
          .addChoices(...MATCH_TYPE_CHOICES)
      )
      .addBooleanOption(option =>
        option
          .setName('case_sensitive')
          .setDescription(t('commands.filter.add.options.caseSensitive'))
      )
      .addBooleanOption(option =>
        option.setName('whole_word').setDescription(t('commands.filter.add.options.wholeWord'))
      )
      .addStringOption(option =>
        option
          .setName('severity')
          .setDescription(t('commands.filter.add.options.severity'))
          .addChoices(...SEVERITY_CHOICES)
      )
      .addBooleanOption(option =>
        option.setName('auto_delete').setDescription(t('commands.filter.add.options.autoDelete'))
      )
      .addChannelOption(option =>
        option
          .setName('notify_channel')
          .setDescription(t('commands.filter.add.options.notifyChannel'))
          .addChannelTypes(
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement,
            ChannelType.GuildVoice,
            ChannelType.GuildStageVoice,
            ChannelType.PublicThread,
            ChannelType.PrivateThread,
            ChannelType.GuildForum
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription(t('commands.filter.remove.description'))
      .addIntegerOption(option =>
        option
          .setName('rule_id')
          .setDescription(t('commands.filter.remove.options.ruleId'))
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('list').setDescription(t('commands.filter.list.description'))
  );

export const category = CommandCategory.Moderation;
export const cooldown = 3;
export const permissions = [PermissionFlagsBits.ManageMessages];

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: t('common.guildOnly'),
      ephemeral: true,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'add':
        await handleAddRule(interaction);
        break;
      case 'remove':
        await handleRemoveRule(interaction);
        break;
      case 'list':
        await handleListRules(interaction);
        break;
      default:
        await interaction.reply({
          content: t('common.error'),
          ephemeral: true,
        });
        break;
    }
  } catch (error) {
    logger.error('Failed to execute filter command:', error);

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        content: t('common.error'),
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: t('common.error'),
        ephemeral: true,
      });
    }
  }
}

async function handleAddRule(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const pattern = interaction.options.getString('pattern', true);
  const matchType =
    (interaction.options.getString('match_type') as WordFilterMatchType | null) ?? 'literal';
  const caseSensitive = interaction.options.getBoolean('case_sensitive') ?? false;
  const wholeWord = interaction.options.getBoolean('whole_word') ?? true;
  const severity =
    (interaction.options.getString('severity') as WordFilterSeverity | null) ?? 'medium';
  const autoDelete = interaction.options.getBoolean('auto_delete') ?? true;
  const notifyChannel = interaction.options.getChannel('notify_channel');

  const rule = await wordFilterService.createRule({
    guildId: interaction.guildId!,
    pattern,
    matchType,
    caseSensitive,
    wholeWord,
    severity,
    autoDelete,
    notifyChannelId: notifyChannel?.id,
    createdBy: interaction.user.id,
  });

  const embed = buildRuleEmbed(rule)
    .setColor(0x57f287)
    .setTitle(t('commands.filter.add.successTitle'));

  await interaction.editReply({
    content: t('commands.filter.add.successMessage'),
    embeds: [embed],
  });
}

async function handleRemoveRule(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const ruleId = interaction.options.getInteger('rule_id', true);
  const removed = await wordFilterService.deleteRule(interaction.guildId!, ruleId);

  if (!removed) {
    await interaction.editReply({
      content: t('commands.filter.remove.notFound'),
    });
    return;
  }

  await interaction.editReply({
    content: t('commands.filter.remove.success', { id: ruleId }),
  });
}

async function handleListRules(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const rules = await wordFilterService.listRules(interaction.guildId!);

  if (rules.length === 0) {
    await interaction.editReply({
      content: t('commands.filter.list.empty'),
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(t('commands.filter.list.title', { count: rules.length }))
    .setDescription(t('commands.filter.list.description'))
    .setTimestamp();

  for (const rule of rules.slice(0, 10)) {
    embed.addFields({
      name: `#${rule.id} • ${rule.pattern}`,
      value: t('commands.filter.list.entry', {
        severity: t(`modLogs.filter.severity.${rule.severity}`),
        matchType: t(`modLogs.filter.matchType.${rule.matchType}`),
        caseSensitive: rule.caseSensitive ? t('common.yes') : t('common.no'),
        wholeWord: rule.wholeWord ? t('common.yes') : t('common.no'),
        autoDelete: rule.autoDelete ? t('common.yes') : t('common.no'),
        channel: rule.notifyChannelId ? `<#${rule.notifyChannelId}>` : t('common.none'),
      }),
      inline: false,
    });
  }

  if (rules.length > 10) {
    embed.setFooter({
      text: t('commands.filter.list.more', { remaining: rules.length - 10 }),
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

function buildRuleEmbed(rule: WordFilterRule): EmbedBuilder {
  return new EmbedBuilder()
    .addFields(
      {
        name: t('commands.filter.fields.pattern'),
        value: `\`${rule.pattern}\``,
        inline: false,
      },
      {
        name: t('commands.filter.fields.matchType'),
        value: t(`modLogs.filter.matchType.${rule.matchType}`),
        inline: true,
      },
      {
        name: t('commands.filter.fields.severity'),
        value: t(`modLogs.filter.severity.${rule.severity}`),
        inline: true,
      },
      {
        name: t('commands.filter.fields.caseSensitive'),
        value: rule.caseSensitive ? t('common.yes') : t('common.no'),
        inline: true,
      },
      {
        name: t('commands.filter.fields.wholeWord'),
        value: rule.wholeWord ? t('common.yes') : t('common.no'),
        inline: true,
      },
      {
        name: t('commands.filter.fields.autoDelete'),
        value: rule.autoDelete ? t('common.yes') : t('common.no'),
        inline: true,
      },
      {
        name: t('commands.filter.fields.notifyChannel'),
        value: rule.notifyChannelId ? `<#${rule.notifyChannelId}>` : t('common.none'),
        inline: true,
      }
    )
    .setFooter({
      text: t('commands.filter.fields.ruleId', { id: rule.id }),
    });
}
