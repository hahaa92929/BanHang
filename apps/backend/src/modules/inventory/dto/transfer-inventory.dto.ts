import { IsInt, IsOptional, IsString, MinLength, Min } from 'class-validator';

export class TransferInventoryDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsString()
  @MinLength(2)
  fromWarehouseCode!: string;

  @IsString()
  @MinLength(2)
  toWarehouseCode!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  note?: string;
}
