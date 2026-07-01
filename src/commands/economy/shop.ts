import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ButtonInteraction,
} from 'discord.js';
import { CommandCategory } from '../../types/command';
import { economyService } from '../../services/economyService';
import { economyRepository } from '../../repositories/economyRepository';
import { embedBuilder } from '../../handlers/embedBuilder';
import { logger } from '../../utils/logger';

export const isSubcommand = true;
import { t, getGuildLocale } from '../../i18n';
import {
  createLocalizationMap,
  subcommandDescriptions,
  optionDescriptions,
} from '../../utils/localization';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription(
    t('commands.economy.subcommands.shop.description', {
      defaultValue: 'View and purchase items from the shop',
    })
  )
  .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.shop.group))
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription(
        t('commands.economy.subcommands.shop.view.description', {
          defaultValue: 'View available shop items',
        })
      )
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.shop.view))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('buy')
      .setDescription(
        t('commands.economy.subcommands.shop.buy.description', {
          defaultValue: 'Purchase an item from the shop',
        })
      )
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.economy.shop.buy))
      .addStringOption(option =>
        option
          .setName('item')
          .setDescription(
            t('commands.economy.subcommands.shop.buy.options.item', {
              defaultValue: 'The item to purchase',
            })
          )
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.buyItem))
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addIntegerOption(option =>
        option
          .setName('quantity')
          .setDescription(
            t('commands.economy.subcommands.shop.buy.options.quantity', {
              defaultValue: 'Quantity to purchase',
            })
          )
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.buyQuantity))
          .setMinValue(1)
          .setMaxValue(99)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('inventory')
      .setDescription(
        t('commands.economy.subcommands.shop.inventory.description', {
          defaultValue: 'View your purchased items',
        })
      )
      .setDescriptionLocalizations(
        createLocalizationMap(subcommandDescriptions.economy.shop.inventory)
      )
  );

export const category = CommandCategory.Economy;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'view':
      await handleViewShop(interaction);
      break;
    case 'buy':
      await handleBuyItem(interaction);
      break;
    case 'inventory':
      await handleViewInventory(interaction);
      break;
  }
}

async function handleViewShop(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const locale = getGuildLocale(guildId);

  try {
    const items = await economyRepository.getShopItems(guildId, true);
    const settings = await economyRepository.ensureSettings(guildId);
    const balance = await economyService.getOrCreateBalance(userId, guildId);

    if (items.length === 0) {
      // Create default shop items if none exist
      await createDefaultShopItems(guildId);
      const newItems = await economyRepository.getShopItems(guildId, true);

      if (newItems.length === 0) {
        await interaction.editReply({
          embeds: [
            embedBuilder.createErrorEmbed(t('commands.economy.shop.view.empty', { lng: locale })),
          ],
        });
        return;
      }

      items.push(...newItems);
    }

    const itemsPerPage = 5;
    let currentPage = 0;
    const totalPages = Math.ceil(items.length / itemsPerPage);

    const createShopEmbed = (page: number) => {
      const start = page * itemsPerPage;
      const pageItems = items.slice(start, start + itemsPerPage);

      const embed = new EmbedBuilder()
        .setTitle(
          t('commands.economy.shop.view.title', { lng: locale, symbol: settings.currencySymbol })
        )
        .setDescription(
          t('commands.economy.shop.view.balance', {
            lng: locale,
            symbol: settings.currencySymbol,
            amount: balance.balance.toLocaleString(),
          })
        )
        .setColor(0x3498db)
        .setFooter({
          text: t('commands.economy.shop.view.page', {
            lng: locale,
            current: page + 1,
            total: totalPages,
          }),
        })
        .setTimestamp();

      pageItems.forEach((item, index) => {
        const stockText =
          item.stock === -1
            ? t('commands.economy.shop.view.unlimited', { lng: locale })
            : t('commands.economy.shop.view.left', { lng: locale, amount: item.stock });
        const affordableEmoji = balance.balance >= item.price ? '✅' : '❌';

        embed.addFields({
          name: `${affordableEmoji} ${start + index + 1}. ${item.name}`,
          value: `${item.description}\n**${t('commands.economy.shop.view.price', { lng: locale })}:** ${settings.currencySymbol}${item.price.toLocaleString()} | **${t('commands.economy.shop.view.stock', { lng: locale })}:** ${stockText}${
            item.effectType
              ? `\n**${t('commands.economy.shop.view.effect', { lng: locale })}:** ${formatEffect(item.effectType, item.effectValue, locale)}`
              : ''
          }`,
          inline: false,
        });
      });

      return embed;
    };

    const createButtons = (page: number) => {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('shop_first')
          .setLabel('⏮️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('shop_prev')
          .setLabel('◀️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('shop_refresh')
          .setLabel('🔄')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('shop_next')
          .setLabel('▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages - 1),
        new ButtonBuilder()
          .setCustomId('shop_last')
          .setLabel('⏭️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages - 1)
      );
    };

    const message = await interaction.editReply({
      embeds: [createShopEmbed(currentPage)],
      components: totalPages > 1 ? [createButtons(currentPage)] : [],
    });

    if (totalPages > 1) {
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000, // 5 minutes
      });

      collector.on('collect', async (i: ButtonInteraction) => {
        if (i.user.id !== userId) {
          await i.reply({
            content: t('commands.economy.shop.view.notForYou', { lng: locale }),
            ephemeral: true,
          });
          return;
        }

        switch (i.customId) {
          case 'shop_first':
            currentPage = 0;
            break;
          case 'shop_prev':
            currentPage = Math.max(0, currentPage - 1);
            break;
          case 'shop_next':
            currentPage = Math.min(totalPages - 1, currentPage + 1);
            break;
          case 'shop_last':
            currentPage = totalPages - 1;
            break;
          case 'shop_refresh':
            // Refresh balance
            const newBalance = await economyService.getOrCreateBalance(userId, guildId);
            balance.balance = newBalance.balance;
            break;
        }

        await i.update({
          embeds: [createShopEmbed(currentPage)],
          components: [createButtons(currentPage)],
        });
      });

      collector.on('end', async () => {
        await interaction.editReply({ components: [] }).catch(() => {});
      });
    }
  } catch (error) {
    logger.error('Error viewing shop:', error);
    await interaction.editReply({
      embeds: [
        embedBuilder.createErrorEmbed(t('commands.economy.errors.general', { lng: locale })),
      ],
    });
  }
}

async function handleBuyItem(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const itemName = interaction.options.getString('item', true);
  const quantity = interaction.options.getInteger('quantity') || 1;
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;
  const locale = getGuildLocale(guildId);

  try {
    const items = await economyRepository.getShopItems(guildId, true);
    const item = items.find(i => i.name.toLowerCase() === itemName.toLowerCase());

    if (!item) {
      await interaction.editReply({
        embeds: [
          embedBuilder.createErrorEmbed(
            t('commands.economy.shop.buy.itemNotFound', { lng: locale })
          ),
        ],
      });
      return;
    }

    const result = await economyService.purchaseItem(userId, guildId, item.id, quantity);
    const settings = await economyRepository.ensureSettings(guildId);

    if (!result.success) {
      await interaction.editReply({
        embeds: [embedBuilder.createErrorEmbed(result.error!)],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(t('commands.economy.shop.buy.success', { lng: locale }))
      .setDescription(
        t('commands.economy.shop.buy.purchased', { lng: locale, quantity, item: item.name })
      )
      .setColor(0x2ecc71)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        {
          name: t('commands.economy.shop.buy.totalCost', { lng: locale }),
          value: `${settings.currencySymbol}${(item.price * quantity).toLocaleString()}`,
          inline: true,
        },
        {
          name: t('commands.economy.gamble.common.newBalance', { lng: locale }),
          value: `${settings.currencySymbol}${result.balance!.balance.toLocaleString()}`,
          inline: true,
        }
      )
      .setTimestamp();

    if (item.effectType) {
      embed.addFields({
        name: t('commands.economy.shop.view.effect', { lng: locale }),
        value: formatEffect(item.effectType, item.effectValue, locale),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error buying item:', error);
    await interaction.editReply({
      embeds: [
        embedBuilder.createErrorEmbed(t('commands.economy.errors.general', { lng: locale })),
      ],
    });
  }
}

async function handleViewInventory(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const guildId = interaction.guildId!;
  const locale = getGuildLocale(guildId);

  try {
    const userItems = await economyRepository.getUserItems(userId, guildId, true);

    if (userItems.length === 0) {
      await interaction.editReply({
        embeds: [
          embedBuilder.createInfoEmbed(t('commands.economy.shop.inventory.empty', { lng: locale })),
        ],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(t('commands.economy.shop.inventory.title', { lng: locale }))
      .setDescription(
        t('commands.economy.shop.inventory.itemCount', {
          lng: locale,
          count: userItems.length,
          s: userItems.length > 1 ? 's' : '',
        })
      )
      .setColor(0x3498db)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    userItems.forEach(userItem => {
      const expiryText = userItem.expiresAt
        ? `\n${t('commands.economy.shop.inventory.expires', { lng: locale })}: <t:${Math.floor(userItem.expiresAt.getTime() / 1000)}:R>`
        : '';

      embed.addFields({
        name: `${userItem.item.name} (x${userItem.quantity})`,
        value: `${userItem.item.description}${
          userItem.item.effectType
            ? `\n**${t('commands.economy.shop.inventory.effect', { lng: locale })}:** ${formatEffect(userItem.item.effectType, userItem.item.effectValue, locale)}`
            : ''
        }${expiryText}`,
        inline: false,
      });
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error viewing inventory:', error);
    await interaction.editReply({
      embeds: [
        embedBuilder.createErrorEmbed(t('commands.economy.errors.general', { lng: locale })),
      ],
    });
  }
}

export async function autocomplete(interaction: any) {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const guildId = interaction.guildId!;

  try {
    const items = await economyRepository.getShopItems(guildId, true);
    const filtered = items
      .filter(item => item.name.toLowerCase().includes(focusedValue))
      .slice(0, 25);

    await interaction.respond(
      filtered.map(item => ({
        name: item.name,
        value: item.name,
      }))
    );
  } catch (error) {
    logger.error('Error in shop autocomplete:', error);
    await interaction.respond([]);
  }
}

function formatEffect(effectType: string, effectValue: any, locale: string): string {
  switch (effectType) {
    case 'rob_protection':
      const duration = effectValue?.duration || 86400;
      return t('commands.economy.shop.effects.robProtection', {
        lng: locale,
        hours: duration / 3600,
      });
    case 'xp_boost':
      const multiplier = effectValue?.multiplier || 2;
      const xpDuration = effectValue?.duration || 3600;
      return t('commands.economy.shop.effects.xpBoost', {
        lng: locale,
        multiplier,
        hours: xpDuration / 3600,
      });
    case 'role':
      return t('commands.economy.shop.effects.role', { lng: locale });
    default:
      return t('commands.economy.shop.effects.special', { lng: locale });
  }
}

async function createDefaultShopItems(guildId: string) {
  const defaultItems = [
    {
      guildId,
      name: 'Rob Protection',
      description: 'Protects you from being robbed for 24 hours',
      price: 1000,
      type: 'protection',
      effectType: 'rob_protection',
      effectValue: { duration: 86400 }, // 24 hours
      stock: -1,
    },
    {
      guildId,
      name: 'XP Booster',
      description: 'Doubles your XP gain for 1 hour',
      price: 500,
      type: 'booster',
      effectType: 'xp_boost',
      effectValue: { multiplier: 2, duration: 3600 }, // 1 hour
      stock: -1,
    },
    {
      guildId,
      name: 'Lucky Charm',
      description: 'Increases gambling win rate by 10% for 2 hours',
      price: 2000,
      type: 'booster',
      effectType: 'luck_boost',
      effectValue: { bonus: 10, duration: 7200 }, // 2 hours
      stock: -1,
    },
    {
      guildId,
      name: 'Work Efficiency',
      description: 'Increases work rewards by 50% for 3 hours',
      price: 750,
      type: 'booster',
      effectType: 'work_boost',
      effectValue: { multiplier: 1.5, duration: 10800 }, // 3 hours
      stock: -1,
    },
    {
      guildId,
      name: 'Vault Access',
      description: 'Allows you to store money in the bank (one-time use)',
      price: 5000,
      type: 'utility',
      effectType: 'bank_access',
      effectValue: { uses: 1 },
      stock: -1,
    },
  ];

  for (const item of defaultItems) {
    try {
      await economyRepository.createShopItem(item as any);
    } catch (error) {
      logger.error(`Error creating default shop item ${item.name}:`, error);
    }
  }
}
