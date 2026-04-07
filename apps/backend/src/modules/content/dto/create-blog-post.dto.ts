import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBlogPostDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  excerpt?: string;

  @IsString()
  @MinLength(10)
  content!: string;

  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedProductIds?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  readTimeMinutes?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publishedAt?: Date;
}
