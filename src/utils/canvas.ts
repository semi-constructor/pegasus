import { createCanvas, loadImage, registerFont } from 'canvas';
import { GuildMember } from 'discord.js';
import path from 'path';

// You would typically load a custom font here
// registerFont(path.join(__dirname, '../../assets/fonts/Inter-Bold.ttf'), { family: 'Inter' });

export async function generateWelcomeImage(member: GuildMember, backgroundUrl?: string): Promise<Buffer> {
  const canvas = createCanvas(800, 300);
  const ctx = canvas.getContext('2d');

  // Draw background
  if (backgroundUrl) {
    try {
      const bg = await loadImage(backgroundUrl);
      ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    } catch (e) {
      // Fallback to solid color
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  } else {
    // Default gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#8b5cf6');
    gradient.addColorStop(1, '#3b82f6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Draw overlay for better text readability
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Avatar
  const avatarSize = 150;
  const avatarX = 50;
  const avatarY = (canvas.height - avatarSize) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();

  const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
  const avatar = await loadImage(avatarUrl);
  ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  
  ctx.restore();

  // Draw avatar border
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Text setup
  ctx.fillStyle = '#ffffff';
  
  // Welcome Text
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText('WELCOME', 230, 110);

  // Username
  ctx.font = 'bold 54px sans-serif';
  const username = member.user.username;
  ctx.fillText(username, 230, 175);

  // Member Count
  ctx.font = '28px sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(`You are member #${member.guild.memberCount}`, 230, 225);

  return canvas.toBuffer();
}

export async function generateGoodbyeImage(member: GuildMember, backgroundUrl?: string): Promise<Buffer> {
  const canvas = createCanvas(800, 300);
  const ctx = canvas.getContext('2d');

  // Draw background
  if (backgroundUrl) {
    try {
      const bg = await loadImage(backgroundUrl);
      ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    } catch (e) {
      // Fallback to solid color
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  } else {
    // Default gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#f43f5e');
    gradient.addColorStop(1, '#9f1239');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Draw overlay for better text readability
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Avatar
  const avatarSize = 150;
  const avatarX = 50;
  const avatarY = (canvas.height - avatarSize) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();

  const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
  const avatar = await loadImage(avatarUrl);
  
  // Make avatar grayscale for goodbye
  ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  
  ctx.restore();

  // Draw avatar border
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#9ca3af';
  ctx.stroke();

  // Text setup
  ctx.fillStyle = '#ffffff';
  
  // Goodbye Text
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText('GOODBYE', 230, 110);

  // Username
  ctx.font = 'bold 54px sans-serif';
  const username = member.user.username;
  ctx.fillText(username, 230, 175);

  // Member Count
  ctx.font = '28px sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(`We are now at ${member.guild.memberCount} members`, 230, 225);

  return canvas.toBuffer();
}
