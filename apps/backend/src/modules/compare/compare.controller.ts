import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../common/jwt.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { AddCompareItemDto } from './dto/add-compare-item.dto';
import { CompareService } from './compare.service';

@Controller('compare')
@UseGuards(JwtGuard)
export class CompareController {
  constructor(private readonly compareService: CompareService) {}

  @Get()
  list(@Req() request: RequestWithUser) {
    return this.compareService.list(request.user!.sub);
  }

  @Post('items')
  addItem(@Req() request: RequestWithUser, @Body() body: AddCompareItemDto) {
    return this.compareService.addItem(request.user!.sub, body.productId);
  }

  @Delete('items/:productId')
  removeItem(@Req() request: RequestWithUser, @Param('productId') productId: string) {
    return this.compareService.removeItem(request.user!.sub, productId);
  }

  @Delete('clear')
  clear(@Req() request: RequestWithUser) {
    return this.compareService.clear(request.user!.sub);
  }
}
