import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { CommandCategory } from '../../types/command';

// Import all economy command handlers
import { execute as balanceExecute } from './balance';
import { execute as dailyExecute } from './daily';
import { execute as workExecute } from './work';
import { execute as robExecute } from './rob';
import { execute as gambleExecute } from './gamble';
import { execute as shopExecute, autocomplete as shopAutocomplete } from './shop';

import {
  createLocalizationMap,
  commandDescriptions,
  subcommandDescriptions,
  optionDescriptions,
  choiceLocalizations,
} from '../../utils/localization';
import { t } from '../../i18n';

export const data = new SlashCommandBuilder()
  .setName('eco')
  .setDescription(t('commands.economy.description', { defaultValue: 'Economy system commands' }))
  .setDescriptionLocalizations(createLocalizationMap(commandDescriptions.economy))
  .addSubcommand(subcommand =>
    subcommand
      .setName('balance')
      .setDescription(t('commands.economy.subcommands.balance.description', { defaultValue: "Check your or another user's balance" }))
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.balance))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.economy.subcommands.balance.options.user', { defaultValue: 'The user to check balance for' }))
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.balanceUser))
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('daily')
      .setDescription(t('commands.economy.subcommands.daily.description', { defaultValue: 'Claim your daily reward' }))
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.daily))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('work')
      .setDescription(t('commands.economy.subcommands.work.description', { defaultValue: 'Work to earn money' }))
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.work))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('rob')
      .setDescription(t('commands.economy.subcommands.rob.description', { defaultValue: 'Attempt to rob another user' }))
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.rob))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.economy.subcommands.rob.options.user', { defaultValue: 'The user to rob' }))
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.robUser))
          .setRequired(true)
      )
  )
  .addSubcommandGroup(group =>
    group
      .setName('gamble')
      .setDescription(t('commands.economy.subcommands.gamble.description', { defaultValue: 'Gambling games' }))
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.gamble.group))
      .addSubcommand(subcommand =>
        subcommand
          .setName('dice')
          .setDescription(t('commands.economy.subcommands.gamble.dice.description', { defaultValue: 'Roll dice against the dealer' }))
          .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.gamble.dice))
          .addIntegerOption(option =>
            option
              .setName('bet')
              .setDescription(t('commands.economy.subcommands.gamble.options.bet', { defaultValue: 'Amount to bet' }))
              .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.bet))
              .setRequired(true)
              .setMinValue(1)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('coinflip')
          .setDescription(t('commands.economy.subcommands.gamble.coinflip.description', { defaultValue: 'Flip a coin' }))
          .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.gamble.coinflip))
          .addIntegerOption(option =>
            option
              .setName('bet')
              .setDescription(t('commands.economy.subcommands.gamble.options.bet', { defaultValue: 'Amount to bet' }))
              .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.bet))
              .setRequired(true)
              .setMinValue(1)
          )
          .addStringOption(option =>
            option
              .setName('choice')
              .setDescription(t('commands.economy.subcommands.gamble.coinflip.options.choice', { defaultValue: 'Heads or tails' }))
              .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.coinflipChoice))
              .setRequired(true)
              .addChoices(
                { name: 'Heads', value: 'heads', name_localizations: createLocalizationMap(choiceLocalizations.coinflip.heads) },
                { name: 'Tails', value: 'tails', name_localizations: createLocalizationMap(choiceLocalizations.coinflip.tails) }
              )
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('slots')
          .setDescription(t('commands.economy.subcommands.gamble.slots.description', { defaultValue: 'Play the slot machine' }))
          .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.gamble.slots))
          .addIntegerOption(option =>
            option
              .setName('bet')
              .setDescription(t('commands.economy.subcommands.gamble.options.bet', { defaultValue: 'Amount to bet' }))
              .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.bet))
              .setRequired(true)
              .setMinValue(1)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('blackjack')
          .setDescription(t('commands.economy.subcommands.gamble.blackjack.description', { defaultValue: 'Play blackjack against the dealer' }))
          .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.gamble.blackjack))
          .addIntegerOption(option =>
            option
              .setName('bet')
              .setDescription(t('commands.economy.subcommands.gamble.options.bet', { defaultValue: 'Amount to bet' }))
              .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.bet))
              .setRequired(true)
              .setMinValue(1)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('roulette')
          .setDescription(t('commands.economy.subcommands.gamble.roulette.description', { defaultValue: 'Play roulette' }))
          .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.gamble.roulette))
          .addIntegerOption(option =>
            option
              .setName('bet')
              .setDescription(t('commands.economy.subcommands.gamble.options.bet', { defaultValue: 'Amount to bet' }))
              .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.bet))
              .setRequired(true)
              .setMinValue(1)
          )
          .addStringOption(option =>
            option
              .setName('type')
              .setDescription(t('commands.economy.subcommands.gamble.roulette.options.type', { defaultValue: 'Type of bet' }))
              .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.rouletteType))
              .setRequired(true)
              .addChoices(
                { name: 'Red', value: 'color:red', name_localizations: createLocalizationMap(choiceLocalizations.roulette.red) },
                { name: 'Black', value: 'color:black', name_localizations: createLocalizationMap(choiceLocalizations.roulette.black) },
                { name: 'Even', value: 'even', name_localizations: createLocalizationMap(choiceLocalizations.roulette.even) },
                { name: 'Odd', value: 'odd', name_localizations: createLocalizationMap(choiceLocalizations.roulette.odd) },
                { name: 'Low (1-18)', value: 'low', name_localizations: createLocalizationMap(choiceLocalizations.roulette.low) },
                { name: 'High (19-36)', value: 'high', name_localizations: createLocalizationMap(choiceLocalizations.roulette.high) },
                { name: 'Specific Number', value: 'number', name_localizations: createLocalizationMap(choiceLocalizations.roulette.number) },
                { name: '1st Dozen', value: 'dozen:1', name_localizations: createLocalizationMap(choiceLocalizations.roulette.dozen1) },
                { name: '2nd Dozen', value: 'dozen:2', name_localizations: createLocalizationMap(choiceLocalizations.roulette.dozen2) },
                { name: '3rd Dozen', value: 'dozen:3', name_localizations: createLocalizationMap(choiceLocalizations.roulette.dozen3) }
              )
          )
          .addIntegerOption(option =>
            option
              .setName('number')
              .setDescription(t('commands.economy.subcommands.gamble.roulette.options.number', { defaultValue: 'Specific number to bet on (0-36)' }))
              .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.rouletteNumber))
              .setMinValue(0)
              .setMaxValue(36)
          )
      )
  )
  .addSubcommandGroup(group =>
    group
      .setName('shop')
      .setDescription(t('commands.economy.subcommands.shop.description', { defaultValue: 'Shop commands' }))
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.shop.group))
      .addSubcommand(subcommand =>
        subcommand
          .setName('view')
          .setDescription(t('commands.economy.subcommands.shop.view.description', { defaultValue: 'View available shop items' }))
          .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.shop.view))
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('buy')
          .setDescription(t('commands.economy.subcommands.shop.buy.description', { defaultValue: 'Purchase an item from the shop' }))
          .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.shop.buy))
          .addStringOption(option =>
            option
              .setName('item')
              .setDescription(t('commands.economy.subcommands.shop.buy.options.item', { defaultValue: 'The item to purchase' }))
              .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.buyItem))
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addIntegerOption(option =>
            option
              .setName('quantity')
              .setDescription(t('commands.economy.subcommands.shop.buy.options.quantity', { defaultValue: 'Quantity to purchase' }))
              .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.buyQuantity))
              .setMinValue(1)
              .setMaxValue(99)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('inventory')
          .setDescription(t('commands.economy.subcommands.shop.inventory.description', { defaultValue: 'View your purchased items' }))
          .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.shop.inventory))
      )
  );

export const category = CommandCategory.Economy;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  const group = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  if (group === 'gamble') {
    // Handle gambling subcommands
    await gambleExecute(interaction);
  } else if (group === 'shop') {
    // Handle shop subcommands
    await shopExecute(interaction);
  } else {
    // Handle direct subcommands
    switch (subcommand) {
      case 'balance':
        await balanceExecute(interaction);
        break;
      case 'daily':
        await dailyExecute(interaction);
        break;
      case 'work':
        await workExecute(interaction);
        break;
      case 'rob':
        await robExecute(interaction);
        break;
    }
  }
}

export async function autocomplete(interaction: ChatInputCommandInteraction) {
  const group = interaction.options.getSubcommandGroup();

  if (group === 'shop') {
    await shopAutocomplete(interaction);
  }
}
