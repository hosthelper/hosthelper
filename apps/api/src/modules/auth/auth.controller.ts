import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestOtpSchema, VerifyOtpSchema, SignupSchema } from '@hosthelper/shared';
import { ZodPipe } from '../../common/zod.pipe';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  request(@Body(new ZodPipe(RequestOtpSchema)) body: { phone: string }) {
    return this.auth.requestOtp(body.phone);
  }

  @Post('otp/verify')
  verify(@Body(new ZodPipe(VerifyOtpSchema)) body: { phone: string; code: string }) {
    return this.auth.verifyOtp(body.phone, body.code);
  }

  @Post('signup')
  signup(
    @Body(new ZodPipe(SignupSchema))
    body: { phone: string; name: string; role: 'HOST' | 'CLEANER'; otpToken: string },
  ) {
    return this.auth.signup(body.phone, body.name, body.role, body.otpToken);
  }
}
