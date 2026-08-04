import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import { CommandCategory } from '../../types/command';
import { getDatabase } from '../../database/connection';
import { economyTrades, economyBalances } from '../../database/schema/economy';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const data = new SlashCommandBuilder()
  .setName('trade')
  .setDescription('Trade coins and items with other users')
  .addSubcommand(subcommand =>
    subcommand
      .setName('initiate')
      .setDescription('Initiate a trade with another user')
      .addUserOption(option =>
        option.setName('user').setDescription('The user to trade with').setRequired(true)
      )
  );

export const category = CommandCategory.Economy;
export const cooldown = 5;

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.isChatInputCommand()) return;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'initiate') {
    await interaction.deferReply();
    const targetUser = interaction.options.getUser('user', true);

    if (targetUser.bot || targetUser.id === interaction.user.id) {
      await interaction.editReply('You cannot trade with bots or yourself.');
      return;
    }

    const tradeId = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    await getDatabase()
      .insert(economyTrades)
      .values({
        id: tradeId,
        guildId: interaction.guildId!,
        initiatorId: interaction.user.id,
        receiverId: targetUser.id,
        initiatorOffer: { coins: 0, items: [] },
        receiverOffer: { coins: 0, items: [] },
        status: 'pending',
        expiresAt: expiresAt,
      });

    const embed = new EmbedBuilder()
      .setTitle('Trade Initiated')
      .setDescription(`${interaction.user.toString()} wants to trade with ${targetUser.toString()}`)
      .addFields(
        { name: `${interaction.user.username}'s Offer`, value: 'Coins: 0', inline: true },
        { name: `${targetUser.username}'s Offer`, value: 'Coins: 0', inline: true }
      )
      .setColor(0x3498db)
      .setFooter({ text: 'Trade expires in 5 minutes' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`trade_offer_coins_${tradeId}`)
        .setLabel('Offer Coins')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`trade_accept_${tradeId}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`trade_decline_${tradeId}`)
        .setLabel('Decline / Cancel')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  }
}
