import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../common/jwt.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';
import { CreateWishlistShareDto } from './dto/create-wishlist-share.dto';
import { WishlistService } from './wishlist.service';

@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @UseGuards(JwtGuard)
  list(@Req() request: RequestWithUser) {
    return this.wishlistService.list(request.user!.sub);
  }

  @Post('items')
  @UseGuards(JwtGuard)
  addItem(@Req() request: RequestWithUser, @Body() body: AddWishlistItemDto) {
    return this.wishlistService.addItem(request.user!.sub, body.productId);
  }

  @Delete('items/:productId')
  @UseGuards(JwtGuard)
  removeItem(@Req() request: RequestWithUser, @Param('productId') productId: string) {
    return this.wishlistService.removeItem(request.user!.sub, productId);
  }

  @Post('items/:productId/move-to-cart')
  @UseGuards(JwtGuard)
  moveToCart(@Req() request: RequestWithUser, @Param('productId') productId: string) {
    return this.wishlistService.moveToCart(request.user!.sub, productId);
  }

  @Get('share/current')
  @UseGuards(JwtGuard)
  currentShare(@Req() request: RequestWithUser) {
    return this.wishlistService.getCurrentShare(request.user!.sub);
  }

  @Post('share')
  @UseGuards(JwtGuard)
  createShare(@Req() request: RequestWithUser, @Body() body: CreateWishlistShareDto) {
    return this.wishlistService.createShare(request.user!.sub, body);
  }

  @Post('share/regenerate')
  @UseGuards(JwtGuard)
  regenerateShare(@Req() request: RequestWithUser, @Body() body: CreateWishlistShareDto) {
    return this.wishlistService.regenerateShare(request.user!.sub, body);
  }

  @Get('shared/:token')
  shared(@Param('token') token: string) {
    return this.wishlistService.getSharedWishlist(token);
  }
}
