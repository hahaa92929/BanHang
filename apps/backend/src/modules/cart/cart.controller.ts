import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../../common/jwt.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Controller('api/cart')
@UseGuards(JwtGuard)
export class CartController {
  constructor(private readonly service: CartService) {}

  @Get()
  getCart(@Req() request: RequestWithUser) {
    return this.service.getCart(request.user.sub);
  }

  @Post('items')
  addItem(@Req() request: RequestWithUser, @Body() body: AddCartItemDto) {
    return this.service.addItem(request.user.sub, body.productId, body.quantity);
  }

  @Patch('items/:productId')
  updateQuantity(
    @Req() request: RequestWithUser,
    @Param('productId') productId: string,
    @Body() body: UpdateCartItemDto,
  ) {
    return this.service.setQuantity(request.user.sub, productId, body.quantity);
  }

  @Delete('items/:productId')
  remove(@Req() request: RequestWithUser, @Param('productId') productId: string) {
    return this.service.removeItem(request.user.sub, productId);
  }

  @Delete('clear')
  clear(@Req() request: RequestWithUser) {
    return this.service.clear(request.user.sub);
  }
}
