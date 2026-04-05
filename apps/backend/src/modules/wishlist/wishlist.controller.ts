import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../common/jwt.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';
import { WishlistService } from './wishlist.service';

@Controller('wishlist')
@UseGuards(JwtGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  list(@Req() request: RequestWithUser) {
    return this.wishlistService.list(request.user!.sub);
  }

  @Post('items')
  addItem(@Req() request: RequestWithUser, @Body() body: AddWishlistItemDto) {
    return this.wishlistService.addItem(request.user!.sub, body.productId);
  }

  @Delete('items/:productId')
  removeItem(@Req() request: RequestWithUser, @Param('productId') productId: string) {
    return this.wishlistService.removeItem(request.user!.sub, productId);
  }
}
