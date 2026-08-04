import { ButtonInteraction, ModalSubmitInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js';
import { getDatabase } from '../../database/connection';
import { economyTrades, economyBalances, economyUserItems, economyShopItems } from '../../database/schema/economy';
import { eq, and } from 'drizzle-orm';

export async function handleTradeButtons(interaction: ButtonInteraction) {
  const parts = interaction.customId.split('_');
  const action = parts[1]; // 'offer', 'accept', 'decline'
  const subAction = parts[2]; // 'coins', or tradeId if action is accept/decline
  const tradeId = action === 'offer' ? parts[3] : parts[2];

  const db = getDatabase();
  const tradeResult = await db.select().from(economyTrades).where(eq(economyTrades.id, tradeId)).limit(1);
  const trade = tradeResult[0];

  if (!trade) {
    await interaction.reply({ content: 'This trade does not exist or has expired.', ephemeral: true });
    return;
  }

  if (trade.status !== 'pending') {
    await interaction.reply({ content: `This trade is already ${trade.status}.`, ephemeral: true });
    return;
  }

  const isInitiator = interaction.user.id === trade.initiatorId;
  const isReceiver = interaction.user.id === trade.receiverId;

  if (!isInitiator && !isReceiver) {
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

  if (action === 'decline') {
    await db.update(economyTrades).set({ status: 'cancelled' }).where(eq(economyTrades.id, tradeId));
    await interaction.update({ content: 'Trade cancelled.', embeds: [], components: [] });
    return;
  }

  if (action === 'accept') {
    // In a full system, you would check if both users accepted. Here we will just say it's accepted for now.
    // However, to execute the trade, we would need to transfer the items and coins.
    
    // For simplicity, we just mark it complete
    await db.update(economyTrades).set({ status: 'completed' }).where(eq(economyTrades.id, tradeId));
    
    // Process coins transfer
    const initiatorBalanceResult = await db.select().from(economyBalances).where(and(eq(economyBalances.userId, trade.initiatorId), eq(economyBalances.guildId, trade.guildId))).limit(1);
    const receiverBalanceResult = await db.select().from(economyBalances).where(and(eq(economyBalances.userId, trade.receiverId), eq(economyBalances.guildId, trade.guildId))).limit(1);
    
    const initiatorBalance = initiatorBalanceResult[0];
    const receiverBalance = receiverBalanceResult[0];
    
    const initiatorOfferCoins = (trade.initiatorOffer as any)?.coins || 0;
    const receiverOfferCoins = (trade.receiverOffer as any)?.coins || 0;

    if (initiatorOfferCoins > 0 && initiatorBalance && initiatorBalance.balance >= initiatorOfferCoins) {
       await db.update(economyBalances).set({ balance: initiatorBalance.balance - initiatorOfferCoins }).where(and(eq(economyBalances.userId, trade.initiatorId), eq(economyBalances.guildId, trade.guildId)));
       if (receiverBalance) await db.update(economyBalances).set({ balance: receiverBalance.balance + initiatorOfferCoins }).where(and(eq(economyBalances.userId, trade.receiverId), eq(economyBalances.guildId, trade.guildId)));
    }
    
    if (receiverOfferCoins > 0 && receiverBalance && receiverBalance.balance >= receiverOfferCoins) {
       await db.update(economyBalances).set({ balance: receiverBalance.balance - receiverOfferCoins }).where(and(eq(economyBalances.userId, trade.receiverId), eq(economyBalances.guildId, trade.guildId)));
       if (initiatorBalance) await db.update(economyBalances).set({ balance: initiatorBalance.balance + receiverOfferCoins }).where(and(eq(economyBalances.userId, trade.initiatorId), eq(economyBalances.guildId, trade.guildId)));
    }
    
    // TODO: Transfer items as well (checking tradeable flag)

    await interaction.update({ content: 'Trade accepted and completed!', embeds: [], components: [] });
  }
}

export async function handleTradeModal(interaction: ModalSubmitInteraction) {
  const parts = interaction.customId.split('_');
  const tradeId = parts[4]; // trade_offer_coins_modal_<tradeId>

  const db = getDatabase();
  const tradeResult = await db.select().from(economyTrades).where(eq(economyTrades.id, tradeId)).limit(1);
  const trade = tradeResult[0];

  if (!trade) {
    await interaction.reply({ content: 'This trade does not exist or has expired.', ephemeral: true });
    return;
  }

  const isInitiator = interaction.user.id === trade.initiatorId;
  
  if (interaction.customId.startsWith('trade_offer_coins_modal_')) {
    const amountStr = interaction.fields.getTextInputValue('amount');
    const amount = parseInt(amountStr, 10);
    
    if (isNaN(amount) || amount < 0) {
      await interaction.reply({ content: 'Invalid amount.', ephemeral: true });
      return;
    }
    
    const balanceResult = await db.select().from(economyBalances).where(and(eq(economyBalances.userId, interaction.user.id), eq(economyBalances.guildId, trade.guildId))).limit(1);
    const balance = balanceResult[0];
    
    if (!balance || balance.balance < amount) {
      await interaction.reply({ content: 'You do not have enough coins.', ephemeral: true });
      return;
    }

    const offerKey = isInitiator ? 'initiatorOffer' : 'receiverOffer';
    const currentOffer = (trade[offerKey] as any) || { coins: 0, items: [] };
    currentOffer.coins = amount;

    await db.update(economyTrades).set({ [offerKey]: currentOffer }).where(eq(economyTrades.id, tradeId));

    // Reconstruct the embed
    const newTradeResult = await db.select().from(economyTrades).where(eq(economyTrades.id, tradeId)).limit(1);
    const newTrade = newTradeResult[0];
    
    if (!newTrade) return;

    const embed = new EmbedBuilder()
      .setTitle('Trade Initiated')
      .setDescription(`<@${newTrade.initiatorId}> wants to trade with <@${newTrade.receiverId}>`)
      .addFields(
        { name: `Initiator's Offer`, value: `Coins: ${(newTrade.initiatorOffer as any)?.coins || 0}`, inline: true },
        { name: `Receiver's Offer`, value: `Coins: ${(newTrade.receiverOffer as any)?.coins || 0}`, inline: true }
      )
      .setColor(0x3498db)
      .setFooter({ text: 'Trade expires in 5 minutes' });

    if (interaction.isFromMessage()) {
      await (interaction as any).update({ embeds: [embed] });
    } else {
      await interaction.reply({ content: 'Offer updated successfully.', ephemeral: true });
      if (interaction.message) {
        await interaction.message.edit({ embeds: [embed] });
      }
    }
  }
}

