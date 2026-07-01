import {
  ButtonInteraction,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  StringSelectMenuInteraction,
  ChannelSelectMenuInteraction,
} from 'discord.js';
import { configurationService } from '../../services/configurationService';
import { modLogService } from '../../services/modLogService';
import { t } from '../../i18n';
import { logger } from '../../utils/logger';
import { buildModLogsConfigResponse } from '../../commands/configuration/config';
import type { ModLogCategory } from '../../types';

const MOD_LOG_CATEGORY_NAME_KEYS: Record<ModLogCategory, string> = {
  message: 'config.modlogs.categories.message.name',
  member: 'config.modlogs.categories.member.name',
  moderation: 'config.modlogs.categories.moderation.name',
  wordFilter: 'config.modlogs.categories.wordFilter.name',
};

export async function handleConfigButton(interaction: ButtonInteraction) {
  const parts = interaction.customId.split('_');
  const prefix = parts.shift();
  const category = parts.shift();
  const action = parts.join('_');

  if (prefix !== 'config' || !category || !action) return;

  // Check permissions
  if (!interaction.memberPermissions?.has('ManageGuild')) {
    return interaction.reply({
      content: t('common.noPermission'),
      ephemeral: true,
    });
  }

  switch (category) {
    case 'xp':
      return handleXPConfigButton(interaction, action);
    case 'eco':
      return handleEcoConfigButton(interaction, action);
    case 'welcome':
      return handleWelcomeConfigButton(interaction, action);
    case 'autorole':
      return handleAutoroleConfigButton(interaction, action);
    case 'goodbye':
      return handleGoodbyeConfigButton(interaction, action);
    case 'modlogs':
      return handleModLogButton(interaction, action);
  }
}

async function handleXPConfigButton(interaction: ButtonInteraction, action: string) {
  switch (action) {
    case 'toggle': {
      await interaction.deferUpdate();
      const config = await configurationService.getXPConfig(interaction.guildId!);
      await configurationService.updateXPConfig(interaction.guildId!, { enabled: !config.enabled });

      // Refresh the XP config embed
      await refreshXPConfigEmbed(interaction);
      break;
    }

    case 'rates': {
      const modal = new ModalBuilder()
        .setCustomId('config_xp_rates_modal')
        .setTitle(t('config.xp.modal.rates.title'));

      const config = await configurationService.getXPConfig(interaction.guildId!);

      const perMessageInput = new TextInputBuilder()
        .setCustomId('perMessage')
        .setLabel(t('config.xp.modal.rates.perMessage'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.perMessage.toString())
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(4);

      const perVoiceMinuteInput = new TextInputBuilder()
        .setCustomId('perVoiceMinute')
        .setLabel(t('config.xp.modal.rates.perVoiceMinute'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.perVoiceMinute.toString())
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(4);

      const cooldownInput = new TextInputBuilder()
        .setCustomId('cooldown')
        .setLabel(t('config.xp.modal.rates.cooldown'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.cooldown.toString())
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(4);

      const boosterMultiplierInput = new TextInputBuilder()
        .setCustomId('boosterMultiplier')
        .setLabel(t('config.xp.modal.rates.boosterMultiplier'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.boosterMultiplier.toString())
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(4)
        .setPlaceholder('200');

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(perMessageInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(perVoiceMinuteInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(cooldownInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(boosterMultiplierInput)
      );

      await interaction.showModal(modal);
      break;
    }

    case 'channels': {
      await interaction.deferReply({ ephemeral: true });

      const config = await configurationService.getXPConfig(interaction.guildId!);

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(t('config.xp.channels.title'))
        .setDescription(t('config.xp.channels.description'))
        .addFields(
          {
            name: t('config.xp.channels.ignored'),
            value:
              config.ignoredChannels.length > 0
                ? config.ignoredChannels.map(id => `<#${id}>`).join(', ')
                : t('common.none'),
            inline: false,
          },
          {
            name: t('config.xp.channels.noXp'),
            value:
              config.noXpChannels.length > 0
                ? config.noXpChannels.map(id => `<#${id}>`).join(', ')
                : t('common.none'),
            inline: false,
          },
          {
            name: t('config.xp.channels.doubleXp'),
            value:
              config.doubleXpChannels.length > 0
                ? config.doubleXpChannels.map(id => `<#${id}>`).join(', ')
                : t('common.none'),
            inline: false,
          }
        );

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('config_xp_channel_type')
        .setPlaceholder(t('config.xp.channels.selectType'))
        .addOptions([
          {
            label: t('config.xp.channels.types.ignored'),
            value: 'ignored',
            description: t('config.xp.channels.types.ignoredDesc'),
          },
          {
            label: t('config.xp.channels.types.noXp'),
            value: 'no_xp',
            description: t('config.xp.channels.types.noXpDesc'),
          },
          {
            label: t('config.xp.channels.types.doubleXp'),
            value: 'double_xp',
            description: t('config.xp.channels.types.doubleXpDesc'),
          },
        ]);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.editReply({
        embeds: [embed],
        components: [row],
      });
      break;
    }

    case 'roles': {
      const modal = new ModalBuilder()
        .setCustomId('config_xp_roles_modal')
        .setTitle(t('config.xp.modal.roles.title'));

      const config = await configurationService.getXPConfig(interaction.guildId!);

      const boosterRoleInput = new TextInputBuilder()
        .setCustomId('boosterRole')
        .setLabel(t('config.xp.modal.roles.boosterRole'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.boosterRole || '')
        .setRequired(false)
        .setPlaceholder('Role ID');

      const ignoredRolesInput = new TextInputBuilder()
        .setCustomId('ignoredRoles')
        .setLabel(t('config.xp.modal.roles.ignoredRoles'))
        .setStyle(TextInputStyle.Paragraph)
        .setValue(config.ignoredRoles.join('\n'))
        .setRequired(false)
        .setPlaceholder('Role ID per line');

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(boosterRoleInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(ignoredRolesInput)
      );

      await interaction.showModal(modal);
      break;
    }

    case 'rewards': {
      await interaction.deferReply({ ephemeral: true });

      const rewards = await configurationService.getXPRoleRewards(interaction.guildId!);

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(t('config.xp.rewards.title'))
        .setDescription(t('config.xp.rewards.description'));

      if (rewards.length > 0) {
        const rewardList = rewards
          .sort((a, b) => a.level - b.level)
          .map(r => `**Level ${r.level}:** <@&${r.roleId}>`)
          .join('\n');

        embed.addFields({
          name: t('config.xp.rewards.current'),
          value: rewardList,
          inline: false,
        });
      } else {
        embed.addFields({
          name: t('config.xp.rewards.current'),
          value: t('common.none'),
          inline: false,
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('config_xp_reward_action')
        .setPlaceholder(t('config.xp.rewards.selectAction'))
        .addOptions([
          {
            label: t('config.xp.rewards.actions.add'),
            value: 'add',
            description: t('config.xp.rewards.actions.addDesc'),
          },
          {
            label: t('config.xp.rewards.actions.remove'),
            value: 'remove',
            description: t('config.xp.rewards.actions.removeDesc'),
          },
          {
            label: t('config.xp.rewards.actions.clear'),
            value: 'clear',
            description: t('config.xp.rewards.actions.clearDesc'),
          },
        ]);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.editReply({
        embeds: [embed],
        components: [row],
      });
      break;
    }

    case 'announce_toggle': {
      await interaction.deferUpdate();
      const config = await configurationService.getXPConfig(interaction.guildId!);
      const newStatus = !config.announceLevelUp;
      await configurationService.updateXPConfig(interaction.guildId!, {
        announceLevelUp: newStatus,
      });

      await refreshXPConfigEmbed(interaction);
      await interaction.followUp({
        content: newStatus
          ? t('config.xp.announcements.enabled')
          : t('config.xp.announcements.disabled'),
        ephemeral: true,
      });
      break;
    }

    case 'announce_clear': {
      await interaction.deferUpdate();
      await configurationService.updateXPConfig(interaction.guildId!, { levelUpChannel: null });

      await refreshXPConfigEmbed(interaction);
      await interaction.followUp({
        content: t('config.xp.announcements.channelCleared'),
        ephemeral: true,
      });
      break;
    }
  }
}

async function handleEcoConfigButton(interaction: ButtonInteraction, action: string) {
  switch (action) {
    case 'currency': {
      const modal = new ModalBuilder()
        .setCustomId('config_eco_currency_modal')
        .setTitle(t('config.eco.modal.currency.title'));

      const config = await configurationService.getEconomyConfig(interaction.guildId!);

      const symbolInput = new TextInputBuilder()
        .setCustomId('symbol')
        .setLabel(t('config.eco.modal.currency.symbol'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.currencySymbol)
        .setRequired(true)
        .setMaxLength(10);

      const nameInput = new TextInputBuilder()
        .setCustomId('name')
        .setLabel(t('config.eco.modal.currency.name'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.currencyName)
        .setRequired(true)
        .setMaxLength(50);

      const startingBalanceInput = new TextInputBuilder()
        .setCustomId('startingBalance')
        .setLabel(t('config.eco.modal.currency.startingBalance'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.startingBalance.toString())
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(symbolInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(nameInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(startingBalanceInput)
      );

      await interaction.showModal(modal);
      break;
    }

    case 'rewards': {
      const modal = new ModalBuilder()
        .setCustomId('config_eco_rewards_modal')
        .setTitle(t('config.eco.modal.rewards.title'));

      const config = await configurationService.getEconomyConfig(interaction.guildId!);

      const dailyAmountInput = new TextInputBuilder()
        .setCustomId('dailyAmount')
        .setLabel(t('config.eco.modal.rewards.dailyAmount'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.dailyAmount.toString())
        .setRequired(true);

      const dailyStreakBonusInput = new TextInputBuilder()
        .setCustomId('dailyStreakBonus')
        .setLabel(t('config.eco.modal.rewards.dailyStreakBonus'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.dailyStreakBonus.toString())
        .setRequired(true);

      const workMinInput = new TextInputBuilder()
        .setCustomId('workMin')
        .setLabel(t('config.eco.modal.rewards.workMin'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.workMinAmount.toString())
        .setRequired(true);

      const workMaxInput = new TextInputBuilder()
        .setCustomId('workMax')
        .setLabel(t('config.eco.modal.rewards.workMax'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.workMaxAmount.toString())
        .setRequired(true);

      const workCooldownInput = new TextInputBuilder()
        .setCustomId('workCooldown')
        .setLabel(t('config.eco.modal.rewards.workCooldown'))
        .setStyle(TextInputStyle.Short)
        .setValue((config.workCooldown / 3600).toString())
        .setRequired(true)
        .setPlaceholder('Hours');

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(dailyAmountInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(dailyStreakBonusInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(workMinInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(workMaxInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(workCooldownInput)
      );

      await interaction.showModal(modal);
      break;
    }

    case 'rob': {
      const modal = new ModalBuilder()
        .setCustomId('config_eco_rob_modal')
        .setTitle(t('config.eco.modal.rob.title'));

      const config = await configurationService.getEconomyConfig(interaction.guildId!);

      const enabledInput = new TextInputBuilder()
        .setCustomId('enabled')
        .setLabel(t('config.eco.modal.rob.enabled'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.robEnabled ? 'true' : 'false')
        .setRequired(true)
        .setPlaceholder('true or false');

      const minAmountInput = new TextInputBuilder()
        .setCustomId('minAmount')
        .setLabel(t('config.eco.modal.rob.minAmount'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.robMinAmount.toString())
        .setRequired(true);

      const successRateInput = new TextInputBuilder()
        .setCustomId('successRate')
        .setLabel(t('config.eco.modal.rob.successRate'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.robSuccessRate.toString())
        .setRequired(true)
        .setPlaceholder('0-100');

      const protectionCostInput = new TextInputBuilder()
        .setCustomId('protectionCost')
        .setLabel(t('config.eco.modal.rob.protectionCost'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.robProtectionCost.toString())
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(enabledInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(minAmountInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(successRateInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(protectionCostInput)
      );

      await interaction.showModal(modal);
      break;
    }

    case 'shop': {
      await interaction.deferReply({ ephemeral: true });

      const items = await configurationService.getShopItems(interaction.guildId!);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(t('config.eco.shop.title'))
        .setDescription(t('config.eco.shop.description'));

      if (items.length > 0) {
        for (const item of items.slice(0, 10)) {
          embed.addFields({
            name: `${item.name} - $${item.price}`,
            value: `${item.description}\n${t('config.xp.channels.selectType')}: ${item.type} | ${t('commands.economy.shop.view.stock')}: ${item.stock === -1 ? '∞' : item.stock}`,
            inline: false,
          });
        }

        if (items.length > 10) {
          embed.setFooter({
            text: t('config.eco.shop.showing', { shown: 10, total: items.length }),
          });
        }
      } else {
        embed.addFields({
          name: t('config.eco.shop.noItems'),
          value: t('config.eco.shop.noItemsDesc'),
          inline: false,
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('config_eco_shop_action')
        .setPlaceholder(t('config.eco.shop.selectAction'))
        .addOptions([
          {
            label: t('config.eco.shop.actions.add'),
            value: 'add',
            description: t('config.eco.shop.actions.addDesc'),
          },
          {
            label: t('config.eco.shop.actions.edit'),
            value: 'edit',
            description: t('config.eco.shop.actions.editDesc'),
          },
          {
            label: t('config.eco.shop.actions.remove'),
            value: 'remove',
            description: t('config.eco.shop.actions.removeDesc'),
          },
        ]);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.editReply({
        embeds: [embed],
        components: [row],
      });
      break;
    }
  }
}

async function handleWelcomeConfigButton(interaction: ButtonInteraction, action: string) {
  switch (action) {
    case 'toggle': {
      await interaction.deferUpdate();
      const config = await configurationService.getWelcomeConfig(interaction.guildId!);
      await configurationService.updateWelcomeConfig(interaction.guildId!, {
        enabled: !config.enabled,
      });

      // Refresh the welcome config embed
      await refreshWelcomeConfigEmbed(interaction);
      break;
    }

    case 'channel': {
      const selectMenu = new ChannelSelectMenuBuilder()
        .setCustomId('config_welcome_channel_select')
        .setPlaceholder(t('config.welcome.selectChannel'))
        .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement]);

      const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.reply({
        content: t('config.welcome.selectChannelPrompt'),
        components: [row],
        ephemeral: true,
      });
      break;
    }

    case 'message': {
      const modal = new ModalBuilder()
        .setCustomId('config_welcome_message_modal')
        .setTitle(t('config.welcome.modal.message.title'));

      const config = await configurationService.getWelcomeConfig(interaction.guildId!);

      const messageInput = new TextInputBuilder()
        .setCustomId('message')
        .setLabel(t('config.welcome.modal.message.content'))
        .setStyle(TextInputStyle.Paragraph)
        .setValue(config.message || '')
        .setRequired(true)
        .setMaxLength(2000)
        .setPlaceholder(t('config.welcome.modal.message.placeholder'));

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(messageInput)
      );

      await interaction.showModal(modal);
      break;
    }

    case 'embed': {
      const modal = new ModalBuilder()
        .setCustomId('config_welcome_embed_modal')
        .setTitle(t('config.welcome.modal.embed.title'));

      const config = await configurationService.getWelcomeConfig(interaction.guildId!);

      const enabledInput = new TextInputBuilder()
        .setCustomId('enabled')
        .setLabel(t('config.welcome.modal.embed.enabled'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.embedEnabled ? 'true' : 'false')
        .setRequired(true);

      const colorInput = new TextInputBuilder()
        .setCustomId('color')
        .setLabel(t('config.welcome.modal.embed.color'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.embedColor)
        .setRequired(true)
        .setPlaceholder('#0099FF');

      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel(t('config.welcome.modal.embed.title'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.embedTitle || '')
        .setRequired(false)
        .setMaxLength(255);

      const imageInput = new TextInputBuilder()
        .setCustomId('image')
        .setLabel(t('config.welcome.modal.embed.image'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.embedImage || '')
        .setRequired(false)
        .setPlaceholder('https://...');

      const thumbnailInput = new TextInputBuilder()
        .setCustomId('thumbnail')
        .setLabel(t('config.welcome.modal.embed.thumbnail'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.embedThumbnail || '')
        .setRequired(false)
        .setPlaceholder('https://...');

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(enabledInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(colorInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(titleInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(imageInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(thumbnailInput)
      );

      await interaction.showModal(modal);
      break;
    }

    case 'dm': {
      const modal = new ModalBuilder()
        .setCustomId('config_welcome_dm_modal')
        .setTitle(t('config.welcome.modal.dm.title'));

      const config = await configurationService.getWelcomeConfig(interaction.guildId!);

      const enabledInput = new TextInputBuilder()
        .setCustomId('enabled')
        .setLabel(t('config.welcome.modal.dm.enabled'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.dmEnabled ? 'true' : 'false')
        .setRequired(true);

      const messageInput = new TextInputBuilder()
        .setCustomId('message')
        .setLabel(t('config.welcome.modal.dm.message'))
        .setStyle(TextInputStyle.Paragraph)
        .setValue(config.dmMessage || '')
        .setRequired(false)
        .setMaxLength(2000)
        .setPlaceholder(t('config.welcome.modal.dm.placeholder'));

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(enabledInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(messageInput)
      );

      await interaction.showModal(modal);
      break;
    }
  }
}

async function handleAutoroleConfigButton(
  interaction: ButtonInteraction,
  action: string
): Promise<any> {
  switch (action) {
    case 'toggle': {
      await interaction.deferUpdate();
      const config = await configurationService.getAutoroleConfig(interaction.guildId!);
      await configurationService.updateAutoroleConfig(interaction.guildId!, {
        enabled: !config.enabled,
      });

      // Refresh the autorole config embed
      await refreshAutoroleConfigEmbed(interaction);
      break;
    }

    case 'add': {
      const selectMenu = new RoleSelectMenuBuilder()
        .setCustomId('config_autorole_add_select')
        .setPlaceholder(t('config.autorole.selectRole'))
        .setMaxValues(5);

      const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.reply({
        content: t('config.autorole.selectRolePrompt'),
        components: [row],
        ephemeral: true,
      });
      break;
    }

    case 'remove': {
      const config = await configurationService.getAutoroleConfig(interaction.guildId!);

      if (config.roles.length === 0) {
        return interaction.reply({
          content: t('config.autorole.noRoles'),
          ephemeral: true,
        });
      }

      const options = config.roles.map(roleId => ({
        label:
          interaction.guild!.roles.cache.get(roleId)?.name ||
          t('commands.config.subcommands.xp.buttons.roles'),
        value: roleId,
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('config_autorole_remove_select')
        .setPlaceholder(t('config.autorole.selectRoleToRemove'))
        .addOptions(options);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.reply({
        content: t('config.autorole.selectRoleToRemovePrompt'),
        components: [row],
        ephemeral: true,
      });
      break;
    }

    case 'clear': {
      await interaction.deferUpdate();
      await configurationService.updateAutoroleConfig(interaction.guildId!, { roles: [] });

      // Refresh the autorole config embed
      await refreshAutoroleConfigEmbed(interaction);
      break;
    }
  }
}

async function handleGoodbyeConfigButton(interaction: ButtonInteraction, action: string) {
  switch (action) {
    case 'toggle': {
      await interaction.deferUpdate();
      const config = await configurationService.getGoodbyeConfig(interaction.guildId!);
      await configurationService.updateGoodbyeConfig(interaction.guildId!, {
        enabled: !config.enabled,
      });

      // Refresh the goodbye config embed
      await refreshGoodbyeConfigEmbed(interaction);
      break;
    }

    case 'channel': {
      const selectMenu = new ChannelSelectMenuBuilder()
        .setCustomId('config_goodbye_channel_select')
        .setPlaceholder(t('config.goodbye.selectChannel'))
        .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement]);

      const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.reply({
        content: t('config.goodbye.selectChannelPrompt'),
        components: [row],
        ephemeral: true,
      });
      break;
    }

    case 'message': {
      const modal = new ModalBuilder()
        .setCustomId('config_goodbye_message_modal')
        .setTitle(t('config.goodbye.modal.message.title'));

      const config = await configurationService.getGoodbyeConfig(interaction.guildId!);

      const messageInput = new TextInputBuilder()
        .setCustomId('message')
        .setLabel(t('config.goodbye.modal.message.content'))
        .setStyle(TextInputStyle.Paragraph)
        .setValue(config.message || '')
        .setRequired(true)
        .setMaxLength(2000)
        .setPlaceholder(t('config.goodbye.modal.message.placeholder'));

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(messageInput)
      );

      await interaction.showModal(modal);
      break;
    }

    case 'embed': {
      const modal = new ModalBuilder()
        .setCustomId('config_goodbye_embed_modal')
        .setTitle(t('config.goodbye.modal.embed.title'));

      const config = await configurationService.getGoodbyeConfig(interaction.guildId!);

      const enabledInput = new TextInputBuilder()
        .setCustomId('enabled')
        .setLabel(t('config.goodbye.modal.embed.enabled'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.embedEnabled ? 'true' : 'false')
        .setRequired(true);

      const colorInput = new TextInputBuilder()
        .setCustomId('color')
        .setLabel(t('config.goodbye.modal.embed.color'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.embedColor)
        .setRequired(true)
        .setPlaceholder('#FF0000');

      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel(t('config.goodbye.modal.embed.title'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.embedTitle || '')
        .setRequired(false)
        .setMaxLength(255);

      const imageInput = new TextInputBuilder()
        .setCustomId('image')
        .setLabel(t('config.goodbye.modal.embed.image'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.embedImage || '')
        .setRequired(false)
        .setPlaceholder('https://...');

      const thumbnailInput = new TextInputBuilder()
        .setCustomId('thumbnail')
        .setLabel(t('config.goodbye.modal.embed.thumbnail'))
        .setStyle(TextInputStyle.Short)
        .setValue(config.embedThumbnail || '')
        .setRequired(false)
        .setPlaceholder('https://...');

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(enabledInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(colorInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(titleInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(imageInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(thumbnailInput)
      );

      await interaction.showModal(modal);
      break;
    }
  }
}

// Refresh functions for updating embeds after changes
export async function refreshXPConfigEmbed(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ChannelSelectMenuInteraction
) {
  try {
    const config = await configurationService.getXPConfig(interaction.guild!.id);
    const roleRewards = await configurationService.getXPRoleRewards(interaction.guild!.id);

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(t('commands.config.subcommands.xp.embed.title'))
      .setDescription(t('commands.config.subcommands.xp.embed.description'))
      .addFields(
        {
          name: t('commands.config.subcommands.xp.embed.fields.status'),
          value: config.enabled ? t('common.enabled') : t('common.disabled'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.xp.embed.fields.perMessage'),
          value: `${config.perMessage} XP`,
          inline: true,
        },
        {
          name: t('commands.config.subcommands.xp.embed.fields.perVoiceMinute'),
          value: `${config.perVoiceMinute} XP`,
          inline: true,
        },
        {
          name: t('commands.config.subcommands.xp.embed.fields.cooldown'),
          value: `${config.cooldown} ${t('common.seconds')}`,
          inline: true,
        },
        {
          name: t('commands.config.subcommands.xp.embed.fields.levelUpAnnounce'),
          value: config.announceLevelUp ? t('common.yes') : t('common.no'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.xp.embed.fields.levelUpChannel'),
          value: config.levelUpChannel ? `<#${config.levelUpChannel}>` : t('common.none'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.xp.embed.fields.boosterRole'),
          value: config.boosterRole ? `<@&${config.boosterRole}>` : t('common.none'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.xp.embed.fields.boosterMultiplier'),
          value: `${config.boosterMultiplier}%`,
          inline: true,
        },
        {
          name: t('commands.config.subcommands.xp.embed.fields.roleRewards'),
          value:
            roleRewards.length > 0
              ? roleRewards
                  .map(
                    r =>
                      `${t('commands.warn.subcommands.issue.success.level')} ${r.level}: <@&${r.roleId}>`
                  )
                  .join('\n')
              : t('common.none'),
          inline: false,
        }
      )
      .setTimestamp();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('config_xp_toggle')
        .setLabel(config.enabled ? t('common.disable') : t('common.enable'))
        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('config_xp_rates')
        .setLabel(t('commands.config.subcommands.xp.buttons.rates'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_xp_channels')
        .setLabel(t('commands.config.subcommands.xp.buttons.channels'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_xp_roles')
        .setLabel(t('commands.config.subcommands.xp.buttons.roles'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_xp_rewards')
        .setLabel(t('commands.config.subcommands.xp.buttons.rewards'))
        .setStyle(ButtonStyle.Primary)
    );

    const levelUpChannelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('config_xp_levelup_channel')
        .setPlaceholder(
          config.levelUpChannel
            ? t('commands.config.subcommands.xp.placeholders.levelUpChannelSet', {
                channel: `<#${config.levelUpChannel}>`,
              })
            : t('commands.config.subcommands.xp.placeholders.levelUpChannelUnset')
        )
        .setMinValues(1)
        .setMaxValues(1)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    );

    const announcementControlsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('config_xp_announce_toggle')
        .setLabel(
          config.announceLevelUp
            ? t('commands.config.subcommands.xp.buttons.disableAnnouncements')
            : t('commands.config.subcommands.xp.buttons.enableAnnouncements')
        )
        .setStyle(config.announceLevelUp ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('config_xp_announce_clear')
        .setLabel(t('commands.config.subcommands.xp.buttons.clearAnnouncementChannel'))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!config.levelUpChannel)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row1, levelUpChannelRow, announcementControlsRow],
    });
  } catch (error) {
    logger.error('Error refreshing XP config embed:', error);
  }
}

async function refreshWelcomeConfigEmbed(interaction: ButtonInteraction) {
  try {
    const config = await configurationService.getWelcomeConfig(interaction.guild!.id);

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(t('commands.config.subcommands.welcome.embed.title'))
      .setDescription(t('commands.config.subcommands.welcome.embed.description'))
      .addFields(
        {
          name: t('commands.config.subcommands.welcome.embed.fields.status'),
          value: config.enabled ? t('common.enabled') : t('common.disabled'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.welcome.embed.fields.channel'),
          value: config.channel ? `<#${config.channel}>` : t('common.none'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.welcome.embed.fields.embedEnabled'),
          value: config.embedEnabled ? t('common.yes') : t('common.no'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.welcome.embed.fields.dmEnabled'),
          value: config.dmEnabled ? t('common.yes') : t('common.no'),
          inline: true,
        }
      );

    if (config.message) {
      embed.addFields({
        name: t('commands.config.subcommands.welcome.embed.fields.message'),
        value: config.message.substring(0, 1024),
        inline: false,
      });
    }

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('config_welcome_toggle')
        .setLabel(config.enabled ? t('common.disable') : t('common.enable'))
        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('config_welcome_channel')
        .setLabel(t('commands.config.subcommands.welcome.buttons.channel'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_welcome_message')
        .setLabel(t('commands.config.subcommands.welcome.buttons.message'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_welcome_embed')
        .setLabel(t('commands.config.subcommands.welcome.buttons.embed'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_welcome_dm')
        .setLabel(t('commands.config.subcommands.welcome.buttons.dm'))
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row1],
    });
  } catch (error) {
    logger.error('Error refreshing welcome config embed:', error);
  }
}

async function refreshAutoroleConfigEmbed(interaction: ButtonInteraction) {
  try {
    const config = await configurationService.getAutoroleConfig(interaction.guild!.id);

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(t('commands.config.subcommands.autorole.embed.title'))
      .setDescription(t('commands.config.subcommands.autorole.embed.description'))
      .addFields(
        {
          name: t('commands.config.subcommands.autorole.embed.fields.status'),
          value: config.enabled ? t('common.enabled') : t('common.disabled'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.autorole.embed.fields.roles'),
          value:
            config.roles.length > 0
              ? config.roles.map(r => `<@&${r}>`).join('\n')
              : t('common.none'),
          inline: false,
        }
      )
      .setTimestamp();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('config_autorole_toggle')
        .setLabel(config.enabled ? t('common.disable') : t('common.enable'))
        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('config_autorole_add')
        .setLabel(t('commands.config.subcommands.autorole.buttons.add'))
        .setStyle(ButtonStyle.Primary)
        .setDisabled(config.roles.length >= 10),
      new ButtonBuilder()
        .setCustomId('config_autorole_remove')
        .setLabel(t('commands.config.subcommands.autorole.buttons.remove'))
        .setStyle(ButtonStyle.Danger)
        .setDisabled(config.roles.length === 0),
      new ButtonBuilder()
        .setCustomId('config_autorole_clear')
        .setLabel(t('commands.config.subcommands.autorole.buttons.clear'))
        .setStyle(ButtonStyle.Danger)
        .setDisabled(config.roles.length === 0)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row1],
    });
  } catch (error) {
    logger.error('Error refreshing autorole config embed:', error);
  }
}

async function refreshGoodbyeConfigEmbed(interaction: ButtonInteraction) {
  try {
    const config = await configurationService.getGoodbyeConfig(interaction.guild!.id);

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(t('commands.config.subcommands.goodbye.embed.title'))
      .setDescription(t('commands.config.subcommands.goodbye.embed.description'))
      .addFields(
        {
          name: t('commands.config.subcommands.goodbye.embed.fields.status'),
          value: config.enabled ? t('common.enabled') : t('common.disabled'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.goodbye.embed.fields.channel'),
          value: config.channel ? `<#${config.channel}>` : t('common.none'),
          inline: true,
        },
        {
          name: t('commands.config.subcommands.goodbye.embed.fields.embedEnabled'),
          value: config.embedEnabled ? t('common.yes') : t('common.no'),
          inline: true,
        }
      );

    if (config.message) {
      embed.addFields({
        name: t('commands.config.subcommands.goodbye.embed.fields.message'),
        value: config.message.substring(0, 1024),
        inline: false,
      });
    }

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('config_goodbye_toggle')
        .setLabel(config.enabled ? t('common.disable') : t('common.enable'))
        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('config_goodbye_channel')
        .setLabel(t('commands.config.subcommands.goodbye.buttons.channel'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_goodbye_message')
        .setLabel(t('commands.config.subcommands.goodbye.buttons.message'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('config_goodbye_embed')
        .setLabel(t('commands.config.subcommands.goodbye.buttons.embed'))
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row1],
    });
  } catch (error) {
    logger.error('Error refreshing goodbye config embed:', error);
  }
}

async function handleModLogButton(interaction: ButtonInteraction, action: string) {
  const [actionType, categoryKey] = action.split('_');

  if (actionType !== 'toggle' || !categoryKey) {
    return;
  }

  const category = categoryKey as ModLogCategory;
  const guildId = interaction.guildId;

  if (!guildId) {
    return;
  }

  await interaction.deferUpdate();

  const setting = await modLogService.getSetting(guildId, category);

  if (!setting) {
    await interaction.followUp({
      content: t('config.modlogs.feedback.missingChannel', {
        category: t(MOD_LOG_CATEGORY_NAME_KEYS[category]),
      }),
      ephemeral: true,
    });
    return;
  }

  const updated = await modLogService.setEnabled(guildId, category, !setting.enabled);
  const response = await buildModLogsConfigResponse(guildId);

  await interaction.editReply(response);

  if (!updated) {
    await interaction.followUp({
      content: t('config.modlogs.feedback.error'),
      ephemeral: true,
    });
    return;
  }

  const feedbackKey = updated.enabled
    ? 'config.modlogs.feedback.enabled'
    : 'config.modlogs.feedback.disabled';

  await interaction.followUp({
    content: t(feedbackKey, {
      category: t(MOD_LOG_CATEGORY_NAME_KEYS[category]),
      channel: updated.channelId ? `<#${updated.channelId}>` : t('common.none'),
    }),
    ephemeral: true,
  });
}
