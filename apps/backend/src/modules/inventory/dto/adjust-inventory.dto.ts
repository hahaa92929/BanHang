import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class AdjustInventoryDto {
  @IsString()
  productId!: string;

  @IsInt()
  quantity!: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  note?: string;
}
