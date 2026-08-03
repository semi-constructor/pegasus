import { Router, Request, Response } from 'express';
import { getDatabase } from '../../database/connection';
import { triviaGames } from '../../database/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { z } from 'zod';

const router = Router();

const scheduleTriviaSchema = z.object({
  channelId: z.string(),
  scheduledAt: z.string().datetime(),
  rewardXp: z.number().min(0).default(0),
  rewardCoins: z.number().min(0).default(0),
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().min(0).max(3),
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

    const [game] = await db.insert(triviaGames).values({
      guildId,
      channelId: data.channelId,
      scheduledAt: new Date(data.scheduledAt),
      rewardXp: data.rewardXp,
      rewardCoins: data.rewardCoins,
      questions: [
        {
          question: data.question,
          options: data.options,
          correctIndex: data.correctIndex,
        }
      ],
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
