import { ShardingManager } from 'discord.js';
import path from 'path';
import chalk from 'chalk';
import { config } from './config/env';
import { logger } from './utils/logger';

const isTs = __filename.endsWith('.ts');
const scriptPath = isTs ? path.join(__dirname, 'index.ts') : path.join(__dirname, 'index.js');

const totalShardsParam =
  !config.TOTAL_SHARDS || config.TOTAL_SHARDS === 'auto'
    ? 'auto'
    : parseInt(config.TOTAL_SHARDS, 10);

export const manager = new ShardingManager(scriptPath, {
  token: config.DISCORD_TOKEN,
  totalShards: totalShardsParam,
  execArgv: isTs ? ['--import', 'tsx'] : [],
});

manager.on('shardCreate', shard => {
  logger.info(chalk.cyan(`[ShardingManager] Launched Shard #${shard.id}`));

  shard.on('ready', () => {
    logger.info(chalk.green(`[ShardingManager] Shard #${shard.id} is connected and ready`));
  });

  shard.on('disconnect', () => {
    logger.warn(chalk.yellow(`[ShardingManager] Shard #${shard.id} disconnected`));
  });

  shard.on('reconnecting', () => {
    logger.info(chalk.blue(`[ShardingManager] Shard #${shard.id} reconnecting...`));
  });

  shard.on('death', proc => {
    const code = (proc as any).exitCode ?? 'unknown';
    logger.error(chalk.red(`[ShardingManager] Shard #${shard.id} died with exit code ${code}`));
  });
});

export async function spawnShards(): Promise<void> {
  logger.info(chalk.bold.magenta(`[ShardingManager] Starting sharded bot manager...`));
  try {
    const spawnedShards = await manager.spawn();
    logger.info(
      chalk.bold.green(`[ShardingManager] Successfully spawned ${spawnedShards.size} shard(s)`)
    );
  } catch (error) {
    logger.error(chalk.red(`[ShardingManager] Failed to spawn shards:`), error);
    process.exit(1);
  }
}

if (require.main === module) {
  void spawnShards();
}
