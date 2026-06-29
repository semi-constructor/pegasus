import { z } from 'zod';
import { config as loadEnv } from 'dotenv';
import { logger } from '../utils/logger';

loadEnv();

const EnvSchema = z.object({
  // Discord Configuration
  DISCORD_TOKEN: z.string().min(1, 'Discord token is required'),
  DISCORD_CLIENT_ID: z.string().regex(/^\d{17,19}$/, 'Invalid Discord client ID'),
  DISCORD_CLIENT_SECRET: z.string().optional(),

  // Database Configuration
  DATABASE_URL: z
    .string()
    .url('Invalid database URL')
    .startsWith('postgresql://', 'Database URL must be PostgreSQL'),
  DB_MAX_CONNECTIONS: z.coerce.number().min(1).max(100).default(20),
  DB_SSL: z
    .enum(['true', 'false'])
    .transform(val => val === 'true')
    .default('false'),

  // Security & Access Control
  DEVELOPER_IDS: z.string().transform(str => {
    try {
      const parsed: unknown = JSON.parse(str);
      return z.array(z.string().regex(/^\d{17,19}$/)).parse(parsed);
    } catch {
      throw new Error('DEVELOPER_IDS must be a valid JSON array of Discord IDs');
    }
  }),
  ENCRYPTION_KEY: z.string().length(32, 'Encryption key must be exactly 32 characters'),
  JWT_SECRET: z.string().optional(),

  // Bot Configuration
  DEFAULT_LANGUAGE: z.enum(['en', 'de', 'es', 'fr']).default('en'),
  DEFAULT_PREFIX: z.string().max(5).default('!'),
  SUPPORT_SERVER_INVITE: z.string().url('Invalid support server invite URL'),

  // Rate Limiting
  RATE_LIMIT_WINDOW: z.coerce.number().min(1000).max(300000).default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(1).max(100).default(10),
  GLOBAL_RATE_LIMIT: z.coerce.number().min(100).max(10000).default(1000),

  // External APIs
  STEAM_API_KEY: z.string().optional(),
  WEATHER_API_KEY: z.string().optional(),
  NEWS_API_KEY: z.string().optional(),
  GEIZHALS_API_KEY: z.string().optional(),
  GEIZHALS_USERNAME: z.string().optional(),

  // Caching & Performance
  REDIS_URL: z.string().url().optional(),
  CACHE_TTL: z.coerce.number().min(60).max(86400).default(3600),
  ENABLE_QUERY_CACHE: z
    .enum(['true', 'false'])
    .transform(val => val === 'true')
    .default('true'),

  // Logging & Monitoring
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FILE_PATH: z.string().default('./logs'),
  SENTRY_DSN: z
    .string()
    .optional()
    .transform(val => {
      if (!val || val === 'your_sentry_dsn_here') return undefined;
      return val;
    }),
  WEBHOOK_ERROR_URL: z
    .string()
    .optional()
    .transform(val => {
      if (!val || val === 'your_webhook_url') return undefined;
      return val;
    }),
  WEBHOOK_AUDIT_URL: z
    .string()
    .optional()
    .transform(val => {
      if (!val || val === 'your_webhook_url') return undefined;
      return val;
    }),

  // Web Dashboard
  DASHBOARD_ENABLED: z
    .enum(['true', 'false'])
    .transform(val => val === 'true')
    .default('false'),
  DASHBOARD_PORT: z.coerce.number().min(1024).max(65535).default(3000),
  DASHBOARD_SECRET: z
    .string()
    .optional()
    .transform(val => {
      if (!val || val === 'your_random_secret_here') return undefined;
      return val;
    }),
  DASHBOARD_BASE_URL: z
    .string()
    .optional()
    .transform(val => {
      if (!val || val === 'https://yourdomain.com') return undefined;
      return val;
    }),

  // Development Settings
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DEBUG_MODE: z
    .enum(['true', 'false'])
    .transform(val => val === 'true')
    .default('false'),
  MOCK_DISCORD_API: z
    .enum(['true', 'false'])
    .transform(val => val === 'true')
    .default('false'),
  TEST_GUILD_ID: z
    .string()
    .optional()
    .transform(val => {
      if (!val || val === 'your_test_guild_id') return undefined;
      return val;
    }),

  // Economy System
  ECONOMY_STARTING_BALANCE: z.coerce.number().min(0).max(1000000).default(1000),
  ECONOMY_DAILY_REWARD_MIN: z.coerce.number().min(1).max(10000).default(100),
  ECONOMY_DAILY_REWARD_MAX: z.coerce.number().min(1).max(10000).default(500),
  ECONOMY_WORK_COOLDOWN: z.coerce.number().min(60000).max(86400000).default(3600000),
  ECONOMY_ROB_COOLDOWN: z.coerce.number().min(3600000).max(604800000).default(86400000),

  // XP System
  XP_MESSAGE_MIN: z.coerce.number().min(1).max(100).default(15),
  XP_MESSAGE_MAX: z.coerce.number().min(1).max(100).default(25),
  XP_VOICE_PER_MINUTE: z.coerce.number().min(1).max(100).default(20),
  XP_COOLDOWN: z.coerce.number().min(10000).max(300000).default(60000),
  XP_BOOSTER_MULTIPLIER: z.coerce.number().min(1).max(5).default(1.5),

  // Moderation System
  MAX_WARNINGS_PER_USER: z.coerce.number().min(1).max(100).default(50),
  WARNING_EXPIRY_DAYS: z.coerce.number().min(1).max(365).default(90),
  AUTO_MOD_ENABLED: z
    .enum(['true', 'false'])
    .transform(val => val === 'true')
    .default('true'),
  SPAM_THRESHOLD: z.coerce.number().min(2).max(20).default(5),
  SPAM_WINDOW: z.coerce.number().min(1000).max(60000).default(10000),

  // Feature Toggles
  ENABLE_GIVEAWAYS: z
    .enum(['true', 'false'])
    .transform(val => val === 'true')
    .default('true'),
  ENABLE_TICKETS: z
    .enum(['true', 'false'])
    .transform(val => val === 'true')
    .default('true'),
  ENABLE_ECONOMY: z
    .enum(['true', 'false'])
    .transform(val => val === 'true')
    .default('true'),
  ENABLE_XP_SYSTEM: z
    .enum(['true', 'false'])
    .transform(val => val === 'true')
    .default('true'),
  ENABLE_FUN_COMMANDS: z
    .enum(['true', 'false'])
    .transform(val => val === 'true')
    .default('true'),
  ENABLE_MUSIC: z
    .enum(['true', 'false'])
    .transform(val => val === 'true')
    .default('false'),

  // API Configuration
  ENABLE_API: z
    .enum(['true', 'false'])
    .transform(val => val === 'true')
    .default('true'),
  API_PORT: z.coerce.number().min(1024).max(65535).default(2000),
  BOT_API_TOKEN: z.string().min(20, 'API token must be at least 20 characters'),
  API_TOKEN: z.string().min(20, 'API token must be at least 20 characters'),
  API_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform(value => {
      if (!value) {
        return [] as string[];
      }

      const normalize = (origin: string) => origin.trim();

      try {
        const parsed = JSON.parse(value) as unknown;
        const origins = z.array(z.string()).parse(parsed);
        return origins.map(normalize).filter(Boolean);
      } catch {
        return value.split(',').map(normalize).filter(Boolean);
      }
    }),
});

type EnvConfig = z.infer<typeof EnvSchema>;

let config: EnvConfig;

try {
  config = EnvSchema.parse(process.env);
  logger.info('Environment configuration validated successfully');
} catch (error) {
  if (error instanceof z.ZodError) {
    logger.error('Environment validation failed:');
    error.errors.forEach(err => {
      logger.error(`  ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export { config };

export const isDeveloper = (userId: string): boolean => {
  return config.DEVELOPER_IDS.includes(userId);
};

export const isProduction = (): boolean => {
  return config.NODE_ENV === 'production';
};

export const isDevelopment = (): boolean => {
  return config.NODE_ENV === 'development';
};

export const isTest = (): boolean => {
  return config.NODE_ENV === 'test';
};

export const getFeatureFlags = () => ({
  giveaways: config.ENABLE_GIVEAWAYS,
  tickets: config.ENABLE_TICKETS,
  economy: config.ENABLE_ECONOMY,
  xpSystem: config.ENABLE_XP_SYSTEM,
  funCommands: config.ENABLE_FUN_COMMANDS,
  music: config.ENABLE_MUSIC,
});

export const getRateLimitConfig = () => ({
  window: config.RATE_LIMIT_WINDOW,
  maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
  globalLimit: config.GLOBAL_RATE_LIMIT,
});

export const getEconomyConfig = () => ({
  startingBalance: config.ECONOMY_STARTING_BALANCE,
  dailyReward: {
    min: config.ECONOMY_DAILY_REWARD_MIN,
    max: config.ECONOMY_DAILY_REWARD_MAX,
  },
  cooldowns: {
    work: config.ECONOMY_WORK_COOLDOWN,
    rob: config.ECONOMY_ROB_COOLDOWN,
  },
});

export const getXPConfig = () => ({
  message: {
    min: config.XP_MESSAGE_MIN,
    max: config.XP_MESSAGE_MAX,
  },
  voicePerMinute: config.XP_VOICE_PER_MINUTE,
  cooldown: config.XP_COOLDOWN,
  boosterMultiplier: config.XP_BOOSTER_MULTIPLIER,
});

export const getModerationConfig = () => ({
  maxWarningsPerUser: config.MAX_WARNINGS_PER_USER,
  warningExpiryDays: config.WARNING_EXPIRY_DAYS,
  autoModEnabled: config.AUTO_MOD_ENABLED,
  spam: {
    threshold: config.SPAM_THRESHOLD,
    window: config.SPAM_WINDOW,
  },
});
