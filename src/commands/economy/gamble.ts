import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CommandCategory } from '../../types/command';
import { economyGamblingService } from '../../services/economyGamblingService';
import { economyRepository } from '../../repositories/economyRepository';
import { embedBuilder } from '../../handlers/embedBuilder';
import { Validator, CommandSchemas } from '../../security/validator';
import { RateLimitError } from '../../security/errors';
import { auditLogger } from '../../security/audit';
import { logger } from '../../utils/logger';
import { t, getGuildLocale } from '../../i18n';
import {
  createLocalizationMap,
  subcommandDescriptions,
  optionDescriptions,
  choiceLocalizations,
} from '../../utils/localization';

export const isSubcommand = true;

import type {
  DiceResult,
  CoinflipResult,
  SlotsResult,
  BlackjackResult,
  RouletteResult,
} from '../../services/economyGamblingService';

export const data = new SlashCommandBuilder()
  .setName('gamble')
  .setDescription(
    t('commands.economy.subcommands.gamble.description', {
      defaultValue: 'Play various gambling games',
    })
  )
  .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.gamble.group))
  .addSubcommand(subcommand =>
    subcommand
      .setName('dice')
      .setDescription(
        t('commands.economy.subcommands.gamble.dice.description', {
          defaultValue: 'Roll dice against the dealer',
        })
      )
      .setDescriptionLocalizations(
        createLocalizationMap(subcommandDescriptions.economy.gamble.dice)
      )
      .addIntegerOption(option =>
        option
          .setName('bet')
          .setDescription(
            t('commands.economy.subcommands.gamble.options.bet', { defaultValue: 'Amount to bet' })
          )
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.bet))
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('coinflip')
      .setDescription(
        t('commands.economy.subcommands.gamble.coinflip.description', {
          defaultValue: 'Flip a coin',
        })
      )
      .setDescriptionLocalizations(
        createLocalizationMap(subcommandDescriptions.economy.gamble.coinflip)
      )
      .addIntegerOption(option =>
        option
          .setName('bet')
          .setDescription(
            t('commands.economy.subcommands.gamble.options.bet', { defaultValue: 'Amount to bet' })
          )
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.bet))
          .setRequired(true)
          .setMinValue(1)
      )
      .addStringOption(option =>
        option
          .setName('choice')
          .setDescription(
            t('commands.economy.subcommands.gamble.coinflip.options.choice', {
              defaultValue: 'Heads or tails',
            })
          )
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.coinflipChoice))
          .setRequired(true)
          .addChoices(
            {
              name: 'Heads',
              value: 'heads',
              name_localizations: createLocalizationMap(choiceLocalizations.coinflip.heads),
            },
            {
              name: 'Tails',
              value: 'tails',
              name_localizations: createLocalizationMap(choiceLocalizations.coinflip.tails),
            }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('slots')
      .setDescription(
        t('commands.economy.subcommands.gamble.slots.description', {
          defaultValue: 'Play the slot machine',
        })
      )
      .setDescriptionLocalizations(
        createLocalizationMap(subcommandDescriptions.economy.gamble.slots)
      )
      .addIntegerOption(option =>
        option
          .setName('bet')
          .setDescription(
            t('commands.economy.subcommands.gamble.options.bet', { defaultValue: 'Amount to bet' })
          )
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.bet))
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('blackjack')
      .setDescription(
        t('commands.economy.subcommands.gamble.blackjack.description', {
          defaultValue: 'Play blackjack against the dealer',
        })
      )
      .setDescriptionLocalizations(
        createLocalizationMap(subcommandDescriptions.economy.gamble.blackjack)
      )
      .addIntegerOption(option =>
        option
          .setName('bet')
          .setDescription(
            t('commands.economy.subcommands.gamble.options.bet', { defaultValue: 'Amount to bet' })
          )
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.bet))
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('roulette')
      .setDescription(
        t('commands.economy.subcommands.gamble.roulette.description', {
          defaultValue: 'Play roulette',
        })
      )
      .setDescriptionLocalizations(
        createLocalizationMap(subcommandDescriptions.economy.gamble.roulette)
      )
      .addIntegerOption(option =>
        option
          .setName('bet')
          .setDescription(
            t('commands.economy.subcommands.gamble.options.bet', { defaultValue: 'Amount to bet' })
          )
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.bet))
          .setRequired(true)
          .setMinValue(1)
      )
      .addStringOption(option =>
        option
          .setName('type')
          .setDescription(
            t('commands.economy.subcommands.gamble.roulette.options.type', {
              defaultValue: 'Type of bet',
            })
          )
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.rouletteType))
          .setRequired(true)
          .addChoices(
            {
              name: 'Red',
              value: 'color:red',
              name_localizations: createLocalizationMap(choiceLocalizations.roulette.red),
            },
            {
              name: 'Black',
              value: 'color:black',
              name_localizations: createLocalizationMap(choiceLocalizations.roulette.black),
            },
            {
              name: 'Even',
              value: 'even',
              name_localizations: createLocalizationMap(choiceLocalizations.roulette.even),
            },
            {
              name: 'Odd',
              value: 'odd',
              name_localizations: createLocalizationMap(choiceLocalizations.roulette.odd),
            },
            {
              name: 'Low (1-18)',
              value: 'low',
              name_localizations: createLocalizationMap(choiceLocalizations.roulette.low),
            },
            {
              name: 'High (19-36)',
              value: 'high',
              name_localizations: createLocalizationMap(choiceLocalizations.roulette.high),
            },
            {
              name: 'Specific Number',
              value: 'number',
              name_localizations: createLocalizationMap(choiceLocalizations.roulette.number),
            },
            {
              name: '1st Dozen',
              value: 'dozen:1',
              name_localizations: createLocalizationMap(choiceLocalizations.roulette.dozen1),
            },
            {
              name: '2nd Dozen',
              value: 'dozen:2',
              name_localizations: createLocalizationMap(choiceLocalizations.roulette.dozen2),
            },
            {
              name: '3rd Dozen',
              value: 'dozen:3',
              name_localizations: createLocalizationMap(choiceLocalizations.roulette.dozen3),
            }
          )
      )
      .addIntegerOption(option =>
        option
          .setName('number')
          .setDescription(
            t('commands.economy.subcommands.gamble.roulette.options.number', {
              defaultValue: 'Specific number to bet on (0-36)',
            })
          )
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.rouletteNumber))
          .setMinValue(0)
          .setMaxValue(36)
      )
  );

export const category = CommandCategory.Economy;
export const cooldown = 3;

// Additional validation schema for gambling-specific checks
const gamblingSchema = CommandSchemas.economy.gamble;

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const subcommand = interaction.options.getSubcommand();
  const bet = interaction.options.getInteger('bet', true);
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;
  const locale = interaction.guildId
    ? getGuildLocale(interaction.guildId)
    : (interaction.locale ?? 'en');

  try {
    // Validate gambling input
    Validator.validate(gamblingSchema, {
      amount: bet,
      game: subcommand as any,
    });

    // Additional security check for gambling addiction protection
    const recentGambles = await economyRepository.getRecentGambles(userId, guildId, 3600); // Last hour
    if (recentGambles >= 10) {
      throw new RateLimitError(
        t('commands.economy.gamble.rateLimited', {
          lng: locale,
        }) || 'You have been gambling too frequently. Please take a break and try again later.',
        3600
      );
    }

    const settings = await economyRepository.ensureSettings(guildId);

    // Check balance before allowing bet
    const userBalance = await economyRepository.getBalance(userId, guildId);
    if (!userBalance || userBalance.balance < bet) {
      await interaction.editReply({
        embeds: [
          embedBuilder.createErrorEmbed(
            t('commands.economy.gamble.insufficientFunds', {
              lng: locale,
              amount: `${settings.currencySymbol}${(userBalance?.balance || 0).toLocaleString()}`,
            })
          ),
        ],
      });
      return;
    }

    if (bet < settings.minBet || bet > settings.maxBet) {
      await interaction.editReply({
        embeds: [
          embedBuilder.createErrorEmbed(
            t('commands.economy.gamble.invalidBet', {
              lng: locale,
              symbol: settings.currencySymbol,
              min: settings.minBet.toLocaleString(),
              max: settings.maxBet.toLocaleString(),
            })
          ),
        ],
      });
      return;
    }

    // Log gambling attempt for security monitoring
    await auditLogger.logAction({
      action: 'ECONOMY_GAMBLE_ATTEMPT',
      userId,
      guildId,
      details: {
        game: subcommand,
        amount: bet,
        balance: userBalance?.balance || 0,
      },
    });

    let result;
    let embed: EmbedBuilder;

    switch (subcommand) {
      case 'dice':
        result = await economyGamblingService.playDice(userId, guildId, bet);
        embed = createDiceEmbed(result, settings, locale);
        break;

      case 'coinflip':
        const choice = interaction.options.getString('choice', true) as 'heads' | 'tails';
        result = await economyGamblingService.playCoinflip(userId, guildId, bet, choice);
        embed = createCoinflipEmbed(result, settings, locale);
        break;

      case 'slots':
        result = await economyGamblingService.playSlots(userId, guildId, bet);
        embed = createSlotsEmbed(result, settings, locale);
        break;

      case 'blackjack':
        result = await economyGamblingService.playBlackjack(userId, guildId, bet);
        embed = createBlackjackEmbed(result, settings, locale, interaction.user.displayAvatarURL());
        break;

      case 'roulette':
        const betType = interaction.options.getString('type', true);
        let rouletteBetType: string;
        let betValue: string | number | undefined;

        if (betType.startsWith('color:')) {
          rouletteBetType = 'color';
          betValue = betType.split(':')[1];
        } else if (betType.startsWith('dozen:')) {
          rouletteBetType = 'dozen';
          betValue = betType.split(':')[1];
        } else if (betType === 'number') {
          rouletteBetType = 'number';
          const numberBet = interaction.options.getInteger('number');
          if (numberBet === null) {
            await interaction.editReply({
              embeds: [
                embedBuilder.createErrorEmbed(
                  t('commands.economy.gamble.roulette.numberRequired', { lng: locale })
                ),
              ],
            });
            return;
          }
          betValue = numberBet;
        } else {
          rouletteBetType = betType;
        }

        result = await economyGamblingService.playRoulette(
          userId,
          guildId,
          bet,
          rouletteBetType,
          betValue
        );
        embed = createRouletteEmbed(result, settings, locale);
        break;

      default:
        await interaction.editReply({
          embeds: [
            embedBuilder.createErrorEmbed(
              t('commands.economy.gamble.invalidGame', {
                defaultValue: 'Invalid gambling game',
                lng: locale,
              })
            ),
          ],
        });
        return;
    }

    // Log gambling result for security monitoring
    await auditLogger.logAction({
      action: 'ECONOMY_GAMBLE_RESULT',
      userId,
      guildId,
      details: {
        game: subcommand,
        bet,
        profit: result.profit,
        newBalance: result.balance.balance,
        won: result.profit > 0,
      },
    });

    // Check for suspicious winning patterns
    if (result.profit > bet * 10) {
      await auditLogger.logAction({
        action: 'ECONOMY_SUSPICIOUS_WIN',
        userId,
        guildId,
        details: {
          game: subcommand,
          bet,
          profit: result.profit,
          multiplier: result.profit / bet,
        },
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    logger.error('Error in gamble command:', error);

    // Don't expose internal errors to users
    const userMessage =
      error instanceof RateLimitError
        ? error.message
        : t('commands.economy.gamble.error', {
            defaultValue: 'Failed to process gambling game. Please try again later.',
            lng: locale,
          });

    await interaction.editReply({
      embeds: [embedBuilder.createErrorEmbed(userMessage)],
    });
  }
}

function createDiceEmbed(result: any, settings: any, locale: string): EmbedBuilder {
  const details = result.details as DiceResult;
  const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const descriptionKey = details.tie
    ? 'commands.economy.gamble.dice.tie'
    : details.won
      ? 'commands.economy.gamble.dice.won'
      : 'commands.economy.gamble.dice.lost';

  return new EmbedBuilder()
    .setTitle(t('commands.economy.gamble.dice.title', { lng: locale }))
    .setDescription(t(descriptionKey, { lng: locale }))
    .setColor(details.won ? 0x2ecc71 : details.tie ? 0xf39c12 : 0xe74c3c)
    .addFields(
      {
        name: t('commands.economy.gamble.dice.yourRoll', { lng: locale }),
        value: `${diceEmojis[details.playerRoll - 1]} ${details.playerRoll}`,
        inline: true,
      },
      {
        name: t('commands.economy.gamble.dice.dealerRoll', { lng: locale }),
        value: `${diceEmojis[details.dealerRoll - 1]} ${details.dealerRoll}`,
        inline: true,
      },
      {
        name: t('commands.economy.gamble.dice.result', { lng: locale }),
        value:
          result.profit > 0
            ? `${t('commands.economy.gamble.dice.resultWon', { defaultValue: 'Won', lng: locale })} ${settings.currencySymbol}${result.profit.toLocaleString()}`
            : result.profit === 0
              ? t('commands.economy.gamble.dice.resultPush', { defaultValue: 'Push', lng: locale })
              : `${t('commands.economy.gamble.dice.resultLost', { defaultValue: 'Lost', lng: locale })} ${settings.currencySymbol}${Math.abs(result.profit).toLocaleString()}`,
        inline: true,
      },
      {
        name: t('commands.economy.gamble.common.newBalance', { lng: locale }),
        value: `${settings.currencySymbol}${result.balance.balance.toLocaleString()}`,
        inline: true,
      }
    )
    .setFooter({
      text: t('commands.economy.gamble.stats.winRate', {
        lng: locale,
        rate: ((result.stats.gamesWon / result.stats.gamesPlayed) * 100).toFixed(1),
        streak: result.stats.currentStreak,
      }),
    })
    .setTimestamp();
}

function createCoinflipEmbed(result: any, settings: any, locale: string): EmbedBuilder {
  const details = result.details as CoinflipResult;

  return new EmbedBuilder()
    .setTitle(t('commands.economy.gamble.coinflip.title', { lng: locale }))
    .setDescription(
      t('commands.economy.gamble.coinflip.landed', {
        lng: locale,
        result: details.result,
      })
    )
    .setColor(details.won ? 0x2ecc71 : 0xe74c3c)
    .addFields(
      {
        name: t('commands.economy.gamble.common.yourChoice', { lng: locale }),
        value: details.choice.charAt(0).toUpperCase() + details.choice.slice(1),
        inline: true,
      },
      {
        name: t('commands.economy.gamble.coinflip.resultField', { lng: locale }),
        value: details.result.charAt(0).toUpperCase() + details.result.slice(1),
        inline: true,
      },
      {
        name: details.won
          ? t('commands.economy.gamble.common.wonLabel', { lng: locale })
          : t('commands.economy.gamble.common.lostLabel', { lng: locale }),
        value: `${settings.currencySymbol}${Math.abs(result.profit).toLocaleString()}`,
        inline: true,
      },
      {
        name: t('commands.economy.gamble.common.newBalance', { lng: locale }),
        value: `${settings.currencySymbol}${result.balance.balance.toLocaleString()}`,
        inline: true,
      }
    )
    .setFooter({
      text: t('commands.economy.gamble.stats.winRate', {
        lng: locale,
        rate: ((result.stats.gamesWon / result.stats.gamesPlayed) * 100).toFixed(1),
        streak: result.stats.currentStreak,
      }),
    })
    .setTimestamp();
}

function createSlotsEmbed(result: any, settings: any, locale: string): EmbedBuilder {
  const details = result.details as SlotsResult;

  const embed = new EmbedBuilder()
    .setTitle(t('commands.economy.gamble.slots.title', { lng: locale }))
    .setDescription(`**${details.reels.join(' | ')}**`)
    .setColor(details.won ? 0x2ecc71 : 0xe74c3c)
    .addFields(
      {
        name: t('commands.economy.gamble.common.result', { lng: locale }),
        value: details.won
          ? details.winType === 'jackpot'
            ? t('commands.economy.gamble.slots.jackpot', { lng: locale })
            : details.winType === 'triple'
              ? t('commands.economy.gamble.slots.triple', { lng: locale })
              : t('commands.economy.gamble.slots.double', { lng: locale })
          : t('commands.economy.gamble.slots.noMatch', { lng: locale }),
        inline: true,
      },
      {
        name: details.won
          ? t('commands.economy.gamble.common.wonLabel', { lng: locale })
          : t('commands.economy.gamble.common.lostLabel', { lng: locale }),
        value: `${settings.currencySymbol}${Math.abs(result.profit).toLocaleString()}`,
        inline: true,
      },
      {
        name: t('commands.economy.gamble.common.newBalance', { lng: locale }),
        value: `${settings.currencySymbol}${result.balance.balance.toLocaleString()}`,
        inline: true,
      }
    )
    .setFooter({
      text: t('commands.economy.gamble.stats.bestWin', {
        lng: locale,
        rate: ((result.stats.gamesWon / result.stats.gamesPlayed) * 100).toFixed(1),
        symbol: settings.currencySymbol,
        amount: result.stats.biggestWin,
      }),
    })
    .setTimestamp();

  if (details.winType === 'jackpot') {
    embed.addFields({
      name: t('commands.economy.gamble.slots.jackpotWin', { lng: locale }),
      value: t('commands.economy.gamble.slots.jackpotText', {
        lng: locale,
        multiplier: details.multiplier,
      }),
      inline: false,
    });
  }

  return embed;
}

function createBlackjackEmbed(
  result: any,
  settings: any,
  locale: string,
  avatarUrl: string
): EmbedBuilder {
  const details = result.details as BlackjackResult;

  const formatHand = (hand: any) => {
    return hand.cards.map((c: any) => `${c.rank}${c.suit}`).join(' ');
  };

  const embed = new EmbedBuilder()
    .setTitle(t('commands.economy.gamble.blackjack.title', { lng: locale }))
    .setThumbnail(avatarUrl)
    .setColor(details.won ? 0x2ecc71 : details.push ? 0xf39c12 : 0xe74c3c)
    .addFields(
      {
        name: t('commands.economy.gamble.blackjack.yourHand', { lng: locale }),
        value: `${formatHand(details.playerHand)}\n${t('commands.economy.gamble.blackjack.value', {
          lng: locale,
          value: details.playerHand.value,
        })}${details.playerHand.blackjack ? t('commands.economy.gamble.blackjack.blackjack', { lng: locale }) : ''}${
          details.playerHand.bust
            ? t('commands.economy.gamble.blackjack.bust', { lng: locale })
            : ''
        }`,
        inline: true,
      },
      {
        name: t('commands.economy.gamble.blackjack.dealerHand', { lng: locale }),
        value: `${formatHand(details.dealerHand)}\n${t('commands.economy.gamble.blackjack.value', {
          lng: locale,
          value: details.dealerHand.value,
        })}${details.dealerHand.blackjack ? t('commands.economy.gamble.blackjack.blackjack', { lng: locale }) : ''}${
          details.dealerHand.bust
            ? t('commands.economy.gamble.blackjack.bust', { lng: locale })
            : ''
        }`,
        inline: true,
      },
      {
        name: t('commands.economy.gamble.common.result', { lng: locale }),
        value: details.push
          ? t('commands.economy.gamble.blackjack.push', { lng: locale })
          : details.won
            ? t('commands.economy.gamble.blackjack.result.win', { lng: locale })
            : t('commands.economy.gamble.blackjack.result.loss', { lng: locale }),
        inline: false,
      },
      {
        name: details.won
          ? t('commands.economy.gamble.common.wonLabel', { lng: locale })
          : details.push
            ? t('commands.economy.gamble.blackjack.returned', { lng: locale })
            : t('commands.economy.gamble.common.lostLabel', { lng: locale }),
        value: `${settings.currencySymbol}${Math.abs(result.profit).toLocaleString()}`,
        inline: true,
      },
      {
        name: t('commands.economy.gamble.common.newBalance', { lng: locale }),
        value: `${settings.currencySymbol}${result.balance.balance.toLocaleString()}`,
        inline: true,
      }
    )
    .setFooter({
      text: t('commands.economy.gamble.stats.gamesPlayed', {
        lng: locale,
        rate: ((result.stats.gamesWon / result.stats.gamesPlayed) * 100).toFixed(1),
        games: result.stats.gamesPlayed,
      }),
    })
    .setTimestamp();

  if (details.blackjack && details.won) {
    embed.setDescription(t('commands.economy.gamble.blackjack.blackjackWin', { lng: locale }));
  }

  return embed;
}

function createRouletteEmbed(result: any, settings: any, locale: string): EmbedBuilder {
  const details = result.details as RouletteResult;
  const colorEmoji = details.color === 'red' ? '🔴' : details.color === 'black' ? '⚫' : '🟢';

  const embed = new EmbedBuilder()
    .setTitle(t('commands.economy.gamble.roulette.title', { lng: locale }))
    .setDescription(
      t('commands.economy.gamble.roulette.landed', {
        lng: locale,
        emoji: colorEmoji,
        number: details.number,
      })
    )
    .setColor(details.won ? 0x2ecc71 : 0xe74c3c)
    .addFields(
      {
        name: t('commands.economy.gamble.roulette.yourBet', { lng: locale }),
        value: `${details.betType.charAt(0).toUpperCase() + details.betType.slice(1)}`,
        inline: true,
      },
      {
        name: t('commands.economy.gamble.common.result', { lng: locale }),
        value: `${details.number} (${details.color})`,
        inline: true,
      },
      {
        name: details.won
          ? t('commands.economy.gamble.common.wonLabel', { lng: locale })
          : t('commands.economy.gamble.common.lostLabel', { lng: locale }),
        value: `${settings.currencySymbol}${Math.abs(result.profit).toLocaleString()}`,
        inline: true,
      },
      {
        name: t('commands.economy.gamble.common.multiplier', { lng: locale }),
        value: `${details.multiplier}x`,
        inline: true,
      },
      {
        name: t('commands.economy.gamble.common.newBalance', { lng: locale }),
        value: `${settings.currencySymbol}${result.balance.balance.toLocaleString()}`,
        inline: true,
      }
    )
    .setFooter({
      text: t('commands.economy.gamble.stats.totalWagered', {
        lng: locale,
        rate: ((result.stats.gamesWon / result.stats.gamesPlayed) * 100).toFixed(1),
        symbol: settings.currencySymbol,
        amount: result.stats.totalWagered,
      }),
    })
    .setTimestamp();

  return embed;
}
