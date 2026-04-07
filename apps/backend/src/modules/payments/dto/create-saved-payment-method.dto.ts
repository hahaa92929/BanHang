import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSavedPaymentMethodDto {
  @IsIn(['vnpay', 'momo', 'zalopay', 'stripe', 'paypal', 'bank_transfer'])
  method!: 'vnpay' | 'momo' | 'zalopay' | 'stripe' | 'paypal' | 'bank_transfer';

  @IsOptional()
  @IsString()
  @MinLength(2)
  gateway?: string;

  @IsString()
  @MinLength(2)
  label!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  brand?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/)
  last4?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  expiryMonth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2024)
  @Max(2100)
  expiryYear?: number;

  @IsString()
  @MinLength(8)
  tokenRef!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  providerCustomerRef?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
