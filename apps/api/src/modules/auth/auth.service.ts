import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { PrismaClient, UserRole } from '@hosthelper/db';
import { PRISMA } from '../prisma/prisma.module';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly jwt: JwtService,
  ) {}

  // MVP 스텁: 실제로는 NHN/Toss SMS를 호출하여 OTP 발송 후 Redis 저장
  async requestOtp(phone: string) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    // TODO: Redis SET otp:{phone} = code EX 180
    // TODO: NHN 알림톡 또는 SMS 전송
    return { phone, ttlSeconds: 180, devCode: process.env.NODE_ENV !== 'production' ? code : undefined };
  }

  async verifyOtp(phone: string, code: string) {
    // TODO: Redis GET otp:{phone} 비교
    if (code !== '000000' && process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Invalid OTP');
    }
    const otpToken = await this.jwt.signAsync({ sub: phone, purpose: 'otp' }, { expiresIn: '10m' });
    return { otpToken };
  }

  async signup(phone: string, name: string, role: UserRole, otpToken: string) {
    const payload = await this.jwt.verifyAsync<{ sub: string; purpose: string }>(otpToken);
    if (payload.purpose !== 'otp' || payload.sub !== phone) {
      throw new UnauthorizedException('Invalid OTP token');
    }
    const user = await this.prisma.user.upsert({
      where: { phone },
      update: { name, role, phoneVerified: true, status: 'ACTIVE' },
      create: { phone, name, role, phoneVerified: true, status: 'ACTIVE' },
    });
    if (role === 'HOST') {
      await this.prisma.hostProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      });
    } else if (role === 'CLEANER') {
      await this.prisma.cleanerProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      });
    }
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { user, accessToken };
  }
}
