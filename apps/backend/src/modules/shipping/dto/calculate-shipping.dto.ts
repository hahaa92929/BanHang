import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CalculateShippingDto {
  @IsInt()
  @Min(0)
  subtotal!: number;

  @IsIn(['standard', 'express', 'same_day', 'pickup'])
  shippingMethod!: 'standard' | 'express' | 'same_day' | 'pickup';

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsIn(['ghn', 'ghtk', 'jt', 'viettel_post', 'grab_express'])
  carrier?: 'ghn' | 'ghtk' | 'jt' | 'viettel_post' | 'grab_express';

  @IsOptional()
  @IsInt()
  @Min(100)
  weightGrams?: number;
}
