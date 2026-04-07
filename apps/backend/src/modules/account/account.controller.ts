import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../common/jwt.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { AccountService } from './account.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { QueryAccountOrdersDto } from './dto/query-account-orders.dto';
import { RedeemLoyaltyDto } from './dto/redeem-loyalty.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('account')
@UseGuards(JwtGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('dashboard')
  dashboard(@Req() request: RequestWithUser) {
    return this.accountService.dashboard(request.user!.sub);
  }

  @Get('orders')
  orders(@Req() request: RequestWithUser, @Query() query: QueryAccountOrdersDto) {
    return this.accountService.listOrders(request.user!.sub, query);
  }

  @Post('orders/:id/reorder')
  reorder(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.accountService.reorder(request.user!.sub, id);
  }

  @Get('loyalty')
  loyalty(@Req() request: RequestWithUser) {
    return this.accountService.loyalty(request.user!.sub);
  }

  @Post('loyalty/redeem')
  redeemLoyalty(@Req() request: RequestWithUser, @Body() body: RedeemLoyaltyDto) {
    return this.accountService.redeemLoyalty(request.user!.sub, body);
  }

  @Get('referral')
  referral(@Req() request: RequestWithUser) {
    return this.accountService.referral(request.user!.sub);
  }

  @Post('referral/regenerate')
  regenerateReferralCode(@Req() request: RequestWithUser) {
    return this.accountService.regenerateReferralCode(request.user!.sub);
  }

  @Get('profile')
  profile(@Req() request: RequestWithUser) {
    return this.accountService.profile(request.user!.sub);
  }

  @Patch('profile')
  updateProfile(@Req() request: RequestWithUser, @Body() body: UpdateProfileDto) {
    return this.accountService.updateProfile(request.user!.sub, body);
  }

  @Get('addresses')
  addresses(@Req() request: RequestWithUser) {
    return this.accountService.listAddresses(request.user!.sub);
  }

  @Post('addresses')
  createAddress(@Req() request: RequestWithUser, @Body() body: CreateAddressDto) {
    return this.accountService.createAddress(request.user!.sub, body);
  }

  @Patch('addresses/:id')
  updateAddress(
    @Req() request: RequestWithUser,
    @Param('id') id: string,
    @Body() body: UpdateAddressDto,
  ) {
    return this.accountService.updateAddress(request.user!.sub, id, body);
  }

  @Post('addresses/:id/default')
  setDefaultAddress(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.accountService.setDefaultAddress(request.user!.sub, id);
  }

  @Delete('addresses/:id')
  deleteAddress(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.accountService.deleteAddress(request.user!.sub, id);
  }

  @Get('export')
  exportData(@Req() request: RequestWithUser) {
    return this.accountService.exportData(request.user!.sub);
  }

  @Delete()
  deleteAccount(@Req() request: RequestWithUser, @Body() body: DeleteAccountDto) {
    return this.accountService.deleteAccount(request.user!.sub, body);
  }
}
