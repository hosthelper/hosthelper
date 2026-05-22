import { z } from 'zod';

export const MatchScoreBreakdownSchema = z.object({
  cleanerId: z.string(),
  score: z.number().min(0).max(2),
  distanceKm: z.number().min(0),
  ratingScore: z.number().min(0).max(1),
  completedScore: z.number().min(0).max(1),
  rebookingScore: z.number().min(0).max(1),
  declinePenalty: z.number().min(0).max(1),
});

export const MatchingWeightsSchema = z.object({
  wDistance: z.number().min(0).max(1),
  wRating: z.number().min(0).max(1),
  wCompleted: z.number().min(0).max(1),
  wRebooking: z.number().min(0).max(1),
  wDeclinePenalty: z.number().min(0).max(1),
  newCleanerBoost: z.number().min(0).max(1),
  maxDistanceKm: z.number().int().positive(),
  topN: z.number().int().positive(),
  offerTtlMinutes: z.number().int().positive(),
  maxRounds: z.number().int().positive(),
});

export type MatchScoreBreakdown = z.infer<typeof MatchScoreBreakdownSchema>;
export type MatchingWeights = z.infer<typeof MatchingWeightsSchema>;
