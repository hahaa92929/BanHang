import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class PaymentWebhookDto {
  @IsString()
  @MinLength(3)
  eventId!: string;

  @IsString()
  @MinLength(3)
  type!: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
