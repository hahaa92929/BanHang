import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../common/jwt.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Req() request: RequestWithUser) {
    return this.notificationsService.list(request.user!.sub);
  }

  @Patch(':id/read')
  markRead(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.notificationsService.markRead(request.user!.sub, id);
  }

  @Patch('read/all')
  markAllRead(@Req() request: RequestWithUser) {
    return this.notificationsService.markAllRead(request.user!.sub);
  }
}
