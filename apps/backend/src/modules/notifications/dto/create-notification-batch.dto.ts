import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class CreateNotificationBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  userIds!: string[];

  @IsIn(['order', 'system', 'promotion', 'security'])
  type!: 'order' | 'system' | 'promotion' | 'security';

  @IsIn(['in_app', 'email', 'sms', 'push'])
  channel!: 'in_app' | 'email' | 'sms' | 'push';

  @IsOptional()
  @IsString()
  templateId?: string;

  @ValidateIf((payload: CreateNotificationBatchDto) => !payload.templateId)
  @IsString()
  title?: string;

  @ValidateIf((payload: CreateNotificationBatchDto) => !payload.templateId)
  @IsString()
  content?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @IsOptional()
  @IsString()
  campaignKey?: string;
}
