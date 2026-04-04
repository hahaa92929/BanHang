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
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { JwtGuard } from '../../common/jwt.guard';
import { RolesGuard } from '../../common/roles.guard';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@Controller('api/orders')
@UseGuards(JwtGuard)
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  list(@Req() request: RequestWithUser) {
    return this.service.list(request.user.sub, request.user.role);
  }

  @Get(':id')
  detail(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.getById(id, request.user.sub, request.user.role);
  }

  @Post('checkout')
  checkout(@Req() request: RequestWithUser, @Body() body: CheckoutDto) {
    return this.service.checkout(request.user.sub, body);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('admin')
  updateStatus(
    @Req() request: RequestWithUser,
    @Param('id') id: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    return this.service.updateStatus(id, body.status, request.user.sub);
  }
}
