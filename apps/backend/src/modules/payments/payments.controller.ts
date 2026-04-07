import { Body, Controller, Delete, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtGuard } from '../../common/jwt.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { PermissionsGuard } from '../../common/permissions.guard';
import { CreateSavedPaymentMethodDto } from './dto/create-saved-payment-method.dto';
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

  @Get('saved-methods')
  @UseGuards(JwtGuard)
  savedMethods(@Req() request: RequestWithUser) {
    return this.paymentsService.listSavedMethods(request.user!.sub);
  }

  @Post('saved-methods')
  @UseGuards(JwtGuard)
  createSavedMethod(@Req() request: RequestWithUser, @Body() body: CreateSavedPaymentMethodDto) {
    return this.paymentsService.createSavedMethod(request.user!.sub, body);
  }

  @Post('saved-methods/:id/default')
  @UseGuards(JwtGuard)
  setDefaultSavedMethod(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.paymentsService.setDefaultSavedMethod(request.user!.sub, id);
  }

  @Delete('saved-methods/:id')
  @UseGuards(JwtGuard)
  removeSavedMethod(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.paymentsService.removeSavedMethod(request.user!.sub, id);
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
