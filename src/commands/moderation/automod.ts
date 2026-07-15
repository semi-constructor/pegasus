import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t } from '../../i18n';
import { autoModRepository } from '../../repositories/autoModRepository';
import { autoModService } from '../../services/autoModService';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('automod')
  .setDescription('Manage AutoMod V2 rules and Quarantine Vault')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('add_rule')
      .setDescription('Add a new AutoMod V2 rule')
      .addStringOption(option =>
        option.setName('name').setDescription('Rule name').setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('trigger_type')
          .setDescription('Type of trigger')
          .setRequired(true)
          .addChoices(
            { name: 'Keyword Match', value: 'KEYWORD' },
            { name: 'Regex Match', value: 'REGEX' },
            { name: 'Mention Spam', value: 'MENTION_SPAM' },
            { name: 'Attachment Spam', value: 'ATTACHMENT_SPAM' }
          )
      )
      .addStringOption(option =>
        option
          .setName('action_type')
          .setDescription('Action to take')
          .setRequired(true)
          .addChoices(
            { name: 'Delete Message', value: 'DELETE_MESSAGE' },
            { name: 'Warn User', value: 'WARN_USER' },
            { name: 'Timeout User', value: 'TIMEOUT_USER' },
            { name: 'Add Infraction Points', value: 'ADD_INFRACTION' }
          )
      )
      .addStringOption(option =>
        option.setName('keywords').setDescription('Comma-separated keywords (for KEYWORD trigger)')
      )
      .addStringOption(option =>
        option.setName('regex_pattern').setDescription('Regex pattern (for REGEX trigger)')
      )
      .addIntegerOption(option =>
        option
          .setName('limit')
          .setDescription('Limit threshold (for MENTION_SPAM or ATTACHMENT_SPAM)')
      )
      .addIntegerOption(option =>
        option.setName('points').setDescription('Infraction points to add (for ADD_INFRACTION)')
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('list_rules').setDescription('List all AutoMod V2 rules')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove_rule')
      .setDescription('Remove an AutoMod V2 rule')
      .addStringOption(option =>
        option.setName('rule_id').setDescription('UUID of the rule to remove').setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('quarantine_list')
      .setDescription('List users currently in the Quarantine Vault')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('quarantine_release')
      .setDescription('Release a user from the Quarantine Vault')
      .addUserOption(option =>
        option.setName('user').setDescription('User to release').setRequired(true)
      )
  );

export const category = CommandCategory.Moderation;
export const cooldown = 3;
export const permissions = [PermissionFlagsBits.ManageGuild];

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: t('common.guildOnly'), ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'add_rule':
        await handleAddRule(interaction);
        break;
      case 'list_rules':
        await handleListRules(interaction);
        break;
      case 'remove_rule':
        await handleRemoveRule(interaction);
        break;
      case 'quarantine_list':
        await handleQuarantineList(interaction);
        break;
      case 'quarantine_release':
        await handleQuarantineRelease(interaction);
        break;
    }
  } catch (error: any) {
    logger.error('Failed to execute automod command:', error);
    const content = `${t('common.error')  }: ${  error.message}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, ephemeral: true });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  }
}

async function handleAddRule(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId!;
  const name = interaction.options.getString('name', true);
  const triggerType = interaction.options.getString('trigger_type', true) as any;
  const actionType = interaction.options.getString('action_type', true) as any;
  const keywords =
    interaction.options
      .getString('keywords')
      ?.split(',')
      .map(k => k.trim()) || [];
  const regexPattern = interaction.options.getString('regex_pattern');
  const limit = interaction.options.getInteger('limit') || 5;
  const points = interaction.options.getInteger('points') || 1;

  const triggerMetadata: any = {};
  if (keywords.length > 0) triggerMetadata.keywords = keywords;
  if (regexPattern) triggerMetadata.regexPatterns = [regexPattern];
  if (triggerType === 'MENTION_SPAM') triggerMetadata.mentionTotalLimit = limit;
  if (triggerType === 'ATTACHMENT_SPAM') triggerMetadata.attachmentLimit = limit;

  const actionMetadata: any = {};
  if (actionType === 'ADD_INFRACTION') actionMetadata.points = points;
  if (actionType === 'TIMEOUT_USER') actionMetadata.durationSeconds = 300;

  const rule = await autoModRepository.createRule({
    guildId,
    name,
    description: `AutoMod rule for ${triggerType}`,
    eventType: 'messageCreate',
    triggerType,
    triggerMetadata,
    actions: [{ type: actionType, metadata: actionMetadata }],
    enabled: true,
  });

  await interaction.editReply({
    content: `✅ AutoMod V2 rule **${rule.name}** created successfully! (ID: \`${rule.id}\`)`,
  });
}

async function handleListRules(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const rules = await autoModRepository.listRules(interaction.guildId!);

  if (rules.length === 0) {
    await interaction.editReply({ content: 'No AutoMod V2 rules found for this server.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`AutoMod V2 Rules (${rules.length})`)
    .setDescription(
      rules
        .map(
          r =>
            `• **${r.name}** (\`${r.id}\`)\n  Trigger: ${r.triggerType} | Action: ${r.actions.map(a => a.type).join(', ')}`
        )
        .join('\n\n')
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleRemoveRule(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const ruleId = interaction.options.getString('rule_id', true);
  const removed = await autoModRepository.deleteRule(interaction.guildId!, ruleId);

  if (!removed) {
    await interaction.editReply({ content: 'Rule not found.' });
    return;
  }

  await interaction.editReply({ content: `✅ Rule \`${ruleId}\` removed successfully.` });
}

async function handleQuarantineList(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const list = await autoModRepository.listQuarantinedUsers(interaction.guildId!);

  if (list.length === 0) {
    await interaction.editReply({ content: 'No users currently in the Quarantine Vault.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(`Quarantine Vault (${list.length})`)
    .setDescription(
      list
        .map(
          (q: any) =>
            `• <@${q.userId}> (\`${q.userId}\`)\n  Reason: ${q.reason}\n  Quarantined At: ${q.quarantinedAt}`
        )
        .join('\n\n')
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleQuarantineRelease(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const user = interaction.options.getUser('user', true);
  const member = await interaction.guild!.members.fetch(user.id).catch(() => null);

  const released = await autoModService.releaseQuarantine(
    interaction.guildId!,
    user.id,
    member,
    interaction.user.id
  );

  if (!released) {
    await interaction.editReply({ content: `User <@${user.id}> is not in the Quarantine Vault.` });
    return;
  }

  await interaction.editReply({
    content: `✅ User <@${user.id}> has been released from the Quarantine Vault and original roles have been restored.`,
  });
}
