import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtGuard } from '../../common/jwt.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { PermissionsGuard } from '../../common/permissions.guard';
import { CreateNotificationBatchDto } from './dto/create-notification-batch.dto';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';
import { DispatchAbandonedCartRemindersDto } from './dto/dispatch-abandoned-cart-reminders.dto';
import { DispatchScheduledNotificationsDto } from './dto/dispatch-scheduled-notifications.dto';
import { PreviewNotificationTemplateDto } from './dto/preview-notification-template.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { UnsubscribeNotificationsDto } from './dto/unsubscribe-notifications.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Req() request: RequestWithUser, @Query() query: QueryNotificationsDto) {
    return this.notificationsService.list(request.user!.sub, query);
  }

  @Patch(':id/read')
  markRead(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.notificationsService.markRead(request.user!.sub, id);
  }

  @Patch(':id/click')
  trackClick(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.notificationsService.trackClick(request.user!.sub, id);
  }

  @Patch('read/all')
  markAllRead(@Req() request: RequestWithUser) {
    return this.notificationsService.markAllRead(request.user!.sub);
  }

  @Get('preferences/current')
  preferences(@Req() request: RequestWithUser) {
    return this.notificationsService.getPreferences(request.user!.sub);
  }

  @Patch('preferences/current')
  updatePreferences(@Req() request: RequestWithUser, @Body() body: UpdateNotificationPreferencesDto) {
    return this.notificationsService.updatePreferences(request.user!.sub, body);
  }

  @Post('preferences/unsubscribe')
  unsubscribe(@Req() request: RequestWithUser, @Body() body: UnsubscribeNotificationsDto) {
    return this.notificationsService.unsubscribe(request.user!.sub, body);
  }

  @Get('push/subscriptions')
  pushSubscriptions(@Req() request: RequestWithUser) {
    return this.notificationsService.listPushSubscriptions(request.user!.sub);
  }

  @Post('push/subscriptions')
  savePushSubscription(@Req() request: RequestWithUser, @Body() body: CreatePushSubscriptionDto) {
    return this.notificationsService.savePushSubscription(request.user!.sub, body);
  }

  @Delete('push/subscriptions/:id')
  removePushSubscription(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.notificationsService.removePushSubscription(request.user!.sub, id);
  }

  @Get('templates/list')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('notifications.manage')
  templates(@Query('channel') channel?: 'in_app' | 'email' | 'sms' | 'push') {
    return this.notificationsService.listTemplates(channel);
  }

  @Post('templates')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('notifications.manage')
  createTemplate(@Body() body: CreateNotificationTemplateDto) {
    return this.notificationsService.createTemplate(body);
  }

  @Patch('templates/:id')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('notifications.manage')
  updateTemplate(@Param('id') id: string, @Body() body: UpdateNotificationTemplateDto) {
    return this.notificationsService.updateTemplate(id, body);
  }

  @Post('templates/:id/preview')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('notifications.manage')
  previewTemplate(@Param('id') id: string, @Body() body: PreviewNotificationTemplateDto) {
    return this.notificationsService.previewTemplate(id, body.data);
  }

  @Post('batch')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('notifications.manage')
  createBatch(@Body() body: CreateNotificationBatchDto) {
    return this.notificationsService.createBatch(body);
  }

  @Post('dispatch')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('notifications.manage')
  dispatch(@Body() body: DispatchScheduledNotificationsDto) {
    return this.notificationsService.dispatchScheduled(body);
  }

  @Post('dispatch/abandoned-cart')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('notifications.manage')
  dispatchAbandonedCart(@Body() body: DispatchAbandonedCartRemindersDto) {
    return this.notificationsService.dispatchAbandonedCartReminders(body);
  }
}
