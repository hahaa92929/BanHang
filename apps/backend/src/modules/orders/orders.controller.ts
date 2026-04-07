import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { JwtGuard } from '../../common/jwt.guard';
import { PermissionsGuard } from '../../common/permissions.guard';
import { CheckoutDto } from './dto/checkout.dto';
import { CreateOrderNoteDto } from './dto/create-order-note.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtGuard)
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get('reservations/current')
  currentReservation(@Req() request: RequestWithUser) {
    return this.service.getCurrentReservation(request.user!.sub);
  }

  @Post('reservations')
  reserve(@Req() request: RequestWithUser) {
    return this.service.createReservationFromCart(request.user!.sub);
  }

  @Post('reservations/:id/cancel')
  cancelReservation(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.cancelReservation(id, request.user!.sub, request.user!.role);
  }

  @Post('reservations/release-expired')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('orders.manage')
  releaseExpired(@Req() request: RequestWithUser) {
    return this.service.releaseExpiredReservations(request.user!.sub);
  }

  @Get()
  list(@Req() request: RequestWithUser) {
    return this.service.list(request.user!.sub, request.user!.role);
  }

  @Post()
  createOrder(@Req() request: RequestWithUser, @Body() body: CheckoutDto) {
    return this.service.checkout(request.user!.sub, body);
  }

  @Post('checkout')
  checkout(@Req() request: RequestWithUser, @Body() body: CheckoutDto) {
    return this.service.checkout(request.user!.sub, body);
  }

  @Get(':id/invoice')
  invoice(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.getInvoice(id, request.user!.sub, request.user!.role);
  }

  @Get(':id/tracking')
  tracking(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.getTracking(id, request.user!.sub, request.user!.role);
  }

  @Post(':id/cancel')
  cancelOrder(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.cancelOrder(id, request.user!.sub, request.user!.role);
  }

  @Post(':id/return')
  requestReturn(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.requestReturn(id, request.user!.sub, request.user!.role);
  }

  @Patch(':id/status')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('orders.manage')
  updateStatus(
    @Req() request: RequestWithUser,
    @Param('id') id: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    return this.service.updateStatus(id, body.status, request.user!.sub);
  }

  @Get(':id/notes')
  notes(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.listNotes(id, request.user!.sub, request.user!.role);
  }

  @Post(':id/notes')
  addNote(
    @Req() request: RequestWithUser,
    @Param('id') id: string,
    @Body() body: CreateOrderNoteDto,
  ) {
    return this.service.addNote(id, request.user!.sub, request.user!.role, body);
  }

  @Get(':id')
  detail(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.getById(id, request.user!.sub, request.user!.role);
  }
}
