import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { CommandCategory } from '../../types/command';
import { getDatabase } from '../../database/connection';
import {
  economyTrades,
  economyBalances,
  economyUserItems,
  economyShopItems,
} from '../../database/schema/economy';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const data = new SlashCommandBuilder()
  .setName('trade')
  .setDescription('Trade coins and items with other users')
  .addSubcommand(subcommand =>
    subcommand
      .setName('offer')
      .setDescription('Initiate a 5-minute trade offer with another user')
      .addUserOption(option =>
        option.setName('user').setDescription('The user to trade with').setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('open')
      .setDescription('Create an open trade that anyone can accept (expires in 24h)')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('gift')
      .setDescription('Directly gift coins or items to a user')
      .addUserOption(option =>
        option.setName('user').setDescription('The user to gift').setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName('coins').setDescription('Amount of coins to gift').setMinValue(1)
      )
      .addStringOption(option =>
        option.setName('item').setDescription('Name or ID of the item to gift')
      )
      .addIntegerOption(option =>
        option.setName('quantity').setDescription('Item quantity to gift (default 1)').setMinValue(1)
      )
  );

export const category = CommandCategory.Economy;
export const cooldown = 5;

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.isChatInputCommand()) return;
  const subcommand = interaction.options.getSubcommand();
  const db = getDatabase();

  if (subcommand === 'offer') {
    await interaction.deferReply();
    const targetUser = interaction.options.getUser('user', true);

    if (targetUser.bot || targetUser.id === interaction.user.id) {
      await interaction.editReply('You cannot trade with bots or yourself.');
      return;
    }

    const tradeId = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    await db.insert(economyTrades).values({
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
        { name: `${interaction.user.username}'s Offer`, value: 'Coins: 0\nItems: None', inline: true },
        { name: `${targetUser.username}'s Offer`, value: 'Coins: 0\nItems: None', inline: true }
      )
      .setColor(0x3498db)
      .setFooter({ text: 'Trade expires in 5 minutes' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`trade_offer_coins_${tradeId}`)
        .setLabel('Offer Coins')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`trade_offer_item_${tradeId}`)
        .setLabel('Offer Item')
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
  } else if (subcommand === 'open') {
    await interaction.deferReply();

    const tradeId = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(economyTrades).values({
      id: tradeId,
      guildId: interaction.guildId!,
      initiatorId: interaction.user.id,
      receiverId: null, // open to anyone
      initiatorOffer: { coins: 0, items: [] },
      receiverOffer: { coins: 0, items: [] },
      status: 'pending',
      expiresAt: expiresAt,
    });

    const embed = new EmbedBuilder()
      .setTitle('Open Trade')
      .setDescription(`${interaction.user.toString()} opened a trade for anyone!`)
      .addFields(
        { name: `${interaction.user.username}'s Offer`, value: 'Coins: 0\nItems: None', inline: true },
        { name: `Anyone's Offer`, value: 'Coins: 0\nItems: None', inline: true }
      )
      .setColor(0x9b59b6)
      .setFooter({ text: 'Trade expires in 24 hours' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`trade_offer_coins_${tradeId}`)
        .setLabel('Offer Coins')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`trade_offer_item_${tradeId}`)
        .setLabel('Offer Item')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`trade_accept_${tradeId}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`trade_decline_${tradeId}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } else if (subcommand === 'gift') {
    await interaction.deferReply();
    const targetUser = interaction.options.getUser('user', true);
    const coins = interaction.options.getInteger('coins') || 0;
    const itemName = interaction.options.getString('item');
    const quantity = interaction.options.getInteger('quantity') || 1;

    if (targetUser.bot || targetUser.id === interaction.user.id) {
      await interaction.editReply('You cannot gift bots or yourself.');
      return;
    }

    if (coins === 0 && !itemName) {
      await interaction.editReply('You must specify coins or an item to gift.');
      return;
    }

    try {
      await db.transaction(async tx => {
        // Handle coins gift
        if (coins > 0) {
          const initiatorBalanceResult = await tx
            .select()
            .from(economyBalances)
            .where(
              and(
                eq(economyBalances.userId, interaction.user.id),
                eq(economyBalances.guildId, interaction.guildId!)
              )
            )
            .limit(1);

          if (!initiatorBalanceResult[0] || initiatorBalanceResult[0].balance < coins) {
            throw new Error(`You don't have enough coins (${coins}).`);
          }

          const receiverBalanceResult = await tx
            .select()
            .from(economyBalances)
            .where(
              and(
                eq(economyBalances.userId, targetUser.id),
                eq(economyBalances.guildId, interaction.guildId!)
              )
            )
            .limit(1);

          await tx
            .update(economyBalances)
            .set({ balance: initiatorBalanceResult[0].balance - coins })
            .where(
              and(
                eq(economyBalances.userId, interaction.user.id),
                eq(economyBalances.guildId, interaction.guildId!)
              )
            );

          if (receiverBalanceResult[0]) {
            await tx
              .update(economyBalances)
              .set({ balance: receiverBalanceResult[0].balance + coins })
              .where(
                and(
                  eq(economyBalances.userId, targetUser.id),
                  eq(economyBalances.guildId, interaction.guildId!)
                )
              );
          } else {
            await tx.insert(economyBalances).values({
              userId: targetUser.id,
              guildId: interaction.guildId!,
              balance: coins,
            });
          }
        }

        // Handle item gift
        if (itemName) {
          // Find item
          const itemResult = await tx
            .select()
            .from(economyShopItems)
            .where(
              and(
                eq(economyShopItems.guildId, interaction.guildId!),
                eq(economyShopItems.name, itemName)
              )
            )
            .limit(1);

          if (!itemResult[0]) {
            throw new Error(`Item "${itemName}" not found in this server.`);
          }
          const item = itemResult[0];

          if (!item.tradeable) {
            throw new Error(`Item "${itemName}" is not tradeable/giftable.`);
          }

          // Check initiator has item
          const userItemResult = await tx
            .select()
            .from(economyUserItems)
            .where(
              and(
                eq(economyUserItems.userId, interaction.user.id),
                eq(economyUserItems.guildId, interaction.guildId!),
                eq(economyUserItems.itemId, item.id),
                eq(economyUserItems.active, true)
              )
            )
            .limit(1);

          if (!userItemResult[0] || userItemResult[0].quantity < quantity) {
            throw new Error(`You don't have enough of "${itemName}" (need ${quantity}).`);
          }

          // Decrease initiator quantity
          if (userItemResult[0].quantity === quantity) {
            await tx
              .delete(economyUserItems)
              .where(eq(economyUserItems.id, userItemResult[0].id));
          } else {
            await tx
              .update(economyUserItems)
              .set({ quantity: userItemResult[0].quantity - quantity })
              .where(eq(economyUserItems.id, userItemResult[0].id));
          }

          // Increase receiver quantity
          const receiverItemResult = await tx
            .select()
            .from(economyUserItems)
            .where(
              and(
                eq(economyUserItems.userId, targetUser.id),
                eq(economyUserItems.guildId, interaction.guildId!),
                eq(economyUserItems.itemId, item.id),
                eq(economyUserItems.active, true)
              )
            )
            .limit(1);

          if (receiverItemResult[0]) {
            await tx
              .update(economyUserItems)
              .set({ quantity: receiverItemResult[0].quantity + quantity })
              .where(eq(economyUserItems.id, receiverItemResult[0].id));
          } else {
            await tx.insert(economyUserItems).values({
              userId: targetUser.id,
              guildId: interaction.guildId!,
              itemId: item.id,
              quantity: quantity,
            });
          }
        }
      });

      const giftMsg = [];
      if (coins > 0) giftMsg.push(`${coins} coins`);
      if (itemName) giftMsg.push(`${quantity}x ${itemName}`);
      
      await interaction.editReply(`Successfully gifted ${giftMsg.join(' and ')} to ${targetUser.toString()}!`);
    } catch (e: any) {
      await interaction.editReply(`Failed to gift: ${e.message}`);
    }
  }
}

