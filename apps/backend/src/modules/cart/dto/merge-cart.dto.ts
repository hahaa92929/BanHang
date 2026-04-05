import { Type } from 'class-transformer';
import { ArrayMinSize, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class MergeCartItemDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class MergeCartDto {
  @ValidateNested({ each: true })
  @Type(() => MergeCartItemDto)
  @ArrayMinSize(1)
  items!: MergeCartItemDto[];
}
