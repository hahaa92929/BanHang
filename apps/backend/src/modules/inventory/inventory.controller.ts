import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { JwtGuard } from '../../common/jwt.guard';
import { PermissionsGuard } from '../../common/permissions.guard';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('adjust')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('inventory.manage')
  adjust(@Req() request: RequestWithUser, @Body() body: AdjustInventoryDto) {
    return this.inventoryService.adjust(body.productId, body.quantity, request.user!.sub, body.note);
  }

  @Get('movements/list')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('inventory.read')
  movements() {
    return this.inventoryService.movements();
  }

  @Get('low-stock/list')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('inventory.read')
  lowStock() {
    return this.inventoryService.lowStock();
  }

  @Get(':sku')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('inventory.read')
  check(@Param('sku') sku: string) {
    return this.inventoryService.checkStock(sku);
  }
}
