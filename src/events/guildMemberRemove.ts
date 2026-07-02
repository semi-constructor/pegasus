import { EmbedBuilder, Events, type GuildMember, TextChannel } from 'discord.js';
import { modLogService } from '../services/modLogService';
import { configurationService } from '../services/configurationService';
import { t } from '../i18n';
import { logger } from '../utils/logger';

export const name = Events.GuildMemberRemove;
export const once = false;

function formatMessage(text: string, member: GuildMember): string {
  return text
    .replace(/{user}/gi, member.user.tag) // User left, so mentioning them won't work well
    .replace(/{user\.tag}/gi, member.user.tag)
    .replace(/{user\.name}/gi, member.user.username)
    .replace(/{server}/gi, member.guild.name)
    .replace(/{memberCount}/gi, member.guild.memberCount.toString());
}

export async function execute(member: GuildMember) {
  try {
    // Goodbye message logic
    const goodbyeConfig = await configurationService.getGoodbyeConfig(member.guild.id);
    
    if (goodbyeConfig.enabled && goodbyeConfig.channel) {
      const channel = member.guild.channels.cache.get(goodbyeConfig.channel);
      if (channel && channel.isTextBased()) {
        const content = goodbyeConfig.message ? formatMessage(goodbyeConfig.message, member) : undefined;
        
        if (goodbyeConfig.embedEnabled) {
          const embed = new EmbedBuilder()
            .setColor((goodbyeConfig.embedColor as any) || 0xff0000);
            
          if (goodbyeConfig.embedTitle) {
            embed.setTitle(formatMessage(goodbyeConfig.embedTitle, member));
          }
          if (content) {
            embed.setDescription(content);
          }
          if (goodbyeConfig.embedImage) {
            embed.setImage(goodbyeConfig.embedImage);
          }
          if (goodbyeConfig.embedThumbnail) {
            embed.setThumbnail(goodbyeConfig.embedThumbnail);
          } else {
            embed.setThumbnail(member.user.displayAvatarURL());
          }
          
          await (channel as TextChannel).send({ embeds: [embed] }).catch(() => null);
        } else if (content) {
          await (channel as TextChannel).send({ content }).catch(() => null);
        }
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle(t('modLogs.member.leave.title'))
      .setDescription(
        t('modLogs.member.leave.description', {
          user: member.user.tag,
        })
      )
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        {
          name: t('modLogs.fields.user'),
          value: `${member.user.tag} (${member.id})`,
          inline: false,
        },
        {
          name: t('modLogs.fields.joinedAt'),
          value: member.joinedTimestamp
            ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`
            : t('common.unknown'),
          inline: true,
        },
        {
          name: t('modLogs.fields.leftAt'),
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        }
      )
      .setTimestamp();

    await modLogService.sendLog(member.guild, 'member', {
      embeds: [embed],
    });
  } catch (error) {
    logger.error('Failed to log member leave:', error);
  }
}
