import { Controller, Get, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtGuard } from '../../common/jwt.guard';
import { PermissionsGuard } from '../../common/permissions.guard';
import { ReportingService } from './reporting.service';

@Controller('reporting')
@UseGuards(JwtGuard, PermissionsGuard)
@Permissions('reporting.read')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('summary')
  summary() {
    return this.reportingService.summary();
  }
}
