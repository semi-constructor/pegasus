import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t, setUserLocale, getUserLocale, availableLocales } from '../../i18n';
import { getDatabase } from '../../database/connection';
import { users } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { ensureUserExists } from '../../utils/userUtils';
import { logger } from '../../utils/logger';
import {
  createLocalizationMap,
  commandNames,
  commandDescriptions,
  subcommandDescriptions,
  optionDescriptions,
} from '../../utils/localization';

export const data = new SlashCommandBuilder()
  .setName('language')
  .setDescription(t('commands.language.description', { defaultValue: 'Language preferences' }))
  .setNameLocalizations(createLocalizationMap(commandNames.language))
  .setDescriptionLocalizations(createLocalizationMap(commandDescriptions.language))
  .addSubcommand(subcommand =>
    subcommand
      .setName('available')
      .setDescription(
        t('commands.language.subcommands.available.description', {
          defaultValue: 'List available languages',
        })
      )
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.language.available))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('current')
      .setDescription(
        t('commands.language.subcommands.current.description', {
          defaultValue: 'Show current language',
        })
      )
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.language.current))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription(
        t('commands.language.subcommands.set.description', {
          defaultValue: 'Set preferred language',
        })
      )
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.language.set))
      .addStringOption(option =>
        option
          .setName('language')
          .setDescription(
            t('commands.language.subcommands.set.options.language', {
              defaultValue: 'The language to select',
            })
          )
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.language))
          .setRequired(true)
          .addChoices(
            {
              name: 'English',
              value: 'en',
              name_localizations: { de: 'Englisch', 'es-ES': 'Inglés', fr: 'Anglais' },
            },
            {
              name: 'Deutsch',
              value: 'de',
              name_localizations: { de: 'Deutsch', 'es-ES': 'Alemán', fr: 'Allemand' },
            },
            {
              name: 'Español',
              value: 'es',
              name_localizations: { de: 'Spanisch', 'es-ES': 'Español', fr: 'Espagnol' },
            },
            {
              name: 'Français',
              value: 'fr',
              name_localizations: { de: 'Französisch', 'es-ES': 'Francés', fr: 'Français' },
            }
          )
      )
  );

export const category = CommandCategory.Utility;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  const locale = getUserLocale(interaction.user.id);

  switch (subcommand) {
    case 'available':
      return handleAvailable(interaction, locale);
    case 'current':
      return handleCurrent(interaction, locale);
    case 'set':
      return handleSet(interaction, locale);
  }
}

async function handleAvailable(interaction: ChatInputCommandInteraction, locale: string) {
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(
      t('commands.language.subcommands.available.title', {
        lng: locale,
        defaultValue: 'Available Languages',
      })
    )
    .setDescription(
      t('commands.language.subcommands.available.description', {
        lng: locale,
        defaultValue: 'Here are the available languages:',
      })
    )
    .addFields(
      {
        name: t('commands.language.subcommands.available.fields.en.name', {
          lng: locale,
          defaultValue: '🇬🇧 English',
        }),
        value: t('commands.language.subcommands.available.fields.en.value', {
          lng: locale,
          defaultValue: 'Default language',
        }),
        inline: true,
      },
      {
        name: t('commands.language.subcommands.available.fields.de.name', {
          lng: locale,
          defaultValue: '🇩🇪 Deutsch',
        }),
        value: t('commands.language.subcommands.available.fields.de.value', {
          lng: locale,
          defaultValue: 'German language',
        }),
        inline: true,
      },
      {
        name: t('commands.language.subcommands.available.fields.es.name', {
          lng: locale,
          defaultValue: '🇪🇸 Español',
        }),
        value: t('commands.language.subcommands.available.fields.es.value', {
          lng: locale,
          defaultValue: 'Spanish language',
        }),
        inline: true,
      },
      {
        name: t('commands.language.subcommands.available.fields.fr.name', {
          lng: locale,
          defaultValue: '🇫🇷 Français',
        }),
        value: t('commands.language.subcommands.available.fields.fr.value', {
          lng: locale,
          defaultValue: 'French language',
        }),
        inline: true,
      }
    )
    .setFooter({
      text: t('commands.language.subcommands.available.footer', {
        lng: locale,
        defaultValue: 'Use /language set <language> to change your language',
      }),
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleCurrent(interaction: ChatInputCommandInteraction, currentLocale: string) {
  const languageNames: Record<string, string> = {
    en: t('commands.language.names.en', { lng: currentLocale, defaultValue: 'English' }),
    de: t('commands.language.names.de', { lng: currentLocale, defaultValue: 'Deutsch' }),
    es: t('commands.language.names.es', { lng: currentLocale, defaultValue: 'Español' }),
    fr: t('commands.language.names.fr', { lng: currentLocale, defaultValue: 'Français' }),
  };

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(
      t('commands.language.subcommands.current.title', {
        lng: currentLocale,
        defaultValue: 'Current Language',
      })
    )
    .setDescription(
      t('commands.language.subcommands.current.description', {
        lng: currentLocale,
        defaultValue: 'Your current language is **{{language}}** (`{{code}}`)',
        language: languageNames[currentLocale] || currentLocale,
        code: currentLocale,
      })
    )
    .setFooter({
      text: t('commands.language.subcommands.current.footer', {
        lng: currentLocale,
        defaultValue: 'Use /language set <language> to change your language',
      }),
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleSet(interaction: ChatInputCommandInteraction, initialLocale: string) {
  await interaction.deferReply();

  const newLocale = interaction.options.getString('language', true);

  if (!availableLocales.includes(newLocale)) {
    return interaction.editReply({
      content: t('commands.language.subcommands.set.invalidLanguage', {
        lng: initialLocale,
        defaultValue: 'Invalid language selected.',
      }),
    });
  }

  try {
    // Update user locale in memory
    setUserLocale(interaction.user.id, newLocale);

    // Ensure user exists in database first
    await ensureUserExists(interaction.user);

    // Update user locale in database
    const db = getDatabase();
    await db
      .update(users)
      .set({
        preferredLocale: newLocale,
        updatedAt: new Date(),
      })
      .where(eq(users.id, interaction.user.id));

    const languageNames: Record<string, string> = {
      en: t('commands.language.names.en', { lng: newLocale, defaultValue: 'English' }),
      de: t('commands.language.names.de', { lng: newLocale, defaultValue: 'Deutsch' }),
      es: t('commands.language.names.es', { lng: newLocale, defaultValue: 'Español' }),
      fr: t('commands.language.names.fr', { lng: newLocale, defaultValue: 'Français' }),
    };

    // Reply in the new language
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(
        t('commands.language.subcommands.set.success.title', {
          lng: newLocale,
          defaultValue: 'Language Updated',
        })
      )
      .setDescription(
        t('commands.language.subcommands.set.success.description', {
          lng: newLocale,
          defaultValue: 'Your language has been set to **{{language}}**.',
          language: languageNames[newLocale],
        })
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error setting user language:', error);
    await interaction.editReply({
      content: t('common.error', { lng: initialLocale }),
    });
  }
  return;
}
