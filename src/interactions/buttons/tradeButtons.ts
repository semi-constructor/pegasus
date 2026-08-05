import {
  ButtonInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} from 'discord.js';
import { getDatabase } from '../../database/connection';
import {
  economyTrades,
  economyBalances,
  economyUserItems,
  economyShopItems,
} from '../../database/schema/economy';
import { eq, and } from 'drizzle-orm';

export async function handleTradeButtons(interaction: ButtonInteraction) {
  const parts = interaction.customId.split('_');
  const action = parts[1]; // 'offer', 'accept', 'decline'
  const subAction = parts[2]; // 'coins', 'item', or tradeId if action is accept/decline
  const tradeId = action === 'offer' ? parts[3] : parts[2];

  const db = getDatabase();
  const tradeResult = await db
    .select()
    .from(economyTrades)
    .where(eq(economyTrades.id, tradeId))
    .limit(1);
  const trade = tradeResult[0];

  if (!trade) {
    await interaction.reply({
      content: 'This trade does not exist or has expired.',
      ephemeral: true,
    });
    return;
  }

  if (trade.status !== 'pending') {
    await interaction.reply({ content: `This trade is already ${trade.status}.`, ephemeral: true });
    return;
  }

  const isInitiator = interaction.user.id === trade.initiatorId;
  let isReceiver = trade.receiverId ? interaction.user.id === trade.receiverId : false;

  if (!isInitiator && !isReceiver && trade.receiverId !== null) {
    await interaction.reply({ content: 'You are not part of this trade.', ephemeral: true });
    return;
  }

  if (action === 'offer' && subAction === 'coins') {
    const modal = new ModalBuilder()
      .setCustomId(`trade_offer_coins_modal_${tradeId}`)
      .setTitle('Offer Coins');

    const amountInput = new TextInputBuilder()
      .setCustomId('amount')
      .setLabel('Amount of coins to offer')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
    return;
  }

  if (action === 'offer' && subAction === 'item') {
    const modal = new ModalBuilder()
      .setCustomId(`trade_offer_item_modal_${tradeId}`)
      .setTitle('Offer Item');

    const itemNameInput = new TextInputBuilder()
      .setCustomId('itemName')
      .setLabel('Item Name')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const quantityInput = new TextInputBuilder()
      .setCustomId('quantity')
      .setLabel('Quantity')
      .setStyle(TextInputStyle.Short)
      .setValue('1')
      .setRequired(true);

    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(itemNameInput);
    const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(quantityInput);
    modal.addComponents(row1, row2);

    await interaction.showModal(modal);
    return;
  }

  if (action === 'decline') {
    if (!isInitiator && !isReceiver && trade.receiverId === null) {
      // Anyone can't just cancel an open trade, only initiator
      await interaction.reply({ content: 'Only the initiator can cancel this open trade.', ephemeral: true });
      return;
    }

    await db
      .update(economyTrades)
      .set({ status: 'cancelled' })
      .where(eq(economyTrades.id, tradeId));
    await interaction.update({ content: 'Trade cancelled.', embeds: [], components: [] });
    return;
  }

  if (action === 'accept') {
    if (trade.receiverId === null) {
      if (isInitiator) {
        await interaction.reply({ content: 'You cannot accept your own open trade.', ephemeral: true });
        return;
      }
      isReceiver = true;
      trade.receiverId = interaction.user.id;
    } else if (isInitiator) {
      // In a real system, you'd require both to click accept.
      // We will allow receiver to accept, or initiator if receiver already confirmed?
      // For simplicity, we just check if someone accepts and the other has offered.
      // Let's assume if the receiver clicks accept, the trade is completed.
      await interaction.reply({ content: 'Waiting for the other party to accept.', ephemeral: true });
      return;
    }

    // Process trade execution inside a transaction
    try {
      await db.transaction(async tx => {
        // Mark complete
        await tx
          .update(economyTrades)
          .set({ status: 'completed', receiverId: interaction.user.id })
          .where(eq(economyTrades.id, tradeId));

        const initiatorOfferCoins = (trade.initiatorOffer as any)?.coins || 0;
        const receiverOfferCoins = (trade.receiverOffer as any)?.coins || 0;
        const initiatorOfferItems = (trade.initiatorOffer as any)?.items || [];
        const receiverOfferItems = (trade.receiverOffer as any)?.items || [];

        // Fetch balances
        const [initiatorBalance] = await tx
          .select()
          .from(economyBalances)
          .where(
            and(
              eq(economyBalances.userId, trade.initiatorId),
              eq(economyBalances.guildId, trade.guildId)
            )
          )
          .limit(1);

        const [receiverBalance] = await tx
          .select()
          .from(economyBalances)
          .where(
            and(
              eq(economyBalances.userId, interaction.user.id),
              eq(economyBalances.guildId, trade.guildId)
            )
          )
          .limit(1);

        if (initiatorOfferCoins > 0 && (!initiatorBalance || initiatorBalance.balance < initiatorOfferCoins)) {
          throw new Error('Initiator does not have enough coins.');
        }
        if (receiverOfferCoins > 0 && (!receiverBalance || receiverBalance.balance < receiverOfferCoins)) {
          throw new Error('Receiver does not have enough coins.');
        }

        // Deduct/Add Coins
        if (initiatorOfferCoins > 0) {
          await tx
            .update(economyBalances)
            .set({ balance: initiatorBalance.balance - initiatorOfferCoins })
            .where(
              and(eq(economyBalances.userId, trade.initiatorId), eq(economyBalances.guildId, trade.guildId))
            );
          if (receiverBalance) {
            await tx
              .update(economyBalances)
              .set({ balance: receiverBalance.balance + initiatorOfferCoins })
              .where(
                and(eq(economyBalances.userId, interaction.user.id), eq(economyBalances.guildId, trade.guildId))
              );
          } else {
            await tx.insert(economyBalances).values({
              userId: interaction.user.id,
              guildId: trade.guildId,
              balance: initiatorOfferCoins,
            });
          }
        }

        if (receiverOfferCoins > 0) {
          // If we inserted receiverBalance earlier, it wasn't fetched, but receiver must have had a balance if offer > 0
          await tx
            .update(economyBalances)
            .set({ balance: receiverBalance.balance - receiverOfferCoins })
            .where(
              and(eq(economyBalances.userId, interaction.user.id), eq(economyBalances.guildId, trade.guildId))
            );
          if (initiatorBalance) {
            await tx
              .update(economyBalances)
              .set({ balance: initiatorBalance.balance + receiverOfferCoins })
              .where(
                and(eq(economyBalances.userId, trade.initiatorId), eq(economyBalances.guildId, trade.guildId))
              );
          }
        }

        // Process Items Helper
        const processItems = async (fromUserId: string, toUserId: string, items: any[]) => {
          for (const item of items) {
            const itemName = item.name;
            const quantity = item.quantity;
            
            const [shopItem] = await tx
              .select()
              .from(economyShopItems)
              .where(and(eq(economyShopItems.guildId, trade.guildId), eq(economyShopItems.name, itemName)))
              .limit(1);

            if (!shopItem || !shopItem.tradeable) throw new Error(`Item ${itemName} is not tradeable.`);

            const [userItem] = await tx
              .select()
              .from(economyUserItems)
              .where(and(
                eq(economyUserItems.userId, fromUserId),
                eq(economyUserItems.guildId, trade.guildId),
                eq(economyUserItems.itemId, shopItem.id),
                eq(economyUserItems.active, true)
              ))
              .limit(1);

            if (!userItem || userItem.quantity < quantity) {
              throw new Error(`User does not have enough of ${itemName}.`);
            }

            if (userItem.quantity === quantity) {
              await tx.delete(economyUserItems).where(eq(economyUserItems.id, userItem.id));
            } else {
              await tx.update(economyUserItems)
                .set({ quantity: userItem.quantity - quantity })
                .where(eq(economyUserItems.id, userItem.id));
            }

            const [receiverItem] = await tx
              .select()
              .from(economyUserItems)
              .where(and(
                eq(economyUserItems.userId, toUserId),
                eq(economyUserItems.guildId, trade.guildId),
                eq(economyUserItems.itemId, shopItem.id),
                eq(economyUserItems.active, true)
              ))
              .limit(1);

            if (receiverItem) {
              await tx.update(economyUserItems)
                .set({ quantity: receiverItem.quantity + quantity })
                .where(eq(economyUserItems.id, receiverItem.id));
            } else {
              await tx.insert(economyUserItems).values({
                userId: toUserId,
                guildId: trade.guildId,
                itemId: shopItem.id,
                quantity: quantity,
              });
            }
          }
        };

        await processItems(trade.initiatorId, interaction.user.id, initiatorOfferItems);
        await processItems(interaction.user.id, trade.initiatorId, receiverOfferItems);
      });

      await interaction.update({
        content: `Trade accepted and completed by <@${interaction.user.id}>!`,
        embeds: [],
        components: [],
      });
    } catch (e: any) {
      await interaction.reply({ content: `Trade failed: ${e.message}`, ephemeral: true });
    }
  }
}

export async function handleTradeModal(interaction: ModalSubmitInteraction) {
  const parts = interaction.customId.split('_');
  const tradeId = parts[parts.length - 1]; 

  const db = getDatabase();
  const tradeResult = await db
    .select()
    .from(economyTrades)
    .where(eq(economyTrades.id, tradeId))
    .limit(1);
  const trade = tradeResult[0];

  if (!trade) {
    await interaction.reply({
      content: 'This trade does not exist or has expired.',
      ephemeral: true,
    });
    return;
  }

  const isInitiator = interaction.user.id === trade.initiatorId;
  let isReceiver = trade.receiverId ? interaction.user.id === trade.receiverId : false;

  // In an open trade, the person interacting becomes the temporary receiver for this modal update
  const offerKey = isInitiator ? 'initiatorOffer' : 'receiverOffer';
  if (!isInitiator && !isReceiver && trade.receiverId === null) {
    trade.receiverId = interaction.user.id;
    isReceiver = true;
    
    await db.update(economyTrades)
      .set({ receiverId: interaction.user.id })
      .where(eq(economyTrades.id, tradeId));
  } else if (!isInitiator && !isReceiver) {
    await interaction.reply({ content: 'You are not part of this trade.', ephemeral: true });
    return;
  }

  const currentOffer = (trade[offerKey as keyof typeof trade] as any) || { coins: 0, items: [] };

  if (interaction.customId.startsWith('trade_offer_coins_modal_')) {
    const amountStr = interaction.fields.getTextInputValue('amount');
    const amount = parseInt(amountStr, 10);

    if (isNaN(amount) || amount < 0) {
      await interaction.reply({ content: 'Invalid amount.', ephemeral: true });
      return;
    }

    const [balance] = await db
      .select()
      .from(economyBalances)
      .where(
        and(
          eq(economyBalances.userId, interaction.user.id),
          eq(economyBalances.guildId, trade.guildId)
        )
      )
      .limit(1);

    if (!balance || balance.balance < amount) {
      await interaction.reply({ content: 'You do not have enough coins.', ephemeral: true });
      return;
    }

    currentOffer.coins = amount;
  } else if (interaction.customId.startsWith('trade_offer_item_modal_')) {
    const itemName = interaction.fields.getTextInputValue('itemName');
    const qtyStr = interaction.fields.getTextInputValue('quantity');
    const quantity = parseInt(qtyStr, 10);

    if (isNaN(quantity) || quantity <= 0) {
      await interaction.reply({ content: 'Invalid quantity.', ephemeral: true });
      return;
    }

    const [shopItem] = await db
      .select()
      .from(economyShopItems)
      .where(and(eq(economyShopItems.guildId, trade.guildId), eq(economyShopItems.name, itemName)))
      .limit(1);

    if (!shopItem) {
      await interaction.reply({ content: `Item "${itemName}" does not exist.`, ephemeral: true });
      return;
    }

    if (!shopItem.tradeable) {
      await interaction.reply({ content: `Item "${itemName}" cannot be traded.`, ephemeral: true });
      return;
    }

    const [userItem] = await db
      .select()
      .from(economyUserItems)
      .where(and(
        eq(economyUserItems.userId, interaction.user.id),
        eq(economyUserItems.guildId, trade.guildId),
        eq(economyUserItems.itemId, shopItem.id),
        eq(economyUserItems.active, true)
      ))
      .limit(1);

    if (!userItem || userItem.quantity < quantity) {
      await interaction.reply({ content: `You do not have ${quantity}x "${itemName}".`, ephemeral: true });
      return;
    }

    // Add to items list or update existing
    const existingItem = currentOffer.items.find((i: any) => i.name === itemName);
    if (existingItem) {
      existingItem.quantity = quantity;
    } else {
      currentOffer.items.push({ name: itemName, quantity });
    }
  }

  await db
    .update(economyTrades)
    .set({ [offerKey]: currentOffer })
    .where(eq(economyTrades.id, tradeId));

  const [newTrade] = await db
    .select()
    .from(economyTrades)
    .where(eq(economyTrades.id, tradeId))
    .limit(1);

  if (!newTrade) return;

  const initCoins = (newTrade.initiatorOffer as any)?.coins || 0;
  const initItems = ((newTrade.initiatorOffer as any)?.items || []).map((i: any) => `${i.quantity}x ${i.name}`).join(', ') || 'None';
  
  const recCoins = (newTrade.receiverOffer as any)?.coins || 0;
  const recItems = ((newTrade.receiverOffer as any)?.items || []).map((i: any) => `${i.quantity}x ${i.name}`).join(', ') || 'None';

  const receiverDisplay = newTrade.receiverId ? `<@${newTrade.receiverId}>` : 'Anyone';
  
  const embed = new EmbedBuilder()
    .setTitle(newTrade.receiverId ? 'Trade Initiated' : 'Open Trade')
    .setDescription(`<@${newTrade.initiatorId}> wants to trade with ${receiverDisplay}`)
    .addFields(
      {
        name: `Initiator's Offer`,
        value: `Coins: ${initCoins}\nItems: ${initItems}`,
        inline: true,
      },
      {
        name: newTrade.receiverId ? `Receiver's Offer` : `Anyone's Offer`,
        value: `Coins: ${recCoins}\nItems: ${recItems}`,
        inline: true,
      }
    )
    .setColor(0x3498db)
    .setFooter({ text: 'Trade updates in real-time' });

  if (interaction.isFromMessage()) {
    await (interaction as any).update({ embeds: [embed] });
  } else {
    await interaction.reply({ content: 'Offer updated successfully.', ephemeral: true });
    if (interaction.message) {
      await interaction.message.edit({ embeds: [embed] });
    }
  }
}
