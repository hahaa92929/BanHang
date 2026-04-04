import { Body, Controller, Headers, Post } from '@nestjs/common';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { PaymentsService } from './payments.service';

@Controller('api/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook')
  webhook(
    @Headers('x-webhook-signature') signature: string | undefined,
    @Body() body: PaymentWebhookDto,
  ) {
    return this.paymentsService.processWebhook(signature, body);
  }
}
