import { z } from 'zod';

export const QuoteInputSchema = z.object({
  district: z.string().optional(),
  pyeong: z.number().positive(),
  bedrooms: z.number().int().nonnegative(),
  cleaningStartAt: z.string().datetime(),
  cleaningEndAt: z.string().datetime(),
});

export const QuoteOutputSchema = z.object({
  total: z.number().int(),
  base: z.number().int(),
  perPyeong: z.number().int(),
  bedroomAdd: z.number().int(),
  nightMultiplier: z.number(),
  holidayMultiplier: z.number(),
  dynamicCoef: z.number(),
  platformFee: z.number().int(),
  cleanerPayout: z.number().int(),
  withholdingTax: z.number().int(),
});

export type QuoteInput = z.infer<typeof QuoteInputSchema>;
export type QuoteOutput = z.infer<typeof QuoteOutputSchema>;
