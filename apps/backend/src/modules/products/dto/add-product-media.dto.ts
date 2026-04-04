import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddProductMediaDto {
  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
