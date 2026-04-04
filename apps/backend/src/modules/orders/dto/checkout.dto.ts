import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class AddressDto {
  @IsString()
  @MinLength(2)
  receiverName!: string;

  @IsString()
  @MinLength(8)
  phone!: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsString()
  @IsNotEmpty()
  district!: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsString()
  @MinLength(4)
  addressLine!: string;

  @IsString()
  @IsNotEmpty()
  country!: string;
}

export class CheckoutDto {
  @IsString()
  @IsNotEmpty()
  reservationId!: string;

  @IsOptional()
  @IsString()
  addressId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @IsBoolean()
  saveAddress?: boolean;

  @IsIn(['cod', 'vnpay', 'momo', 'zalopay', 'stripe', 'paypal', 'bank_transfer'])
  paymentMethod!:
    | 'cod'
    | 'vnpay'
    | 'momo'
    | 'zalopay'
    | 'stripe'
    | 'paypal'
    | 'bank_transfer';

  @IsIn(['standard', 'express', 'same_day', 'pickup'])
  shippingMethod!: 'standard' | 'express' | 'same_day' | 'pickup';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
