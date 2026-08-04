import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getDatabase } from '../../database/connection';
import { socialFeeds } from '../../database/schema';
import { eq, and } from 'drizzle-orm';

export const data = new SlashCommandBuilder()
  .setName('socialfeed')
  .setDescription('Manage social feeds (RSS/YouTube) for this server (Admin Only)')
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Add a new social feed')
      .addStringOption(option =>
        option
          .setName('type')
          .setDescription('Feed Type')
          .setRequired(true)
          .addChoices({ name: 'RSS', value: 'rss' }, { name: 'YouTube', value: 'youtube' })
      )
      .addStringOption(option =>
        option.setName('url').setDescription('Feed URL or YouTube Channel ID').setRequired(true)
      )
      .addChannelOption(option =>
        option.setName('channel').setDescription('Channel to post updates').setRequired(true)
      )
      .addRoleOption(option =>
        option.setName('role').setDescription('Role to ping').setRequired(false)
      )
      .addStringOption(option =>
        option.setName('message').setDescription('Custom message').setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('list').setDescription('List all configured social feeds')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove a social feed')
      .addStringOption(option =>
        option.setName('url').setDescription('Feed URL to remove').setRequired(true)
      )
  );

export async function execute(interaction: CommandInteraction) {
  if (!interaction.guildId) return;

  // Check for administrator permissions
  if (!interaction.memberPermissions?.has('Administrator')) {
    await interaction.reply({
      content: 'You need Administrator permissions to use this command.',
      ephemeral: true,
    });
    return;
  }

  const db = getDatabase();
  const subcommand = (interaction as any).options.getSubcommand();

  if (subcommand === 'add') {
    const type = (interaction as any).options.getString('type', true);
    const url = (interaction as any).options.getString('url', true);
    const channel = (interaction as any).options.getChannel('channel', true);
    const role = (interaction as any).options.getRole('role');
    const message = (interaction as any).options.getString('message');

    let finalUrl = url;
    if (type === 'youtube' && !finalUrl.startsWith('http')) {
      finalUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${finalUrl}`;
    }

    try {
      await db.insert(socialFeeds).values({
        guildId: interaction.guildId,
        feedType: type,
        feedUrl: finalUrl,
        channelId: channel.id,
        mentionRole: role ? role.id : null,
        customMessage: message,
      });

      await interaction.reply({
        content: `✅ Successfully added ${type.toUpperCase()} feed!\n**URL:** ${url}\n**Channel:** <#${channel.id}>`,
        ephemeral: true,
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: 'An error occurred while adding the feed. Ensure the URL is not already added.',
        ephemeral: true,
      });
    }
  } else if (subcommand === 'list') {
    const feeds = await db
      .select()
      .from(socialFeeds)
      .where(eq(socialFeeds.guildId, interaction.guildId));

    if (feeds.length === 0) {
      await interaction.reply({
        content: 'There are no social feeds configured for this server.',
        ephemeral: true,
      });
      return;
    }

    const feedList = feeds
      .map((f, i) => `${i + 1}. **${f.feedType.toUpperCase()}**: ${f.feedUrl} -> <#${f.channelId}>`)
      .join('\n');
    await interaction.reply({
      content: `**Configured Social Feeds:**\n${feedList}`,
      ephemeral: true,
    });
  } else if (subcommand === 'remove') {
    const url = (interaction as any).options.getString('url', true);

    try {
      const result = await db
        .delete(socialFeeds)
        .where(and(eq(socialFeeds.guildId, interaction.guildId), eq(socialFeeds.feedUrl, url)));

      await interaction.reply({ content: `✅ Removed feed with URL: ${url}`, ephemeral: true });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: 'An error occurred while removing the feed.',
        ephemeral: true,
      });
    }
  }
}
