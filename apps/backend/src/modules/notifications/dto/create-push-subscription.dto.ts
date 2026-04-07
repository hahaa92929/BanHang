import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreatePushSubscriptionDto {
  @IsUrl()
  endpoint!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(512)
  p256dh!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  auth!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  userAgent?: string;
}
