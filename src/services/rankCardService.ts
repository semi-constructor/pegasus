import { AttachmentBuilder } from 'discord.js';
import type { RankData, RankCardCustomization } from './xpService';
import { logger } from '../utils/logger';

interface CanvasModule {
  createCanvas: (width: number, height: number) => Canvas;
  loadImage: (src: string | Buffer) => Promise<Image>;
}

interface Canvas {
  getContext(contextId: '2d'): CanvasRenderingContext2D;
  toBuffer(type?: string): Buffer;
}

interface Image {
  width: number;
  height: number;
}

interface CanvasRenderingContext2D {
  fillStyle: string | CanvasGradient;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: 'left' | 'right' | 'center' | 'start' | 'end';
  textBaseline: 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom';
  globalAlpha: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  fillRect(x: number, y: number, width: number, height: number): void;
  strokeRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  strokeText(text: string, x: number, y: number, maxWidth?: number): void;
  measureText(text: string): { width: number };
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    anticlockwise?: boolean
  ): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  fill(): void;
  stroke(): void;
  clip(): void;
  save(): void;
  restore(): void;
  drawImage(image: Image, dx: number, dy: number): void;
  drawImage(image: Image, dx: number, dy: number, dWidth: number, dHeight: number): void;
  drawImage(
    image: Image,
    sx: number,
    sy: number,
    sWidth: number,
    sHeight: number,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number
  ): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
}

interface CanvasGradient {
  addColorStop(offset: number, color: string): void;
}

// Canvas module for dynamic loading
let createCanvas: ((width: number, height: number) => Canvas) | null = null;
let loadImage: ((src: string | Buffer) => Promise<Image>) | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require('canvas') as CanvasModule;
  createCanvas = module.createCanvas;
  loadImage = module.loadImage;
} catch (error) {
  logger.warn('Canvas module not available. Rank cards will be disabled.');
}

export class RankCardService {
  private readonly cardWidth = 934;
  private readonly cardHeight = 282;
  private readonly padding = 40;
  private readonly avatarSize = 128;
  private readonly progressBarHeight = 40;

  async generateRankCard(
    rankData: RankData,
    customization: RankCardCustomization
  ): Promise<AttachmentBuilder | null> {
    if (!createCanvas || !loadImage) {
      logger.warn('Canvas module not available. Cannot generate rank card.');
      return null;
    }

    try {
      // Create canvas
      const canvas = createCanvas(this.cardWidth, this.cardHeight);
      const ctx = canvas.getContext('2d');

      // Default colors
      const bgColor = customization.backgroundColor || '#23272A';
      const progressColor = customization.progressBarColor || '#5865F2';
      const textColor = customization.textColor || '#FFFFFF';
      const accentColor = customization.accentColor || '#EB459E';

      // Draw background
      ctx.fillStyle = bgColor;
      this.drawRoundedRect(ctx, 0, 0, this.cardWidth, this.cardHeight, 20);
      ctx.fill();

      // Draw card border
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3;
      this.drawRoundedRect(ctx, 1.5, 1.5, this.cardWidth - 3, this.cardHeight - 3, 20);
      ctx.stroke();

      // Load and draw avatar
      const avatarX = this.padding;
      const avatarY = (this.cardHeight - this.avatarSize) / 2;

      if (rankData.avatarUrl) {
        try {
          const avatar = await loadImage(rankData.avatarUrl);

          // Create circular avatar
          ctx.save();
          ctx.beginPath();
          ctx.arc(
            avatarX + this.avatarSize / 2,
            avatarY + this.avatarSize / 2,
            this.avatarSize / 2,
            0,
            Math.PI * 2
          );
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(avatar, avatarX, avatarY, this.avatarSize, this.avatarSize);
          ctx.restore();
        } catch (error) {
          // Draw placeholder if avatar fails to load
          this.drawPlaceholderAvatar(ctx, avatarX, avatarY, textColor);
        }
      } else {
        this.drawPlaceholderAvatar(ctx, avatarX, avatarY, textColor);
      }

      // Avatar border
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(
        avatarX + this.avatarSize / 2,
        avatarY + this.avatarSize / 2,
        this.avatarSize / 2,
        0,
        Math.PI * 2
      );
      ctx.stroke();

      // Text positioning
      const textX = avatarX + this.avatarSize + 30;
      const contentWidth = this.cardWidth - textX - this.padding;

      // Username
      ctx.font = 'bold 36px sans-serif';
      ctx.fillStyle = textColor;
      ctx.fillText(this.truncateText(ctx, rankData.username, contentWidth), textX, 70);

      // Rank and Level
      ctx.font = '24px sans-serif';
      ctx.fillStyle = accentColor;
      ctx.fillText(`Rank #${rankData.rank}`, textX, 110);

      ctx.fillStyle = textColor;
      ctx.fillText(`Level ${rankData.level}`, textX + 150, 110);

      // XP Text
      ctx.font = '20px sans-serif';
      ctx.fillStyle = textColor;
      const xpText = `${rankData.xp.toLocaleString()} / ${rankData.nextLevelXp.toLocaleString()} XP`;
      ctx.fillText(xpText, textX, 145);

      // Progress percentage
      ctx.fillStyle = accentColor;
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.floor(rankData.progress)}%`, this.cardWidth - this.padding, 145);
      ctx.textAlign = 'left';

      // Progress bar background
      const progressY = 180;
      const progressWidth = contentWidth;

      ctx.fillStyle = bgColor;
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 2;
      this.drawRoundedRect(ctx, textX, progressY, progressWidth, this.progressBarHeight, 20);
      ctx.fill();
      ctx.stroke();

      // Progress bar fill
      const fillWidth = (progressWidth - 4) * (rankData.progress / 100);
      if (fillWidth > 0) {
        // Gradient for progress bar
        const gradient = ctx.createLinearGradient(textX + 2, 0, textX + fillWidth, 0);
        gradient.addColorStop(0, progressColor);
        gradient.addColorStop(1, accentColor);

        ctx.fillStyle = gradient;
        this.drawRoundedRect(
          ctx,
          textX + 2,
          progressY + 2,
          fillWidth,
          this.progressBarHeight - 4,
          18
        );
        ctx.fill();
      }

      // Convert to buffer
      const buffer = canvas.toBuffer('image/png');
      return new AttachmentBuilder(buffer, { name: 'rank.png' });
    } catch (error) {
      logger.error('Failed to generate rank card:', error);
      return null;
    }
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  private drawPlaceholderAvatar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string
  ): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + this.avatarSize / 2, y + this.avatarSize / 2, this.avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x + this.avatarSize / 2, y + this.avatarSize / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  private truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    const ellipsis = '...';
    let truncated = text;

    if (ctx.measureText(text).width <= maxWidth) {
      return text;
    }

    while (ctx.measureText(truncated + ellipsis).width > maxWidth && truncated.length > 0) {
      truncated = truncated.substring(0, truncated.length - 1);
    }

    return truncated + ellipsis;
  }
}

// Export singleton instance
export const rankCardService = new RankCardService();
