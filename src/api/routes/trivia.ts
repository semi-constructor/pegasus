import { Router, Request, Response } from 'express';
import { getDatabase } from '../../database/connection';
import { triviaGames } from '../../database/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { z } from 'zod';

const router = Router();

import { getGuildLocale } from '../../i18n';
import fs from 'fs';
import path from 'path';

const questionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().min(0).max(3),
});

const scheduleTriviaSchema = z.object({
  channelId: z.string(),
  scheduledAt: z.string().datetime(),
  rewardXp: z.number().min(0).default(0),
  rewardCoins: z.number().min(0).default(0),
  type: z.enum(['preset', 'custom']).default('custom'),
  preset: z.enum(['general', 'gaming', 'programming', 'science', 'history', 'movies']).optional(),
  questionCount: z.number().min(1).max(25).optional(),
  questions: z.array(questionSchema).max(25).optional(),
});

router.post('/:guildId/trivia', async (req: Request, res: Response) => {
  const { guildId } = req.params;

  try {
    const validation = scheduleTriviaSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const data = validation.data;
    const db = getDatabase();

    let gameQuestions: any[] = [];
    if (data.type === 'preset' && data.preset && data.questionCount) {
      const locale = getGuildLocale(guildId);
      try {
        const localeData = JSON.parse(fs.readFileSync(path.join(__dirname, `../../i18n/locales/${locale}.json`), 'utf-8'));
        const presetQuestions = localeData.trivia?.presets?.[data.preset] || [];
        const shuffled = [...presetQuestions].sort(() => 0.5 - Math.random());
        gameQuestions = shuffled.slice(0, data.questionCount);
      } catch (e) {
        logger.error('Failed to load presets', e);
        return res.status(500).json({ error: 'Failed to load presets' });
      }
    } else if (data.type === 'custom' && data.questions && data.questions.length > 0) {
      gameQuestions = data.questions;
    } else {
      return res.status(400).json({ error: 'Invalid question configuration' });
    }

    const [game] = await db.insert(triviaGames).values({
      guildId,
      channelId: data.channelId,
      scheduledAt: new Date(data.scheduledAt),
      rewardXp: data.rewardXp,
      rewardCoins: data.rewardCoins,
      questions: gameQuestions,
      status: 'scheduled',
    }).returning();

    logger.info(`Scheduled trivia game in guild ${guildId} for ${data.scheduledAt}`);

    return res.status(201).json({
      success: true,
      triviaId: game.id,
    });
  } catch (error) {
    logger.error('Error scheduling trivia:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to schedule trivia game',
    });
  }
});

router.get('/:guildId/trivia', async (req: Request, res: Response) => {
  const { guildId } = req.params;

  try {
    const db = getDatabase();
    const games = await db
      .select()
      .from(triviaGames)
      .where(eq(triviaGames.guildId, guildId));

    return res.json({ success: true, games });
  } catch (error) {
    logger.error('Error fetching trivia:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch trivia games',
    });
  }
});

router.delete('/:guildId/trivia/:triviaId', async (req: Request, res: Response) => {
  const { guildId, triviaId } = req.params;

  try {
    const db = getDatabase();
    await db
      .delete(triviaGames)
      .where(and(eq(triviaGames.id, triviaId), eq(triviaGames.guildId, guildId)));

    return res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting trivia:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete trivia game',
    });
  }
});

export const triviaRouter = router;
