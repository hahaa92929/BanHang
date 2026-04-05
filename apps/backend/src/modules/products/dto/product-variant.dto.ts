import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ProductVariantWarehouseStockDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  warehouseCode?: string;

  @IsInt()
  @Min(0)
  quantity!: number;
}

export class ProductVariantDto {
  @IsString()
  @MinLength(3)
  sku!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantWarehouseStockDto)
  warehouseStocks?: ProductVariantWarehouseStockDto[];
}
