import { Events, Client, ActivityType } from 'discord.js';
import { logger } from '../utils/logger';
import { giveawayService } from '../services/giveawayService';
import { registerCommands } from '../handlers/commandHandler';
import chalk from 'chalk';
import { moderationScheduler } from '../services/moderationScheduler';
import { crossShardService } from '../services/crossShardService';
import { CronService } from '../services/cronService';
import { reminderService } from '../services/reminderService';
import { musicService } from '../services/musicService';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client<true>) {
  const shardId = client.shard?.ids[0] ?? 0;
  const isPrimaryShard = !client.shard || client.shard.ids.includes(0);

  logger.info(
    chalk.green(`Ready! Logged in as ${client.user.tag} (Shard #${shardId})`)
  );

  // Register slash commands only on primary shard to avoid duplicate REST calls
  if (isPrimaryShard) {
    await registerCommands(client);
    logger.info(chalk.blue('Global slash commands registered'));
  }

  // Store client globally for giveaway service
  const globalObj = global as { client?: Client };
  globalObj.client = client;

  // Initialize active giveaways
  await giveawayService.initializeActiveGiveaways();
  logger.info(chalk.blue(`Initialized active giveaways on Shard #${shardId}`));

  // Resume moderation schedules (e.g., temp bans)
  moderationScheduler.attachClient(client);
  await moderationScheduler.initialize();
  logger.info(chalk.blue(`Moderation scheduler initialized on Shard #${shardId}`));

  // Start Background Cron Jobs
  const cronService = new CronService(client);
  cronService.startAll();

  // Start Reminder Service
  reminderService.init(client);

  // Initialize Music Player
  await musicService.init(client);

  // Initial bot presence setup
  const totalGuilds = await crossShardService.getTotalGuildsCount(client);

  client.user.setPresence({
    activities: [
      {
        name: `${totalGuilds} servers`,
        type: ActivityType.Watching,
      },
    ],
    status: 'online',
  });

  // Update status every 5 minutes using cross-shard totals
  setInterval(async () => {
    try {
      const [guildsCount, usersCount] = await Promise.all([
        crossShardService.getTotalGuildsCount(client),
        crossShardService.getTotalUsersCount(client),
      ]);

      const activities = [
        { name: `${guildsCount} servers`, type: ActivityType.Watching },
        { name: `${usersCount} users`, type: ActivityType.Listening },
        { name: '/help for commands', type: ActivityType.Playing },
      ];

      const activity = activities[Math.floor(Math.random() * activities.length)];
      client.user.setActivity(activity.name, { type: activity.type as ActivityType });
    } catch (err) {
      logger.debug('Failed to update sharded status presence:', err);
    }
  }, 300000);
}
