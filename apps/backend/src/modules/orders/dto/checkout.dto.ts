import { Type } from 'class-transformer';
import {
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

  @IsString()
  @MinLength(4)
  line1!: string;

  @IsString()
  @IsNotEmpty()
  district!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  country!: string;
}

export class CheckoutDto {
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @IsIn(['cod', 'vnpay', 'momo'])
  paymentMethod!: 'cod' | 'vnpay' | 'momo';

  @IsIn(['standard', 'express'])
  shippingMethod!: 'standard' | 'express';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
