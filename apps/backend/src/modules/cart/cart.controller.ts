import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../../common/jwt.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { MergeCartDto } from './dto/merge-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Controller('cart')
@UseGuards(JwtGuard)
export class CartController {
  constructor(private readonly service: CartService) {}

  @Get()
  getCart(@Req() request: RequestWithUser) {
    return this.service.getCart(request.user!.sub);
  }

  @Post('items')
  addItem(@Req() request: RequestWithUser, @Body() body: AddCartItemDto) {
    return this.service.addItem(request.user!.sub, body.productId, body.quantity, body.variantId);
  }

  @Patch('items/:productId')
  updateQuantity(
    @Req() request: RequestWithUser,
    @Param('productId') productId: string,
    @Body() body: UpdateCartItemDto,
    @Query('variantId') variantId?: string,
  ) {
    return this.service.setQuantity(request.user!.sub, productId, body.quantity, variantId);
  }

  @Delete('items/:productId')
  remove(
    @Req() request: RequestWithUser,
    @Param('productId') productId: string,
    @Query('variantId') variantId?: string,
  ) {
    return this.service.removeItem(request.user!.sub, productId, variantId);
  }

  @Post('merge')
  merge(@Req() request: RequestWithUser, @Body() body: MergeCartDto) {
    return this.service.merge(request.user!.sub, body.items);
  }

  @Post('coupon')
  applyCoupon(@Req() request: RequestWithUser, @Body() body: ApplyCouponDto) {
    return this.service.applyCoupon(request.user!.sub, body.code);
  }

  @Delete('coupon')
  removeCoupon(@Req() request: RequestWithUser) {
    return this.service.removeCoupon(request.user!.sub);
  }

  @Post('save-for-later/:productId')
  saveForLater(
    @Req() request: RequestWithUser,
    @Param('productId') productId: string,
    @Query('variantId') variantId?: string,
  ) {
    return this.service.saveForLater(request.user!.sub, productId, variantId);
  }

  @Delete('clear')
  clear(@Req() request: RequestWithUser) {
    return this.service.clear(request.user!.sub);
  }
}
