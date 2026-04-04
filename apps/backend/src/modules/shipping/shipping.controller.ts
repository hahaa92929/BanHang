import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtGuard } from '../../common/jwt.guard';
import { PermissionsGuard } from '../../common/permissions.guard';
import { CalculateShippingDto } from './dto/calculate-shipping.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ShippingService } from './shipping.service';

@Controller('shipping')
@UseGuards(JwtGuard)
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('calculate')
  calculate(@Body() body: CalculateShippingDto) {
    return this.shippingService.calculate(body.subtotal, body.shippingMethod, body.province);
  }

  @Post('create')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('shipping.manage')
  create(@Body() body: CreateShipmentDto) {
    return this.shippingService.createShipment(body.orderId);
  }

  @Get('zones/list')
  zones() {
    return this.shippingService.zones();
  }

  @Get(':id/tracking')
  tracking(@Param('id') id: string) {
    return this.shippingService.tracking(id);
  }

  @Post(':id/label')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('shipping.manage')
  label(@Param('id') id: string) {
    return this.shippingService.label(id);
  }
}
