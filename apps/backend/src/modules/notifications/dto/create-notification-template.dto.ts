import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateNotificationTemplateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  key!: string;

  @IsIn(['in_app', 'email', 'sms', 'push'])
  channel!: 'in_app' | 'email' | 'sms' | 'push';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subjectTemplate?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  titleTemplate!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  contentTemplate!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
