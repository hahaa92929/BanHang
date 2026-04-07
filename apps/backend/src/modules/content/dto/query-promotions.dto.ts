import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const promotionKinds = ['banner', 'flash_sale', 'popup', 'newsletter'] as const;
const promotionPlacements = [
  'home_hero',
  'home_flash_sale',
  'home_popup',
  'category_top',
  'checkout_sidebar',
] as const;

export class QueryPromotionsDto {
  @IsOptional()
  @IsIn(promotionKinds)
  kind?: (typeof promotionKinds)[number];

  @IsOptional()
  @IsIn(promotionPlacements)
  placement?: (typeof promotionPlacements)[number];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeInactive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
