import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCustomerNoteDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  content!: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPinned?: boolean;
}
