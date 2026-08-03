import { CommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getDatabase } from '../../database/connection';
import { userBirthdays } from '../../database/schema';
import { eq, and } from 'drizzle-orm';
import { t } from '../../i18n';

export const data = new SlashCommandBuilder()
  .setName('birthday')
  .setDescription('Set or view your birthday for server celebrations')
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Set your birthday')
      .addIntegerOption(option =>
        option.setName('month').setDescription('Birth month').setRequired(true).setMinValue(1).setMaxValue(12)
      )
      .addIntegerOption(option =>
        option.setName('day').setDescription('Birth day').setRequired(true).setMinValue(1).setMaxValue(31)
      )
      .addIntegerOption(option =>
        option.setName('year').setDescription('Birth year (optional)').setRequired(false).setMinValue(1900)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('View your registered birthday')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('config')
      .setDescription('Configure the server birthday system (Admin Only)')
      .addChannelOption(option =>
        option.setName('channel').setDescription('Channel to send birthday messages in').setRequired(true)
      )
      .addBooleanOption(option =>
        option.setName('enabled').setDescription('Enable or disable birthday messages').setRequired(false)
      )
      .addStringOption(option =>
        option.setName('message').setDescription('Custom birthday message (use {user} to mention)').setRequired(false)
      )
  );

export async function execute(interaction: CommandInteraction) {
  if (!interaction.guildId) return;

  const db = getDatabase();
  const subcommand = (interaction as any).options.getSubcommand();

  if (subcommand === 'config') {
    // Check for administrator permissions
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({ content: 'You need Administrator permissions to use this command.', ephemeral: true });
      return;
    }

    const channel = (interaction as any).options.getChannel('channel', true);
    const enabled = (interaction as any).options.getBoolean('enabled') ?? true;
    const message = (interaction as any).options.getString('message') ?? 'Happy Birthday {user}! 🎉';

    try {
      const { birthdaySettings } = require('../../database/schema');
      
      const existing = await db.select().from(birthdaySettings).where(
        eq(birthdaySettings.guildId, interaction.guildId)
      );

      if (existing.length > 0) {
        await db.update(birthdaySettings).set({
          channelId: channel.id,
          enabled,
          message,
        }).where(eq(birthdaySettings.guildId, interaction.guildId));
      } else {
        await db.insert(birthdaySettings).values({
          guildId: interaction.guildId,
          channelId: channel.id,
          enabled,
          message,
        });
      }

      await interaction.reply({ 
        content: `✅ Birthday system configured!\n**Channel:** <#${channel.id}>\n**Enabled:** ${enabled}\n**Message:** ${message}`, 
        ephemeral: true 
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'An error occurred while configuring the birthday system.', ephemeral: true });
    }
  } else if (subcommand === 'set') {
    const month = (interaction as any).options.getInteger('month', true);
    const day = (interaction as any).options.getInteger('day', true);
    const year = (interaction as any).options.getInteger('year');

    // Basic date validation
    const date = new Date(year || 2000, month - 1, day);
    if (date.getMonth() !== month - 1 || date.getDate() !== day) {
      await interaction.reply({ content: 'Invalid date provided!', ephemeral: true });
      return;
    }

    try {
      // Check if exists
      const existing = await db.select().from(userBirthdays).where(
        and(eq(userBirthdays.userId, interaction.user.id), eq(userBirthdays.guildId, interaction.guildId))
      );

      if (existing.length > 0) {
        await db.update(userBirthdays).set({ month, day, year }).where(
          and(eq(userBirthdays.userId, interaction.user.id), eq(userBirthdays.guildId, interaction.guildId))
        );
      } else {
        await db.insert(userBirthdays).values({
          userId: interaction.user.id,
          guildId: interaction.guildId,
          month,
          day,
          year,
        });
      }

      await interaction.reply({ content: `✅ Birthday successfully set to ${month}/${day}${year ? `/${year}` : ''}!`, ephemeral: true });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'An error occurred while saving your birthday.', ephemeral: true });
    }
  } else if (subcommand === 'view') {
    const [bday] = await db.select().from(userBirthdays).where(
      and(eq(userBirthdays.userId, interaction.user.id), eq(userBirthdays.guildId, interaction.guildId))
    );

    if (!bday) {
      await interaction.reply({ content: "You haven't set your birthday yet! Use `/birthday set` to set it.", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎂 Your Birthday')
      .setDescription(`Your birthday is set to **${bday.month}/${bday.day}${bday.year ? `/${bday.year}` : ''}**`)
      .setColor(0xf472b6);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
