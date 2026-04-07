import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateContentPageDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  excerpt?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  metaDescription?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publishedAt?: Date;
}
