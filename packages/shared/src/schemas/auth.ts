import { z } from 'zod';

export const PhoneSchema = z
  .string()
  .regex(/^01[016789]\d{7,8}$/, '유효한 휴대폰 번호가 아닙니다');

export const RequestOtpSchema = z.object({
  phone: PhoneSchema,
});

export const VerifyOtpSchema = z.object({
  phone: PhoneSchema,
  code: z.string().length(6),
});

export const SignupSchema = z.object({
  phone: PhoneSchema,
  name: z.string().min(2).max(40),
  role: z.enum(['HOST', 'CLEANER']),
  otpToken: z.string().min(10),
});

export type RequestOtpDto = z.infer<typeof RequestOtpSchema>;
export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;
export type SignupDto = z.infer<typeof SignupSchema>;
