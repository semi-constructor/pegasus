import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync } from 'node:fs';
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../database/connection';
import { guilds, users } from '../database/schema';
import { logger } from '../utils/logger';

const localeContext = new AsyncLocalStorage<string>();

function resolveLocalesLoadPath(): string {
  const candidates = [
    join(__dirname, 'locales'),
    join(process.cwd(), 'src', 'i18n', 'locales'),
    join(process.cwd(), 'dist', 'i18n', 'locales'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return join(candidate, '{{lng}}.json');
    }
  }

  const fallbackPath = join(__dirname, 'locales', '{{lng}}.json');
  logger.warn(`Falling back to default locales path: ${fallbackPath}`);
  return fallbackPath;
}

export async function initializeI18n(): Promise<void> {
  try {
    await i18next.use(Backend).init({
      backend: {
        loadPath: resolveLocalesLoadPath(),
      },
      fallbackLng: 'en',
      lng: 'en',
      supportedLngs: ['en', 'es', 'fr', 'de', 'nl', 'pt', 'ru', 'ja', 'ko', 'zh'],
      preload: ['en'],
      interpolation: {
        escapeValue: false,
      },
      returnObjects: true,
      debug: false,
    });

    logger.info('i18n initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize i18n:', error);
    throw error;
  }
}

export function t(key: string, options?: Record<string, unknown>): string {
  const contextLocale = localeContext.getStore();
  const mergedOptions = options ? { ...options } : {};

  if (contextLocale && mergedOptions.lng === undefined) {
    mergedOptions.lng = contextLocale;
  }

  const translation = i18next.t(key, mergedOptions);

  if (translation === key && mergedOptions.lng !== 'en') {
    return i18next.t(key, { ...mergedOptions, lng: 'en' });
  }

  return translation;
}

export function setLanguage(language: string): void {
  void i18next.changeLanguage(language);
}

// Guild locale management
const guildLocales = new Map<string, string>();

export function setGuildLocale(guildId: string, locale: string): void {
  guildLocales.set(guildId, normalizeLocale(locale));
}

export function getGuildLocale(guildId: string): string {
  return guildLocales.get(guildId) || 'en';
}

export function clearGuildLocale(guildId: string): void {
  guildLocales.delete(guildId);
}

// User locale management
const userLocales = new Map<string, string>();

export function setUserLocale(userId: string, locale: string): void {
  userLocales.set(userId, normalizeLocale(locale));
}

export function getUserLocale(userId: string): string {
  return userLocales.get(userId) || 'en';
}

export function clearUserLocale(userId: string): void {
  userLocales.delete(userId);
}

export const availableLocales = ['en', 'de', 'es', 'fr'];

// Type for locale object structure
export interface LocaleObject {
  common: {
    error: string;
    success: string;
    [key: string]: string;
  };
  commands: {
    xp: {
      rank: {
        noData: string;
        [key: string]: string;
      };
      levelUp: {
        defaultMessage: string;
        title: string;
        rolesEarned: string;
        [key: string]: string;
      };
      leaderboard: {
        title: string;
        noData: string;
        position: string;
        level: string;
        xp: string;
        [key: string]: string;
      };
      configuration: {
        title: string;
        [key: string]: string;
      };
      card: {
        invalidColor: string;
        savedNoPreview: string;
        savedTitle: string;
        savedDescription: string;
        backgroundColor: string;
        progressBarColor: string;
        textColor: string;
        accentColor: string;
        [key: string]: string;
      };
      [key: string]: Record<string, unknown>;
    };
    [key: string]: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export { i18next };

async function fetchUserLocale(userId: string): Promise<string | undefined> {
  if (!userId) return undefined;

  const cached = userLocales.get(userId);
  if (cached) return cached;

  try {
    const db = getDatabase();
    const [result] = await db
      .select({ preferredLocale: users.preferredLocale })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (result?.preferredLocale) {
      const preferred = normalizeLocale(result.preferredLocale);
      userLocales.set(userId, preferred);
      return preferred;
    }
  } catch (error) {
    logger.debug(`Failed to fetch user locale for ${userId}:`, error);
  }

  return undefined;
}

async function fetchGuildLocale(guildId: string): Promise<string | undefined> {
  if (!guildId) return undefined;

  const cached = guildLocales.get(guildId);
  if (cached) return cached;

  try {
    const db = getDatabase();
    const [result] = await db
      .select({ language: guilds.language })
      .from(guilds)
      .where(eq(guilds.id, guildId))
      .limit(1);

    if (result?.language) {
      const language = normalizeLocale(result.language);
      guildLocales.set(guildId, language);
      return language;
    }
  } catch (error) {
    logger.debug(`Failed to fetch guild locale for ${guildId}:`, error);
  }

  return undefined;
}

export async function resolveLocale(userId?: string, guildId?: string | null): Promise<string> {
  const [userLocale, guildLocale] = await Promise.all([
    userId ? fetchUserLocale(userId) : Promise.resolve(undefined),
    guildId ? fetchGuildLocale(guildId) : Promise.resolve(undefined),
  ]);

  const locale = normalizeLocale(userLocale || guildLocale);
  await ensureLocaleResources(locale);
  return locale;
}

export async function withLocale<T>(locale: string, callback: () => Promise<T>): Promise<T> {
  return localeContext.run(locale, callback);
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

function deepMerge(target: any, ...sources: any[]): any {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

export async function getTranslation(guildId: string, userId: string): Promise<LocaleObject> {
  const locale = await resolveLocale(userId, guildId);
  const bundle = i18next.getResourceBundle(locale, 'translation') as LocaleObject | undefined;
  const enBundle = (i18next.getResourceBundle('en', 'translation') as LocaleObject) || ({} as LocaleObject);

  if (bundle && locale !== 'en') {
    return deepMerge({}, enBundle, bundle);
  }

  return enBundle;
}

async function ensureLocaleResources(locale: string): Promise<void> {
  if (i18next.hasResourceBundle(locale, 'translation')) {
    return;
  }

  try {
    await i18next.loadLanguages(locale);
  } catch (error) {
    logger.debug(`Failed to load resources for locale ${locale}:`, error);
  }
}

function normalizeLocale(locale?: string): string {
  if (!locale) {
    return 'en';
  }

  const lower = locale.toLowerCase();
  if (availableLocales.includes(lower)) {
    return lower;
  }

  const base = lower.split('-')[0];
  if (availableLocales.includes(base)) {
    return base;
  }

  return 'en';
}
