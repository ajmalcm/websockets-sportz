import express from 'express';
import { matchIdParamSchema } from '../validation/matches.js';
import { listCommentaryQuerySchema } from '../validation/commentary.js';
import { createCommentarySchema } from '../validation/commentary.js';
import { db } from '../db/db.js';
import { commentary } from '../db/schema.js';
import { desc, eq } from 'drizzle-orm';

const router = express.Router({ mergeParams: true });

// GET /matches/:id/commentary
router.get('/', async (req, res) => {
  // Validate params
  const paramsParsed = matchIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json({ error: 'Invalid params', details: paramsParsed.error });
  }

  // Validate query
  const queryParsed = listCommentaryQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: queryParsed.error });
  }

  const { id: matchId } = paramsParsed.data;
  const MAX_LIMIT = 100;
  const limit = Math.min(queryParsed.data.limit ?? 100, MAX_LIMIT);

  try {
    const data = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, matchId))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    return res.status(200).json({ data });
  } catch (err) {
    console.error('Failed to fetch commentary', err);
    return res.status(500).json({ error: 'Failed to fetch commentary', details: err?.stack ?? String(err) });
  }
});

// POST /matches/:id/commentary
router.post('/', async (req, res) => {
  // Validate params
  const paramsParsed = matchIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json({ error: 'Invalid params', details: paramsParsed.error });
  }

  // Validate body
  const bodyParsed = createCommentarySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: bodyParsed.error });
  }

  const { id: matchId } = paramsParsed.data;
  const payload = bodyParsed.data;

  try {
    const [created] = await db
      .insert(commentary)
      .values({
        matchId,
        minute: payload.minute ?? null,
        sequence: payload.sequence ?? null,
        period: payload.period ?? null,
        eventType: payload.eventType ?? null,
        actor: payload.actor ?? null,
        team: payload.team ?? null,
        message: payload.message,
        metadata: payload.metadata ?? null,
        tags: payload.tags ?? null,
      })
      .returning();

      if(res.app.locals.broadcastCommentary)
      {
            res.app.locals.broadcastCommentary(created.matchId,created);
      }

    return res.status(201).json({ message: 'Commentary created', data: created });
  } catch (err) {
    console.error('Failed to insert commentary', err);
    return res.status(500).json({ error: 'Failed to create commentary', details: err?.stack ?? String(err) });
  }
});

export default router;