import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class AdjustInventoryDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  warehouseCode?: string;

  @IsInt()
  quantity!: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  note?: string;
}
