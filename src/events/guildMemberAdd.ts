import { EmbedBuilder, Events, type GuildMember, TextChannel } from 'discord.js';
import { modLogService } from '../services/modLogService';
import { configurationService } from '../services/configurationService';
import { t } from '../i18n';
import { logger } from '../utils/logger';

export const name = Events.GuildMemberAdd;
export const once = false;

function formatMessage(text: string, member: GuildMember): string {
  return text
    .replace(/{user}/gi, member.toString())
    .replace(/{user\.tag}/gi, member.user.tag)
    .replace(/{user\.name}/gi, member.user.username)
    .replace(/{server}/gi, member.guild.name)
    .replace(/{memberCount}/gi, member.guild.memberCount.toString());
}

export async function execute(member: GuildMember) {
  try {
    // Welcome message logic
    const welcomeConfig = await configurationService.getWelcomeConfig(member.guild.id);
    
    if (welcomeConfig.enabled) {
      if (welcomeConfig.channel) {
        const channel = member.guild.channels.cache.get(welcomeConfig.channel);
        if (channel && channel.isTextBased()) {
          const content = welcomeConfig.message ? formatMessage(welcomeConfig.message, member) : undefined;
          
          if (welcomeConfig.embedEnabled) {
            const embed = new EmbedBuilder()
              .setColor((welcomeConfig.embedColor as any) || 0x0099ff);
              
            if (welcomeConfig.embedTitle) {
              embed.setTitle(formatMessage(welcomeConfig.embedTitle, member));
            }
            if (content) {
              embed.setDescription(content);
            }
            if (welcomeConfig.embedImage) {
              embed.setImage(welcomeConfig.embedImage);
            }
            if (welcomeConfig.embedThumbnail) {
              embed.setThumbnail(welcomeConfig.embedThumbnail);
            } else {
              embed.setThumbnail(member.user.displayAvatarURL());
            }
            
            await (channel as TextChannel).send({ embeds: [embed] }).catch(() => null);
          } else if (content) {
            await (channel as TextChannel).send({ content }).catch(() => null);
          }
        }
      }
      
      if (welcomeConfig.dmEnabled && welcomeConfig.dmMessage) {
        try {
          const dmContent = formatMessage(welcomeConfig.dmMessage, member);
          await member.send({ content: dmContent });
        } catch (err) {
          // Ignore DM errors
        }
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(t('modLogs.member.join.title'))
      .setDescription(
        t('modLogs.member.join.description', {
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
          name: t('modLogs.fields.accountCreated'),
          value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
        {
          name: t('modLogs.fields.joinedAt'),
          value: member.joinedTimestamp
            ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`
            : t('common.unknown'),
          inline: true,
        }
      )
      .setTimestamp();

    await modLogService.sendLog(member.guild, 'member', {
      embeds: [embed],
    });
  } catch (error) {
    logger.error('Failed to log member join:', error);
  }
}
