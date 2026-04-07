import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const promotionKinds = ['banner', 'flash_sale', 'popup', 'newsletter'] as const;
const promotionPlacements = [
  'home_hero',
  'home_flash_sale',
  'home_popup',
  'category_top',
  'checkout_sidebar',
] as const;

export class CreatePromotionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  key?: string;

  @IsIn(promotionKinds)
  kind!: (typeof promotionKinds)[number];

  @IsIn(promotionPlacements)
  placement!: (typeof promotionPlacements)[number];

  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  content?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @IsOptional()
  @IsUrl()
  linkUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  discountPercent?: number;

  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
