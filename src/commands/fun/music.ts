import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  GuildMember,
} from 'discord.js';
import { Player, useMainPlayer } from 'discord-player';

export const data = new SlashCommandBuilder()
  .setName('music')
  .setDescription('Music system')
  .addSubcommand(sub =>
    sub
      .setName('play')
      .setDescription('Play a song')
      .addStringOption(option =>
        option.setName('query').setDescription('Song name or URL').setRequired(true)
      )
  )
  .addSubcommand(sub => sub.setName('skip').setDescription('Skip the current song'))
  .addSubcommand(sub => sub.setName('stop').setDescription('Stop the music and leave'))
  .addSubcommand(sub => sub.setName('queue').setDescription('Show the current queue'));

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  const player = useMainPlayer();
  
  if (!player) {
    await interaction.reply({ content: 'Music player is not initialized.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    await interaction.reply({ content: 'You must be in a voice channel!', ephemeral: true });
    return;
  }

  if (subcommand === 'play') {
    await interaction.deferReply();
    const query = interaction.options.getString('query', true);
    
    try {
      const { track } = await player.play(member.voice.channel, query, {
        nodeOptions: {
          metadata: interaction,
        },
      });

      const embed = new EmbedBuilder()
        .setTitle('🎶 Added to Queue')
        .setDescription(`**[${track.title}](${track.url})**\nBy: ${track.author}`)
        .setThumbnail(track.thumbnail)
        .setColor('#8B5CF6');

      await interaction.editReply({ embeds: [embed] });
    } catch (e: any) {
      await interaction.editReply(`Error playing track: ${e.message}`);
    }
  } else if (subcommand === 'skip') {
    const queue = player.nodes.get(interaction.guildId!);
    if (!queue || !queue.isPlaying()) {
      await interaction.reply({ content: 'Nothing is currently playing.', ephemeral: true });
      return;
    }
    queue.node.skip();
    await interaction.reply('⏭️ Skipped the current track.');
  } else if (subcommand === 'stop') {
    const queue = player.nodes.get(interaction.guildId!);
    if (!queue || !queue.isPlaying()) {
      await interaction.reply({ content: 'Nothing is currently playing.', ephemeral: true });
      return;
    }
    queue.delete();
    await interaction.reply('🛑 Stopped the music and cleared the queue.');
  } else if (subcommand === 'queue') {
    const queue = player.nodes.get(interaction.guildId!);
    if (!queue || !queue.isPlaying()) {
      await interaction.reply({ content: 'Nothing is currently playing.', ephemeral: true });
      return;
    }
    
    const currentTrack = queue.currentTrack;
    const tracks = queue.tracks.toArray();
    
    let description = `**Currently Playing:**\n[${currentTrack?.title}](${currentTrack?.url})\n\n**Next Up:**\n`;
    
    if (tracks.length === 0) {
      description += 'The queue is empty.';
    } else {
      const nextTracks = tracks.slice(0, 10).map((t, i) => `${i + 1}. [${t.title}](${t.url})`);
      description += nextTracks.join('\n');
      if (tracks.length > 10) {
        description += `\n...and ${tracks.length - 10} more tracks.`;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('Music Queue')
      .setDescription(description)
      .setColor('#8B5CF6');

    await interaction.reply({ embeds: [embed] });
  }
}
