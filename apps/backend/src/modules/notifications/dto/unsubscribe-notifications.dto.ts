import { IsIn, IsOptional } from 'class-validator';

export class UnsubscribeNotificationsDto {
  @IsOptional()
  @IsIn(['order', 'system', 'promotion', 'security'])
  type?: 'order' | 'system' | 'promotion' | 'security';

  @IsOptional()
  @IsIn(['in_app', 'email', 'sms', 'push'])
  channel?: 'in_app' | 'email' | 'sms' | 'push';
}
