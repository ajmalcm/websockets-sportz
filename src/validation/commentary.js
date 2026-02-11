import { z } from 'zod';

// listCommentaryQuerySchema: optional limit coerced to a positive integer with max 100
export const listCommentaryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// createCommentarySchema: fields for minutes (non-negative int), sequence (non-negative int),
// period (string), eventType (string), actor (string), team (string),
// message (required non-empty string), metadata (record), tags (array of strings)
export const createCommentarySchema = z.object({
  minute: z.coerce.number().int().min(0).optional(),
  sequence: z.coerce.number().int().min(0).optional(),
  period: z.string().optional(),
  eventType: z.string().optional(),
  actor: z.string().optional(),
  team: z.string().optional(),
  message: z.string().min(1, 'message is required'),
  metadata: z.record(z.string(),z.any()).optional(),
  tags: z.array(z.string()).optional(),
});

export default { listCommentaryQuerySchema, createCommentarySchema };
