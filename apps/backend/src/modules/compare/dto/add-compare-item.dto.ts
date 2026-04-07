import { IsString, MinLength } from 'class-validator';

export class AddCompareItemDto {
  @IsString()
  @MinLength(1)
  productId!: string;
}
