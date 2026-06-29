import { economyService } from './economyService';
import type { GamblingResult } from './economyService';
import { t } from '../i18n';

export interface DiceResult {
  playerRoll: number;
  dealerRoll: number;
  won: boolean;
  tie: boolean;
}

export interface CoinflipResult {
  choice: 'heads' | 'tails';
  result: 'heads' | 'tails';
  won: boolean;
}

export interface SlotsResult {
  reels: string[];
  won: boolean;
  winType?: 'jackpot' | 'triple' | 'double';
  multiplier: number;
}

export interface BlackjackHand {
  cards: Card[];
  value: number;
  soft: boolean;
  blackjack: boolean;
  bust: boolean;
}

export interface BlackjackResult {
  playerHand: BlackjackHand;
  dealerHand: BlackjackHand;
  won: boolean;
  push: boolean;
  blackjack: boolean;
  multiplier: number;
}

export interface RouletteResult {
  number: number;
  color: 'red' | 'black' | 'green';
  won: boolean;
  betType: string;
  multiplier: number;
}

interface Card {
  suit: string;
  rank: string;
  value: number;
}

export class EconomyGamblingService {
  private readonly slotEmojis = ['🍎', '🍊', '🍇', '🍒', '💎', '7️⃣'];
  private readonly rouletteRed = [
    1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
  ];

  // Dice game - roll against dealer
  async playDice(userId: string, guildId: string, bet: number): Promise<GamblingResult> {
    const canAfford = await economyService.canAffordBet(userId, guildId, bet);
    if (!canAfford.canAfford) {
      throw new Error(t('commands.economy.errors.insufficientFunds'));
    }

    const playerRoll = Math.floor(Math.random() * 6) + 1;
    const dealerRoll = Math.floor(Math.random() * 6) + 1;

    const tie = playerRoll === dealerRoll;
    const won = playerRoll > dealerRoll;
    const multiplier = tie ? 1 : won ? 2 : 0; // Push on tie

    const details: DiceResult = {
      playerRoll,
      dealerRoll,
      won,
      tie,
    };

    return await economyService.processGamble(
      userId,
      guildId,
      'dice',
      bet,
      won || tie,
      multiplier,
      details as unknown as Record<string, unknown>
    );
  }

  // Coinflip game
  async playCoinflip(
    userId: string,
    guildId: string,
    bet: number,
    choice: 'heads' | 'tails'
  ): Promise<GamblingResult> {
    const canAfford = await economyService.canAffordBet(userId, guildId, bet);
    if (!canAfford.canAfford) {
      throw new Error(t('commands.economy.errors.insufficientFunds'));
    }

    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = result === choice;
    const multiplier = won ? 2 : 0;

    const details: CoinflipResult = {
      choice,
      result,
      won,
    };

    return await economyService.processGamble(
      userId,
      guildId,
      'coinflip',
      bet,
      won,
      multiplier,
      details as unknown as Record<string, unknown>
    );
  }

  // Slots game
  async playSlots(userId: string, guildId: string, bet: number): Promise<GamblingResult> {
    const canAfford = await economyService.canAffordBet(userId, guildId, bet);
    if (!canAfford.canAfford) {
      throw new Error(t('commands.economy.errors.insufficientFunds'));
    }

    // Generate 3 random slot symbols
    const reels = [
      this.slotEmojis[Math.floor(Math.random() * this.slotEmojis.length)],
      this.slotEmojis[Math.floor(Math.random() * this.slotEmojis.length)],
      this.slotEmojis[Math.floor(Math.random() * this.slotEmojis.length)],
    ];

    // Check for wins
    let won = false;
    let winType: 'jackpot' | 'triple' | 'double' | undefined;
    let multiplier = 0;

    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      // Triple match
      won = true;
      if (reels[0] === '7️⃣') {
        winType = 'jackpot';
        multiplier = 10;
      } else if (reels[0] === '💎') {
        winType = 'triple';
        multiplier = 5;
      } else {
        winType = 'triple';
        multiplier = 3;
      }
    } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
      // Double match
      won = true;
      winType = 'double';
      multiplier = 1.5;
    }

    const details: SlotsResult = {
      reels,
      won,
      winType,
      multiplier,
    };

    return await economyService.processGamble(
      userId,
      guildId,
      'slots',
      bet,
      won,
      multiplier,
      details as unknown as Record<string, unknown>
    );
  }

  // Blackjack game
  async playBlackjack(userId: string, guildId: string, bet: number): Promise<GamblingResult> {
    const canAfford = await economyService.canAffordBet(userId, guildId, bet);
    if (!canAfford.canAfford) {
      throw new Error(t('commands.economy.errors.insufficientFunds'));
    }

    const deck = this.createDeck();
    this.shuffleDeck(deck);

    // Deal initial cards
    const playerCard1 = deck.pop();
    const playerCard2 = deck.pop();
    const dealerCard1 = deck.pop();
    const dealerCard2 = deck.pop();

    if (!playerCard1 || !playerCard2 || !dealerCard1 || !dealerCard2) {
      throw new Error(t('common.error'));
    }

    const playerHand: Card[] = [playerCard1, playerCard2];
    const dealerHand: Card[] = [dealerCard1, dealerCard2];

    // Simple AI: dealer hits on 16 or less, stands on 17+
    while (this.calculateHandValue(dealerHand).value < 17) {
      const card = deck.pop();
      if (!card) break; // Safety check
      dealerHand.push(card);
    }

    // For simplicity, auto-play optimal strategy for player
    while (
      this.calculateHandValue(playerHand).value < 17 &&
      !this.calculateHandValue(playerHand).bust
    ) {
      const handValue = this.calculateHandValue(playerHand);
      const dealerUpCard = dealerHand[0].value === 1 ? 11 : dealerHand[0].value;

      // Basic strategy
      if (handValue.value < 12) {
        const card = deck.pop();
        if (!card) break; // Safety check
        playerHand.push(card);
      } else if (handValue.value < 17 && dealerUpCard >= 7) {
        const card = deck.pop();
        if (!card) break; // Safety check
        playerHand.push(card);
      } else {
        break;
      }
    }

    const playerHandResult = this.calculateHandValue(playerHand);
    const dealerHandResult = this.calculateHandValue(dealerHand);

    let won = false;
    let push = false;
    let multiplier = 0;

    if (playerHandResult.bust) {
      won = false;
    } else if (dealerHandResult.bust) {
      won = true;
      multiplier = 2;
    } else if (playerHandResult.blackjack && !dealerHandResult.blackjack) {
      won = true;
      multiplier = 2.5; // Blackjack pays 3:2
    } else if (!playerHandResult.blackjack && dealerHandResult.blackjack) {
      won = false;
    } else if (playerHandResult.value === dealerHandResult.value) {
      push = true;
      multiplier = 1; // Return bet
    } else if (playerHandResult.value > dealerHandResult.value) {
      won = true;
      multiplier = 2;
    }

    const details: BlackjackResult = {
      playerHand: { ...playerHandResult, cards: playerHand },
      dealerHand: { ...dealerHandResult, cards: dealerHand },
      won,
      push,
      blackjack: playerHandResult.blackjack,
      multiplier,
    };

    return await economyService.processGamble(
      userId,
      guildId,
      'blackjack',
      bet,
      won || push,
      multiplier,
      details as unknown as Record<string, unknown>
    );
  }

  // Roulette game
  async playRoulette(
    userId: string,
    guildId: string,
    bet: number,
    betType: string,
    betValue?: string | number
  ): Promise<GamblingResult> {
    const canAfford = await economyService.canAffordBet(userId, guildId, bet);
    if (!canAfford.canAfford) {
      throw new Error(t('commands.economy.errors.insufficientFunds'));
    }

    const number = Math.floor(Math.random() * 37); // 0-36
    const color = number === 0 ? 'green' : this.rouletteRed.includes(number) ? 'red' : 'black';

    let won = false;
    let multiplier = 0;

    switch (betType) {
      case 'number':
        won = number === Number(betValue);
        multiplier = won ? 36 : 0; // 35:1 payout
        break;
      case 'color':
        won = color === betValue;
        multiplier = won ? 2 : 0; // 1:1 payout
        break;
      case 'even':
        won = number !== 0 && number % 2 === 0;
        multiplier = won ? 2 : 0;
        break;
      case 'odd':
        won = number !== 0 && number % 2 === 1;
        multiplier = won ? 2 : 0;
        break;
      case 'low':
        won = number >= 1 && number <= 18;
        multiplier = won ? 2 : 0;
        break;
      case 'high':
        won = number >= 19 && number <= 36;
        multiplier = won ? 2 : 0;
        break;
      case 'dozen': {
        const dozen = Number(betValue);
        if (dozen === 1) won = number >= 1 && number <= 12;
        else if (dozen === 2) won = number >= 13 && number <= 24;
        else if (dozen === 3) won = number >= 25 && number <= 36;
        multiplier = won ? 3 : 0; // 2:1 payout
        break;
      }
    }

    const details: RouletteResult = {
      number,
      color,
      won,
      betType,
      multiplier,
    };

    return await economyService.processGamble(
      userId,
      guildId,
      'roulette',
      bet,
      won,
      multiplier,
      details as unknown as Record<string, unknown>
    );
  }

  // Helper methods for blackjack
  private createDeck(): Card[] {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck: Card[] = [];

    for (const suit of suits) {
      for (const rank of ranks) {
        let value = parseInt(rank);
        if (isNaN(value)) {
          value = rank === 'A' ? 1 : 10;
        }
        deck.push({ suit, rank, value });
      }
    }

    return deck;
  }

  private shuffleDeck(deck: Card[]): void {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  private calculateHandValue(hand: Card[]): Omit<BlackjackHand, 'cards'> {
    let value = 0;
    let aces = 0;

    for (const card of hand) {
      value += card.value;
      if (card.rank === 'A') aces++;
    }

    // Handle aces
    while (aces > 0 && value + 10 <= 21) {
      value += 10;
      aces--;
    }

    const soft = aces > 0;
    const bust = value > 21;
    const blackjack = hand.length === 2 && value === 21;

    return { value, soft, blackjack, bust };
  }
}

// Export singleton instance
export const economyGamblingService = new EconomyGamblingService();
