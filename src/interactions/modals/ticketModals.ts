import { ModalSubmitInteraction, TextChannel, EmbedBuilder } from 'discord.js';
import { TicketService } from '../../services/ticketService';
import { TicketRepository } from '../../repositories/ticketRepository';
import { GuildService } from '../../services/guildService';
import { t } from '../../i18n';

export async function handleTicketModal(interaction: ModalSubmitInteraction): Promise<void> {
  const [action, id] = interaction.customId.split(':');
  const ticketService = new TicketService();
  const ticketRepository = new TicketRepository();
  const guildService = new GuildService();
  const locale = await guildService.getGuildLanguage(interaction.guildId!);

  try {
    switch (action) {
      case 'ticket_modal':
        await handleTicketCreation(interaction, id, ticketService, ticketRepository, locale);
        break;
      case 'ticket_close_modal':
        await handleTicketCloseReason(interaction, id, ticketService, ticketRepository, locale);
        break;
    }
  } catch (error: any) {
    await interaction.reply({
      content: t('common.error', { error: error.message }),
      ephemeral: true,
    });
  }
}

async function handleTicketCreation(
  interaction: ModalSubmitInteraction,
  panelId: string,
  ticketService: TicketService,
  ticketRepository: TicketRepository,
  _locale: string
) {
  await interaction.deferReply({ ephemeral: true });

  const reason = interaction.fields.getTextInputValue('reason');

  // Get panel
  const panel = await ticketRepository.getPanelById(panelId);
  if (!panel || !panel.isActive) {
    await interaction.editReply({
      content: t('tickets.panelNotFound'),
    });
    return;
  }

  try {
    const { ticket, channel } = await ticketService.createTicket(
      interaction,
      {
        ...panel,
        supportRoles: (panel.supportRoles as string[]) || [],
      },
      reason
    );

    const embed = new EmbedBuilder()
      .setTitle(t('tickets.ticketCreated', { number: ticket.ticketNumber }))
      .setDescription(t('tickets.ticketCreatedDesc', { channel: channel.toString() }))
      .setColor(0x00ff00)
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
    });
  } catch (error: any) {
    await interaction.editReply({
      content: t('common.error', { error: error.message }),
    });
  }
}

async function handleTicketCloseReason(
  interaction: ModalSubmitInteraction,
  ticketId: string,
  ticketService: TicketService,
  ticketRepository: TicketRepository,
  locale: string
) {
  await interaction.deferReply();

  const closeReason = interaction.fields.getTextInputValue('closeReason');

  const ticket = await ticketRepository.getTicket(ticketId);
  if (!ticket) {
    await interaction.editReply({
      content: t('tickets.ticketNotFound'),
    });
    return;
  }

  try {
    await ticketService.closeTicket(
      ticketId,
      interaction.member as any,
      closeReason || undefined,
      locale
    );

    await interaction.editReply({
      content: t('tickets.closingWithReason', { reason: closeReason || t('common.noReasonProvided') }),
    });

    // Delete channel after 5 seconds
    setTimeout(async () => {
      try {
        await (interaction.channel as TextChannel).delete();
      } catch (error) {
        // Channel might already be deleted
      }
    }, 5000);
  } catch (error: any) {
    await interaction.editReply({
      content: t('common.error', { error: error.message }),
    });
  }
}
