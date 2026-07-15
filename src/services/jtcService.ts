import {
  Guild,
  VoiceState,
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
  VoiceChannel,
  TextChannel,
  GuildMember,
  MessageFlags,
} from 'discord.js';
import { jtcRepository, JTCConfigData } from '../repositories/jtcRepository';
import { t } from '../i18n';
import { logger } from '../utils/logger';

export class JTCService {
  async setupJTC(
    guild: Guild,
    baseVoiceChannelId: string,
    categoryId: string,
    panelChannelId: string,
    channelNameFormat?: string
  ) {
    const configData: JTCConfigData = {
      baseVoiceChannelId,
      categoryId,
      panelChannelId,
      channelNameFormat: channelNameFormat ?? "{user}'s Channel",
    };

    await jtcRepository.upsertConfig(guild.id, configData);
    await this.sendOrUpdatePanel(guild);
  }

  async sendOrUpdatePanel(guild: Guild) {
    const config = await jtcRepository.getConfig(guild.id);
    if (!config) {
      throw new Error('JTC config not found for guild');
    }

    let panelChannel: TextChannel;
    try {
      const channel = await guild.channels.fetch(config.panelChannelId);
      if (!channel || channel.type !== ChannelType.GuildText) {
        throw new Error('Invalid panel channel');
      }
      panelChannel = channel;
    } catch (error) {
      logger.error(`Failed to fetch JTC panel channel for guild ${guild.id}:`, error);
      throw new Error('Panel channel not found or inaccessible');
    }

    const embed = new EmbedBuilder()
      .setTitle(t('jtc.panel.title'))
      .setDescription(t('jtc.panel.description'))
      .setColor(0x5865f2);

    const lockButton = new ButtonBuilder()
      .setCustomId('jtc_lock')
      .setLabel(t('jtc.buttons.lock'))
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Primary);

    const unlockButton = new ButtonBuilder()
      .setCustomId('jtc_unlock')
      .setLabel(t('jtc.buttons.unlock'))
      .setEmoji('🔓')
      .setStyle(ButtonStyle.Secondary);

    const renameButton = new ButtonBuilder()
      .setCustomId('jtc_rename')
      .setLabel(t('jtc.buttons.rename'))
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Success);

    const claimButton = new ButtonBuilder()
      .setCustomId('jtc_claim')
      .setLabel(t('jtc.buttons.claim'))
      .setEmoji('👑')
      .setStyle(ButtonStyle.Danger);

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      lockButton,
      unlockButton,
      renameButton,
      claimButton
    );

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('jtc_limit')
      .setPlaceholder(t('jtc.menu.limitPlaceholder'))
      .addOptions([
        { label: t('jtc.menu.noLimit'), value: '0', emoji: '♾️' },
        { label: t('jtc.menu.users', { count: 2 }), value: '2', emoji: '👥' },
        { label: t('jtc.menu.users', { count: 3 }), value: '3', emoji: '👥' },
        { label: t('jtc.menu.users', { count: 4 }), value: '4', emoji: '👥' },
        { label: t('jtc.menu.users', { count: 5 }), value: '5', emoji: '👥' },
        { label: t('jtc.menu.users', { count: 10 }), value: '10', emoji: '👥' },
        { label: t('jtc.menu.users', { count: 15 }), value: '15', emoji: '👥' },
        { label: t('jtc.menu.users', { count: 20 }), value: '20', emoji: '👥' },
        { label: t('jtc.menu.users', { count: 25 }), value: '25', emoji: '👥' },
      ]);

    const menuRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    if (config.panelMessageId) {
      try {
        const existingMessage = await panelChannel.messages.fetch(config.panelMessageId);
        if (existingMessage) {
          await existingMessage.edit({
            embeds: [embed],
            components: [buttonRow, menuRow],
          });
          return;
        }
      } catch (error) {
        logger.warn(
          `Could not fetch existing JTC panel message in guild ${guild.id}, sending new one.`
        );
      }
    }

    const newMessage = await panelChannel.send({
      embeds: [embed],
      components: [buttonRow, menuRow],
    });

    await jtcRepository.setPanelMessage(guild.id, newMessage.id);
  }

  async handleVoiceJoin(state: VoiceState) {
    if (!state.guild || !state.member || !state.channelId) return;

    try {
      const config = await jtcRepository.getConfigByBaseChannel(state.channelId);
      if (!config) return;

      const member = state.member;
      const channelName = config.channelNameFormat.replace('{user}', member.user.username);

      const tempChannel = await state.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: config.categoryId,
        permissionOverwrites: [
          {
            id: state.guild.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
            type: OverwriteType.Role,
          },
          {
            id: member.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.ManageChannels,
            ],
            type: OverwriteType.Member,
          },
        ],
      });

      await jtcRepository.createTempChannel({
        guildId: state.guild.id,
        channelId: tempChannel.id,
        ownerId: member.id,
        baseVoiceChannelId: config.baseVoiceChannelId,
        isLocked: false,
        userLimit: 0,
      });

      await member.voice.setChannel(tempChannel);
      logger.info(`Created JTC temp channel ${tempChannel.id} for user ${member.id}`);
    } catch (error) {
      logger.error(`Error in handleVoiceJoin for user ${state.member.id}:`, error);
    }
  }

  async handleVoiceLeave(state: VoiceState) {
    if (!state.guild || !state.channelId) return;

    try {
      const tempChannelData = await jtcRepository.getTempChannel(state.channelId);
      if (!tempChannelData) return;

      const channel = await state.guild.channels.fetch(state.channelId).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildVoice) {
        await jtcRepository.deleteTempChannel(state.channelId);
        return;
      }

      const voiceChannel = channel;
      if (voiceChannel.members.size === 0) {
        await voiceChannel.delete('JTC temp channel empty');
        await jtcRepository.deleteTempChannel(state.channelId);
        logger.info(`Deleted empty JTC temp channel ${state.channelId}`);
      }
    } catch (error) {
      logger.error(`Error in handleVoiceLeave for channel ${state.channelId}:`, error);
    }
  }

  private async getTempChannelForInteraction(
    interaction: ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction,
    requireOwner: boolean = true
  ) {
    const member = interaction.member as GuildMember;
    const voiceChannelId = member?.voice?.channelId;

    if (!voiceChannelId) {
      await interaction.reply({
        content: t('jtc.error.notInVoice'),
        flags: MessageFlags.Ephemeral,
      });
      return null;
    }

    const tempChannelData = await jtcRepository.getTempChannel(voiceChannelId);
    if (!tempChannelData) {
      await interaction.reply({
        content: t('jtc.error.notInTempChannel'),
        flags: MessageFlags.Ephemeral,
      });
      return null;
    }

    if (requireOwner && tempChannelData.ownerId !== interaction.user.id) {
      await interaction.reply({ content: t('jtc.error.notOwner'), flags: MessageFlags.Ephemeral });
      return null;
    }

    const voiceChannel = (await interaction.guild?.channels.fetch(voiceChannelId)) as VoiceChannel;
    if (!voiceChannel) {
      await interaction.reply({ content: t('common.error'), flags: MessageFlags.Ephemeral });
      return null;
    }

    return { voiceChannel, tempChannelData };
  }

  async handleLock(interaction: ButtonInteraction) {
    const data = await this.getTempChannelForInteraction(interaction, true);
    if (!data) return;

    try {
      const { voiceChannel, tempChannelData } = data;
      await voiceChannel.permissionOverwrites.edit(interaction.guild!.id, {
        Connect: false,
      });

      await jtcRepository.updateTempChannel(tempChannelData.channelId, { isLocked: true });
      await interaction.reply({ content: t('jtc.success.locked'), flags: MessageFlags.Ephemeral });
    } catch (error) {
      logger.error(`Error in handleLock for channel ${data.tempChannelData.channelId}:`, error);
      await interaction.reply({ content: t('common.error'), flags: MessageFlags.Ephemeral });
    }
  }

  async handleUnlock(interaction: ButtonInteraction) {
    const data = await this.getTempChannelForInteraction(interaction, true);
    if (!data) return;

    try {
      const { voiceChannel, tempChannelData } = data;
      await voiceChannel.permissionOverwrites.edit(interaction.guild!.id, {
        Connect: true,
      });

      await jtcRepository.updateTempChannel(tempChannelData.channelId, { isLocked: false });
      await interaction.reply({
        content: t('jtc.success.unlocked'),
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error(`Error in handleUnlock for channel ${data.tempChannelData.channelId}:`, error);
      await interaction.reply({ content: t('common.error'), flags: MessageFlags.Ephemeral });
    }
  }

  async handleRenameModal(interaction: ButtonInteraction) {
    const data = await this.getTempChannelForInteraction(interaction, true);
    if (!data) return;

    try {
      const modal = new ModalBuilder()
        .setCustomId('jtc_rename_modal')
        .setTitle(t('jtc.modal.renameTitle'));

      const nameInput = new TextInputBuilder()
        .setCustomId('channel_name')
        .setLabel(t('jtc.modal.newNameLabel'))
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(100)
        .setRequired(true)
        .setValue(data.voiceChannel.name);

      const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
      modal.addComponents(actionRow);

      await interaction.showModal(modal);
    } catch (error) {
      logger.error(
        `Error in handleRenameModal for channel ${data.tempChannelData.channelId}:`,
        error
      );
      await interaction.reply({ content: t('common.error'), flags: MessageFlags.Ephemeral });
    }
  }

  async handleRenameSubmit(interaction: ModalSubmitInteraction) {
    const data = await this.getTempChannelForInteraction(interaction, true);
    if (!data) return;

    try {
      const newName = interaction.fields.getTextInputValue('channel_name');
      await data.voiceChannel.setName(newName);
      await interaction.reply({ content: t('jtc.success.renamed'), flags: MessageFlags.Ephemeral });
    } catch (error) {
      logger.error(
        `Error in handleRenameSubmit for channel ${data.tempChannelData.channelId}:`,
        error
      );
      await interaction.reply({ content: t('common.error'), flags: MessageFlags.Ephemeral });
    }
  }

  async handleUserLimit(interaction: StringSelectMenuInteraction) {
    const data = await this.getTempChannelForInteraction(interaction, true);
    if (!data) return;

    try {
      const limit = parseInt(interaction.values[0], 10);
      await data.voiceChannel.setUserLimit(limit);
      await jtcRepository.updateTempChannel(data.tempChannelData.channelId, { userLimit: limit });
      await interaction.reply({
        content: t('jtc.success.limitSet', { limit }),
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error(
        `Error in handleUserLimit for channel ${data.tempChannelData.channelId}:`,
        error
      );
      await interaction.reply({ content: t('common.error'), flags: MessageFlags.Ephemeral });
    }
  }

  async handleClaim(interaction: ButtonInteraction) {
    const data = await this.getTempChannelForInteraction(interaction, false);
    if (!data) return;

    try {
      const { voiceChannel, tempChannelData } = data;
      if (voiceChannel.members.has(tempChannelData.ownerId)) {
        await interaction.reply({
          content: t('jtc.error.ownerStillPresent'),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await voiceChannel.permissionOverwrites.delete(tempChannelData.ownerId).catch(() => null);
      await voiceChannel.permissionOverwrites.edit(interaction.user.id, {
        ViewChannel: true,
        Connect: true,
        ManageChannels: true,
      });

      await jtcRepository.updateTempChannel(tempChannelData.channelId, {
        ownerId: interaction.user.id,
      });
      await interaction.reply({ content: t('jtc.success.claimed'), flags: MessageFlags.Ephemeral });
    } catch (error) {
      logger.error(`Error in handleClaim for channel ${data.tempChannelData.channelId}:`, error);
      await interaction.reply({ content: t('common.error'), flags: MessageFlags.Ephemeral });
    }
  }
}

export const jtcService = new JTCService();
