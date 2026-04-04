import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtGuard } from '../../common/jwt.guard';
import { PermissionsGuard } from '../../common/permissions.guard';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('methods')
  methods() {
    return this.paymentsService.listMethods();
  }

  @Post()
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('payments.manage')
  initiate(@Body() body: InitiatePaymentDto) {
    return this.paymentsService.initiate(body);
  }

  @Get(':id')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('payments.manage')
  status(@Param('id') id: string) {
    return this.paymentsService.getStatus(id);
  }

  @Post(':id/refund')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('payments.manage')
  refund(@Param('id') id: string, @Body() body: RefundPaymentDto) {
    return this.paymentsService.refund(id, body);
  }

  @Post('webhook/:gateway')
  webhook(
    @Param('gateway') gateway: string,
    @Headers('x-webhook-signature') signature: string | undefined,
    @Body() body: PaymentWebhookDto,
  ) {
    return this.paymentsService.processWebhook(gateway, signature, body);
  }
}
