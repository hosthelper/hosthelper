import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Payment } from '@hosthelper/db';
import { PaymentService } from './payment.service';

@ApiTags('payment')
@Controller('payments')
export class PaymentController {
  constructor(private readonly payment: PaymentService) {}

  @Post('intent/:bookingId')
  intent(@Param('bookingId') bookingId: string) {
    return this.payment.createIntent(bookingId);
  }

  @Post('confirm')
  confirm(
    @Body() body: { orderId: string; paymentKey: string; amount: number },
  ): Promise<Payment> {
    return this.payment.confirm(body.orderId, body.paymentKey, body.amount);
  }
}
