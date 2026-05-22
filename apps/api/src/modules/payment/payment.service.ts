import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { PrismaClient, Payment } from '@hosthelper/db';
import { PRISMA } from '../prisma/prisma.module';

// 토스페이먼츠 에스크로 결제 시나리오:
// 1. 호스트가 booking 생성 후 결제 시도 → /payments/intent (orderId, amount)
// 2. 프론트에서 토스 SDK 호출 → 성공 시 paymentKey 받음
// 3. /payments/confirm 호출 → 토스 API confirm → DB 상태 PAID
// 4. 청소 완료 + 호스트 승인 → Payout 큐에 enqueue (T+2)
// 5. 분쟁 시 부분취소 가능

interface TossConfirmResponse {
  paymentKey: string;
  orderId: string;
  status: string;
  approvedAt: string;
  method: string;
}

@Injectable()
export class PaymentService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async createIntent(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Booking is not awaiting payment');
    }
    const orderId = `hh_${booking.id}_${Date.now()}`;
    const payment = await this.prisma.payment.upsert({
      where: { bookingId },
      update: { orderId, amount: booking.quotedPrice, status: 'READY' },
      create: { bookingId, orderId, amount: booking.quotedPrice, status: 'READY' },
    });
    return {
      paymentId: payment.id,
      orderId,
      amount: booking.quotedPrice,
      clientKey: process.env.TOSS_CLIENT_KEY,
    };
  }

  async confirm(orderId: string, paymentKey: string, amount: number): Promise<Payment> {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { orderId } });
    if (payment.amount !== amount) {
      throw new BadRequestException('Amount mismatch');
    }
    const tossRes = await this.callTossConfirm(paymentKey, orderId, amount);

    const updated: Payment = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: payment.id },
        data: {
          pgPaymentKey: tossRes.paymentKey,
          status: 'PAID',
          method: tossRes.method,
          approvedAt: new Date(tossRes.approvedAt),
          rawResponse: tossRes as never,
        },
      });
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: 'CONFIRMED' },
      });
      return p;
    });
    return updated;
  }

  // 실제 토스페이먼츠 API 호출. 멱등키 사용 권장.
  private async callTossConfirm(
    paymentKey: string,
    orderId: string,
    amount: number,
  ): Promise<TossConfirmResponse> {
    const secret = process.env.TOSS_SECRET_KEY;
    if (!secret) {
      // 개발 모드 stub
      return {
        paymentKey,
        orderId,
        status: 'DONE',
        approvedAt: new Date().toISOString(),
        method: 'CARD',
      };
    }
    const auth = Buffer.from(`${secret}:`).toString('base64');
    const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': orderId,
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new BadRequestException({ message: 'Toss confirm failed', err });
    }
    return (await res.json()) as TossConfirmResponse;
  }
}
