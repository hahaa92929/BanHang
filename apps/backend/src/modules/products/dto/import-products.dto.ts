import { Type } from 'class-transformer';
import { ArrayMinSize, ValidateNested } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

export class ImportProductsDto {
  @ValidateNested({ each: true })
  @Type(() => CreateProductDto)
  @ArrayMinSize(1)
  items!: CreateProductDto[];
}
