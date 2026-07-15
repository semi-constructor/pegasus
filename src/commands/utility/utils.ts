import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  User,
  Role,
  ChannelType,
} from 'discord.js';
import { Command, CommandCategory } from '../../types/command';
import { t, getGuildLocale } from '../../i18n';
import { SteamService as RealSteamService } from '../../services/steamService';

import { logger } from '../../utils/logger';
import * as os from 'os';
import { version as djsVersion } from 'discord.js';
import {
  createLocalizationMap,
  commandNames,
  commandDescriptions,
  subcommandDescriptions,
  optionDescriptions,
} from '../../utils/localization';

const realSteamService =
  process.env.STEAM_API_KEY && process.env.STEAM_API_KEY !== '' ? new RealSteamService() : null;


export const data = new SlashCommandBuilder()
  .setName('utils')
  .setDescription(
    t('commands.utils.description', { defaultValue: 'Utility commands for various information' })
  )
  .setNameLocalizations(createLocalizationMap(commandNames.utils))
  .setDescriptionLocalizations(createLocalizationMap(commandDescriptions.utils))
  .addSubcommand(subcommand =>
    subcommand
      .setName('avatar')
      .setDescription(
        t('commands.utils.subcommands.avatar.description', { defaultValue: "Get a user's avatar" })
      )
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.utils.avatar))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(
            t('commands.utils.subcommands.avatar.options.user', {
              defaultValue: 'The user to get avatar for',
            })
          )
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.user))
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('banner')
      .setDescription(
        t('commands.utils.subcommands.banner.description', { defaultValue: "Get a user's banner" })
      )
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.utils.banner))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(
            t('commands.utils.subcommands.banner.options.user', {
              defaultValue: 'The user to get banner for',
            })
          )
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.user))
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('steam')
      .setDescription(
        t('commands.utils.subcommands.steam.description', {
          defaultValue: 'Get Steam profile information',
        })
      )
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.utils.steam))
      .addStringOption(option =>
        option
          .setName('username')
          .setDescription(
            t('commands.utils.subcommands.steam.options.username', {
              defaultValue: 'Steam username or profile URL',
            })
          )
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.username))
          .setRequired(true)
      )
  )
  /*
  .addSubcommand(subcommand =>
    subcommand
      .setName('geizhals')
      .setDescription('Search for products on Geizhals')
      .setDescriptionLocalizations({
        'es-ES': 'Buscar productos en Geizhals',
        fr: 'Rechercher des YouTube sur Geizhals',
        de: 'Produkte auf Geizhals suchen',
      })
      .addStringOption(option =>
        option
          .setName('query')
          .setDescription('Product search term')
          .setDescriptionLocalizations({
            'es-ES': 'Término de búsqueda del producto',
            fr: 'Terme de recherche du produit',
            de: 'Produkt-Suchbegriff',
          })
          .setRequired(true)
      )
  )
  */
  .addSubcommand(subcommand =>
    subcommand
      .setName('userinfo')
      .setDescription(
        t('commands.utils.subcommands.userinfo.description', {
          defaultValue: 'Get detailed user information',
        })
      )
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.utils.userinfo))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(
            t('commands.utils.subcommands.userinfo.options.user', {
              defaultValue: 'The user to get information for',
            })
          )
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.user))
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('whois')
      .setDescription(
        t('commands.utils.subcommands.whois.description', { defaultValue: 'Look up user by ID' })
      )
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.utils.whois))
      .addStringOption(option =>
        option
          .setName('user_id')
          .setDescription(
            t('commands.utils.subcommands.whois.options.user_id', {
              defaultValue: 'The user ID to look up',
            })
          )
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.user_id))
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('roleinfo')
      .setDescription(
        t('commands.utils.subcommands.roleinfo.description', {
          defaultValue: 'Get role information',
        })
      )
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.utils.roleinfo))
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription(
            t('commands.utils.subcommands.roleinfo.options.role', {
              defaultValue: 'The role to get information for',
            })
          )
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.role))
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('serverinfo')
      .setDescription(
        t('commands.utils.subcommands.serverinfo.description', {
          defaultValue: 'Get server information',
        })
      )
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.utils.serverinfo))
  )

  .addSubcommand(subcommand =>
    subcommand
      .setName('support')
      .setDescription(
        t('commands.utils.subcommands.support.description', {
          defaultValue: 'Get support server link',
        })
      )
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.utils.support))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('stats')
      .setDescription(
        t('commands.utils.subcommands.stats.description', {
          defaultValue: 'View bot statistics and system information',
        })
      )
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.utils.stats))
  );

export const category = CommandCategory.Utility;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const locale = getGuildLocale(interaction.guildId!);

  try {
    switch (subcommand) {
      case 'avatar':
        await handleAvatar(interaction, locale);
        break;
      case 'banner':
        await handleBanner(interaction, locale);
        break;
      case 'steam':
        await handleSteam(interaction, locale);
        break;
      case 'userinfo':
        await handleUserInfo(interaction, locale);
        break;
      case 'whois':
        await handleWhois(interaction, locale);
        break;
      case 'roleinfo':
        await handleRoleInfo(interaction, locale);
        break;
      case 'serverinfo':
        await handleServerInfo(interaction, locale);
        break;

      case 'support':
        await handleSupport(interaction, locale);
        break;
      case 'stats':
        await handleStats(interaction, locale);
        break;
    }
  } catch (error) {
    logger.error('Error in utils command:', error);
    const errorMessage = t('common.error', { lng: locale });

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

async function handleAvatar(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  const user = interaction.options.getUser('user') || interaction.user;

  const avatarUrl = user.displayAvatarURL({ size: 4096, extension: 'png' });

  const embed = new EmbedBuilder()
    .setTitle(t('commands.utils.avatar.title', { lng: locale, user: user.username }))
    .setImage(avatarUrl)
    .setColor(0x7289da)
    .setFooter({ text: t('commands.utils.avatar.footer', { lng: locale }) })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleBanner(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user') || interaction.user;

  try {
    // Fetch user with banner
    const fetchedUser = await interaction.client.users.fetch(user.id, { force: true });

    if (!fetchedUser.banner) {
      await interaction.editReply({
        content: t('commands.utils.banner.noBanner', { lng: locale, user: user.username }),
      });
      return;
    }

    const bannerUrl = fetchedUser.bannerURL({ size: 4096, extension: 'png' });

    const embed = new EmbedBuilder()
      .setTitle(t('commands.utils.banner.title', { lng: locale, user: user.username }))
      .setImage(bannerUrl!)
      .setColor(fetchedUser.accentColor || 0x7289da)
      .setFooter({ text: t('commands.utils.banner.footer', { lng: locale }) })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error fetching user banner:', error);
    await interaction.editReply({
      content: t('commands.utils.banner.error', { lng: locale }),
    });
  }
}

async function handleSteam(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  await interaction.deferReply();

  const username = interaction.options.getString('username', true);

  try {
    if (!realSteamService) {
      await interaction.editReply({
        content: t('commands.utils.steam.error', { lng: locale }),
      });
      return;
    }

    const profile = await realSteamService.getProfile(username);
    if (!profile) {
      await interaction.editReply({
        content: t('commands.utils.steam.notFound', { lng: locale }),
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(profile.personaname)
      .setURL(profile.profileurl)
      .setColor(0x1b2838)
      .setThumbnail(profile.avatarfull)
      .addFields(
        {
          name: t('commands.utils.steam.status', { lng: locale }),
          value: realSteamService.getStatusText(profile.personastate, locale),
          inline: true,
        },
        {
          name: t('commands.utils.steam.visibility', { lng: locale }),
          value: realSteamService.getVisibilityText(profile.communityvisibilitystate, locale),
          inline: true,
        }
      )
      .setTimestamp();

    if (profile.timecreated) {
      embed.addFields({
        name: t('commands.utils.steam.created', { lng: locale }),
        value: `<t:${profile.timecreated}:R>`,
        inline: true,
      });
    }

    if (profile.gameextrainfo) {
      embed.addFields({
        name: t('commands.utils.steam.playing', { lng: locale }),
        value: profile.gameextrainfo,
        inline: true,
      });
    }

    if (profile.realname) {
      embed.addFields({
        name: t('commands.utils.steam.realName', { lng: locale }),
        value: profile.realname,
        inline: true,
      });
    }

    if (profile.loccountrycode) {
      embed.addFields({
        name: t('commands.utils.steam.country', { lng: locale }),
        value: profile.loccountrycode,
        inline: true,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error fetching Steam profile:', error);
    await interaction.editReply({
      content: t('commands.utils.steam.error', { lng: locale }),
    });
  }
}

async function handleUserInfo(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  const user = interaction.options.getUser('user') || interaction.user;
  const member = interaction.guild?.members.cache.get(user.id);

  const embed = new EmbedBuilder()
    .setTitle(t('commands.utils.userinfo.title', { lng: locale, user: user.username }))
    .setThumbnail(user.displayAvatarURL({ size: 512 }))
    .setColor(member?.displayColor || 0x7289da)
    .addFields([
      {
        name: t('commands.utils.userinfo.username', { lng: locale }),
        value: user.username,
        inline: true,
      },
      {
        name: t('commands.utils.userinfo.id', { lng: locale }),
        value: user.id,
        inline: true,
      },
      {
        name: t('commands.utils.userinfo.bot', { lng: locale }),
        value: user.bot ? t('common.yes', { lng: locale }) : t('common.no', { lng: locale }),
        inline: true,
      },
      {
        name: t('commands.utils.userinfo.created', { lng: locale }),
        value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
        inline: true,
      },
    ]);

  if (member) {
    embed.addFields([
      {
        name: t('commands.utils.userinfo.joined', { lng: locale }),
        value: `<t:${Math.floor(member.joinedTimestamp! / 1000)}:F>`,
        inline: true,
      },
      {
        name: t('commands.utils.userinfo.nickname', { lng: locale }),
        value: member.nickname || t('common.none', { lng: locale }),
        inline: true,
      },
      {
        name: t('commands.utils.userinfo.roles', { lng: locale }),
        value:
          member.roles.cache
            .filter(role => role.id !== interaction.guildId)
            .sort((a, b) => b.position - a.position)
            .map(role => role.toString())
            .join(', ') || t('common.none', { lng: locale }),
        inline: false,
      },
      {
        name: t('commands.utils.userinfo.permissions', { lng: locale }),
        value:
          member.permissions
            .toArray()
            .map(perm => `\`${perm}\``)
            .join(', ') || t('common.none', { lng: locale }),
        inline: false,
      },
    ]);
  }

  const badges = getUserBadges(user);
  if (badges.length > 0) {
    embed.addFields({
      name: t('commands.utils.userinfo.badges', { lng: locale }),
      value: badges.join(' '),
      inline: false,
    });
  }

  embed.setFooter({ text: t('commands.utils.userinfo.footer', { lng: locale }) }).setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleWhois(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  await interaction.deferReply();

  const userId = interaction.options.getString('user_id', true);

  try {
    const user = await interaction.client.users.fetch(userId);
    const member = interaction.guild?.members.cache.get(userId);

    const embed = new EmbedBuilder()
      .setTitle(t('commands.utils.whois.title', { lng: locale }))
      .setThumbnail(user.displayAvatarURL({ size: 512 }))
      .setColor(member?.displayColor || 0x7289da)
      .addFields([
        {
          name: t('commands.utils.userinfo.username', { lng: locale }),
          value: user.username,
          inline: true,
        },
        {
          name: t('commands.utils.userinfo.id', { lng: locale }),
          value: user.id,
          inline: true,
        },
        {
          name: t('commands.utils.whois.tag', { lng: locale }),
          value: user.tag,
          inline: true,
        },
        {
          name: t('commands.utils.userinfo.bot', { lng: locale }),
          value: user.bot ? t('common.yes', { lng: locale }) : t('common.no', { lng: locale }),
          inline: true,
        },
        {
          name: t('commands.utils.userinfo.created', { lng: locale }),
          value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
          inline: true,
        },
      ]);

    if (member) {
      embed.addFields({
        name: t('commands.utils.whois.inServer', { lng: locale }),
        value: t('common.yes', { lng: locale }),
        inline: true,
      });
    }

    embed.setFooter({ text: t('commands.utils.whois.footer', { lng: locale }) }).setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in whois command:', error);
    await interaction.editReply({
      content: t('commands.utils.whois.notFound', { lng: locale }),
    });
  }
}

async function handleRoleInfo(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  const role = interaction.options.getRole('role', true) as Role;

  const permissions =
    role.permissions
      .toArray()
      .map(perm => `\`${perm}\``)
      .join(', ') || t('common.none', { lng: locale });

  const embed = new EmbedBuilder()
    .setTitle(t('commands.utils.roleinfo.title', { lng: locale, role: role.name }))
    .setColor(role.color || 0x7289da)
    .addFields([
      {
        name: t('commands.utils.roleinfo.name', { lng: locale }),
        value: role.name,
        inline: true,
      },
      {
        name: t('commands.utils.roleinfo.id', { lng: locale }),
        value: role.id,
        inline: true,
      },
      {
        name: t('commands.utils.roleinfo.color', { lng: locale }),
        value: role.hexColor,
        inline: true,
      },
      {
        name: t('commands.utils.roleinfo.position', { lng: locale }),
        value: role.position.toString(),
        inline: true,
      },
      {
        name: t('commands.utils.roleinfo.mentionable', { lng: locale }),
        value: role.mentionable
          ? t('common.yes', { lng: locale })
          : t('common.no', { lng: locale }),
        inline: true,
      },
      {
        name: t('commands.utils.roleinfo.hoisted', { lng: locale }),
        value: role.hoist ? t('common.yes', { lng: locale }) : t('common.no', { lng: locale }),
        inline: true,
      },
      {
        name: t('commands.utils.roleinfo.created', { lng: locale }),
        value: `<t:${Math.floor(role.createdTimestamp / 1000)}:F>`,
        inline: true,
      },
      {
        name: t('commands.utils.roleinfo.members', { lng: locale }),
        value: role.members.size.toString(),
        inline: true,
      },
      {
        name: t('commands.utils.roleinfo.permissions', { lng: locale }),
        value: permissions.length > 1024 ? `${permissions.substring(0, 1021)  }...` : permissions,
        inline: false,
      },
    ])
    .setFooter({ text: t('commands.utils.roleinfo.footer', { lng: locale }) })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleServerInfo(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  const guild = interaction.guild!;

  await guild.fetch();
  const owner = await guild.fetchOwner();

  const channels = guild.channels.cache;
  const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
  const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
  const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;

  const embed = new EmbedBuilder()
    .setTitle(t('commands.utils.serverinfo.title', { lng: locale }))
    .setThumbnail(guild.iconURL({ size: 512 }) || null)
    .setColor(0x7289da)
    .addFields([
      {
        name: t('commands.utils.serverinfo.name', { lng: locale }),
        value: guild.name,
        inline: true,
      },
      {
        name: t('commands.utils.serverinfo.id', { lng: locale }),
        value: guild.id,
        inline: true,
      },
      {
        name: t('commands.utils.serverinfo.owner', { lng: locale }),
        value: `${owner.user.tag} (${owner.id})`,
        inline: true,
      },
      {
        name: t('commands.utils.serverinfo.created', { lng: locale }),
        value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`,
        inline: true,
      },
      {
        name: t('commands.utils.serverinfo.members', { lng: locale }),
        value: t('commands.utils.serverinfo.membersValue', {
          lng: locale,
          total: guild.memberCount,
          humans: guild.members.cache.filter(m => !m.user.bot).size,
          bots: guild.members.cache.filter(m => m.user.bot).size,
        }),
        inline: true,
      },
      {
        name: t('commands.utils.serverinfo.channels', { lng: locale }),
        value: t('commands.utils.serverinfo.channelsValue', {
          lng: locale,
          total: channels.size,
          text: textChannels,
          voice: voiceChannels,
          categories,
        }),
        inline: true,
      },
      {
        name: t('commands.utils.serverinfo.roles', { lng: locale }),
        value: guild.roles.cache.size.toString(),
        inline: true,
      },
      {
        name: t('commands.utils.serverinfo.emojis', { lng: locale }),
        value: guild.emojis.cache.size.toString(),
        inline: true,
      },
      {
        name: t('commands.utils.serverinfo.boosts', { lng: locale }),
        value: t('commands.utils.serverinfo.boostsValue', {
          lng: locale,
          level: guild.premiumTier,
          boosts: guild.premiumSubscriptionCount || 0,
        }),
        inline: true,
      },
    ]);

  if (guild.description) {
    embed.addFields({
      name: t('commands.utils.serverinfo.description', { lng: locale }),
      value: guild.description,
      inline: false,
    });
  }

  const features = guild.features.map(f => `\`${f}\``).join(', ');
  if (features) {
    embed.addFields({
      name: t('commands.utils.serverinfo.features', { lng: locale }),
      value: features,
      inline: false,
    });
  }

  if (guild.bannerURL()) {
    embed.setImage(guild.bannerURL({ size: 1024 }));
  }

  embed.setFooter({ text: t('commands.utils.serverinfo.footer', { lng: locale }) }).setTimestamp();

  await interaction.reply({ embeds: [embed] });
}



async function handleSupport(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle(t('commands.utils.support.title', { lng: locale }))
    .setDescription(t('commands.utils.support.description', { lng: locale }))
    .setColor(0x7289da)
    .addFields({
      name: t('commands.utils.support.link', { lng: locale }),
      value: t('commands.utils.support.linkValue', {
        lng: locale,
        defaultValue: '[discord.gg/vaultscope](https://discord.gg/vaultscope)',
      }),
      inline: false,
    })
    .setFooter({ text: t('commands.utils.support.footer', { lng: locale }) })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

function getUserBadges(user: User): string[] {
  const badges: string[] = [];
  const flags = user.flags?.toArray() || [];

  const badgeMap: Record<string, string> = {
    Staff: '🛡️',
    Partner: '🤝',
    Hypesquad: '🏆',
    BugHunterLevel1: '🐛',
    BugHunterLevel2: '🪲',
    HypeSquadOnlineHouse1: '🏠💜',
    HypeSquadOnlineHouse2: '🏠🧡',
    HypeSquadOnlineHouse3: '🏠💚',
    PremiumEarlySupporter: '💎',
    VerifiedDeveloper: '✅',
    CertifiedModerator: '👮',
    ActiveDeveloper: '🔧',
  };

  for (const flag of flags) {
    if (badgeMap[flag]) {
      badges.push(badgeMap[flag]);
    }
  }

  return badges;
}



async function handleStats(
  interaction: ChatInputCommandInteraction,
  locale: string
): Promise<void> {
  await interaction.deferReply();

  try {
    const client = interaction.client;

    // Calculate bot statistics
    const guildCount = client.guilds.cache.size;
    const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    const channelCount = client.channels.cache.size;
    const commandCount = client.application?.commands.cache.size || 0;

    // System information
    const platform = os.platform();
    const arch = os.arch();
    const nodeVersion = process.version;
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();

    // OS information
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuCores = os.cpus().length;
    const cpuModel =
      os.cpus()[0]?.model ||
      t('commands.utils.stats.unknown', { lng: locale, defaultValue: 'Unknown' });
    const osType = os.type();
    const osRelease = os.release();
    const hostname = os.hostname();

    // Calculate CPU usage (approximation)
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const cpuUsage = 100 - ~~((100 * totalIdle) / totalTick);

    // Format uptime
    const formatUptime = (seconds: number): string => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);

      const parts = [];
      if (days > 0)
        parts.push(`${days}${t('common.time.daysShort', { lng: locale, defaultValue: 'd' })}`);
      if (hours > 0)
        parts.push(`${hours}${t('common.time.hoursShort', { lng: locale, defaultValue: 'h' })}`);
      if (minutes > 0)
        parts.push(
          `${minutes}${t('common.time.minutesShort', { lng: locale, defaultValue: 'm' })}`
        );
      if (secs > 0)
        parts.push(`${secs}${t('common.time.secondsShort', { lng: locale, defaultValue: 's' })}`);

      return (
        parts.join(' ') || `0${t('common.time.secondsShort', { lng: locale, defaultValue: 's' })}`
      );
    };

    // Format bytes
    const formatBytes = (bytes: number): string => {
      const sizes = [
        t('common.bytes.b', { lng: locale, defaultValue: 'B' }),
        t('common.bytes.kb', { lng: locale, defaultValue: 'KB' }),
        t('common.bytes.mb', { lng: locale, defaultValue: 'MB' }),
        t('common.bytes.gb', { lng: locale, defaultValue: 'GB' }),
        t('common.bytes.tb', { lng: locale, defaultValue: 'TB' }),
      ];
      if (bytes === 0) return `0 ${sizes[0]}`;
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    };

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(t('commands.utils.stats.title', { lng: locale }))
      .setThumbnail(client.user?.displayAvatarURL() || null)
      .addFields(
        {
          name: t('commands.utils.stats.botStats', { lng: locale }),
          value: [
            `**${t('commands.utils.stats.guilds', { lng: locale })}:** ${guildCount.toLocaleString()}`,
            `**${t('commands.utils.stats.users', { lng: locale })}:** ${userCount.toLocaleString()}`,
            `**${t('commands.utils.stats.channels', { lng: locale })}:** ${channelCount.toLocaleString()}`,
            `**${t('commands.utils.stats.commands', { lng: locale })}:** ${commandCount}`,
            `**${t('commands.utils.stats.uptime', { lng: locale })}:** ${formatUptime(uptime)}`,
            `**${t('commands.utils.stats.ping', { lng: locale })}:** ${client.ws.ping}ms`,
          ].join('\n'),
          inline: true,
        },
        {
          name: t('commands.utils.stats.sysInfo', { lng: locale }),
          value: [
            `**${t('commands.utils.stats.os', { lng: locale })}:** ${osType} ${osRelease}`,
            `**${t('commands.utils.stats.platform', { lng: locale })}:** ${platform} (${arch})`,
            `**${t('commands.utils.stats.hostname', { lng: locale })}:** ${hostname}`,
            `**${t('commands.utils.stats.cpu', { lng: locale })}:** ${cpuModel}`,
            `**${t('commands.utils.stats.cpuCores', { lng: locale })}:** ${cpuCores}`,
            `**${t('commands.utils.stats.cpuUsage', { lng: locale })}:** ~${cpuUsage}%`,
          ].join('\n'),
          inline: true,
        },
        {
          name: t('commands.utils.stats.memUsage', { lng: locale }),
          value: [
            `**${t('commands.utils.stats.totalRam', { lng: locale })}:** ${formatBytes(totalMem)}`,
            `**${t('commands.utils.stats.usedRam', { lng: locale })}:** ${formatBytes(usedMem)} (${Math.round((usedMem / totalMem) * 100)}%)`,
            `**${t('commands.utils.stats.freeRam', { lng: locale })}:** ${formatBytes(freeMem)}`,
            `**${t('commands.utils.stats.botRss', { lng: locale })}:** ${formatBytes(memUsage.rss)}`,
            `**${t('commands.utils.stats.botHeap', { lng: locale })}:** ${formatBytes(memUsage.heapUsed)} / ${formatBytes(memUsage.heapTotal)}`,
            `**${t('commands.utils.stats.botExternal', { lng: locale })}:** ${formatBytes(memUsage.external)}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: t('commands.utils.stats.versions', { lng: locale }),
          value: [
            `**${t('commands.utils.stats.labels.nodejs', { lng: locale, defaultValue: 'Node.js' })}:** ${nodeVersion}`,
            `**${t('commands.utils.stats.labels.discordjs', { lng: locale, defaultValue: 'Discord.js' })}:** v${djsVersion}`,
            `**${t('commands.utils.stats.labels.typescript', { lng: locale, defaultValue: 'TypeScript' })}:** v${require('typescript/package.json').version}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: t('commands.utils.stats.processInfo', { lng: locale }),
          value: [
            `**${t('commands.utils.stats.labels.pid', { lng: locale, defaultValue: 'PID' })}:** ${process.pid}`,
            `**${t('commands.utils.stats.labels.platform', { lng: locale, defaultValue: 'Platform' })}:** ${process.platform}`,
            `**${t('commands.utils.stats.labels.architecture', { lng: locale, defaultValue: 'Architecture' })}:** ${process.arch}`,
            `**${t('commands.utils.stats.memLimit', { lng: locale })}:** ${formatBytes(memUsage.rss)}`,
          ].join('\n'),
          inline: true,
        }
      )
      .setFooter({
        text: t('commands.utils.stats.footer', { lng: locale, user: interaction.user.tag }),
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    // Add GPU information if available (usually not accessible in Node.js)
    try {
      // This is a placeholder - GPU info typically requires additional libraries
      // or system calls that aren't standard in Node.js
      if (process.platform === 'linux') {
        // Could potentially use exec to run nvidia-smi or similar
        // but keeping it simple for now
      }
    } catch (error) {
      // GPU info not available
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in stats command:', error);
    await interaction.editReply({
      content: t('commands.utils.stats.error', { lng: locale }),
    });
  }
}

export default {
  data,
  category,
  cooldown,
  execute,

} as Command;
