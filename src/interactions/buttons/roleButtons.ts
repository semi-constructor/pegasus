import { ButtonInteraction, GuildMember } from 'discord.js';
import { logger } from '../../utils/logger';

export async function handleRoleButtons(interaction: ButtonInteraction) {
  if (!interaction.guild || !interaction.member) return;

  const parts = interaction.customId.split(':');
  const roleId = parts[1];

  if (!roleId) {
    await interaction.reply({ content: 'Invalid role configuration.', ephemeral: true });
    return;
  }

  const role = interaction.guild.roles.cache.get(roleId);
  if (!role) {
    await interaction.reply({ content: 'The assigned role no longer exists in this server.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  
  try {
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      await interaction.reply({ content: `You have successfully removed the **${role.name}** role.`, ephemeral: true });
    } else {
      await member.roles.add(roleId);
      await interaction.reply({ content: `You have successfully received the **${role.name}** role.`, ephemeral: true });
    }
  } catch (error) {
    logger.error('Failed to assign/remove interactive role:', error);
    await interaction.reply({ content: 'I do not have permission to manage this role. Please ensure my highest role is above it.', ephemeral: true });
  }
}
