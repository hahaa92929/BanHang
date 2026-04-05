import { IsString, MinLength } from 'class-validator';

export class AddWishlistItemDto {
  @IsString()
  @MinLength(2)
  productId!: string;
}
