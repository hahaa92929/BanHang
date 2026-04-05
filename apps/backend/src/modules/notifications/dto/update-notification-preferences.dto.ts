import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  orderInApp?: boolean;

  @IsOptional()
  @IsBoolean()
  orderEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  promotionInApp?: boolean;

  @IsOptional()
  @IsBoolean()
  promotionEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  securityInApp?: boolean;

  @IsOptional()
  @IsBoolean()
  securityEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  systemInApp?: boolean;

  @IsOptional()
  @IsBoolean()
  systemEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;
}
