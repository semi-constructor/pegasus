import dotenv from 'dotenv';
import { jest } from '@jest/globals';

dotenv.config({ path: '.env.test' });

(process.env as any).NODE_ENV = 'test';
process.env.DISCORD_TOKEN = 'test_token';
process.env.DISCORD_CLIENT_ID = '123456789012345678';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/pegasus_test';
process.env.BOT_API_TOKEN = 'test_api_token_1234567890';
process.env.API_TOKEN = 'test_api_token_secondary';
process.env.DEVELOPER_IDS = '["123456789012345678"]';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';
process.env.SUPPORT_SERVER_INVITE = 'https://example.com/invite';
process.env.DEFAULT_LANGUAGE = 'en';
process.env.LOG_LEVEL = 'error';

global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.setTimeout(10000);

beforeAll(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
});
