import { z } from 'zod';

// MATCH_STATUS constant with lowercase values
export const MATCH_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINISHED: 'finished',
};

// listMatchesQuerySchema: optional limit coerced to a positive integer with max 100
export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// matchIdParamSchema: required id coerced to a positive integer
export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// Helper to validate ISO date strings (uses Date.parse; rejects NaN)
const isoDateString = z.iso.datetime();

// createMatchSchema: sport, homeTeam, awayTeam as non-empty strings
// startTime and endTime as strings validated as ISO dates, with superRefine to ensure chronological order
export const createMatchSchema = z
  .object({
    sport: z.string().min(1, 'sport is required'),
    homeTeam: z.string().min(1, 'homeTeam is required'),
    awayTeam: z.string().min(1, 'awayTeam is required'),
    startTime: isoDateString,
    endTime: isoDateString,
    homeScore: z.coerce.number().int().nonnegative().optional(),
    awayScore: z.coerce.number().int().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    const start = Date.parse(data.startTime);
    const end = Date.parse(data.endTime);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      // isoDateString refinement should catch this, but be defensive
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startTime and endTime must be valid ISO date strings',
      });
      return;
    }
    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endTime must be after startTime',
        path: ['endTime'],
      });
    }
  });

// updateScoreSchema: require homeScore and awayScore as coerced non-negative integers
export const updateScoreSchema = z.object({
  homeScore: z.coerce.number().int().min(0),
  awayScore: z.coerce.number().int().min(0),
});

