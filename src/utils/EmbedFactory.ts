import { EmbedBuilder, ColorResolvable, User, Guild } from 'discord.js';

export interface EmbedOptions {
  title?: string;
  description?: string;
  color?: ColorResolvable;
  thumbnail?: string;
  image?: string;
  author?: { name: string; iconURL?: string; url?: string };
  footer?: { text: string; iconURL?: string };
  timestamp?: boolean | Date;
  fields?: { name: string; value: string; inline?: boolean }[];
}

export class EmbedFactory {
  // Brand colors for Pegasus V3
  public static readonly Colors = {
    Primary: '#5865F2' as ColorResolvable,
    Success: '#2ECC71' as ColorResolvable,
    Error: '#ED4245' as ColorResolvable,
    Warning: '#FEE75C' as ColorResolvable,
    Info: '#3498DB' as ColorResolvable,
  };

  /**
   * Creates a standardized base embed
   */
  public static create(options: EmbedOptions): EmbedBuilder {
    const embed = new EmbedBuilder();

    if (options.title) embed.setTitle(options.title);
    if (options.description) embed.setDescription(options.description);
    if (options.color) embed.setColor(options.color);
    else embed.setColor(this.Colors.Primary); // Default brand color

    if (options.thumbnail) embed.setThumbnail(options.thumbnail);
    if (options.image) embed.setImage(options.image);
    
    if (options.author) {
      embed.setAuthor({
        name: options.author.name,
        iconURL: options.author.iconURL,
        url: options.author.url,
      });
    }

    if (options.footer) {
      embed.setFooter({
        text: options.footer.text,
        iconURL: options.footer.iconURL,
      });
    }

    if (options.fields && options.fields.length > 0) {
      embed.addFields(options.fields);
    }

    if (options.timestamp) {
      embed.setTimestamp(options.timestamp instanceof Date ? options.timestamp : new Date());
    }

    return embed;
  }

  /**
   * Creates a standardized success embed
   */
  public static success(description: string, title?: string): EmbedBuilder {
    return this.create({
      title,
      description,
      color: this.Colors.Success,
      timestamp: true,
    });
  }

  /**
   * Creates a standardized error embed
   */
  public static error(description: string, title: string = 'Error'): EmbedBuilder {
    return this.create({
      title,
      description,
      color: this.Colors.Error,
      timestamp: true,
    });
  }

  /**
   * Creates a standardized warning embed
   */
  public static warning(description: string, title: string = 'Warning'): EmbedBuilder {
    return this.create({
      title,
      description,
      color: this.Colors.Warning,
      timestamp: true,
    });
  }

  /**
   * Creates a standardized info embed
   */
  public static info(description: string, title?: string): EmbedBuilder {
    return this.create({
      title,
      description,
      color: this.Colors.Info,
      timestamp: true,
    });
  }
}
