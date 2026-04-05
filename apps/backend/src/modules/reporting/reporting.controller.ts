import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthOrApiKeyGuard } from '../../common/auth-or-api-key.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/permissions.guard';
import { ReportingService } from './reporting.service';

@Controller('reporting')
@UseGuards(AuthOrApiKeyGuard, PermissionsGuard)
@Permissions('reporting.read')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('summary')
  summary() {
    return this.reportingService.summary();
  }

  @Get('revenue')
  revenue(@Query('days') days?: string) {
    return this.reportingService.revenue(Number(days) || 7);
  }

  @Get('top-products')
  topProducts(@Query('limit') limit?: string) {
    return this.reportingService.topProducts(Number(limit) || 10);
  }

  @Get('coupon-usage')
  couponUsage(@Query('limit') limit?: string) {
    return this.reportingService.couponUsage(Number(limit) || 10);
  }
}
