import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { CommandCategory } from '../../types/command';
import { createLocalizationMap, commandDescriptions, subcommandDescriptions } from '../../utils/localization';
import { config } from '../../config/env';
import { logger } from '../../utils/logger';
import { t, getGuildLocale } from '../../i18n';

export const data = new SlashCommandBuilder()
  .setName('fun')
  .setDescription(t('commands.fun.description', { defaultValue: 'Fun and entertainment commands' }))
  .setDescriptionLocalizations(createLocalizationMap(commandDescriptions.fun))
  .addSubcommand(subcommand =>
    subcommand
      .setName('meme')
      .setDescription(t('commands.fun.subcommands.meme.description', { defaultValue: 'Get a random meme' }))
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.fun.meme))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('fact')
      .setDescription(t('commands.fun.subcommands.fact.description', { defaultValue: 'Get a random fact' }))
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.fun.fact))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('quote')
      .setDescription(t('commands.fun.subcommands.quote.description', { defaultValue: 'Get a random quote' }))
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.fun.quote))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('joke')
      .setDescription(t('commands.fun.subcommands.joke.description', { defaultValue: 'Get a random joke' }))
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.fun.joke))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('dadjoke')
      .setDescription(t('commands.fun.subcommands.dadjoke.description', { defaultValue: 'Get a random dad joke' }))
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.fun.dadjoke))
  );

export const category = CommandCategory.Fun;
export const cooldown = 5;

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const locale = interaction.guildId ? getGuildLocale(interaction.guildId) : 'en';

  if (!config.ENABLE_FUN_COMMANDS) {
    await interaction.reply({
      content: t('common.funDisabled', { lng: locale }),
      ephemeral: true,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  await interaction.deferReply();

  try {
    switch (subcommand) {
      case 'meme':
        await handleMeme(interaction, locale);
        break;
      case 'fact':
        await handleFact(interaction, locale);
        break;
      case 'quote':
        await handleQuote(interaction, locale);
        break;
      case 'joke':
        await handleJoke(interaction, locale);
        break;
      case 'dadjoke':
        await handleDadJoke(interaction, locale);
        break;
    }
  } catch (error) {
    logger.error('Error in fun command:', error);
    await interaction.editReply({
      content: t('common.fetchError', { lng: locale }),
    });
  }
}

async function handleMeme(interaction: ChatInputCommandInteraction, locale: string) {
  try {
    // Using Reddit API (no key required)
    const response = await axios.get('https://meme-api.com/gimme', {
      timeout: 5000,
    });

    const meme = response.data;

    if (!meme || !meme.url) {
      throw new Error('Invalid meme data received');
    }

    const embed = new EmbedBuilder()
      .setColor(0xff4500)
      .setTitle(meme.title || t('commands.fun.meme.fallbackTitle', { defaultValue: 'Random Meme', lng: locale }))
      .setImage(meme.url)
      .setFooter({ text: t('commands.fun.meme.footer', { defaultValue: 'From r/{{subreddit}}', subreddit: meme.subreddit || 'memes', lng: locale }) })
      .setTimestamp();

    if (meme.author) {
      embed.setAuthor({ name: `u/${meme.author}` });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    // Fallback to alternative API
    try {
      const response = await axios.get('https://api.imgflip.com/get_memes', {
        timeout: 5000,
      });

      const memes = response.data.data.memes;
      const randomMeme = memes[Math.floor(Math.random() * memes.length)];

      const embed = new EmbedBuilder()
        .setColor(0xff4500)
        .setTitle(randomMeme.name)
        .setImage(randomMeme.url)
        .setFooter({ text: t('commands.fun.meme.poweredBy', { defaultValue: 'Powered by Imgflip', lng: locale }) })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (fallbackError) {
      throw fallbackError;
    }
  }
}

async function handleFact(interaction: ChatInputCommandInteraction, locale: string) {
  try {
    const response = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random', {
      timeout: 5000,
      headers: {
        Accept: 'application/json',
      },
    });

    const fact = response.data;

    const embed = new EmbedBuilder()
      .setColor(0x00ae86)
      .setTitle(t('commands.fun.fact.title', { defaultValue: 'Random Fact', lng: locale }))
      .setDescription(fact.text)
      .setFooter({ text: fact.source || t('commands.fun.fact.unknownSource', { defaultValue: 'Unknown Source', lng: locale }) })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    // Fallback to alternative API
    try {
      const response = await axios.get('https://api.api-ninjas.com/v1/facts', {
        timeout: 5000,
        headers: {
          Accept: 'application/json',
        },
      });

      const fact = response.data[0];

      const embed = new EmbedBuilder()
        .setColor(0x00ae86)
        .setTitle(t('commands.fun.fact.title', { defaultValue: 'Random Fact', lng: locale }))
        .setDescription(fact.fact)
        .setFooter({ text: t('commands.fun.fact.poweredBy', { defaultValue: 'Powered by API Ninjas', lng: locale }) })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (fallbackError) {
      // Final fallback with hardcoded facts
      const facts = [
        'Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible.',
        "A group of flamingos is called a 'flamboyance'.",
        'Octopuses have three hearts and blue blood.',
        'The shortest war in history lasted only 38-45 minutes between Britain and Zanzibar in 1896.',
        "Bananas are berries, but strawberries aren't.",
      ];

      const randomFact = facts[Math.floor(Math.random() * facts.length)];

      const embed = new EmbedBuilder()
        .setColor(0x00ae86)
        .setTitle(t('commands.fun.fact.title', { defaultValue: 'Random Fact', lng: locale }))
        .setDescription(randomFact)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
}

async function handleQuote(interaction: ChatInputCommandInteraction, locale: string) {
  try {
    const response = await axios.get('https://api.quotable.io/random', {
      timeout: 5000,
    });

    const quote = response.data;

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(t('commands.fun.quote.title', { defaultValue: 'Random Quote', lng: locale }))
      .setDescription(`"${quote.content}"`)
      .setFooter({ text: `— ${quote.author}` })
      .setTimestamp();

    if (quote.tags && quote.tags.length > 0) {
      embed.addFields({
        name: t('commands.fun.quote.tags', { defaultValue: 'Tags', lng: locale }),
        value: quote.tags.join(', '),
        inline: true,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    // Fallback to alternative API
    try {
      const response = await axios.get('https://zenquotes.io/api/random', {
        timeout: 5000,
      });

      const quote = response.data[0];

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(t('commands.fun.quote.title', { defaultValue: 'Random Quote', lng: locale }))
        .setDescription(`"${quote.q}"`)
        .setFooter({ text: `— ${quote.a}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (fallbackError) {
      // Final fallback with hardcoded quotes
      const quotes = [
        { content: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
        {
          content: 'Innovation distinguishes between a leader and a follower.',
          author: 'Steve Jobs',
        },
        {
          content: "Life is what happens when you're busy making other plans.",
          author: 'John Lennon',
        },
        {
          content: 'The future belongs to those who believe in the beauty of their dreams.',
          author: 'Eleanor Roosevelt',
        },
        {
          content: 'It is during our darkest moments that we must focus to see the light.',
          author: 'Aristotle',
        },
      ];

      const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(t('commands.fun.quote.title', { defaultValue: 'Random Quote', lng: locale }))
        .setDescription(`"${randomQuote.content}"`)
        .setFooter({ text: `— ${randomQuote.author}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
}

async function handleJoke(interaction: ChatInputCommandInteraction, locale: string) {
  try {
    const response = await axios.get('https://official-joke-api.appspot.com/random_joke', {
      timeout: 5000,
    });

    const joke = response.data;

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle(t('commands.fun.joke.title', { defaultValue: 'Random Joke', lng: locale }))
      .setDescription(`**${joke.setup}**\n\n||${joke.punchline}||`)
      .setFooter({ text: t('commands.fun.joke.type', { defaultValue: 'Type: {{type}}', type: joke.type || 'General', lng: locale }) })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    // Fallback to alternative API
    try {
      const response = await axios.get('https://v2.jokeapi.dev/joke/Any?safe-mode&type=twopart', {
        timeout: 5000,
      });

      const joke = response.data;

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(t('commands.fun.joke.title', { defaultValue: 'Random Joke', lng: locale }))
        .setDescription(`**${joke.setup}**\n\n||${joke.delivery}||`)
        .setFooter({ text: t('commands.fun.joke.category', { defaultValue: 'Category: {{category}}', category: joke.category, lng: locale }) })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (fallbackError) {
      // Final fallback with hardcoded jokes
      const jokes = [
        {
          setup: "Why don't scientists trust atoms?",
          punchline: 'Because they make up everything!',
        },
        {
          setup: 'Why did the scarecrow win an award?',
          punchline: 'He was outstanding in his field!',
        },
        { setup: "Why don't eggs tell jokes?", punchline: "They'd crack each other up!" },
        { setup: 'What do you call a fake noodle?', punchline: 'An impasta!' },
        { setup: 'Why did the bicycle fall over?', punchline: 'It was two-tired!' },
      ];

      const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(t('commands.fun.joke.title', { defaultValue: 'Random Joke', lng: locale }))
        .setDescription(`**${randomJoke.setup}**\n\n||${randomJoke.punchline}||`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
}

async function handleDadJoke(interaction: ChatInputCommandInteraction, locale: string) {
  try {
    const response = await axios.get('https://icanhazdadjoke.com/', {
      timeout: 5000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Pegasus Discord Bot (https://github.com/cptcr/pegasus)',
      },
    });

    const joke = response.data;

    const embed = new EmbedBuilder()
      .setColor(0x1e90ff)
      .setTitle(t('commands.fun.dadjoke.title', { defaultValue: 'Dad Joke', lng: locale }))
      .setDescription(joke.joke)
      .setFooter({ text: t('commands.fun.dadjoke.poweredBy', { defaultValue: 'Powered by icanhazdadjoke.com', lng: locale }) })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    // Fallback with hardcoded dad jokes
    const dadJokes = [
      "I'm afraid for the calendar. Its days are numbered.",
      'My wife said I should do lunges to stay in shape. That would be a big step forward.',
      'Why do fathers take an extra pair of socks when they go golfing? In case they get a hole in one!',
      "Singing in the shower is fun until you get soap in your mouth. Then it's a soap opera.",
      "What do a tick and the Eiffel Tower have in common? They're both Paris sites.",
      'What do you call a factory that makes okay products? A satisfactory.',
      'Dear Math, grow up and solve your own problems.',
      'What did the janitor say when he jumped out of the closet? Supplies!',
      'Have you heard about the chocolate record player? It sounds pretty sweet.',
      'What did the ocean say to the beach? Nothing, it just waved.',
    ];

    const randomJoke = dadJokes[Math.floor(Math.random() * dadJokes.length)];

    const embed = new EmbedBuilder()
      .setColor(0x1e90ff)
      .setTitle(t('commands.fun.dadjoke.title', { defaultValue: 'Dad Joke', lng: locale }))
      .setDescription(randomJoke)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
